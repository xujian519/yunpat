import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ExcelReadTool,
  ExcelToJsonTool,
  ExcelToMarkdownTool,
  ExcelParseTool,
} from '../../src/tools/ExcelTools.js'
import { OutputFormat } from '../../src/types/document.js'
import { ToolCategory } from '@yunpat/core'
import * as fs from 'fs'

vi.mock('xlsx', () => ({
  readFile: vi.fn(() => ({
    SheetNames: ['Sheet1', 'Sheet2'],
    Sheets: {
      Sheet1: {},
      Sheet2: {},
    },
  })),
  utils: {
    sheet_to_json: vi.fn((worksheet, options) => {
      if (options && options.header === 1) {
        return [
          ['Name', 'Age'],
          ['Alice', 30],
          ['Bob', 25],
        ]
      }
      return [
        { Name: 'Alice', Age: 30 },
        { Name: 'Bob', Age: 25 },
      ]
    }),
  },
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 1024 })),
    readFileSync: vi.fn(() => Buffer.from('mock')),
  }
})

const mockContext: any = {
  registry: {},
  llm: {
    chat: vi.fn(),
    chatStream: vi.fn(),
    embed: vi.fn(),
  } as unknown as import('@yunpat/core').LLMAdapter,
  memory: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(),
    setAll: vi.fn(),
    clear: vi.fn(),
    search: vi.fn(),
  },
  eventBus: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), request: vi.fn() },
}

describe('ExcelTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ExcelReadTool', () => {
    it('has correct metadata', () => {
      const tool = new ExcelReadTool()
      expect(tool.metadata.name).toBe('excel_read')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
    })

    it('reads all sheets by default', async () => {
      const tool = new ExcelReadTool()
      const result = await tool.execute({ filePath: '/mock/test.xlsx' }, mockContext)
      expect(result.sheets).toHaveLength(2)
      expect(result.metadata.sheetCount).toBe(2)
      expect(result.activeSheet).toBe('Sheet1')
    })

    it('reads specific sheet by name', async () => {
      const tool = new ExcelReadTool()
      const result = await tool.execute(
        { filePath: '/mock/test.xlsx', sheetName: 'Sheet1' },
        mockContext
      )
      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].name).toBe('Sheet1')
      expect(result.sheets[0].rowCount).toBe(3)
      expect(result.sheets[0].columnCount).toBe(2)
    })
  })

  describe('ExcelToJsonTool', () => {
    it('has correct metadata', () => {
      const tool = new ExcelToJsonTool()
      expect(tool.metadata.name).toBe('excel_to_json')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('converts excel to JSON string', async () => {
      const tool = new ExcelToJsonTool()
      const result = await tool.execute({ filePath: '/mock/test.xlsx', pretty: true }, mockContext)
      expect(typeof result.json).toBe('string')
      expect(result.metadata.sheetCount).toBe(2)
      expect(result.sheets.Sheet1).toBeDefined()
    })
  })

  describe('ExcelToMarkdownTool', () => {
    it('has correct metadata', () => {
      const tool = new ExcelToMarkdownTool()
      expect(tool.metadata.name).toBe('excel_to_markdown')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('converts excel to markdown table', async () => {
      const tool = new ExcelToMarkdownTool()
      const result = await tool.execute({ filePath: '/mock/test.xlsx' }, mockContext)
      expect(result.markdown).toContain('## Sheet1')
      expect(result.markdown).toContain('| Name | Age |')
      expect(result.markdown).toContain('| Alice | 30 |')
      expect(result.metadata.sheetCount).toBe(2)
    })
  })

  describe('ExcelParseTool', () => {
    it('has correct metadata', () => {
      const tool = new ExcelParseTool()
      expect(tool.metadata.name).toBe('excel_parse')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
    })

    it('parses excel to DocumentParseResult', async () => {
      const tool = new ExcelParseTool()
      const result = await tool.execute(
        { filePath: '/mock/test.xlsx', outputFormat: OutputFormat.JSON },
        mockContext
      )
      expect(result.documentType).toBe('xlsx')
      expect(result.filename).toBe('test.xlsx')
      expect(result.elements.length).toBeGreaterThan(0)
      expect(result.parseTime).toBeGreaterThanOrEqual(0)
    })
  })
})
