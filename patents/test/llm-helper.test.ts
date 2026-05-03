/**
 * llm-helper.test.ts - LLM辅助工具测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LLMHelper } from '../core/llm-helper.js'
import type { LLMAdapter, LLMResponse } from '../core/llm-types.js'
import { LLMError, LLMErrorCode } from '../core/llm-types.js'

// Mock LLM适配器
const createMockLLM = (responseContent: string, shouldFail = false): LLMAdapter => {
  return {
    chat: vi.fn(async () => {
      if (shouldFail) {
        throw new LLMError('Mock error', LLMErrorCode.NETWORK_ERROR)
      }
      return {
        message: {
          role: 'assistant' as const,
          content: responseContent,
        },
      }
    }) as any,
  }
}

describe('llm-helper - 缓存功能', () => {
  beforeEach(() => {
    LLMHelper.clearCache()
  })

  afterEach(() => {
    LLMHelper.clearCache()
  })

  it('应该配置缓存', () => {
    LLMHelper.configureCache({
      enabled: true,
      maxSize: 500,
      expiryTime: 1800000,
    })

    const stats = LLMHelper.getCacheStats()
    expect(stats.size).toBe(0)
  })

  it('应该清除缓存', () => {
    LLMHelper.configureCache({ enabled: true })
    LLMHelper.clearCache()

    const stats = LLMHelper.getCacheStats()
    expect(stats.size).toBe(0)
  })

  it('应该获取缓存统计', () => {
    const stats = LLMHelper.getCacheStats()

    expect(stats).toHaveProperty('size')
    expect(stats).toHaveProperty('hits')
    expect(stats).toHaveProperty('oldest')
    expect(stats).toHaveProperty('newest')
  })
})

describe('llm-helper - structuredChat', () => {
  beforeEach(() => {
    LLMHelper.clearCache()
  })

  it('应该解析结构化输出', async () => {
    const mockLLM = createMockLLM(JSON.stringify({ score: 85, reasoning: '测试理由' }))

    const result = await LLMHelper.structuredChat(
      mockLLM,
      '请评估...',
      {
        score: { type: 'number', description: '评分' },
        reasoning: { type: 'string', description: '理由' },
      },
      { useCache: false }
    )

    expect(result.score).toBe(85)
    expect(result.reasoning).toBe('测试理由')
  })

  it('应该处理JSON解析失败', async () => {
    const mockLLM = createMockLLM('invalid json')

    await expect(
      LLMHelper.structuredChat(
        mockLLM,
        '请评估...',
        {
          score: { type: 'number', description: '评分' },
        },
        { useCache: false }
      )
    ).rejects.toThrow()
  })

  it('应该使用自定义系统提示词', async () => {
    const mockLLM = createMockLLM(JSON.stringify({ result: 'success' }))

    await LLMHelper.structuredChat(
      mockLLM,
      '请评估...',
      {
        result: { type: 'string', description: '结果' },
      },
      {
        systemPrompt: '自定义系统提示词',
        useCache: false,
      }
    )

    expect(mockLLM.chat).toHaveBeenCalled()
  })

  it('应该使用缓存', async () => {
    const mockLLM = createMockLLM(JSON.stringify({ score: 75 }))

    // 第一次调用
    const result1 = await LLMHelper.structuredChat<{ score: number }>(
      mockLLM,
      '请评估...',
      {
        score: { type: 'number', description: '评分' },
      },
      { useCache: true }
    )

    // 第二次调用（应该使用缓存）
    const result2 = await LLMHelper.structuredChat<{ score: number }>(
      mockLLM,
      '请评估...',
      {
        score: { type: 'number', description: '评分' },
      },
      { useCache: true }
    )

    expect(result1).toEqual(result2)
    expect(mockLLM.chat).toHaveBeenCalledTimes(1) // 只调用了一次
  })
})

describe('llm-helper - chatWithRetry', () => {
  it('应该在失败时重试', async () => {
    let attemptCount = 0
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new LLMError('网络错误', LLMErrorCode.NETWORK_ERROR)
        }
        return {
          message: {
            role: 'assistant' as const,
            content: '成功',
          },
        }
      }) as any,
    }

    const result = await LLMHelper.chatWithRetry(mockLLM, {
      messages: [{ role: 'user' as const, content: '测试' }],
    })

    expect(result.message.content).toBe('成功')
    expect(attemptCount).toBe(3)
  })

  it('应该在所有重试失败后抛出错误', async () => {
    const mockLLM = createMockLLM('', true)

    await expect(
      LLMHelper.chatWithRetry(mockLLM, {
        messages: [{ role: 'user' as const, content: '测试' }],
      })
    ).rejects.toThrow()
  })

  it('应该使用自定义重试配置', async () => {
    let attemptCount = 0
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => {
        attemptCount++
        if (attemptCount < 2) {
          throw new LLMError('超时', LLMErrorCode.TIMEOUT)
        }
        return {
          message: {
            role: 'assistant' as const,
            content: '成功',
          },
        }
      }) as any,
    }

    const onRetry = vi.fn()
    const result = await LLMHelper.chatWithRetry(
      mockLLM,
      {
        messages: [{ role: 'user' as const, content: '测试' }],
      },
      {
        maxAttempts: 5,
        initialDelay: 100,
        onRetry,
      }
    )

    expect(result.message.content).toBe('成功')
    expect(onRetry).toHaveBeenCalled()
  })

  it('不应该重试不可重试的错误', async () => {
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => {
        throw new LLMError('解析错误', LLMErrorCode.PARSE_ERROR)
      }) as any,
    }

    await expect(
      LLMHelper.chatWithRetry(mockLLM, {
        messages: [{ role: 'user' as const, content: '测试' }],
      })
    ).rejects.toThrow()
  })
})

describe('llm-helper - batchChat', () => {
  it('应该批量处理多个请求', async () => {
    const mockLLM = createMockLLM('响应内容')

    const paramsArray = Array.from({ length: 10 }, (_, i) => ({
      messages: [{ role: 'user', content: `消息${i}` }],
    }))

    const results = await LLMHelper.batchChat(mockLLM, paramsArray)

    expect(results).toHaveLength(10)
    results.forEach((result) => {
      expect(result.message.content).toBe('响应内容')
    })
  })

  it('应该限制并发数量', async () => {
    const mockLLM = createMockLLM('响应内容')

    let maxConcurrent = 0
    let currentConcurrent = 0
    const trackingLLM: LLMAdapter = {
      chat: vi.fn(async () => {
        currentConcurrent++
        if (currentConcurrent > maxConcurrent) {
          maxConcurrent = currentConcurrent
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
        currentConcurrent--
        return {
          message: {
            role: 'assistant',
            content: '响应内容',
          },
        }
      }),
    }

    const paramsArray = Array.from({ length: 20 }, (_, i) => ({
      messages: [{ role: 'user', content: `消息${i}` }],
    }))

    await LLMHelper.batchChat(trackingLLM, paramsArray, { maxConcurrent: 5 })

    expect(maxConcurrent).toBeLessThanOrEqual(5)
  })

  it('应该调用进度回调', async () => {
    const mockLLM = createMockLLM('响应内容')
    const onProgress = vi.fn()

    const paramsArray = Array.from({ length: 5 }, (_, i) => ({
      messages: [{ role: 'user', content: `消息${i}` }],
    }))

    await LLMHelper.batchChat(mockLLM, paramsArray, { onProgress })

    expect(onProgress).toHaveBeenCalled()
    expect(onProgress).toHaveBeenLastCalledWith(5, 5)
  })

  it('应该处理部分失败', async () => {
    let callCount = 0
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => {
        callCount++
        if (callCount === 3) {
          throw new Error('模拟失败')
        }
        return {
          message: {
            role: 'assistant' as const,
            content: '响应内容',
          },
        }
      }) as any,
    }

    const paramsArray = Array.from({ length: 5 }, (_, i) => ({
      messages: [{ role: 'user' as const, content: `消息${i}` }],
    }))

    await expect(LLMHelper.batchChat(mockLLM, paramsArray)).rejects.toThrow('模拟失败')
  })
})

describe('llm-helper - validateAndTruncatePrompt', () => {
  it('应该返回未超限的提示词', () => {
    const messages = [
      { role: 'user' as const, content: '短消息' },
      { role: 'assistant' as const, content: '短回复' },
    ]

    const result = LLMHelper.validateAndTruncatePrompt(messages, 1000)

    expect(result).toEqual(messages)
  })

  it('应该截断超限的提示词', () => {
    const longContent = 'A'.repeat(10000)
    const messages = [
      { role: 'user' as const, content: longContent },
    ]

    const result = LLMHelper.validateAndTruncatePrompt(messages, 1000)

    expect(result[0].content.length).toBeLessThan(longContent.length)
    expect(result[0].content).toContain('[截断]')
  })

  it('应该保留最新的消息', () => {
    const messages = [
      { role: 'user' as const, content: '旧消息' },
      { role: 'assistant' as const, content: 'A'.repeat(10000) },
      { role: 'user' as const, content: '新消息' },
    ]

    const result = LLMHelper.validateAndTruncatePrompt(messages, 1000)

    // 应该保留最新的消息
    expect(result[result.length - 1].content).toBe('新消息')
  })
})

describe('llm-helper - streamChat', () => {
  it('应该流式输出内容', async () => {
    const chunks = ['chunk1', 'chunk2', 'chunk3']
    const mockLLM: LLMAdapter = {
      streamChat: vi.fn(async function* () {
        for (const chunk of chunks) {
          yield {
            message: {
              role: 'assistant',
              content: chunk,
            },
          }
        }
      }),
    }

    const streamedChunks: string[] = []
    for await (const content of LLMHelper.streamChat(mockLLM, {
      messages: [{ role: 'user', content: '测试' }],
    })) {
      streamedChunks.push(content)
    }

    expect(streamedChunks).toEqual(chunks)
  })

  it('应该回退到普通调用如果不支持流式', async () => {
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: '完整响应',
        },
      })),
    }

    const streamedChunks: string[] = []
    for await (const content of LLMHelper.streamChat(mockLLM, {
      messages: [{ role: 'user', content: '测试' }],
    })) {
      streamedChunks.push(content)
    }

    expect(streamedChunks).toEqual(['完整响应'])
  })
})

describe('llm-helper - multiTurnChat', () => {
  it('应该处理多轮对话', async () => {
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: '回复',
        },
      })),
    }

    const turns = [
      { user: '第一轮' },
      { user: '第二轮' },
      { user: '第三轮' },
    ]

    const responses = await LLMHelper.multiTurnChat(mockLLM, turns)

    expect(responses).toHaveLength(3)
    expect(mockLLM.chat).toHaveBeenCalledTimes(3)
  })

  it('应该使用上下文历史', async () => {
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant' as const,
          content: '回复',
        },
      })),
    } as any

    const context = ['之前的用户消息', '之前的助手回复']
    const turns = [{ user: '当前消息' }]

    await LLMHelper.multiTurnChat(mockLLM, turns, { context })

    expect(mockLLM.chat).toHaveBeenCalled()
    const calls = (mockLLM.chat as any).mock.calls
    expect(calls.length).toBe(1)

    // 检查传入的messages参数
    const params = calls[0][0]
    expect(params.messages).toBeDefined()
    expect(params.messages.length).toBeGreaterThanOrEqual(1) // 至少包含当前消息
  })

  it('应该支持自定义系统提示词', async () => {
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: '回复',
        },
      })),
    }

    const turns = [
      { system: '系统提示词', user: '用户消息' },
    ]

    await LLMHelper.multiTurnChat(mockLLM, turns)

    expect(mockLLM.chat).toHaveBeenCalled()
  })
})

describe('llm-helper - parallelChatWithBestSelection', () => {
  it('应该并行调用多个LLM', async () => {
    const mockLLM1 = createMockLLM('结果1')
    const mockLLM2 = createMockLLM('结果2')
    const mockLLM3 = createMockLLM('结果3')

    const selector = vi.fn((responses) => responses[1])

    const result = await LLMHelper.parallelChatWithBestSelection(
      [mockLLM1, mockLLM2, mockLLM3],
      {
        messages: [{ role: 'user', content: '测试' }],
      },
      selector
    )

    expect(result.message.content).toBe('结果2')
    expect(selector).toHaveBeenCalled()
  })

  it('应该拒绝空的LLM列表', async () => {
    await expect(
      LLMHelper.parallelChatWithBestSelection(
        [],
        {
          messages: [{ role: 'user', content: '测试' }],
        },
        () => null as any
      )
    ).rejects.toThrow('至少需要一个 LLM 实例')
  })
})

describe('llm-helper - chatWithTimeout', () => {
  it('应该在超时前完成', async () => {
    const mockLLM = createMockLLM('快速响应')

    const result = await LLMHelper.chatWithTimeout(
      mockLLM,
      {
        messages: [{ role: 'user', content: '测试' }],
      },
      5000
    )

    expect(result.message.content).toBe('快速响应')
  })

  it('应该在超时时抛出错误', async () => {
    const slowLLM: LLMAdapter = {
      chat: vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  message: {
                    role: 'assistant',
                    content: '慢速响应',
                  },
                }),
              6000
            )
          )
      ),
    }

    await expect(
      LLMHelper.chatWithTimeout(
        slowLLM,
        {
          messages: [{ role: 'user', content: '测试' }],
        },
        1000
      )
    ).rejects.toThrow('超时')
  })
})

describe('llm-helper - calculateCost', () => {
  it('应该计算调用成本', () => {
    const response: LLMResponse = {
      message: {
        role: 'assistant',
        content: '响应内容',
      },
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      },
    }

    const cost = LLMHelper.calculateCost(response, {
      inputPricePer1kTokens: 0.001,
      outputPricePer1kTokens: 0.002,
    })

    expect(cost).toBeCloseTo(0.002, 5) // 1000/1000*0.001 + 500/1000*0.002
  })

  it('应该处理缺失usage信息', () => {
    const response: LLMResponse = {
      message: {
        role: 'assistant',
        content: '响应内容',
      },
    }

    const cost = LLMHelper.calculateCost(response, {
      inputPricePer1kTokens: 0.001,
      outputPricePer1kTokens: 0.002,
    })

    expect(cost).toBe(0)
  })

  it('应该批量计算成本', () => {
    const responses: LLMResponse[] = [
      {
        message: { role: 'assistant', content: '响应1' },
        usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
      },
      {
        message: { role: 'assistant', content: '响应2' },
        usage: { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 },
      },
    ]

    const result = LLMHelper.calculateBatchCost(responses, {
      inputPricePer1kTokens: 0.001,
      outputPricePer1kTokens: 0.002,
    })

    expect(result.totalCost).toBeCloseTo(0.006, 5)
    expect(result.breakdown).toHaveLength(2)
  })
})

describe('llm-helper - 边界情况', () => {
  it('应该处理空响应', async () => {
    const mockLLM = createMockLLM('')

    await expect(
      LLMHelper.structuredChat(
        mockLLM,
        '请评估...',
        {
          score: { type: 'number', description: '评分' },
        },
        { useCache: false }
      )
    ).rejects.toThrow()
  })

  it('应该处理空消息列表', () => {
    const result = LLMHelper.validateAndTruncatePrompt([], 1000)

    expect(result).toEqual([])
  })

  it('应该处理空轮次', async () => {
    const mockLLM: LLMAdapter = {
      chat: vi.fn(async () => ({
        message: {
          role: 'assistant',
          content: '回复',
        },
      })),
    }

    const responses = await LLMHelper.multiTurnChat(mockLLM, [])

    expect(responses).toEqual([])
  })

  it('应该处理非常大的批量', async () => {
    const mockLLM = createMockLLM('响应内容')

    const paramsArray = Array.from({ length: 100 }, (_, i) => ({
      messages: [{ role: 'user', content: `消息${i}` }],
    }))

    const results = await LLMHelper.batchChat(mockLLM, paramsArray, {
      maxConcurrent: 10,
    })

    expect(results).toHaveLength(100)
  })
})

describe('llm-helper - 性能测试', () => {
  it('批量处理性能 - 100个请求', async () => {
    const mockLLM = createMockLLM('响应内容')

    const paramsArray = Array.from({ length: 100 }, (_, i) => ({
      messages: [{ role: 'user', content: `消息${i}` }],
    }))

    const start = Date.now()
    await LLMHelper.batchChat(mockLLM, paramsArray, { maxConcurrent: 10 })
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5000) // 应该在5秒内完成
  })

  it('缓存命中率测试', async () => {
    const mockLLM = createMockLLM(JSON.stringify({ score: 85 }))

    const schema = {
      score: { type: 'number' as const, description: '评分' },
    }

    // 第一次调用（缓存未命中）
    await LLMHelper.structuredChat(mockLLM, '请评估...', schema, {
      useCache: true,
    })

    // 后续调用（缓存命中）
    for (let i = 0; i < 10; i++) {
      await LLMHelper.structuredChat(mockLLM, '请评估...', schema, {
        useCache: true,
      })
    }

    const stats = LLMHelper.getCacheStats()
    expect(stats.hits).toBeGreaterThan(0)
  })
})
