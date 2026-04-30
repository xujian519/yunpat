/**
 * 批量推理处理器
 *
 * 优化大批量推理的并发处理
 *
 * @module reasoning/ReasoningBatchProcessor
 */

import { ReasoningCache } from './ReasoningCache.js';
import { reasoningMonitor } from './ReasoningMonitor.js';

export interface BatchProcessConfig {
  /** 并发数 */
  concurrency: number;

  /** 失败重试次数 */
  maxRetries: number;

  /** 超时时间（毫秒） */
  timeout: number;

  /** 是否使用缓存 */
  useCache: boolean;

  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void;
}

export interface BatchResult<TInput, TResult> {
  /** 输入 */
  input: TInput;

  /** 结果 */
  result?: TResult;

  /** 错误 */
  error?: Error;

  /** 索引 */
  index: number;

  /** 耗时（毫秒） */
  duration: number;

  /** Token 消耗 */
  tokensUsed: number;

  /** 是否来自缓存 */
  fromCache: boolean;
}

/**
 * 批量推理处理器
 */
export class ReasoningBatchProcessor<TInput = any, TResult = any> {
  private cache?: ReasoningCache<TResult>;
  private config: BatchProcessConfig;

  constructor(config?: Partial<BatchProcessConfig>, cache?: ReasoningCache<TResult>) {
    this.config = {
      concurrency: 5,
      maxRetries: 2,
      timeout: 30000,
      useCache: !!cache,
      onProgress: undefined,
      ...config,
    };

    this.cache = cache;
  }

