/**
 * PostgreSQL 客户端 - Facade
 *
 * Athena legal_world_model 数据库客户端。
 * 类型定义在 PostgreSQLTypes.ts，查询函数在 PostgreSQLQueryRunner.ts。
 */

import { Pool } from 'pg'
import type { PostgreSQLClientConfig } from './PostgreSQLTypes.js'
export type {
  VectorSearchResult,
  StructuredQueryResult,
  EntityResult,
  InvalidEntityResult,
  CourtResult,
  LawArticleResult,
  JudgmentPatentResult,
  RelationResult,
  LegalDocumentResult,
  JudgmentCaseResult,
  PatentRuleResult,
  PostgreSQLClientConfig,
  PostgreSQLStats,
} from './PostgreSQLTypes.js'
import {
  vectorSearch,
  structuredSearch,
  queryInvalidDecisions,
  entitySearch,
  searchInvalidEntities,
  searchCourts,
  searchLawArticles,
  searchJudgmentPatents,
  searchRelations,
  getLegalDocuments,
  searchJudgmentCases,
  searchPatentRules,
  getStats,
  healthCheck,
} from './PostgreSQLQueryRunner.js'

export class PostgreSQLClient {
  private pool: Pool
  private config: PostgreSQLClientConfig
  private initialized = false
  private embeddingFn?: (text: string) => Promise<number[]>

  constructor(config?: PostgreSQLClientConfig) {
    this.config = config || {}
    this.embeddingFn = config?.embeddingFn

    this.pool = new Pool({
      host: this.config.host || process.env.PG_HOST || '127.0.0.1',
      port: this.config.port || parseInt(process.env.PG_PORT || '6432'),
      database: this.config.database || process.env.PG_DATABASE || 'legal_world_model',
      user: this.config.user || process.env.PG_USER || 'xujian',
      password: this.config.password || process.env.PG_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[PostgreSQL] 初始化连接...')

    try {
      const client = await this.pool.connect()
      await client.query('SET statement_timeout = 10000')
      await client.query('SELECT version()')
      console.log('[PostgreSQL] ✅ 连接成功')
      client.release()
      this.initialized = true
    } catch (err) {
      console.error('[PostgreSQL] 初始化失败:', err)
      throw err
    }
  }

  async vectorSearch(
    queryText: string,
    topK: number = 5,
    table:
      | 'legal_articles_v2_embeddings'
      | 'judgment_embeddings'
      | 'patent_judgment_vectors'
      | 'patent_decisions_v2_embeddings' = 'legal_articles_v2_embeddings'
  ) {
    if (!this.initialized) await this.initialize()
    return vectorSearch(this.pool, this.embeddingFn, queryText, topK, table)
  }

  async structuredSearch(query: string, topK: number = 5, includeInvalidDecisions: boolean = true) {
    if (!this.initialized) await this.initialize()
    return structuredSearch(this.pool, query, topK, includeInvalidDecisions)
  }

  async queryInvalidDecisions(query: string, topK: number = 5) {
    if (!this.initialized) await this.initialize()
    return queryInvalidDecisions(this.pool, query, topK)
  }

  async entitySearch(entityText: string, entityType?: string, topK: number = 5) {
    if (!this.initialized) await this.initialize()
    return entitySearch(this.pool, entityText, entityType, topK)
  }

  async getRelatedArticles(articleId: string, topK: number = 5) {
    if (!this.initialized) await this.initialize()
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT la.id, la.title, la.content FROM legal_articles_v2 la INNER JOIN judgment_law_articles jla1 ON jla1.judgment_id = $1 INNER JOIN judgment_law_articles jla2 ON jla2.law_article_id = jla1.law_article_id INNER JOIN judgment_entities je ON je.judgment_id = jla2.judgment_id WHERE je.entity_type = 'LAW_ARTICLE' LIMIT $2`,
        [articleId, topK]
      )
      return result.rows.map((row: any) => ({ id: row.id, title: row.title, content: row.content }))
    } catch (err) {
      console.error('[PostgreSQL] 获取相关文章失败:', err)
      return []
    }
  }

  async getStats() {
    if (!this.initialized) await this.initialize()
    return getStats(this.pool)
  }

  async healthCheck() {
    return healthCheck(this.pool)
  }

  async close(): Promise<void> {
    try {
      await this.pool.end()
      this.initialized = false
      console.log('[PostgreSQL] 连接已关闭')
    } catch (err) {
      console.error('[PostgreSQL] 关闭连接失败:', err)
    }
  }

  async searchInvalidEntities(params: {
    entityText?: string
    entityType?: string
    domain?: string
    topK?: number
  }) {
    if (!this.initialized) await this.initialize()
    return searchInvalidEntities(this.pool, params)
  }

  async searchCourts(params: { courtName?: string; courtLevel?: string; topK?: number }) {
    if (!this.initialized) await this.initialize()
    return searchCourts(this.pool, params)
  }

  async searchLawArticles(params: { lawArticleId?: string; judgmentId?: string; topK?: number }) {
    if (!this.initialized) await this.initialize()
    return searchLawArticles(this.pool, params)
  }

  async searchJudgmentPatents(params: {
    patentNumber?: string
    judgmentId?: string
    topK?: number
  }) {
    if (!this.initialized) await this.initialize()
    return searchJudgmentPatents(this.pool, params)
  }

  async searchRelations(params: { judgmentId?: string; relationType?: string; topK?: number }) {
    if (!this.initialized) await this.initialize()
    return searchRelations(this.pool, params)
  }

  async getLegalDocuments(params: { category?: string; topK?: number }) {
    if (!this.initialized) await this.initialize()
    return getLegalDocuments(this.pool, params)
  }

  async searchJudgmentCases(params: {
    caseCause?: string
    plaintiff?: string
    defendant?: string
    topK?: number
  }) {
    if (!this.initialized) await this.initialize()
    return searchJudgmentCases(this.pool, params)
  }

  async searchPatentRules(params: {
    query?: string
    articleType?: string
    hierarchyLevel?: number
    topK?: number
  }) {
    if (!this.initialized) await this.initialize()
    return searchPatentRules(this.pool, this.embeddingFn, params)
  }
}
