/**
 * 批处理器优化器
 *
 * 提供动态批次大小计算和智能分批功能
 *
 * @module llm/tokenization/BatchProcessorOptimizer
 */
import { tokenCounter as defaultTokenCounter } from './TokenCounter.js'
/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  maxTokens: 4000,
  maxBatchSize: 20,
  safetyMargin: 0.2,
  enableDynamicAdjustment: true,
}
/**
 * 批处理器优化器
 */
export class BatchProcessorOptimizer {
  tokenCounter
  config
  history = []
  constructor(config, customTokenCounter) {
    this.tokenCounter = customTokenCounter || defaultTokenCounter
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  /**
   * 计算最优批次大小
   *
   * @param texts 输入文本列表
   * @param model 模型名称
   * @param maxBatchSize 最大批处理大小
   * @returns 最优批次大小
   */
  calculateOptimalBatchSize(texts, model, maxBatchSize) {
    const effectiveMaxBatchSize = maxBatchSize ?? this.config.maxBatchSize
    // 1. 估算每个文本的 Token 数
    const tokenCounts = this.tokenCounter.estimateTokensBatch(texts, model)
    // 2. 找到最大的 Token 数
    const maxTokensPerText = Math.max(...tokenCounts, 1)
    // 3. 计算理论上能容纳的最大数量
    const effectiveMaxTokens = this.config.maxTokens * (1 - this.config.safetyMargin)
    const theoreticalMax = Math.floor(effectiveMaxTokens / maxTokensPerText)
    // 4. 不超过最大批处理大小
    const optimalBatchSize = Math.min(theoreticalMax, effectiveMaxBatchSize)
    // 5. 至少为 1
    return Math.max(optimalBatchSize, 1)
  }
  /**
   * 将文本分批
   *
   * @param texts 输入文本列表
   * @param model 模型名称
   * @param maxBatchSize 最大批处理大小
   * @returns 分批结果
   */
  partitionIntoBatches(texts, model, maxBatchSize) {
    const effectiveMaxBatchSize = maxBatchSize ?? this.config.maxBatchSize
    const batches = []
    const currentBatch = []
    let currentTokens = 0
    const effectiveMaxTokens = this.config.maxTokens * (1 - this.config.safetyMargin)
    for (const text of texts) {
      const textTokens = this.tokenCounter.estimateTokens(text, model)
      // 检查是否超过最大 Token 限制
      if (textTokens > this.config.maxTokens) {
        throw new Error(`单个文本超过最大 Token 限制: ${textTokens} > ${this.config.maxTokens}`)
      }
      // 检查是否可以加入当前批次
      const wouldExceedTokenLimit = currentTokens + textTokens > effectiveMaxTokens
      const wouldExceedSizeLimit = currentBatch.length >= effectiveMaxBatchSize
      if (wouldExceedTokenLimit || wouldExceedSizeLimit) {
        // 开始新批次
        if (currentBatch.length > 0) {
          batches.push([...currentBatch])
        }
        currentBatch.length = 0
        currentTokens = 0
      }
      currentBatch.push(text)
      currentTokens += textTokens
    }
    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }
    // 计算统计信息
    const batchTokenCounts = batches.map((batch) =>
      this.tokenCounter.calculateTotalTokens(batch, model)
    )
    return {
      optimalBatchSize: effectiveMaxBatchSize,
      batches,
      totalBatches: batches.length,
      averageBatchSize: texts.length / batches.length,
      totalTokens: batchTokenCounts.reduce((sum, count) => sum + count, 0),
      maxBatchTokens: Math.max(...batchTokenCounts, 0),
      minBatchTokens: Math.min(...batchTokenCounts, 0),
    }
  }
  /**
   * 动态调整批次大小
   *
   * @param previousBatches 之前的批次
   * @param model 模型名称
   * @returns 调整后的批次大小建议
   */
  adjustBatchSize(previousBatches, model) {
    if (!this.config.enableDynamicAdjustment || previousBatches.length === 0) {
      return this.config.maxBatchSize
    }
    // 分析历史批次的 Token 使用情况
    const tokenUsages = previousBatches.map((batch) =>
      this.tokenCounter.calculateTotalTokens(batch, model)
    )
    const avgUsage = tokenUsages.reduce((a, b) => a + b, 0) / tokenUsages.length
    const maxUsage = Math.max(...tokenUsages)
    const currentBatchSize = previousBatches[0].length
    // 如果平均使用率 < 60%，可以增加批次大小
    if (avgUsage < this.config.maxTokens * 0.6) {
      const increase = Math.min(5, this.config.maxBatchSize - currentBatchSize)
      return currentBatchSize + increase
    }
    // 如果最大使用率 > 90%，需要减少批次大小
    if (maxUsage > this.config.maxTokens * 0.9) {
      const decrease = Math.min(5, currentBatchSize - 1)
      return Math.max(currentBatchSize - decrease, 1)
    }
    // 保持不变
    return currentBatchSize
  }
  /**
   * 智能分批（结合最优批次大小和动态调整）
   *
   * @param texts 输入文本列表
   * @param model 模型名称
   * @param maxBatchSize 最大批处理大小
   * @returns 优化后的分批结果
   */
  smartPartition(texts, model, maxBatchSize) {
    // 1. 计算最优批次大小
    const optimalBatchSize = this.calculateOptimalBatchSize(texts, model, maxBatchSize)
    // 2. 如果有历史记录，尝试动态调整
    let finalBatchSize = optimalBatchSize
    if (this.history.length > 0 && this.config.enableDynamicAdjustment) {
      const lastHistory = this.history[this.history.length - 1]
      if (lastHistory.model === model) {
        const adjustedSize = this.adjustBatchSize(lastHistory.batches, model)
        // 使用调整后的大小，但不超过最优大小
        finalBatchSize = Math.min(adjustedSize, optimalBatchSize)
      }
    }
    // 3. 使用最终批次大小进行分批
    const result = this.partitionIntoBatches(texts, model, finalBatchSize)
    // 4. 记录历史
    this.history.push({
      batches: result.batches,
      model,
      timestamp: Date.now(),
    })
    // 5. 限制历史记录大小
    if (this.history.length > 10) {
      this.history.shift()
    }
    return result
  }
  /**
   * 获取批次统计信息
   *
   * @param batches 批次列表
   * @param model 模型名称
   * @returns 统计信息
   */
  getBatchStatistics(batches, model) {
    const tokenCounts = batches.map((batch) => this.tokenCounter.calculateTotalTokens(batch, model))
    const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0)
    const avgTokensPerBatch = totalTokens / tokenCounts.length
    const variance =
      tokenCounts.reduce((sum, count) => sum + Math.pow(count - avgTokensPerBatch, 2), 0) /
      tokenCounts.length
    return {
      totalBatches: batches.length,
      totalItems: batches.reduce((sum, batch) => sum + batch.length, 0),
      totalTokens,
      avgTokensPerBatch,
      avgItemsPerBatch: batches.reduce((sum, batch) => sum + batch.length, 0) / batches.length,
      maxTokensPerBatch: Math.max(...tokenCounts),
      minTokensPerBatch: Math.min(...tokenCounts),
      tokenVariance: variance,
    }
  }
  /**
   * 验证批次是否合理
   *
   * @param batches 批次列表
   * @param model 模型名称
   * @returns 验证结果
   */
  validateBatches(batches, model) {
    const errors = []
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchTokens = this.tokenCounter.calculateTotalTokens(batch, model)
      // 检查批次大小
      if (batch.length > this.config.maxBatchSize) {
        errors.push(`批次 ${i}: 大小 ${batch.length} 超过最大限制 ${this.config.maxBatchSize}`)
      }
      // 检查 Token 限制
      if (batchTokens > this.config.maxTokens) {
        errors.push(`批次 ${i}: Token 数 ${batchTokens} 超过最大限制 ${this.config.maxTokens}`)
      }
    }
    return {
      valid: errors.length === 0,
      errors,
    }
  }
  /**
   * 更新配置
   *
   * @param config 新配置
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config }
  }
  /**
   * 获取当前配置
   *
   * @returns 当前配置
   */
  getConfig() {
    return { ...this.config }
  }
  /**
   * 清空历史记录
   */
  clearHistory() {
    this.history = []
  }
  /**
   * 获取历史记录
   *
   * @returns 历史记录
   */
  getHistory() {
    return [...this.history]
  }
}
/**
 * 创建批处理器优化器（便捷函数）
 *
 * @param config 可选配置
 * @param customTokenCounter 可选 Token 计数器
 * @returns 批处理器优化器实例
 */
export function createBatchProcessorOptimizer(config, customTokenCounter) {
  return new BatchProcessorOptimizer(config, customTokenCounter)
}
/**
 * 默认批处理器优化器实例
 */
export const batchProcessorOptimizer = createBatchProcessorOptimizer()
//# sourceMappingURL=BatchProcessorOptimizer.js.map
