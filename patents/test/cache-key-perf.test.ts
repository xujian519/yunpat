/**
 * 缓存键生成性能基准测试
 *
 * 验证新哈希算法的性能可接受性
 */

import { describe, it, expect } from 'vitest'
import { LLMOptimizer } from '../core/llm-optimizer.js'
import type { LLMAdapter, LLMResponse } from '../core/llm-types.js'

// 创建一个简单的 LLM 适配器用于测试
const mockLLM: LLMAdapter = {
  chat: async (): Promise<LLMResponse> => ({
    message: {
      role: 'assistant',
      content: 'Test response',
    },
  }),
}

describe('缓存键生成性能基准测试', () => {
  it('单次缓存键生成应该在合理时间内完成', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any

    const startTime = performance.now()
    optimizerAny.generateCacheKey([{ role: 'user', content: 'Test message' }], 0.7, 1000)
    const endTime = performance.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(1) // 应该在1ms内完成
  })

  it('批量生成缓存键应该高效', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any
    const testCount = 1000

    const startTime = performance.now()
    for (let i = 0; i < testCount; i++) {
      optimizerAny.generateCacheKey([{ role: 'user', content: `Test message ${i}` }], 0.7, 1000 + i)
    }
    const endTime = performance.now()

    const duration = endTime - startTime
    const avgDuration = duration / testCount

    console.log(`生成 ${testCount} 个缓存键耗时: ${duration.toFixed(2)}ms`)
    console.log(`平均每个缓存键耗时: ${avgDuration.toFixed(4)}ms`)

    // 平均每个键应该在0.1ms内完成
    expect(avgDuration).toBeLessThan(0.1)
  })

  it('大消息对象的缓存键生成性能可接受', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any

    // 创建一个较大的消息对象（模拟实际使用场景）
    const largeMessage = {
      role: 'user' as const,
      content: 'A'.repeat(5000), // 5000字符的消息
    }

    const startTime = performance.now()
    optimizerAny.generateCacheKey([largeMessage], 0.7, 1000)
    const endTime = performance.now()

    const duration = endTime - startTime
    console.log(`大消息对象缓存键生成耗时: ${duration.toFixed(2)}ms`)

    // 即使是大消息，也应该在合理时间内完成
    expect(duration).toBeLessThan(5)
  })

  it('性能对比：新哈希 vs 旧哈希', () => {
    // 旧的简单哈希函数
    function oldHashFunction(messages: any[], temperature?: number, maxTokens?: number): string {
      const key = JSON.stringify({ messages, temperature, maxTokens })
      let hash = 0
      for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
      }
      return hash.toString(36)
    }

    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any
    const testCount = 1000

    // 测试新哈希性能
    const newStartTime = performance.now()
    for (let i = 0; i < testCount; i++) {
      optimizerAny.generateCacheKey([{ role: 'user', content: `Test message ${i}` }], 0.7, 1000)
    }
    const newEndTime = performance.now()
    const newDuration = newEndTime - newStartTime

    // 测试旧哈希性能
    const oldStartTime = performance.now()
    for (let i = 0; i < testCount; i++) {
      oldHashFunction([{ role: 'user', content: `Test message ${i}` }], 0.7, 1000)
    }
    const oldEndTime = performance.now()
    const oldDuration = oldEndTime - oldStartTime

    console.log(`新哈希算法耗时: ${newDuration.toFixed(2)}ms`)
    console.log(`旧哈希算法耗时: ${oldDuration.toFixed(2)}ms`)
    console.log(`性能比率: ${(newDuration / oldDuration).toFixed(2)}x`)

    // 新算法不应该比旧算法慢太多（允许3倍性能下降）
    expect(newDuration).toBeLessThan(oldDuration * 3)
  })
})
