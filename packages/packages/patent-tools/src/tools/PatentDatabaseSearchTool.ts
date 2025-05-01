/**
 * 专利数据库检索工具
 * Patent Database Search Tool - 支持本地数据库和在线 API 的双数据源
 */

import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'
import { PatentDatabaseAdapter, type PatentQuery, type PatentRecord } from '@yunpat/patent-database'

/**
 * 专利检索模式
 */
export enum PatentDatabaseSearchMode {
  KEYWORD = 'keyword', // 关键词检索
  APPLICANT = 'applicant', // 申请人检索
  CLASSIFICATION = 'classification', // 分类号检索
  NUMBER = 'number', // 申请号/公开号检索
}

/**
 * 标准专利记录（兼容 PatentSearchTool）
 */
export interface StandardPatentRecord {
  /** 专利ID */
  id: string
  /** 专利名称 */
  patentName: string
  /** 申请号 */
  applicationNumber?: string
  /** 公开号 */
  publicationNumber: string
  /** 申请人 */
  applicant?: string
  /** 发明人 */
  inventor?: string
  /** IPC分类号 */
  ipcCode?: string
  /** 摘要 */
  abstract?: string
  /** 权利要求 */
  claims?: string
  /** 公开日期 */
  publicationDate?: string
  /** 申请日期 */
  filingDate?: string
  /** URL */
  url?: string
}

/**
 * 专利数据库检索结果
 */
export interface PatentDatabaseSearchResult {
  /** 匹配的专利列表 */
  patents: StandardPatentRecord[]
  /** 总数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 检索耗时（毫秒） */
  elapsedMs: number
  /** 数据来源 */
  dataSource: 'patent_db' | 'google_patents' | 'mixed'
}

/**
 * 专利数据库检索工具配置
 */
export interface PatentDatabaseSearchConfig {
  /** PatentDB 配置 */
  patent_db?: {
    host: string
    port: number
    database: string
    user: string
    password: string
    poolSize?: number
  }
  /** Google Patents 配置 */
  google_patents?: {
    enabled?: boolean
    rateLimit?: number
    timeout?: number
  }
}

/**
 * 专利数据库检索工具
 *
 * 支持双数据源（PatentDB + Google Patents）的综合专利检索工具
 */
export class PatentDatabaseSearchTool extends EnhancedBaseTool<
  {
    query: string
    mode?: PatentDatabaseSearchMode
    page?: number
    limit?: number
    language?: 'zh' | 'en'
    startDate?: string
    endDate?: string
  },
  PatentDatabaseSearchResult
