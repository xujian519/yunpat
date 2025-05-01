import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OfficialDocParserToolV2, OfficialDocType } from '../../src/tools/OfficialDocParserV2.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('../../src/tools/PdfTools.js', () => ({
  PdfExtractTextTool: class {
    async execute(input: any) {
      return {
        text: `审查意见通知书\n申请号：2023100000001\n发明名称：一种智能测试方法\n审查意见：本申请不具备创造性\n答复期限：2024年6月30日\n审查员：张三\n引用文献：D1,D2`,
        metadata: { pages: 2 },
      }
    }
  },
}))

vi.mock('../../src/tools/OcrTools.js', () => ({
  ImageOcrTool: class {
    async execute(input: any) {
      return {
        text: 'OCR text from image',
        confidence: 95,
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
    readFileSync: vi.fn(() => Buffer.from('mock')),
  }
})

const mockContext: any = {
  registry: {},
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

describe('OfficialDocParserV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('OfficialDocParserToolV2', () => {
    it('has correct metadata', () => {
      const tool = new OfficialDocParserToolV2()
      expect(tool.metadata.name).toBe('official_doc_parse_v2')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
      expect(tool.metadata.version).toBe('2.0.0')
    })

    it('throws error when file does not exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(false)
      const tool = new OfficialDocParserToolV2()
      await expect(tool.execute({ filePath: '/nonexistent.pdf' }, mockContext)).rejects.toThrow(
        '文件不存在'
      )
    })

    it('parses PDF official document', async () => {
      const tool = new OfficialDocParserToolV2()
      const result = await tool.execute({ filePath: '/mock/审查意见.pdf' }, mockContext)
      expect(result.rawText).toContain('审查意见通知书')
      expect(result.docType).toBe(OfficialDocType.REVIEW_OPINION)
      expect(result.metadata.filename).toBe('审查意见.pdf')
      expect(result.metadata.totalPages).toBe(2)
      expect(result.metadata.parseTime).toBeGreaterThanOrEqual(0)
      expect(result.metadata.extractionMethod).toBe('PDF解析')
    })

    it('extracts application number from text', async () => {
      const tool = new OfficialDocParserToolV2()
      const result = await tool.execute({ filePath: '/mock/审查意见.pdf' }, mockContext)
      expect(result.fields.applicationNumber).toBe('2023100000001')
    })

    it('extracts invention title from text', async () => {
      const tool = new OfficialDocParserToolV2()
      const result = await tool.execute({ filePath: '/mock/审查意见.pdf' }, mockContext)
      expect(result.fields.inventionTitle).toBe('一种智能测试方法')
    })

    it('extracts review summary and examiner for review opinion', async () => {
      const tool = new OfficialDocParserToolV2()
      const result = await tool.execute({ filePath: '/mock/审查意见.pdf' }, mockContext)
      expect(result.fields.reviewSummary).toContain('本申请不具备创造性')
      expect(result.fields.examiner).toBe('张三')
    })

    it('extracts reference documents', async () => {
      const tool = new OfficialDocParserToolV2()
      const result = await tool.execute({ filePath: '/mock/审查意见.pdf' }, mockContext)
      expect(result.fields.referenceDocuments).toEqual(['D1', 'D2'])
    })

    it('detects doc type from filename', async () => {
      const tool = new OfficialDocParserToolV2()
      const result1 = await tool.execute({ filePath: '/mock/驳回决定.pdf' }, mockContext)
      expect(result1.docType).toBe(OfficialDocType.REJECTION_DECISION)

      const result2 = await tool.execute({ filePath: '/mock/缴费通知书.pdf' }, mockContext)
      expect(result2.docType).toBe(OfficialDocType.PAYMENT_NOTICE)
    })

    it('uses OCR for images when enabled', async () => {
      const tool = new OfficialDocParserToolV2()
      const result = await tool.execute({ filePath: '/mock/image.png', useOcr: true }, mockContext)
      expect(result.rawText).toBe('OCR text from image')
      expect(result.metadata.extractionMethod).toBe('OCR')
    })

    it('throws error for images when OCR is disabled', async () => {
      const tool = new OfficialDocParserToolV2()
      await expect(
        tool.execute({ filePath: '/mock/image.png', useOcr: false }, mockContext)
      ).rejects.toThrow('图片文件需要启用OCR')
    })

    it('throws error for unsupported file formats', async () => {
      const tool = new OfficialDocParserToolV2()
      await expect(tool.execute({ filePath: '/mock/doc.zip' }, mockContext)).rejects.toThrow(
        '不支持的文件格式'
      )
    })
  })
})
