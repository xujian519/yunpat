/**
 * PatentDB 数据源
 * PatentDB (PostgreSQL) - 7500万中国专利
 */

import { Pool, PoolClient, QueryResult } from 'pg'
import type {
  PatentDataSource,
  PatentRecord,
  PatentQuery,
  PatentDBConfig,
  PatentStatistics,
} from '../types.js'

/**
 * PatentDB 数据源实现
 */
export class PatentDBDataSource implements PatentDataSource {
  name = 'patent_db'
  type = 'local' as const
  private pool: Pool

  constructor(config: PatentDBConfig) {
    // 创建 PostgreSQL 连接池
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.poolSize || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    console.log(
      `[PatentDBDataSource] 初始化连接池: ${config.host}:${config.port}/${config.database}`
    )
  }

  /**
   * 查询专利
   */
  async query(query: PatentQuery): Promise<PatentRecord[]> {
    // 优先使用精确查询
    if (query.publicationNumber) {
      const result = await this.getByPublicationNumber(query.publicationNumber)
      return result ? [result] : []
    }

    // 申请人查询
    if (query.applicant) {
      return await this.getByApplicant(query.applicant, query)
    }

    // 关键词全文检索
    if (query.keywords && query.keywords.length > 0) {
      return await this.fullTextSearch(query.keywords.join(' '), query)
    }

    // 分类号查询
    if (query.classification) {
      return await this.getByClassification(query.classification, query)
    }

    return []
  }

  /**
   * 根据公开号查询专利
   */
  async getByPublicationNumber(number: string): Promise<PatentRecord | null> {
    const sql = `
      SELECT
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        priority_date,
        applicant,
        inventor,
        assignee,
        classification,
        legal_status,
        claims,
        description,
        full_text,
        family_id,
        family_members,
        citations,
        source,
        url,
        relevance_score
      FROM patents
      WHERE patent_id = $1
      LIMIT 1
    `

    try {
      const result: QueryResult = await this.pool.query(sql, [number])

      if (result.rows.length === 0) {
        return null
      }

      return this.transform(result.rows[0])
    } catch (error) {
      console.error('[PatentDBDataSource] 查询失败:', error)
      throw error
    }
  }

  /**
   * 全文检索（使用 GIN 索引）
   */
  async fullTextSearch(searchQuery: string, options: PatentQuery = {}): Promise<PatentRecord[]> {
    const limit = options.limit || 20
    const offset = options.offset || 0

    // 使用 PostgreSQL 全文检索
    const sql = `
      SELECT
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        applicant,
        inventor,
        classification,
        claims,
        description,
        family_id,
        source,
        url,
        ts_rank(
          setweight(to_tsvector('chinese', coalesce(title, '')), 'A') +
          setweight(to_tsvector('chinese', coalesce(abstract, '')), 'B') +
          setweight(to_tsvector('chinese', coalesce(description, '')), 'C') +
          setweight(to_tsvector('chinese', coalesce(claims, '')), 'D'),
          plainto_tsquery('chinese', $1)
        ) +
        ts_rank(
          setweight(to_tsvector('chinese', coalesce(title, '')), 'A') +
          setweight(to_tsvector('chinese', coalesce(abstract, '')), 'B') +
          setweight(to_tsvector('chinese', coalesce(description, '')), 'C') +
          setweight(to_tsvector('chinese', coalesce(claims, '')), 'D'),
          plainto_tsquery('chinese', $1)
        ) as relevance_score
      FROM patents
      WHERE
        to_tsvector('chinese', coalesce(title, '')) @@ plainto_tsquery('chinese', $1) OR
        to_tsvector('chinese', coalesce(abstract, '')) @@ plainto_tsquery('chinese', $1) OR
        to_tsvector('chinese', coalesce(description, '')) @@ plainto_tsquery('chinese', $1) OR
        to_tsvector('chinese', coalesce(claims, '')) @@ plainto_tsquery('chinese', $1)
      ORDER BY relevance_score DESC, publication_date DESC
      LIMIT $2 OFFSET $3
    `

    try {
      const result: QueryResult = await this.pool.query(sql, [searchQuery, limit, offset])

      console.log(
        `[PatentDBDataSource] 全文检索 "${searchQuery}" 找到 ${result.rows.length} 条结果`
      )

      return result.rows.map((row) => this.transform(row))
    } catch (error) {
      console.error('[PatentDBDataSource] 全文检索失败:', error)
      throw error
    }
  }

