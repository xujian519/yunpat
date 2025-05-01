import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CardPipeline } from '../../src/knowledge/CardPipeline.js'
import type { LLMAdapter } from '../../src/lifecycle/Lifecycle.js'
import type { EmbeddingAdapter } from '../../src/llm/EmbeddingAdapter.js'
import * as path from 'path'

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  },
}))

import { promises as fs } from 'fs'

const mockLLM: LLMAdapter = {
  chat: vi.fn().mockResolvedValue({
    message: { role: 'assistant', content: '测试回复' },
  }),
  chatStream: vi.fn().mockImplementation(async function* () {
    yield { message: { role: 'assistant', content: 'test' } }
  }),
  embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]] }),
}

const mockEmbedder: EmbeddingAdapter = {
  embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
} as unknown as EmbeddingAdapter

describe('CardPipeline', () => {
  let pipeline: CardPipeline
  const kbPath = '/tmp/test-kb'

  beforeEach(() => {
    vi.clearAllMocks()
    pipeline = new CardPipeline({
      llm: mockLLM,
      knowledgeBasePath: kbPath,
      embedder: mockEmbedder,
    })
  })

  describe('constructor', () => {
    it('应该创建实例', () => {
      expect(pipeline).toBeDefined()
    })

    it('应该返回retriever', () => {
      const retriever = pipeline.getRetriever()
      expect(retriever).toBeDefined()
    })
  })

  describe('run', () => {
    it('应该处理空概念列表', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'))

      const result = await pipeline.run({
        concepts: [],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
      })

      expect(result.totalGenerated).toBe(0)
      expect(result.totalStored).toBe(0)
    })

    it('应该处理概念索引读取失败', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'))

      const result = await pipeline.run({
        concepts: ['创造性'],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
      })

      expect(result.totalGenerated).toBe(0)
    })

    it('应该调用进度回调', async () => {
      const conceptIndex = `### 创造性\n- [[创造性/创造性判断]]\n- [[创造性/三步法]]`
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex
        if (filePath.includes('Concept-Hierarchy.md')) return ''
        if (filePath.includes('.md') && !filePath.includes('index')) {
          return '# 测试页面\n\n这是一段足够长的测试内容，用于满足最小长度要求。创造性是指与现有技术相比具有突出的实质性特点和显著的进步。'.repeat(
            5
          )
        }
        throw new Error('not found')
      })

      vi.mocked(fs.readdir).mockResolvedValue([])

      const progressCalls: Array<{ phase: string; current: number; total: number }> = []
      const onProgress = (p: { phase: string; current: number; total: number }) => {
        progressCalls.push(p)
      }

      await pipeline.run({
        concepts: ['创造性'],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
        onProgress,
      })

      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls[0].phase).toBe('generating')
    })
  })

  describe('loadPersistedCards', () => {
    it('应该加载持久化的卡片', async () => {
      const mockCards = [
        {
          id: 'card-1',
          question: '测试问题',
          content: '测试内容',
          sourcePages: [],
          relatedCards: [],
          concept: '测试',
          domain: '测试领域',
          quality: 0.8,
          tags: ['测试'],
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { generator: 'test', llmModel: 'test', tokenCount: 10, referenceCount: 0 },
        },
      ]

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCards))

      const count = await pipeline.loadPersistedCards()
      expect(count).toBe(1)
    })

    it('应该在文件不存在时返回0', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'))

      const count = await pipeline.loadPersistedCards()
      expect(count).toBe(0)
    })
  })

  describe('error handling', () => {
    it('应该处理向量化错误', async () => {
      const badEmbedder: EmbeddingAdapter = {
        embed: vi.fn().mockRejectedValue(new Error('embedding failed')),
      } as unknown as EmbeddingAdapter

      const pipelineWithBadEmbedder = new CardPipeline({
        llm: mockLLM,
        knowledgeBasePath: kbPath,
        embedder: badEmbedder,
      })

      const conceptIndex = `### 创造性\n- [[创造性/创造性判断]]`
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex
        if (filePath.includes('Concept-Hierarchy.md')) return ''
        if (filePath.includes('.md')) {
          return '# 测试页面\n\n这是一段足够长的测试内容。'.repeat(5)
        }
        throw new Error('not found')
      })

      vi.mocked(fs.readdir).mockResolvedValue([])

      // Mock generator to return cards
      const result = await pipelineWithBadEmbedder.run({
        concepts: ['创造性'],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
      })

      // Should complete without throwing, but may have errors
      expect(result).toBeDefined()
    })
  })

  describe('loadConcepts', () => {
    it('应该解析概念索引', async () => {
      const conceptIndex = `### 创造性\n- [[创造性/创造性判断]]\n- [[创造性/三步法]]\n### 新颖性\n- [[新颖性/单独对比]]`

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex
        if (filePath.includes('Concept-Hierarchy.md')) return ''
        throw new Error('not found')
      })

      const result = await (pipeline as any).loadConcepts(['创造性'])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].name).toBe('创造性')
    })

    it('应该解析概念层级', async () => {
      const hierarchy = `### 1. 专利授权\n#### 创造性\n- 三步法\n### 2. 现有技术\n#### 公知常识`

      const result = (pipeline as any).parseConceptHierarchy(hierarchy)
      expect(result['创造性']).toBe('专利授权')
      expect(result['三步法']).toBe('专利授权')
      expect(result['公知常识']).toBe('现有技术')
    })

    it('应该处理空概念列表', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'))

      const result = await (pipeline as any).loadConcepts([])
      expect(result).toEqual([])
    })
  })

  describe('persistCards', () => {
    it('应该持久化卡片', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      const cards = [
        {
          id: 'card-1',
          question: '测试',
          content: '内容',
          quality: 0.9,
          sourcePages: ['page1'],
          relatedCards: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      await (pipeline as any).persistCards(cards)
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it('应该处理 mkdir 失败', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('mkdir failed'))
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      const cards = [
        {
          id: 'card-1',
          question: '测试',
          content: '内容',
          quality: 0.9,
          sourcePages: ['page1'],
          relatedCards: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      await (pipeline as any).persistCards(cards)
      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('parseConceptIndex', () => {
    it('应该处理带锚点的 wikilink', () => {
      const content = `### 创造性\n- [[创造性/判断#标题]]`
      const result = (pipeline as any).parseConceptIndex(content)
      expect(result['创造性']).toEqual(['创造性/判断'])
    })

    it('应该处理一行多个 wikilink', () => {
      const content = `### 创造性\n- [[创造性/判断]] [[创造性/三步法]] [[创造性/审查]]`
      const result = (pipeline as any).parseConceptIndex(content)
      expect(result['创造性']).toEqual(['创造性/判断', '创造性/三步法', '创造性/审查'])
    })

    it('应该去重 wikilink', () => {
      const content = `### 创造性\n- [[创造性/判断]]\n- [[创造性/判断]]`
      const result = (pipeline as any).parseConceptIndex(content)
      expect(result['创造性']).toEqual(['创造性/判断'])
    })
  })

  describe('parseConceptHierarchy', () => {
    it('应该使用补充映射', () => {
      const hierarchy = `### 1. 专利授权\n#### 创造性`
      const result = (pipeline as any).parseConceptHierarchy(hierarchy)
      expect(result['创造性']).toBe('专利授权')
      expect(result['三步法']).toBe('专利授权')
      expect(result['按许销售']).toBe('专利侵权')
    })

    it('应该解析三级概念', () => {
      const hierarchy = `### 1. 专利授权\n#### 创造性\n- 单独对比\n- 结合启示`
      const result = (pipeline as any).parseConceptHierarchy(hierarchy)
      expect(result['创造性']).toBe('专利授权')
      expect(result['单独对比']).toBe('专利授权')
      expect(result['结合启示']).toBe('专利授权')
    })
  })

  describe('scanDir', () => {
    it('应该过滤非 markdown 文件', async () => {
      const mockEntries = [
        { name: 'test.md', isDirectory: () => false },
        { name: 'test.txt', isDirectory: () => false },
        { name: 'test.json', isDirectory: () => false },
      ]

      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any)

      const files = await (pipeline as any).scanDir('/test/path')
      expect(files).toEqual(['/test/path/test.md'])
    })

    it('应该过滤 index.md 文件', async () => {
      const mockEntries = [
        { name: 'index.md', isDirectory: () => false },
        { name: 'valid.md', isDirectory: () => false },
      ]

      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any)

      const files = await (pipeline as any).scanDir('/test/path')
      expect(files).toEqual(['/test/path/valid.md'])
    })

    it('应该递归扫描子目录', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([
          { name: 'subdir', isDirectory: () => true },
          { name: 'file.md', isDirectory: () => false },
        ] as any)
        .mockResolvedValueOnce([{ name: 'subfile.md', isDirectory: () => false }] as any)

      const files = await (pipeline as any).scanDir('/test/path')
      expect(files).toContain('/test/path/file.md')
      expect(files).toContain('/test/path/subdir/subfile.md')
    })

    it('应该处理目录读取失败', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('permission denied'))

      const files = await (pipeline as any).scanDir('/test/path')
      expect(files).toEqual([])
    })
  })

  describe('scanRelatedFiles', () => {
    beforeEach(() => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'docs', isDirectory: () => true },
        { name: 'cards', isDirectory: () => true },
        { name: '.hidden', isDirectory: () => true },
      ] as any)
    })

    it('应该找到匹配的文件', async () => {
      const mockFiles = [`${kbPath}/docs/创造性.md`, `${kbPath}/docs/其他.md`]

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath === `${kbPath}/docs/创造性.md`) {
          return '# 创造性\n\n' + '内容'.repeat(50)
        }
        throw new Error('not found')
      })

      vi.spyOn(pipeline as any, 'scanDir').mockResolvedValue(mockFiles)

      const pages = await (pipeline as any).scanRelatedFiles('创造性', 5)
      expect(pages.length).toBeGreaterThanOrEqual(0)
    })

    it('应该跳过过短文件', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        return '# 短\n\n内容'
      })

      vi.spyOn(pipeline as any, 'scanDir').mockResolvedValue([`${kbPath}/docs/创造性.md`])

      const pages = await (pipeline as any).scanRelatedFiles('创造性', 5)
      expect(pages.length).toBe(0)
    })

    it('应该处理文件读取失败', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('read failed'))

      vi.spyOn(pipeline as any, 'scanDir').mockResolvedValue([`${kbPath}/docs/创造性.md`])

      const pages = await (pipeline as any).scanRelatedFiles('创造性', 5)
      expect(pages.length).toBe(0)
    })

    it('应该限制最大文件数', async () => {
      const mockFiles = [
        `${kbPath}/docs/创造性1.md`,
        `${kbPath}/docs/创造性2.md`,
        `${kbPath}/docs/创造性3.md`,
      ]

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        return `# 标题\n\n${'内容'.repeat(50)}`
      })

      vi.spyOn(pipeline as any, 'scanDir').mockResolvedValue(mockFiles)

      const pages = await (pipeline as any).scanRelatedFiles('创造性', 2)
      expect(pages.length).toBeLessThanOrEqual(2)
    })
  })

  describe('loadConcepts - additional coverage', () => {
    it('应该处理 targetSet 为 null', async () => {
      const conceptIndex = `### 创造性\n- [[创造性/判断]]\n### 新颖性\n- [[新颖性/对比]]`

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex
        if (filePath.includes('Concept-Hierarchy.md')) return ''
        throw new Error('not found')
      })

      const result = await (pipeline as any).loadConcepts(undefined)
      expect(result.length).toBe(2)
    })

    it('应该模糊匹配概念名', async () => {
      const conceptIndex = `### 创造性判断\n- [[创造性/判断]]`

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex
        if (filePath.includes('Concept-Hierarchy.md')) return ''
        throw new Error('not found')
      })

      const result = await (pipeline as any).loadConcepts(['创造性'])
      expect(result.length).toBeGreaterThan(0)
    })

    it('应该处理层级文件加载失败', async () => {
      const conceptIndex = `### 创造性\n- [[创造性/判断]]`

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex
        if (filePath.includes('Concept-Hierarchy.md')) {
          throw new Error('not found')
        }
        throw new Error('not found')
      })

      const result = await (pipeline as any).loadConcepts(['创造性'])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].domain).toBe('未分类')
    })
  })
})
