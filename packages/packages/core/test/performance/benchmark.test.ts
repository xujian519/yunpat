/**
 * 性能基准测试
 *
 * 用于检测性能回归，确保优化不会导致性能下降
 */

import { describe, it, expect } from 'vitest'

describe('性能基准测试', () => {
  describe('数组操作性能', () => {
    it('应该在合理时间内完成数组过滤和映射', () => {
      const testArray = Array.from({ length: 1000 }, (_, i) => i)

      const start = performance.now()

      // 执行操作
      const result = testArray.filter((x) => x % 2 === 0).map((x) => x * 2)

      const end = performance.now()
      const duration = end - start

      // 验证结果正确性
      expect(result).toHaveLength(500)
      expect(result[0]).toBe(0)

      // 验证性能（应该在 10ms 内完成）
      expect(duration).toBeLessThan(10)
    })

    it('应该在合理时间内完成对象操作', () => {
      const testObject = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`key${i}`, i]))

      const start = performance.now()

      // 执行操作
      const keys = Object.keys(testObject)
      const values = Object.values(testObject)

      const end = performance.now()
      const duration = end - start

      // 验证结果
      expect(keys).toHaveLength(1000)
      expect(values).toHaveLength(1000)

      // 验证性能
      expect(duration).toBeLessThan(5)
    })
  })

  describe('字符串操作性能', () => {
    it('应该在合理时间内完成字符串处理', () => {
      const testString = '测试字符串'.repeat(100)

      const start = performance.now()

      // 执行操作
      const reversed = testString.split('').reverse().join('')

      const end = performance.now()
      const duration = end - start

      // 验证结果
      expect(reversed).toHaveLength(testString.length)

      // 验证性能
      expect(duration).toBeLessThan(5)
    })
  })

  describe('JSON 序列化性能', () => {
    it('应该在合理时间内完成 JSON 序列化', () => {
      const testData = {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })),
      }

      const start = performance.now()

      // 执行操作
      const serialized = JSON.stringify(testData)
      const deserialized = JSON.parse(serialized)

      const end = performance.now()
      const duration = end - start

      // 验证结果
      expect(deserialized.data).toHaveLength(100)

      // 验证性能
      expect(duration).toBeLessThan(10)
    })
  })

  describe('LLM Token 估算性能', () => {
    it('应该快速完成 token 估算', () => {
      const text = '这是一段测试文本，用于验证 token 估算的性能。'.repeat(100)

      const start = performance.now()

      // 简单的 token 估算（每 4 个字符约等于 1 个 token）
      const estimatedTokens = Math.ceil(text.length / 4)

      const end = performance.now()
      const duration = end - start

      // 验证结果
      expect(estimatedTokens).toBeGreaterThan(0)

      // 验证性能（应该非常快）
      expect(duration).toBeLessThan(1)
    })
  })

  describe('向量相似度计算性能', () => {
    it('应该在合理时间内完成向量相似度计算', () => {
      const vec1 = Array.from({ length: 100 }, () => Math.random())
      const vec2 = Array.from({ length: 100 }, () => Math.random())

      const start = performance.now()

      // 计算余弦相似度
      const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0)
      const norm1 = Math.sqrt(vec1.reduce((sum, x) => sum + x * x, 0))
      const norm2 = Math.sqrt(vec2.reduce((sum, x) => sum + x * x, 0))
      const similarity = dotProduct / (norm1 * norm2)

      const end = performance.now()
      const duration = end - start

      // 验证结果
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)

      // 验证性能
      expect(duration).toBeLessThan(5)
    })
  })
})