  /**
   * 根据申请人查询
   */
  async getByApplicant(applicant: string, options: PatentQuery = {}): Promise<PatentRecord[]> {
    const limit = options.limit || 20
    const offset = options.offset || 0

    let sql = `
      SELECT
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        applicant,
        inventor,
        classification,
        legal_status,
        family_id,
        source,
        url,
        relevance_score
      FROM patents
      WHERE applicant ILIKE $1
    `

    const params: any[] = [`%${applicant}%`]
    let paramCount = 1

    // 日期范围过滤
    if (options.startDate) {
      paramCount++
      sql += ` AND filing_date >= $${paramCount}`
      params.push(options.startDate)
    }

    if (options.endDate) {
      paramCount++
      sql += ` AND filing_date <= $${paramCount}`
      params.push(options.endDate)
    }

    sql += `
      ORDER BY filing_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    params.push(limit, offset)

    try {
      const result: QueryResult = await this.pool.query(sql, params)

      console.log(
        `[PatentDBDataSource] 申请人查询 "${applicant}" 找到 ${result.rows.length} 条结果`
      )

      return result.rows.map((row) => this.transform(row))
    } catch (error) {
      console.error('[PatentDBDataSource] 申请人查询失败:', error)
      throw error
    }
  }

  /**
   * 根据分类号查询
   */
  async getByClassification(
    classification: string,
    options: PatentQuery = {}
  ): Promise<PatentRecord[]> {
    const limit = options.limit || 20
    const offset = options.offset || 0

    const sql = `
      SELECT
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        applicant,
        inventor,
        classification,
        legal_status,
        family_id,
        source,
        url
      FROM patents
      WHERE classification ILIKE $1
      ORDER BY filing_date DESC
      LIMIT $2 OFFSET $3
    `

    try {
      const result: QueryResult = await this.pool.query(sql, [`%${classification}%`, limit, offset])

      console.log(
        `[PatentDBDataSource] 分类号查询 "${classification}" 找到 ${result.rows.length} 条结果`
      )

      return result.rows.map((row) => this.transform(row))
    } catch (error) {
      console.error('[PatentDBDataSource] 分类号查询失败:', error)
      throw error
    }
  }

  /**
   * 获取统计数据
   */
  async getStatistics(): Promise<PatentStatistics> {
    const sql = `
      SELECT
        COUNT(*) as total,
        legal_status,
        COUNT(*) as count
      FROM patents
      GROUP BY legal_status
    `

    try {
      const result: QueryResult = await this.pool.query(sql)

      const stats: PatentStatistics = {
        total: 0,
        byStatus: {},
        byClassification: {},
        byApplicant: {},
        byDate: {},
      }

      let totalCount = 0
      for (const row of result.rows) {
        stats.byStatus[row.legal_status || 'unknown'] = parseInt(row.count)
        totalCount += parseInt(row.count)
      }
      stats.total = totalCount

      return stats
    } catch (error) {
      console.error('[PatentDBDataSource] 统计查询失败:', error)
      throw error
    }
  }

  /**
   * 转换数据库行到标准格式
   */
  private transform(row: any): PatentRecord {
    const patent: PatentRecord = {
      publicationNumber: row.patent_id,
      title: row.title || '',
      abstract: row.abstract,
      applicant: row.applicant,
      publicationDate: row.publication_date,
      applicationDate: row.filing_date,
      priorityDate: row.priority_date,
      assignee: row.assignee,
      ipcCodes: row.classification ? [row.classification] : [],
      cpcCodes: row.classification ? [row.classification] : [],
      status: row.legal_status || 'unknown',
      claims: row.claims,
      description: row.description,
      fullText: row.full_text,
      familyId: row.family_id,
      source: row.source || 'patent_db',
      url: row.url,
      relevanceScore: row.relevance_score || 0,
    }

    // 解析发明人
    if (row.inventor) {
      patent.inventors = row.inventor
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
    }

    // 解析同族成员
    if (row.family_members) {
      try {
        patent.familyMembers = JSON.parse(row.family_members)
      } catch (error) {
        console.warn('[PatentDBDataSource] 解析 family_members 失败:', error)
      }
    }

    // 解析引用
    if (row.citations) {
      try {
        patent.citations = JSON.parse(row.citations)
      } catch (error) {
        console.warn('[PatentDBDataSource] 解析 citations 失败:', error)
      }
    }

    return patent
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1')
      const isHealthy = result.rows.length > 0

      if (isHealthy) {
        console.log('[PatentDBDataSource] 健康检查: ✓ 正常')
      } else {
        console.warn('[PatentDBDataSource] 健康检查: ✗ 异常')
      }

      return isHealthy
    } catch (error) {
      console.error('[PatentDBDataSource] 健康检查失败:', error)
      return false
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end()
    console.log('[PatentDBDataSource] 连接池已关闭')
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    }
  }
}
