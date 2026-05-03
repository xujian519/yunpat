import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  UniversalDocumentParserTool,
  BatchDocumentParserTool,
  DocumentConverterTool,
} from '../../src/tools/UniversalDocumentTool.js'
import { DocumentType, OutputFormat } from '../../src/types/document.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('../../src/tools/PdfTools.js', () => ({
  PdfParseTool: class {
    metadata = { name: 'pdf_parse' }
    async execute() {
      return {
        documentType: DocumentType.PDF,
        filename: 'test.pdf',
        text: 'PDF content',
        elements: [],
        metadata: { totalPages: 1 },
        parseTime: 100,
      }
    }
  },
}))

vi.mock('../../src/tools/DocxTools.js', () => ({
  DocxParseTool: class {
    metadata = { name: 'docx_parse' }
    async execute() {
      return {
        documentType: DocumentType.DOCX,
        filename: 'test.docx',
        text: 'DOCX content',
        elements: [],
        metadata: {},
        parseTime: 100,
      }
    }
  },
}))

vi.mock('../../src/tools/ExcelTools.js', () => ({
  ExcelParseTool: class {
    metadata = { name: 'excel_parse' }
    async execute() {
      return {
        documentType: DocumentType.XLSX,
        filename: 'test.xlsx',
        text: 'Excel content',
        elements: [],
        metadata: {},
        parseTime: 100,
      }
    }
  },
}))

vi.mock('../../src/tools/OcrTools.js', () => ({
  ImageOcrTool: class {
    metadata = { name: 'image_ocr' }
    async execute() {
      return {
        text: 'OCR text',
        confidence: 99,
        language: 'eng',
      }
    }
  },
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 1024 }) as any),
    readFileSync: vi.fn(() => Buffer.from('mock content')),
    writeFileSync: vi.fn(),
  }
})

const mockContext: any = {
  registry: {},
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

describe('UniversalDocumentTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UniversalDocumentParserTool', () => {
    it('has correct metadata', () => {
      const tool = new UniversalDocumentParserTool()
      expect(tool.metadata.name).toBe('universal_document_parser')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
    })

    it('throws error when file does not exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(false)
      const tool = new UniversalDocumentParserTool()
      await expect(tool.execute({ filePath: '/nonexistent.pdf' }, mockContext)).rejects.toThrow(
        '文件不存在'
      )
    })

    it('parses PDF files', async () => {
      const tool = new UniversalDocumentParserTool()
      const result = await tool.execute({ filePath: '/mock/test.pdf' }, mockContext)
      expect(result.documentType).toBe(DocumentType.PDF)
      expect(result.text).toBe('PDF content')
    })

    it('parses DOCX files', async () => {
      const tool = new UniversalDocumentParserTool()
      const result = await tool.execute({ filePath: '/mock/test.docx' }, mockContext)
      expect(result.documentType).toBe(DocumentType.DOCX)
      expect(result.text).toBe('DOCX content')
    })

    it('parses XLSX files', async () => {
      const tool = new UniversalDocumentParserTool()
      const result = await tool.execute({ filePath: '/mock/test.xlsx' }, mockContext)
      expect(result.documentType).toBe(DocumentType.XLSX)
      expect(result.text).toBe('Excel content')
    })

    it('parses image files with OCR', async () => {
      const tool = new UniversalDocumentParserTool()
      const result = await tool.execute({ filePath: '/mock/test.png' }, mockContext)
      expect(result.documentType).toBe(DocumentType.IMAGE)
      expect(result.text).toBe('OCR text')
    })

    it('reads text files directly', async () => {
      const { readFileSync } = await import('fs')
      vi.mocked(readFileSync).mockReturnValueOnce('plain text content' as any)
      const tool = new UniversalDocumentParserTool()
      const result = await tool.execute({ filePath: '/mock/test.txt' }, mockContext)
      expect(result.documentType).toBe(DocumentType.TXT)
      expect(result.text).toBe('plain text content')
    })

    it('falls back to text mode for unknown file types', async () => {
      const { readFileSync } = await import('fs')
      vi.mocked(readFileSync).mockReturnValueOnce('unknown file content' as any)
      const tool = new UniversalDocumentParserTool()
      const result = await tool.execute({ filePath: '/mock/test.unknown' }, mockContext)
      expect(result.documentType).toBe('txt')
      expect(result.text).toBe('unknown file content')
    })
  })

  describe('BatchDocumentParserTool', () => {
    it('has correct metadata', () => {
      const tool = new BatchDocumentParserTool()
      expect(tool.metadata.name).toBe('batch_document_parser')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('parses multiple files', async () => {
      const tool = new BatchDocumentParserTool()
      const result = await tool.execute(
        { filePaths: ['/mock/test.pdf', '/mock/test.docx'] },
        mockContext
      )
      expect(result.results).toHaveLength(2)
      expect(result.summary.totalFiles).toBe(2)
      expect(result.summary.successful).toBe(2)
      expect(result.summary.failed).toBe(0)
    })

    it('handles failures gracefully', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
      const tool = new BatchDocumentParserTool()
      const result = await tool.execute(
        { filePaths: ['/mock/test.pdf', '/mock/nonexistent.docx'] },
        mockContext
      )
      expect(result.summary.totalFiles).toBe(2)
      expect(result.summary.failed).toBe(1)
    })
  })

  describe('DocumentConverterTool', () => {
    it('has correct metadata', () => {
      const tool = new DocumentConverterTool()
      expect(tool.metadata.name).toBe('document_converter')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.permissions).toContain('fs:read')
      expect(tool.metadata.permissions).toContain('fs:write')
    })

    it('converts document to JSON', async () => {
      const tool = new DocumentConverterTool()
      const result = await tool.execute(
        {
          inputPath: '/mock/test.pdf',
          outputPath: '/mock/out.json',
          outputFormat: OutputFormat.JSON,
        },
        mockContext
      )
      expect(result.success).toBe(true)
      expect(result.outputFormat).toBe(OutputFormat.JSON)
    })

    it('converts document to Markdown', async () => {
      const tool = new DocumentConverterTool()
      const result = await tool.execute(
        {
          inputPath: '/mock/test.pdf',
          outputPath: '/mock/out.md',
          outputFormat: OutputFormat.MARKDOWN,
        },
        mockContext
      )
      expect(result.success).toBe(true)
      expect(result.outputFormat).toBe(OutputFormat.MARKDOWN)
    })

    it('converts document to Text', async () => {
      const tool = new DocumentConverterTool()
      const result = await tool.execute(
        {
          inputPath: '/mock/test.pdf',
          outputPath: '/mock/out.txt',
          outputFormat: OutputFormat.TEXT,
        },
        mockContext
      )
      expect(result.success).toBe(true)
      expect(result.outputFormat).toBe(OutputFormat.TEXT)
    })
  })
})
