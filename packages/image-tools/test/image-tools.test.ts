import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChemicalStructureTool } from '../src/tools/ChemicalStructureTool.js'
import { MathFormulaTool } from '../src/tools/MathFormulaTool.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
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

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

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

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => mockErrorResponse,
    } as any)

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

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

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

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

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

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => mockErrorResponse,
    } as any)

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

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any)

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
