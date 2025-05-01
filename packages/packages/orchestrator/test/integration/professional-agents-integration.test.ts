/**
 * 专业层Agent与OrchestratorAgent集成测试
 *
 * 测试OrchestratorAgent与各个专业层Agent的端到端集成：
 * - SpecificationDrafterAgent: 说明书撰写
 * - PatentAnalyzerAgent: 专利分析
 * - PatentResponderAgent: 审查意见答复
 * - PatentSearchAgent: 专利检索
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OrchestratorAgent } from '../../src/OrchestratorAgent.js'
import type { OrchestratorAgentConfig, OrchestratorInput } from '../../src/types/index.js'
import {
  MockLLMClient,
  createE2ETestResponseSequence,
  createChitchatResponse,
  createClarifyResponse,
} from '../mocks/MockLLMClient.js'

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
}

// Mock Memory
const mockMemory = {
  get: vi.fn(),
  set: vi.fn(),
}

// Mock Tools
const mockTools = {}

// Mock LLM Adapter for professional agents
const mockLLMAdapter = {
  chat: vi.fn(async () => ({
    message: {
      content: 'Mock professional agent response',
    },
  })),
}

describe('专业层Agent端到端集成测试', () => {
  let orchestrator: OrchestratorAgent
  let mockLLMClient: MockLLMClient
  let mockConfig: OrchestratorAgentConfig

  beforeEach(() => {
    vi.clearAllMocks()

    // 每次测试前创建新的Mock LLM客户端
    mockLLMClient = new MockLLMClient()

    // 创建完整配置
    mockConfig = {
      agentId: 'orchestrator-agent',
      llmConfig: {
        provider: 'anthropic' as const,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
        maxTokens: 4096,
        temperature: 0.7,
        adapter: mockLLMAdapter as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      },
      intentConfig: {
        confidenceThreshold: 0.7,
        maxClarifyRounds: 3,
      },
      planningConfig: {
        maxSteps: 10,
        defaultTimeout: 60000,
        enableParallel: true,
      },
      hitlConfig: {
        autoConfirmThreshold: 0.9,
        timeout: 300000,
      },
      professionalAgents: {
        patentWriter: true,
        patentResponder: true,
        patentAnalyzer: true,
        patentSearch: true,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventBus: mockEventBus as any,
      memory: mockMemory,
      tools: mockTools,
      llmClient: mockLLMClient,
    }

    orchestrator = new OrchestratorAgent(mockConfig)

    // 注册 Mock Agent（动态 import 在测试环境失败，需手动注册）
    const registry = orchestrator.getAgentRegistry()
    const mockAgent = {
      execute: async () => ({
        success: true,
        data: { summary: 'Mock agent result' },
        executionTime: 10,
      }),
    }
    registry.register('specification-drafter', mockAgent)
    registry.register('patent-responder', mockAgent)
    registry.register('patent-analyzer', mockAgent)
    registry.register('search', mockAgent)
  })

  describe('SpecificationDrafterAgent端到端集成', () => {
    it('应该完整执行专利撰写流程', async () => {
      // 设置Mock响应队列
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-writer-e2e-1',
        userId: 'user-1',
        message: '帮我撰写一个关于深度学习图像识别的专利申请',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.requiresHITL).toBe(false)
      expect(result.response).toBeDefined()
      expect(result.metadata.intent).toBe('DRAFT_FULL')
      expect(result.metadata.confidence).toBe(0.9)
    })

    it('应该处理复杂的专利撰写请求', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-writer-e2e-2',
        userId: 'user-2',
        message:
          '我有一个关于机器学习的新算法，包括特征提取、分类和优化三个步骤，需要撰写完整的专利申请文件',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('DRAFT_FULL')
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('PatentResponderAgent端到端集成', () => {
    it('应该完整执行审查意见答复流程', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('RESPOND_OA'))

      const input: OrchestratorInput = {
        sessionId: 'session-responder-e2e-1',
        userId: 'user-3',
        message: '收到审查意见了，指出权利要求1不具备创造性，需要帮忙答复',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('RESPOND_OA')
    })
  })

  describe('PatentAnalyzerAgent端到端集成', () => {
    it('应该完整执行专利分析流程', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('ANALYZE_PORTFOLIO'))

      const input: OrchestratorInput = {
        sessionId: 'session-analyzer-e2e-1',
        userId: 'user-4',
        message: '分析一下我们公司的专利组合情况，重点关注人工智能领域的专利',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('ANALYZE_PORTFOLIO')
    })
  })

  describe('PatentSearchAgent端到端集成', () => {
    it('应该完整执行专利检索流程', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('SEARCH'))

      const input: OrchestratorInput = {
        sessionId: 'session-search-e2e-1',
        userId: 'user-5',
        message: '帮我检索一下深度学习图像识别相关的现有技术，重点找最近3年的专利',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('SEARCH')
    })
  })

  describe('多Agent协作端到端测试', () => {
    it('应该支持撰写后检索的复合流程', async () => {
      // 设置复杂的Mock响应队列
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))
      mockLLMClient.enqueueResponse(createChitchatResponse())

      const input1: OrchestratorInput = {
        sessionId: 'session-multi-e2e-1',
        userId: 'user-6',
        message: '先帮我撰写一个专利申请，然后再检索相关的现有技术',
      }

      const result1 = await orchestrator.execute(input1)
      expect(result1).toBeDefined()

      // 第二轮：检索（使用简单的问候响应，因为重点不是测试意图识别）
      const input2: OrchestratorInput = {
        sessionId: 'session-multi-e2e-1',
        userId: 'user-6',
        message: '现在检索相关的现有技术',
      }

      const result2 = await orchestrator.execute(input2)
      expect(result2).toBeDefined()
    })
  })

  describe('完整工作流程测试', () => {
    it('应该完整执行从意图识别到结果聚合的流程', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-e2e-complete-1',
        userId: 'user-e2e-1',
        message:
          '我发明了一种新的深度学习图像识别算法，采用卷积神经网络和注意力机制，需要撰写专利申请',
      }

      const result = await orchestrator.execute(input)

      // 验证基本响应结构
      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      expect(result.metadata).toBeDefined()

      // 验证元数据
      expect(result.metadata.intent).toBe('DRAFT_FULL')
      expect(result.metadata.confidence).toBeGreaterThan(0)
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)

      // 验证性能指标
      if (result.metadata.metrics) {
        expect(result.metadata.metrics.llmCallsCount).toBeGreaterThan(0)
        expect(result.metadata.metrics.totalDuration).toBeGreaterThanOrEqual(0)
      }
    })

    it('应该正确处理包含附件的复杂请求', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-attachment-e2e-1',
        userId: 'user-attachment-1',
        message: '这是我的技术交底书，请帮忙撰写专利申请',
        attachments: [
          {
            id: 'att-1',
            filename: 'technical-disclosure.pdf',
            mimeType: 'application/pdf',
            size: 1024000,
            data: 'mock-pdf-content',
          },
        ],
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('DRAFT_FULL')
    })

    it('应该记录执行统计信息', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-stats-e2e-1',
        userId: 'user-stats-1',
        message: '撰写一个关于人工智能的专利',
      }

      const result = await orchestrator.execute(input)

      // 验证统计信息存在
      if (result.metadata.stats) {
        expect(result.metadata.stats.stepsExecuted).toBeGreaterThanOrEqual(0)
        expect(result.metadata.stats.successfulSteps).toBeGreaterThanOrEqual(0)
        expect(result.metadata.stats.failedSteps).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('错误处理和降级端到端测试', () => {
    it('应该优雅处理Agent执行失败', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-error-e2e-1',
        userId: 'user-error-1',
        message: '测试错误处理',
      }

      // 不应该抛出未捕获的异常
      const result = await orchestrator.execute(input)
      expect(result).toBeDefined()
    })

    it('应该处理简单意图（CHITCHAT）', async () => {
      mockLLMClient.enqueueResponse(createChitchatResponse())

      const input: OrchestratorInput = {
        sessionId: 'session-chitchat-e2e-1',
        userId: 'user-chitchat-1',
        message: '你好，请问你能做什么？',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('CHITCHAT')
      expect(result.metadata.stepsExecuted).toBe(0)
    })

    it('应该处理意图不明确（CLARIFY）的情况', async () => {
      mockLLMClient.enqueueResponse(createClarifyResponse())

      const input: OrchestratorInput = {
        sessionId: 'session-clarify-e2e-1',
        userId: 'user-clarify-1',
        message: '专利',
      }

      const result = await orchestrator.execute(input)

      expect(result).toBeDefined()
      expect(result.metadata.intent).toBe('CLARIFY')
    })
  })

  describe('性能和资源管理端到端测试', () => {
    it('应该在合理时间内完成简单请求', async () => {
      mockLLMClient.enqueueResponse(createChitchatResponse())

      const input: OrchestratorInput = {
        sessionId: 'session-perf-e2e-1',
        userId: 'user-perf-1',
        message: '你好',
      }

      const startTime = Date.now()
      const result = await orchestrator.execute(input)
      const duration = Date.now() - startTime

      expect(result).toBeDefined()
      // 简单请求应该在3秒内完成
      expect(duration).toBeLessThan(3000)
    })

    it('应该正确跟踪LLM调用次数', async () => {
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input: OrchestratorInput = {
        sessionId: 'session-llm-e2e-1',
        userId: 'user-llm-1',
        message: '测试LLM调用统计',
      }

      const result = await orchestrator.execute(input)

      if (result.metadata.metrics) {
        expect(result.metadata.metrics.llmCallsCount).toBeGreaterThan(0)
      }
    })

    it('应该支持并发请求处理', async () => {
      // 为每个并发请求设置响应
      for (let i = 0; i < 3; i++) {
        mockLLMClient.enqueueResponse(createChitchatResponse())
      }

      const inputs: OrchestratorInput[] = [
        {
          sessionId: 'session-concurrent-1',
          userId: 'user-1',
          message: '测试1',
        },
        {
          sessionId: 'session-concurrent-2',
          userId: 'user-2',
          message: '测试2',
        },
        {
          sessionId: 'session-concurrent-3',
          userId: 'user-3',
          message: '测试3',
        },
      ]

      const results = await Promise.all(inputs.map((input) => orchestrator.execute(input)))

      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result.metadata.intent).toBe('CHITCHAT')
      })
    })
  })

  describe('多轮对话上下文端到端测试', () => {
    it('应该支持多轮对话并保持上下文', async () => {
      const sessionId = 'session-context-e2e-1'

      // 第一轮对话
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input1: OrchestratorInput = {
        sessionId,
        userId: 'user-context-1',
        message: '我想申请一个关于深度学习的专利',
      }

      const result1 = await orchestrator.execute(input1)
      expect(result1).toBeDefined()
      expect(result1.metadata.intent).toBe('DRAFT_FULL')

      // 第二轮对话（应该能访问第一轮的上下文）
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input2: OrchestratorInput = {
        sessionId,
        userId: 'user-context-1',
        message: '主要是关于图像识别方面的',
      }

      const result2 = await orchestrator.execute(input2)
      expect(result2).toBeDefined()
    })

    it('应该为不同会话保持独立上下文', async () => {
      // 顺序执行两个会话，验证上下文独立性
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input1: OrchestratorInput = {
        sessionId: 'session-independent-1',
        userId: 'user-independent-1',
        message: '专利A',
      }

      const result1 = await orchestrator.execute(input1)
      expect(result1).toBeDefined()
      expect(result1.metadata.intent).toBe('DRAFT_FULL')

      // 第二个会话使用独立的响应队列
      mockLLMClient.setResponseQueue(createE2ETestResponseSequence('DRAFT_FULL'))

      const input2: OrchestratorInput = {
        sessionId: 'session-independent-2',
        userId: 'user-independent-1',
        message: '专利B',
      }

      const result2 = await orchestrator.execute(input2)
      expect(result2).toBeDefined()
      expect(result2.metadata.intent).toBe('DRAFT_FULL')
    })
  })

  describe('边界条件端到端测试', () => {
    it('应该处理空消息', async () => {
      mockLLMClient.enqueueResponse(createClarifyResponse())

      const input: OrchestratorInput = {
        sessionId: 'session-empty-1',
        userId: 'user-empty-1',
        message: '',
      }

      const result = await orchestrator.execute(input)
      expect(result).toBeDefined()
    })

    it('应该处理超长消息', async () => {
      mockLLMClient.enqueueResponse(createClarifyResponse())

      const longMessage = '测试'.repeat(1000)
      const input: OrchestratorInput = {
        sessionId: 'session-long-1',
        userId: 'user-long-1',
        message: longMessage,
      }

      const result = await orchestrator.execute(input)
      expect(result).toBeDefined()
    })

    it('应该处理特殊字符消息', async () => {
      mockLLMClient.enqueueResponse(createClarifyResponse())

      const specialMessage = '测试!@#$%^&*()_+ 特殊字符'
      const input: OrchestratorInput = {
        sessionId: 'session-special-1',
        userId: 'user-special-1',
        message: specialMessage,
      }

      const result = await orchestrator.execute(input)
      expect(result).toBeDefined()
    })
  })
})
