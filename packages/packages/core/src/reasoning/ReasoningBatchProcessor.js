/**
 * 批量推理处理器
 *
 * 优化大批量推理的并发处理
 *
 * @module reasoning/ReasoningBatchProcessor
 */
import { reasoningMonitor } from './ReasoningMonitor.js'
import { tokenCounter as defaultTokenCounter } from '../llm/tokenization/TokenCounter.js'
import { createBatchProcessorOptimizer } from '../llm/tokenization/BatchProcessorOptimizer.js'
/**
 * 批量推理处理器
 */
export class ReasoningBatchProcessor {
  cache
  config
  tokenCounter
  batchOptimizer
  constructor(config, cache) {
    this.config = {
      concurrency: 5,
      maxRetries: 2,
      timeout: 30000,
      useCache: !!cache,
      onProgress: undefined,
      maxTokens: 4000,
      maxBatchSize: 20,
      enableDynamicBatching: true,
      modelName: 'gpt-3.5-turbo',
      ...config,
    }
    this.cache = cache
    this.tokenCounter = defaultTokenCounter
    // 如果启用动态批次调整，初始化批处理器优化器
    if (this.config.enableDynamicBatching && this.config.maxTokens) {
      this.batchOptimizer = createBatchProcessorOptimizer(
        {
          maxTokens: this.config.maxTokens,
          maxBatchSize: this.config.maxBatchSize || 20,
          enableDynamicAdjustment: true,
        },
        this.tokenCounter
      )
    }
  }
  /**
   * 批量处理（并发）
   *
   * @param inputs 输入数组
   * @param processFn 处理函数
   * @param getCacheKey 获取缓存键的函数
   * @returns 结果数组
   */
  async processBatch(inputs, processFn, getCacheKey) {
    const results = []
    let completed = 0
    // 创建并发队列
    const queue = inputs.map((input, index) => ({
      input,
      index,
      key: getCacheKey ? getCacheKey(input) : undefined,
    }))
    // 处理每个任务
    const processTask = async (task) => {
      const startTime = Date.now()
      const monitorId = reasoningMonitor.startInference('batch-process', {
        index: task.index,
      })
      try {
        let result
        let tokensUsed = 0
        let fromCache = false
        // 尝试从缓存获取
        if (this.config.useCache && this.cache && task.key) {
          const cached = await this.cache.query(task.key)
          if (cached.found && cached.result) {
            result = cached.result
            fromCache = true
            tokensUsed = 0 // 缓存命中不消耗 Token
          }
        }
        // 如果缓存未命中，执行处理
        if (!fromCache) {
          // 添加超时
          const processedResult = await Promise.race([
            processFn(task.input),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
            ),
          ])
          result = processedResult
          tokensUsed = this.estimateTokens(task.input)
          // 存储到缓存
          if (this.config.useCache && this.cache && task.key) {
            await this.cache.store(task.key, result, tokensUsed)
          }
        }
        const duration = Date.now() - startTime
        reasoningMonitor.endInference(monitorId, tokensUsed, true)
        return {
          input: task.input,
          result: result, // TypeScript: result 此时一定已定义
          index: task.index,
          duration,
          tokensUsed,
          fromCache,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        reasoningMonitor.endInference(monitorId, 0, false, error.message)
        return {
          input: task.input,
          error: error,
          index: task.index,
          duration,
          tokensUsed: 0,
          fromCache: false,
        }
      }
    }
    // 并发执行
    const executing = []
    for (const task of queue) {
      const promise = processTask(task).then((result) => {
        completed++
        if (this.config.onProgress) {
          this.config.onProgress(completed, inputs.length)
        }
        return result
      })
      executing.push(promise)
      // 控制并发数
      if (executing.length >= this.config.concurrency) {
        // 等待最快的任务完成
        await Promise.race(executing)
        // 移除已完成的任务
        const settled = await Promise.allSettled(executing)
        for (let i = executing.length - 1; i >= 0; i--) {
          const s = settled[i]
          if (s.status === 'fulfilled' || s.status === 'rejected') {
            // 这个任务已完成，从 executing 中移除并添加到 results
            executing.splice(i, 1)
            if (s.status === 'fulfilled') {
              results.push(s.value)
            }
          }
        }
      }
    }
    // 等待所有剩余任务完成
    const settled = await Promise.allSettled(executing)
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(s.value)
      }
    }
    // 按原始顺序排序
    results.sort((a, b) => a.index - b.index)
    return results
  }
  /**
   * 批量处理（带重试）
   */
  async processBatchWithRetry(inputs, processFn, getCacheKey) {
    const results = []
    let completed = 0
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      let lastError
      // 重试逻辑
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const startTime = Date.now()
          const monitorId = reasoningMonitor.startInference('batch-retry', {
            index: i,
            attempt,
          })
          let result
          let tokensUsed = 0
          let fromCache = false
          // 尝试缓存
          const key = getCacheKey ? getCacheKey(input) : undefined
          if (this.config.useCache && this.cache && key) {
            const cached = await this.cache.query(key)
            if (cached.found && cached.result) {
              result = cached.result
              fromCache = true
            }
          }
          // 执行处理
          if (!fromCache) {
            const processedResult = await processFn(input)
            result = processedResult
            tokensUsed = this.estimateTokens(input)
            if (this.config.useCache && this.cache && key) {
              await this.cache.store(key, result, tokensUsed)
            }
          }
          const duration = Date.now() - startTime
          reasoningMonitor.endInference(monitorId, tokensUsed, true)
          results.push({
            input,
            result: result, // TypeScript: result 此时一定已定义
            index: i,
            duration,
            tokensUsed,
            fromCache,
          })
          break // 成功，跳出重试循环
        } catch (error) {
          lastError = error
          if (attempt === this.config.maxRetries) {
            // 最后一次尝试失败
            results.push({
              input,
              error: lastError,
              index: i,
              duration: 0,
              tokensUsed: 0,
              fromCache: false,
            })
          }
        }
      }
      completed++
      if (this.config.onProgress) {
        this.config.onProgress(completed, inputs.length)
      }
    }
    return results
  }
  /**
   * 估算 Token 消耗
   */
  estimateTokens(input) {
    if (typeof input === 'string') {
      // 使用 Token 计数器进行精确估算
      return this.tokenCounter.estimateTokens(input, this.config.modelName || 'gpt-3.5-turbo')
    }
    if (typeof input === 'object') {
      const jsonString = JSON.stringify(input)
      return this.tokenCounter.estimateTokens(jsonString, this.config.modelName || 'gpt-3.5-turbo')
    }
    return 100 // 默认值
  }
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
  async processBatchSmart(inputs, processFn, getCacheKey) {
    // 如果未启用动态批次调整，回退到普通批处理
    if (!this.batchOptimizer) {
      return this.processBatch(inputs, processFn, getCacheKey)
    }
    // 将输入转换为文本（用于 Token 估算）
    const texts = inputs.map((input) => this.inputToText(input))
    // 使用智能分批
    const modelName = this.config.modelName || 'gpt-3.5-turbo'
    const optimizationResult = this.batchOptimizer.smartPartition(texts, modelName)
    console.log(
      `[ReasoningBatchProcessor] 智能分批: ${inputs.length}个任务分为${optimizationResult.totalBatches}批`
    )
    console.log(
      `[ReasoningBatchProcessor] 平均批次大小: ${optimizationResult.averageBatchSize.toFixed(2)}`
    )
    console.log(`[ReasoningBatchProcessor] 总Token数: ${optimizationResult.totalTokens}`)
    // 按批次处理
    const allResults = []
    let processedCount = 0
    for (let i = 0; i < optimizationResult.batches.length; i++) {
      const batch = optimizationResult.batches[i]
      const startIndex = processedCount
      const endIndex = processedCount + batch.length
      const batchInputs = inputs.slice(startIndex, endIndex)
      // 处理当前批次
      const batchResults = await this.processBatch(batchInputs, processFn, getCacheKey)
      allResults.push(...batchResults)
      processedCount = endIndex
      // 更新进度
      if (this.config.onProgress) {
        this.config.onProgress(processedCount, inputs.length)
      }
    }
    return allResults
  }
  /**
   * 将输入转换为文本（用于 Token 估算）
   */
  inputToText(input) {
    if (typeof input === 'string') {
      return input
    }
    if (typeof input === 'object') {
      return JSON.stringify(input)
    }
    return String(input)
  }
  /**
   * 获取批处理统计信息
   *
   * @param inputs 输入数组
   * @returns 统计信息
   */
  getBatchStatistics(inputs) {
    const texts = inputs.map((input) => this.inputToText(input))
    const modelName = this.config.modelName || 'gpt-3.5-turbo'
    const tokenCounts = this.tokenCounter.estimateTokensBatch(texts, modelName)
    const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0)
    const recommendedBatchSize = this.batchOptimizer
      ? this.batchOptimizer.calculateOptimalBatchSize(texts, modelName)
      : Math.min(this.config.maxBatchSize || 20, inputs.length)
    return {
      totalItems: inputs.length,
      totalTokens,
      avgTokensPerItem: totalTokens / inputs.length,
      maxTokensPerItem: Math.max(...tokenCounts),
      minTokensPerItem: Math.min(...tokenCounts),
      recommendedBatchSize,
    }
  }
  /**
   * 获取性能统计
   */
  getPerformanceStats(results) {
    const successful = results.filter((r) => !r.error)
    const fromCache = results.filter((r) => r.fromCache)
    return {
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      successRate: successful.length / results.length,
      cacheHitRate: fromCache.length / results.length,
      totalTokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
      tokensSaved: fromCache.reduce((sum, r) => sum + r.tokensUsed, 0), // 实际上应该计算节省的 Token
    }
  }
}
/**
 * 创建批量处理器（便捷函数）
 */
export function createBatchProcessor(config, cache) {
  return new ReasoningBatchProcessor(config, cache)
}
//# sourceMappingURL=ReasoningBatchProcessor.js.map
