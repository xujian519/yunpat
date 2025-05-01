/**
 * 推理缓存系统
 *
 * 基于相似度的智能缓存，避免重复推理相同或相似的问题
 *
 * 核心功能：
 * 1. 相似度计算 - 使用多种算法计算问题相似度
 * 2. 智能缓存 - 自动存储和检索推理结果
 * 3. 缓存策略 - LRU、TTL、相似度阈值
 * 4. 性能监控 - 缓存命中率、节省的 Token 数
 *
 * @module reasoning/ReasoningCache
 */
import { EmbeddingAdapter } from '../llm/EmbeddingAdapter.js'
/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  /** 键（问题的哈希或嵌入向量） */
  key: string
  /** 原始问题 */
  problem: string
  /** 推理结果 */
  result: T
  /** 创建时间 */
  createdAt: Date
  /** 最后访问时间 */
  lastAccessedAt: Date
  /** 访问次数 */
  accessCount: number
  /** 嵌入向量（用于相似度计算） */
  embedding?: number[]
  /** Token 消耗 */
  tokensUsed: number
}
/**
 * 缓存统计
 */
export interface ReasoningCacheStats {
  /** 总条目数 */
  totalEntries: number
  /** 缓存命中次数 */
  hits: number
  /** 缓存未命中次数 */
  misses: number
  /** 命中率 */
  hitRate: number
  /** 节省的 Token 数 */
  tokensSaved: number
  /** 总 Token 消耗（含缓存） */
  totalTokens: number
  /** 平均相似度 */
  avgSimilarity: number
}
/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 最大缓存条目数 */
  maxEntries: number
  /** 相似度阈值 (0-1) */
  similarityThreshold: number
  /** TTL（毫秒） */
  ttl: number
  /** 是否启用嵌入向量 */
  enableEmbedding: boolean
  /** 相似度算法 */
  similarityAlgorithm: 'cosine' | 'jaccard' | 'levenshtein'
}
/**
 * 缓存查询结果
 */
export interface CacheQueryResult<T> {
  /** 是否找到缓存 */
  found: boolean
  /** 缓存的结果 */
  result?: T
  /** 相似度 */
  similarity?: number
  /** 缓存条目 */
  entry?: CacheEntry<T>
}
/**
 * 推理缓存类
 */
export declare class ReasoningCache<T = any> {
  private cache
  private config
  private embeddingAdapter?
  private stats
  constructor(config?: Partial<CacheConfig>, embeddingAdapter?: EmbeddingAdapter)
  /**
   * 查询缓存
   *
   * @param problem 问题
   * @param threshold 相似度阈值（可选，覆盖配置）
   * @returns 缓存查询结果
   */
  query(problem: string, threshold?: number): Promise<CacheQueryResult<T>>
  /**
   * 存储到缓存
   *
   * @param problem 问题
   * @param result 结果
   * @param tokensUsed Token 消耗
   */
  store(problem: string, result: T, tokensUsed: number): Promise<void>
  /**
   * 获取缓存统计
   */
  getStats(): ReasoningCacheStats
  /**
   * 清空缓存
   */
  clear(): void
  /**
   * 删除指定键的缓存
   */
  delete(problem: string): boolean
  /**
   * 基于嵌入向量查询
   */
  private queryByEmbedding
  /**
   * 基于相似度查询（不使用嵌入）
   */
  private queryBySimilarity
  /**
   * 计算两个字符串的相似度
   */
  private calculateSimilarity
  /**
   * 余弦相似度（文本版）
   */
  private cosineSimilarityText
  /**
   * 余弦相似度（向量版）
   */
  private cosineSimilarity
  /**
   * Jaccard 相似度
   */
  private jaccardSimilarity
  /**
   * Levenshtein 相似度
   */
  private levenshteinSimilarity
  /**
   * Levenshtein 距离
   */
  private levenshteinDistance
  /**
   * 生成缓存键
   */
  private generateKey
  /**
   * 清理过期条目
   */
  private cleanup
  /**
   * 驱逐最少使用的条目
   */
  private evictLRU
  /**
   * 获取所有缓存条目
   */
  getEntries(): CacheEntry<T>[]
  /**
   * 导出缓存（用于持久化）
   */
  export(): Array<{
    key: string
    entry: CacheEntry<T>
  }>
  /**
   * 导入缓存（用于恢复）
   */
  import(
    data: Array<{
      key: string
      entry: CacheEntry<T>
    }>
  ): void
}
/**
 * 创建推理缓存（便捷函数）
 *
 * @param config 缓存配置
 * @param embeddingAdapter 嵌入适配器（可选）
 * @returns 推理缓存实例
 */
export declare function createReasoningCache<T = any>(
  config?: Partial<CacheConfig>,
  embeddingAdapter?: EmbeddingAdapter
): ReasoningCache<T>
//# sourceMappingURL=ReasoningCache.d.ts.map
