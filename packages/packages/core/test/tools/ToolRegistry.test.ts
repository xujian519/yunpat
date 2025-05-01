/**
 * ToolRegistry 测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry, ToolWrapper } from '../../src/tools/ToolRegistry.js'
import { EventBus } from '../../src/eventbus/EventBus.js'
import { createMockTool } from '../helpers/mocks.js'

describe('ToolRegistry', () => {
  let registry: ToolRegistry
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    registry = new ToolRegistry(eventBus)
  })

  describe('register/unregister', () => {
    it('应注册工具', () => {
      const tool = createMockTool('test-tool')
      registry.register(tool)

      expect(registry.has('test-tool')).toBe(true)
      expect(registry.size()).toBe(1)
    })

    it('重复注册应抛出错误', () => {
      const tool = createMockTool('dup-tool')
      registry.register(tool)

      expect(() => registry.register(tool)).toThrow('Tool already registered: dup-tool')
    })

    it('应注销工具', () => {
      const tool = createMockTool('removable')
      registry.register(tool)
      registry.unregister('removable')

      expect(registry.has('removable')).toBe(false)
    })

    it('注销不存在的工具应抛出错误', () => {
      expect(() => registry.unregister('nonexistent')).toThrow('Tool not found: nonexistent')
    })

    it('注册时应发布 tool:registered 事件', () => {
      const events: unknown[] = []
      eventBus.subscribe('tool:registered', async (e) => events.push(e))

      registry.register(createMockTool('event-tool'))

      expect(events).toHaveLength(1)
      expect((events[0] as any).data.toolName).toBe('event-tool')
    })

    it('注销时应发布 tool:unregistered 事件', () => {
      const events: unknown[] = []
      eventBus.subscribe('tool:unregistered', async (e) => events.push(e))

      registry.register(createMockTool('temp'))
      registry.unregister('temp')

      expect(events).toHaveLength(1)
      expect((events[0] as any).data.toolName).toBe('temp')
    })
  })

  describe('get/has', () => {
    it('get 应返回已注册的工具', () => {
      const tool = createMockTool('fetch')
      registry.register(tool)

      expect(registry.get('fetch')).toBe(tool)
    })

    it('get 不存在的工具应返回 undefined', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('has 应正确反映注册状态', () => {
      expect(registry.has('tool')).toBe(false)
      registry.register(createMockTool('tool'))
      expect(registry.has('tool')).toBe(true)
    })
  })

  describe('call', () => {
    it('应调用已注册的工具', async () => {
      registry.register(createMockTool('calc', 42))
      const result = await registry.call('calc', { x: 1 })

      expect(result).toBe(42)
    })

    it('调用不存在的工具应抛出错误', async () => {
      await expect(registry.call('missing', {})).rejects.toThrow('Tool not found: missing')
    })

    it('应发布 tool:called 和 tool:success 事件', async () => {
      const events: string[] = []
      eventBus.subscribe('tool:called', async () => events.push('called'))
      eventBus.subscribe('tool:success', async () => events.push('success'))

      registry.register(createMockTool('tracked'))
      await registry.call('tracked', {})

      expect(events).toEqual(['called', 'success'])
    })

    it('工具执行失败应发布 tool:error 事件', async () => {
      const events: string[] = []
      eventBus.subscribe('tool:error', async () => events.push('error'))

      registry.register(
        new ToolWrapper('failing', 'fails', async () => {
          throw new Error('exec failed')
        })
      )

      await expect(registry.call('failing', {})).rejects.toThrow('exec failed')
      expect(events).toEqual(['error'])
    })
  })

  describe('list', () => {
    it('应返回所有工具', () => {
      registry.register(createMockTool('a'))
      registry.register(createMockTool('b'))

      const list = registry.list()
      expect(list).toHaveLength(2)
      expect(list.map((t) => t.name).sort()).toEqual(['a', 'b'])
    })

    it('空注册表应返回空数组', () => {
      expect(registry.list()).toEqual([])
    })
  })

  describe('clear', () => {
    it('应清空所有工具', () => {
      registry.register(createMockTool('a'))
      registry.register(createMockTool('b'))
      registry.clear()

      expect(registry.size()).toBe(0)
    })
  })
})
