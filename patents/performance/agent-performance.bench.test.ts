/**
 * Agent Performance Benchmarks
 *
 * 测试智能体系统的性能表现
 */

import { describe, bench, beforeAll, afterAll } from 'vitest'

describe('Agent Performance', () => {
  describe('Agent Initialization', () => {
    bench('simple agent initialization', () => {
      const agent = {
        id: 'agent-1',
        state: 'idle',
        config: {},
      }
      agent
    })

    bench('complex agent initialization', () => {
      const agent = {
        id: 'agent-1',
        state: 'idle',
        config: {
          llm: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000,
          },
          memory: {
            enabled: true,
            maxSize: 10000,
          },
          optimization: {
            caching: true,
            batching: true,
          },
        },
        metrics: {
          requestsProcessed: 0,
          averageLatency: 0,
          successRate: 1.0,
        },
      }
      agent
    })
  })

  describe('Agent Execution', () => {
    const mockTasks = Array.from({ length: 100 }, (_, i) => ({
      id: `task-${i}`,
      input: { data: `test-${i}` },
    }))

    bench('single task execution', async () => {
      const task = mockTasks[0]
      const result = await Promise.resolve({
        ...task,
        output: { success: true },
      })
      result
    })

    bench('sequential task execution (10 tasks)', async () => {
      const results = []
      for (let i = 0; i < 10; i++) {
        const result = await Promise.resolve({
          id: `task-${i}`,
          output: { success: true },
        })
        results.push(result)
      }
      results
    })

    bench('parallel task execution (10 tasks)', async () => {
      const tasks = mockTasks.slice(0, 10)
      const results = await Promise.all(
        tasks.map(async (task) => ({
          ...task,
          output: { success: true },
        }))
      )
      results
    })

    bench('batch task execution (50 tasks)', async () => {
      const tasks = mockTasks.slice(0, 50)
      const batchSize = 10

      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (task) => ({
            ...task,
            output: { success: true },
          }))
        )
      }
    })
  })

  describe('Memory Operations', () => {
    bench('memory write operation', () => {
      const memory = new Map<string, any>()
      const entry = {
        id: 'entry-1',
        data: 'x'.repeat(1000),
        timestamp: Date.now(),
      }
      memory.set(entry.id, entry)
    })

    bench('memory read operation', () => {
      const memory = new Map<string, any>()
      memory.set('entry-1', { data: 'test' })
      memory.get('entry-1')
    })

    bench('memory search operation', () => {
      const memory = new Map<string, any>()
      for (let i = 0; i < 1000; i++) {
        memory.set(`entry-${i}`, { data: `value-${i}` })
      }

      // 搜索特定条件
      let found = 0
      for (const [key, value] of memory.entries()) {
        if (value.data.includes('500')) {
          found++
        }
      }
      found
    })

    bench('memory cleanup operation', () => {
      const memory = new Map<string, any>()
      const now = Date.now()

      // 添加1000个项目，部分过期
      for (let i = 0; i < 1000; i++) {
        memory.set(`entry-${i}`, {
          data: `value-${i}`,
          timestamp: now - Math.random() * 120000,
        })
      }

      // 清理过期项目
      const ttl = 60000
      for (const [key, value] of memory.entries()) {
        if (now - value.timestamp > ttl) {
          memory.delete(key)
        }
      }
    })
  })

  describe('Agent Communication', () => {
    bench('message passing between agents', async () => {
      const agent1 = { id: 'agent-1', inbox: [] as any[] }
      const agent2 = { id: 'agent-2', inbox: [] as any[] }

      const message = {
        from: agent1.id,
        to: agent2.id,
        content: 'test message',
      }

      await Promise.resolve(agent2.inbox.push(message))
      agent2.inbox
    })

    bench('broadcast message to multiple agents', async () => {
      const agents = Array.from({ length: 10 }, (_, i) => ({
        id: `agent-${i}`,
        inbox: [] as any[],
      }))

      const message = {
        from: 'sender',
        content: 'broadcast message',
      }

      await Promise.all(
        agents.map((agent) => Promise.resolve(agent.inbox.push(message)))
      )
    })
  })

  describe('State Management', () => {
    bench('state transition', () => {
      const agent = {
        id: 'agent-1',
        state: 'idle',
        history: [] as string[],
      }

      // 状态转换
      const states = ['idle', 'processing', 'completed', 'idle']
      states.forEach((s) => {
        agent.state = s
        agent.history.push(s)
      })

      agent
    })

    bench('state snapshot', () => {
      const agent = {
        id: 'agent-1',
        state: 'processing',
        config: { key: 'value' },
        memory: new Map(),
        metrics: { processed: 100 },
      }

      const snapshot = JSON.stringify(agent)
      snapshot
    })

    bench('state restoration', () => {
      const snapshot =
        '{"id":"agent-1","state":"processing","config":{"key":"value"},"metrics":{"processed":100}}'
      const restored = JSON.parse(snapshot)
      restored
    })
  })

  describe('Multi-Agent Coordination', () => {
    bench('coordinator initialization', () => {
      const agents = Array.from({ length: 5 }, (_, i) => ({
        id: `agent-${i}`,
        role: ['worker', 'supervisor', 'optimizer'][i % 3],
      }))

      const coordinator = {
        agents,
        tasks: [],
        status: 'active',
      }
      coordinator
    })

    bench('task distribution', () => {
      const agents = Array.from({ length: 5 }, (_, i) => ({
        id: `agent-${i}`,
        tasks: [] as number[],
      }))

      const tasks = Array.from({ length: 20 }, (_, i) => i)

      // 分配任务
      tasks.forEach((task, index) => {
        const agentIndex = index % agents.length
        agents[agentIndex].tasks.push(task)
      })

      agents
    })

    bench('result aggregation', () => {
      const agents = Array.from({ length: 5 }, (_, i) => ({
        id: `agent-${i}`,
        results: Array.from({ length: 4 }, (_, j) => ({
          taskId: j * 5 + i,
          success: true,
        })),
      }))

      // 聚合结果
      const allResults = agents.flatMap((agent) => agent.results)
      allResults
    })
  })
})

describe('Performance Regression Tests', () => {
  describe('Critical Operations', () => {
    bench('end-to-end agent workflow', async () => {
      // 模拟完整工作流
      const agent = { id: 'agent-1', state: 'idle' }

      // 1. 初始化
      agent.state = 'ready'

      // 2. 接收任务
      const task = { id: 'task-1', input: 'test' }

      // 3. 执行
      const result = await Promise.resolve({ success: true })

      // 4. 更新状态
      agent.state = 'completed'

      result
    })

    bench('high-frequency task processing', async () => {
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
      }))

      const results = await Promise.all(
        tasks.map(async (task) => ({
          ...task,
          processed: true,
        }))
      )

      results
    })
  })

  describe('Resource Usage', () => {
    bench('memory allocation pattern', () => {
      const items: any[] = []

      for (let i = 0; i < 10000; i++) {
        items.push({ id: i, data: 'x'.repeat(100) })
        if (items.length > 5000) {
          items.splice(0, 1000) // 删除最旧的1000个
        }
      }
    })

    bench('CPU-intensive operation', () => {
      const data = Array.from({ length: 10000 }, (_, i) => i)

      // 模拟CPU密集型操作
      const result = data.map((n) => n * n).filter((n) => n % 2 === 0)
      result
    })
  })
})
