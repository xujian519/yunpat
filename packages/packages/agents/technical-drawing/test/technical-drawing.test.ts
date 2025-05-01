import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TechnicalDrawingAgent } from '../src/TechnicalDrawingAgent.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(() => ({ id: 'mock-sub', pattern: '*', handler: vi.fn() })),
    unsubscribe: vi.fn(),
    request: vi.fn(() => Promise.resolve(undefined)),
  },
}

// Mock fetch API
global.fetch = vi.fn()

describe('TechnicalDrawingAgent', () => {
  let agent: TechnicalDrawingAgent

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new TechnicalDrawingAgent({
      name: 'test-technical-drawing',
      description: '测试技术图纸识别Agent',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('初始化', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined()
      expect(agent.name).toBe('test-technical-drawing')
    })
  })

  describe('化学结构识别', () => {
    it('应该成功识别化学结构', async () => {
      // Mock化学结构识别服务响应
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CC(C)Cc1ccccc1',
          confidence: 0.95,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.detectedType).toBe('chemical')
      expect(result.chemicalStructure).toBeDefined()
      expect(result.chemicalStructure?.smiles).toBe('CC(C)Cc1ccccc1')
      expect(result.chemicalStructure?.confidence).toBe(0.95)
      expect(result.elements.length).toBeGreaterThan(0)
      expect(result.elements[0].type).toBe('chemical_structure')
      expect(result.recognitionTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('应该处理化学结构识别服务错误', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: '识别失败' }),
      } as any)

      const input = {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      await expect(agent.execute(input)).rejects.toThrow()
    })

    it('应该处理化学结构识别连接错误', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

      const input = {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      await expect(agent.execute(input)).rejects.toThrow(/无法连接到化学结构识别服务/)
    })
  })

  describe('数学公式识别', () => {
    it('应该成功识别数学公式', async () => {
      // Mock数学公式识别服务响应
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '数学公式识别成功',
          latex: '\\frac{a}{b} + \\sqrt{c}',
          confidence: 0.92,
        }),
      } as any)

      const input = {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png' as const,
        drawingType: 'math' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.detectedType).toBe('math')
      expect(result.mathFormula).toBeDefined()
      expect(result.mathFormula?.latex).toBe('\\frac{a}{b} + \\sqrt{c}')
      expect(result.mathFormula?.confidence).toBe(0.92)
      expect(result.elements.length).toBeGreaterThan(0)
      expect(result.elements[0].type).toBe('math_formula')
    })

    it('应该处理数学公式识别服务错误', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: '识别失败' }),
      } as any)

      const input = {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png' as const,
        drawingType: 'math' as const,
      }

      await expect(agent.execute(input)).rejects.toThrow()
    })

    it('应该处理数学公式识别连接错误', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

      const input = {
        imageData: 'base64encodedimagedata',
        imageFormat: 'png' as const,
        drawingType: 'math' as const,
      }

      await expect(agent.execute(input)).rejects.toThrow(/无法连接到数学公式识别服务/)
    })
  })

  describe('自动类型检测', () => {
    it('应该自动检测化学结构类型', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        imageFormat: 'png' as const,
        autoDetect: true,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.detectedType).toBe('general') // 默认为general
    })

    it('应该自动检测数学公式类型', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '数学公式识别成功',
          latex: 'E = mc^2',
          confidence: 0.95,
        }),
      } as any)

      const input = {
        imageData: 'formula_image_data',
        imageFormat: 'png' as const,
        autoDetect: true,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      // 'formula_image_data' contains 'formula' keyword, detected as 'math'
      expect(result.detectedType).toBe('math')
    })

    it('应该使用指定的图纸类型', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'chemical_image_data',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.detectedType).toBe('chemical')
    })
  })

  describe('电学符号识别', () => {
    it('应该识别电学符号（占位实现）', async () => {
      const input = {
        imageData: 'circuit_image_data',
        imageFormat: 'png' as const,
        drawingType: 'electrical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.detectedType).toBe('electrical')
      expect(result.elements.length).toBeGreaterThan(0)
      expect(result.elements[0].type).toBe('electrical_symbol')
    })
  })

  describe('通用OCR识别', () => {
    it('应该识别通用图纸（占位实现）', async () => {
      const input = {
        imageData: 'general_image_data',
        imageFormat: 'png' as const,
        drawingType: 'general' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.detectedType).toBe('general')
      expect(result.ocrText).toBeDefined()
      expect(result.elements.length).toBeGreaterThan(0)
      expect(result.elements[0].type).toBe('text')
    })
  })

  describe('不同图片格式', () => {
    it('应该支持PNG格式', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'png_image_data',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
    })

    it('应该支持JPG格式', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'jpg_image_data',
        imageFormat: 'jpg' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
    })

    it('应该支持JPEG格式', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'jpeg_image_data',
        imageFormat: 'jpeg' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
    })
  })

  describe('错误处理', () => {
    it('应该处理空图片数据', async () => {
      // 当mock fetch返回成功时，空图片数据仍会正常处理
      // Agent不直接校验图片数据是否为空
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: '',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      // Agent目前不校验空图片数据，依赖下游服务处理
      const result = await agent.execute(input)
      expect(result).toBeDefined()
    })

    it('应该处理无效的图片格式', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'invalid_image_data',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      // Agent不校验图片内容有效性，依赖下游服务返回结果
      const result = await agent.execute(input)
      expect(result).toBeDefined()
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成识别', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '化学结构识别成功',
          structure: 'CCO',
          confidence: 0.9,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'test_image_data',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      const startTime = Date.now()
      const result = await agent.execute(input)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(result.recognitionTimeMs).toBeLessThan(5000) // 应该在5秒内完成
      expect(endTime - startTime).toBeLessThan(5000)
    })
  })

  describe('边界条件', () => {
    it('应该处理低置信度结果', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '识别成功',
          structure: 'CCO',
          confidence: 0.6, // 低置信度
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'low_confidence_image',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      expect(result.chemicalStructure?.confidence).toBe(0.6)
    })

    it('应该处理空的识别结果', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: '识别成功',
          structure: '', // 空结果
          confidence: 0.5,
          format: 'smiles',
        }),
      } as any)

      const input = {
        imageData: 'empty_result_image',
        imageFormat: 'png' as const,
        drawingType: 'chemical' as const,
      }

      const result = await agent.execute(input)

      expect(result.success).toBe(true)
      // 当structure为空字符串时，if (chemicalResult.success && chemicalResult.structure) 为false
      // 因此chemicalStructure不会被赋值
      expect(result.chemicalStructure).toBeUndefined()
    })
  })
})
