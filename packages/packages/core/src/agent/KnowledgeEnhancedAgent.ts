/**
 * 知识增强 Agent 基类
 *
 * 为所有法律/专利相关的 Agent 提供知识图谱能力
 */

import { Agent, AgentConfig } from './Agent.js'
import type { ExecutionContext } from '../lifecycle/Lifecycle.js'
import type { PromptSection } from '../prompt/index.js'

// 知识来源类型常量
const SOURCE_POSTGRESQL_VECTOR = 'postgresql_vector'
const SOURCE_POSTGRESQL_STRUCTURED = 'postgresql_structured'
const SOURCE_YUNPAT_CONCEPT = 'yunpat_concept'

// 类型定义（避免直接依赖 unified-knowledge-graph）
export interface KnowledgeResult {
  source: string
  id: string
  type: string
  name: string
  content: string
  score: number
  metadata?: Record<string, unknown>
}

export interface RelationInference {
  relation: string
  confidence: number
  reasoning: string[]
  sources: string[]
}

export interface KnowledgeEnhancedAgentConfig extends AgentConfig {
  enableKnowledgeGraph?: boolean
}

/**
 * 知识图谱接口（动态加载）
 */
interface KnowledgeGraphInterface {
  query(queryText: string, options?: { topK?: number }): Promise<KnowledgeResult[]>
  inferRelation(concept1: string, concept2: string): Promise<RelationInference>
}

/** 知识来源分组 */
interface GroupedKnowledge {
  postgresqlVector: KnowledgeResult[]
  postgresqlStructured: KnowledgeResult[]
  yunpatConcepts: KnowledgeResult[]
  other: KnowledgeResult[]
}

function groupBySource(results: KnowledgeResult[]): GroupedKnowledge {
  return results.reduce<GroupedKnowledge>(
    (acc, k) => {
      switch (k.source) {
        case SOURCE_POSTGRESQL_VECTOR:
          acc.postgresqlVector.push(k)
          break
        case SOURCE_POSTGRESQL_STRUCTURED:
          acc.postgresqlStructured.push(k)
          break
        case SOURCE_YUNPAT_CONCEPT:
          acc.yunpatConcepts.push(k)
          break
        default:
          acc.other.push(k)
      }
      return acc
    },
    { postgresqlVector: [], postgresqlStructured: [], yunpatConcepts: [], other: [] }
  )
}

/**
 * 知识增强 Agent 基类
 *
 * 自动为 Agent 提供知识图谱能力
 */
export abstract class KnowledgeEnhancedAgent<TInput = any, TOutput = any> extends Agent<
  TInput,
  TOutput
