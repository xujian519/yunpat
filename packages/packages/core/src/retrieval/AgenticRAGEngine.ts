/**
 * AgenticRAGEngine - 自适应检索增强生成引擎
 *
 * 在 GraphRAG 基础上增加自纠错循环：
 * 1. 执行初始检索
 * 2. 评估检索质量（上下文覆盖度、相关性）
 * 3. 如果质量不足，生成补充查询重新检索
 * 4. 合并结果直到质量达标或达到最大轮数
 */

import { GraphRAGEngine, type GraphRAGResult } from './GraphRAGEngine.js'

/**
 * AgenticRAG 配置
 */
export interface AgenticRAGConfig {
  /** 数据库 URL */
  databaseUrl: string
  /** BGE-M3 配置 */
  bgeConfig?: {
    baseURL?: string
    apiKey?: string
    model?: string
  }
  /** 检索配置 */
  retrieval?: {
    topK?: number
    threshold?: number
  }
  /** 统一知识图谱实例（可选，用于向后兼容） */
  knowledgeGraph?: any
  /** 图扩展配置 */
  graphExpansion?: any
  /** 图权重（默认 0.3） */
  graphWeight?: number
  /** 最大检索轮数（默认 3） */
  maxRetrievalRounds?: number
  /** 质量阈值（默认 0.7），低于此值触发补充检索 */
  qualityThreshold?: number
}

/**
 * 质量评估结果
 */
export interface QualityAssessment {
  /** 质量分数（0-1） */
  score: number
  /** 上下文覆盖度（0-1） */
  coverage: number
  /** 相关性（0-1） */
  relevance: number
  /** 识别的知识缺口 */
  gaps: string[]
}

/**
 * AgenticRAG 结果
 */
export interface AgenticRAGResult extends GraphRAGResult {
  /** 检索轮数 */
  retrievalRounds: number
  /** 最终质量分数 */
  qualityScore: number
  /** 后续查询列表 */
  followUpQueries: string[]
}

/**
 * AgenticRAG 引擎
 *
 * 继承 GraphRAG，添加自纠错循环功能
 */
export class AgenticRAGEngine extends GraphRAGEngine {
  private maxRounds: number
  private qualityThreshold: number

  constructor(config: AgenticRAGConfig) {
    super({
      databaseUrl: config.databaseUrl,
      bgeConfig: config.bgeConfig,
      retrieval: config.retrieval,
      knowledgeGraph: config.knowledgeGraph,
      graphExpansion: config.graphExpansion,
      graphWeight: config.graphWeight,
    })

    this.maxRounds = config.maxRetrievalRounds ?? 3
    this.qualityThreshold = config.qualityThreshold ?? 0.7
  }

  /**
   * 自适应检索（带自纠错循环）
   *
   * 流程：
   * 1. 执行初始检索
   * 2. 评估检索质量
   * 3. 如果质量不足且未达到最大轮数：
   *    a. 提取知识缺口
   *    b. 生成补充查询
   *    c. 重新检索
   *    d. 合并结果（去重）
   * 4. 返回最终结果
   */
  async retrieveWithAgenticLoop(
    query: string,
    options?: {
      topK?: number
      threshold?: number
      filter?: {
        types?: string[]
        tags?: string[]
        agent?: string
      }
      enableGraph?: boolean
    }
  ): Promise<AgenticRAGResult> {
    let currentResults: Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'vector' | 'graph'
    }> = []

    const followUpQueries: string[] = []
    let round = 0

    currentResults = await this.retrieveWithGraph(query, options)
    round++

    while (round < this.maxRounds) {
      const assessment = this.assessRetrievalQuality(currentResults, query)

      if (assessment.score >= this.qualityThreshold) {
        break
      }

      const followUpQuery = this.generateFollowUpQuery(query, assessment.gaps)
      followUpQueries.push(followUpQuery)

      const newResults = await this.retrieveWithGraph(followUpQuery, options)

      currentResults = await this.mergeAndDedup(currentResults, newResults)
      round++
    }

    const finalAssessment = this.assessRetrievalQuality(currentResults, query)

    const result: AgenticRAGResult = {
      augmentedQuery: query,
      retrievedDocs: currentResults,
      retrievalRounds: round,
      qualityScore: finalAssessment.score,
      followUpQueries,
    }

