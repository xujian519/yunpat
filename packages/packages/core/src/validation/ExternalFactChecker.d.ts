/**
 * 外部事实验证器 (ExternalFactChecker)
 *
 * 集成外部事实验证 API（如 Google Fact Check Tools）进行声明验证
 */
/**
 * Google Fact Check Tools API 响应类型
 */
export interface GoogleFactCheckResponse {
  claims?: Array<{
    text: string
    claimant?: string[]
    claimDate?: string
    claimReview?: Array<{
      publisher?: {
        name: string
        site: string
      }
      textualRating?: string
      url: string
      title?: string
      reviewDate?: string
      languageCode?: string
    }>
  }>
  nextPageToken?: string
}
/**
 * 声明评审 (Claim Review)
 */
export interface ClaimReview {
  publisher?: {
    name: string
    site: string
  }
  textualRating?: string
  url: string
  title?: string
  reviewDate?: string
  languageCode?: string
}
/**
 * 外部事实验证选项
 */
export interface ExternalFactCheckOptions {
  /** 语言代码 */
  language?: string
  /** 最大时间范围（天） */
  maxAgeDays?: number
  /** 页面大小 */
  pageSize?: number
  /** 请求超时（毫秒） */
  timeout?: number
}
/**
 * 聚合事实验证结果
 */
export interface AggregatedFactCheck {
  /** 原始声明 */
  claim: string
  /** 加权置信度 */
  confidence: number
  /** 验证来源列表 */
  sources: string[]
  /** 共识状态 */
  consensus: 'CONSENSUS_TRUE' | 'CONSENSUS_FALSE' | 'CONSENSUS_MIXED' | 'NO_CONSENSUS'
  /** 各来源结果 */
  results: ExternalFactCheckResult[]
  /** 时间戳 */
  timestamp: Date
}
/**
 * 外部事实验证结果
 */
export interface ExternalFactCheckResult {
  /** 原始声明 */
  claim: string
  /** 验证状态 */
  isValid: 'TRUE' | 'FALSE' | 'MIXED' | 'UNKNOWN'
  /** 置信度 */
  confidence: number
  /** 来源列表 */
  sources: ExternalSource[]
  /** 验证源 */
  source: 'google_factcheck' | 'snopes' | 'knowledge_base' | 'llm'
  /** 时间戳 */
  timestamp: Date
}
/**
 * 外部来源
 */
export interface ExternalSource {
  name: string
  url: string
  rating: string
  date?: string
}
/**
 * 事实验证错误
 */
export declare class FactCheckError extends Error {
  code?: number | undefined
  source?: string | undefined
  constructor(message: string, code?: number | undefined, source?: string | undefined)
}
/**
 * 外部事实验证器配置
 */
export interface ExternalFactCheckerConfig {
  /** API 密钥 */
  apiKey?: string
  /** 基础 URL */
  baseURL?: string
  /** 默认超时（毫秒） */
  defaultTimeout?: number
  /** 是否启用缓存 */
  enableCache?: boolean
  /** 缓存 TTL（毫秒） */
  cacheTTL?: number
  /** 速率限制（请求/秒） */
  rateLimit?: number
}
/**
 * 外部事实验证器
 *
 * 提供与外部事实验证 API 的集成能力
 */
export declare class ExternalFactChecker {
  private apiKey
  private baseURL
  private defaultTimeout
  private enableCache
  private cacheTTL
  private rateLimit
  private cache
  private lastRequestTime
  constructor(config?: ExternalFactCheckerConfig)
  /**
   * 验证单个声明
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 事实验证结果
   */
  verifyClaim(claim: string, options?: ExternalFactCheckOptions): Promise<ExternalFactCheckResult>
  /**
   * 批量验证声明
   *
   * @param claims 声明列表
   * @param options 验证选项
   * @returns 事实验证结果列表
   */
  verifyClaims(
    claims: string[],
    options?: ExternalFactCheckOptions
  ): Promise<ExternalFactCheckResult[]>
  /**
   * 解析 API 响应
   *
   * @param data API 响应数据
   * @param claim 原始声明
   * @param source 验证源
   * @returns 事实验证结果
   */
  private parseResponse
  /**
   * 解析评级
   *
   * @param rating 文本评级
   * @returns 验证状态
   */
  private parseRating
  /**
   * 计算置信度
   *
   * @param reviews 评审列表
   * @returns 置信度分数
   */
  private calculateConfidence
  /**
   * 应用速率限制
   */
  private applyRateLimit
  /**
   * 生成缓存键
   *
   * @param claim 声明
   * @returns 缓存键
   */
  private generateCacheKey
  /**
   * 从缓存获取
   *
   * @param claim 声明
   * @returns 缓存结果或 undefined
   */
  private getFromCache
  /**
   * 设置缓存
   *
   * @param claim 声明
   * @param result 验证结果
   */
  private setToCache
  /**
   * 清除缓存
   */
  clearCache(): void
  /**
   * 获取缓存统计
   *
   * @returns 缓存统计信息
   */
  getCacheStats(): {
    size: number
    keys: string[]
  }
}
/**
 * 获取验证源权重
 *
 * @param source 验证源
 * @returns 权重值
 */
export declare function getSourceWeight(source: string): number
/**
 * 计算共识状态
 *
 * @param results 验证结果列表
 * @returns 共识状态
 */
export declare function calculateConsensus(
  results: ExternalFactCheckResult[]
): 'CONSENSUS_TRUE' | 'CONSENSUS_FALSE' | 'CONSENSUS_MIXED' | 'NO_CONSENSUS'
/**
 * 聚合多个验证结果
 *
 * @param results 验证结果列表
 * @returns 聚合结果
 */
export declare function aggregateResults(results: ExternalFactCheckResult[]): AggregatedFactCheck
//# sourceMappingURL=ExternalFactChecker.d.ts.map
