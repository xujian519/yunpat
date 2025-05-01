/**
 * Agent 基类测试
 *
 * 覆盖完整的生命周期钩子、事件发布、通信、错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent } from '../../src/agent/Agent.js'
import { EventBus } from '../../src/eventbus/EventBus.js'
import { ShortTermMemory } from '../../src/memory/MemoryStore.js'
import { ToolRegistry, ToolWrapper } from '../../src/tools/ToolRegistry.js'
import {
  createMockLLM,
  createMockToolRegistry,
  createTestAgent,
  TestAgent,
} from '../helpers/mocks.js'
import type { ExecutionContext, AgentEvent } from '../../src/lifecycle/Lifecycle.js'

/**
 * 灵活的测试 Agent，支持自定义 reflect 行为
 */
class FlexibleTestAgent extends Agent<string, string> {
  public callLog: string[] = []
  private shouldContinueReflect = false
  private reflectCount = 0

  constructor(eventBus: EventBus, options?: { shouldContinueReflect?: boolean }) {
    super({
      name: 'flexible-agent',
      description: 'Flexible test agent',
      eventBus,
      memory: new ShortTermMemory(),
      tools: createMockToolRegistry(),
      llm: createMockLLM(),
    })
    this.shouldContinueReflect = options?.shouldContinueReflect ?? false
  }

  protected async before(input: string) {
    this.callLog.push(`before:${input}`)
  }

  protected async init() {
    this.callLog.push('init')
  }

  protected async plan(input: string) {
    this.callLog.push('plan')
    return `plan: ${input}`
  }

  protected async act(plan: unknown) {
    this.callLog.push('act')
    return `result: ${String(plan)}`
  }

  protected async reflect(result: unknown) {
    this.callLog.push('reflect')
    this.reflectCount++
    if (this.shouldContinueReflect && this.reflectCount < 3) {
      return { shouldContinue: true, result }
    }
    return { shouldContinue: false, result }
  }

  protected async after(input: string, output: string) {
    this.callLog.push('after')
  }
}