    return result
  }

  /**
   * 评估检索质量
   *
   * 计算指标：
   * - 平均相似度（相关性）
   * - 结果数量（覆盖度）
   * - 超过阈值的结果比例
   *
   * 识别知识缺口：
   * - 从查询中提取关键术语
   * - 检查结果中是否包含这些术语
   * - 未覆盖的术语视为缺口
   */
  private assessRetrievalQuality(
    results: Array<{
      content: string
      similarity: number
    }>,
    query: string
  ): QualityAssessment {
    if (results.length === 0) {
      return {
        score: 0,
        coverage: 0,
        relevance: 0,
        gaps: this.extractKeyTerms(query),
      }
    }

    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length

    const coverage = Math.min(results.length / 10, 1)

    const threshold = 0.7
    const aboveThresholdCount = results.filter((r) => r.similarity >= threshold).length
    const aboveThresholdRatio = aboveThresholdCount / results.length

    const relevance = avgSimilarity * 0.7 + aboveThresholdRatio * 0.3
    const score = coverage * 0.3 + relevance * 0.7

    const keyTerms = this.extractKeyTerms(query)
    const gaps: string[] = []

    for (const term of keyTerms) {
      const covered = results.some((r) => r.content.toLowerCase().includes(term.toLowerCase()))
      if (!covered) {
        gaps.push(term)
      }
    }

    return {
      score,
      coverage,
      relevance,
      gaps,
    }
  }

  /**
   * 从查询中提取关键术语
   *
   * 简单实现：
   * - 按标点符号和空格分割
   * - 过滤停用词和短词
   * - 返回候选术语
   */
  private extractKeyTerms(query: string): string[] {
    const delimiters = /[,，;；\s\.\。\、\n\t?？!！]+/
    const tokens = query.split(delimiters).filter((token) => token.length > 1)

    // 停用词列表（与 GraphRAGEngine 保持一致）
    const stopWords = new Set([
      '的',
      '了',
      '是',
      '在',
      '和',
      '有',
      '不',
      '我',
      '你',
      '他',
      '她',
      '它',
      '我们',
      '你们',
      '他们',
      '这',
      '那',
      '一个',
      '一种',
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'when',
      'where',
      'why',
      'how',
      'what',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
      'of',
      'to',
      'from',
      'in',
      'on',
      'at',
      'by',
      'with',
      'for',
      'about',
      'as',
      'into',
      'like',
      'through',
      'after',
      'over',
      'between',
      'out',
      'against',
      'during',
      'without',
      'before',
      'under',
      'around',
      'among',
    ])

    return tokens.filter((token) => !stopWords.has(token.toLowerCase()))
  }

  private generateFollowUpQuery(original: string, gaps: string[]): string {
    if (gaps.length === 0) {
      return original
    }

    const topGaps = gaps.slice(0, 3)

    return `${original} ${topGaps.join(' ')}`
  }

  /**
   * 合并结果（去重）
   *
   * 使用余弦相似度去重：
   * - 相似度 > 0.95 视为重复
   * - 保留相似度更高的版本
   */
  private async mergeAndDedup(
    existing: Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'vector' | 'graph'
    }>,
    newResults: Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'vector' | 'graph'
    }>
  ): Promise<
    Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'vector' | 'graph'
    }>
  > {
    const dedupThreshold = 0.95
    const merged = [...existing]

    for (const newResult of newResults) {
      let isDuplicate = false

      for (const existingResult of merged) {
        const similarity = this.computeTextSimilarity(newResult.content, existingResult.content)

        if (similarity > dedupThreshold) {
          isDuplicate = true
          if (newResult.similarity > existingResult.similarity) {
            const index = merged.indexOf(existingResult)
            merged[index] = newResult
          }
          break
        }
      }

      if (!isDuplicate) {
        merged.push(newResult)
      }
    }

    merged.sort((a, b) => b.similarity - a.similarity)

    return merged
  }

  /**
   * 计算文本相似度（余弦相似度）
   *
   * 与 GraphRAGEngine 保持一致的实现
   */
  private computeTextSimilarity(text1: string, text2: string): number {
    const tokens1 = this.splitIntoTokens(text1)
    const tokens2 = this.splitIntoTokens(text2)

    const allTokens = new Set([...tokens1, ...tokens2])
    const vector1: number[] = []
    const vector2: number[] = []

    for (const token of Array.from(allTokens)) {
      vector1.push(tokens1.filter((t) => t === token).length)
      vector2.push(tokens2.filter((t) => t === token).length)
    }

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0)
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0))

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0
    }

    return dotProduct / (magnitude1 * magnitude2)
  }

  /**
   * 简单分词
   */
  private splitIntoTokens(text: string): string[] {
    return text.toLowerCase().split(/\s+/)
  }
}

/**
 * 创建 AgenticRAG 引擎
 */
export async function createAgenticRAGEngine(config: AgenticRAGConfig): Promise<AgenticRAGEngine> {
  const engine = new AgenticRAGEngine(config)
  await engine.initialize()

  return engine
}
