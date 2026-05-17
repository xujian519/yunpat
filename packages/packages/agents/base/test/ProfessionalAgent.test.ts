/**
 * ProfessionalAgent 基类单元测试
 *
 * 测试核心行为：run() 成功/失败路径、callLLM() Prompt 组装、
 * autoCompactIfNeeded() 压缩触发、validateInput() 输入校验、formatErrorMessage() 错误格式化
 */

import { describe, it, expect, vi } from 'vitest'
import {
  ProfessionalAgent,
  type ExtendedExecutionContext,
  type ProfessionalAgentConfig,
  type LLMCallParams,
} from '../src/ProfessionalAgent.js'
import {
  type ExecutionContext,
  type LLMAdapter,
  type ChatResponse,
  type MemoryStore,
  type IEventBus,
  type IToolRegistry,
  type LifecycleStage,
} from '@yunpat/core'
import type { AgentError } from '../src/types.js'

// ============================================================================
// 测试用子类 — 实现 abstract plan() 和 act()
// ============================================================================

class TestableAgent extends ProfessionalAgent<string, string> {
  protected async plan(_input: string, _context: ExecutionContext): Promise<unknown> {
    return { steps: ['step1'] }
  }

  protected async act(_plan: unknown, _context: ExtendedExecutionContext): Promise<string> {
    return 'acted'
  }
}

class FailingAgent extends ProfessionalAgent<string, string> {
  protected async plan(_input: string, _context: ExecutionContext): Promise<unknown> {
    return {}
  }

  protected async act(_plan: unknown, _context: ExtendedExecutionContext): Promise<string> {
    throw new Error('act failed: boom')
  }
}

// ============================================================================
// Mock 工厂
// ============================================================================

function createMockLLM(): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({
      message: { role: 'assistant' as const, content: 'mock LLM response' },
    } satisfies ChatResponse),
    chatStream: vi.fn(),
    embed: vi.fn(),
  }
}

function createMockEventBus(): IEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn().mockReturnValue({ id: 'mock-sub', pattern: '*', handler: vi.fn(), unsubscribe: vi.fn() }),
    unsubscribe: vi.fn(),
    request: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockMemory(): MemoryStore {
  return {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue({}),
    setAll: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  }
}

function createMockToolRegistry(): IToolRegistry {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn().mockReturnValue(undefined),
    call: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockReturnValue([]),
  }
}

