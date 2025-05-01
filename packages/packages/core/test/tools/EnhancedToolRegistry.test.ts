/**
 * EnhancedToolRegistry 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { EnhancedToolRegistry, ToolWrapperClass } from '../../src/tools/EnhancedToolRegistry.js'
import { EventBus } from '../../src/eventbus/EventBus.js'
import { ToolCategory } from '../../src/tools/types.js'
import type { EnhancedTool, ToolContext } from '../../src/tools/types.js'
import { createMockLLM, createMockMemory } from '../helpers/mocks.js'

function createTestTool(
  name: string,
  category?: ToolCategory,
  overrides?: Partial<EnhancedTool['metadata']>
): EnhancedTool {
  const schema = z.object({ input: z.string() })
  return new ToolWrapperClass(
    {
      name,
      description: `Test tool: ${name}`,
      inputSchema: schema,
      category,
      isConcurrencySafe: true,
      ...overrides,
    },
    async (input) => `processed: ${input.input}`
  )
}

function createToolContext(): ToolContext {
  return {
    registry: {} as any,
    llm: createMockLLM(),
    memory: createMockMemory(),
    eventBus: new EventBus(),
  }
}

describe('EnhancedToolRegistry', () => {
  let registry: EnhancedToolRegistry
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    registry = new EnhancedToolRegistry(eventBus)
  })

  describe('register', () => {
    it('应注册工具', () => {
      registry.register(createTestTool('test-tool'))
      expect(registry.has('test-tool')).toBe(true)
    })

    it('重复注册应抛出错误', () => {
      registry.register(createTestTool('dup'))
      expect(() => registry.register(createTestTool('dup'))).toThrow('Tool already registered')
    })

    it('名称为空应抛出验证错误', () => {
      const schema = z.object({ input: z.string() })
      const emptyTool = new ToolWrapperClass(
        { name: '', description: '', inputSchema: schema },
        async (input) => input
      )
      expect(() => registry.register(emptyTool)).toThrow('Tool name is required')
    })

    it('注册时应发布 tool:registered 事件', () => {
      const events: unknown[] = []
      eventBus.subscribe('tool:registered', async (e) => events.push(e))

      registry.register(createTestTool('evt'))

      expect(events).toHaveLength(1)
      expect((events[0] as any).data.toolName).toBe('evt')
    })
  })

  describe('registerBatch', () => {
    it('应批量注册工具', () => {
      registry.registerBatch([
        createTestTool('batch-1'),
        createTestTool('batch-2'),
        createTestTool('batch-3'),
      ])

      expect(registry.size()).toBe(3)
    })
  })

  describe('unregister', () => {
    it('应注销工具', () => {
      registry.register(createTestTool('tmp'))
      registry.unregister('tmp')
      expect(registry.has('tmp')).toBe(false)
    })

    it('注销不存在的工具应抛出错误', () => {
      expect(() => registry.unregister('nope')).toThrow('Tool not found')
    })
  })

  describe('call', () => {
    it('应调用工具并返回结果', async () => {
      registry.register(createTestTool('echo'))
      const result = await registry.call('echo', { input: 'hello' }, createToolContext())
      expect(result).toBe('processed: hello')
    })

    it('调用不存在的工具应抛出错误', async () => {
      await expect(registry.call('missing', { input: 'x' }, createToolContext())).rejects.toThrow(
        'Tool not found'
      )
    })

    it('无效输入应抛出验证错误', async () => {
      registry.register(createTestTool('strict'))
      await expect(
        registry.call('strict', { wrong: 'field' }, createToolContext())
      ).rejects.toThrow()
    })
  })

  describe('callBatch', () => {
    it('应批量调用工具', async () => {
      registry.register(createTestTool('b1'))
      registry.register(createTestTool('b2'))

      const results = await registry.callBatch(
        [
          { name: 'b1', input: { input: 'a' } },
          { name: 'b2', input: { input: 'b' } },
        ],
        createToolContext()
      )

      expect(results).toEqual(['processed: a', 'processed: b'])
    })

    it('空调用列表应返回空数组', async () => {
      const results = await registry.callBatch([], createToolContext())
      expect(results).toEqual([])
    })
  })

  describe('getByCategory', () => {
    it('应按分类过滤工具', () => {
      registry.register(createTestTool('patent-1', ToolCategory.PATENT))
      registry.register(createTestTool('file-1', ToolCategory.FILE))
      registry.register(createTestTool('patent-2', ToolCategory.PATENT))

      const patents = registry.getByCategory(ToolCategory.PATENT)
      expect(patents).toHaveLength(2)
    })

    it('无匹配分类应返回空数组', () => {
      expect(registry.getByCategory(ToolCategory.DATABASE)).toEqual([])
    })
  })

  describe('getByMcpServer', () => {
    it('应按 MCP 服务器过滤工具', () => {
      registry.register(
        createTestTool('mcp-1', undefined, {
          isMcp: true,
          mcpServer: 'server-a',
        })
      )
      registry.register(createTestTool('local-1'))

      const mcpTools = registry.getByMcpServer('server-a')
      expect(mcpTools).toHaveLength(1)
    })
  })

  describe('中间件', () => {
    it('应添加和移除中间件', () => {
      const mw = {
        name: 'test-mw',
        before: async () => {},
        after: async () => {},
      }

      registry.addMiddleware(mw)
      const pipeline = registry.getMiddleware()
      expect(pipeline).toBeDefined()

      registry.removeMiddleware('test-mw')
    })
  })

  describe('clear', () => {
    it('应清空所有工具', () => {
      registry.register(createTestTool('a'))
      registry.register(createTestTool('b'))
      registry.clear()

      expect(registry.size()).toBe(0)
    })
  })

  describe('getStats', () => {
    it('无追踪中间件应返回空数组', () => {
      // getStats 依赖 TracingMiddleware 的存在
      const stats = registry.getStats()
      expect(Array.isArray(stats)).toBe(true)
    })
  })
})
