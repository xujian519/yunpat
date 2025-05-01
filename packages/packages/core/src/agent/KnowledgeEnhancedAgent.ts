/**
 * 知识增强 Agent 基类
 *
 * 为所有法律/专利相关的 Agent 提供知识图谱能力
 */

import { Agent, AgentConfig } from './Agent.js'
import type { ExecutionContext } from '../lifecycle/Lifecycle.js'

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
   * 查询知识图谱
   *
   * @param queryText - 查询文本
   * @param topK - 返回结果数量（默认 5）
   * @returns 知识结果数组
   */
  protected async queryKnowledge(queryText: string, topK: number = 5): Promise<KnowledgeResult[]> {
    if (!this.knowledgeGraph) {
      console.warn(`[${this.name}] 知识图谱未启用`)
      return []
    }

    try {
      return await this.knowledgeGraph.query(queryText, { topK })
    } catch (err) {
      console.error(`[${this.name}] 知识图谱查询失败:`, err)
      return []
    }
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
   * 构建知识增强的 Prompt
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
