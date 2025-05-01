/**
 * PostgreSQL-First 统一知识图谱
 *
 * 数据源：
 * - PostgreSQL legal_world_model（397万条 + 33万向量）
 * - YunPat 核心概念（100个 + 5,229双链）
 * - OpenClaw 专利知识图谱（4万节点 + 40万边）
 */

import { PostgreSQLClient } from './PostgreSQLClient.js'
import { YunPatAdapter } from './adapters/YunPatAdapter.enhanced.js'
import { OpenClawAdapter } from './adapters/OpenClawAdapter.js'

export interface KnowledgeQueryOptions {
  topK?: number
  enableVector?: boolean
  enableStructured?: boolean
  enableConcepts?: boolean
  enableOpenClaw?: boolean
}

export interface KnowledgeResult {
  source: 'postgresql_vector' | 'postgresql_structured' | 'yunpat_concept' | 'openclaw_kg'
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
  sources: string[]
}

export class PostgreSQLFirstKnowledgeGraph {
  private postgres: PostgreSQLClient
  private yunpat: YunPatAdapter
  private openclaw: OpenClawAdapter
  private initialized = false

  constructor() {
    this.postgres = new PostgreSQLClient()
    this.yunpat = new YunPatAdapter()
    this.openclaw = new OpenClawAdapter()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[KnowledgeGraph] 初始化 PostgreSQL-First 知识图谱...')

    await Promise.all([
      this.postgres.initialize(),
      this.yunpat.initialize(),
      this.openclaw.initialize().catch((err) => {
        console.warn('[KnowledgeGraph] OpenClaw 初始化失败（非致命）:', (err as Error).message)
      }),
    ])

    this.initialized = true
    console.log('[KnowledgeGraph] ✅ 初始化完成')
  }

  async query(queryText: string, options: KnowledgeQueryOptions = {}): Promise<KnowledgeResult[]> {
    if (!this.initialized) await this.initialize()

    const {
      topK = 10,
      enableVector = true,
      enableStructured = true,
      enableConcepts = true,
      enableOpenClaw = true,
    } = options

    const results: KnowledgeResult[] = []
    const queryPromises: Promise<void>[] = []

    if (enableVector) {
      queryPromises.push(
        this.postgres.vectorSearch(queryText, Math.ceil(topK / 2)).then((vectorResults) => {
          results.push(
            ...vectorResults.map((r) => ({
              source: 'postgresql_vector' as const,
              id: `vec_${r.id}`,
              type: 'vector_embedding',
              name: r.articleId,
              content: r.chunkText,
              score: r.similarity,
              metadata: { weight: r.weight, chunkType: r.chunkType },
            }))
          )
        })
      )
    }

    if (enableStructured) {
      queryPromises.push(
        this.postgres.structuredSearch(queryText, Math.ceil(topK / 2)).then((structuredResults) => {
          results.push(
            ...structuredResults.map((r) => ({
              source: 'postgresql_structured' as const,
              id: `struct_${r.id}`,
              type: r.category || 'structured_data',
              name: r.title,
              content: r.content,
              score: 0.7,
              metadata: { category: r.category },
            }))
          )
        })
      )
    }

    if (enableConcepts) {
      queryPromises.push(this.queryYunPatConcepts(results, queryText))
    }

    if (enableOpenClaw) {
      queryPromises.push(this.queryOpenClawKG(results, queryText, topK))
    }

    await Promise.all(queryPromises)

    return this.rankResults(results, topK)
  }

  async inferRelation(concept1: string, concept2: string): Promise<RelationInference> {
    if (!this.initialized) await this.initialize()

    const hierarchyRelation = await this.yunpat.inferHierarchy(concept1, concept2)
    if (!hierarchyRelation.includes('无直接关系')) {
      return {
        relation: hierarchyRelation,
        confidence: 0.9,
        reasoning: ['YunPat 概念层次结构'],
        sources: ['yunpat'],
      }
    }

    // 尝试 OpenClaw 图路径查找
    const openclawPath = await this.openclaw.findPath(concept1, concept2, 4)
    if (openclawPath.length > 0) {
      return {
        relation: `图路径: ${openclawPath.join(' → ')}`,
        confidence: 0.75,
        reasoning: [`OpenClaw 知识图谱路径查找`, `路径长度: ${openclawPath.length}`],
        sources: ['openclaw'],
      }
    }

    return {
      relation: '无直接关系',
      confidence: 0.0,
      reasoning: ['所有知识源中均未找到明确关系'],
      sources: [],
    }
  }

  async getStats() {
    const openclawStats = await this.openclaw.getStats().catch(() => null)
    return {
      postgres: this.postgres.getStats(),
      yunpat: this.yunpat.getStats(),
      openclaw: openclawStats,
      initialized: this.initialized,
    }
  }

  private rankResults(results: KnowledgeResult[], topK: number): KnowledgeResult[] {
    const weighted = results.map((r) => {
      let weight = 1.0
      if (r.source === 'postgresql_vector') weight = 1.2
      else if (r.source === 'openclaw_kg') weight = 1.1
      else if (r.source === 'postgresql_structured') weight = 1.0
      else if (r.source === 'yunpat_concept') weight = 0.9
      return { ...r, finalScore: r.score * weight }
    })

    const sorted = weighted.sort((a, b) => b.finalScore - a.finalScore)

    const deduplicated: KnowledgeResult[] = []
    const seenContents = new Set<string>()

    for (const result of sorted) {
      const contentKey = result.content.substring(0, 50)
      if (!seenContents.has(contentKey)) {
        seenContents.add(contentKey)
        deduplicated.push(result)
        if (deduplicated.length >= topK) break
      }
    }

    return deduplicated
  }

  private async queryYunPatConcepts(results: KnowledgeResult[], queryText: string): Promise<void> {
    try {
      const conceptResults = await this.yunpat.conceptSearch(queryText, 3)
      for (const { concept, score } of conceptResults) {
        const definition = await this.yunpat.getConceptDefinition(concept.name)
        results.push({
          source: 'yunpat_concept',
          id: `concept_${concept.name}`,
          type: 'core_concept',
          name: concept.name,
          content: definition || concept.name,
          score: score * 0.9,
          metadata: { level: concept.level, parent: concept.parent, children: concept.children },
        })
      }
    } catch {
      // YunPat 概念检索非致命
    }
  }

  private async queryOpenClawKG(
    results: KnowledgeResult[],
    queryText: string,
    topK: number
  ): Promise<void> {
    try {
      const openclawResults = await this.openclaw.semanticSearch(queryText, Math.ceil(topK / 2))
      for (const { node, score } of openclawResults) {
        results.push({
          source: 'openclaw_kg',
          id: `oc_${node.id}`,
          type: node.nodeType,
          name: node.name,
          content: node.content,
          score,
          metadata: { title: node.title, nodeType: node.nodeType },
        })
      }
    } catch {
      // OpenClaw 检索非致命
    }
  }
}

export async function createKnowledgeGraph(): Promise<PostgreSQLFirstKnowledgeGraph> {
  const kg = new PostgreSQLFirstKnowledgeGraph()
  await kg.initialize()
  return kg
}