function createMockContext(): ExtendedExecutionContext {
  return {
    executionId: 'test-exec-id',
    agentName: 'test-agent',
    startTime: new Date(),
    currentStage: 'executing' as LifecycleStage,
    memory: createMockMemory(),
    eventBus: createMockEventBus(),
    tools: createMockToolRegistry(),
    llm: createMockLLM(),
    metadata: {},
    sharedState: new Map(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  }
}

function createBaseConfig(overrides?: Partial<ProfessionalAgentConfig>): ProfessionalAgentConfig {
  return {
    name: 'test-agent',
    description: 'Test agent for unit testing',
    llm: createMockLLM(),
    eventBus: createMockEventBus(),
    memory: createMockMemory(),
    tools: createMockToolRegistry(),
    enableKnowledgeGraph: false,
    ...overrides,
  }
}

// ============================================================================
// 测试
// ============================================================================

describe('ProfessionalAgent', () => {
  describe('run()', () => {
    it('成功时返回 AgentResult<TOutput>，error 为 undefined', async () => {
      const agent = new TestableAgent(createBaseConfig())
      const context = createMockContext()

      const result = await agent.run('test-input', context)

      expect(result.success).toBe(true)
      expect(result.data).toBe('acted')
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    })

    it('失败时返回结构化 AgentError（含 code、message、retryable）', async () => {
      const agent = new FailingAgent(createBaseConfig())
      const context = createMockContext()

      const result = await agent.run('test-input', context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      const err = result.error as AgentError
      expect(err.code).toBeDefined()
      expect(err.message).toContain('boom')
      expect(typeof err.retryable).toBe('boolean')
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('通过 context.logger 记录执行日志', async () => {
      const agent = new TestableAgent(createBaseConfig())
      const context = createMockContext()

      await agent.run('test-input', context)

      expect(context.logger!.info).toHaveBeenCalled()
      const infoCalls = (context.logger!.info as ReturnType<typeof vi.fn>).mock.calls
      expect(infoCalls.some((c: string[]) => c[0].includes('[test-agent]'))).toBe(true)
    })

    it('失败时通过 logger 记录错误和错误码', async () => {
      const agent = new FailingAgent(createBaseConfig())
      const context = createMockContext()

      await agent.run('test-input', context)

      expect(context.logger!.error).toHaveBeenCalled()
      const errorCalls = (context.logger!.error as ReturnType<typeof vi.fn>).mock.calls
      const loggedObj = errorCalls[0][1] as Record<string, unknown>
      expect(loggedObj.code).toBeDefined()
      expect(loggedObj.error).toContain('boom')
    })
  })

  describe('callLLM()', () => {
    it('未配置管道时直接传递消息给 LLM', async () => {
      const mockLLM = createMockLLM()
      const agent = new TestableAgent(
        createBaseConfig({ llm: mockLLM, usePromptPipeline: false })
      )

      const result = await (agent as unknown as { callLLM: (p: LLMCallParams) => Promise<string> }).callLLM({
        messages: [
          { role: 'system', content: 'original prompt' },
          { role: 'user', content: 'hello' },
        ],
      })

      expect(result).toBe('mock LLM response')
      expect(mockLLM.chat).toHaveBeenCalledTimes(1)
    })

    it('配置管道时组装 system prompt', async () => {
      const mockLLM = createMockLLM()
      const agent = new TestableAgent(
        createBaseConfig({
          llm: mockLLM,
          usePromptPipeline: true,
        })
      )

      await (agent as unknown as { callLLM: (p: LLMCallParams) => Promise<string> }).callLLM({
        messages: [
          { role: 'system', content: 'original prompt' },
          { role: 'user', content: 'user query' },
        ],
      })

      expect(mockLLM.chat).toHaveBeenCalled()
      const chatMock = vi.mocked(mockLLM.chat)
      const callArgs = chatMock.mock.calls[0][0]
      // pipeline 组装后 system prompt 不再是原始的 'original prompt'
      expect(callArgs.messages[0].content).not.toBe('original prompt')
    })

    it('LLM 调用失败时抛出包装后的错误', async () => {
      const mockLLM: LLMAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('network error')),
        chatStream: vi.fn(),
        embed: vi.fn(),
      }
      const agent = new TestableAgent(createBaseConfig({ llm: mockLLM }))

      await expect(
        (agent as unknown as { callLLM: (p: LLMCallParams) => Promise<string> }).callLLM({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('LLM调用失败')
    })
  })

  describe('autoCompactIfNeeded()', () => {
    it('enableAutoCompact=false 时原样返回消息', async () => {
      const agent = new TestableAgent(createBaseConfig({ enableAutoCompact: false }))

      const messages = [
        { role: 'system' as const, content: 'system' },
        { role: 'user' as const, content: 'hello' },
      ]

      const result = await (agent as unknown as { autoCompactIfNeeded: (m: typeof messages) => Promise<typeof messages> }).autoCompactIfNeeded(messages)
      expect(result).toEqual(messages)
    })

    it('enableAutoCompact=true 但未超阈值时原样返回消息', async () => {
      const agent = new TestableAgent(
        createBaseConfig({
          enableAutoCompact: true,
          tokenBudgetConfig: {
            contextWindow: 100000,
            safetyBuffer: 10000,
          },
        })
      )

      const messages = [
        { role: 'system' as const, content: 'short message' },
        { role: 'user' as const, content: 'hello' },
      ]

      const result = await (agent as unknown as { autoCompactIfNeeded: (m: typeof messages) => Promise<typeof messages> }).autoCompactIfNeeded(messages)
      expect(result).toEqual(messages)
    })
  })

  describe('validateInput()', () => {
    it('null 字段抛出错误', () => {
      const agent = new TestableAgent(createBaseConfig())

      expect(() =>
        (agent as unknown as { validateInput: (o: Record<string, unknown>, f: string[]) => void }).validateInput({ name: null, age: 25 }, ['name'])
      ).toThrow('name不能为空')
    })

    it('undefined 字段抛出错误', () => {
      const agent = new TestableAgent(createBaseConfig())

      expect(() =>
        (agent as unknown as { validateInput: (o: Record<string, unknown>, f: string[]) => void }).validateInput({ name: undefined }, ['name'])
      ).toThrow('name不能为空')
    })

    it('空字符串字段抛出错误', () => {
      const agent = new TestableAgent(createBaseConfig())

      expect(() =>
        (agent as unknown as { validateInput: (o: Record<string, unknown>, f: string[]) => void }).validateInput({ name: '' }, ['name'])
      ).toThrow('name不能为空')
    })

    it('有效字段不抛出', () => {
      const agent = new TestableAgent(createBaseConfig())

      expect(() =>
        (agent as unknown as { validateInput: (o: Record<string, unknown>, f: string[]) => void }).validateInput({ name: 'Alice', age: 30 }, ['name', 'age'])
      ).not.toThrow()
    })
  })

  describe('formatErrorMessage()', () => {
    it('格式化为 [agentName] context: message', () => {
      const agent = new TestableAgent(createBaseConfig({ name: 'my-agent' }))

      const result = (agent as unknown as { formatErrorMessage: (e: unknown, ctx: string) => string }).formatErrorMessage(new Error('timeout'), '执行阶段')

      expect(result).toBe('[my-agent] 执行阶段: timeout')
    })

    it('非 Error 对象使用 String() 转换', () => {
      const agent = new TestableAgent(createBaseConfig({ name: 'my-agent' }))

      const result = (agent as unknown as { formatErrorMessage: (e: unknown, ctx: string) => string }).formatErrorMessage('raw string', '测试')

      expect(result).toBe('[my-agent] 测试: raw string')
    })
  })
})
