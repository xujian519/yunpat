/**
 * 附图理解优化工具
 *
 * 提供图像缓存、批量处理等优化功能
 */

import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

// ========== 常量定义 ==========

/** 默认缓存大小（100MB） */
const DEFAULT_CACHE_SIZE = 100 * 1024 * 1024

/** 默认最大缓存条目数 */
const DEFAULT_MAX_ENTRIES = 100

/** 默认批次大小 */
const DEFAULT_BATCH_SIZE = 5

/** 默认批次延迟（毫秒） */
const DEFAULT_BATCH_DELAY = 1000

/** 默认最大并发数 */
const DEFAULT_MAX_CONCURRENCY = 3

/** 默认重试次数 */
const DEFAULT_RETRY_COUNT = 2

/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30000

// ========== 类型定义 ==========

export interface CacheStats {
  entryCount: number
  totalSize: number
  hits: number
  misses: number
  hitRate: number
}

export interface BatchProcessingConfig {
  batchSize?: number
  batchDelay?: number
  maxConcurrency?: number
  retryCount?: number
  timeout?: number
}

// ========== 图像缓存 ==========

export class DrawingImageCache {
  private cache = new Map<string, { base64: string; size: number; timestamp: number }>()
  private hits = 0
  private misses = 0

  constructor(
    private maxSize = DEFAULT_CACHE_SIZE,
    private maxEntries = DEFAULT_MAX_ENTRIES
  ) {}

  async get(imagePath: string): Promise<string | null> {
    const entry = this.cache.get(this.hash(imagePath))
    if (entry) {
      this.hits++
      entry.timestamp = Date.now()
      return entry.base64
    }
    this.misses++
    return null
  }

  async set(imagePath: string, base64: string): Promise<void> {
    const key = this.hash(imagePath)
    const size = base64.length

    // 简单清理策略：如果超出限制，清空所有缓存
    const currentSize = this.getCurrentSize()
    if (currentSize + size > this.maxSize || this.cache.size >= this.maxEntries) {
      this.cache.clear()
    }

    this.cache.set(key, { base64, size, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses
    return {
      entryCount: this.cache.size,
      totalSize: this.getCurrentSize(),
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    }
  }

  removeUnused(maxAge: number = 3600000): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key)
      }
    }
  }

  private hash(path: string): string {
    return createHash('md5').update(path).digest('hex')
  }

  private getCurrentSize(): number {
    return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0)
  }
}

// ========== 批量处理器 ==========

export class DrawingBatchProcessor {
  private config: Required<BatchProcessingConfig>

  constructor(config: BatchProcessingConfig = {}) {
    this.config = {
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      batchDelay: config.batchDelay ?? DEFAULT_BATCH_DELAY,
      maxConcurrency: config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      retryCount: config.retryCount ?? DEFAULT_RETRY_COUNT,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    }
  }

  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  ): Promise<R[]> {
    const results: R[] = []
    const total = items.length

    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize)
      const batchResults = await this.processBatchWithRetry(batch, processor)
      results.push(...batchResults)

      if (onProgress) {
        onProgress({
          current: results.length,
          total,
          percentage: Math.round((results.length / total) * 100),
        })
      }

      if (i + this.config.batchSize < items.length && this.config.batchDelay > 0) {
        await this.delay(this.config.batchDelay)
      }
    }

    return results
  }

  private async processBatchWithRetry<T, R>(
    batch: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = []

    for (const item of batch) {
      let lastError: Error | undefined

      for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
        try {
          const result = await this.withTimeout(processor(item), this.config.timeout)
          results.push(result)
          break
        } catch (error) {
          lastError = error as Error
          if (attempt < this.config.retryCount) {
            await this.delay(1000 * (attempt + 1))
          }
        }
      }

      if (lastError && results.length < batch.indexOf(item) + 1) {
        console.error('批量处理失败:', lastError.message)
      }
    }

    return results
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`操作超时 (${timeout}ms)`)), timeout)
      ),
    ])
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ========== 组合优化器 ==========

export class DrawingOptimizer {
  private cache: DrawingImageCache
  private batchProcessor: DrawingBatchProcessor

  constructor(config?: {
    cache?: { maxSize?: number; maxEntries?: number }
    batch?: BatchProcessingConfig
  }) {
    this.cache = new DrawingImageCache(config?.cache?.maxSize, config?.cache?.maxEntries)
    this.batchProcessor = new DrawingBatchProcessor(config?.batch)
  }

  async getOrLoadImage(imagePath: string): Promise<string> {
    const cached = await this.cache.get(imagePath)
    if (cached) return cached

    const buffer = await readFile(imagePath)
    const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
    const base64 = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buffer.toString('base64')}`

    await this.cache.set(imagePath, base64)
    return base64
  }

  async processDrawings<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  ): Promise<R[]> {
    return this.batchProcessor.processBatch(items, processor, onProgress)
  }

  getCacheStats(): CacheStats {
    return this.cache.getStats()
  }

  clearCache(): void {
    this.cache.clear()
  }

  cleanupCache(maxAge?: number): void {
    this.cache.removeUnused(maxAge)
  }

  async preloadImages(imagePaths: string[]): Promise<void> {
    for (const imagePath of imagePaths) {
      try {
        await this.getOrLoadImage(imagePath)
      } catch (error) {
        console.error(`预加载失败: ${imagePath}`, error)
      }
    }
  }
}
