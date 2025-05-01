/**
 * IntentRecognizer单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IntentRecognizer } from '../../src/intent/IntentRecognizer.js'
import type { OrchestratorInput } from '../../src/types/index.js'

describe('IntentRecognizer', () => {
  let intentRecognizer: IntentRecognizer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLMClient: any

  beforeEach(() => {
    mockLLMClient = {
      chatWithSchema: vi.fn(),
    }

    intentRecognizer = new IntentRecognizer(mockLLMClient, 0.7)
  })

  describe('意图识别', () => {
    it('应该能够识别意图（使用Mock）', async () => {
      mockLLMClient.chatWithSchema.mockResolvedValue({
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '智能控制器',
          field: '控制技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['智能控制器', '撰写', '专利申请'],
        },
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写一个专利申请',
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
        message: '帮我撰写一个关于智能控制器的专利申请',
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
            data: 'base64data',
          },
        ],
      }

      const result = await intentRecognizer.recognize(input)

      expect(result.extracted.hasAttachment).toBeDefined()
      expect(typeof result.extracted.hasAttachment).toBe('boolean')
    })
  })

  describe('消息组装', () => {
    it('用户消息应只出现一次（不重复）', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capturedMessages: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockLLMClient.chatWithSchema.mockImplementation(async (messages: any[]) => {
        capturedMessages.push(...messages)
        return {
          intent: 'DRAFT_FULL',
          confidence: 0.9,
          complexity: 'simple',
          extracted: { hasAttachment: false, urgency: 'normal', keywords: ['test'] },
        }
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写一个专利申请',
      }

      await intentRecognizer.recognize(input)

      const userMessageCount = capturedMessages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((m: any) => m.role === 'user')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((m: any) => m.content.includes('帮我撰写一个专利申请')).length

      expect(userMessageCount).toBe(1)
    })

    it('消息顺序应为 system → few-shot → 用户输入', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capturedMessages: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockLLMClient.chatWithSchema.mockImplementation(async (messages: any[]) => {
        capturedMessages.push(...messages)
        return {
          intent: 'CHITCHAT',
          confidence: 0.9,
          complexity: 'simple',
          extracted: { hasAttachment: false, urgency: 'normal', keywords: [] },
        }
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '你好',
      }

      await intentRecognizer.recognize(input)

      expect(capturedMessages[0].role).toBe('system')
      expect(capturedMessages[capturedMessages.length - 1].role).toBe('user')
      expect(capturedMessages[capturedMessages.length - 1].content).toContain('你好')
    })

    it('附件信息应包含在用户提示中', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capturedMessages: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockLLMClient.chatWithSchema.mockImplementation(async (messages: any[]) => {
        capturedMessages.push(...messages)
        return {
          intent: 'DRAFT_FULL',
          confidence: 0.9,
          complexity: 'simple',
          extracted: { hasAttachment: false, urgency: 'normal', keywords: [] },
        }
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我写专利',
        attachments: [
          { id: 'att-1', filename: 'test.pdf', mimeType: 'application/pdf', size: 1024, data: '' },
        ],
      }

      await intentRecognizer.recognize(input)

      const lastUserMsg = capturedMessages[capturedMessages.length - 1]
      expect(lastUserMsg.content).toContain('test.pdf')
      expect(lastUserMsg.content).toContain('附件')
    })
  })

  describe('边界情况', () => {
    it('应该能够处理LLM调用失败', async () => {
      mockLLMClient.chatWithSchema.mockRejectedValue(new Error('LLM error'))

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '测试消息',
      }

      const result = await intentRecognizer.recognize(input)

      expect(result).toBeDefined()
      expect(result.intent).toBe('CLARIFY')
    })

    it('应该能够处理低置信度', async () => {
      mockLLMClient.chatWithSchema.mockResolvedValue({
        intent: 'DRAFT_FULL',
        confidence: 0.5,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['测试'],
        },
      })

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '测试消息',
      }

      const result = await intentRecognizer.recognize(input)

      expect(result.intent).toBe('CLARIFY')
      expect(result.clarifyQuestion).toBeDefined()
    })
  })
})
