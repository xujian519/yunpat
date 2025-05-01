/**
 * 批处理器优化器
 *
 * 提供动态批次大小计算和智能分批功能
 *
 * @module llm/tokenization/BatchProcessorOptimizer
 */
import { TokenCounter } from './TokenCounter.js'
/**
 * 批次信息
 */
export interface BatchInfo {
  /** 批次索引 */
  index: number
  /** 批次内容 */
  items: string[]
  /** 批次 Token 总数 */
  totalTokens: number
  /** 批次大小 */
  size: number
}
/**
 * 批次优化结果
 */
export interface BatchOptimizationResult {
  /** 最优批次大小 */
  optimalBatchSize: number
  /** 批次列表 */
  batches: string[][]
  /** 总批次数 */
  totalBatches: number
  /** 平均批次大小 */
  averageBatchSize: number
  /** 总 Token 数 */
  totalTokens: number
  /** 最大批次 Token 数 */
  maxBatchTokens: number
  /** 最小批次 Token 数 */
  minBatchTokens: number
}
/**
 * 批次优化器配置
 */
export interface BatchOptimizerConfig {
  /** 最大 Token 限制 */
  maxTokens: number
  /** 最大批处理大小 */
  maxBatchSize: number
  /** 安全边际（0-1，默认 0.2） */
  safetyMargin: number
  /** 是否启用动态调整 */
  enableDynamicAdjustment: boolean
}
/**
 * 批处理器优化器
 */
export declare class BatchProcessorOptimizer {
  private tokenCounter
  private config
  private history
  constructor(config?: Partial<BatchOptimizerConfig>, customTokenCounter?: TokenCounter)
  /**
   * 计算最优批次大小
   *
   * @param texts 输入文本列表
   * @param model 模型名称
   * @param maxBatchSize 最大批处理大小
   * @returns 最优批次大小
   */
  calculateOptimalBatchSize(texts: string[], model: string, maxBatchSize?: number): number
  /**
   * 将文本分批
   *
   * @param texts 输入文本列表
   * @param model 模型名称
   * @param maxBatchSize 最大批处理大小
   * @returns 分批结果
   */
  partitionIntoBatches(
    texts: string[],
    model: string,
    maxBatchSize?: number
  ): BatchOptimizationResult
  /**
   * 动态调整批次大小
   *
   * @param previousBatches 之前的批次
   * @param model 模型名称
   * @returns 调整后的批次大小建议
   */
  adjustBatchSize(previousBatches: string[][], model: string): number
  /**
   * 智能分批（结合最优批次大小和动态调整）
   *
   * @param texts 输入文本列表
   * @param model 模型名称
   * @param maxBatchSize 最大批处理大小
   * @returns 优化后的分批结果
   */
  smartPartition(texts: string[], model: string, maxBatchSize?: number): BatchOptimizationResult
  /**
   * 获取批次统计信息
   *
   * @param batches 批次列表
   * @param model 模型名称
   * @returns 统计信息
   */
  getBatchStatistics(
    batches: string[][],
    model: string
  ): {
    totalBatches: number
    totalItems: number
    totalTokens: number
    avgTokensPerBatch: number
    avgItemsPerBatch: number
    maxTokensPerBatch: number
    minTokensPerBatch: number
    tokenVariance: number
  }
  /**
   * 验证批次是否合理
   *
   * @param batches 批次列表
   * @param model 模型名称
   * @returns 验证结果
   */
  validateBatches(
    batches: string[][],
    model: string
  ): {
    valid: boolean
    errors: string[]
  }
  /**
   * 更新配置
   *
   * @param config 新配置
   */
  updateConfig(config: Partial<BatchOptimizerConfig>): void
  /**
   * 获取当前配置
   *
   * @returns 当前配置
   */
  getConfig(): BatchOptimizerConfig
  /**
   * 清空历史记录
   */
  clearHistory(): void
  /**
   * 获取历史记录
   *
   * @returns 历史记录
   */
  getHistory(): Array<{
    batches: string[][]
    model: string
    timestamp: number
  }>
}
/**
 * 创建批处理器优化器（便捷函数）
 *
 * @param config 可选配置
 * @param customTokenCounter 可选 Token 计数器
 * @returns 批处理器优化器实例
 */
export declare function createBatchProcessorOptimizer(
  config?: Partial<BatchOptimizerConfig>,
  customTokenCounter?: TokenCounter
): BatchProcessorOptimizer
/**
 * 默认批处理器优化器实例
 */
export declare const batchProcessorOptimizer: BatchProcessorOptimizer
//# sourceMappingURL=BatchProcessorOptimizer.d.ts.map
