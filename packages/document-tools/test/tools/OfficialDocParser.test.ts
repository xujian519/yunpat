import { describe, it, expect, vi } from 'vitest'
import {
  OfficialDocParserTool,
  OfficialDocType,
  OfficialDocFields,
  OFFICIAL_DOC_PROMPTS,
} from '../../src/tools/OfficialDocParser.js'
import { ToolCategory } from '@yunpat/core'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 1024 }) as any),
    readFileSync: vi.fn(() => Buffer.from('mock')),
  }
})

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const EventEmitter = require('events')
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()

    setTimeout(() => {
      child.stdout.emit(
        'data',
        JSON.stringify({
          text: '审查意见通知书 申请号：2023100000001 发明名称：一种测试方法',
          markdown: '# 审查意见通知书',
          totalPages: 2,
          version: '1.0.0',
        })
      )
      child.emit('close', 0)
    }, 10)

    return child
  }),
}))

const mockContext: any = {
  registry: {},
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

describe('OfficialDocParser', () => {
  describe('OfficialDocParserTool', () => {
    it('has correct metadata', () => {
      const tool = new OfficialDocParserTool()
      expect(tool.metadata.name).toBe('official_doc_parse')
      expect(tool.metadata.category).toBe(ToolCategory.DOCUMENT)
      expect(tool.metadata.isConcurrencySafe).toBe(true)
      expect(tool.metadata.permissions).toContain('fs:read')
      expect(tool.metadata.permissions).toContain('exec:python')
    })

    it('throws error when file does not exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValueOnce(false)
      const tool = new OfficialDocParserTool()
      await expect(tool.execute({ filePath: '/nonexistent.pdf' }, mockContext)).rejects.toThrow(
        '文件不存在'
      )
    })

    it('parses official document', async () => {
      const tool = new OfficialDocParserTool()
      const result = await tool.execute(
        { filePath: '/mock/review.pdf', useOcr: false },
        mockContext
      )
      expect(result.rawText).toContain('审查意见通知书')
      expect(result.metadata.filename).toBe('review.pdf')
      expect(result.metadata.parseTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('OfficialDocType enum', () => {
    it('has correct values', () => {
      expect(OfficialDocType.REVIEW_OPINION).toBe('review_opinion')
      expect(OfficialDocType.REJECTION_DECISION).toBe('rejection_decision')
      expect(OfficialDocType.PAYMENT_NOTICE).toBe('payment_notice')
      expect(OfficialDocType.GRANT_DECISION).toBe('grant_decision')
      expect(OfficialDocType.REEXAMINATION_DECISION).toBe('reexamination_decision')
    })
  })

  describe('OFFICIAL_DOC_PROMPTS', () => {
    it('contains prompts for all doc types', () => {
      expect(OFFICIAL_DOC_PROMPTS[OfficialDocType.REVIEW_OPINION]).toContain('申请号')
      expect(OFFICIAL_DOC_PROMPTS[OfficialDocType.REJECTION_DECISION]).toContain('驳回决定')
      expect(OFFICIAL_DOC_PROMPTS[OfficialDocType.PAYMENT_NOTICE]).toContain('缴费')
      expect(OFFICIAL_DOC_PROMPTS[OfficialDocType.GRANT_DECISION]).toContain('授予决定')
      expect(OFFICIAL_DOC_PROMPTS[OfficialDocType.REEXAMINATION_DECISION]).toContain('复审无效')
    })
  })
})
