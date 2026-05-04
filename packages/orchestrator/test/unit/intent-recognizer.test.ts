/**
 * IntentRecognizer单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IntentRecognizer } from '../../src/intent/IntentRecognizer.js'
import { LLMClient } from '../../src/llm/LLMClient.js'
import type { OrchestratorInput, OrchestratorLLMConfig } from '../../src/types/index.js'

describe('IntentRecognizer', () => {
  let intentRecognizer: IntentRecognizer
  let mockLLMClient: any

  beforeEach(() => {
    // 创建Mock LLM客户端
    mockLLMClient = {
      chatWithSchema: vi.fn()
    }

    intentRecognizer = new IntentRecognizer(mockLLMClient, 0.7)
  })

  describe('意图识别', () => {
    it('应该能够识别意图（使用Mock）', async () => {
      // Mock LLM响应
      mockLLMClient.chatWithSchema.mockResolvedValue({
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '智能控制器',
          field: '控制技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['智能控制器', '撰写', '专利申请']
        }
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写一个专利申请'
      }

      const result = await intentRecognizer.recognize(input)

      expect(result).toBeDefined()
      expect(result.intent).toBe('DRAFT_FULL')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.complexity).toBeDefined()
    })

    it('应该能够提取关键词', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写一个关于智能控制器的专利申请'
      }

      const result = await intentRecognizer.recognize(input)

      expect(result.extracted.keywords).toBeDefined()
      expect(Array.isArray(result.extracted.keywords)).toBe(true)
    })

    it('应该能够检测附件', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '请分析这个附件',
        attachments: [
          {
            id: 'att-1',
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            data: 'base64data'
          }
        ]
      }

      const result = await intentRecognizer.recognize(input)

      expect(result.extracted.hasAttachment).toBeDefined()
      expect(typeof result.extracted.hasAttachment).toBe('boolean')
    })
  })

  describe('边界情况', () => {
    it('应该能够处理LLM调用失败', async () => {
      // Mock LLM调用失败
      mockLLMClient.chatWithSchema.mockRejectedValue(new Error('LLM error'))

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '测试消息'
      }

      const result = await intentRecognizer.recognize(input)

      // 应该返回CLARIFY
      expect(result).toBeDefined()
      expect(result.intent).toBe('CLARIFY')
    })

    it('应该能够处理低置信度', async () => {
      // Mock LLM返回低置信度
      mockLLMClient.chatWithSchema.mockResolvedValue({
        intent: 'DRAFT_FULL',
        confidence: 0.5,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['测试']
        }
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '测试消息'
      }

      const result = await intentRecognizer.recognize(input)

      // 应该转换为CLARIFY
      expect(result.intent).toBe('CLARIFY')
      expect(result.clarifyQuestion).toBeDefined()
    })
  })
})
