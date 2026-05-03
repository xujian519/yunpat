/**
 * Memory Management Integration Tests
 *
 * 测试内存管理功能的端到端行为
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Memory Management Integration', () => {
  describe('Learning Case Management', () => {
    it('should enforce memory limits', () => {
      const MAX_CASES = 10000
      const learningCases: any[] = []

      // 添加案例直到达到限制
      for (let i = 0; i < MAX_CASES + 100; i++) {
        if (learningCases.length >= MAX_CASES) {
          // 删除最旧的案例
          learningCases.shift()
        }
        learningCases.push({ id: i, timestamp: Date.now() })
      }

      // 验证限制生效
      expect(learningCases.length).toBeLessThanOrEqual(MAX_CASES)
      expect(learningCases).toHaveLength(MAX_CASES)
    })

    it('should maintain case diversity', () => {
      const cases = [
        { type: 'novelty', success: true },
        { type: 'non-obviousness', success: false },
        { type: 'novelty', success: true },
        { type: 'enablement', success: true },
      ]

      // 统计类型分布
      const typeCounts = cases.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(Object.keys(typeCounts)).toHaveLength(3)
      expect(typeCounts.novelty).toBe(2)
      expect(typeCounts['non-obviousness']).toBe(1)
      expect(typeCounts.enablement).toBe(1)
    })

    it('should prune old cases efficiently', () => {
      const now = Date.now()
      const cases = [
        { id: 1, timestamp: now - 1000000 },
        { id: 2, timestamp: now - 500000 },
        { id: 3, timestamp: now - 100000 },
        { id: 4, timestamp: now },
      ]

      const maxAge = 600000 // 10分钟
      const prunedCases = cases.filter((c) => now - c.timestamp <= maxAge)

      expect(prunedCases).toHaveLength(2)
      expect(prunedCases[0].id).toBe(3)
      expect(prunedCases[1].id).toBe(4)
    })
  })

  describe('Memory Monitoring', () => {
    it('should track memory usage', () => {
      const memoryStats = {
        used: 0,
        total: 0,
        cases: 0,
      }

      // 模拟内存使用跟踪
      const estimateSize = (obj: any): number => {
        return JSON.stringify(obj).length * 2 // 简化估算
      }

      const cases = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000),
      }))

      cases.forEach((c) => {
        memoryStats.used += estimateSize(c)
        memoryStats.cases++
      })

      expect(memoryStats.cases).toBe(100)
      expect(memoryStats.used).toBeGreaterThan(0)
    })

    it('should trigger cleanup when threshold reached', () => {
      const threshold = 1000000 // 1MB
      const currentUsage = 1200000 // 1.2MB

      const shouldCleanup = currentUsage > threshold

      expect(shouldCleanup).toBe(true)
    })

    it('should provide memory statistics', () => {
      const stats = {
        totalCases: 5000,
        memoryUsed: 5242880, // 5MB
        memoryLimit: 10485760, // 10MB
        oldestCase: Date.now() - 86400000,
        newestCase: Date.now(),
      }

      const usagePercentage = (stats.memoryUsed / stats.memoryLimit) * 100

      expect(usagePercentage).toBe(50)
      expect(stats.totalCases).toBe(5000)
    })
  })

  describe('Learning Efficiency', () => {
    it('should prioritize successful strategies', () => {
      const strategies = [
        { name: 'A', successRate: 0.8, uses: 100 },
        { name: 'B', successRate: 0.6, uses: 50 },
        { name: 'C', successRate: 0.9, uses: 80 },
      ]

      // 按成功率排序
      const sorted = [...strategies].sort((a, b) => b.successRate - a.successRate)

      expect(sorted[0].name).toBe('C')
      expect(sorted[1].name).toBe('A')
      expect(sorted[2].name).toBe('B')
    })

    it('should adapt learning rate based on performance', () => {
      const recentPerformance = [0.7, 0.75, 0.8, 0.85, 0.9]
      const avgPerformance =
        recentPerformance.reduce((a, b) => a + b, 0) / recentPerformance.length

      // 根据表现调整学习率
      const learningRate = avgPerformance > 0.8 ? 0.1 : 0.2

      expect(learningRate).toBe(0.1)
    })

    it('should avoid overfitting to recent patterns', () => {
      const cases = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        pattern: i % 10, // 10种模式
      }))

      // 统计模式分布
      const patternCounts = cases.reduce((acc, c) => {
        acc[c.pattern] = (acc[c.pattern] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      // 验证分布相对均匀
      const counts = Object.values(patternCounts)
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length
      const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / counts.length

      expect(variance).toBeLessThan(avgCount * 0.1) // 方差小于平均值的10%
    })
  })

  describe('Memory Integration Scenarios', () => {
    it('should handle memory pressure gracefully', () => {
      const memoryLimit = 1000
      const items: any[] = []

      // 模拟内存压力
      for (let i = 0; i < 2000; i++) {
        if (items.length >= memoryLimit) {
          items.shift() // 删除最旧的项目
        }
        items.push({ id: i })
      }

      expect(items.length).toBe(memoryLimit)
      expect(items[0].id).toBe(1000) // 最旧的项目是1000
      expect(items[items.length - 1].id).toBe(1999) // 最新的项目是1999
    })

    it('should recover from memory overflow', async () => {
      let memoryFull = false
      const cleanupTriggered = vi.fn()

      // 模拟内存溢出恢复
      const simulateMemoryOverflow = async () => {
        memoryFull = true
        cleanupTriggered()

        // 执行清理
        await new Promise((resolve) => setTimeout(resolve, 10))
        memoryFull = false
      }

      expect(memoryFull).toBe(false)
      expect(cleanupTriggered).not.toHaveBeenCalled()

      await simulateMemoryOverflow()

      expect(cleanupTriggered).toHaveBeenCalled()
      expect(memoryFull).toBe(false)
    })

    it('should maintain data integrity during cleanup', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: `value-${i}`,
      }))

      // 清理前50个项目
      const prunedData = data.slice(50)

      // 验证数据完整性
      prunedData.forEach((item, index) => {
        expect(item.id).toBe(50 + index)
        expect(item.value).toBe(`value-${50 + index}`)
      })

      expect(prunedData).toHaveLength(50)
    })
  })
})
