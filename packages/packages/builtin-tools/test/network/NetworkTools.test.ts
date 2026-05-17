import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebFetchTool, WebSearchTool } from '../../src/network/NetworkTools.js'
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

describe('NetworkTools', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('WebFetchTool', () => {
    it('should fetch URL and return response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html>test</html>',
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response)

      const tool = new WebFetchTool()
      const result = await tool.execute({ url: 'https://example.com' }, mockContext)

      expect(result.status).toBe(200)
      expect(result.statusText).toBe('OK')
      expect(result.body).toBe('<html>test</html>')
      expect(result.headers['content-type']).toBe('text/html')
    })

    it('should include custom headers in request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => '{}',
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response)

      const tool = new WebFetchTool()
      await tool.execute(
        {
          url: 'https://api.example.com',
          method: 'POST',
          headers: { 'X-Custom': 'value' },
          body: '{"key":"val"}',
        },
        mockContext
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Custom': 'value',
            'User-Agent': expect.stringContaining('YunPat'),
          }),
          body: '{"key":"val"}',
        })
      )
    })

    it('should throw error on timeout', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted')
            error.name = 'AbortError'
            reject(error)
          }, 10)
        })
      })

      const tool = new WebFetchTool()
      await expect(
        tool.execute({ url: 'https://example.com', timeout: 5 }, mockContext)
      ).rejects.toThrow('Request timeout after 5ms')
    })
  })

  describe('WebSearchTool', () => {
    it('should return search results', async () => {
      const mockResponse = {
        json: async () => ({
          RelatedTopics: [
            { Text: 'Result one description', FirstURL: 'https://example.com/1' },
            { Text: 'Result two description', FirstURL: 'https://example.com/2' },
          ],
        }),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response)

      const tool = new WebSearchTool()
      const result = await tool.execute({ query: 'test query' }, mockContext)

      expect(result.results).toHaveLength(2)
      expect(result.results[0].url).toBe('https://example.com/1')
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('duckduckgo.com'))
    })

    it('should return fallback result when API returns empty', async () => {
      const mockResponse = {
        json: async () => ({ RelatedTopics: [] }),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse as unknown as Response)

      const tool = new WebSearchTool()
      const result = await tool.execute({ query: 'test' }, mockContext)

      expect(result.results).toHaveLength(1)
      expect(result.results[0].title).toBe('Search performed')
    })
  })
})
