import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DocxExtractTextTool,
  DocxToHtmlTool,
  DocxToMarkdownTool,
  DocxParseTool,
} from '../../src/tools/DocxTools.js'
import { OutputFormat } from '../../src/types/document.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(() => Promise.resolve({ value: 'Hello from DOCX', messages: [] })),
    convertToHtml: vi.fn(() => Promise.resolve({ value: '<p>Hello from DOCX</p>', messages: [] })),
  },
}))

vi.mock('turndown', () => ({
  default: class TurndownService {
    constructor(public options?: any) {}
    turndown(html: string) {
      return html.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n').trim()
    }
  },
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 1024 })),
    readFileSync: vi.fn(() => Buffer.from('mock docx content')),
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

describe('DocxTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DocxExtractTextTool', () => {
    it('has correct metadata', () => {
      const tool = new DocxExtractTextTool()
      expect(tool.metadata.name).toBe('docx_extract_text')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
    })

    it('extracts text from DOCX', async () => {
      const tool = new DocxExtractTextTool()
      const result = await tool.execute({ filePath: '/mock/test.docx' }, mockContext)
      expect(result.text).toBe('Hello from DOCX')
      expect(result.metadata.filename).toBe('test.docx')
      expect(result.metadata.size).toBe(1024)
    })
  })

  describe('DocxToHtmlTool', () => {
    it('has correct metadata', () => {
      const tool = new DocxToHtmlTool()
      expect(tool.metadata.name).toBe('docx_to_html')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('converts DOCX to HTML', async () => {
      const tool = new DocxToHtmlTool()
      const result = await tool.execute({ filePath: '/mock/test.docx' }, mockContext)
      expect(result.html).toContain('Hello from DOCX')
      expect(Array.isArray(result.messages)).toBe(true)
    })
  })

  describe('DocxToMarkdownTool', () => {
    it('has correct metadata', () => {
      const tool = new DocxToMarkdownTool()
      expect(tool.metadata.name).toBe('docx_to_markdown')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('converts DOCX to Markdown', async () => {
      const tool = new DocxToMarkdownTool()
      const result = await tool.execute({ filePath: '/mock/test.docx' }, mockContext)
      expect(result.markdown).toBeDefined()
      expect(result.metadata.filename).toBe('test.docx')
    })
  })

  describe('DocxParseTool', () => {
    it('has correct metadata', () => {
      const tool = new DocxParseTool()
      expect(tool.metadata.name).toBe('docx_parse')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('parses DOCX to DocumentParseResult', async () => {
      const tool = new DocxParseTool()
      const result = await tool.execute(
        { filePath: '/mock/test.docx', outputFormat: OutputFormat.TEXT },
        mockContext
      )
      expect(result.documentType).toBe('docx')
      expect(result.filename).toBe('test.docx')
      expect(result.elements.length).toBeGreaterThanOrEqual(0)
      expect(result.parseTime).toBeGreaterThanOrEqual(0)
    })
  })
})
