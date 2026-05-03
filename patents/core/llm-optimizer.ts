/**
 * LLM 调用优化工具
 *
 * 提供 LLM 调用的性能优化功能：
 * 1. 请求批处理 - 合并多个独立请求
 * 2. 响应缓存 - 缓存 LLM 响应避免重复调用
 * 3. 提示词优化 - 压缩和优化提示词
 */

import type { LLMAdapter, LLMMessage, LLMResponse } from './llm-types.js'
import { LLMHelper } from './llm-helper.js'
import { LLM_CONSTANTS } from './constants.js'
import { createModuleLogger, StructuredLogger } from './logger.js'
import { PerformanceMonitor } from './performance-monitor.js'
import { createHash } from 'crypto'

/**
 * 缓存项
 */
interface CacheItem {
  response: LLMResponse
  timestamp: number
  hitCount: number
}

/**
 * 批处理请求
 */
interface BatchRequest {
  id: string
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
}

/**
 * 批处理结果
 */
interface BatchResult {
  id: string
  response?: LLMResponse
  error?: Error
}

/**
 * 批处理回调
 */
interface BatchCallback {
  resolve: (value: LLMResponse) => void
  reject: (error: Error) => void
}

/**
 * 提示词优化配置
 */
interface PromptOptimizationConfig {
  /** 是否启用压缩 */
  enableCompression?: boolean

  /** 最大提示词长度 */
  maxLength?: number

  /** 是否保留关键信息 */
  preserveKeyInfo?: boolean

  /** 压缩比率 (0-1) */
  compressionRatio?: number
}

/**
 * LLM 优化器配置
 */
export interface LLMOptimizerConfig {
  /** 是否启用响应缓存 */
  enableResponseCache?: boolean

  /** 缓存最大大小 */
  cacheMaxSize?: number

  /** 缓存 TTL（毫秒） */
  cacheTTL?: number

  /** 是否启用批处理 */
  enableBatching?: boolean

  /** 批处理最大大小 */
  batchMaxSize?: number

  /** 批处理超时（毫秒） */
  batchTimeout?: number

  /** 是否启用提示词优化 */
  enablePromptOptimization?: boolean

  /** 提示词优化配置 */
  promptOptimizationConfig?: PromptOptimizationConfig
}

/**
 * LLM 优化器
 */
export class LLMOptimizer {
  private llm: LLMAdapter
  private config: Required<LLMOptimizerConfig>

  // 响应缓存
  private responseCache: Map<string, CacheItem> = new Map()

  // 批处理队列
  private batchQueue: BatchRequest[] = []
  private batchTimer?: NodeJS.Timeout

  // 批处理回调
  private batchCallbacks = new Map<string, BatchCallback>()

  private logger: StructuredLogger
  private perfMonitor: PerformanceMonitor