> {
  private adapter: PatentDatabaseAdapter
  private config: PatentDatabaseSearchConfig

  readonly metadata = {
    name: 'patent_database_search',
    description: '专利数据库检索工具，支持本地数据库（7500万CN专利）和在线API（全球专利）双数据源',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('检索查询内容（关键词/申请人/分类号/专利号）'),
      mode: z
        .nativeEnum(PatentDatabaseSearchMode)
        .optional()
        .default(PatentDatabaseSearchMode.KEYWORD)
        .describe('检索模式'),
      page: z.number().optional().default(1).describe('页码'),
      limit: z.number().optional().default(10).describe('每页结果数量'),
      language: z.enum(['zh', 'en']).optional().describe('语言偏好（zh=中文优先，en=英文优先）'),
      startDate: z.string().optional().describe('开始日期（YYYY-MM-DD）'),
      endDate: z.string().optional().describe('结束日期（YYYY-MM-DD）'),
    }),
    outputSchema: z.object({
      patents: z.array(
        z.object({
          id: z.string(),
          patentName: z.string(),
          applicationNumber: z.string().optional(),
          publicationNumber: z.string(),
          applicant: z.string().optional(),
          inventor: z.string().optional(),
          ipcCode: z.string().optional(),
          abstract: z.string().optional(),
          claims: z.string().optional(),
          publicationDate: z.string().optional(),
          filingDate: z.string().optional(),
          url: z.string().optional(),
        })
      ),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      elapsedMs: z.number(),
      dataSource: z.enum(['patent_db', 'google_patents', 'mixed']),
    }),
    permissions: [], // 不需要 HTTP 权限（数据库连接由适配器管理）
    version: '2.0.0',
    author: 'YunPat Team',
  }

  constructor(config?: PatentDatabaseSearchConfig) {
    super()

    this.config = config || {}

    // 初始化数据库适配器
    this.adapter = new PatentDatabaseAdapter({
      patent_db: this.config.patent_db,
      google_patents: this.config.google_patents,
    })

    console.log('[PatentDatabaseSearchTool] 工具已初始化')
    console.log(`  - 数据源: ${this.adapter.getDataSources().join(', ')}`)
  }

  /**
   * 执行专利检索
   */
  async execute(
    input: {
      query: string
      mode?: PatentDatabaseSearchMode
      page?: number
      limit?: number
      language?: 'zh' | 'en'
      startDate?: string
      endDate?: string
    },
    _context: ToolContext
  ): Promise<PatentDatabaseSearchResult> {
    const {
      query,
      mode = PatentDatabaseSearchMode.KEYWORD,
      page = 1,
      limit = 10,
      language,
      startDate,
      endDate,
    } = input

    const offset = (page - 1) * limit
    const startTime = Date.now()

    console.log(`[PatentDatabaseSearchTool] 检索模式: ${mode}`)
    console.log(`  - 查询: ${query}`)
    console.log(`  - 页码: ${page}/${limit}`)

    try {
      // 构建查询参数
      const queryParams: PatentQuery = {
        limit,
        offset,
        language,
        startDate,
        endDate,
      }

      // 根据检索模式执行不同的检索策略
      let results: PatentRecord[] = []
      let dataSource: PatentDatabaseSearchResult['dataSource'] = 'mixed'

      switch (mode) {
        case PatentDatabaseSearchMode.KEYWORD:
          results = await this.searchByKeyword(query, queryParams)
          break

        case PatentDatabaseSearchMode.APPLICANT:
          results = await this.searchByApplicant(query, queryParams)
          break

        case PatentDatabaseSearchMode.CLASSIFICATION:
          results = await this.searchByClassification(query, queryParams)
          break

        case PatentDatabaseSearchMode.NUMBER:
          results = await this.searchByNumber(query)
          break

        default:
          throw new Error(`Unsupported search mode: ${mode}`)
      }

      // 判断数据来源
      if (results.length > 0) {
        const sources = new Set(results.map((r) => r.source))
        dataSource = sources.size === 1 ? (sources.values().next().value as any) : 'mixed'
      }

      // 转换为标准格式
      const patents = results.map(this.convertToStandardRecord)

      const elapsedMs = Date.now() - startTime

      console.log(`[PatentDatabaseSearchTool] 检索完成`)
      console.log(`  - 结果数: ${patents.length}`)
      console.log(`  - 数据源: ${dataSource}`)
      console.log(`  - 耗时: ${elapsedMs}ms`)

      return {
        patents,
        total: patents.length,
        page,
        pageSize: limit,
        elapsedMs,
        dataSource,
      }
    } catch (error) {
      console.error(`[PatentDatabaseSearchTool] 检索失败:`, error)
      throw new Error(
        `Patent database search failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 关键词检索
   */
  private async searchByKeyword(query: string, options: PatentQuery): Promise<PatentRecord[]> {
    // 解析关键词（支持空格分隔）
    const keywords = query.split(/\s+/).filter((k) => k.length > 0)

    return await this.adapter.queryByKeywords(keywords, options)
  }

  /**
   * 申请人检索
   */
  private async searchByApplicant(
    applicant: string,
    options: PatentQuery
  ): Promise<PatentRecord[]> {
    return await this.adapter.queryByApplicant(applicant, options)
  }

  /**
   * 分类号检索
   */
  private async searchByClassification(
    classification: string,
    options: PatentQuery
  ): Promise<PatentRecord[]> {
    return await this.adapter.queryByClassification(classification, options)
  }

  /**
   * 申请号/公开号检索
   */
  private async searchByNumber(patentNumber: string): Promise<PatentRecord[]> {
    return await this.adapter.queryByPublicationNumber(patentNumber)
  }

  /**
   * 转换为标准专利记录格式
   */
  private convertToStandardRecord(record: PatentRecord): StandardPatentRecord {
    return {
      id: record.publicationNumber,
      patentName: record.title,
      applicationNumber: record.applicationNumber,
      publicationNumber: record.publicationNumber,
      applicant: record.applicant,
      inventor: record.inventors?.join(', '),
      ipcCode: record.ipcCodes?.join(', '),
      abstract: record.abstract,
      claims: record.claims,
      publicationDate: record.publicationDate,
      filingDate: record.applicationDate,
      url: record.url,
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    return await this.adapter.healthCheck()
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.adapter.close()
    console.log('[PatentDatabaseSearchTool] 工具已关闭')
  }

  /**
   * 获取数据源列表
   */
  getDataSources(): string[] {
    return this.adapter.getDataSources()
  }

  /**
   * 获取统计数据（仅 PatentDB 支持）
   */
  async getStatistics(): Promise<any> {
    return await this.adapter.getStatistics()
  }
}
