/**
 * PostgreSQL 客户端 - 法律世界模型
 *
 * Athena legal_world_model 数据库的客户端
 * 支持：向量检索 + 结构化查询
 */

import { Pool, PoolClient } from 'pg'

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  id: number
  articleId: string
  chunkType: string
  chunkText: string
  similarity: number
  weight: number
}

/**
 * 结构化查询结果
 */
export interface StructuredQueryResult {
  id: number
  title: string
  content: string
  category?: string
  metadata?: Record<string, any>
}

/**
 * 实体查询结果
 */
export interface EntityResult {
  id: number
  judgmentId: string
  entityText: string
  entityType: string
  confidence: number
  metadata: any
}

/**
 * PostgreSQL 客户端配置
 */
export interface PostgreSQLClientConfig {
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
}

/**
 * 统计信息
 */
export interface PostgreSQLStats {
  totalRecords: number
  vectorRecords: number
  entityRecords: number
  tables: Record<string, number>
}

/**
 * PostgreSQL 客户端类
 */
export class PostgreSQLClient {
  private pool: Pool
  private config: PostgreSQLClientConfig
  private initialized = false

  constructor(config?: PostgreSQLClientConfig) {
    this.config = config || {}

    // 连接 legal_world_model 数据库
    this.pool = new Pool({
      host: this.config.host || process.env.PG_HOST || 'localhost',
      port: this.config.port || parseInt(process.env.PG_PORT || '5432'),
      database: this.config.database || process.env.PG_DATABASE || 'legal_world_model',
      user: this.config.user || process.env.PG_USER || 'postgres',
      password: this.config.password || process.env.PG_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
    })
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[PostgreSQL] 初始化连接...')

    try {
      const client = await this.pool.connect()
      const result = await client.query('SELECT version()')
      console.log('[PostgreSQL] ✅ 连接成功')
      client.release()

      this.initialized = true
    } catch (err) {
      console.error('[PostgreSQL] 初始化失败:', err)
      throw err
    }
  }

