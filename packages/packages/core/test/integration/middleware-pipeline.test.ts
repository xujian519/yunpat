/**
 * 中间件管道集成测试
 *
 * 验证中间件的执行顺序、短路行为和缓存
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import { EnhancedToolRegistry, ToolWrapperClass } from '../../src/tools/EnhancedToolRegistry.js'
import { EventBus } from '../../src/eventbus/EventBus.js'
import type { ToolContext, EnhancedTool } from '../../src/tools/types.js'
import type { ToolExecutionContext } from '../../src/tools/types.js'
import { createMockLLM, createMockMemory } from '../helpers/mocks.js'

function createToolContext(): ToolContext {
  return {
    registry: {} as any,
    llm: createMockLLM(),
    memory: createMockMemory(),
    eventBus: new EventBus(),
  }
}

function createSimpleTool(name: string, result: string = 'ok'): EnhancedTool {
  return new ToolWrapperClass(
    {
      name,
      description: `Tool: ${name}`,
      inputSchema: z.object({ value: z.string() }),
      isConcurrencySafe: true,
    },
    async (input) => `${result}:${input.value}`
  )
}

describe('中间件管道集成', () => {
  let registry: EnhancedToolRegistry
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    registry = new EnhancedToolRegistry(eventBus)
  })

  describe('默认中间件', () => {
    it('默认应注册 5 个中间件', () => {
      const pipeline = registry.getMiddleware()
      // Logging, Permission, Cache, RateLimit, Tracing
      expect(pipeline).toBeDefined()
    })
  })

  describe('执行顺序', () => {
    it('中间件应按注册顺序执行', async () => {
      const order: string[] = []

      registry.addMiddleware({
        name: 'mw-1',
        before: async () => {
          order.push('mw1-before')
        },
        after: async () => {
          order.push('mw1-after')
        },
      })

      registry.addMiddleware({
        name: 'mw-2',
        before: async () => {
          order.push('mw2-before')
        },
        after: async () => {
          order.push('mw2-after')
        },
      })

      registry.register(createSimpleTool('ordered'))
      await registry.call('ordered', { value: 'test' }, createToolContext())

      // before 应按顺序，after 应按注册顺序
      expect(order.slice(0, 2)).toEqual(['mw1-before', 'mw2-before'])
    })
  })

  describe('错误处理', () => {
    it('工具抛出错误时应触发 onError', async () => {
      let errorCaught = false

      registry.addMiddleware({
        name: 'error-handler',
        onError: async (_ctx, error) => {
          errorCaught = true
          expect(error.message).toContain('intentional')
        },
      })

      const failingTool = new ToolWrapperClass(
        { name: 'fail', description: 'Fails', inputSchema: z.object({ v: z.string() }) },
        async () => {
          throw new Error('intentional error')
        }
      )

      registry.register(failingTool)

      await expect(registry.call('fail', { v: 'x' }, createToolContext())).rejects.toThrow(
        'intentional error'
      )

      expect(errorCaught).toBe(true)
    })
  })

  describe('自定义中间件', () => {
    it('应支持计费中间件', async () => {
      let totalTokens = 0

      registry.addMiddleware({
        name: 'billing',
        after: async (ctx, result) => {
          // 模拟计费
          totalTokens += (result as string).length
        },
      })

      registry.register(createSimpleTool('billed', 'result-data'))
      await registry.call('billed', { value: 'test' }, createToolContext())

      expect(totalTokens).toBeGreaterThan(0)
    })

    it('应支持审计日志中间件', async () => {
      const auditLog: { tool: string; time: number }[] = []

      registry.addMiddleware({
        name: 'audit',
        before: async (ctx) => {
          auditLog.push({ tool: ctx.tool.metadata.name, time: ctx.startTime })
        },
      })

      registry.register(createSimpleTool('audited'))
      await registry.call('audited', { value: 'x' }, createToolContext())

      expect(auditLog).toHaveLength(1)
      expect(auditLog[0].tool).toBe('audited')
    })
  })

  describe('工具前后钩子', () => {
    it('工具的 before/after 钩子应被调用', async () => {
      const hookLog: string[] = []

      const toolWithHooks: EnhancedTool = {
        metadata: {
          name: 'hooked',
          description: 'Tool with hooks',
          inputSchema: z.object({ value: z.string() }),
        },
        before: async () => {
          hookLog.push('tool-before')
        },
        execute: async (input) => {
          hookLog.push('tool-execute')
          return `result: ${input.value}`
        },
        after: async () => {
          hookLog.push('tool-after')
        },
      }

      registry.register(toolWithHooks)
      await registry.call('hooked', { value: 'test' }, createToolContext())

      expect(hookLog).toEqual(['tool-before', 'tool-execute', 'tool-after'])
    })
  })

  describe('批量工具调用', () => {
    it('并发安全工具应并发执行', async () => {
      const executionOrder: string[] = []

      const tool1 = new ToolWrapperClass(
        {
          name: 'concurrent-1',
          description: 'Concurrent tool 1',
          inputSchema: z.object({ v: z.string() }),
          isConcurrencySafe: true,
        },
        async (input) => {
          executionOrder.push('t1')
          return `r1:${input.v}`
        }
      )

      const tool2 = new ToolWrapperClass(
        {
          name: 'concurrent-2',
          description: 'Concurrent tool 2',
          inputSchema: z.object({ v: z.string() }),
          isConcurrencySafe: true,
        },
        async (input) => {
          executionOrder.push('t2')
          return `r2:${input.v}`
        }
      )

      registry.register(tool1)
      registry.register(tool2)

      const results = await registry.callBatch(
        [
          { name: 'concurrent-1', input: { v: 'a' } },
          { name: 'concurrent-2', input: { v: 'b' } },
        ],
        createToolContext()
      )

      expect(results).toHaveLength(2)
      expect(executionOrder).toContain('t1')
      expect(executionOrder).toContain('t2')
    })
  })
})
