import { describe, it, expect } from 'vitest'
import {
  ReasoningBatchProcessor,
  createBatchProcessor,
} from '../../src/reasoning/ReasoningBatchProcessor.js'

describe('ReasoningBatchProcessor', () => {
  it('应该创建处理器', () => {
    const processor = new ReasoningBatchProcessor()
    expect(processor).toBeDefined()
  })

  it('应该处理空批次', async () => {
    const processor = new ReasoningBatchProcessor()
    const results = await processor.processBatch([], async (x) => x)
    expect(results).toEqual([])
  })

  it('应该处理批次', async () => {
    const processor = new ReasoningBatchProcessor({ concurrency: 2 })
    const results = await processor.processBatch([1, 2, 3], async (x) => x * 2)
    expect(results).toHaveLength(3)
    expect(results[0].result).toBe(2)
  })

  it('应该处理错误', async () => {
    const processor = new ReasoningBatchProcessor({ concurrency: 1 })
    const results = await processor.processBatch([1, 2], async (x) => {
      if (x === 2) throw new Error('fail')
      return x
    })
    expect(results[1].error).toBeDefined()
  })

  it('应该使用缓存', async () => {
    const cache = {
      query: async () => ({ found: true, result: 'cached', similarity: 1 }),
      store: async () => {},
      getStats: () => ({
        totalEntries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        tokensSaved: 0,
        totalTokens: 0,
        avgSimilarity: 0,
      }),
    } as any

    const processor = new ReasoningBatchProcessor({ useCache: true }, cache)
    const results = await processor.processBatch(
      ['a'],
      async (x) => x,
      (x) => x
    )
    expect(results[0].fromCache).toBe(true)
    expect(results[0].result).toBe('cached')
  })

  it('应该处理带重试', async () => {
    const processor = new ReasoningBatchProcessor({ maxRetries: 1, concurrency: 1 })
    let count = 0
    const results = await processor.processBatchWithRetry([1], async (x) => {
      count++
      if (count === 1) throw new Error('fail')
      return x * 2
    })
    expect(results[0].result).toBe(2)
  })

  it('应该在重试后仍失败', async () => {
    const processor = new ReasoningBatchProcessor({ maxRetries: 0, concurrency: 1 })
    const results = await processor.processBatchWithRetry([1], async () => {
      throw new Error('fail')
    })
    expect(results[0].error).toBeDefined()
  })

  it('应该获取批次统计', () => {
    const processor = new ReasoningBatchProcessor()
    const stats = processor.getBatchStatistics(['hello', 'world'])
    expect(stats.totalItems).toBe(2)
    expect(stats.totalTokens).toBeGreaterThan(0)
  })

  it('应该获取性能统计', async () => {
    const processor = new ReasoningBatchProcessor({ concurrency: 1 })
    const results = await processor.processBatch([1], async (x) => x)
    const stats = processor.getPerformanceStats(results)
    expect(stats.successRate).toBe(1)
    expect(stats.totalDuration).toBeGreaterThanOrEqual(0)
  })

  it('应该使用智能分批', async () => {
    const processor = new ReasoningBatchProcessor({ enableDynamicBatching: true })
    const results = await processor.processBatchSmart([1, 2], async (x) => x * 2)
    expect(results).toHaveLength(2)
  })

  it('应该在无优化器时回退', async () => {
    const processor = new ReasoningBatchProcessor({ enableDynamicBatching: false })
    const results = await processor.processBatchSmart([1], async (x) => x)
    expect(results).toHaveLength(1)
  })

  it('应该使用便捷函数创建', () => {
    const processor = createBatchProcessor()
    expect(processor).toBeDefined()
  })
})