  /**
   * 向量相似度搜索（主要功能）
   *
   * @param queryText - 查询文本（需要先转换为向量）
   * @param topK - 返回结果数量
   * @param table - 向量表名称（默认 legal_articles_v2_embeddings）
   */
  async vectorSearch(
    queryText: string,
    topK: number = 5,
    table:
      | 'legal_articles_v2_embeddings'
      | 'judgment_embeddings'
      | 'patent_judgment_vectors'
      | 'patent_decisions_v2_embeddings' = 'legal_articles_v2_embeddings'
  ): Promise<VectorSearchResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // 检查表是否存在
      const tableExists = await this.pool.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        )
        `,
        [table]
      )

      if (!tableExists.rows[0].exists) {
        console.warn(`[PostgreSQL] 表 ${table} 不存在，跳过向量搜索`)
        return []
      }

      // 检查表是否有数据
      const countResult = await this.pool.query(`SELECT COUNT(*) FROM ${table}`)
      const count = parseInt(countResult.rows[0].count)

      if (count === 0) {
        console.warn(`[PostgreSQL] 表 ${table} 为空，跳过向量搜索`)
        return []
      }

      // 注意：这里简化处理，实际应该先将 queryText 转换为向量
      // 暂时使用文本匹配作为替代
      // 使用 plainto_tsquery 而不是 to_tsquery，因为它能更好地处理中文
      const result = await this.pool.query(
        `
        SELECT
          id,
          article_id as "articleId",
          chunk_type as "chunkType",
          chunk_text as "chunkText",
          weight,
          ts_rank_cd(to_tsvector('chinese', chunk_text), query) as similarity
        FROM ${table},
             plainto_tsquery('chinese', $1) query
        WHERE to_tsvector('chinese', chunk_text) @@ query
        ORDER BY similarity DESC
        LIMIT $2
        `,
        [queryText, topK]
      )

      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 向量搜索失败:', err)
      return []
    }
  }

  /**
   * 结构化查询（补充功能）
   *
   * @param query - 查询关键词
   * @param topK - 返回结果数量
   * @param includeInvalidDecisions - 是否包含无效决定（默认 true）
   */
  async structuredSearch(
    query: string,
    topK: number = 5,
    includeInvalidDecisions: boolean = true
  ): Promise<StructuredQueryResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const results: StructuredQueryResult[] = []
      const limitPerTable = Math.ceil(topK / 4)

      // 1. 查询法律文章
      const articlesResult = await this.pool.query(
        `
        SELECT
          article_id as id,
          article_title as title,
          content_text as content,
          'legal_article' as category
        FROM legal_articles_v2
        WHERE article_title LIKE $1 OR content_text LIKE $1
        ORDER BY article_id
        LIMIT $2
        `,
        [`%${query}%`, limitPerTable]
      )

      results.push(
        ...articlesResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          category: row.category,
        }))
      )

      // 2. 查询专利规则
      const rulesResult = await this.pool.query(
        `
        SELECT
          id,
          title,
          content,
          'patent_rule' as category
        FROM patent_rules_unified
        WHERE title LIKE $1 OR content LIKE $1
        ORDER BY id
        LIMIT $2
        `,
        [`%${query}%`, limitPerTable]
      )

      results.push(
        ...rulesResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          category: row.category,
        }))
      )

      // 3. 查询无效决定（如果启用）
      if (includeInvalidDecisions) {
        const invalidResult = await this.queryInvalidDecisions(query, limitPerTable)
        results.push(...invalidResult)
      }

      // 4. 查询专利判决
      const judgmentsResult = await this.pool.query(
        `
        SELECT
          judgment_id as id,
          title,
          content_text as content,
          'patent_judgment' as category
        FROM patent_judgments
        WHERE title LIKE $1 OR content_text LIKE $1
        LIMIT $2
        `,
        [`%${query}%`, limitPerTable]
      )

      results.push(
        ...judgmentsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          category: row.category,
        }))
      )

      return results.slice(0, topK)
    } catch (err) {
      console.error('[PostgreSQL] 结构化查询失败:', err)
      return []
    }
  }

  /**
   * 查询专利无效决定
   *
   * @param query - 查询关键词
   * @param topK - 返回结果数量
   */
  async queryInvalidDecisions(query: string, topK: number = 5): Promise<StructuredQueryResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const result = await this.pool.query(
        `
        SELECT
          id,
          document_number as title,
          content,
          'invalid_decision' as category,
          domain,
          metadata
        FROM patent_decisions_v2
        WHERE document_number LIKE $1
           OR title LIKE $1
           OR content LIKE $1
        ORDER BY id
        LIMIT $2
        `,
        [`%${query}%`, topK]
      )

      return result.rows.map((row) => ({
        id: row.id,
        title: `无效决定 ${row.title}`,
        content: row.content,
        category: row.category,
        metadata: {
          domain: row.domain,
          documentNumber: row.title,
          ...row.metadata,
        },
      }))
    } catch (err) {
      console.error('[PostgreSQL] 无效决定查询失败:', err)
      return []
    }
  }

  /**
   * 实体查询（判决实体）
   *
   * @param entityText - 实体文本
   * @param entityType - 实体类型（PATENT_NUMBER, PERSON, COURT 等）
   * @param topK - 返回结果数量
   */
  async entitySearch(
    entityText: string,
    entityType?: string,
    topK: number = 5
  ): Promise<EntityResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      let sql = `
        SELECT
          id,
          judgment_id as "judgmentId",
          entity_text as "entityText",
          entity_type as "entityType",
          confidence,
          metadata
        FROM judgment_entities
        WHERE entity_text LIKE $1
      `
      const params: any[] = [`%${entityText}%`]
      let paramIndex = 2

      if (entityType) {
        sql += ` AND entity_type = $${paramIndex}`
        params.push(entityType)
        paramIndex++
      }

      sql += ` ORDER BY confidence DESC LIMIT $${paramIndex}`
      params.push(topK)

      const result = await this.pool.query(sql, params)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 实体查询失败:', err)
      return []
    }
  }

  /**
   * 获取相关文章（基于实体关系）
   *
   * @param articleId - 文章 ID
   * @param topK - 返回结果数量
   */
  async getRelatedArticles(articleId: string, topK: number = 5): Promise<StructuredQueryResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // 查找引用相同法条的文章
      const result = await this.pool.query(
        `
        SELECT DISTINCT
          la.id,
          la.title,
          la.content
        FROM legal_articles_v2 la
        INNER JOIN judgment_law_articles jla1 ON jla1.judgment_id = $1
        INNER JOIN judgment_law_articles jla2 ON jla2.law_article_id = jla1.law_article_id
        INNER JOIN judgment_entities je ON je.judgment_id = jla2.judgment_id
        WHERE je.entity_type = 'LAW_ARTICLE'
        LIMIT $2
        `,
        [articleId, topK]
      )

      return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
      }))
    } catch (err) {
      console.error('[PostgreSQL] 获取相关文章失败:', err)
      return []
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<PostgreSQLStats> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const tablesResult = await this.pool.query(`
        SELECT
          tablename,
          (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_name = pg_tables.tablename) as column_count
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `)

      const tables: Record<string, number> = {}
      for (const row of tablesResult.rows) {
        const countResult = await this.pool.query(`SELECT COUNT(*) FROM ${row.tablename}`)
        tables[row.tablename] = parseInt(countResult.rows[0].count)
      }

      return {
        totalRecords: Object.values(tables).reduce((sum, count) => sum + count, 0),
        vectorRecords: tables['legal_articles_v2_embeddings'] || 0,
        entityRecords: tables['judgment_entities'] || 0,
        tables,
      }
    } catch (err) {
      console.error('[PostgreSQL] 获取统计信息失败:', err)
      return {
        totalRecords: 0,
        vectorRecords: 0,
        entityRecords: 0,
        tables: {},
      }
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (err) {
      console.error('[PostgreSQL] 健康检查失败:', err)
      return false
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    try {
      await this.pool.end()
      this.initialized = false
      console.log('[PostgreSQL] 连接已关闭')
    } catch (err) {
      console.error('[PostgreSQL] 关闭连接失败:', err)
    }
  }
}
