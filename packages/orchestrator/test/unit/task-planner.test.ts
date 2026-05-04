/**
 * TaskPlanner单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TaskPlanner } from '../../src/planning/TaskPlanner.js'
import { LLMClient } from '../../src/llm/LLMClient.js'
import type { IntentRecognitionResult } from '../../src/types/index.js'

describe('TaskPlanner', () => {
  let taskPlanner: TaskPlanner
  let mockLLMClient: any

  beforeEach(() => {
    // 创建Mock LLM客户端
    mockLLMClient = {
      chatWithSchema: vi.fn(),
    }

    taskPlanner = new TaskPlanner(mockLLMClient, 20, 30000, true)
  })

  describe('简单意图规划', () => {
    it('应该为简单意图生成简单计划', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_CLAIMS',
        confidence: 0.9,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['权利要求'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan).toBeDefined()
      expect(plan.planId).toBeDefined()
      expect(plan.intent).toBe('DRAFT_CLAIMS')
      expect(plan.steps.length).toBe(1)
      expect(plan.hitlCheckpoints.length).toBe(0)
    })

    it('应该为SEARCH生成简单计划', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'SEARCH',
        confidence: 0.8,
        complexity: 'simple',
        extracted: {
          title: '智能控制器',
          field: '控制技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['检索', '搜索'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan.steps.length).toBe(1)
      expect(plan.steps[0].agentId).toBe('search-agent')
    })
  })

  describe('复杂意图规划', () => {
    it('应该为DRAFT_FULL生成默认计划', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '智能控制器',
          field: '控制技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['智能控制器', '撰写'],
        },
      }

      // Mock LLM失败
      mockLLMClient.chatWithSchema.mockRejectedValue(new Error('LLM error'))

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan).toBeDefined()
      expect(plan.intent).toBe('DRAFT_FULL')
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.hitlCheckpoints.length).toBeGreaterThan(0)
      expect(plan.metadata.parallelizable).toBe(true)
    })

    it('应该包含并行步骤', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '测试发明',
          field: '测试技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['测试'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      // 检查是否有并行步骤
      const parallelSteps = plan.steps.filter((s) => s.parallel)
      expect(parallelSteps.length).toBeGreaterThan(0)
    })

    it('应该设置HITL检查点', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '测试发明',
          field: '测试技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['测试'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan.hitlCheckpoints.length).toBeGreaterThan(0)
      expect(plan.hitlCheckpoints).toContain('draft-claims')
    })
  })

  describe('边界情况', () => {
    it('应该处理低置信度', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'CLARIFY',
        confidence: 0.3,
        complexity: 'simple',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: [],
        },
        clarifyQuestion: '请问需要什么帮助？',
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan).toBeDefined()
    })

    it('应该处理多意图', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'MULTI_INTENT',
        confidence: 0.7,
        complexity: 'complex',
        extracted: {
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['检索', '撰写'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan).toBeDefined()
      expect(plan.intent).toBe('MULTI_INTENT')
    })
  })

  describe('元数据', () => {
    it('应该设置正确的元数据', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        complexity: 'complex',
        extracted: {
          title: '测试发明',
          field: '测试技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['测试'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan.metadata).toBeDefined()
      expect(plan.metadata.createdAt).toBeInstanceOf(Date)
      expect(typeof plan.metadata.parallelizable).toBe('boolean')
    })
  })
})
