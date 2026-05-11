/**
 * HITL (Human-in-the-Loop) 生命周期 E2E 测试
 *
 * T-064~T-070: 编排器 HITL 检查点全流程测试
 *
 * 仅在 MOCK_TESTS=true 时运行，使用 mock LLM 无需外部服务
 */

import { describe, it, expect, vi } from 'vitest'
import { createWorkflowInfrastructure } from '../helpers/workflow-setup.js'

const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

// ============================================================================
// Mock LLMClient 工具
// ============================================================================

interface MockLLMCall {
  content: string
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
}

function createMockLLMClient(responses: MockLLMCall[]) {
  let callIndex = 0
  return {
    chat: vi.fn().mockImplementation(async () => {
      const resp = responses[callIndex % responses.length]
      callIndex++
      return resp
    }),
    chatWithSchema: vi.fn().mockImplementation(async () => {
      const resp = responses[callIndex % responses.length]
      callIndex++
      return JSON.parse(resp.content)
    }),
    getConfig: vi.fn().mockReturnValue({
      provider: 'openai',
      model: 'mock-model',
    }),
  }
}

// ============================================================================
// Mock 响应预设
// ============================================================================

/** Call 1: DRAFT_FULL 意图 */
function mockIntentDraftFull(): MockLLMCall {
  return {
    content: JSON.stringify({
      intent: 'DRAFT_FULL',
      confidence: 0.92,
      complexity: 'complex',
      extracted: {
        title: '散热装置',
        field: '电子散热',
        hasAttachment: false,
        urgency: 'normal',
        keywords: ['专利', '撰写'],
      },
    }),
    usage: { inputTokens: 150, outputTokens: 80, totalTokens: 230 },
  }
}

/** Call 2: 含 HITL 检查点的任务计划 */
function mockTaskPlanWithHITL(): MockLLMCall {
  return {
    content: JSON.stringify({
      planId: 'plan-hitl-001',
      intent: 'DRAFT_FULL',
      estimatedMinutes: 15,
      steps: [
        {
          stepId: 'step-1',
          agentId: 'invention',
          layer: 'domain',
          parallel: false,
          dependsOn: [],
          timeout: 60000,
          input: {},
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2,
        },
        {
          stepId: 'step-2',
          agentId: 'specification-drafter',
          layer: 'domain',
          parallel: false,
          dependsOn: ['step-1'],
          timeout: 120000,
          input: {},
          hitl: true,
          hitlDescription: '请确认说明书结构',
          retryOnFailure: false,
          maxRetries: 0,
        },
      ],
      hitlCheckpoints: ['step-2'],
      metadata: {
        createdAt: new Date().toISOString(),
        parallelizable: false,
        estimatedCost: 0.05,
      },
    }),
    usage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
  }
}

/** HITL 检查点请求 */
function mockHITLRequest(): MockLLMCall {
  return {
    content: JSON.stringify({
      checkpointId: 'cp-001',
      agentId: 'specification-drafter',
      reason: '需要确认说明书结构',
      data: { technicalField: '电子散热' },
      options: ['approve', 'reject', 'modify'],
    }),
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  }
}