  /**
   * 批量处理（并发）
   *
   * @param inputs 输入数组
   * @param processFn 处理函数
   * @param getCacheKey 获取缓存键的函数
   * @returns 结果数组
   */
  async processBatch(
    inputs: TInput[],
    processFn: (input: TInput) => Promise<TResult>,
    getCacheKey?: (input: TInput) => string
  ): Promise<BatchResult<TInput, TResult>[]> {
    const results: BatchResult<TInput, TResult>[] = [];
    let completed = 0;

    // 创建并发队列
    const queue = inputs.map((input, index) => ({
      input,
      index,
      key: getCacheKey ? getCacheKey(input) : undefined,
    }));

    // 处理每个任务
    const processTask = async (
      task: { input: TInput; index: number; key?: string }
    ): Promise<BatchResult<TInput, TResult>> => {
      const startTime = Date.now();
      const monitorId = reasoningMonitor.startInference('batch-process', {
        index: task.index,
      });

      try {
        let result: TResult | undefined;
        let tokensUsed = 0;
        let fromCache = false;

        // 尝试从缓存获取
        if (this.config.useCache && this.cache && task.key) {
          const cached = await this.cache.query(task.key);
          if (cached.found && cached.result) {
            result = cached.result;
            fromCache = true;
            tokensUsed = 0; // 缓存命中不消耗 Token
          }
        }

        // 如果缓存未命中，执行处理
        if (!fromCache) {
          // 添加超时
          const processedResult = await Promise.race([
            processFn(task.input),
            new Promise<TResult>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
            ),
          ]) as TResult;

          result = processedResult;
          tokensUsed = this.estimateTokens(task.input);

          // 存储到缓存
          if (this.config.useCache && this.cache && task.key) {
            await this.cache.store(task.key, result, tokensUsed);
          }
        }

        const duration = Date.now() - startTime;
        reasoningMonitor.endInference(monitorId, tokensUsed, true);

        return {
          input: task.input,
          result: result!, // TypeScript: result 此时一定已定义
          index: task.index,
          duration,
          tokensUsed,
          fromCache,
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        reasoningMonitor.endInference(monitorId, 0, false, (error as Error).message);

        return {
          input: task.input,
          error: error as Error,
          index: task.index,
          duration,
          tokensUsed: 0,
          fromCache: false,
        };
      }
    };

    // 并发执行
    const executing: Promise<BatchResult<TInput, TResult>>[] = [];

    for (const task of queue) {
      const promise = processTask(task).then((result) => {
        completed++;
        if (this.config.onProgress) {
          this.config.onProgress(completed, inputs.length);
        }
        return result;
      });

      executing.push(promise);

      // 控制并发数
      if (executing.length >= this.config.concurrency) {
        await Promise.race(executing);
        // 移除已完成的
        const settled = await Promise.allSettled(executing);
        executing.length = 0;
      }
    }

    // 等待所有任务完成
    const settled = await Promise.allSettled(executing);

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      }
    }

    // 按原始顺序排序
    results.sort((a, b) => a.index - b.index);

    return results;
  }

  /**
   * 批量处理（带重试）
   */
  async processBatchWithRetry(
    inputs: TInput[],
    processFn: (input: TInput) => Promise<TResult>,
    getCacheKey?: (input: TInput) => string
  ): Promise<BatchResult<TInput, TResult>[]> {
    const results: BatchResult<TInput, TResult>[] = [];
    let completed = 0;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      let lastError: Error | undefined;

      // 重试逻辑
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const startTime = Date.now();
          const monitorId = reasoningMonitor.startInference('batch-retry', {
            index: i,
            attempt,
          });

          let result: TResult | undefined;
          let tokensUsed = 0;
          let fromCache = false;

          // 尝试缓存
          const key = getCacheKey ? getCacheKey(input) : undefined;
          if (this.config.useCache && this.cache && key) {
            const cached = await this.cache.query(key);
            if (cached.found && cached.result) {
              result = cached.result;
              fromCache = true;
            }
          }

          // 执行处理
          if (!fromCache) {
            const processedResult = await processFn(input);
            result = processedResult;
            tokensUsed = this.estimateTokens(input);

            if (this.config.useCache && this.cache && key) {
              await this.cache.store(key, result, tokensUsed);
            }
          }

          const duration = Date.now() - startTime;
          reasoningMonitor.endInference(monitorId, tokensUsed, true);

          results.push({
            input,
            result: result!, // TypeScript: result 此时一定已定义
            index: i,
            duration,
            tokensUsed,
            fromCache,
          });

          break; // 成功，跳出重试循环

        } catch (error) {
          lastError = error as Error;
          if (attempt === this.config.maxRetries) {
            // 最后一次尝试失败
            results.push({
              input,
              error: lastError,
              index: i,
              duration: 0,
              tokensUsed: 0,
              fromCache: false,
            });
          }
        }
      }

      completed++;
      if (this.config.onProgress) {
        this.config.onProgress(completed, inputs.length);
      }
    }

    return results;
  }

  /**
   * 估算 Token 消耗
   * TODO: 可以实现更精确的估算
   */
  private estimateTokens(input: TInput): number {
    if (typeof input === 'string') {
      // 粗略估算：1 Token ≈ 4 字符（中文）或 0.75 个单词（英文）
      const isChinese = /[一-龥]/.test(input);
      return isChinese ? Math.ceil(input.length / 2) : Math.ceil(input.length / 4);
    }

    if (typeof input === 'object') {
      return JSON.stringify(input).length / 4;
    }

    return 100; // 默认值
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(results: BatchResult<TInput, TResult>[]): {
    totalDuration: number;
    avgDuration: number;
    successRate: number;
    cacheHitRate: number;
    totalTokens: number;
    tokensSaved: number;
  } {
    const successful = results.filter(r => !r.error);
    const fromCache = results.filter(r => r.fromCache);

    return {
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      successRate: successful.length / results.length,
      cacheHitRate: fromCache.length / results.length,
      totalTokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
      tokensSaved: fromCache.reduce((sum, r) => sum + r.tokensUsed, 0), // 实际上应该计算节省的 Token
    };
  }
}

/**
 * 创建批量处理器（便捷函数）
 */
export function createBatchProcessor<TInput = any, TResult = any>(
  config?: Partial<BatchProcessConfig>,
  cache?: ReasoningCache<TResult>
): ReasoningBatchProcessor<TInput, TResult> {
  return new ReasoningBatchProcessor<TInput, TResult>(config, cache);
}
