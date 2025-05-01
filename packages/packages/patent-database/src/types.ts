/**
 * 专利数据库类型定义
 * Patent Database Type Definitions
 */

/**
 * 专利记录（标准格式）
 */
export interface PatentRecord {
  /** 公开号/专利号 */
  publicationNumber: string
  /** 申请号 */
  applicationNumber?: string
  /** 标题 */
  title: string
  /** 摘要 */
  abstract?: string
  /** 申请人 */
  applicant?: string
  /** 发明人列表 */
  inventors?: string[]
  /** 受让人 */
  assignee?: string
  /** 申请日期 */
  applicationDate?: string
  /** 公开日期 */
  publicationDate?: string
  /** 优先权日期 */
  priorityDate?: string
  /** IPC 分类号 */
  ipcCodes?: string[]
  /** CPC 分类号 */
  cpcCodes?: string[]
  /** 法律状态 */
  status?: string
  /** 权利要求书 */
  claims?: string
  /** 说明书 */
  description?: string
  /** 全文 */
  fullText?: string
  /** 同族 ID */
  familyId?: string
  /** 同族成员 */
  familyMembers?: PatentFamilyMember[]
  /** 引用文献 */
  citations?: PatentCitation[]
  /** 数据来源 */
  source: 'patent_db' | 'google_patents'
  /** 原始 URL */
  url?: string
  /** 相关性评分 */
  relevanceScore?: number
}

/**
 * 专利查询参数
 */
export interface PatentQuery {
  /** 关键词 */
  keywords?: string[]
  /** 公开号 */
  publicationNumber?: string
  /** 申请号 */
  applicationNumber?: string
  /** 申请人 */
  applicant?: string
  /** 发明人 */
  inventor?: string
  /** IPC 分类号 */
  classification?: string
  /** 国家代码 */
  country?: string
  /** 语言 */
  language?: 'zh' | 'en'
  /** 开始日期 */
  startDate?: string
  /** 结束日期 */
  endDate?: string
  /** 限制数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 专利同族成员
 */
export interface PatentFamilyMember {
  patentId: string
  country: string
  kindCode: string
}

/**
 * 专利引用
 */
export interface PatentCitation {
  patentId: string
  type: 'forward' | 'backward'
  relevance?: string
}

/**
 * 数据源接口
 */
export interface PatentDataSource {
  /** 数据源名称 */
  name: string
  /** 数据源类型 */
  type: 'local' | 'remote'

  /**
   * 查询专利
   */
  query(query: PatentQuery): Promise<PatentRecord[]>

  /**
   * 根据公开号查询
   */
  getByPublicationNumber(number: string): Promise<PatentRecord | null>

  /**
   * 申请人查询
   */
  getByApplicant?(applicant: string, options?: PatentQuery): Promise<PatentRecord[]>

  /**
   * 全文检索
   */
  fullTextSearch?(query: string, options?: PatentQuery): Promise<PatentRecord[]>

  /**
   * 分类号查询
   */
  getByClassification?(classification: string, options?: PatentQuery): Promise<PatentRecord[]>

  /**
   * 搜索（Google Patents 专用）
   */
  search?(query: string, options?: PatentQuery): Promise<PatentRecord[]>

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>

  /**
   * 关闭连接
   */
  close?(): Promise<void>
}

/**
 * PatentDB 配置
 */
export interface PatentDBConfig {
  /** 主机地址 */
  host: string
  /** 端口 */
  port: number
  /** 数据库名 */
  database: string
  /** 用户名 */
  user: string
  /** 密码 */
  password: string
  /** 连接池大小 */
  poolSize?: number
}

/**
 * Google Patents 配置
 */
export interface GooglePatentsConfig {
  /** 是否启用 */
  enabled?: boolean
  /** 限流（请求/秒） */
  rateLimit?: number
  /** 超时时间（秒） */
  timeout?: number
}

/**
 * 统计数据
 */
export interface PatentStatistics {
  /** 总数 */
  total: number
  /** 按状态统计 */
  byStatus: Record<string, number>
  /** 按分类统计 */
  byClassification: Record<string, number>
  /** 按申请人统计 */
  byApplicant: Record<string, number>
  /** 按日期统计 */
  byDate: Record<string, number>
}