  // 统计信息
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    batchesProcessed: 0,
    totalRequestsBatched: 0,
    promptsOptimized: 0,
    avgCompressionRatio: 0,
  }

  constructor(llm: LLMAdapter, config: LLMOptimizerConfig = {}) {
    this.llm = llm
    this.config = {
      enableResponseCache: config.enableResponseCache ?? true,
      cacheMaxSize: config.cacheMaxSize ?? 1000,
      cacheTTL: config.cacheTTL ?? 3600000, // 1小时
      enableBatching: config.enableBatching ?? true,
      batchMaxSize: config.batchMaxSize ?? 10,
      batchTimeout: config.batchTimeout ?? 100, // 100ms
      enablePromptOptimization: config.enablePromptOptimization ?? true,
      promptOptimizationConfig: config.promptOptimizationConfig ?? {
        enableCompression: true,
        maxLength: 8000,
        preserveKeyInfo: true,
        compressionRatio: 0.7,
      },
    }

    this.logger = new StructuredLogger('LLMOptimizer')
    this.perfMonitor = new PerformanceMonitor()

    this.logger.info('LLMOptimizer 初始化完成', {
      enableResponseCache: this.config.enableResponseCache,
      enableBatching: this.config.enableBatching,
      enablePromptOptimization: this.config.enablePromptOptimization,
    })
  }

  /**
   * 优化的聊天调用（集成缓存、批处理、提示词优化）
   */
  async optimizedChat(params: {
    messages: LLMMessage[]
    temperature?: number
    maxTokens?: number
    enableCache?: boolean
    enableBatching?: boolean
    enablePromptOptimization?: boolean
  }): Promise<LLMResponse> {
    const {
      messages,
      temperature,
      maxTokens,
      enableCache = this.config.enableResponseCache,
      enableBatching = this.config.enableBatching,
      enablePromptOptimization = this.config.enablePromptOptimization,
    } = params

    // 1. 提示词优化
    let optimizedMessages = messages
    if (enablePromptOptimization) {
      optimizedMessages = this.optimizePrompt(messages)
      this.stats.promptsOptimized++
    }

    // 2. 检查缓存
    const cacheKey = this.generateCacheKey(optimizedMessages, temperature, maxTokens)
    if (enableCache) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        this.logger.debug('缓存命中', { cacheKey })
        return cached
      }
      this.stats.cacheMisses++
    }

    // 3. 如果启用批处理，添加到批处理队列
    if (enableBatching) {
      return new Promise((resolve, reject) => {
        const requestId = this.generateRequestId()

        this.batchQueue.push({
          id: requestId,
          messages: optimizedMessages,
          temperature,
          maxTokens,
        })

        // 设置回调
        this.batchCallbacks.set(requestId, { resolve, reject })

        // 检查是否需要立即处理批处理
        if (this.batchQueue.length >= this.config.batchMaxSize) {
          this.processBatch()
        } else if (!this.batchTimer) {
          // 设置批处理超时
          this.batchTimer = setTimeout(() => {
            this.processBatch()
          }, this.config.batchTimeout)
        }
      })
    }

    // 4. 直接调用
    const response = await this.llm.chat({
      messages: optimizedMessages,
      temperature,
      maxTokens,
    })

    // 5. 缓存响应
    if (enableCache) {
      this.setToCache(cacheKey, response)
    }

    return response
  }

  /**
   * 处理批处理队列
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return
    }

    // 清除定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    const batch = this.batchQueue.splice(0, this.config.batchMaxSize)
    this.stats.batchesProcessed++
    this.stats.totalRequestsBatched += batch.length

    this.logger.debug('处理批处理', {
      batchSize: batch.length,
    })

    try {
      // 并行处理所有请求
      const results = await Promise.allSettled(
        batch.map(async (req) => {
          try {
            const response = await this.llm.chat({
              messages: req.messages,
              temperature: req.temperature,
              maxTokens: req.maxTokens,
            })
            return { id: req.id, response }
          } catch (error) {
            return { id: req.id, error: error as Error }
          }
        })
      )

      // 调用回调
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const callback = this.batchCallbacks.get(result.value.id)
          if (callback) {
            if (result.value.error) {
              callback.reject(result.value.error)
            } else {
              callback.resolve(result.value.response)
            }
            this.batchCallbacks.delete(result.value.id)
          }
        } else {
          // 找到对应的请求ID并通知失败
          for (const [id, callback] of this.batchCallbacks.entries()) {
            callback.reject(result.reason)
            this.batchCallbacks.delete(id)
          }
        }
      }

      this.logger.debug('批处理完成', {
        successCount: results.filter((r) => r.status === 'fulfilled' && r.value && !r.value.error)
          .length,
        failureCount: results.filter(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && r.value.error)
        ).length,
      })
    } catch (error) {
      this.logger.error('批处理失败', error as Error)

      // 通知所有等待的请求失败
      for (const req of batch) {
        const callback = this.batchCallbacks.get(req.id)
        if (callback) {
          callback.reject(error as Error)
          this.batchCallbacks.delete(req.id)
        }
      }
    }
  }

  /**
   * 优化提示词
   */
  private optimizePrompt(messages: LLMMessage[]): LLMMessage[] {
    const config = this.config.promptOptimizationConfig

    if (!config.enableCompression) {
      return messages
    }

    const optimized: LLMMessage[] = []
    let totalCompression = 0

    for (const message of messages) {
      let content = message.content

      // 检查是否需要压缩
      const maxLength = config.maxLength || 8000
      if (content.length > maxLength) {
        const originalLength = content.length

        // 压缩策略
        const fullConfig: Required<PromptOptimizationConfig> & { maxLength: number } = {
          enableCompression: config.enableCompression ?? true,
          maxLength,
          preserveKeyInfo: config.preserveKeyInfo ?? true,
          compressionRatio: config.compressionRatio ?? 0.7,
        }

        content = this.compressContent(content, fullConfig)

        const compressionRatio = 1 - content.length / originalLength
        totalCompression += compressionRatio

        this.logger.debug('提示词已压缩', {
          originalLength,
          compressedLength: content.length,
          compressionRatio: compressionRatio.toFixed(2),
        })
      }

      optimized.push({
        ...message,
        content,
      })
    }

    // 更新平均压缩比率
    if (optimized.length > 0) {
      this.stats.avgCompressionRatio =
        (this.stats.avgCompressionRatio * this.stats.promptsOptimized +
          totalCompression / optimized.length) /
        (this.stats.promptsOptimized + 1)
    }

    return optimized
  }

  /**
   * 压缩内容
   */
  private compressContent(
    content: string,
    config: Required<PromptOptimizationConfig> & { maxLength: number }
  ): string {
    const maxLength = config.maxLength

    // 策略1: 移除多余的空格和换行
    let compressed = content.replace(/\s+/g, ' ').trim()

    // 策略2: 如果仍然太长，截断并保留关键信息
    if (compressed.length > maxLength && config.preserveKeyInfo) {
      // 保留前70%和后30%
      const keepStart = Math.floor(maxLength * 0.7)
      const keepEnd = Math.floor(maxLength * 0.3)

      compressed =
        compressed.substring(0, keepStart) +
        '\n...\n' +
        compressed.substring(compressed.length - keepEnd)
    } else if (compressed.length > maxLength) {
      // 直接截断
      compressed = compressed.substring(0, maxLength)
    }

    return compressed
  }

  /**
   * 从缓存获取响应
   */
  private getFromCache(key: string): LLMResponse | undefined {
    const cached = this.responseCache.get(key)
    if (!cached) {
      return undefined
    }

    // 检查是否过期
    const now = Date.now()
    if (now - cached.timestamp > this.config.cacheTTL) {
      this.responseCache.delete(key)
      return undefined
    }

    // 更新命中统计
    cached.hitCount++

    return cached.response
  }

  /**
   * 设置缓存
   */
  private setToCache(key: string, response: LLMResponse): void {
    // 检查缓存大小限制
    if (this.responseCache.size >= this.config.cacheMaxSize) {
      // 删除最少使用的缓存项
      let minHitCount = Infinity
      let minKey: string | undefined

      for (const [k, v] of this.responseCache.entries()) {
        if (v.hitCount < minHitCount) {
          minHitCount = v.hitCount
          minKey = k
        }
      }

      if (minKey) {
        this.responseCache.delete(minKey)
      }
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now(),
      hitCount: 0,
    })
  }

  /**
   * 生成缓存键（使用加密级哈希防止冲突）
   */
  private generateCacheKey(
    messages: LLMMessage[],
    temperature?: number,
    maxTokens?: number
  ): string {
    const key = JSON.stringify({ messages, temperature, maxTokens })
    // 使用 SHA-256 哈希算法生成缓存键，取前16个字符
    return createHash('sha256').update(key).digest('hex').substring(0, 16)
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.responseCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.debug('清理过期缓存', {
        cleaned,
        remaining: this.responseCache.size,
      })
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.responseCache.clear()
    this.logger.debug('缓存已清空')
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.responseCache.size,
      cacheHitRate:
        this.stats.cacheHits + this.stats.cacheMisses > 0
          ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
          : 0,
      avgBatchSize:
        this.stats.batchesProcessed > 0
          ? this.stats.totalRequestsBatched / this.stats.batchesProcessed
          : 0,
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.perfMonitor.getAllStats()
  }

  /**
   * 打印性能报告
   */
  printPerformanceReport() {
    this.perfMonitor.printReport()
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    // 清理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // 清空缓存
    this.responseCache.clear()

    // 清空批处理队列
    this.batchQueue = []

    this.logger.info('LLMOptimizer 资源已销毁')
  }
}

/**
 * 创建 LLM 优化器的便捷函数
 */
export function createLLMOptimizer(llm: LLMAdapter, config?: LLMOptimizerConfig): LLMOptimizer {
  return new LLMOptimizer(llm, config)
}
