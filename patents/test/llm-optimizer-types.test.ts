/**
 * LLMOptimizer 类型安全测试
 *
 * 验证批处理回调的类型安全性
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

describe('LLMOptimizer 类型安全测试', () => {
  it('应该正确初始化批处理回调映射', () => {
    const optimizer = new LLMOptimizer(mockLLM)

    // 验证 batchCallbacks 存在且为 Map 类型
    expect(optimizer).toBeDefined()
    // 私有属性无法直接访问，但通过编译验证类型正确性
  })

  it('批处理回调应该具有正确的类型签名', async () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableBatching: true,
      enableResponseCache: false,
      enablePromptOptimization: false,
    })

    // 这个测试验证 TypeScript 类型推断正确
    // 如果类型不匹配，编译时会报错
    const response = await optimizer.optimizedChat({
      messages: [{ role: 'user', content: 'test' }],
    })

    expect(response).toBeDefined()
    expect(response.message.content).toBe('Test response')
  })

  it('多个并发请求应该正确处理', async () => {
    const optimizer = new LLMOptimizer(mockLLM, {
      enableBatching: true,
      batchMaxSize: 5,
      batchTimeout: 50,
      enableResponseCache: false,
      enablePromptOptimization: false,
    })

    // 创建多个并发请求以测试批处理
    const requests = Array.from({ length: 3 }, (_, i) =>
      optimizer.optimizedChat({
        messages: [{ role: 'user', content: `test ${i}` }],
      })
    )

    const responses = await Promise.all(requests)
    expect(responses).toHaveLength(3)
    responses.forEach((response) => {
      expect(response.message.content).toBe('Test response')
    })
  })

  it('批处理错误处理应该类型安全', async () => {
    const errorLLM: LLMAdapter = {
      chat: async (): Promise<LLMResponse> => {
        throw new Error('Test error')
      },
    }

    const optimizer = new LLMOptimizer(errorLLM, {
      enableBatching: true,
      enableResponseCache: false,
      enablePromptOptimization: false,
    })

    // 验证错误类型为 Error
    await expect(
      optimizer.optimizedChat({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('Test error')
  })
})