describe('Agent', () => {
  describe('生命周期', () => {
    it('应按正确顺序调用所有钩子', async () => {
      const { agent } = createTestAgent()
      await agent.execute('test-input')

      expect(agent.callLog).toEqual([
        'before:test-input',
        'init',
        'plan',
        'act',
        'reflect',
        'after',
      ])
    })

    it('init 应只调用一次', async () => {
      const { agent } = createTestAgent()
      await agent.execute('first')
      await agent.execute('second')

      const initCalls = agent.callLog.filter((c) => c === 'init')
      expect(initCalls).toHaveLength(1)
    })

    it('无 before/init/reflect/after 时应正常执行', async () => {
      class MinimalAgent extends Agent<string, string> {
        protected async plan(input: string) {
          return input
        }
        protected async act(plan: unknown) {
          return `done: ${String(plan)}`
        }
        constructor() {
          super({
            name: 'minimal',
            description: 'minimal agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
      }

      const agent = new MinimalAgent()
      const result = await agent.execute('hello')

      expect(result).toBe('done: hello')
    })

    it('reset 后 init 应再次调用', async () => {
      const { agent } = createTestAgent()
      await agent.execute('first')
      agent.reset()
      agent.callLog = []
      await agent.execute('second')

      expect(agent.callLog).toContain('init')
    })
  })

  describe('act 循环', () => {
    it('reflect 返回 shouldContinue=true 时应继续循环', async () => {
      const eventBus = new EventBus()
      const agent = new FlexibleTestAgent(eventBus, { shouldContinueReflect: true })

      const result = await agent.execute('loop-test')

      // 应循环 3 次（reflect 在前 2 次返回 continue，第 3 次停止）
      const actCalls = agent.callLog.filter((c) => c === 'act')
      expect(actCalls.length).toBeGreaterThanOrEqual(2)
      expect(result).toBeDefined()
    })

    it('应受 maxIterations 限制', async () => {
      class LoopAgent extends Agent<string, string> {
        public iterations = 0
        constructor() {
          super({
            name: 'loop-agent',
            description: 'loop agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            maxIterations: 3,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          this.iterations++
          return 'result'
        }
        protected async reflect(result: unknown) {
          return { shouldContinue: true, result }
        }
      }

      const agent = new LoopAgent()
      await agent.execute('test')

      expect(agent.iterations).toBe(3)
    })

    it('默认 maxIterations 应为 10', async () => {
      class CountAgent extends Agent<string, string> {
        public iterations = 0
        constructor() {
          super({
            name: 'count-agent',
            description: 'count agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          this.iterations++
          return 'result'
        }
        protected async reflect(result: unknown) {
          return { shouldContinue: true, result }
        }
      }

      const agent = new CountAgent()
      await agent.execute('test')

      expect(agent.iterations).toBe(10)
    })
  })

  describe('事件发布', () => {
    it('应发布 agent:started 事件', async () => {
      const eventBus = new EventBus()
      const events: AgentEvent[] = []
      eventBus.subscribe('agent:started', async (e) => events.push(e))

      const { agent } = createTestAgent({ eventBus })
      await agent.execute('test')

      expect(events).toHaveLength(1)
      const data = events[0].data as Record<string, unknown>
      expect(data.input).toBe('test')
      expect(data.executionId).toBeDefined()
    })

    it('应发布 agent:completed 事件包含 duration 和 iterations', async () => {
      const eventBus = new EventBus()
      const events: AgentEvent[] = []
      eventBus.subscribe('agent:completed', async (e) => events.push(e))

      const { agent } = createTestAgent({ eventBus })
      await agent.execute('test')

      expect(events).toHaveLength(1)
      const data = events[0].data as Record<string, unknown>
      expect(data.duration).toBeTypeOf('number')
      expect(data.iterations).toBeTypeOf('number')
      expect(data.executionId).toBeDefined()
    })

    it('异常时应发布 agent:error 事件', async () => {
      const eventBus = new EventBus()
      const events: AgentEvent[] = []
      eventBus.subscribe('agent:error', async (e) => events.push(e))

      class ErrorAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'error-agent',
            description: 'error agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          throw new Error('plan failed')
        }
        protected async act() {
          return 'never'
        }
      }

      const agent = new ErrorAgent()
      await expect(agent.execute('test')).rejects.toThrow('plan failed')

      expect(events).toHaveLength(1)
      const data = events[0].data as Record<string, unknown>
      expect(data.error).toBe('plan failed')
    })

    it('每次迭代应发布 agent:progress 事件', async () => {
      const eventBus = new EventBus()
      const events: AgentEvent[] = []
      eventBus.subscribe('agent:progress', async (e) => events.push(e))

      const agent = new FlexibleTestAgent(eventBus, { shouldContinueReflect: true })
      await agent.execute('progress-test')

      expect(events.length).toBeGreaterThanOrEqual(2)
      const first = events[0].data as Record<string, unknown>
      expect(first.iteration).toBe(1)
      expect(first.shouldContinue).toBe(true)
    })
  })

  describe('通信', () => {
    it('on() 应订阅事件总线', async () => {
      const eventBus = new EventBus()
      const received: unknown[] = []

      class ListenerAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'listener',
            description: 'listener agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
          this.on('test:event', async (e) => received.push(e))
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new ListenerAgent()
      eventBus.publish({
        type: 'test:event',
        source: 'other',
        data: 'hello',
        timestamp: new Date(),
      })

      expect(received).toHaveLength(1)
    })

    it('send() 应通过事件总线发送请求', async () => {
      const eventBus = new EventBus()

      // 注册响应者：监听 request 事件并通过 respond 回复
      eventBus.subscribe('message:request', async (e) => {
        const reqData = e.data as Record<string, unknown>
        if (reqData.requestId) {
          eventBus.respond(reqData.requestId as string, { result: 'response-data' })
        }
      })

      class SenderAgent extends Agent<string, string> {
        public sendResult: unknown
        constructor() {
          super({
            name: 'sender',
            description: 'sender agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          this.sendResult = await this.send('target-agent', { type: 'request' })
          return 'done'
        }
      }

      const agent = new SenderAgent()
      await agent.execute('test')

      expect(agent.sendResult).toEqual({ result: 'response-data' })
    })
  })

  describe('错误处理', () => {
    it('plan 抛出异常应发布 error 事件并重新抛出', async () => {
      const eventBus = new EventBus()
      const errors: AgentEvent[] = []
      eventBus.subscribe('agent:error', async (e) => errors.push(e))

      class PlanFailAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'plan-fail',
            description: 'plan fail agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          throw new Error('plan error')
        }
        protected async act() {
          return 'never'
        }
      }

      const agent = new PlanFailAgent()
      await expect(agent.execute('test')).rejects.toThrow('plan error')
      expect(errors).toHaveLength(1)
    })

    it('act 抛出异常应发布 error 事件并重新抛出', async () => {
      const eventBus = new EventBus()
      const errors: AgentEvent[] = []
      eventBus.subscribe('agent:error', async (e) => errors.push(e))

      class ActFailAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'act-fail',
            description: 'act fail agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          throw new Error('act error')
        }
      }

      const agent = new ActFailAgent()
      await expect(agent.execute('test')).rejects.toThrow('act error')
      expect(errors).toHaveLength(1)
    })

    it('无 act 结果时应抛出错误', async () => {
      // 这个场景在 while 循环不可能发生（至少执行一次 act）
      // 但如果 maxIterations=0 则可能触发
      class NoResultAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'no-result',
            description: 'no result agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            maxIterations: 0,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'result'
        }
      }

      const agent = new NoResultAgent()
      await expect(agent.execute('test')).rejects.toThrow('No result produced')
    })

    it('非 Error 类型的异常应正常包装', async () => {
      const eventBus = new EventBus()
      const errors: AgentEvent[] = []
      eventBus.subscribe('agent:error', async (e) => errors.push(e))

      class StringErrorAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'string-error',
            description: 'string error agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          throw 'string error'
        }
        protected async act() {
          return 'never'
        }
      }

      const agent = new StringErrorAgent()
      await expect(agent.execute('test')).rejects.toBe('string error')
      const errData = errors[0].data as Record<string, unknown>
      expect(errData.error).toBe('string error')
    })
  })

  describe('ExecutionContext', () => {
    it('plan 阶段 context 应包含正确字段', async () => {
      let capturedContext: ExecutionContext | undefined

      class ContextAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'context-agent',
            description: 'context agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan(input: string, context: ExecutionContext) {
          capturedContext = context
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new ContextAgent()
      await agent.execute('test')

      expect(capturedContext).toBeDefined()
      expect(capturedContext!.executionId).toBeDefined()
      expect(capturedContext!.agentName).toBe('context-agent')
      expect(capturedContext!.startTime).toBeInstanceOf(Date)
      expect(capturedContext!.metadata).toEqual({})
      expect(capturedContext!.sharedState).toBeInstanceOf(Map)
      expect(capturedContext!.memory).toBeDefined()
      expect(capturedContext!.eventBus).toBeDefined()
      expect(capturedContext!.tools).toBeDefined()
      expect(capturedContext!.llm).toBeDefined()
    })

    it('sharedState 应在不同钩子间共享', async () => {
      let sharedValue: unknown

      class SharedAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'shared-agent',
            description: 'shared agent',
            eventBus: new EventBus(),
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan(_input: string, context: ExecutionContext) {
          context.sharedState.set('key', 'plan-value')
          return 'plan'
        }
        protected async act(_plan: unknown, context: ExecutionContext) {
          sharedValue = context.sharedState.get('key')
          return 'done'
        }
      }

      const agent = new SharedAgent()
      await agent.execute('test')

      expect(sharedValue).toBe('plan-value')
    })
  })

  describe('审批流程', () => {
    it('PLAN 阶段审批拒绝时应抛出错误', async () => {
      const eventBus = new EventBus()

      const mockApprovalFlow = {
        requestApproval: vi.fn().mockResolvedValue({
          approvalId: '123',
          approved: false,
          timestamp: new Date(),
          feedback: { message: '需要修改' },
        }),
      }

      class ApprovalAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'approval-agent',
            description: 'approval agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            approvalFlow: mockApprovalFlow,
            approvalStages: ['plan' as any],
          })
        }
        protected async plan() {
          return 'plan-data'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new ApprovalAgent()

      await expect(agent.execute('test')).rejects.toThrow('Plan阶段未通过审批')
      expect(mockApprovalFlow.requestApproval).toHaveBeenCalled()
    })

    it('PLAN 阶段审批通过且有修正时应使用修正后的 plan', async () => {
      const eventBus = new EventBus()
      let capturedPlan: unknown

      const mockApprovalFlow = {
        requestApproval: vi.fn().mockResolvedValue({
          approvalId: '123',
          approved: true,
          timestamp: new Date(),
          feedback: {
            corrections: { plan: 'corrected-plan' },
          },
        }),
      }

      class ApprovalAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'approval-agent',
            description: 'approval agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            approvalFlow: mockApprovalFlow,
            approvalStages: ['plan' as any],
          })
        }
        protected async plan() {
          return 'original-plan'
        }
        protected async act(plan: unknown) {
          capturedPlan = plan
          return 'done'
        }
      }

      const agent = new ApprovalAgent()
      await agent.execute('test')

      expect(capturedPlan).toBe('corrected-plan')
    })

    it('ACT 阶段审批拒绝时应抛出错误', async () => {
      const eventBus = new EventBus()

      const mockApprovalFlow = {
        requestApproval: vi.fn().mockResolvedValue({
          approvalId: '123',
          approved: false,
          timestamp: new Date(),
        }),
      }

      class ApprovalAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'approval-agent',
            description: 'approval agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            approvalFlow: mockApprovalFlow,
            approvalStages: ['act' as any],
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'result'
        }
      }

      const agent = new ApprovalAgent()

      await expect(agent.execute('test')).rejects.toThrow('Act阶段未通过审批')
    })

    it('ACT 阶段审批通过且有修正时应继续执行', async () => {
      const eventBus = new EventBus()
      let actCallCount = 0
      let firstApproval = true

      const mockApprovalFlow = {
        requestApproval: vi.fn().mockImplementation(() => {
          if (firstApproval) {
            firstApproval = false
            return Promise.resolve({
              approvalId: '123',
              approved: true,
              timestamp: new Date(),
              feedback: {
                corrections: { result: 'corrected-result' },
              },
            })
          }
          return Promise.resolve({
            approvalId: '124',
            approved: true,
            timestamp: new Date(),
          })
        }),
      }

      class ApprovalAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'approval-agent',
            description: 'approval agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            approvalFlow: mockApprovalFlow,
            approvalStages: ['act' as any],
            maxIterations: 10,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          actCallCount++
          return actCallCount === 1 ? 'first-result' : 'final-result'
        }
        protected async reflect() {
          if (actCallCount === 1) {
            return { shouldContinue: false, result: 'first-result' }
          }
          return { shouldContinue: false, result: 'final-result' }
        }
      }

      const agent = new ApprovalAgent()
      await agent.execute('test')

      expect(actCallCount).toBe(2)
      expect(mockApprovalFlow.requestApproval).toHaveBeenCalledTimes(2)
    })

    it('shouldRequestApproval 应在无 approvalFlow 时返回 false', () => {
      const { agent } = createTestAgent()

      const result = (agent as any).shouldRequestApproval('plan' as any)

      expect(result).toBe(false)
    })

    it('shouldRequestApproval 应在 approvalStages 不包含阶段时返回 false', async () => {
      const eventBus = new EventBus()

      class ApprovalAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'approval-agent',
            description: 'approval agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            approvalFlow: {
              requestApproval: vi
                .fn()
                .mockResolvedValue({ approved: true, approvalId: '123', timestamp: new Date() }),
            },
            approvalStages: ['plan' as any],
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'result'
        }
      }

      const agent = new ApprovalAgent()
      const result = (agent as any).shouldRequestApproval('act' as any)

      expect(result).toBe(false)
    })

    it('requestApprovalIfNeeded 应在无 approvalFlow 时返回自动批准', async () => {
      const { agent } = createTestAgent()

      const result = await (agent as any).requestApprovalIfNeeded('data', {} as ExecutionContext)

      expect(result.approved).toBe(true)
      expect(result.approvalId).toBeDefined()
    })
  })

  describe('检查点管理', () => {
    it('应正确初始化检查点管理器', () => {
      const eventBus = new EventBus()
      const mockCheckpointManager = {
        saveCheckpoint: vi.fn(),
        loadCheckpoint: vi.fn(),
      }

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            enableCheckpoints: true,
            checkpointManager: mockCheckpointManager as any,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      expect(agent).toBeDefined()
    })

    it('enableCheckpoints 为 false 时不保存检查点', async () => {
      const eventBus = new EventBus()
      const mockCheckpointManager = {
        saveCheckpoint: vi.fn(),
        loadCheckpoint: vi.fn(),
      }

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            enableCheckpoints: false,
            checkpointManager: mockCheckpointManager as any,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      await agent.execute('test')

      expect(mockCheckpointManager.saveCheckpoint).not.toHaveBeenCalled()
    })

    it('无 checkpointManager 时不保存检查点', async () => {
      const eventBus = new EventBus()

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            enableCheckpoints: true,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      await agent.execute('test')

      await expect(agent.execute('test')).resolves.toBeDefined()
    })

    it('resumeFromCheckpoint 应在无 checkpointManager 时抛出错误', async () => {
      const { agent } = createTestAgent()

      await expect(agent.resumeFromCheckpoint('checkpoint-id')).rejects.toThrow(
        'CheckpointManager 未配置，无法恢复检查点'
      )
    })

    it('resumeFromCheckpoint 应在检查点不存在时抛出错误', async () => {
      const eventBus = new EventBus()
      const mockCheckpointManager = {
        saveCheckpoint: vi.fn(),
        loadCheckpoint: vi.fn().mockResolvedValue(null),
      }

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            checkpointManager: mockCheckpointManager as any,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      await expect(agent.resumeFromCheckpoint('checkpoint-id')).rejects.toThrow(
        '检查点不存在: checkpoint-id'
      )
    })

    it('resumeFromCheckpoint 应成功恢复检查点', async () => {
      const eventBus = new EventBus()
      const mockCheckpoint = {
        checkpointId: 'test-checkpoint',
        iteration: 1,
        timestamp: new Date(),
        memorySnapshot: { key: 'value' },
        contextSnapshot: { executionId: '123' },
        stateSnapshot: { initialized: true },
        tags: ['test'],
      }

      const mockCheckpointManager = {
        saveCheckpoint: vi.fn(),
        loadCheckpoint: vi.fn().mockResolvedValue(mockCheckpoint),
      }

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            checkpointManager: mockCheckpointManager as any,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      const result = await agent.resumeFromCheckpoint('test-checkpoint')

      expect(result.checkpoint).toBe(mockCheckpoint)
      expect(result.context).toEqual({ executionId: '123' })
    })

    it('saveCheckpointIfEnabled 应在保存失败时不影响执行', async () => {
      const eventBus = new EventBus()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockCheckpointManager = {
        saveCheckpoint: vi.fn().mockRejectedValue(new Error('保存失败')),
        loadCheckpoint: vi.fn(),
      }

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            enableCheckpoints: true,
            checkpointManager: mockCheckpointManager as any,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      await expect(agent.execute('test')).resolves.toBeDefined()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('初始化配置', () => {
    it('应使用默认 maxIterations 和 timeout', () => {
      const { agent } = createTestAgent()

      expect((agent as any).maxIterations).toBe(10)
      expect((agent as any).timeout).toBe(300000)
    })

    it('应使用自定义 maxIterations 和 timeout', () => {
      const eventBus = new EventBus()

      class ConfigAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'config-agent',
            description: 'config agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            maxIterations: 20,
            timeout: 600000,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new ConfigAgent()
      expect((agent as any).maxIterations).toBe(20)
      expect((agent as any).timeout).toBe(600000)
    })

    it('应正确初始化审批流程配置', () => {
      const eventBus = new EventBus()
      const mockApprovalFlow = {
        requestApproval: vi.fn(),
      }

      class ApprovalAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'approval-agent',
            description: 'approval agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            approvalFlow: mockApprovalFlow as any,
            approvalStages: ['plan' as any, 'act' as any],
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new ApprovalAgent()
      expect((agent as any).approvalFlow).toBe(mockApprovalFlow)
      expect((agent as any).approvalStages).toEqual(['plan', 'act'])
    })

    it('应正确创建 CheckpointManager 当启用检查点但未提供管理器', () => {
      const eventBus = new EventBus()
      const mockCheckpointConfig = {
        maxCheckpoints: 10,
        retentionDays: 7,
      }

      class CheckpointAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'checkpoint-agent',
            description: 'checkpoint agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
            enableCheckpoints: true,
            checkpointConfig: mockCheckpointConfig as any,
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          return 'done'
        }
      }

      const agent = new CheckpointAgent()
      expect((agent as any).checkpointManager).toBeDefined()
    })
  })

  describe('工具和 LLM 访问', () => {
    it('getTools 应返回工具注册表', () => {
      const { agent, toolRegistry } = createTestAgent()

      const tools = agent.getTools()

      expect(tools).toBe(toolRegistry)
    })

    it('getLlm 应返回 LLM 适配器', () => {
      const { agent } = createTestAgent()

      const llm = agent.getLlm()

      expect(llm).toBeDefined()
    })
  })

  describe('反射行为', () => {
    it('reflect 返回非对象时应停止循环', async () => {
      const eventBus = new EventBus()
      let actCallCount = 0

      class ReflectAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'reflect-agent',
            description: 'reflect agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          actCallCount++
          return 'result'
        }
        protected async reflect() {
          return 'not-an-object'
        }
      }

      const agent = new ReflectAgent()
      await agent.execute('test')

      expect(actCallCount).toBe(1)
    })

    it('reflect 返回对象但无 shouldContinue 属性时应停止循环', async () => {
      const eventBus = new EventBus()
      let actCallCount = 0

      class ReflectAgent extends Agent<string, string> {
        constructor() {
          super({
            name: 'reflect-agent',
            description: 'reflect agent',
            eventBus,
            memory: new ShortTermMemory(),
            tools: createMockToolRegistry(),
            llm: createMockLLM(),
          })
        }
        protected async plan() {
          return 'plan'
        }
        protected async act() {
          actCallCount++
          return 'result'
        }
        protected async reflect() {
          return { quality: 'good' }
        }
      }

      const agent = new ReflectAgent()
      await agent.execute('test')

      expect(actCallCount).toBe(1)
    })
  })
})
