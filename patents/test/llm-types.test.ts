/**
 * llm-types.test.ts - LLM类型系统测试
 */

import { describe, it, expect } from 'vitest'
import {
  isLLMResponse,
  isValidLLMMessage,
  createLLMMessage,
  validateLLMResponse,
  extractResponseContent,
  extractJSONFromResponse,
  estimateTokens,
  checkTokenLimit,
  LLMError,
  LLMErrorCode,
  type LLMResponse,
  type LLMMessage,
} from '../core/llm-types.js'

describe('llm-types - 类型守卫', () => {
  describe('isLLMResponse', () => {
    it('应该正确识别有效的LLM响应', () => {
      const validResponse: LLMResponse = {
        message: {
          role: 'assistant',
          content: '测试内容',
        },
      }

      expect(isLLMResponse(validResponse)).toBe(true)
    })

    it('应该拒绝null', () => {
      expect(isLLMResponse(null)).toBe(false)
    })

    it('应该拒绝undefined', () => {
      expect(isLLMResponse(undefined)).toBe(false)
    })

    it('应该拒绝缺少message的对象', () => {
      expect(isLLMResponse({})).toBe(false)
    })

    it('应该拒绝message为null的对象', () => {
      expect(isLLMResponse({ message: null })).toBe(false)
    })

    it('应该拒绝message.content不是字符串的对象', () => {
      expect(isLLMResponse({ message: { role: 'assistant', content: 123 } })).toBe(false)
    })
  })

  describe('isValidLLMMessage', () => {
    it('应该接受有效的消息', () => {
      const validMessage: LLMMessage = {
        role: 'user',
        content: '测试消息',
      }

      expect(isValidLLMMessage(validMessage)).toBe(true)
    })

    it('应该接受所有有效的角色', () => {
      const roles: LLMMessage[] = [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '用户消息' },
        { role: 'assistant', content: '助手回复' },
      ]

      roles.forEach((msg) => {
        expect(isValidLLMMessage(msg)).toBe(true)
      })
    })

    it('应该拒绝无效的角色', () => {
      expect(isValidLLMMessage({ role: 'invalid' as any, content: '测试' })).toBe(false)
    })

    it('应该拒绝content不是字符串的消息', () => {
      expect(isValidLLMMessage({ role: 'user', content: 123 as any })).toBe(false)
    })

    it('应该拒绝null', () => {
      expect(isValidLLMMessage(null)).toBe(false)
    })
  })
})

describe('llm-types - 创建函数', () => {
  describe('createLLMMessage', () => {
    it('应该创建有效的消息', () => {
      const msg = createLLMMessage('user', '测试消息')

      expect(msg).toEqual({
        role: 'user',
        content: '测试消息',
      })
    })

    it('应该创建带metadata的消息', () => {
      const metadata = { timestamp: Date.now() }
      const msg = createLLMMessage('user', '测试消息', metadata)

      expect(msg.metadata).toEqual(metadata)
    })

    it('应该拒绝非字符串content', () => {
      expect(() => createLLMMessage('user', 123 as any)).toThrow(LLMError)
    })

    it('应该拒绝空字符串content', () => {
      expect(() => createLLMMessage('user', '')).toThrow('content 不能为空')
    })

    it('应该在错误中包含错误码', () => {
      try {
        createLLMMessage('user', 123 as any)
        expect(true).toBe(false) // 如果到这里则测试失败
      } catch (error: any) {
        expect(error.code).toBe(LLMErrorCode.PARSE_ERROR)
      }
    })
  })
})

describe('llm-types - 验证函数', () => {
  describe('validateLLMResponse', () => {
    it('应该返回有效的响应', () => {
      const validResponse: LLMResponse = {
        message: {
          role: 'assistant',
          content: '测试内容',
        },
      }

      const result = validateLLMResponse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it('应该抛出无效响应的错误', () => {
      expect(() => validateLLMResponse(null)).toThrow('无效的 LLM 响应格式')
    })

    it('应该抛出LLMError', () => {
      try {
        validateLLMResponse({})
        expect(true).toBe(false) // 如果到这里则测试失败
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
      }
    })
  })
})

describe('llm-types - 提取函数', () => {
  describe('extractResponseContent', () => {
    it('应该提取响应内容', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '测试内容',
        },
      }

      expect(extractResponseContent(response)).toBe('测试内容')
    })

    it('应该处理空内容', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '',
        },
      }

      expect(extractResponseContent(response)).toBe('')
    })
  })

  describe('extractJSONFromResponse', () => {
    it('应该提取JSON内容', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '{"score": 85, "reasoning": "测试"}',
        },
      }

      const result = extractJSONFromResponse(response)
      expect(result).toEqual({ score: 85, reasoning: '测试' })
    })

    it('应该从混合文本中提取JSON', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '这是分析结果：{"score": 75}。结束',
        },
      }

      const result = extractJSONFromResponse(response)
      expect(result).toEqual({ score: 75 })
    })

    it('应该使用fallback值', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '没有JSON的文本',
        },
      }

      const result = extractJSONFromResponse(response, { score: 0 })
      expect(result).toEqual({ score: 0 })
    })

    it('应该抛出无效JSON的错误', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '{invalid json}',
        },
      }

      expect(() => extractJSONFromResponse(response)).toThrow(LLMError)
    })

    it('应该在解析失败时使用fallback', () => {
      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: '{invalid json}',
        },
      }

      const result = extractJSONFromResponse(response, { score: -1 })
      expect(result).toEqual({ score: -1 })
    })

    it('应该处理复杂JSON对象', () => {
      const complexObject = {
        score: 85,
        reasoning: '测试理由',
        details: {
          strengths: ['优点1', '优点2'],
          weaknesses: ['缺点1'],
        },
      }

      const response: LLMResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify(complexObject),
        },
      }

      const result = extractJSONFromResponse(response)
      expect(result).toEqual(complexObject)
    })
  })
})

