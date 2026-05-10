/**
 * PostgreSQL 客户端类型定义
 *
 * @module unified-knowledge-graph/PostgreSQLTypes
 */

export interface VectorSearchResult {
  id: number
  articleId: string
  chunkType: string
  chunkText: string
  similarity: number
  weight: number
}

export interface StructuredQueryResult {
  id: number
  title: string
  content: string
  category?: string
  metadata?: Record<string, any>
}

export interface EntityResult {
  id: number
  judgmentId: string
  entityText: string
  entityType: string
  confidence: number
  metadata: any
}

export interface InvalidEntityResult {
  id: number
  decisionId: string
  entityText: string
  entityType: string
  domain: string
  confidence: number
  metadata: Record<string, any>
}

export interface CourtResult {
  id: number
  judgmentId: string
  courtName: string
  courtLevel: string
}

export interface LawArticleResult {
  id: number
  judgmentId: string
  lawArticleId: string
  lawArticleText: string
}

export interface JudgmentPatentResult {
  id: number
  judgmentId: string
  patentNumber: string
  patentType: string
}

export interface RelationResult {
  id: number
  judgmentId: string
  subjectEntity: string
  relationType: string
  objectEntity: string
  confidence: number
}

export interface LegalDocumentResult {
  id: number
  title: string
  content: string
  category: string
  source: string
  createdAt: Date
}

export interface JudgmentCaseResult {
  judgmentId: string
  fileName: string
  title: string
  filePath: string
  caseCause: string
  plaintiff: string
  defendant: string
  entitiesCount: number
  relationsCount: number
  hasEmbeddings: boolean
  processedAt: Date
}

export interface PatentRuleResult {
  id: string
  articleId: string
  articleType: string
  hierarchyLevel: number
  fullPath: string
  articleNumber: string
  title: string
  content: string
  corePrinciple: string
  keyRequirements: Record<string, any>
  metadata: Record<string, any>
  hasVectors: boolean
  similarity?: number
}

export interface PostgreSQLClientConfig {
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  embeddingFn?: (text: string) => Promise<number[]>
}

export interface PostgreSQLStats {
  totalRecords: number
  vectorRecords: number
  entityRecords: number
  tables: Record<string, number>
}
