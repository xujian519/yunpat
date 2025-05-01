/**
 * 语义缓存系统
 *
 * 核心功能：
 * 1. 生成任务签名（语义指纹）
 * 2. 查找相似任务
 * 3. 存储和检索响应
 * 4. 缓存统计
 *
 * 预期效果：
 * - 重复任务成本降低 90%+
 * - 相似任务成本降低 50%+
 * - 响应速度提升 10倍
 */
/**
 * 任务签名（语义指纹）
 */
export interface TaskSignature {
  /** 嵌入向量 */
  embedding: number[]
  /** 任务类型的哈希值 */
  typeHash: number
  /** 关键特征哈希 */
  featureHash: number
}
/**
 * 缓存的响应
 */
export interface CachedResponse<TTask, TResult> {
  /** 任务 */
  task: TTask
  /** 任务签名 */
  signature: TaskSignature
  /** 响应结果 */
  response: TResult
  /** 存储时间戳 */
  timestamp: Date
  /** 访问次数 */
  accessCount: number
  /** 最后访问时间 */
  lastAccessed: Date
}
/**
 * 缓存统计
 */
export interface CacheStats {
  /** 命中率（百分比） */
  hitRate: string
  /** 总请求数 */
  totalRequests: number
  /** 缓存命中数 */
  cacheHits: number
  /** 缓存未命中数 */
  cacheMisses: number
  /** 当前缓存条目数 */
  size: number
  /** 平均相似度分数 */
  averageSimilarity: number
}
/**
 * 语义缓存配置
 */
export interface SemanticCacheConfig<TTask, TResult> {
  /** 相似度阈值（默认 0.85） */
  similarityThreshold?: number
  /** 最大缓存条目数（默认 1000） */
  maxCacheSize?: number
  /** 缓存过期时间（毫秒，默认 7 天） */
  cacheExpiration?: number
  /** 生成任务签名的函数 */
  generateSignature: (task: TTask) => Promise<TaskSignature>
  /** 可选：轻量级改写函数 */
  lightweightRewrite?: (cachedResponse: TResult, newTask: TTask) => Promise<TResult>
}
/**
 * 语义缓存类
 *
 * 泛型参数：
 * - TTask: 任务类型
 * - TResult: 响应结果类型
 */
export declare class SemanticCache<TTask, TResult> {
  private cache
  private stats
  private config
  constructor(config: SemanticCacheConfig<TTask, TResult>)
  /**
   * 查找相似任务
   * @param task 要查找的任务
   * @param threshold 相似度阈值（可选，默认使用配置值）
   * @returns 缓存的响应或 null
   */
  findSimilar(task: TTask, threshold?: number): Promise<CachedResponse<TTask, TResult> | null>
  /**
   * 存储响应到缓存
   * @param task 任务
   * @param response 响应结果
   */
  store(task: TTask, response: TResult): Promise<void>
  /**
   * 直接获取缓存（精确匹配）
   * @param task 任务
   * @returns 响应结果或 null
   */
  get(task: TTask): Promise<TResult | null>
  /**
   * 清空缓存
   */
  clear(): void
  /**
   * 获取缓存统计
   */
  getStats(): CacheStats
  /**
   * 余弦相似度计算
   * @param vecA 向量 A
   * @param vecB 向量 B
   * @returns 相似度分数（0-1）
   */
  private cosineSimilarity
  /**
   * 生成缓存键
   * @param signature 任务签名
   * @returns 缓存键
   */
  private generateCacheKey
  /**
   * 检查缓存条目是否过期
   * @param cached 缓存的响应
   * @returns 是否过期
   */
  private isExpired
  /**
   * 驱逐最旧的缓存条目
   */
  private evictOldest
  /**
   * 删除特定缓存条目
   * @param task 要删除的任务
   */
  delete(task: TTask): Promise<boolean>
  /**
   * 获取缓存大小
   */
  size(): number
  /**
   * 清理过期条目
   */
  cleanup(): Promise<number>
}
/**
 * 创建简单的任务签名生成器
 * 基于任务的关键字段生成嵌入向量
 *
 * 注意：这是一个简化实现，生产环境建议使用真实的嵌入模型
 */
export declare function createSimpleSignatureGenerator<TTask>(
  extractFeatures: (task: TTask) => string[]
): (task: TTask) => Promise<TaskSignature>
/**
 * 创建基于嵌入模型的签名生成器
 *
 * 使用真实的嵌入模型（如 Jina AI、OpenAI embeddings）生成语义向量
 */
export declare function createEmbeddingBasedSignatureGenerator<TTask>(
  embedFn: (text: string) => Promise<number[]>,
  extractText: (task: TTask) => string
): (task: TTask) => Promise<TaskSignature>
/**
 * 创建语义缓存实例的便捷函数
 */
export declare function createSemanticCache<TTask, TResult>(
  config: SemanticCacheConfig<TTask, TResult>
): SemanticCache<TTask, TResult>
//# sourceMappingURL=SemanticCache.d.ts.map
