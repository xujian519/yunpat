import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WebNavigateTool,
  WebFindTabTool,
  WebSnapshotTool,
  WebClickTool,
  WebFillTool,
  WebEvaluateTool,
  WebScreenshotTool,
  WebWaitTool,
  WebExtractTextTool,
  WebScrollTool,
} from '../../src/browser/WebTools.js'
import type { LLMAdapter, MemoryStore, IEventBus, IToolRegistry } from '@yunpat/core'

function createMockContext(): { registry: IToolRegistry; llm: LLMAdapter; memory: MemoryStore; eventBus: IEventBus } {
  return {
    registry: {
      register: vi.fn(),
      unregister: vi.fn(),
      get: vi.fn().mockReturnValue(undefined),
      call: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockReturnValue([]),
    },
    llm: {
      chat: vi.fn().mockResolvedValue({ message: { role: 'assistant' as const, content: 'mock' } }),
      chatStream: vi.fn(),
      embed: vi.fn(),
    },
    memory: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockResolvedValue(false),
      getAll: vi.fn().mockResolvedValue({}),
      setAll: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    },
    eventBus: {
      publish: vi.fn(),
      subscribe: vi.fn().mockReturnValue({ id: 'mock-sub', pattern: '*', handler: vi.fn(), unsubscribe: vi.fn() }),
      unsubscribe: vi.fn(),
      request: vi.fn().mockResolvedValue(undefined),
    },
  }
}

const mockContext = createMockContext()

describe('WebTools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  type FetchJsonResponse = {
    ok: boolean
    status?: number
    statusText?: string
    json: () => Promise<Record<string, unknown>>
  }

  const mockFetchSuccess = (data: Record<string, unknown>) => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => data,
    } as unknown as Response)
  }

  const mockFetchError = (status: number, statusText: string) => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status,
      statusText,
    } as unknown as Response)
  }

  describe('WebNavigateTool', () => {
    it('should navigate to URL', async () => {
      mockFetchSuccess({ success: true, tabId: 'tab-1' })

      const tool = new WebNavigateTool()
      const result = await tool.execute({ url: 'https://example.com' }, mockContext)

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://example.com')
      expect(result.tabId).toBe('tab-1')
    })

    it('should throw on WebBridge error', async () => {
      mockFetchError(500, 'Internal Server Error')

      const tool = new WebNavigateTool()
      await expect(tool.execute({ url: 'https://example.com' }, mockContext)).rejects.toThrow(
        'Navigation failed'
      )
    })
  })

  describe('WebFindTabTool', () => {
    it('should find a tab', async () => {
      mockFetchSuccess({ success: true, tabId: 'tab-2' })

      const tool = new WebFindTabTool()
      const result = await tool.execute({ url: 'example.com' }, mockContext)

      expect(result.success).toBe(true)
      expect(result.url).toBe('example.com')
      expect(result.tabId).toBe('tab-2')
    })
  })

  describe('WebSnapshotTool', () => {
    it('should return page snapshot', async () => {
      mockFetchSuccess({
        url: 'https://example.com',
        title: 'Example',
        tree: [{ name: 'link', role: 'link', tag: 'a', ref: 'e1' }],
      })

      const tool = new WebSnapshotTool()
      const result = await tool.execute({}, mockContext)

      expect(result.url).toBe('https://example.com')
      expect(result.title).toBe('Example')
      expect(result.tree).toHaveLength(1)
    })
  })

  describe('WebClickTool', () => {
    it('should click element', async () => {
      mockFetchSuccess({ success: true, tag: 'button', text: 'Click me' })

      const tool = new WebClickTool()
      const result = await tool.execute({ selector: '@e1' }, mockContext)

      expect(result.success).toBe(true)
      expect(result.tag).toBe('button')
    })
  })

  describe('WebFillTool', () => {
    it('should fill input', async () => {
      mockFetchSuccess({ success: true, tag: 'input' })

      const tool = new WebFillTool()
      const result = await tool.execute({ selector: '@e2', value: 'test value' }, mockContext)

      expect(result.success).toBe(true)
    })
  })

  describe('WebEvaluateTool', () => {
    it('should evaluate JavaScript', async () => {
      mockFetchSuccess({ type: 'number', value: 42 })

      const tool = new WebEvaluateTool()
      const result = await tool.execute({ code: '1 + 41' }, mockContext)

      expect(result.type).toBe('number')
      expect(result.value).toBe(42)
    })
  })

  describe('WebWaitTool', () => {
    it('should wait and return success', async () => {
      const tool = new WebWaitTool()
      const start = Date.now()
      const result = await tool.execute({ duration: 50 }, mockContext)
      const elapsed = Date.now() - start

      expect(result.success).toBe(true)
      expect(elapsed).toBeGreaterThanOrEqual(45)
    })
  })

  describe('WebExtractTextTool', () => {
    it('should extract text from snapshot', async () => {
      mockFetchSuccess({
        tree: [
          { name: 'Paragraph one', role: 'text', tag: 'p', ref: 'e1' },
          { name: 'Paragraph two', role: 'text', tag: 'p', ref: 'e2' },
        ],
      })

      const tool = new WebExtractTextTool()
      const result = await tool.execute({}, mockContext)

      expect(result.text).toContain('Paragraph one')
      expect(result.text).toContain('Paragraph two')
    })
  })

  describe('WebScrollTool', () => {
    it('should scroll and return success', async () => {
      mockFetchSuccess({})

      const tool = new WebScrollTool()
      const result = await tool.execute({ direction: 'down', amount: 300 }, mockContext)

      expect(result.success).toBe(true)
    })
  })

  describe('WebScreenshotTool', () => {
    it('should have correct metadata', () => {
      const tool = new WebScreenshotTool()
      expect(tool.metadata.name).toBe('web_screenshot')
      expect(tool.metadata.category).toBe('network')
    })
  })
})
