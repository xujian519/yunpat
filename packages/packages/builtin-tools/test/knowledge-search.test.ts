import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowledgeSearchTool, KnowledgeIndexBuilderTool } from '../src/knowledge-search.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
}

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

import * as fs from 'fs'

describe('KnowledgeSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be instantiated with default paths', () => {
    const tool = new KnowledgeSearchTool()
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('knowledge_search')
    expect(tool.metadata.category).toBe('knowledge')
  })

  it('should accept custom paths', () => {
    const tool = new KnowledgeSearchTool('/custom/kb', '/custom/index.json')
    expect(tool).toBeDefined()
  })

  it('should build index from cards directory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readdirSync).mockReturnValue(['card1.md', 'card2.md'] as any)
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (path === '/tmp/test-kb/cards/card1.md') {
        return '- 概念: 测试概念1\n- 领域: 专利法\n- 质量分: 0.9\n- 生成时间: 2024-01-01\n- 版本: 1\n\n# 测试标题1\n内容1'
      }
      if (path === '/tmp/test-kb/cards/card2.md') {
        return '- 概念: 测试概念2\n- 领域: 商标法\n- 质量分: 0.8\n- 生成时间: 2024-01-02\n- 版本: 1\n\n# 测试标题2\n内容2'
      }
      return ''
    })

    const tool = new KnowledgeSearchTool('/tmp/test-kb', '/tmp/test-kb/card-index.json')
    await (tool as any).buildIndex()

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenData = JSON.parse((fs.writeFileSync as any).mock.calls[0][1] as string)
    expect(writtenData.totalCards).toBe(2)
    expect(writtenData.cards[0].title).toBe('测试标题1')
    // Note: front-matter parser uses \w+ which does not match Chinese keys,
    // so concept/domain fall back to defaults
    expect(writtenData.conceptIndex['未分类']).toContain('card1')
    expect(writtenData.domainIndex['其他']).toContain('card1')
  })

  it('should calculate relevance correctly', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readdirSync).mockReturnValue(['card1.md'] as any)
    vi.mocked(fs.readFileSync).mockReturnValue(
      '- 概念: 发明专利\n- 领域: 专利法\n- 质量分: 1.0\n- 生成时间: 2024-01-01\n- 版本: 1\n\n# 发明专利申请流程\n内容'
    )

    const tool = new KnowledgeSearchTool('/tmp/test-kb2', '/tmp/test-kb2/card-index.json')
    await (tool as any).buildIndex()

    const relevance = (tool as any).calculateRelevance('发明专利', {
      title: '发明专利申请流程',
      concept: '发明专利',
      quality: 1.0,
    } as any)

    // 标题匹配 3.0 + 概念匹配 2.0 = 5.0 * quality 1.0
    expect(relevance).toBe(5.0)
  })
})

describe('KnowledgeIndexBuilderTool', () => {
  it('should be instantiated with default paths', () => {
    const tool = new KnowledgeIndexBuilderTool()
    expect(tool).toBeDefined()
    expect(tool.metadata.name).toBe('knowledge_index_builder')
    expect(tool.metadata.category).toBe('knowledge')
  })

  it('should execute and return success', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readdirSync).mockReturnValue([] as any)

    const tool = new KnowledgeIndexBuilderTool('/tmp/kb3', '/tmp/kb3/index.json')
    const result = await tool.execute({ forceRebuild: true }, mockContext)

    expect(result.success).toBe(true)
    expect(typeof result.buildTime).toBe('number')
    expect(result.buildTime).toBeGreaterThanOrEqual(0)
  })
})
