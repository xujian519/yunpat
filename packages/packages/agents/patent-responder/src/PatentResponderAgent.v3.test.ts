/**
 * PatentResponderAgent.v3 测试
 *
 * 测试Phase 5统一架构的PatentResponderAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatentResponderAgent } from './PatentResponderAgent.v3.js'
import type { LLMAdapter } from '@yunpat/core'

// Mock LLM
const mockLLM: LLMAdapter = {
  chat: vi.fn(async ({ messages }) => {
    const content = messages[messages.length - 1].content

    if (content.includes('分析以下审查意见')) {
      return {
        message: {
          content: JSON.stringify({
            summary: '审查意见认为权利要求1-3不具备创造性',
            keyIssues: [
              {
                type: 'inventiveness',
                description: '权利要求1与对比文件1的区别不明显',
                severity: 'high',
              },
              {
                type: 'support',
                description: '说明书缺少实验数据支持',
                severity: 'medium',
              },
            ],
            overcomeProbability: 65,
          }),
        },
      }
    }

    if (content.includes('请为以下审查意见制定答复策略')) {
      return {
        message: {
          content: JSON.stringify({
            overallStrategy: 'amend',
            successProbability: 70,
            keyArguments: [
              '权利要求1增加了"其特征在于..."的技术特征',
              '说明书实施例5-7提供了实验数据',
              '对比文件1未公开本发明的关键技术特征',
            ],
            suggestedAmendments: [
              {
                claimNumber: 1,
                currentText: '一种图像识别方法，包括步骤A和步骤B。',
                proposedText: '一种图像识别方法，包括步骤A、步骤B和步骤C，其中步骤C包括...',
                reason: '增加区别技术特征',
              },
            ],
            additionalEvidence: ['补充实验数据'],
            risks: ['修改后可能引入新的问题'],
          }),
        },
      }
    }

    if (content.includes('请撰写审查意见答复书')) {
      return {
        message: {
          content: `尊敬的审查员：

关于申请号${content.match(/申请号：([^\n]+)/)?.[1] || 'CN202310000000.0'}的审查意见，申请人现答复如下：

一、关于创造性的问题

审查员认为权利要求1-3不具备创造性。申请人认为，本发明与对比文件1存在显著区别...

二、关于说明书支持的问题

审查员认为说明书缺少实验数据。申请人认为，说明书实施例5-7已提供充分的数据支持...

综上所述，申请人请求审查员重新考虑本申请的可专利性。

此致
敬礼`,
        },
      }
    }

    return {
      message: { content: '' },
    }
  }),
} as any

// Mock 事件总线
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  publish: vi.fn(),
}

// Mock 内存
const mockMemory = {
  get: vi.fn(),
  set: vi.fn(),
}

// Mock 工具
const mockTools = {}

describe('PatentResponderAgent.v3', () => {
  let agent: PatentResponderAgent

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new PatentResponderAgent({
      llm: mockLLM,
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
    })
  })

  describe('run方法 - 完整答复流程', () => {
    it('应该执行默认答复策略', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '一种基于深度学习的图像识别方法',
          notificationDate: '2024-01-15',
          deadline: '2024-04-15',
          officeActionContent: '权利要求1-3不具备创造性...',
          citedReferences: [
            {
              publicationNumber: 'CN112345678A',
              title: '对比文件1',
              relevance: '用于评价创造性',
            },
          ],
          rejectionTypes: ['inventiveness'],
        },
        originalApplication: {
          title: '一种基于深度学习的图像识别方法',
          claims: '1. 一种图像识别方法...\n2. 根据权利要求1所述的方法...',
          description: '本发明提供一种图像识别方法...',
          abstract: '本发明涉及图像识别技术领域...',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.analysis.summary).toContain('不具备创造性')
      expect(result.data.strategy.overallStrategy).toMatch(/argue|amend|abandon|appeal/)
      expect(result.data.responseDocument.responseLetter).toContain('尊敬的审查员')
      expect(result.data.nextSteps).toBeDefined()
      expect(result.data.metrics.duration).toBeGreaterThanOrEqual(0)
      expect(result.data.metrics.successProbability).toBeGreaterThan(0)
    })

    it('应该支持aggressive策略偏好', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '权利要求1不具备新颖性...',
          rejectionTypes: ['novelty'],
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '本发明提供...',
        },
        strategyPreference: 'aggressive' as const,
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.overallStrategy).toBeDefined()
    })
  })

  describe('审查意见分析', () => {
    it('应该识别关键问题', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '权利要求1-3不具备创造性，说明书不清楚...',
          rejectionTypes: ['inventiveness', 'clarity'],
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '本发明提供...',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.analysis.keyIssues).toBeDefined()
      expect(result.data.analysis.keyIssues.length).toBeGreaterThan(0)
      expect(result.data.analysis.overcomeProbability).toBeGreaterThanOrEqual(0)
      expect(result.data.analysis.overcomeProbability).toBeLessThanOrEqual(100)
    })

    it('应该评估可克服性', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '权利要求1具备创造性',
          rejectionTypes: [],
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '本发明提供...',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.analysis.overcomeProbability).toBeGreaterThan(0)
    })
  })

  describe('答复策略生成', () => {
    it('应该根据可克服性选择策略', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '权利要求1不具备创造性',
          rejectionTypes: ['inventiveness'],
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '本发明提供...',
        },
        strategyPreference: 'moderate' as const,
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.overallStrategy).toMatch(/argue|amend|abandon|appeal/)
      expect(result.data.strategy.keyArguments).toBeDefined()
      expect(result.data.strategy.successProbability).toBeGreaterThan(0)
    })

    it('应该生成修改建议', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '权利要求1不具备创造性',
          rejectionTypes: ['inventiveness'],
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...\n2. 根据权利要求1所述的方法...',
          description: '本发明提供...',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.suggestedAmendments).toBeDefined()
    })
  })

  describe('答复文档撰写', () => {
    it('应该撰写完整的答复书', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '权利要求1不具备创造性',
          rejectionTypes: ['inventiveness'],
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法，包括步骤A...',
          description: '本发明提供...',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.responseDocument.responseLetter).toContain('尊敬的审查员')
      expect(result.data.responseDocument.metrics.wordCount).toBeGreaterThan(0)
      expect(result.data.responseDocument.metrics.argumentCount).toBeGreaterThan(0)
      expect(result.data.responseDocument.metrics.generationTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理LLM调用失败', async () => {
      vi.mocked(mockLLM.chat).mockRejectedValueOnce(new Error('LLM调用失败'))

      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '测试审查意见',
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '测试描述',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该验证必填字段', async () => {
      const input = {
        officeAction: {
          applicationNumber: '',
          patentTitle: '',
          officeActionContent: '',
        },
        originalApplication: {
          title: '',
          claims: '',
          description: '',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('性能指标', () => {
    it('应该记录执行时间', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '测试审查意见',
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '测试描述',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.data.metrics.duration).toBeGreaterThanOrEqual(0)
    })

    it('应该计算策略合理性评分', async () => {
      const input = {
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '测试专利',
          officeActionContent: '测试审查意见',
        },
        originalApplication: {
          title: '测试专利',
          claims: '1. 一种测试方法...',
          description: '测试描述',
        },
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.metrics.strategyScore).toBeGreaterThanOrEqual(0)
      expect(result.data.metrics.strategyScore).toBeLessThanOrEqual(100)
    })
  })
})
