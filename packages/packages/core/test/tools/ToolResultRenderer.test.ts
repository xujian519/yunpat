/**
 * ToolResultRenderer 测试
 *
 * 测试覆盖：
 * - renderForLLM（自定义渲染器、默认渲染、压缩/持久化结果）
 * - renderForLog（截断、压缩/持久化结果）
 * - renderForUI（组件类型推断：text/code/table/json/diff/image）
 * - renderToolUse（自定义渲染器、默认渲染）
 */

import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { ToolResultRenderer } from '../../src/tools/ToolResultRenderer.js'
import { EnhancedTool, ToolResultBlockParam } from '../../src/tools/types.js'

// ========== Mock 工具工厂 ==========

function createMockTool(overrides: Partial<EnhancedTool> = {}): EnhancedTool {
  return {
    metadata: {
      name: 'mock_tool',
      description: 'A mock tool',
      inputSchema: z.object({}),
      ...overrides.metadata,
    },
    execute: vi.fn(),
    ...overrides,
  } as EnhancedTool
}

// ========== 测试套件 ==========

describe('ToolResultRenderer', () => {
  const renderer = new ToolResultRenderer()

  describe('renderForLLM()', () => {
    it('应该使用工具的自定义 renderToolResultMessage', async () => {
      const customBlocks: ToolResultBlockParam[] = [{ type: 'text', text: 'Custom result' }]
      const tool = createMockTool({
        renderToolResultMessage: vi.fn(async () => customBlocks),
      })

      const result = await renderer.renderForLLM(tool, { data: 'test' })

      expect(result).toEqual(customBlocks)
      expect(tool.renderToolResultMessage).toHaveBeenCalledWith({ data: 'test' })
    })

    it('自定义渲染器失败时应 fallback 到默认渲染', async () => {
      const tool = createMockTool({
        renderToolResultMessage: vi.fn(async () => {
          throw new Error('Render failed')
        }),
      })

      const result = await renderer.renderForLLM(tool, { data: 'test' })

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('json')
    })

    it('字符串结果应渲染为 text block', async () => {
      const tool = createMockTool()
      const result = await renderer.renderForLLM(tool, 'Hello world')

      expect(result).toEqual([{ type: 'text', text: 'Hello world' }])
    })

    it('对象结果应渲染为 json block', async () => {
      const tool = createMockTool()
      const data = { key: 'value', num: 42 }
      const result = await renderer.renderForLLM(tool, data)

      expect(result[0].type).toBe('json')
      expect(result[0].json).toEqual(data)
    })

    it('已压缩结果应渲染为带 summary 的 text block', async () => {
      const tool = createMockTool()
      const compacted = {
        _compacted: true,
        originalTokens: 10000,
        summary: '[内容已压缩]',
        preview: 'prefix...\n... [内容压缩] ...\n...suffix',
      }

      const result = await renderer.renderForLLM(tool, compacted)

      expect(result[0].type).toBe('text')
      expect(result[0].text).toBe('[内容已压缩]')
      expect(result[0].isCompacted).toBe(true)
      expect(result[0].originalTokens).toBe(10000)
    })

    it('已持久化结果应渲染为提示文本', async () => {
      const tool = createMockTool()
      const persisted = {
        _persisted: true,
        filePath: '/tmp/test.json',
        size: 50000,
        summary: '[结果过大，已持久化]',
      }

      const result = await renderer.renderForLLM(tool, persisted)

      expect(result[0].type).toBe('text')
      expect(result[0].text).toContain('已持久化到磁盘')
      expect(result[0].text).toContain('/tmp/test.json')
    })
  })

  describe('renderForLog()', () => {
    it('应该渲染为带工具名的日志文本', async () => {
      const tool = createMockTool({
        metadata: { name: 'search_tool', description: 's', inputSchema: z.object({}) },
      })
      const result = await renderer.renderForLog(tool, { hits: 5 })

      expect(result).toContain('[search_tool]')
      expect(result).toContain('hits')
    })

    it('应该截断超长文本', async () => {
      const tool = createMockTool()
      const longText = 'x'.repeat(1000)
      const result = await renderer.renderForLog(tool, longText, { maxLength: 100 })

      expect(result.length).toBeLessThan(200)
      expect(result).toContain('...')
      expect(result).toContain('截断')
    })

    it('已压缩结果应只显示 summary', async () => {
      const tool = createMockTool()
      const compacted = {
        _compacted: true,
        summary: '[结果压缩: 10000 tokens → 500 tokens]',
      }

      const result = await renderer.renderForLog(tool, compacted)

      expect(result).toBe('[mock_tool] [结果压缩: 10000 tokens → 500 tokens]')
    })

    it('已持久化结果应显示文件路径', async () => {
      const tool = createMockTool()
      const persisted = {
        _persisted: true,
        filePath: '/tmp/results/test.json',
        size: 50000,
      }

      const result = await renderer.renderForLog(tool, persisted)

      expect(result).toContain('结果已持久化')
      expect(result).toContain('/tmp/results/test.json')
      expect(result).toContain('50000')
    })
  })

  describe('renderForUI()', () => {
    it('字符串结果应渲染为 text 组件', async () => {
      const tool = createMockTool()
      const result = await renderer.renderForUI(tool, 'Hello world')

      expect(result.component).toBe('text')
      expect(result.content).toBe('Hello world')
    })

    it('代码字符串应渲染为 code 组件', async () => {
      const tool = createMockTool()
      const code = 'export function hello() {\n  return "world"\n}'
      const result = await renderer.renderForUI(tool, code)

      expect(result.component).toBe('code')
      expect(result.content).toBe(code)
      expect(result.meta?.language).toBe('typescript')
    })

    it('Python 代码应检测为 python', async () => {
      const tool = createMockTool()
      const code = 'def hello():\n    return "world"'
      const result = await renderer.renderForUI(tool, code)

      expect(result.component).toBe('code')
      expect(result.meta?.language).toBe('python')
    })

    it('对象数组应渲染为 table 组件', async () => {
      const tool = createMockTool()
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]
      const result = await renderer.renderForUI(tool, data)

      expect(result.component).toBe('table')
      expect(result.meta?.rowCount).toBe(2)
    })

    it('简单数组应渲染为 json 组件', async () => {
      const tool = createMockTool()
      const data = [1, 2, 3, 4, 5]
      const result = await renderer.renderForUI(tool, data)

      expect(result.component).toBe('json')
      expect(result.meta?.itemCount).toBe(5)
    })

    it('普通对象应渲染为 json 组件', async () => {
      const tool = createMockTool()
      const data = { key: 'value', num: 42 }
      const result = await renderer.renderForUI(tool, data)

      expect(result.component).toBe('json')
      expect(result.meta?.keys).toEqual(['key', 'num'])
    })

    it('diff 对象应渲染为 diff 组件', async () => {
      const tool = createMockTool()
      const data = { added: ['line1'], removed: ['line2'] }
      const result = await renderer.renderForUI(tool, data)

      expect(result.component).toBe('diff')
    })

    it('图片数据应渲染为 image 组件', async () => {
      const tool = createMockTool()
      const data = { data: 'base64...', mimeType: 'image/png' }
      const result = await renderer.renderForUI(tool, data)

      expect(result.component).toBe('image')
    })

    it('已压缩结果应渲染为带 truncated 标记的 text', async () => {
      const tool = createMockTool()
      const compacted = {
        _compacted: true,
        summary: '[内容已压缩]',
      }

      const result = await renderer.renderForUI(tool, compacted)

      expect(result.component).toBe('text')
      expect(result.meta?.truncated).toBe(true)
    })

    it('已持久化结果应渲染为带 filePath 的 text', async () => {
      const tool = createMockTool()
      const persisted = {
        _persisted: true,
        filePath: '/tmp/test.json',
        size: 50000,
      }

      const result = await renderer.renderForUI(tool, persisted)

      expect(result.component).toBe('text')
      expect(result.meta?.filePath).toBe('/tmp/test.json')
      expect(result.meta?.size).toBe(50000)
    })
  })

  describe('renderToolUse()', () => {
    it('应该使用工具的自定义 renderToolUseMessage', async () => {
      const tool = createMockTool({
        renderToolUseMessage: vi.fn(async () => '搜索: "AI 专利"'),
      })

      const result = await renderer.renderToolUse(tool, { query: 'AI 专利' })

      expect(result).toBe('搜索: "AI 专利"')
    })

    it('自定义渲染器失败时应 fallback 到默认格式', async () => {
      const tool = createMockTool({
        metadata: { name: 'calc', description: 'c', inputSchema: z.object({}) },
        renderToolUseMessage: vi.fn(async () => {
          throw new Error('Failed')
        }),
      })

      const result = await renderer.renderToolUse(tool, { a: 1, b: 2 })

      expect(result).toContain('calc')
      expect(result).toContain('a')
    })

    it('默认渲染应截断长输入', async () => {
      const tool = createMockTool({
        metadata: { name: 'long_input', description: 'l', inputSchema: z.object({}) },
      })
      const longInput = 'x'.repeat(300)

      const result = await renderer.renderToolUse(tool, longInput)

      expect(result).toContain('...')
      expect(result.length).toBeLessThan(250)
    })
  })
})
