import { describe, it, expect, vi } from 'vitest'
import {
  EnhancedReflection,
  ReflectionDimension,
  QualityLevel,
} from '../../src/reasoning/EnhancedReflection.js'

describe('EnhancedReflection', () => {
  function createMockLLM() {
    return {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            score: 0.8,
            level: 'good',
            reasoning: '测试理由',
            issues: ['问题1'],
            evidence: ['证据1'],
          }),
        },
      }),
    } as any
  }

  function createMockContext() {
    return {
      agentName: 'test-agent',
      executionId: 'exec-1',
      currentStage: 'act',
      memory: {} as any,
      eventBus: { emit: vi.fn() } as any,
      tools: [],
      llm: createMockLLM(),
      metadata: {},
      sharedState: new Map(),
    } as any
  }

  describe('constructor', () => {
    it('应使用默认配置', () => {
      const reflection = new EnhancedReflection(createMockLLM())
      expect(reflection).toBeDefined()
    })

    it('应使用自定义配置', () => {
      const reflection = new EnhancedReflection(createMockLLM(), {
        maxIterations: 5,
        enabledDimensions: [ReflectionDimension.QUALITY],
      })
      expect(reflection).toBeDefined()
    })
  })

  describe('reflect', () => {
    it('应执行反思', async () => {
      const reflection = new EnhancedReflection(createMockLLM())
      const result = await reflection.reflect('测试输出', createMockContext(), '测试目标')

      expect(result).toBeDefined()
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(1)
    })

    it('应处理无目标的情况', async () => {
      const reflection = new EnhancedReflection(createMockLLM())
      const result = await reflection.reflect('测试输出', createMockContext())

      expect(result).toBeDefined()
    })

    it('应使用深度分析', async () => {
      const llm = createMockLLM()
      const reflection = new EnhancedReflection(llm, { useDeepAnalysis: true })
      const result = await reflection.reflect('测试输出', createMockContext(), '测试目标')

      expect(result).toBeDefined()
    })

    it('应禁用深度分析', async () => {
      const llm = createMockLLM()
      const reflection = new EnhancedReflection(llm, { useDeepAnalysis: false })
      const result = await reflection.reflect('测试输出', createMockContext(), '测试目标')

      expect(result).toBeDefined()
    })

    it('应记录历史', async () => {
      const reflection = new EnhancedReflection(createMockLLM(), { recordHistory: true })
      await reflection.reflect('测试输出', createMockContext(), '测试目标')

      const history = (reflection as any).history
      expect(history.length).toBeGreaterThan(0)
    })

    it('应禁用历史记录', async () => {
      const reflection = new EnhancedReflection(createMockLLM(), { recordHistory: false })
      await reflection.reflect('测试输出', createMockContext(), '测试目标')

      const history = (reflection as any).history
      expect(history.length).toBe(0)
    })
  })

  describe('getReflectionHistory', () => {
    it('应返回历史记录', () => {
      const reflection = new EnhancedReflection(createMockLLM())
      const history = reflection.getReflectionHistory()
      expect(history).toBeDefined()
      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('clearHistory', () => {
    it('应清空历史记录', async () => {
      const reflection = new EnhancedReflection(createMockLLM(), { recordHistory: true })
      await reflection.reflect('测试', createMockContext())
      reflection.clearHistory()

      const history = reflection.getReflectionHistory()
      expect(history.length).toBe(0)
    })
  })
})
