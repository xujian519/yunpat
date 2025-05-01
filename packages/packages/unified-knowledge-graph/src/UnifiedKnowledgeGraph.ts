/**
 * 统一知识图谱查询引擎
 *
 * 整合 OpenClaw、YunPat、Athena 三方知识图谱
 */

import { OpenClawAdapter } from './adapters/OpenClawAdapter.js'
import { YunPatAdapter } from './adapters/YunPatAdapter.js'

export type KnowledgeSource = 'openclaw' | 'yunpat' | 'athena'

export interface KnowledgeQuery {
  text: string
  sources?: KnowledgeSource[]
  method?: 'semantic' | 'symbolic' | 'graph' | 'hybrid'
  topK?: number
}

export interface KnowledgeResult {
  source: KnowledgeSource
  id: string
  type: string
  name: string
  content: string
  score: number
  metadata?: Record<string, any>
}

export interface RelationInference {
  relation: string
  confidence: number
  reasoning: string[]
  sources: KnowledgeSource[]
}

/**
 * 统一知识图谱
 *
 * 核心功能：
 * 1. 多源知识查询
 * 2. 混合排序
 * 3. 关系推理
 */
export class UnifiedKnowledgeGraph {
  private openclaw: OpenClawAdapter
  private yunpat: YunPatAdapter
  // private athena: AthenaAdapter  // TODO: 实现

  private initialized = false

  constructor() {
    this.openclaw = new OpenClawAdapter()
    this.yunpat = new YunPatAdapter()
  }

  /**
   * 初始化所有适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('初始化统一知识图谱...')

    // 并行初始化三方适配器
    await Promise.all([
      this.openclaw.initialize().catch((err) => {
        console.warn('[OpenClaw] 初始化失败:', err.message)
      }),
      this.yunpat.initialize().catch((err) => {
        console.warn('[YunPat] 初始化失败:', err.message)
      }),
      // TODO: Athena 初始化
    ])

    this.initialized = true
    console.log('✅ 统一知识图谱初始化完成')
  }

  /**
   * 统一查询接口
   */
  async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const sources = query.sources || ['openclaw', 'yunpat'] // 暂时不含 Athena
    const results: KnowledgeResult[] = []

    // 1. OpenClaw: 语义检索
    if (sources.includes('openclaw')) {
      const openclawResults = await this.openclaw.semanticSearch(query.text, query.topK || 5)
      results.push(
        ...openclawResults.map((r) => ({
          source: 'openclaw' as KnowledgeSource,
          id: r.node.id,
          type: r.node.nodeType,
          name: r.node.name,
          content: r.node.content,
          score: r.score,
          metadata: { nodeType: r.node.nodeType },
        }))
      )
    }

    // 2. YunPat: 概念检索
    if (sources.includes('yunpat')) {
      const yunpatResults = await this.yunpat.conceptSearch(query.text, query.topK || 5)
      results.push(
        ...yunpatResults.map((r) => ({
          source: 'yunpat' as KnowledgeSource,
          id: `concept_${r.concept.name}`,
          type: 'concept',
          name: r.concept.name,
          content: r.concept.name, // 简化：暂时使用名称作为内容
          score: r.score,
          metadata: { level: r.concept.level, parent: r.concept.parent },
        }))
      )
    }

    // 3. 混合排序和去重
    return this.rankAndDeduplicate(results, query.topK || 10)
  }

  /**
   * 关系推理
   */
  async inferRelation(
    concept1: string,
    concept2: string,
    sources?: KnowledgeSource[]
  ): Promise<RelationInference> {
    if (!this.initialized) {
      await this.initialize()
    }

    const relations: string[] = []
    const confidences: number[] = []
    const reasonings: string[] = []
    const activeSources: KnowledgeSource[] = []

    // 1. YunPat: 层次关系推理
    if (!sources || sources.includes('yunpat')) {
      try {
        const yunpatRelation = await this.yunpat.inferHierarchy(concept1, concept2)
        relations.push(yunpatRelation)
        confidences.push(0.8) // 符号推理置信度较高
        reasonings.push(`[YunPat 符号推理] ${yunpatRelation}`)
        activeSources.push('yunpat')
      } catch (err) {
        // 忽略错误
      }
    }

    // 2. OpenClaw: 图路径查找
    if (!sources || sources.includes('openclaw')) {
      try {
        const path = await this.openclaw.findPath(concept1, concept2)
        if (path.length > 0) {
          relations.push(`图路径: ${path.join(' → ')}`)
          confidences.push(0.7)
          reasonings.push(`[OpenClaw 图查询] 找到路径长度 ${path.length}`)
          activeSources.push('openclaw')
        }
      } catch (err) {
        // 忽略错误
      }
    }

    // 3. 综合推理
    if (relations.length === 0) {
      return {
        relation: '无直接关系',
        confidence: 0.0,
        reasoning: ['三方知识图谱中均未找到明确关系'],
        sources: [],
      }
    }

    // 选择置信度最高的关系
    const maxIndex = confidences.indexOf(Math.max(...confidences))

    return {
      relation: relations[maxIndex],
      confidence: confidences[maxIndex],
      reasoning: reasonings,
      sources: activeSources,
    }
  }

  /**
   * 获取知识统计
   */
  getStats() {
    return {
      openclaw: this.openclaw.getStats(),
      yunpat: this.yunpat.getStats(),
      initialized: this.initialized,
    }
  }

  /**
   * 混合排序和去重
   */
  private rankAndDeduplicate(results: KnowledgeResult[], topK: number): KnowledgeResult[] {
    // 1. 按分数排序
    const sorted = results.sort((a, b) => b.score - a.score)

    // 2. 去重（按 ID）
    const seen = new Set<string>()
    const deduplicated: KnowledgeResult[] = []

    for (const result of sorted) {
      if (!seen.has(result.id)) {
        seen.add(result.id)
        deduplicated.push(result)

        if (deduplicated.length >= topK) {
          break
        }
      }
    }

    return deduplicated
  }
}

/**
 * 导出便捷函数
 */
export async function createUnifiedKnowledgeGraph(): Promise<UnifiedKnowledgeGraph> {
  const kg = new UnifiedKnowledgeGraph()
  await kg.initialize()
  return kg
}
