/**
 * 嵌入向量缓存
 *
 * 避免重复计算相同文本的嵌入向量
 */

import {
  EmbeddingProvider,
  EmbeddingParams,
  EmbeddingResult,
  SingleEmbeddingResult,
  EmbeddingCapabilities,
  BaseEmbeddingProvider,
  EmbeddingCacheKeyGenerator,
} from './EmbeddingProvider.js'

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存命中次数 */
  hits: number
  /** 缓存未命中次数 */
  misses: number
  /** 缓存大小 */
  size: number
  /** 命中率 */
  hitRate: number
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 最大缓存条目数（默认 10000） */
  maxSize?: number
  /** 缓存过期时间（毫秒，默认 1 小时） */
  ttl?: number
  /** 是否启用缓存（默认 true） */
  enabled?: boolean
}

/**
 * 缓存条目
 */
interface CacheEntry {
  /** 嵌入向量 */
  embedding: number[]
  /** 创建时间 */
  timestamp: number
  /** 访问次数 */
  accessCount: number
  /** 最后访问时间 */
  lastAccess: number
}

/**
 * 嵌入缓存装饰器
 *
 * 为任何 EmbeddingProvider 添加缓存能力
 */
export class CachedEmbeddingProvider extends BaseEmbeddingProvider {
  private provider: EmbeddingProvider
  private cache: Map<string, CacheEntry>
  private config: Required<CacheConfig>
  private stats = { hits: 0, misses: 0 }

  constructor(provider: EmbeddingProvider, config: CacheConfig = {}) {
    super()

    this.provider = provider
    this.cache = new Map()
    this.config = {
      maxSize: config.maxSize ?? 10000,
      ttl: config.ttl ?? 60 * 60 * 1000, // 1 小时
      enabled: config.enabled ?? true,
    }
  }

  /**
   * 批量嵌入（带缓存）
   */
  async embed(params: EmbeddingParams): Promise<EmbeddingResult> {
    if (!this.config.enabled) {
      return await this.provider.embed(params)
    }

    const { texts, normalize } = params
    const model = this.provider.getModel()
    const now = Date.now()

    // 检查缓存
    const embeddings: number[][] = []
    const uncachedTexts: string[] = []
    const uncachedIndices: number[] = []

    for (let i = 0; i < texts.length; i++) {
      const cacheKey = EmbeddingCacheKeyGenerator.generate(model, texts[i], normalize ?? true)
      const entry = this.cache.get(cacheKey)

      if (entry && this.isValidEntry(entry, now)) {
        // 缓存命中
        embeddings[i] = entry.embedding
        entry.accessCount++
        entry.lastAccess = now
        this.stats.hits++
      } else {
        // 缓存未命中
        uncachedTexts.push(texts[i])
        uncachedIndices.push(i)
        this.stats.misses++
      }
    }

    // 计算未缓存的文本
    if (uncachedTexts.length > 0) {
      const newResult = await this.provider.embed({
        texts: uncachedTexts,
        normalize,
      })

      // 将新结果存入缓存
      for (let i = 0; i < uncachedTexts.length; i++) {
        const text = uncachedTexts[i]
        const index = uncachedIndices[i]
        const embedding = newResult.embeddings[i]

        embeddings[index] = embedding

        // 存入缓存
        const cacheKey = EmbeddingCacheKeyGenerator.generate(model, text, normalize ?? true)
        this.putCache(cacheKey, embedding)
      }
    }

    // 清理过期缓存（如果缓存已满）
    this.cleanup()

    return {
      embeddings,
      dimension: embeddings[0]?.length ?? 0,
      model,
    }
  }

  /**
   * 嵌入单个文本（带缓存）
   */
  async embedSingle(text: string, normalize?: boolean): Promise<SingleEmbeddingResult> {
    if (!this.config.enabled) {
      return await this.provider.embedSingle(text, normalize)
    }

    const model = this.provider.getModel()
    const shouldNormalize = normalize ?? true
    const cacheKey = EmbeddingCacheKeyGenerator.generate(model, text, shouldNormalize)
    const now = Date.now()

    // 检查缓存
    const entry = this.cache.get(cacheKey)
    if (entry && this.isValidEntry(entry, now)) {
      entry.accessCount++
      entry.lastAccess = now
      this.stats.hits++
      return {
        embedding: entry.embedding,
        model,
      }
    }

    this.stats.misses++

    // 缓存未命中，调用底层 provider
    const result = await this.provider.embedSingle(text, normalize)

    // 存入缓存
    this.putCache(cacheKey, result.embedding)

    // 清理过期缓存
    this.cleanup()

    return result
  }

  /**
   * 获取能力元数据
   */
  getCapabilities(): EmbeddingCapabilities {
    return this.provider.getCapabilities()
  }

  /**
   * 获取模型名称
   */
  getModel(): string {
    return this.provider.getModel()
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size
  }

  /**
   * 检查缓存条目是否有效
   */
  private isValidEntry(entry: CacheEntry, now: number): boolean {
    return now - entry.timestamp < this.config.ttl
  }

  /**
   * 存入缓存
   */
  private putCache(key: string, embedding: number[]): void {
    const now = Date.now()

    // 如果缓存已满，删除最少使用的条目
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      embedding,
      timestamp: now,
      accessCount: 1,
      lastAccess: now,
    })
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    if (this.cache.size < this.config.maxSize) {
      return
    }

    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (!this.isValidEntry(entry, now)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
    }
  }

  /**
   * 淘汰最少使用的缓存条目
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestAccess = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * 预热缓存
   *
   * 批量预先计算并缓存文本的嵌入向量
   */
  async warmup(texts: string[]): Promise<void> {
    if (!this.config.enabled || texts.length === 0) {
      return
    }

    await this.embed({ texts })
  }

  /**
   * 获取底层 provider
   */
  getUnderlyingProvider(): EmbeddingProvider {
    return this.provider
  }

  /**
   * 启用或禁用缓存
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  /**
   * 检查缓存是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled
  }
}

/**
 * 创建带缓存的嵌入提供者
 */
export function createCachedProvider(
  provider: EmbeddingProvider,
  config?: CacheConfig
): CachedEmbeddingProvider {
  return new CachedEmbeddingProvider(provider, config)
}
