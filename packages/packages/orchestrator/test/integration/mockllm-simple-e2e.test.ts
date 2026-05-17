/**
 * 简化的端到端集成测试
 *
 * 专门验证MockLLMClient是否被正确使用
 */

import { describe, it, expect } from 'vitest'
import { OrchestratorAgent } from '../../src/OrchestratorAgent.js'
import type { OrchestratorAgentConfig, OrchestratorInput } from '../../src/types/index.js'
import { MockLLMClient, createClarifyResponse } from '../mocks/MockLLMClient.js'
import type { LLMAdapter, IEventBus } from '@yunpat/core'

// Mock EventBus
const mockEventBus = {
  emit: () => {},
  on: () => {},
  publish: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
  request: () => Promise.resolve(undefined),
} as unknown as IEventBus

// Mock Memory
const mockMemory = {
  get: () => {},
  set: () => {},
}

// Mock Tools
const mockTools = {}

// Mock LLM Adapter for professional agents
const mockLLMAdapter = {
  chat: async () => ({
    message: {
      content: 'Mock professional agent response',
    },
  }),
  chatStream: async function* () {
    yield { message: { content: '' } }
  },
  embed: async () => ({ embedding: [] }),
} as unknown as LLMAdapter

describe('简化MockLLMClient集成测试', () => {
  it('应该正确使用MockLLMClient', async () => {
    // 创建新的MockLLMClient
    const mockLLMClient = new MockLLMClient()

    // 设置一个CLARIFY响应
    mockLLMClient.enqueueResponse(createClarifyResponse())

    // 创建OrchestratorAgent配置
    const config: OrchestratorAgentConfig = {
      agentId: 'orchestrator-agent',
      llmConfig: {
        provider: 'anthropic' as const,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
        maxTokens: 4096,
        temperature: 0.7,
        adapter: mockLLMAdapter,
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
        patentWriter: false, // 禁用专业层Agent，只测试意图识别
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
      llmClient: mockLLMClient, // 注入MockLLMClient
    }

    const orchestrator = new OrchestratorAgent(config)

    // 执行一个简单的请求
    const input: OrchestratorInput = {
      sessionId: 'test-mock-1',
      userId: 'user-1',
      message: '测试消息',
    }

    const result = await orchestrator.execute(input)

    // 验证结果
    expect(result).toBeDefined()
    expect(result.metadata.intent).toBe('CLARIFY')
    expect(mockLLMClient.getCallCount()).toBeGreaterThan(0)

    console.log('✅ MockLLMClient被正确调用')
    console.log(`📞 LLM调用次数: ${mockLLMClient.getCallCount()}`)
    console.log(`🎯 识别的意图: ${result.metadata.intent}`)
  })

  it('应该支持多次独立请求', async () => {
    // 为每个请求创建独立的MockLLMClient
    const createOrchestrator = (intent: string) => {
      const llmClient = new MockLLMClient()
      llmClient.enqueueResponse({
        content: JSON.stringify({
          intent,
          confidence: 0.9,
          complexity: 'simple',
          extracted: {
            title: '测试',
            field: '测试',
            hasAttachment: false,
            urgency: 'normal',
            keywords: [],
          },
        }),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      })

      const config: OrchestratorAgentConfig = {
        agentId: 'orchestrator-agent',
        llmConfig: {
          provider: 'anthropic' as const,
          model: 'claude-3-5-sonnet-20241022',
          apiKey: 'test-key',
          maxTokens: 4096,
          temperature: 0.7,
          adapter: mockLLMAdapter,
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
          patentWriter: false,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventBus: mockEventBus,
        memory: mockMemory,
        tools: mockTools,
        llmClient,
      }

      return new OrchestratorAgent(config)
    }

    const orchestrator1 = createOrchestrator('CLARIFY')
    const orchestrator2 = createOrchestrator('CLARIFY')
    const orchestrator3 = createOrchestrator('DRAFT_FULL')

    const input1: OrchestratorInput = {
      sessionId: 'test-multi-1',
      userId: 'user-1',
      message: '请求1',
    }

    const input2: OrchestratorInput = {
      sessionId: 'test-multi-2',
      userId: 'user-2',
      message: '请求2',
    }

    const input3: OrchestratorInput = {
      sessionId: 'test-multi-3',
      userId: 'user-3',
      message: '请求3',
    }

    const result1 = await orchestrator1.execute(input1)
    const result2 = await orchestrator2.execute(input2)
    const result3 = await orchestrator3.execute(input3)

    // 验证返回了不同意图
    expect(result1.metadata.intent).toBe('CLARIFY')
    expect(result2.metadata.intent).toBe('CLARIFY')
    expect(result3.metadata.intent).toBe('DRAFT_FULL')

    console.log('✅ 多个独立Orchestrator实例工作正常')
    console.log(
      `🎯 意图序列: ${result1.metadata.intent} → ${result2.metadata.intent} → ${result3.metadata.intent}`
    )
  })

  it('应该在没有队列响应时返回默认响应', async () => {
    const mockLLMClient = new MockLLMClient()
    // 不设置任何响应队列

    const config: OrchestratorAgentConfig = {
      agentId: 'orchestrator-agent',
      llmConfig: {
        provider: 'anthropic' as const,
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
        maxTokens: 4096,
        temperature: 0.7,
        adapter: mockLLMAdapter,
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
        patentWriter: false,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
      llmClient: mockLLMClient,
    }

    const orchestrator = new OrchestratorAgent(config)

    const input: OrchestratorInput = {
      sessionId: 'test-default-1',
      userId: 'user-1',
      message: '测试默认响应',
    }

    const result = await orchestrator.execute(input)

    // 应该返回默认的CLARIFY响应
    expect(result).toBeDefined()
    expect(result.metadata.intent).toBe('CLARIFY')

    console.log('✅ 默认响应机制工作正常')
  })
})
