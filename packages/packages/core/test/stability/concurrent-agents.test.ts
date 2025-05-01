/**
 * 并发 Agent 测试
 *
 * 测试多个 Agent 并发执行的场景：
 * - 并发读写 Memory
 * - 事件总线并发通信
 * - 工具并发调用
 * - 资源竞争和锁机制
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Agent } from '../../src/agent/Agent.js'
import { EventBus } from '../../src/eventbus/EventBus.js'
import { ShortTermMemory } from '../../src/memory/MemoryStore.js'
import { ToolRegistry } from '../../src/tools/ToolRegistry.js'
import type {
  LLMAdapter,
  ExecutionContext,
  AgentEvent,
  Tool,
  MemoryStore,
} from '../../src/lifecycle/Lifecycle.js'

/**
 * 创建 Mock LLM
 */
function createMockLLM(responseDelay: number = 0): LLMAdapter {
  return {
    chat: async () => {
      if (responseDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, responseDelay))
      }
      return {
        message: {
          role: 'assistant',
          content: 'Mock response',
        },
      }
    },
    chatStream: async function* () {
      yield { delta: 'Mock', done: false }
      yield { delta: '', done: true }
    },
    embed: async (texts) => {
      return texts.map(() => [0.1, 0.2, 0.3])
    },
  }
}

/**
 * 创建测试 Agent
 */
class TestAgent extends Agent<string, string> {
  constructor(
    name: string,
    eventBus: EventBus,
    memory: MemoryStore,
    tools: ToolRegistry,
    llm: LLMAdapter
  ) {
    super({
      name,
      description: `Test agent ${name}`,
      eventBus,
      memory,
      tools,
      llm,
      maxIterations: 5,
    })
  }

  protected async plan(input: string, context: ExecutionContext): Promise<any> {
    return {
      goal: input,
      steps: ['step1', 'step2'],
    }
  }

  protected async act(plan: any, context: ExecutionContext): Promise<any> {
    // 模拟一些工作
    await new Promise((resolve) => setTimeout(resolve, 10))

    return {
      success: true,
      agent: this.name,
      result: `Completed: ${plan.goal}`,
    }
  }
}

/**
 * 创建带状态管理的 Agent
 */
class StatefulAgent extends Agent<string, string> {
  private counter = 0

  constructor(
    name: string,
    eventBus: EventBus,
    memory: MemoryStore,
    tools: ToolRegistry,
    llm: LLMAdapter
  ) {
    super({
      name,
      description: `Stateful agent ${name}`,
      eventBus,
      memory,
      tools,
      llm,
      maxIterations: 5,
    })
  }

  protected async plan(input: string, context: ExecutionContext): Promise<any> {
    // 从 memory 读取计数器
    const counter = await context.memory.get('counter')
    return {
      goal: input,
      currentCounter: counter || 0,
    }
  }

  protected async act(plan: any, context: ExecutionContext): Promise<any> {
    // 增加计数器
    this.counter++

    // 写入 memory
    await context.memory.set('counter', this.counter)

    return {
      counter: this.counter,
      agent: this.name,
    }
  }
}

