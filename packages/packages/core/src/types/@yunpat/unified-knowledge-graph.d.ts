/**
 * 动态模块声明
 *
 * 用于 KnowledgeEnhancedAgent 的动态导入
 */

declare module '@yunpat/unified-knowledge-graph' {
  export interface KnowledgeResult {
    source: string
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

  export interface KnowledgeGraphInterface {
    query(queryText: string, options?: { topK?: number }): Promise<KnowledgeResult[]>
    inferRelation(concept1: string, concept2: string): Promise<RelationInference>
  }

  export function createKnowledgeGraph(): Promise<KnowledgeGraphInterface>
}
