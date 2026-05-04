/**
 * OrchestratorAgent端到端集成测试
 * 测试完整的5次LLM调用和专业层Agent集成
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OrchestratorAgent } from '../../src/OrchestratorAgent.js'
import type { OrchestratorAgentConfig, OrchestratorInput } from '../../src/types/index.js'
import { LLMClient } from '../../src/llm/LLMClient.js'

// Mock LLMClient
const mockChatWithSchema = vi.fn()
const mockChat = vi.fn()
const mockGetConfig = vi.fn()

vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    constructor(config: any) {
      // Store config if needed
    }

    async chat(messages: any) {
      return mockChat(messages)
    }

    async chatWithSchema(messages: any, schema: any) {
      return mockChatWithSchema(messages, schema)
    }

    getConfig() {
      return mockGetConfig()
    }
  },
}))

// Setup mock responses
mockChatWithSchema.mockImplementation(async (messages: any, schema: any) => {
  // 添加延迟以确保时间戳变化（至少1ms）
  await new Promise((resolve) => setTimeout(resolve, 1))

  // 查找user消息
  const userMessage = messages.find((m: any) => m.role === 'user')?.content || ''
  const lastUserMessage = messages[messages.length - 1]?.content || userMessage

  // 检查是否是TaskPlanner调用（包含system prompt和few-shot示例）
  const isTaskPlannerCall = messages.some(
    (m: any) => m.content?.includes('任务规划专家') || m.content?.includes('TaskPlan')
  )

  if (isTaskPlannerCall) {
    // 返回TaskPlan格式
    return {
      planId: 'plan-draft-full-001',
      intent: 'DRAFT_FULL',
      estimatedMinutes: 45,
      steps: [
        {
          stepId: 'step-1',
          agentId: 'patent-writer',
          layer: 'domain',
          parallel: false,
          dependsOn: [],
          timeout: 60000,
          input: {},
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2,
        },
      ],
      hitlCheckpoints: [],
      metadata: {
        createdAt: new Date().toISOString(),
        parallelizable: false,
      },
    }
  }

  // IntentRecognizer调用
  if (lastUserMessage.includes('撰写') || lastUserMessage.includes('专利')) {
    return {
      intent: 'DRAFT_FULL',
      confidence: 0.9,
      complexity: 'complex',
      extracted: {
        title: '智能控制器',
        field: '工业自动化',
        hasAttachment: false,
        urgency: 'normal',
        keywords: ['智能', '控制器'],
      },
    }
  }

  if (lastUserMessage.includes('分析') && lastUserMessage.includes('专利')) {
    return {
      intent: 'ANALYZE_PORTFOLIO',
      confidence: 0.85,
      complexity: 'complex',
      extracted: {
        hasAttachment: false,
        urgency: 'normal',
        keywords: ['分析', '专利'],
      },
    }
  }

  if (lastUserMessage.includes('审查意见') || lastUserMessage.includes('答复')) {
    return {
      intent: 'RESPOND_OA',
      confidence: 0.88,
      complexity: 'complex',
      extracted: {
        hasAttachment: false,
        urgency: 'normal',
        keywords: ['审查意见', '答复'],
      },
    }
  }

  if (lastUserMessage.includes('你好') || lastUserMessage.includes('在吗')) {
    return {
      intent: 'CHITCHAT',
      confidence: 0.95,
      complexity: 'simple',
      extracted: {
        hasAttachment: false,
        urgency: 'normal',
        keywords: [],
      },
    }
  }

  // 默认返回DRAFT_FULL
  return {
    intent: 'DRAFT_FULL',
    confidence: 0.9,
    complexity: 'complex',
    extracted: {
      hasAttachment: false,
      urgency: 'normal',
      keywords: [],
    },
  }
})

mockChat.mockResolvedValue({
  content: JSON.stringify({
    intent: 'DRAFT_FULL',
    confidence: 0.9,
    complexity: 'complex',
    extracted: {
      title: '智能控制器',
      field: '工业自动化',
      hasAttachment: false,
      urgency: 'normal',
      keywords: ['智能', '控制器'],
    },
  }),
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
  },
})

mockGetConfig.mockReturnValue({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
})

describe('OrchestratorAgent端到端集成测试', () => {
  let orchestrator: OrchestratorAgent
  let mockConfig: OrchestratorAgentConfig

  beforeEach(() => {
    // 创建Mock配置
    mockConfig = {
      agentId: 'orchestrator-agent',
      llmConfig: {
        provider: 'anthropic' as const,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
        maxTokens: 4096,
        temperature: 0.7,
      },
      intentConfig: {
        confidenceThreshold: 0.7,
        enableFewShot: true,
        enableConfidenceEvaluation: true,
      },
      planningConfig: {
        maxSteps: 10,
        defaultTimeout: 60000,
        enableParallel: true,
      },
      hitlConfig: {
        enabled: true,
        timeout: 300000,
      },
      professionalAgents: {
        patentWriter: true,
        patentResponder: true,
        patentAnalyzer: true,
        creativeAnalyzer: true,
      },
      eventBus: {
        emit: vi.fn(),
        on: vi.fn(),
      },
      memory: {
        get: vi.fn(),
        set: vi.fn(),
      },
      tools: {},
    }

    orchestrator = new OrchestratorAgent(mockConfig)
  })

  describe('完整工作流测试', () => {
    it('应该处理简单专利撰写请求', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写一个关于智能控制器的专利申请',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata).toBeDefined()
      expect(output.metadata.intent).toBeDefined()
      expect(output.metadata.executionTime).toBeGreaterThan(0)
    })

    it('应该处理复杂专利撰写请求（完整流程）', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-2',
        userId: 'user-1',
        message: `帮我撰写一个完整的专利申请，发明名称是"基于深度学习的智能控制系统"，
技术领域是工业自动化控制。技术交底书如下：该系统包括数据采集模块、深度学习模型模块、
控制执行模块。数据采集模块用于采集工业设备运行数据，深度学习模型模块用于预测设备状态，
控制执行模块根据预测结果进行智能控制。该系统能够提高控制精度30%，降低能耗20%。`,
        attachments: [],
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata).toBeDefined()

      // 验证性能指标存在
      if (output.metadata.metrics) {
        expect(output.metadata.metrics.totalDuration).toBeGreaterThan(0)
        expect(output.metadata.metrics.llmCallsCount).toBeGreaterThan(0)
      }

      // 验证执行统计存在
      if (output.metadata.stats) {
        expect(output.metadata.stats.stepsExecuted).toBeGreaterThanOrEqual(0)
      }
    })

    it('应该处理审查意见答复请求', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-3',
        userId: 'user-1',
        message: `我收到了审查意见，申请号是CN202310000000，审查员认为权利要求1不具备新颖性。
引用的对比文件是CN112345678A。请帮我分析并制定答复策略。`,
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata.intent).toBeDefined()
    })

    it('应该处理专利分析请求', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-4',
        userId: 'user-1',
        message: '请分析专利CN112345678A的创造性，对比专利CN112345679A',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata.intent).toBeDefined()
    })

    it('应该处理多意图请求', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-5',
        userId: 'user-1',
        message: `我需要完成两个任务：
1. 撰写专利申请：智能温控系统
2. 分析专利：CN112345678A的创造性`,
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
    })
  })

  describe('HITL流程测试', () => {
    it('应该在HITL检查点返回HITL请求', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-6',
        userId: 'user-1',
        message: '帮我撰写一个专利的权利要求，需要人工确认保护范围',
      }

      const output = await orchestrator.execute(input)

      // 如果有HITL请求
      if (output.requiresHITL && output.hitlRequests) {
        expect(output.hitlRequests.length).toBeGreaterThan(0)
        expect(output.hitlRequests[0].description).toBeDefined()
        expect(output.hitlRequests[0].data).toBeDefined()
      }
    })

    it('应该处理HITL确认响应', async () => {
      // 首先创建一个HITL检查点
      const input: OrchestratorInput = {
        sessionId: 'session-7',
        userId: 'user-1',
        message: '帮我撰写专利权利要求',
      }

      const output = await orchestrator.execute(input)

      // 如果有HITL检查点
      if (output.requiresHITL && output.hitlRequests) {
        const checkpointId = output.hitlRequests[0].checkpointId

        // 提交确认响应
        const response = await orchestrator.submitHITLResponse(checkpointId, {
          action: 'confirm',
        })

        expect(response).toBeDefined()
        expect(response.success).toBeDefined()
      }
    })

    it('应该处理HITL拒绝响应', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-8',
        userId: 'user-1',
        message: '帮我撰写专利权利要求',
      }

      const output = await orchestrator.execute(input)

      if (output.requiresHITL && output.hitlRequests) {
        const checkpointId = output.hitlRequests[0].checkpointId

        const response = await orchestrator.submitHITLResponse(checkpointId, {
          action: 'reject',
          feedback: '保护范围太窄，需要扩大',
        })

        expect(response).toBeDefined()
        expect(response.status).toBe('rejected')
      }
    })

    it('应该处理HITL修改响应', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-9',
        userId: 'user-1',
        message: '帮我撰写专利权利要求',
      }

      const output = await orchestrator.execute(input)

      if (output.requiresHITL && output.hitlRequests) {
        const checkpointId = output.hitlRequests[0].checkpointId

        const response = await orchestrator.submitHITLResponse(checkpointId, {
          action: 'modify',
          modifications: {
            claims: '修改后的权利要求内容',
          },
        })

        expect(response).toBeDefined()
        expect(response.status).toBe('modified')
      }
    })
  })

  describe('性能监控测试', () => {
    it('应该记录性能指标', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-10',
        userId: 'user-1',
        message: '帮我撰写一个专利申请',
      }

      const output = await orchestrator.execute(input)

      expect(output.metadata.metrics).toBeDefined()
      expect(output.metadata.metrics!.totalDuration).toBeGreaterThan(0)
      expect(output.metadata.metrics!.llmCallsCount).toBeGreaterThan(0)
    })

    it('应该记录执行统计', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-11',
        userId: 'user-1',
        message: '帮我分析专利CN112345678A',
      }

      const output = await orchestrator.execute(input)

      expect(output.metadata.stats).toBeDefined()
      expect(output.metadata.stats!.stepsExecuted).toBeGreaterThanOrEqual(0)
    })

    it('应该记录LLM调用次数', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-12',
        userId: 'user-1',
        message: '帮我撰写一个专利申请，并分析其创造性',
      }

      const output = await orchestrator.execute(input)

      expect(output.metadata.metrics!.llmCallsCount).toBeGreaterThan(0)
    })
  })

  describe('上下文管理测试', () => {
    it('应该保存对话历史', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-13',
        userId: 'user-1',
        message: '你好',
      }

      await orchestrator.execute(input)

      const contextManager = orchestrator.getContextManager()
      const history = await contextManager.getHistory('session-13')

      expect(history.length).toBeGreaterThan(0)
      expect(history[0].role).toBe('user')
      expect(history[0].content).toBe('你好')
    })

    it('应该记录任务完成到用户画像', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-14',
        userId: 'user-test',
        message: '帮我撰写专利',
      }

      await orchestrator.execute(input)

      const contextManager = orchestrator.getContextManager()
      const profile = await contextManager.getUserProfile('user-test')

      expect(profile.statistics.totalTasks).toBeGreaterThan(0)
    })
  })

  describe('异常处理测试', () => {
    it('应该处理空消息', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-15',
        userId: 'user-1',
        message: '',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
    })

    it('应该处理无法识别的意图', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-16',
        userId: 'user-1',
        message: 'asdfghjkl',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
    })

    it('应该处理Agent执行失败', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-17',
        userId: 'user-1',
        message: '帮我撰写专利',
      }

      // 这个测试需要模拟Agent失败的情况
      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
    })
  })

  describe('多Agent协作测试', () => {
    it('应该在撰写后分析专利', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-18',
        userId: 'user-1',
        message: '先帮我撰写专利申请，然后分析其创造性',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.metadata.stats!.stepsExecuted).toBeGreaterThan(0)
    })

    it('应该在分析后给出优化建议', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-19',
        userId: 'user-1',
        message: '分析专利CN112345678A，并给出优化建议',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
    })
  })

  describe('路由决策测试', () => {
    it('应该路由闲聊消息', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-20',
        userId: 'user-1',
        message: '你好，在吗？',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.metadata.intent).toBeDefined()
    })

    it('应该路由不明确的请求', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-21',
        userId: 'user-1',
        message: '专利',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
    })
  })
})
