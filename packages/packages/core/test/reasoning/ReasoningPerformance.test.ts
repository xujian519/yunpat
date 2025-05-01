/**
 * 推理引擎性能基准测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReasoningCache, createReasoningCache } from '../../src/reasoning/ReasoningCache.js'
import { ReasoningMonitor, reasoningMonitor } from '../../src/reasoning/ReasoningMonitor.js'
import {
  ReasoningBatchProcessor,
  createBatchProcessor,
} from '../../src/reasoning/ReasoningBatchProcessor.js'
import type { CoTResult } from '../../src/reasoning/ChainOfThoughtStrategy.js'

// ========== 推理缓存测试 ==========

describe('ReasoningCache', () => {
  let cache: ReasoningCache<any>

  beforeEach(() => {
    cache = createReasoningCache({
      maxEntries: 10,
      similarityThreshold: 0.8,
      ttl: 1000,
      enableEmbedding: false,
    })
  })

  describe('基础缓存功能', () => {
    it('应该存储和检索结果', async () => {
      const problem = '如何优化专利审查流程？'
      const result: CoTResult = {
        steps: [],
        conclusion: '优化方案',
        confidence: 0.9,
        summary: '摘要',
        tokensUsed: 100,
        duration: 100,
      }

      await cache.store(problem, result, 100)

      const queryResult = await cache.query(problem)

      expect(queryResult.found).toBe(true)
      expect(queryResult.result).toEqual(result)
      expect(queryResult.similarity).toBe(1)
    })

    it('应该返回未命中当查询不存在的问题', async () => {
      const result = await cache.query('不存在的问题')

      expect(result.found).toBe(false)
      expect(result.result).toBeUndefined()
    })

    it('应该找到完全相同的问题', async () => {
      const problem1 = '如何优化专利审查流程？'
      const problem2 = '如何优化专利审查流程？'

      const result: CoTResult = {
        steps: [],
        conclusion: '优化方案',
        confidence: 0.9,
        summary: '摘要',
        tokensUsed: 100,
        duration: 100,
      }

      await cache.store(problem1, result, 100)

      const queryResult = await cache.query(problem2)

      expect(queryResult.found).toBe(true)
      expect(queryResult.similarity).toBe(1)
    })
  })

  describe('缓存统计', () => {
    it('应该正确追踪缓存命中和未命中', async () => {
      const result = { data: 'test' }

      await cache.store('问题1', result, 100)
      await cache.store('问题2', result, 100)

      await cache.query('问题1')
      await cache.query('问题3')

      const stats = cache.getStats()

      expect(stats.totalEntries).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('应该计算节省的 Token', async () => {
      const result = { data: 'test' }

      await cache.store('问题1', result, 100)
      await cache.query('问题1')

      const stats = cache.getStats()

      expect(stats.tokensSaved).toBe(100)
    })
  })

  describe('LRU 驱逐', () => {
    it('应该在达到最大条目数时驱逐最少使用的条目', async () => {
      const smallCache = createReasoningCache({ maxEntries: 3 })

      // 添加小延迟确保 lastAccessedAt 不同
      await smallCache.store('问题1', { data: '1' }, 10)
      await new Promise((resolve) => setTimeout(resolve, 2))

      await smallCache.store('问题2', { data: '2' }, 10)
      await new Promise((resolve) => setTimeout(resolve, 2))

      await smallCache.store('问题3', { data: '3' }, 10)
      await new Promise((resolve) => setTimeout(resolve, 2))

      await smallCache.query('问题1') // 使问题1成为最近使用
      await new Promise((resolve) => setTimeout(resolve, 2))

      await smallCache.store('问题4', { data: '4' }, 10) // 应该驱逐问题2或问题3

      const stats = smallCache.getStats()
      expect(stats.totalEntries).toBe(3)

      // 问题1应该存在（最近被查询过）
      const result1 = await smallCache.query('问题1')
      expect(result1.found).toBe(true)

      // 问题4应该存在（刚存储的）
      const result4 = await smallCache.query('问题4')
      expect(result4.found).toBe(true)

      // 问题2或问题3应该被驱逐（最少使用的）
      const result2 = await smallCache.query('问题2')
      const result3 = await smallCache.query('问题3')

      // 至少一个应该被驱逐
      const 驱逐Count = [result2.found, result3.found].filter((f) => !f).length
      expect(驱逐Count).toBeGreaterThan(0)
    })
  })

  describe('TTL 过期', () => {
    it('应该清理过期的缓存条目', async () => {
      const shortCache = createReasoningCache({ ttl: 100 })

      await shortCache.store('问题1', { data: '1' }, 10)

      let result = await shortCache.query('问题1')
      expect(result.found).toBe(true)

      await new Promise((resolve) => setTimeout(resolve, 150))

      result = await shortCache.query('问题1')
      expect(result.found).toBe(false)
    })
  })
})

// ========== 性能监控测试 ==========

describe('ReasoningMonitor', () => {
  let monitor: ReasoningMonitor

  beforeEach(() => {
    monitor = new (class extends ReasoningMonitor {
      constructor() {
        super()
      }
    })()
  })

  describe('推理记录', () => {
    it('应该记录推理的开始和结束', () => {
      const id = monitor.startInference('test-type')

      expect(id).toBeDefined()

      monitor.endInference(id, 100, true)

      const metrics = monitor.getMetrics()

      expect(metrics.totalInferences).toBe(1)
    })

    it('应该计算平均耗时', () => {
      const id1 = monitor.startInference('type1')
      const id2 = monitor.startInference('type1')

      // 添加小延迟以确保时间差
      const start1 = Date.now()
      monitor.endInference(id1, 100, true)

      // 模拟一些处理时间
      const startTime1 = Date.now() - 100
      ;(monitor as any).records.get(id1).startTime = new Date(startTime1)

      const startTime2 = Date.now() - 200
      ;(monitor as any).records.get(id2).startTime = new Date(startTime2)
      monitor.endInference(id2, 200, true)

      const metrics = monitor.getMetrics()

      // 平均耗时应该大约是 (100 + 200) / 2 = 150
      expect(metrics.avgDuration).toBeGreaterThan(0)
      expect(metrics.avgDuration).toBeLessThan(500)
    })

    it('应该生成可读的性能报告', () => {
      const id = monitor.startInference('CoT', { test: true })
      monitor.endInference(id, 150, true)

      const report = monitor.exportReport()

      expect(report).toContain('推理性能报告')
      expect(report).toContain('CoT')
    })
  })
})

// ========== 批量处理测试 ==========

describe('ReasoningBatchProcessor', () => {
  describe('并发处理', () => {
    it('应该并发处理多个任务', async () => {
      const processor = createBatchProcessor({
        concurrency: 3,
        useCache: false,
      })

      const processFn = async (input: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { result: input.toUpperCase() }
      }

      const inputs = ['task1', 'task2', 'task3']

      const results = await processor.processBatch(inputs, processFn)

      expect(results).toHaveLength(3)
      results.forEach((r) => {
        expect(r.error).toBeUndefined()
        expect(r.result).toBeDefined()
      })
    })

    it('应该处理失败的任务', async () => {
      const processor = createBatchProcessor({ concurrency: 2 })

      const processFn = async (input: string) => {
        if (input === 'fail') {
          throw new Error('Task failed')
        }
        return { result: input }
      }

      const inputs = ['task1', 'fail', 'task3']

      const results = await processor.processBatch(inputs, processFn)

      expect(results).toHaveLength(3)
      expect(results[1].error).toBeDefined()
    })
  })

  describe('重试机制', () => {
    it('应该在失败时重试', async () => {
      const processor = createBatchProcessor({
        maxRetries: 2,
        concurrency: 1,
      })

      let attempts = 0
      const processFn = async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Not yet')
        }
        return { result: 'success' }
      }

      const results = await processor.processBatchWithRetry(['retry-task'], processFn)

      expect(results).toHaveLength(1)
      expect(results[0].result).toBeDefined()
      expect(attempts).toBe(3)
    })
  })

  describe('性能统计', () => {
    it('应该计算性能统计', async () => {
      const processor = createBatchProcessor({
        concurrency: 2,
        useCache: false,
      })

      const processFn = async (input: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { result: input }
      }

      const inputs = ['task1', 'task2', 'task3']

      const results = await processor.processBatch(inputs, processFn)

      const stats = processor.getPerformanceStats(results)

      expect(stats.totalDuration).toBeGreaterThan(0)
      expect(stats.successRate).toBe(1)
    })
  })
})