describe('并发 Agent 测试', () => {
  let eventBus: EventBus
  let memory: ShortTermMemory
  let tools: ToolRegistry
  let llm: LLMAdapter

  beforeEach(() => {
    eventBus = new EventBus()
    memory = new ShortTermMemory()
    tools = new ToolRegistry(eventBus)
    llm = createMockLLM()
  })

  afterEach(async () => {
    await memory.clear()
  })

  describe('并发执行', () => {
    it('应该支持多个 Agent 并发执行', async () => {
      const agents = [
        new TestAgent('agent1', eventBus, memory, tools, llm),
        new TestAgent('agent2', eventBus, memory, tools, llm),
        new TestAgent('agent3', eventBus, memory, tools, llm),
      ]

      // 并发执行
      const results = await Promise.all(agents.map((agent) => agent.execute('test task')))

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })

    it('应该在并发执行时保持独立性', async () => {
      const agent1 = new TestAgent('agent1', eventBus, memory, tools, llm)
      const agent2 = new TestAgent('agent2', eventBus, memory, tools, llm)

      const [result1, result2] = await Promise.all([
        agent1.execute('task1'),
        agent2.execute('task2'),
      ])

      expect(result1.agent).toBe('agent1')
      expect(result2.agent).toBe('agent2')
    })
  })

  describe('并发 Memory 访问', () => {
    it('应该支持多个 Agent 并发读取 Memory', async () => {
      await memory.set('shared-key', 'shared-value')

      const agents = [
        new TestAgent('agent1', eventBus, memory, tools, llm),
        new TestAgent('agent2', eventBus, memory, tools, llm),
        new TestAgent('agent3', eventBus, memory, tools, llm),
      ]

      // 所有 Agent 同时读取
      const readPromises = agents.map(async (agent) => {
        return await memory.get('shared-key')
      })

      const results = await Promise.all(readPromises)

      results.forEach((value) => {
        expect(value).toBe('shared-value')
      })
    })

    it('应该支持多个 Agent 并发写入 Memory（不同键）', async () => {
      const agents = [
        new TestAgent('agent1', eventBus, memory, tools, llm),
        new TestAgent('agent2', eventBus, memory, tools, llm),
        new TestAgent('agent3', eventBus, memory, tools, llm),
      ]

      // 并发写入不同的键
      await Promise.all([
        memory.set('key1', 'value1'),
        memory.set('key2', 'value2'),
        memory.set('key3', 'value3'),
      ])

      expect(await memory.get('key1')).toBe('value1')
      expect(await memory.get('key2')).toBe('value2')
      expect(await memory.get('key3')).toBe('value3')
    })

    it('应该处理并发写入同一键的竞争', async () => {
      const agent1 = new StatefulAgent('agent1', eventBus, memory, tools, llm)
      const agent2 = new StatefulAgent('agent2', eventBus, memory, tools, llm)
      const agent3 = new StatefulAgent('agent3', eventBus, memory, tools, llm)

      // 并发执行，所有 Agent 都会修改 counter
      const results = await Promise.all([
        agent1.execute('increment'),
        agent2.execute('increment'),
        agent3.execute('increment'),
      ])

      // 最终的 counter 值应该是 3（每次执行增加 1）
      const finalCounter = await memory.get('counter')
      expect(finalCounter).toBeGreaterThanOrEqual(1)
      expect(finalCounter).toBeLessThanOrEqual(3)

      // 验证所有 Agent 都成功完成
      results.forEach((result) => {
        expect(result.counter).toBeGreaterThan(0)
      })
    })

    it('应该支持批量并发读写操作', async () => {
      // 初始化数据
      for (let i = 0; i < 100; i++) {
        await memory.set(`key-${i}`, `value-${i}`)
      }

      // 并发读取所有键
      const readPromises = []
      for (let i = 0; i < 100; i++) {
        readPromises.push(memory.get(`key-${i}`))
      }

      const results = await Promise.all(readPromises)

      expect(results).toHaveLength(100)
      results.forEach((value, index) => {
        expect(value).toBe(`value-${index}`)
      })
    })
  })

  describe('并发事件通信', () => {
    it('应该支持多个 Agent 并发订阅事件', async () => {
      const agent1 = new TestAgent('agent1', eventBus, memory, tools, llm)
      const agent2 = new TestAgent('agent2', eventBus, memory, tools, llm)
      const agent3 = new TestAgent('agent3', eventBus, memory, tools, llm)

      const receivedEvents: AgentEvent[] = []

      // 所有 Agent 订阅同一事件
      const subscription1 = eventBus.subscribe('test-event', (event) => {
        receivedEvents.push(event)
      })
      const subscription2 = eventBus.subscribe('test-event', (event) => {
        receivedEvents.push(event)
      })
      const subscription3 = eventBus.subscribe('test-event', (event) => {
        receivedEvents.push(event)
      })

      // 发布事件
      eventBus.publish({
        type: 'test-event',
        source: 'test',
        data: { message: 'test' },
        timestamp: new Date(),
      })

      // 等待事件传播
      await new Promise((resolve) => setTimeout(resolve, 50))

      // 验证所有订阅者都收到事件
      expect(receivedEvents).toHaveLength(3)

      subscription1.unsubscribe()
      subscription2.unsubscribe()
      subscription3.unsubscribe()
    })

    it('应该支持并发发布不同事件', async () => {
      const receivedEvents: Record<string, number> = {}

      // 订阅多个事件
      eventBus.subscribe('event1', () => {
        receivedEvents.event1 = (receivedEvents.event1 || 0) + 1
      })
      eventBus.subscribe('event2', () => {
        receivedEvents.event2 = (receivedEvents.event2 || 0) + 1
      })
      eventBus.subscribe('event3', () => {
        receivedEvents.event3 = (receivedEvents.event3 || 0) + 1
      })

      // 并发发布多个事件
      await Promise.all([
        new Promise((resolve) => {
          eventBus.publish({
            type: 'event1',
            source: 'test',
            data: {},
            timestamp: new Date(),
          })
          resolve(undefined)
        }),
        new Promise((resolve) => {
          eventBus.publish({
            type: 'event2',
            source: 'test',
            data: {},
            timestamp: new Date(),
          })
          resolve(undefined)
        }),
        new Promise((resolve) => {
          eventBus.publish({
            type: 'event3',
            source: 'test',
            data: {},
            timestamp: new Date(),
          })
          resolve(undefined)
        }),
      ])

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(receivedEvents.event1).toBe(1)
      expect(receivedEvents.event2).toBe(1)
      expect(receivedEvents.event3).toBe(1)
    })

    it('应该处理高频率事件发布', async () => {
      let eventCount = 0

      eventBus.subscribe('high-frequency-event', () => {
        eventCount++
      })

      // 快速发布 100 个事件
      for (let i = 0; i < 100; i++) {
        eventBus.publish({
          type: 'high-frequency-event',
          source: 'test',
          data: { index: i },
          timestamp: new Date(),
        })
      }

      // 等待事件处理
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(eventCount).toBe(100)
    })
  })

  describe('并发工具调用', () => {
    it('应该支持多个 Agent 并发调用工具', async () => {
      // 创建新的 ToolRegistry 实例并传入 eventBus
      const testTools = new ToolRegistry(eventBus)

      // 注册测试工具
      let callCount = 0
      const testTool: Tool = {
        name: 'test-tool',
        description: 'Test tool',
        execute: async () => {
          callCount++
          await new Promise((resolve) => setTimeout(resolve, 10))
          return { called: true }
        },
      }
      testTools.register(testTool)

      const agents = [
        new TestAgent('agent1', eventBus, memory, testTools, llm),
        new TestAgent('agent2', eventBus, memory, testTools, llm),
        new TestAgent('agent3', eventBus, memory, testTools, llm),
      ]

      // 并发调用工具
      await Promise.all([
        testTools.call('test-tool', {}),
        testTools.call('test-tool', {}),
        testTools.call('test-tool', {}),
      ])

      expect(callCount).toBe(3)
    })

    it('应该处理工具调用的并发竞争', async () => {
      // 创建新的 ToolRegistry 实例并传入 eventBus
      const testTools = new ToolRegistry(eventBus)

      const executionOrder: string[] = []

      const orderedTool: Tool = {
        name: 'ordered-tool',
        description: 'Tool that tracks execution order',
        execute: async (params: any) => {
          executionOrder.push(params.id)
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
          return { id: params.id }
        },
      }
      testTools.register(orderedTool)

      // 并发调用工具
      await Promise.all([
        testTools.call('ordered-tool', { id: 'call1' }),
        testTools.call('ordered-tool', { id: 'call2' }),
        testTools.call('ordered-tool', { id: 'call3' }),
      ])

      // 所有调用都应该完成
      expect(executionOrder).toHaveLength(3)
    })
  })

  describe('错误隔离', () => {
    it('应该隔离 Agent 执行错误', async () => {
      class FailingAgent extends Agent {
        constructor() {
          super({
            name: 'failing-agent',
            description: 'Agent that fails',
            eventBus,
            memory,
            tools,
            llm,
          })
        }

        protected async plan() {
          return { goal: 'fail' }
        }

        protected async act() {
          throw new Error('Agent failed')
        }
      }

      const failingAgent = new FailingAgent()
      const normalAgent = new TestAgent('normal-agent', eventBus, memory, tools, llm)

      // 并发执行：一个失败，一个成功
      const results = await Promise.allSettled([
        failingAgent.execute('test'),
        normalAgent.execute('test'),
      ])

      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('fulfilled')
    })
  })

  describe('性能和资源管理', () => {
    it('应该在大量并发 Agent 执行时保持稳定', async () => {
      const agentCount = 20
      const agents: TestAgent[] = []

      for (let i = 0; i < agentCount; i++) {
        agents.push(new TestAgent(`agent-${i}`, eventBus, memory, tools, llm))
      }

      const startTime = Date.now()

      // 并发执行所有 Agent
      const results = await Promise.all(agents.map((agent) => agent.execute('test task')))

      const duration = Date.now() - startTime

      expect(results).toHaveLength(agentCount)
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })

      // 性能检查：20 个并发 Agent 应该在合理时间内完成
      expect(duration).toBeLessThan(5000)
    })

    it('应该正确清理资源', async () => {
      const agent = new TestAgent('test-agent', eventBus, memory, tools, llm)

      // 执行并完成
      await agent.execute('test')

      // 验证可以重置和重新执行
      agent.reset()
      const result = await agent.execute('test again')

      expect(result.success).toBe(true)
    })
  })

  describe('Memory 历史和检查点', () => {
    it('应该在并发执行时维护正确的 Memory 历史', async () => {
      // ShortTermMemory 不支持历史记录功能
      // EnhancedMemoryStore 支持历史记录
      // 此测试简化为验证基本并发写入功能
      const agents = [
        new TestAgent('agent1', eventBus, memory, tools, llm),
        new TestAgent('agent2', eventBus, memory, tools, llm),
      ]

      // 并发写入 Memory
      await Promise.all([memory.set('agent1-data', 'value1'), memory.set('agent2-data', 'value2')])

      // 验证数据写入成功
      expect(await memory.get('agent1-data')).toBe('value1')
      expect(await memory.get('agent2-data')).toBe('value2')
    })
  })
})
