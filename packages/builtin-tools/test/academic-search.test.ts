import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AcademicSearchTool } from '../src/search/SearchTools.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

// Mock fetch API
global.fetch = vi.fn()

describe('AcademicSearchTool', () => {
  let tool: AcademicSearchTool

  beforeEach(() => {
    vi.clearAllMocks()
    tool = new AcademicSearchTool()
  })

  it('should be instantiated with default metadata', () => {
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('academic_search')
    expect(tool.metadata.category).toBe('search')
  })

  it('should search papers successfully', async () => {
    const mockResponse = {
      data: [
        {
          paperId: '1234',
          title: 'Test Paper 1',
          authors: [{ name: 'Author 1' }, { name: 'Author 2' }],
          year: 2023,
          venue: 'Test Venue',
          citationCount: 10,
          url: 'https://example.com/paper1',
          abstract: 'This is a test abstract',
        },
        {
          paperId: '5678',
          title: 'Test Paper 2',
          authors: [{ name: 'Author 3' }],
          year: 2024,
          venue: 'Another Venue',
          citationCount: 5,
          url: 'https://example.com/paper2',
          abstract: 'Another test abstract',
        },
      ],
      total: 2,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

    const result = await tool.execute(
      {
        query: 'machine learning',
        limit: 10,
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.query).toBe('machine learning')
    expect(result.results).toHaveLength(2)
    expect(result.results[0].title).toBe('Test Paper 1')
    expect(result.results[0].authors).toBe('Author 1, Author 2')
    expect(result.results[0].year).toBe('2023')
    expect(result.results[0].citations).toBe(10)
    expect(result.source).toBe('Semantic Scholar')
    expect(result.totalResults).toBe(2)
  })

  it('should handle empty results', async () => {
    const mockResponse = {
      data: [],
      total: 0,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

    const result = await tool.execute(
      {
        query: 'nonexistent query',
        limit: 10,
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(0)
    expect(result.totalResults).toBe(0)
  })

  it('should handle API errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ detail: 'Internal Server Error' }),
    } as any)

    await expect(
      tool.execute(
        {
          query: 'test query',
        },
        mockContext
      )
    ).rejects.toThrow('Semantic Scholar API请求失败: 500 Internal Server Error')
  })

  it('should handle network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    await expect(
      tool.execute(
        {
          query: 'test query',
        },
        mockContext
      )
    ).rejects.toThrow('学术论文搜索失败: Network error')
  })

  it('should include year filter when provided', async () => {
    const mockResponse = {
      data: [],
      total: 0,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

    await tool.execute(
      {
        query: 'machine learning',
        year: '2023',
      },
      mockContext
    )

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const url = new URL(fetchCall[0] as string)
    expect(url.searchParams.get('year')).toBe('2023')
  })

  it('should use default limit when not provided', async () => {
    const mockResponse = {
      data: [],
      total: 0,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

    await tool.execute(
      {
        query: 'test query',
      },
      mockContext
    )

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const url = new URL(fetchCall[0] as string)
    expect(url.searchParams.get('limit')).toBe('10')
  })

  it('should handle missing optional fields', async () => {
    const mockResponse = {
      data: [
        {
          paperId: '1234',
          title: 'Test Paper',
          // Missing authors, year, venue, etc.
        },
      ],
      total: 1,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

    const result = await tool.execute(
      {
        query: 'test query',
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Test Paper')
    expect(result.results[0].authors).toBe('')
    expect(result.results[0].year).toBe('')
    expect(result.results[0].venue).toBe('')
  })
})
