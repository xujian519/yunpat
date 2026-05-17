import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatentDownloadTool, BatchPatentDownloadTool } from '../../src/tools/PatentDownloadTool.js'
import type { LLMAdapter, MemoryStore, IEventBus, IToolRegistry } from '@yunpat/core'

function createMockContext(): {
  registry: IToolRegistry
  llm: LLMAdapter
  memory: MemoryStore
  eventBus: IEventBus
} {
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
      subscribe: vi
        .fn()
        .mockReturnValue({ id: 'mock-sub', pattern: '*', handler: vi.fn(), unsubscribe: vi.fn() }),
      unsubscribe: vi.fn(),
      request: vi.fn().mockResolvedValue(undefined),
    },
  }
}

const mockContext = createMockContext()

// Mock fetch API
global.fetch = vi.fn()

type FetchResponse = {
  ok: boolean
  status?: number
  statusText?: string
  json: () => Promise<Record<string, unknown>>
}

function mockFetchOk(json: Record<string, unknown>): FetchResponse {
  return { ok: true, json: async () => json }
}

function mockFetchError(
  json: Record<string, unknown>,
  status: number,
  statusText: string
): FetchResponse {
  return { ok: false, status, statusText, json: async () => json }
}

// Mock fs.mkdir
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}))

import * as fs from 'fs'

describe('PatentDownloadTool', () => {
  let tool: PatentDownloadTool

  beforeEach(() => {
    vi.clearAllMocks()
    tool = new PatentDownloadTool()
  })

  it('should be instantiated with default service URL', () => {
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('patent_download')
    expect(tool.metadata.category).toBe('patent')
  })

  it('should be instantiated with custom service URL', () => {
    const customTool = new PatentDownloadTool('http://localhost:9999')
    expect(customTool).toBeDefined()
  })

  it('should download patent successfully', async () => {
    const mockResponse = {
      success: true,
      message: '专利 US4405829A1 下载成功',
      patent: 'US4405829A1',
      output_path: '/path/to/downloads/US4405829A1.pdf',
    }

    vi.mocked(fetch).mockResolvedValue(mockFetchOk(mockResponse))

    const result = await tool.execute(
      {
        patent: 'US4405829A1',
        outputPath: './downloads',
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.patent).toBe('US4405829A1')
    expect(result.outputPath).toBe('/path/to/downloads/US4405829A1.pdf')
    expect(fs.promises.mkdir).toHaveBeenCalled()
  })

  it('should handle service errors', async () => {
    const mockErrorResponse = {
      detail: '专利下载失败: 未找到专利',
    }

    vi.mocked(fetch).mockResolvedValue(
      mockFetchError(mockErrorResponse, 500, 'Internal Server Error')
    )

    await expect(
      tool.execute(
        {
          patent: 'INVALID000',
        },
        mockContext
      )
    ).rejects.toThrow('专利下载服务返回错误: 专利下载失败: 未找到专利')
  })

  it('should handle connection errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      tool.execute(
        {
          patent: 'US4405829A1',
        },
        mockContext
      )
    ).rejects.toThrow(/无法连接到专利下载服务/)
  })

  it('should handle timeout errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(
      tool.execute(
        {
          patent: 'US4405829A1',
        },
        mockContext
      )
    ).rejects.toThrow('专利下载失败: Aborted')
  })

  it('should use default parameters when not provided', async () => {
    const mockResponse = {
      success: true,
      message: '专利 US4405829A1 下载成功',
      patent: 'US4405829A1',
      output_path: '/path/to/downloads/US4405829A1.pdf',
    }

    vi.mocked(fetch).mockResolvedValue(mockFetchOk(mockResponse))

    await tool.execute(
      {
        patent: 'US4405829A1',
      },
      mockContext
    )

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    if (fetchCall && fetchCall[1]) {
      const requestBody = JSON.parse(fetchCall[1].body as string)
      expect(requestBody.output_path).toContain('./downloads')
      expect(requestBody.waiting_time).toBe(6)
    }
  })
})

describe('BatchPatentDownloadTool', () => {
  let tool: BatchPatentDownloadTool

  beforeEach(() => {
    vi.clearAllMocks()
    tool = new BatchPatentDownloadTool()
  })

  it('should be instantiated with default service URL', () => {
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('batch_patent_download')
    expect(tool.metadata.category).toBe('patent')
  })

  it('should download multiple patents successfully', async () => {
    const mockResponse = {
      success: true,
      message: '批量下载完成，共 2 个专利',
      total: 2,
      downloaded: 2,
      failed: 0,
      output_path: '/path/to/downloads',
    }

    vi.mocked(fetch).mockResolvedValue(mockFetchOk(mockResponse))

    const result = await tool.execute(
      {
        patents: ['US4405829A1', 'EP0551921B1'],
        outputPath: './downloads',
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.total).toBe(2)
    expect(result.downloaded).toBe(2)
    expect(result.failed).toBe(0)
  })

  it('should reject empty patent list', async () => {
    await expect(
      tool.execute(
        {
          patents: [],
        },
        mockContext
      )
    ).rejects.toThrow('专利号列表不能为空')
  })

  it('should handle batch download errors', async () => {
    const mockErrorResponse = {
      detail: '批量下载失败: 网络错误',
    }

    vi.mocked(fetch).mockResolvedValue(
      mockFetchError(mockErrorResponse, 500, 'Internal Server Error')
    )

    await expect(
      tool.execute(
        {
          patents: ['US4405829A1', 'EP0551921B1'],
        },
        mockContext
      )
    ).rejects.toThrow('批量下载服务返回错误: 批量下载失败: 网络错误')
  })

  it('should handle partial success', async () => {
    const mockResponse = {
      success: true,
      message: '批量下载完成，共 3 个专利',
      total: 3,
      downloaded: 2,
      failed: 1,
      output_path: '/path/to/downloads',
    }

    vi.mocked(fetch).mockResolvedValue(mockFetchOk(mockResponse))

    const result = await tool.execute(
      {
        patents: ['US4405829A1', 'EP0551921B1', 'CN1234567A'],
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.total).toBe(3)
    expect(result.downloaded).toBe(2)
    expect(result.failed).toBe(1)
  })
})
