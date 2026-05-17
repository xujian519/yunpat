import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChemicalStructureTool } from '../src/tools/ChemicalStructureTool.js'
import { MathFormulaTool } from '../src/tools/MathFormulaTool.js'
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

type FetchResponse = {
  ok: boolean
  status?: number
  statusText?: string
  json: () => Promise<Record<string, unknown>>
}

function mockFetchOk(json: Record<string, unknown>): FetchResponse {
  return { ok: true, json: async () => json }
}

function mockFetchError(status: number, statusText: string, json: Record<string, unknown>): FetchResponse {
  return { ok: false, status, statusText, json: async () => json }
}

// Mock fetch API
global.fetch = vi.fn()

describe('ChemicalStructureTool', () => {
  let tool: ChemicalStructureTool

  beforeEach(() => {
    vi.clearAllMocks()
    tool = new ChemicalStructureTool()
  })

  it('should be instantiated with default service URL', () => {
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('chemical_structure_recognition')
  })

  it('should recognize chemical structure successfully', async () => {
    const mockResponse = {
      success: true,
      message: '化学结构识别成功',
      structure: 'CC(C)Cc1ccccc1',
      confidence: 0.95,
      format: 'smiles',
    }

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchOk(mockResponse))

    const result = await tool.execute(
      {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png',
        outputFormat: 'smiles',
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.structure).toBe('CC(C)Cc1ccccc1')
    expect(result.confidence).toBe(0.95)
  })

  it('should handle service errors', async () => {
    const mockErrorResponse = {
      detail: '化学结构识别失败',
    }

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchError(500, 'Internal Server Error', mockErrorResponse))

    await expect(
      tool.execute(
        {
          imageData: 'base64encodedimagedata',
        },
        mockContext
      )
    ).rejects.toThrow('化学结构识别服务返回错误: 化学结构识别失败')
  })

  it('should handle connection errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(
      tool.execute(
        {
          imageData: 'base64encodedimagedata',
        },
        mockContext
      )
    ).rejects.toThrow(/无法连接到化学结构识别服务/)
  })

  it('should use default parameters when not provided', async () => {
    const mockResponse = {
      success: true,
      message: '化学结构识别成功',
      structure: 'CCO',
      confidence: 0.9,
      format: 'smiles',
    }

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchOk(mockResponse))

    await tool.execute(
      {
        imageData: 'base64encodedimagedata',
      },
      mockContext
    )

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body as string)
    expect(requestBody.image_format).toBe('png')
    expect(requestBody.output_format).toBe('smiles')
  })
})

describe('MathFormulaTool', () => {
  let tool: MathFormulaTool

  beforeEach(() => {
    vi.clearAllMocks()
    tool = new MathFormulaTool()
  })

  it('should be instantiated with default service URL', () => {
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('math_formula_recognition')
  })

  it('should recognize math formula successfully', async () => {
    const mockResponse = {
      success: true,
      message: '数学公式识别成功',
      latex: '\\frac{a}{b} + \\sqrt{c}',
      confidence: 0.92,
    }

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchOk(mockResponse))

    const result = await tool.execute(
      {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png',
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.latex).toBe('\\frac{a}{b} + \\sqrt{c}')
    expect(result.confidence).toBe(0.92)
  })

  it('should handle service errors', async () => {
    const mockErrorResponse = {
      detail: '数学公式识别失败',
    }

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchError(500, 'Internal Server Error', mockErrorResponse))

    await expect(
      tool.execute(
        {
          imageData: 'base64encodedimagedata',
        },
        mockContext
      )
    ).rejects.toThrow('数学公式识别服务返回错误: 数学公式识别失败')
  })

  it('should handle connection errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(
      tool.execute(
        {
          imageData: 'base64encodedimagedata',
        },
        mockContext
      )
    ).rejects.toThrow(/无法连接到数学公式识别服务/)
  })

  it('should use default image format when not provided', async () => {
    const mockResponse = {
      success: true,
      message: '数学公式识别成功',
      latex: 'E = mc^2',
      confidence: 0.95,
    }

    vi.mocked(fetch).mockResolvedValueOnce(mockFetchOk(mockResponse))

    await tool.execute(
      {
        imageData: 'base64encodedimagedata',
      },
      mockContext
    )

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    if (fetchCall && fetchCall[1]) {
      const requestBody = JSON.parse(fetchCall[1].body as string)
      expect(requestBody.image_format).toBe('png')
    }
  })
})
