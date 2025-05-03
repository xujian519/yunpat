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
 * 无效实体查询结果
 */
export interface InvalidEntityResult {
  id: number
  decisionId: string
  entityText: string
  entityType: string
  domain: string
  confidence: number
  metadata: Record<string, any>
}

/**
 * 法院查询结果
 */
export interface CourtResult {
  id: number
  judgmentId: string
  courtName: string
  courtLevel: string
}

/**
 * 法条查询结果
 */
export interface LawArticleResult {
  id: number
  judgmentId: string
  lawArticleId: string
  lawArticleText: string
}

/**
 * 判决专利号查询结果
 */
export interface JudgmentPatentResult {
  id: number
  judgmentId: string
  patentNumber: string
  patentType: string
}

/**
 * 关系查询结果
 */
export interface RelationResult {
  id: number
  judgmentId: string
  subjectEntity: string
  relationType: string
  objectEntity: string
  confidence: number
}

/**
 * 法律文档查询结果
 */
export interface LegalDocumentResult {
  id: number
  title: string
  content: string
  category: string
  source: string
  createdAt: Date
}

/**
 * 判决案例查询结果
 */
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

/**
 * 专利规则查询结果
 */
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
  similarity?: number // 向量搜索时返回
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
  /** Optional embedding function for vector search */
  embeddingFn?: (text: string) => Promise<number[]>
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
  private embeddingFn?: (text: string) => Promise<number[]>

  constructor(config?: PostgreSQLClientConfig) {
    this.config = config || {}
    this.embeddingFn = config?.embeddingFn

    // 连接 legal_world_model 数据库
    this.pool = new Pool({
      host: this.config.host || process.env.PG_HOST || '127.0.0.1',
      port: this.config.port || parseInt(process.env.PG_PORT || '6432'),
      database: this.config.database || process.env.PG_DATABASE || 'legal_world_model',
      user: this.config.user || process.env.PG_USER || 'xujian',
      password: this.config.password || process.env.PG_PASSWORD || '',
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

      // 如果提供了 embeddingFn，使用真实的向量搜索
      if (this.embeddingFn) {
        try {
          const embedding = await this.embeddingFn(queryText)
          const embeddingArray = `[${embedding.join(',')}]`

          const result = await this.pool.query(
            `
            SELECT
              id,
              article_id as "articleId",
              chunk_type as "chunkType",
              chunk_text as "chunkText",
              weight,
              1 - (embedding <=> $1::real[]) as similarity
            FROM ${table}
            ORDER BY embedding <=> $1::real[]
            LIMIT $2
            `,
            [embeddingArray, topK]
          )

          return result.rows
        } catch (embeddingErr) {
          console.warn('[PostgreSQL] 向量嵌入生成失败，回退到文本搜索:', embeddingErr)
        }
      }

      // 否则使用文本匹配（回退方案）
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

  /**
   * 搜索无效实体（最大表，2,363,891 行）
   */
  async searchInvalidEntities(params: {
    entityText?: string
    entityType?: string
    domain?: string
    topK?: number
  }): Promise<InvalidEntityResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { entityText, entityType, domain, topK = 10 } = params

    try {
      let sql = `
        SELECT
          id,
          decision_id as "decisionId",
          entity_text as "entityText",
          entity_type as "entityType",
          domain,
          confidence,
          metadata
        FROM patent_invalid_entities
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (entityText) {
        sql += ` AND entity_text LIKE $${paramIndex}`
        queryParams.push(`%${entityText}%`)
        paramIndex++
      }

      if (entityType) {
        sql += ` AND entity_type = $${paramIndex}`
        queryParams.push(entityType)
        paramIndex++
      }

      if (domain) {
        sql += ` AND domain = $${paramIndex}`
        queryParams.push(domain)
        paramIndex++
      }

      sql += ` ORDER BY confidence DESC LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 无效实体搜索失败:', err)
      return []
    }
  }

  /**
   * 搜索法院（12,497 行）
   */
  async searchCourts(params: {
    courtName?: string
    courtLevel?: string
    topK?: number
  }): Promise<CourtResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { courtName, courtLevel, topK = 10 } = params

    try {
      let sql = `
        SELECT
          id,
          judgment_id as "judgmentId",
          court_name as "courtName",
          court_level as "courtLevel"
        FROM judgment_courts
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (courtName) {
        sql += ` AND court_name LIKE $${paramIndex}`
        queryParams.push(`%${courtName}%`)
        paramIndex++
      }

      if (courtLevel) {
        sql += ` AND court_level = $${paramIndex}`
        queryParams.push(courtLevel)
        paramIndex++
      }

      sql += ` ORDER BY id LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 法院搜索失败:', err)
      return []
    }
  }

  /**
   * 搜索法条（20,306 行）
   */
  async searchLawArticles(params: {
    lawArticleId?: string
    judgmentId?: string
    topK?: number
  }): Promise<LawArticleResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { lawArticleId, judgmentId, topK = 10 } = params

    try {
      let sql = `
        SELECT
          id,
          judgment_id as "judgmentId",
          law_article_id as "lawArticleId",
          law_article_text as "lawArticleText"
        FROM judgment_law_articles
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (lawArticleId) {
        sql += ` AND law_article_id = $${paramIndex}`
        queryParams.push(lawArticleId)
        paramIndex++
      }

      if (judgmentId) {
        sql += ` AND judgment_id = $${paramIndex}`
        queryParams.push(judgmentId)
        paramIndex++
      }

      sql += ` ORDER BY id LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 法条搜索失败:', err)
      return []
    }
  }

  /**
   * 搜索判决专利号（4,243 行）
   */
  async searchJudgmentPatents(params: {
    patentNumber?: string
    judgmentId?: string
    topK?: number
  }): Promise<JudgmentPatentResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { patentNumber, judgmentId, topK = 10 } = params

    try {
      let sql = `
        SELECT
          id,
          judgment_id as "judgmentId",
          patent_number as "patentNumber",
          patent_type as "patentType"
        FROM judgment_patent_numbers
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (patentNumber) {
        sql += ` AND patent_number LIKE $${paramIndex}`
        queryParams.push(`%${patentNumber}%`)
        paramIndex++
      }

      if (judgmentId) {
        sql += ` AND judgment_id = $${paramIndex}`
        queryParams.push(judgmentId)
        paramIndex++
      }

      sql += ` ORDER BY id LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 判决专利号搜索失败:', err)
      return []
    }
  }

  /**
   * 搜索关系（45,770 行）
   */
  async searchRelations(params: {
    judgmentId?: string
    relationType?: string
    topK?: number
  }): Promise<RelationResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { judgmentId, relationType, topK = 10 } = params

    try {
      let sql = `
        SELECT
          id,
          judgment_id as "judgmentId",
          subject_entity as "subjectEntity",
          relation_type as "relationType",
          object_entity as "objectEntity",
          confidence
        FROM judgment_relations
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (judgmentId) {
        sql += ` AND judgment_id = $${paramIndex}`
        queryParams.push(judgmentId)
        paramIndex++
      }

      if (relationType) {
        sql += ` AND relation_type = $${paramIndex}`
        queryParams.push(relationType)
        paramIndex++
      }

      sql += ` ORDER BY confidence DESC LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 关系搜索失败:', err)
      return []
    }
  }

  /**
   * 获取法律文档（25 行）
   */
  async getLegalDocuments(params: {
    category?: string
    topK?: number
  }): Promise<LegalDocumentResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { category, topK = 10 } = params

    try {
      let sql = `
        SELECT
          id,
          title,
          content,
          category,
          source,
          created_at as "createdAt"
        FROM legal_documents
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (category) {
        sql += ` AND category = $${paramIndex}`
        queryParams.push(category)
        paramIndex++
      }

      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 法律文档查询失败:', err)
      return []
    }
  }

  /**
   * 搜索判决案例（5,906 行）
   */
  async searchJudgmentCases(params: {
    caseCause?: string
    plaintiff?: string
    defendant?: string
    topK?: number
  }): Promise<JudgmentCaseResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { caseCause, plaintiff, defendant, topK = 10 } = params

    try {
      let sql = `
        SELECT
          judgment_id as "judgmentId",
          file_name as "fileName",
          title,
          file_path as "filePath",
          case_cause as "caseCause",
          plaintiff,
          defendant,
          entities_count as "entitiesCount",
          relations_count as "relationsCount",
          has_embeddings as "hasEmbeddings",
          processed_at as "processedAt"
        FROM patent_judgments
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (caseCause) {
        sql += ` AND case_cause LIKE $${paramIndex}`
        queryParams.push(`%${caseCause}%`)
        paramIndex++
      }

      if (plaintiff) {
        sql += ` AND plaintiff LIKE $${paramIndex}`
        queryParams.push(`%${plaintiff}%`)
        paramIndex++
      }

      if (defendant) {
        sql += ` AND defendant LIKE $${paramIndex}`
        queryParams.push(`%${defendant}%`)
        paramIndex++
      }

      sql += ` ORDER BY processed_at DESC LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 判决案例搜索失败:', err)
      return []
    }
  }

  /**
   * 搜索专利规则（1,371 行，支持向量搜索）
   */
  async searchPatentRules(params: {
    query?: string
    articleType?: string
    hierarchyLevel?: number
    topK?: number
  }): Promise<PatentRuleResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const { query, articleType, hierarchyLevel, topK = 10 } = params

    try {
      // 如果提供了 embeddingFn 和 query，使用向量搜索
      if (this.embeddingFn && query) {
        const embedding = await this.embeddingFn(query)
        const embeddingArray = `[${embedding.join(',')}]`

        let sql = `
          SELECT
            id::text,
            article_id as "articleId",
            article_type as "articleType",
            hierarchy_level as "hierarchyLevel",
            full_path as "fullPath",
            article_number as "articleNumber",
            title,
            content,
            core_principle as "corePrinciple",
            key_requirements as "keyRequirements",
            metadata,
            has_vectors as "hasVectors",
            1 - (embedding <=> $1::real[]) as similarity
          FROM patent_rules_unified
          WHERE has_vectors = true
        `
        const queryParams: any[] = [embeddingArray]
        let paramIndex = 2

        if (articleType) {
          sql += ` AND article_type = $${paramIndex}`
          queryParams.push(articleType)
          paramIndex++
        }

        if (hierarchyLevel !== undefined) {
          sql += ` AND hierarchy_level = $${paramIndex}`
          queryParams.push(hierarchyLevel)
          paramIndex++
        }

        sql += ` ORDER BY embedding <=> $1::real[] LIMIT $${paramIndex}`
        queryParams.push(topK)

        const result = await this.pool.query(sql, queryParams)
        return result.rows
      }

      // 否则使用文本搜索
      let sql = `
        SELECT
          id::text,
          article_id as "articleId",
          article_type as "articleType",
          hierarchy_level as "hierarchyLevel",
          full_path as "fullPath",
          article_number as "articleNumber",
          title,
          content,
          core_principle as "corePrinciple",
          key_requirements as "keyRequirements",
          metadata,
          has_vectors as "hasVectors"
        FROM patent_rules_unified
        WHERE 1=1
      `
      const queryParams: any[] = []
      let paramIndex = 1

      if (query) {
        sql += ` AND (title LIKE $${paramIndex} OR content LIKE $${paramIndex})`
        queryParams.push(`%${query}%`)
        paramIndex++
      }

      if (articleType) {
        sql += ` AND article_type = $${paramIndex}`
        queryParams.push(articleType)
        paramIndex++
      }

      if (hierarchyLevel !== undefined) {
        sql += ` AND hierarchy_level = $${paramIndex}`
        queryParams.push(hierarchyLevel)
        paramIndex++
      }

      sql += ` ORDER BY hierarchy_level, article_number LIMIT $${paramIndex}`
      queryParams.push(topK)

      const result = await this.pool.query(sql, queryParams)
      return result.rows
    } catch (err) {
      console.error('[PostgreSQL] 专利规则搜索失败:', err)
      return []
    }
  }
}
