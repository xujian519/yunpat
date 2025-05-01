import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PdfExtractTextTool,
  PdfParseTool,
  PdfToMarkdownTool,
  PdfOcrTool,
} from '../../src/tools/PdfTools.js'
import { OutputFormat } from '../../src/types/document.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('pdf-parse', () => ({
  default: vi.fn(() =>
    Promise.resolve({
      text: 'Sample PDF text\nSecond line',
      numpages: 3,
      info: { Author: 'Test Author', Title: 'Test Title' },
    })
  ),
}))

vi.mock('pdfjs-dist', () => ({
  default: {},
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 2048 }) as any),
    readFileSync: vi.fn(() => Buffer.from('mock pdf content')),
  }
})

const mockContext: any = {
  registry: {},
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

describe('PdfTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PdfExtractTextTool', () => {
    it('has correct metadata', () => {
      const tool = new PdfExtractTextTool()
      expect(tool.metadata.name).toBe('pdf_extract_text')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
    })

    it('extracts text from PDF', async () => {
      const tool = new PdfExtractTextTool()
      const result = await tool.execute({ filePath: '/mock/test.pdf' }, mockContext)
      expect(result.text).toContain('Sample PDF text')
    })

    it('includes metadata when requested', async () => {
      const tool = new PdfExtractTextTool()
      const result = await tool.execute(
        { filePath: '/mock/test.pdf', includeMetadata: true },
        mockContext
      )
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.pages).toBe(3)
    })
  })

  describe('PdfParseTool', () => {
    it('has correct metadata', () => {
      const tool = new PdfParseTool()
      expect(tool.metadata.name).toBe('pdf_parse')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('parses PDF to DocumentParseResult', async () => {
      const tool = new PdfParseTool()
      const result = await tool.execute(
        { filePath: '/mock/test.pdf', outputFormat: OutputFormat.TEXT },
        mockContext
      )
      expect(result.documentType).toBe('pdf')
      expect(result.filename).toBe('test.pdf')
      expect(result.text).toContain('Sample PDF text')
      expect(result.metadata.totalPages).toBe(3)
      expect(result.metadata.author).toBe('Test Author')
      expect(result.metadata.title).toBe('Test Title')
      expect(result.parseTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('PdfToMarkdownTool', () => {
    it('has correct metadata', () => {
      const tool = new PdfToMarkdownTool()
      expect(tool.metadata.name).toBe('pdf_to_markdown')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('converts PDF to markdown', async () => {
      const tool = new PdfToMarkdownTool()
      const result = await tool.execute({ filePath: '/mock/test.pdf' }, mockContext)
      expect(result.markdown).toBeDefined()
      expect(result.metadata.totalPages).toBe(3)
      expect(result.metadata.parseTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('PdfOcrTool', () => {
    it('has correct metadata', () => {
      const tool = new PdfOcrTool()
      expect(tool.metadata.name).toBe('pdf_ocr')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.permissions).toContain('fs:read')
      expect(tool.metadata.permissions).toContain('exec:marker')
    })
  })
})
