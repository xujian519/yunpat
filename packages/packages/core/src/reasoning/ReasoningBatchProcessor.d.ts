/**
 * 批量推理处理器
 *
 * 优化大批量推理的并发处理
 *
 * @module reasoning/ReasoningBatchProcessor
 */
import { ReasoningCache } from './ReasoningCache.js'
export interface BatchProcessConfig {
  /** 并发数 */
  concurrency: number
  /** 失败重试次数 */
  maxRetries: number
  /** 超时时间（毫秒） */
  timeout: number
  /** 是否使用缓存 */
  useCache: boolean
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void
  /** 最大 Token 限制（用于优化批次大小） */
  maxTokens?: number
  /** 最大批处理大小 */
  maxBatchSize?: number
  /** 是否启用动态批次调整 */
  enableDynamicBatching?: boolean
  /** 模型名称（用于精确 Token 计数） */
  modelName?: string
}
export interface BatchResult<TInput, TResult> {
  /** 输入 */
  input: TInput
  /** 结果 */
  result?: TResult
  /** 错误 */
  error?: Error
  /** 索引 */
  index: number
  /** 耗时（毫秒） */
  duration: number
  /** Token 消耗 */
  tokensUsed: number
  /** 是否来自缓存 */
  fromCache: boolean
}
/**
 * 批量推理处理器
 */
export declare class ReasoningBatchProcessor<TInput = any, TResult = any> {
  private cache?
  private config
  private tokenCounter
  private batchOptimizer?
  constructor(config?: Partial<BatchProcessConfig>, cache?: ReasoningCache<TResult>)
  /**
   * 批量处理（并发）
   *
   * @param inputs 输入数组
   * @param processFn 处理函数
   * @param getCacheKey 获取缓存键的函数
   * @returns 结果数组
   */
  processBatch(
    inputs: TInput[],
    processFn: (input: TInput) => Promise<TResult>,
    getCacheKey?: (input: TInput) => string
  ): Promise<BatchResult<TInput, TResult>[]>
  /**
   * 批量处理（带重试）
   */
  processBatchWithRetry(
    inputs: TInput[],
    processFn: (input: TInput) => Promise<TResult>,
    getCacheKey?: (input: TInput) => string
  ): Promise<BatchResult<TInput, TResult>[]>
  /**
   * 估算 Token 消耗
   */
  private estimateTokens
  /**
   * 智能分批处理
   *
   * 根据输入内容动态调整批次大小
   *
   * @param inputs 输入数组
   * @param processFn 处理函数
   * @param getCacheKey 获取缓存键的函数
   * @returns 结果数组
   */
  processBatchSmart(
    inputs: TInput[],
    processFn: (input: TInput) => Promise<TResult>,
    getCacheKey?: (input: TInput) => string
  ): Promise<BatchResult<TInput, TResult>[]>
  /**
   * 将输入转换为文本（用于 Token 估算）
   */
  private inputToText
  /**
   * 获取批处理统计信息
   *
   * @param inputs 输入数组
   * @returns 统计信息
   */
  getBatchStatistics(inputs: TInput[]): {
    totalItems: number
    totalTokens: number
    avgTokensPerItem: number
    maxTokensPerItem: number
    minTokensPerItem: number
    recommendedBatchSize: number
  }
  /**
   * 获取性能统计
   */
  getPerformanceStats(results: BatchResult<TInput, TResult>[]): {
    totalDuration: number
    avgDuration: number
    successRate: number
    cacheHitRate: number
    totalTokens: number
    tokensSaved: number
  }
}
/**
 * 创建批量处理器（便捷函数）
 */
export declare function createBatchProcessor<TInput = any, TResult = any>(
  config?: Partial<BatchProcessConfig>,
  cache?: ReasoningCache<TResult>
): ReasoningBatchProcessor<TInput, TResult>
//# sourceMappingURL=ReasoningBatchProcessor.d.ts.map
