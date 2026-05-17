import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageOcrTool, BatchImageOcrTool, ImageToMarkdownTool } from '../../src/tools/OcrTools.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(() =>
      Promise.resolve({
        data: {
          text: 'OCR result text',
          confidence: 95,
          words: [
            { text: 'OCR', confidence: 96, bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
            { text: 'result', confidence: 94, bbox: { x0: 55, y0: 0, x1: 120, y1: 20 } },
          ],
        },
      })
    ),
  },
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 2048 })),
    readFileSync: vi.fn(() => Buffer.from('mock image')),
  }
})

const mockContext: any = {
  registry: {},
  llm: {
      chat: vi.fn(),
      chatStream: vi.fn(),
      embed: vi.fn(),
    } as unknown as import('@yunpat/core').LLMAdapter,
  memory: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), has: vi.fn(), getAll: vi.fn(), setAll: vi.fn(), clear: vi.fn(), search: vi.fn() },
  eventBus: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), request: vi.fn() },
}

describe('OcrTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ImageOcrTool', () => {
    it('has correct metadata', () => {
      const tool = new ImageOcrTool()
      expect(tool.metadata.name).toBe('image_ocr')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
    })

    it('recognizes text from image', async () => {
      const tool = new ImageOcrTool()
      const result = await tool.execute({ imagePath: '/mock/test.png' }, mockContext)
      expect(result.text).toBe('OCR result text')
      expect(result.confidence).toBe(95)
      expect(result.language).toBe('eng+chi_sim')
      expect(result.metadata.filename).toBe('test.png')
      expect(result.metadata.size).toBe(2048)
    })

    it('throws error when file does not exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(false)
      const tool = new ImageOcrTool()
      await expect(tool.execute({ imagePath: '/nonexistent.png' }, mockContext)).rejects.toThrow(
        '图片文件不存在'
      )
    })

    it('returns word details in json mode', async () => {
      const tool = new ImageOcrTool()
      const result = await tool.execute(
        { imagePath: '/mock/test.png', outputFormat: 'json' },
        mockContext
      )
      expect(result.words).toBeDefined()
      expect(result.words).toHaveLength(2)
    })
  })

  describe('BatchImageOcrTool', () => {
    it('has correct metadata', () => {
      const tool = new BatchImageOcrTool()
      expect(tool.metadata.name).toBe('batch_image_ocr')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('processes multiple images', async () => {
      const tool = new BatchImageOcrTool()
      const result = await tool.execute({ imagePaths: ['/mock/1.png', '/mock/2.png'] }, mockContext)
      expect(result.results).toHaveLength(2)
      expect(result.summary.totalImages).toBe(2)
      expect(result.summary.successful).toBe(2)
      expect(result.summary.failed).toBe(0)
    })

    it('handles failures gracefully', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
      const tool = new BatchImageOcrTool()
      const result = await tool.execute({ imagePaths: ['/mock/1.png', '/mock/2.png'] }, mockContext)
      expect(result.summary.totalImages).toBe(2)
      expect(result.summary.failed).toBe(1)
    })
  })

  describe('ImageToMarkdownTool', () => {
    it('has correct metadata', () => {
      const tool = new ImageToMarkdownTool()
      expect(tool.metadata.name).toBe('image_to_markdown')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('converts image OCR to markdown with alt text', async () => {
      const tool = new ImageToMarkdownTool()
      const result = await tool.execute(
        { imagePath: '/mock/test.png', includeAlt: true },
        mockContext
      )
      expect(result.markdown).toContain('![test.png](/mock/test.png)')
      expect(result.markdown).toContain('OCR result text')
      expect(result.metadata.confidence).toBe(95)
    })

    it('excludes alt text when includeAlt is false', async () => {
      const tool = new ImageToMarkdownTool()
      const result = await tool.execute(
        { imagePath: '/mock/test.png', includeAlt: false },
        mockContext
      )
      expect(result.markdown).not.toContain('![')
      expect(result.markdown).toBe('OCR result text')
    })
  })
})
