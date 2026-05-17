/**
 * GraphRAGEngine - 图增强检索引擎
 *
 * 核心功能：
 * 1. 向量检索（BGE-M3 + PostgreSQL）
 * 2. 知识图谱增强（可选）
 * 3. 实体提取与关系推理
 * 4. 混合评分与去重
 */

import { RAGEngine, type RAGConfig } from '../memory/integration/RAGEngine.js'

/**
 * 图扩展配置
 */
export interface GraphExpansionConfig {
  /** 图扩展深度（默认 2） */
  depth?: number
  /** 每层扩展的实体数量（默认 5） */
  topKPerLevel?: number
}

/**
 * GraphRAG 配置
 */
export interface GraphRAGConfig extends RAGConfig {
  /** 统一知识图谱实例（可选，用于向后兼容） */
  knowledgeGraph?: any
  /** 图扩展配置 */
  graphExpansion?: GraphExpansionConfig
  /** 向量检索权重（默认 0.7） */
  vectorWeight?: number
  /** 图检索权重（默认 0.3） */
  graphWeight?: number
  /** 去重相似度阈值（默认 0.95） */
  dedupThreshold?: number
}

/**
 * 图扩展结果
 */
export interface GraphExpansionResult {
  /** 提取的实体 */
  entities: string[]
  /** 检索到的相关概念 */
  relatedConcepts: Array<{
    id: string
    name: string
    content: string
    score: number
  }>
  /** 推理出的关系 */
  inferredRelations: Array<{
    entity1: string
    entity2: string
    relation: string
    confidence: number
  }>
}

/**
 * GraphRAG 结果
 */
export interface GraphRAGResult {
  /** 增强后的查询 */
  augmentedQuery: string
  /** 检索到的文档 */
  retrievedDocs: Array<{
    content: string
    similarity: number
    metadata: Record<string, any> | null
    type: string
    source: 'vector' | 'graph'
  }>
  /** 图扩展结果 */
  graphExpansion?: GraphExpansionResult
}

/**
 * GraphRAG 引擎
 *
 * 继承基础 RAGEngine，添加知识图谱增强功能
 */
export class GraphRAGEngine extends RAGEngine {
  private knowledgeGraph: any | null
  private graphExpansionDepth: number
  private vectorWeight: number
  private graphWeight: number
  private dedupThreshold: number

  constructor(config: GraphRAGConfig) {
    super(config)

    // 知识图谱（可选）
    this.knowledgeGraph = config.knowledgeGraph ?? null

    // 图扩展配置
    this.graphExpansionDepth = config.graphExpansion?.depth ?? 2

    // 评分权重
    this.vectorWeight = config.vectorWeight ?? 0.7
    this.graphWeight = config.graphWeight ?? 0.3

    // 去重阈值
    this.dedupThreshold = config.dedupThreshold ?? 0.95
  }