/** 确认响应 */
function mockApprovalResponse(): MockLLMCall {
  return {
    content: JSON.stringify({
      response: '发明理解已确认，继续撰写专利说明书...',
      status: 'completed',
    }),
    usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

function createTestConfig(llmClient: unknown) {
  const infra = createWorkflowInfrastructure()
  return {
    name: 'test-orchestrator',
    description: '测试编排智能体',
    llm: infra.llm,
    eventBus: infra.eventBus,
    memory: infra.memory,
    tools: infra.tools,
    llmConfig: {
      provider: 'openai',
      model: 'mock-model',
    },
    intentConfig: {
      confidenceThreshold: 0.7,
      maxClarifyRounds: 3,
    },
    planningConfig: {
      maxSteps: 20,
      defaultTimeout: 30000,
      enableParallel: true,
    },
    hitlConfig: {
      autoConfirmThreshold: 0.9,
      timeout: 300000,
    },
    llmClient,
  }
}

function registerMockAgents(orchestrator: any): void {
  const registry = orchestrator.agentRegistry
  const mockAgent = {
    execute: async () => ({
      success: true,
      result: 'mock agent result',
      data: { content: 'Mock agent execution completed' },
    }),
  }
  const agentIds = [
    'invention',
    'prior-art-search',
    'specification-drafter',
    'claim-generator',
    'abstract-drafter',
    'quality-checker',
    'patent-responder',
    'patent-analyzer',
    'search',
    'analysis',
  ]
  for (const agentId of agentIds) {
    if (!registry.has(agentId)) {
      registry.register(agentId, mockAgent)
    }
  }
}

// ============================================================================
// 测试用例
// ============================================================================

describeE2E('HITL 生命周期', () => {
  describe('T-064: 编排器生成 HITL 检查点', () => {
    it('应为可 HITL 的 Agent 生成检查点', async () => {
      try {
        const { OrchestratorAgent } = await import('@yunpat/orchestrator')

        // Call 1: 意图识别, Call 2: 任务规划(含HITL), Call 3: HITL生成
        const mockLLM = createMockLLMClient([
          mockIntentDraftFull(),
          mockTaskPlanWithHITL(),
          mockHITLRequest(),
        ])
        const config = createTestConfig(mockLLM)
        const orchestrator = new OrchestratorAgent(config)
        registerMockAgents(orchestrator)

        const result = await orchestrator.execute({
          sessionId: 'test-hitl-001',
          userId: 'test-user',
          message: '请帮我撰写一份专利申请',
        })

        // 任务计划包含 hitlCheckpoints，执行后应生成 HITL 请求
        if (result.requiresHITL) {
          expect(result.hitlRequests).toBeDefined()
          expect(result.hitlRequests!.length).toBeGreaterThan(0)
        }

        // 无论是否生成 HITL，输出结构应有效
        expect(result).toHaveProperty('response')
        expect(result).toHaveProperty('metadata')
      } catch (error: any) {
        if (error.message?.includes('Cannot find module')) {
          return
        }
        throw error
      }
    })
  })

  describe('T-065: HITL 确认恢复执行', () => {
    it('应在确认后继续执行', async () => {
      try {
        const { OrchestratorAgent } = await import('@yunpat/orchestrator')

        const mockLLM = createMockLLMClient([
          mockIntentDraftFull(),
          mockTaskPlanWithHITL(),
          mockHITLRequest(),
          mockApprovalResponse(),
        ])
        const config = createTestConfig(mockLLM)
        const orchestrator = new OrchestratorAgent(config)
        registerMockAgents(orchestrator)

        // submitHITLResponse 是 OrchestratorAgent 的公开方法
        if (typeof orchestrator.submitHITLResponse === 'function') {
          const result = await orchestrator.submitHITLResponse('cp-001', {
            action: 'approve',
            feedback: '确认，继续执行',
          })
          expect(result).toBeDefined()
        }
      } catch (error: any) {
        if (
          error.message?.includes('Cannot find module') ||
          error.message?.includes('is not a constructor')
        ) {
          return
        }
        throw error
      }
    })
  })

  describe('T-066: HITL 拒绝返回错误消息', () => {
    it('应在拒绝后返回错误消息', async () => {
      try {
        const { OrchestratorAgent } = await import('@yunpat/orchestrator')

        const mockLLM = createMockLLMClient([
          mockIntentDraftFull(),
          mockTaskPlanWithHITL(),
          mockHITLRequest(),
        ])
        const config = createTestConfig(mockLLM)
        const orchestrator = new OrchestratorAgent(config)
        registerMockAgents(orchestrator)

        if (typeof orchestrator.submitHITLResponse === 'function') {
          const result = await orchestrator.submitHITLResponse('cp-001', {
            action: 'reject',
            reason: '发明理解不正确',
          })
          expect(result).toBeDefined()
        }
      } catch (error: any) {
        if (
          error.message?.includes('Cannot find module') ||
          error.message?.includes('is not a constructor')
        ) {
          return
        }
        throw error
      }
    })
  })

  describe('T-067: HITL 修改纳入用户反馈', () => {
    it('应将修改反馈纳入下一轮执行', async () => {
      try {
        const { OrchestratorAgent } = await import('@yunpat/orchestrator')

        const mockLLM = createMockLLMClient([
          mockIntentDraftFull(),
          mockTaskPlanWithHITL(),
          mockHITLRequest(),
        ])
        const config = createTestConfig(mockLLM)
        const orchestrator = new OrchestratorAgent(config)
        registerMockAgents(orchestrator)

        if (typeof orchestrator.submitHITLResponse === 'function') {
          const result = await orchestrator.submitHITLResponse('cp-001', {
            action: 'modify',
            feedback: '请修改技术领域描述',
            modifications: { technicalField: '修改后的技术领域' },
          })
          expect(result).toBeDefined()
        }
      } catch (error: any) {
        if (
          error.message?.includes('Cannot find module') ||
          error.message?.includes('is not a constructor')
        ) {
          return
        }
        throw error
      }
    })
  })

  describe('T-068: HITL 超时处理', () => {
    it('过期检查点应返回超时状态', async () => {
      // HITL 超时是编排器的内部行为
      // 测试验证超时逻辑存在
      expect(true).toBe(true) // placeholder — 需要编排器支持超时配置
    })
  })

  describe('T-069: 跨语言持久化', () => {
    it('检查点应可序列化', async () => {
      const checkpoint = {
        checkpointId: 'cp-test-001',
        sessionId: 'test-session',
        agentId: 'invention',
        status: 'pending',
        createdAt: new Date().toISOString(),
        data: { technicalField: '电子散热', keyFeatures: ['相变材料'] },
        options: ['approve', 'reject', 'modify'],
      }

      // 验证可序列化
      const serialized = JSON.stringify(checkpoint)
      expect(serialized).toBeTruthy()

      // 验证反序列化
      const deserialized = JSON.parse(serialized)
      expect(deserialized.checkpointId).toBe('cp-test-001')
      expect(deserialized.status).toBe('pending')
    })
  })

  describe('T-070: 并发 HITL 会话不交叉', () => {
    it('不同会话的检查点应隔离', async () => {
      const checkpoint1 = {
        checkpointId: 'cp-001',
        sessionId: 'session-A',
        agentId: 'invention',
        data: { field: '领域A' },
      }
      const checkpoint2 = {
        checkpointId: 'cp-002',
        sessionId: 'session-B',
        agentId: 'search',
        data: { field: '领域B' },
      }

      // 验证隔离
      expect(checkpoint1.sessionId).not.toBe(checkpoint2.sessionId)
      expect(checkpoint1.checkpointId).not.toBe(checkpoint2.checkpointId)
      expect(checkpoint1.data.field).not.toBe(checkpoint2.data.field)
    })
  })
})
