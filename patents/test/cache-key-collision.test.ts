/**
 * 缓存键冲突测试
 *
 * 验证新哈希算法不会产生键冲突
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

describe('缓存键冲突测试', () => {
  it('不同的输入应该生成不同的缓存键', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    // 访问私有方法进行测试（仅在测试环境中）
    const optimizerAny = optimizer as any

    const key1 = optimizerAny.generateCacheKey([{ role: 'user', content: 'Hello' }], 0.7, 1000)
    const key2 = optimizerAny.generateCacheKey([{ role: 'user', content: 'World' }], 0.7, 1000)

    expect(key1).not.toBe(key2)
    expect(key1.length).toBe(16)
    expect(key2.length).toBe(16)
  })

  it('相同的输入应该生成相同的缓存键', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any

    const key1 = optimizerAny.generateCacheKey([{ role: 'user', content: 'Hello' }], 0.7, 1000)
    const key2 = optimizerAny.generateCacheKey([{ role: 'user', content: 'Hello' }], 0.7, 1000)

    expect(key1).toBe(key2)
  })

  it('温度参数变化应该生成不同的缓存键', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any

    const key1 = optimizerAny.generateCacheKey([{ role: 'user', content: 'Hello' }], 0.5, 1000)
    const key2 = optimizerAny.generateCacheKey([{ role: 'user', content: 'Hello' }], 0.8, 1000)

    expect(key1).not.toBe(key2)
  })

  it('大量输入中不应该出现缓存键冲突', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any
    const keys = new Set<string>()
    const testCount = 1000

    // 生成1000个不同的缓存键
    for (let i = 0; i < testCount; i++) {
      const key = optimizerAny.generateCacheKey(
        [{ role: 'user', content: `Test message ${i}` }],
        0.7,
        1000 + i
      )
      keys.add(key)
    }

    // 验证没有冲突
    expect(keys.size).toBe(testCount)
  })

  it('缓存键应该是十六进制字符串', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any

    const key = optimizerAny.generateCacheKey([{ role: 'user', content: 'Hello' }], 0.7, 1000)

    // 验证是有效的十六进制字符串
    expect(key).toMatch(/^[0-9a-f]{16}$/)
  })

  it('复杂消息对象应该生成稳定的缓存键', () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableResponseCache: true,
      enableBatching: false,
      enablePromptOptimization: false,
    })

    const optimizerAny = optimizer as any

    const complexMessages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant',
        metadata: { version: '1.0' },
      },
      {
        role: 'user' as const,
        content: 'Hello, how are you?',
        metadata: { timestamp: Date.now() },
      },
    ]

    const key1 = optimizerAny.generateCacheKey(complexMessages, 0.7, 2000)
    const key2 = optimizerAny.generateCacheKey(complexMessages, 0.7, 2000)

    expect(key1).toBe(key2)
    expect(key1.length).toBe(16)
  })
})
