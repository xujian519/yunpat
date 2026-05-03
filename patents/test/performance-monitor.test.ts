/**
 * performance-monitor.test.ts - 性能监控测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PerformanceMonitor } from '../core/performance-monitor.js'

describe('performance-monitor - 基础功能', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    monitor.clear()
  })

  it('应该测量操作时间', async () => {
    const result = await monitor.measure('test-operation', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return 'done'
    })

    expect(result).toBe('done')

    const stats = monitor.getStats('test-operation')
    expect(stats).toBeDefined()
    expect(stats?.count).toBe(1)
  })

  it('应该处理测量中的错误', async () => {
    await expect(
      monitor.measure('failing-operation', async () => {
        throw new Error('测试错误')
      })
    ).rejects.toThrow('测试错误')

    // 错误也会被记录
    const stats = monitor.getStats('failing-operation')
    expect(stats).toBeDefined()
  })

  it('应该获取统计信息', async () => {
    await monitor.measure('test', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const stats = monitor.getStats('test')

    expect(stats).toBeDefined()
    expect(stats?.count).toBe(1)
    expect(stats?.min).toBeGreaterThan(0)
    expect(stats?.max).toBeGreaterThan(0)
    expect(stats?.avg).toBeGreaterThan(0)
  })

  it('应该清除统计信息', async () => {
    await monitor.measure('test', async () => 'result')
    monitor.clear('test')

    const stats = monitor.getStats('test')
    expect(stats).toBeUndefined()
  })

  it('应该获取所有统计信息', async () => {
    await monitor.measure('op1', async () => 'result1')
    await monitor.measure('op2', async () => 'result2')

    const allStats = monitor.getAllStats()

    expect(allStats).toHaveProperty('op1')
    expect(allStats).toHaveProperty('op2')
  })

  it('应该生成报告', async () => {
    await monitor.measure('test', async () => 'result')

    const report = monitor.generateReport()

    expect(report).toBeDefined()
    expect(Object.keys(report.operations)).toContain('test')
  })
})

describe('performance-monitor - start/end方法', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    monitor.clear()
  })

  it('应该使用start/end方法测量操作', () => {
    const end = monitor.start('manual-operation')

    // 模拟一些工作
    const sum = Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0)

    end()

    const stats = monitor.getStats('manual-operation')
    expect(stats).toBeDefined()
    expect(stats?.count).toBe(1)
  })

  it('应该支持元数据', () => {
    const end = monitor.start('operation-with-metadata', { key: 'value' })

    // 模拟工作
    const result = 1 + 1

    end()

    const stats = monitor.getStats('operation-with-metadata')
    expect(stats).toBeDefined()
  })
})

describe('performance-monitor - 慢操作检测', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    monitor.clear()
  })

  it('应该检测慢操作', async () => {
    await monitor.measure('fast-operation', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    await monitor.measure('slow-operation', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // 使用50ms作为阈值
    const slowOps = monitor.getSlowOperations(50)
    expect(slowOps.length).toBeGreaterThan(0)
    expect(slowOps[0].operation).toBe('slow-operation')
  })

  it('应该返回空的慢操作列表', async () => {
    await monitor.measure('fast-operation', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    const slowOps = monitor.getSlowOperations(100)
    expect(slowOps.length).toBe(0)
  })
})

describe('performance-monitor - 同步测量', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    monitor.clear()
  })

  it('应该测量同步操作', () => {
    const result = monitor.measureSync('sync-op', () => {
      return 42
    })

    expect(result).toBe(42)

    const stats = monitor.getStats('sync-op')
    expect(stats).toBeDefined()
  })

  it('应该处理同步操作中的错误', () => {
    expect(() => {
      monitor.measureSync('failing-sync-op', () => {
        throw new Error('同步错误')
      })
    }).toThrow('同步错误')

    const stats = monitor.getStats('failing-sync-op')
    expect(stats).toBeDefined()
  })
})

describe('performance-monitor - 边界情况', () => {
  it('应该处理非常快的操作', async () => {
    const monitor = new PerformanceMonitor()

    await monitor.measure('instant', async () => 'result')

    const stats = monitor.getStats('instant')
    expect(stats?.avg).toBeGreaterThanOrEqual(0)

    monitor.clear()
  })

  it('应该处理空操作名称', async () => {
    const monitor = new PerformanceMonitor()

    await expect(
      monitor.measure('', async () => 'result')
    ).resolves.toBe('result')

    monitor.clear()
  })

  it('应该处理多次相同操作', async () => {
    const monitor = new PerformanceMonitor()

    for (let i = 0; i < 10; i++) {
      await monitor.measure('repeated', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }

    const stats = monitor.getStats('repeated')
    expect(stats?.count).toBe(10)

    monitor.clear()
  })
})

describe('performance-monitor - 性能测试', () => {
  it('监控开销应该很小', async () => {
    const monitor = new PerformanceMonitor()

    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      await monitor.measure(`op-${i}`, async () => {
        return i
      })
    }
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5000) // 应该在5秒内完成
    monitor.clear()
  })

  it('统计计算应该快速', async () => {
    const monitor = new PerformanceMonitor()

    for (let i = 0; i < 100; i++) {
      await monitor.measure('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
      })
    }

    const start = Date.now()
    const stats = monitor.getStats('test')
    const elapsed = Date.now() - start

    expect(stats).toBeDefined()
    expect(elapsed).toBeLessThan(10) // 统计计算应该很快
    monitor.clear()
  })
})