describe('llm-types - Token估算', () => {
  describe('estimateTokens', () => {
    it('应该估算中文字符token', () => {
      const chineseText = '中文测试文本'
      const tokens = estimateTokens(chineseText)

      // 约 6 个中文字符 / 1.5 = 4 tokens
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThanOrEqual(chineseText.length)
    })

    it('应该估算英文token', () => {
      const englishText = 'This is a test'
      const tokens = estimateTokens(englishText)

      // 约 14 个英文字符 / 4 = 3.5 → 4 tokens
      expect(tokens).toBeGreaterThan(0)
    })

    it('应该估算混合文本token', () => {
      const mixedText = '中文Mixed混合Text'
      const tokens = estimateTokens(mixedText)

      expect(tokens).toBeGreaterThan(0)
    })

    it('应该处理空字符串', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('应该处理长文本', () => {
      const longText = 'A'.repeat(10000)
      const tokens = estimateTokens(longText)

      expect(tokens).toBe(2500) // 10000 / 4
    })
  })

  describe('checkTokenLimit', () => {
    it('应该检测未超过限制', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: '短消息' },
      ]

      const result = checkTokenLimit(messages, 1000)

      expect(result.exceeds).toBe(false)
      expect(result.estimated).toBeGreaterThan(0)
      expect(result.remaining).toBeGreaterThan(0)
    })

    it('应该检测超过限制', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'A'.repeat(10000) },
      ]

      const result = checkTokenLimit(messages, 1000)

      expect(result.exceeds).toBe(true)
      expect(result.remaining).toBeLessThan(0)
    })

    it('应该计算多个消息的总token', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: '消息1' },
        { role: 'assistant', content: '回复1' },
        { role: 'user', content: '消息2' },
      ]

      const result = checkTokenLimit(messages, 1000)

      expect(result.estimated).toBeGreaterThan(0)
      expect(messages.length).toBe(3)
    })

    it('应该使用默认限制8000', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: '测试' },
      ]

      const result = checkTokenLimit(messages)

      expect(result.remaining).toBeGreaterThan(7900) // 应该剩余大量空间
    })

    it('应该处理空消息列表', () => {
      const result = checkTokenLimit([], 1000)

      expect(result.exceeds).toBe(false)
      expect(result.estimated).toBe(0)
      expect(result.remaining).toBe(1000)
    })
  })
})

describe('llm-types - 边界情况', () => {
  it('应该处理超长字符串的token估算', () => {
    const veryLongText = 'A'.repeat(1000000) // 1MB
    const tokens = estimateTokens(veryLongText)

    expect(tokens).toBe(250000) // 1M / 4
  })

  it('应该处理带特殊字符的JSON', () => {
    const response: LLMResponse = {
      message: {
        role: 'assistant',
        content: '{"text": "带\\n换行\\t制表符"}',
      },
    }

    const result = extractJSONFromResponse(response)
    expect(result).toEqual({ text: '带\n换行\t制表符' })
  })

  it('应该处理嵌套JSON', () => {
    const nested = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    }

    const response: LLMResponse = {
      message: {
        role: 'assistant',
        content: JSON.stringify(nested),
      },
    }

    const result = extractJSONFromResponse(response)
    expect(result).toEqual(nested)
  })
})

describe('llm-types - 性能测试', () => {
  it('token估算性能 - 10000次估算应该在合理时间内完成', () => {
    const testText = '测试文本Test Text混合Mixed'

    const start = Date.now()
    for (let i = 0; i < 10000; i++) {
      estimateTokens(testText)
    }
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(100) // 应该在100ms内完成
  })

  it('JSON提取性能 - 大JSON对象', () => {
    const largeObject = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random(),
      })),
    }

    const response: LLMResponse = {
      message: {
        role: 'assistant',
        content: JSON.stringify(largeObject),
      },
    }

    const start = Date.now()
    const result = extractJSONFromResponse(response)
    const elapsed = Date.now() - start

    expect(result).toEqual(largeObject)
    expect(elapsed).toBeLessThan(100) // 应该在100ms内完成
  })
})