> {
  protected knowledgeGraph?: KnowledgeGraphInterface
  protected readonly enableKnowledgeGraph: boolean

  constructor(config: KnowledgeEnhancedAgentConfig) {
    super(config)
    this.enableKnowledgeGraph = config.enableKnowledgeGraph ?? true
  }

  /**
   * 初始化（自动调用）
   */
  protected async init?(_context: ExecutionContext): Promise<void> {
    if (this.enableKnowledgeGraph) {
      try {
        const { createKnowledgeGraph } = await import('@yunpat/unified-knowledge-graph')
        this.knowledgeGraph = await createKnowledgeGraph()
        console.log(`[${this.name}] ✅ 知识图谱已启用`)
      } catch (err: any) {
        console.warn(`[${this.name}] ⚠️ 知识图谱初始化失败:`, err?.message || err)
        this.knowledgeGraph = undefined
      }
    }
  }

  /**
   * 查询知识图谱（支持 Token Budget 感知）
   *
   * @param queryText - 查询文本
   * @param topK - 返回结果数量（默认 5）
   * @param maxTokens - 最大 Token 预算（默认 4000）
   * @returns 知识结果数组（已按预算截断）
   */
  protected async queryKnowledge(
    queryText: string,
    topK: number = 5,
    maxTokens: number = 4000
  ): Promise<KnowledgeResult[]> {
    if (!this.knowledgeGraph) {
      console.warn(`[${this.name}] 知识图谱未启用`)
      return []
    }

    try {
      const results = await this.knowledgeGraph.query(queryText, { topK })
      return this.truncateKnowledgeByBudget(results, maxTokens)
    } catch (err) {
      console.error(`[${this.name}] 知识图谱查询失败:`, err)
      return []
    }
  }

  /**
   * 按 Token 预算截断知识结果
   *
   * 保留高相关性结果，截断低相关性结果的内容。
   */
  protected truncateKnowledgeByBudget(
    results: KnowledgeResult[],
    maxTokens: number
  ): KnowledgeResult[] {
    // 简单估算：中文按 0.6 token/字，英文按 0.3 token/字
    const estimateTokens = (text: string): number => {
      const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
      const otherChars = text.length - chineseChars
      return Math.ceil(chineseChars * 0.6 + otherChars * 0.3)
    }

    let accumulated = 0
    const truncated: KnowledgeResult[] = []

    for (const result of results) {
      const tokens = estimateTokens(result.content)
      if (accumulated + tokens > maxTokens && truncated.length > 0) {
        // 预算已满，截断当前结果的内容
        const remaining = maxTokens - accumulated
        const maxChars = Math.floor(remaining / 0.6) // 保守按中文计算
        truncated.push({
          ...result,
          content:
            result.content.substring(0, Math.max(maxChars, 50)) + '... [内容因 Token 预算截断]',
        })
        break
      }
      accumulated += tokens
      truncated.push(result)
    }

    if (truncated.length < results.length) {
      console.log(
        `[${this.name}] 知识结果从 ${results.length} 条截断至 ${truncated.length} 条（预算 ${maxTokens} tokens）`
      )
    }

    return truncated
  }

  /**
   * 推理概念间的关系
   *
   * @param concept1 - 概念 1
   * @param concept2 - 概念 2
   * @returns 关系推理结果
   */
  protected async inferRelation(concept1: string, concept2: string): Promise<RelationInference> {
    if (!this.knowledgeGraph) {
      console.warn(`[${this.name}] 知识图谱未启用`)
      return {
        relation: '知识图谱未启用',
        confidence: 0.0,
        reasoning: [],
        sources: [],
      }
    }

    try {
      return await this.knowledgeGraph.inferRelation(concept1, concept2)
    } catch (err: unknown) {
      console.error(`[${this.name}] 关系推理失败:`, err)
      return {
        relation: '推理失败',
        confidence: 0.0,
        reasoning: [err instanceof Error ? err.message : String(err)],
        sources: [],
      }
    }
  }

  /**
   * 构建知识增强的 Prompt（向后兼容）
   */
  protected buildKnowledgeEnhancedPrompt(
    userQuery: string,
    knowledgeResults: KnowledgeResult[]
  ): string {
    if (knowledgeResults.length === 0) {
      return userQuery
    }

    const grouped = groupBySource(knowledgeResults)
    let prompt = `基于以下法律知识回答问题：\n\n`

    if (grouped.postgresqlVector.length > 0) {
      prompt += `【法律条文与判例】（向量检索）\n`
      prompt += this.formatKnowledgeSection(grouped.postgresqlVector, 200)
    }

    if (grouped.postgresqlStructured.length > 0) {
      prompt += `【结构化知识】\n`
      prompt += this.formatKnowledgeSection(grouped.postgresqlStructured, 200)
    }

    if (grouped.yunpatConcepts.length > 0) {
      prompt += `【核心概念】\n`
      grouped.yunpatConcepts.forEach((k, i) => {
        const level = (k.metadata?.level as number) || 0
        prompt += `${i + 1}. ${k.name}（${level}级概念）\n`
        if (k.content) {
          prompt += `   ${k.content.substring(0, 150)}...\n`
        }
        const relatedPages = k.metadata?.relatedPages
        if (Array.isArray(relatedPages) && relatedPages.length > 0) {
          prompt += `   相关页面: ${relatedPages.slice(0, 3).join(', ')}\n`
        }
        prompt += `\n`
      })
    }

    prompt += `---\n\n`
    prompt += `问题：${userQuery}\n\n`
    prompt += `请基于上述法律知识，结合你的专业知识，给出准确、详细的回答。`

    return prompt
  }

  /**
   * 构建知识上下文 PromptSections（用于 PromptAssemblyPipeline）
   *
   * 将知识检索结果转换为可注入 Prompt 管道的 Section。
   * 这些 Section 标记为 dynamic，因为它们随每次查询变化。
   */
  protected buildKnowledgeContextSections(knowledgeResults: KnowledgeResult[]): PromptSection[] {
    if (knowledgeResults.length === 0) {
      return []
    }

    const grouped = groupBySource(knowledgeResults)
    const sections: PromptSection[] = []

    if (grouped.postgresqlVector.length > 0) {
      const content = this.formatKnowledgeSection(grouped.postgresqlVector, 300)
      sections.push({
        id: 'knowledge_law_vector',
        priority: 70, // 高于 Agent 默认，低于 Coordinator
        content: `## 相关法律条文与判例\n\n${content}`,
        cacheScope: null,
        isDynamic: true,
      })
    }

    if (grouped.postgresqlStructured.length > 0) {
      const content = this.formatKnowledgeSection(grouped.postgresqlStructured, 300)
      sections.push({
        id: 'knowledge_structured',
        priority: 70,
        content: `## 结构化知识\n\n${content}`,
        cacheScope: null,
        isDynamic: true,
      })
    }

    if (grouped.yunpatConcepts.length > 0) {
      const content = grouped.yunpatConcepts
        .map((k, i) => {
          const level = (k.metadata?.level as number) || 0
          let text = `${i + 1}. ${k.name}（${level}级概念）`
          if (k.content) text += `\n   ${k.content.substring(0, 200)}...`
          const pages = k.metadata?.relatedPages
          if (Array.isArray(pages) && pages.length > 0) {
            text += `\n   相关页面: ${pages.slice(0, 3).join(', ')}`
          }
          return text
        })
        .join('\n\n')

      sections.push({
        id: 'knowledge_concepts',
        priority: 70,
        content: `## 核心概念\n\n${content}`,
        cacheScope: null,
        isDynamic: true,
      })
    }

    return sections
  }

  private formatKnowledgeSection(results: KnowledgeResult[], maxContentLength: number): string {
    let prompt = ''
    results.forEach((k, i) => {
      prompt += `${i + 1}. ${k.name}\n`
      prompt += `   ${k.content.substring(0, maxContentLength)}...\n\n`
    })
    return prompt
  }

  async execute(input: TInput): Promise<TOutput> {
    if (!this.enableKnowledgeGraph || !this.knowledgeGraph) {
      return super.execute(input)
    }

    const queryText = this.extractQueryText(input)

    if (queryText) {
      const knowledgeResults = await this.queryKnowledge(queryText, 5)
      const enhancedPrompt = this.buildKnowledgeEnhancedPrompt(queryText, knowledgeResults)
      const enhancedInput = this.createEnhancedInput(input, enhancedPrompt, knowledgeResults)
      return super.execute(enhancedInput)
    }

    return super.execute(input)
  }

  protected extractQueryText(input: TInput): string {
    if (typeof input === 'string') {
      return input
    }

    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>
      return (obj.question || obj.query || obj.text || obj.prompt || '') as string
    }

    return ''
  }

  protected createEnhancedInput(
    originalInput: TInput,
    enhancedPrompt: string,
    knowledgeResults: KnowledgeResult[]
  ): TInput {
    if (typeof originalInput === 'object' && originalInput !== null) {
      return {
        ...originalInput,
        knowledgeEnhancedPrompt: enhancedPrompt,
        knowledgeResults,
      } as TInput
    }

    return originalInput
  }
}