  /**
   * 图增强检索（核心功能）
   *
   * 流程：
   * 1. 向量检索基础文档
   * 2. 提取关键实体
   * 3. 使用知识图谱查询相关概念
   * 4. 推理实体间关系
   * 5. 混合评分与去重
   */
  async retrieveWithGraph(
    query: string,
    options?: {
      topK?: number
      threshold?: number
      filter?: {
        types?: string[]
        tags?: string[]
        agent?: string
      }
      enableGraph?: boolean // 是否启用图增强（默认 true）
    }
  ): Promise<
    Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'vector' | 'graph'
    }>
  > {
    const enableGraph = options?.enableGraph ?? true

    // 1. 基础向量检索
    const vectorResults = await super.retrieve(query, options)

    // 如果没有知识图谱或未启用图增强，直接返回向量结果
    if (!this.knowledgeGraph || !enableGraph) {
      return vectorResults.map((r) => ({ ...r, source: 'vector' as const }))
    }

    // 2. 图增强检索
    const graphExpansion = await this.performGraphExpansion(query, vectorResults)

    // 3. 合并向量结果和图结果
    const mergedResults = await this.mergeResults(
      vectorResults.map((r) => ({ ...r, source: 'vector' as const })),
      graphExpansion
    )

    return mergedResults
  }

  /**
   * 执行图扩展
   */
  private async performGraphExpansion(
    query: string,
    vectorResults: Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
    }>
  ): Promise<
    Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'graph'
    }>
  > {
    try {
      // 1. 从向量结果中提取关键实体
      const entities = this.extractEntities(vectorResults.map((r) => r.content))

      if (entities.length === 0) {
        return []
      }

      // 2. 使用知识图谱查询相关概念
      const graphResults = await this.queryKnowledgeGraph(entities)

      // 3. 推理实体间关系
      const relations = await this.inferRelations(entities)

      // 4. 转换为统一格式
      const graphEnhancedResults = graphResults.map((r) => ({
        content: r.content,
        similarity: r.score, // 图结果的分数
        metadata: {
          ...r.metadata,
          source: 'knowledge-graph',
          entities: entities.filter((e) => r.content.toLowerCase().includes(e.toLowerCase())),
          relations: relations.filter(
            (rel) =>
              r.content.toLowerCase().includes(rel.entity1.toLowerCase()) ||
              r.content.toLowerCase().includes(rel.entity2.toLowerCase())
          ),
        },
        type: r.type,
        source: 'graph' as const,
      }))

      return graphEnhancedResults
    } catch (error) {
      console.warn('图扩展失败，回退到向量检索:', error)
      return []
    }
  }

  /**
   * 从文档内容中提取关键实体
   *
   * 简单关键词提取方法：
   * 1. 按常见分隔符分割
   * 2. 过滤停用词
   * 3. 统计词频
   * 4. 返回 top N 名词/术语
   */
  private extractEntities(contents: string[], topN: number = 10): string[] {
    // 简单分隔符
    const delimiters = /[,，;；\s\.\。\、\n\t]+/

    // 合并所有内容
    const allText = contents.join(' ')

    // 分词
    const tokens = allText.split(delimiters).filter((token) => token.length > 1)

    // 统计词频
    const frequency = new Map<string, number>()
    for (const token of tokens) {
      // 过滤停用词（简单版）
      if (this.isStopWord(token)) {
        continue
      }
      frequency.set(token, (frequency.get(token) || 0) + 1)
    }

    // 按频率排序
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)

    return sorted.map((entry) => entry[0])
  }

  /**
   * 简单停用词过滤
   */
  private isStopWord(word: string): boolean {
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

    return stopWords.has(word.toLowerCase())
  }

  /**
   * 使用知识图谱查询相关概念
   */
  private async queryKnowledgeGraph(entities: string[]): Promise<
    Array<{
      id: string
      type: string
      name: string
      content: string
      score: number
      metadata?: Record<string, any>
    }>
  > {
    if (!this.knowledgeGraph) {
      return []
    }

    try {
      // 为每个实体查询相关知识
      const allResults: any[] = []

      for (const entity of entities) {
        try {
          const results = await this.knowledgeGraph.query({
            text: entity,
            topK: 3, // 每个实体查询 3 个相关概念
          })
          allResults.push(...results)
        } catch (error) {
          console.warn(`查询实体 ${entity} 失败:`, error)
        }
      }

      return allResults
    } catch (error) {
      console.warn('知识图谱查询失败:', error)
      return []
    }
  }

  /**
   * 推理实体间关系
   */
  private async inferRelations(entities: string[]): Promise<
    Array<{
      entity1: string
      entity2: string
      relation: string
      confidence: number
    }>
  > {
    if (!this.knowledgeGraph || entities.length < 2) {
      return []
    }

    try {
      const relations: any[] = []

      // 推理实体对之间的关系
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          try {
            const inference = await this.knowledgeGraph.inferRelation(entities[i], entities[j])

            if (inference.confidence > 0.5) {
              relations.push({
                entity1: entities[i],
                entity2: entities[j],
                relation: inference.relation,
                confidence: inference.confidence,
              })
            }
          } catch (error) {
            console.warn(`推理关系 ${entities[i]} -> ${entities[j]} 失败:`, error)
          }
        }
      }

      return relations
    } catch (error) {
      console.warn('关系推理失败:', error)
      return []
    }
  }

  /**
   * 合并向量结果和图结果
   *
   * 流程：
   * 1. 混合评分（向量分数 * 权重 + 图分数 * 权重）
   * 2. 去重（余弦相似度 > 0.95 视为重复）
   * 3. 按分数排序
   */
  private async mergeResults(
    vectorResults: Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'vector'
    }>,
    graphResults: Array<{
      content: string
      similarity: number
      metadata: Record<string, any> | null
      type: string
      source: 'graph'
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
    // 1. 混合评分
    const merged: Map<
      string,
      {
        content: string
        similarity: number
        metadata: Record<string, any> | null
        type: string
        source: 'vector' | 'graph'
      }
    > = new Map()

    // 向量结果
    for (const result of vectorResults) {
      const key = this.getDocKey(result)
      merged.set(key, {
        ...result,
        similarity: result.similarity * this.vectorWeight,
      })
    }

    // 图结果
    for (const result of graphResults) {
      const key = this.getDocKey(result)

      if (merged.has(key)) {
        // 已存在，合并分数
        const existing = merged.get(key)!
        existing.similarity = Math.max(existing.similarity, result.similarity * this.graphWeight)
        // 合并元数据
        if (result.metadata) {
          existing.metadata = {
            ...existing.metadata,
            ...result.metadata,
            sources: [...(existing.metadata?.sources || []), 'graph'],
          }
        }
      } else {
        // 不存在，添加新条目
        merged.set(key, {
          ...result,
          similarity: result.similarity * this.graphWeight,
        })
      }
    }

    // 2. 转换为数组
    const results = Array.from(merged.values())

    // 3. 去重（余弦相似度 > 0.95）
    const deduplicated: typeof results = []
    for (const result of results) {
      let isDuplicate = false

      for (const existing of deduplicated) {
        if (this.isDuplicate(result, existing)) {
          isDuplicate = true
          // 保留分数更高的
          if (result.similarity > existing.similarity) {
            const index = deduplicated.indexOf(existing)
            deduplicated[index] = result
          }
          break
        }
      }

      if (!isDuplicate) {
        deduplicated.push(result)
      }
    }

    // 4. 按分数排序
    deduplicated.sort((a, b) => b.similarity - a.similarity)

    return deduplicated
  }

  /**
   * 获取文档唯一标识（用于去重）
   */
  private getDocKey(result: { content: string; metadata: Record<string, any> | null }): string {
    // 简单使用内容的前 100 个字符作为 key
    // 更好的方式是使用哈希，但这里简化处理
    return result.content.slice(0, 100).trim()
  }

  /**
   * 判断两个文档是否重复
   *
   * 使用简单的文本相似度计算
   * 如果相似度 > 阈值，视为重复
   */
  private isDuplicate(doc1: { content: string }, doc2: { content: string }): boolean {
    const similarity = this.calculateTextSimilarity(doc1.content, doc2.content)
    return similarity > this.dedupThreshold
  }

  /**
   * 计算文本相似度（简单的余弦相似度）
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // 1. 分词
    const tokens1 = this.tokenize(text1)
    const tokens2 = this.tokenize(text2)

    // 2. 构建词频向量
    const allTokens = new Set([...tokens1, ...tokens2])
    const vector1: number[] = []
    const vector2: number[] = []

    for (const token of Array.from(allTokens)) {
      vector1.push(tokens1.filter((t) => t === token).length)
      vector2.push(tokens2.filter((t) => t === token).length)
    }

    // 3. 计算余弦相似度
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
  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/)
  }

  /**
   * 增强查询（重写，包含图上下文）
   */
  async augmentQuery(
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
  ): Promise<GraphRAGResult> {
    const enableGraph = options?.enableGraph ?? true

    // 使用图增强检索
    const retrievedDocs = await this.retrieveWithGraph(query, options)

    // 提取图上下文
    let graphContext = ''
    let graphExpansion: GraphExpansionResult | undefined

    if (enableGraph && this.knowledgeGraph) {
      const graphDocs = retrievedDocs.filter((d) => d.source === 'graph')
      if (graphDocs.length > 0) {
        // 收集实体和关系
        const entities = new Set<string>()
        const relations = new Set<string>()

        for (const doc of graphDocs) {
          if (doc.metadata?.entities) {
            doc.metadata.entities.forEach((e: string) => entities.add(e))
          }
          if (doc.metadata?.relations) {
            doc.metadata.relations.forEach((r: any) =>
              relations.add(`${r.entity1} → ${r.relation} → ${r.entity2}`)
            )
          }
        }

        // 构建图上下文
        if (entities.size > 0) {
          graphContext += `相关实体: ${Array.from(entities).join(', ')}\n`
        }
        if (relations.size > 0) {
          graphContext += `推理关系:\n${Array.from(relations)
            .map((r) => `  - ${r}`)
            .join('\n')}\n`
        }

        graphExpansion = {
          entities: Array.from(entities),
          relatedConcepts: graphDocs.map((d) => ({
            id: d.metadata?.id || '',
            name: d.metadata?.name || d.content.slice(0, 50),
            content: d.content,
            score: d.similarity,
          })),
          inferredRelations: graphDocs
            .flatMap((d) => d.metadata?.relations || [])
            .map((r: any) => ({
              entity1: r.entity1,
              entity2: r.entity2,
              relation: r.relation,
              confidence: r.confidence,
            })),
        }
      }
    }

    // 构建增强上下文
    const contextParts = retrievedDocs.map((doc, i) => {
      const source = doc.metadata?.source || `文档 ${i + 1}`
      const sourceType = doc.source === 'vector' ? '向量检索' : '知识图谱'
      return `[${source}] (${sourceType}, 相似度: ${doc.similarity.toFixed(3)})\n${doc.content}`
    })

    const context = contextParts.join('\n\n')

    // 构建增强查询
    const augmentedQuery = graphContext
      ? `
基于以下参考信息回答问题：

知识图谱上下文：
${graphContext}

参考文档：
${context}

问题：${query}
`.trim()
      : `
基于以下参考信息回答问题：

参考文档：
${context}

问题：${query}
`.trim()

    return {
      augmentedQuery,
      retrievedDocs,
      graphExpansion,
    }
  }

  /**
   * 获取统计信息（重写，包含图统计）
   */
  async getStats(): Promise<{
    vector: any
    graph: any
    bge: {
      cacheSize: number
      cacheHits: number
      cacheMisses: number
      cacheHitRate: number
    }
    knowledgeGraph?: {
      enabled: boolean
      sources?: any
    }
  }> {
    const baseStats = await super.getStats()

    return {
      ...baseStats,
      knowledgeGraph: this.knowledgeGraph
        ? {
            enabled: true,
            sources: this.knowledgeGraph.getStats?.(),
          }
        : {
            enabled: false,
          },
    }
  }
}

/**
 * 创建 GraphRAG 引擎
 */
export async function createGraphRAGEngine(config: GraphRAGConfig): Promise<GraphRAGEngine> {
  const engine = new GraphRAGEngine(config)
  await engine.initialize()

  return engine
}
