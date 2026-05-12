/**
 * MockLLMClient单元测试
 *
 * 测试MockLLMClient的基本功能是否正常工作
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MockLLMClient,
  createE2ETestResponseSequence,
  createChitchatResponse,
  createClarifyResponse,
} from './MockLLMClient.js'
import type { LLMMessage } from '../../src/llm/LLMClient.js'

describe('MockLLMClient单元测试', () => {
  let mockClient: MockLLMClient

  beforeEach(() => {
    mockClient = new MockLLMClient()
  })

  describe('基本功能测试', () => {
    it('应该创建MockLLMClient实例', () => {
      expect(mockClient).toBeDefined()
      expect(mockClient).toBeInstanceOf(MockLLMClient)
    })

    it('应该返回默认响应', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: '测试消息' }]

      const response = await mockClient.chat(messages)

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(response.usage).toBeDefined()
    })

    it('应该按队列顺序返回响应', async () => {
      const response1 = {
        content: '响应1',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }
      const response2 = {
        content: '响应2',
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
      }

      mockClient.setResponseQueue([response1, response2])

      const result1 = await mockClient.chat([])
      const result2 = await mockClient.chat([])

      expect(result1.content).toBe('响应1')
      expect(result2.content).toBe('响应2')
    })

    it('应该在队列空时返回默认响应', async () => {
      const response1 = {
        content: '队列响应',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }
      mockClient.setResponseQueue([response1])

      const result1 = await mockClient.chat([])
      const result2 = await mockClient.chat([])

      expect(result1.content).toBe('队列响应')
      expect(result2.content).toBe(
        '{"intent": "CLARIFY", "confidence": 0.95, "complexity": "simple", "extracted": {"title": "问候", "field": "通用", "hasAttachment": false, "urgency": "normal", "keywords": ["你好"]}}'
      )
    })
  })

  describe('辅助函数测试', () => {
    it('应该创建正确的意图识别响应', () => {
      const response = createClarifyResponse()

      expect(response.content).toBeDefined()
      const parsed = JSON.parse(response.content)
      expect(parsed.intent).toBe('CLARIFY')
      expect(parsed.confidence).toBe(0.6)
    })

    it('应该创建正确的CLARIFY响应', () => {
      const response = createClarifyResponse()

      expect(response.content).toBeDefined()
      const parsed = JSON.parse(response.content)
      expect(parsed.intent).toBe('CLARIFY')
      expect(parsed.confidence).toBe(0.6)
    })

    it('应该创建完整的E2E测试响应序列', () => {
      const responses = createE2ETestResponseSequence('DRAFT_FULL')

      expect(responses).toHaveLength(3)
      expect(responses[0].content).toContain('DRAFT_FULL')
      expect(responses[1].content).toContain('plan-test-1')
      expect(responses[2].content).toContain('测试响应')
    })

    it('应该解析响应为JSON', async () => {
      const response = {
        content: '{"test": "value"}',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }

      mockClient.setResponseQueue([response])

      const result = await mockClient.chatWithSchema<{ test: string }>([], {})

      expect(result.test).toBe('value')
    })
  })

  describe('调用计数测试', () => {
    it('应该正确跟踪调用次数', async () => {
      mockClient.setResponseQueue([
        { content: '响应1', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
        { content: '响应2', usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 } },
      ])

      await mockClient.chat([])
      await mockClient.chat([])

      expect(mockClient.getCallCount()).toBe(2)
    })

    it('应该能够重置调用计数', async () => {
      await mockClient.chat([])
      expect(mockClient.getCallCount()).toBe(1)

      mockClient.resetCallCount()
      expect(mockClient.getCallCount()).toBe(0)
    })
  })

  describe('队列管理测试', () => {
    it('应该支持添加单个响应到队列', async () => {
      const response = {
        content: '新响应',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }
      mockClient.enqueueResponse(response)

      const result = await mockClient.chat([])
      expect(result.content).toBe('新响应')
    })

    it('应该支持清除响应队列', async () => {
      mockClient.setResponseQueue([
        { content: '响应1', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
        { content: '响应2', usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 } },
      ])

      mockClient.clearResponses()

      expect(mockClient.getCallCount()).toBe(0)
      // 清除后应该返回默认响应
      const result = await mockClient.chat([])
      expect(result.content).toContain('CLARIFY')
    })
  })

  describe('配置测试', () => {
    it('应该返回正确的配置', () => {
      const config = mockClient.getConfig()

      expect(config.provider).toBe('mock')
      expect(config.model).toBe('mock-model')
      expect(config.temperature).toBe(0.7)
      expect(config.maxTokens).toBe(4096)
    })
  })
})
