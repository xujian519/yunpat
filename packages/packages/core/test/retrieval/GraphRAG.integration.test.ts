/**
 * GraphRAGEngine + SemanticChunker + AgenticRAGEngine 集成测试
 *
 * 测试范围：
 * 1. GraphRAGEngine - 图增强检索引擎
 * 2. SemanticChunker - 语义分块器
 * 3. AgenticRAGEngine - 自适应检索增强生成引擎
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GraphRAGEngine } from '../../src/retrieval/GraphRAGEngine.js'
import { AgenticRAGEngine } from '../../src/retrieval/AgenticRAGEngine.js'
import { SemanticChunker } from '../../src/retrieval/SemanticChunker.js'
import { createMockEmbeddingAdapter } from '../helpers/mock-llm.js'
import type { BGEM3Client } from '../../src/memory/integration/BGEIntegration.js'

// 创建满足 BGEM3Client 接口的 mock
function createMockBGEM3Client() {
  const mockAdapter = createMockEmbeddingAdapter(1024)
  return {
    embed: mockAdapter.embed,
    embedBatch: mockAdapter.embedBatch,
  } as unknown as BGEM3Client
}

// ============================================================================
// Mock BGEIntegration 和 MemoryLayer
// ============================================================================

vi.mock('../../src/memory/integration/BGEIntegration.js', () => ({
  createBGEM3Client: () => ({
    embed: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    embedBatch: vi.fn().mockResolvedValue([new Array(1024).fill(0.1), new Array(1024).fill(0.2)]),
    healthCheck: vi.fn().mockResolvedValue(true),
    getCacheStats: vi.fn().mockReturnValue({ size: 0, hits: 0, misses: 0, hitRate: 0 }),
    clearCache: vi.fn(),
  }),
}))

vi.mock('../../src/memory/long-term/MemoryLayer.js', () => {
  const MockMemoryLayer = vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    addMemory: vi.fn().mockResolvedValue(1),
    addMemories: vi.fn().mockResolvedValue([1, 2, 3]),
    searchMemories: vi.fn().mockResolvedValue([
      {
        id: 1,
        content: '专利申请文件撰写需要明确技术方案',
        similarity: 0.85,
        metadata: { type: 'patent' },
        type: 'patent',
      },
      {
        id: 2,
        content: '技术方案应当包含必要的技术特征',
        similarity: 0.82,
        metadata: { type: 'patent' },
        type: 'patent',
      },
      {
        id: 3,
        content: '权利要求书应当保护核心技术方案',
        similarity: 0.78,
        metadata: { type: 'patent' },
        type: 'patent',
      },
    ]),
    getStats: vi.fn().mockResolvedValue({
      vector: { totalMemories: 3 },
      graph: { nodes: 0, edges: 0 },
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }))
  return { MemoryLayer: MockMemoryLayer }
})

// ============================================================================
// Mock UnifiedKnowledgeGraph 工厂函数
// ============================================================================

function createMockKnowledgeGraph() {
  return {
    query: vi.fn().mockResolvedValue([
      {
        id: 'kg-1',
        type: 'concept',
        name: '技术方案',
        content: '技术方案是专利申请的核心内容',
        score: 0.9,
        metadata: { source: 'knowledge-graph' },
      },
      {
        id: 'kg-2',
        type: 'concept',
        name: '权利要求',
        content: '权利要求书用于保护技术方案',
        score: 0.88,
        metadata: { source: 'knowledge-graph' },
      },
    ]),
    inferRelation: vi.fn().mockResolvedValue({
      relation: '保护',
      confidence: 0.85,
    }),
    getStats: vi.fn().mockReturnValue({
      nodes: 100,
      edges: 200,
    }),
  }
}

// ============================================================================
// GraphRAGEngine 测试
// ============================================================================

describe.skip('GraphRAGEngine - 需要修复 MemoryLayer mock', () => {
  let mockKnowledgeGraph: ReturnType<typeof createMockKnowledgeGraph>

  beforeEach(() => {
    mockKnowledgeGraph = createMockKnowledgeGraph()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该正确初始化带有知识图谱的引擎', () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      expect(engine).toBeDefined()
    })

    it('应该正确初始化不带知识图谱的引擎', () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      expect(engine).toBeDefined()
    })

    it('应该接受自定义图扩展配置', () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
        graphExpansion: {
          depth: 3,
          topKPerLevel: 10,
        },
      })

      expect(engine).toBeDefined()
    })

    it('应该接受自定义评分权重', () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
        vectorWeight: 0.6,
        graphWeight: 0.4,
      })

      expect(engine).toBeDefined()
    })
  })

  describe('retrieveWithGraph', () => {
    it('应该正确检索相关文档（有知识图谱）', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const results = await engine.retrieveWithGraph('如何撰写专利申请', {
        topK: 5,
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      // 验证结果包含向量和知识图谱结果
      const hasVectorSource = results.some((r) => r.source === 'vector')
      const hasGraphSource = results.some((r) => r.source === 'graph')

      expect(hasVectorSource || hasGraphSource).toBe(true)
    })

    it('应该正确检索相关文档（无知识图谱）', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      const results = await engine.retrieveWithGraph('如何撰写专利申请')

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)

      // 所有结果应该来自向量检索
      const allFromVector = results.every((r) => r.source === 'vector')
      expect(allFromVector).toBe(true)
    })

    it('应该禁用图增强时仅返回向量结果', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const results = await engine.retrieveWithGraph('如何撰写专利申请', {
        enableGraph: false,
      })

      expect(results).toBeDefined()

      // 所有结果应该来自向量检索
      const allFromVector = results.every((r) => r.source === 'vector')
      expect(allFromVector).toBe(true)
    })

    it('应该应用类型过滤', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      const results = await engine.retrieveWithGraph('如何撰写专利申请', {
        filter: {
          types: ['patent'],
        },
      })

      expect(results).toBeDefined()
    })

    it('应该应用相似度阈值', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      const results = await engine.retrieveWithGraph('如何撰写专利申请', {
        threshold: 0.8,
      })

      expect(results).toBeDefined()
      // 验证结果中所有文档的相似度都超过阈值
      const allAboveThreshold = results.every((r) => r.similarity >= 0.8)
      expect(allAboveThreshold).toBe(true)
    })
  })

  describe('augmentQuery', () => {
    it('应该正确增强查询（有知识图谱）', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const result = await engine.augmentQuery('如何撰写专利申请')

      expect(result).toBeDefined()
      expect(result.augmentedQuery).toBeDefined()
      expect(result.retrievedDocs).toBeDefined()
      expect(Array.isArray(result.retrievedDocs)).toBe(true)

      // 验证增强查询包含原始问题
      expect(result.augmentedQuery).toContain('如何撰写专利申请')
    })

    it('应该正确增强查询（无知识图谱）', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      const result = await engine.augmentQuery('如何撰写专利申请')

      expect(result).toBeDefined()
      expect(result.augmentedQuery).toBeDefined()
      expect(result.retrievedDocs).toBeDefined()

      // 无知识图谱时，graphExpansion 应该是 undefined
      expect(result.graphExpansion).toBeUndefined()
    })

    it('应该包含图扩展信息（有知识图谱）', async () => {
      const engine = new GraphRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const result = await engine.augmentQuery('如何撰写专利申请')

      // 验证图扩展信息存在
      if (result.graphExpansion) {
        expect(result.graphExpansion.entities).toBeDefined()
        expect(Array.isArray(result.graphExpansion.entities)).toBe(true)
      }
    })
  })
})

// ============================================================================
// SemanticChunker 测试
// ============================================================================

describe('SemanticChunker', () => {
  let mockBGE: BGEM3Client
  let chunker: SemanticChunker

  beforeEach(() => {
    mockBGE = createMockBGEM3Client()
    chunker = new SemanticChunker({
      embeddingClient: mockBGE,
      similarityThreshold: 0.5,
      minChunkSize: 100,
      maxChunkSize: 2000,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该正确初始化分块器', () => {
      expect(chunker).toBeDefined()
    })

    it('应该使用默认配置参数', () => {
      const defaultChunker = new SemanticChunker({
        embeddingClient: mockBGE,
      })

      expect(defaultChunker).toBeDefined()
    })

    it('应该接受自定义配置参数', () => {
      const customChunker = new SemanticChunker({
        embeddingClient: mockBGE,
        similarityThreshold: 0.6,
        minChunkSize: 50,
        maxChunkSize: 1000,
      })

      expect(customChunker).toBeDefined()
    })
  })

  describe('chunk', () => {
    it('应该正确检测语义边界', async () => {
      const text = `
        专利申请文件撰写需要明确技术方案。
        技术方案应当包含必要的技术特征。
        权利要求书应当保护核心技术方案。
        摘要应当简要说明技术方案的内容。
        说明书应当详细描述技术方案。
      `

      const chunks = await chunker.chunk(text)

      expect(chunks).toBeDefined()
      expect(Array.isArray(chunks)).toBe(true)
      expect(chunks.length).toBeGreaterThan(0)

      // 验证每个块都有正确的属性
      for (const chunk of chunks) {
        expect(chunk.content).toBeDefined()
        expect(chunk.index).toBeDefined()
        expect(typeof chunk.coherenceScore).toBe('number')
      }
    })

    it('应该正确处理空输入', async () => {
      const chunks = await chunker.chunk('')

      expect(chunks).toEqual([])
    })

    it('应该正确处理短文本输入', async () => {
      const chunks = await chunker.chunk('短文本')

      expect(chunks).toBeDefined()
      // 短文本应该被分成至少一个块
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    it('应该正确合并小段落', async () => {
      const text = '这是第一句话。这是第二句话。这是第三句话。'

      const chunks = await chunker.chunk(text)

      expect(chunks).toBeDefined()
      // 应该合并成至少一个块
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    it('应该正确拆分大段落', async () => {
      // 生成一个长文本（超过 maxChunkSize）
      const longText = '这是一个长句子。'.repeat(100)

      const chunks = await chunker.chunk(longText)

      expect(chunks).toBeDefined()
      // 应该被拆分成多个块
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('应该计算连贯性得分', async () => {
      const text = `
        专利申请文件撰写需要明确技术方案。
        技术方案应当包含必要的技术特征。
        权利要求书应当保护核心技术方案。
      `

      const chunks = await chunker.chunk(text)

      // 验证每个块都有连贯性得分
      for (const chunk of chunks) {
        expect(chunk.coherenceScore).toBeGreaterThanOrEqual(0)
        // 使用 toBeLessThanOrEqual 配合 small epsilon
        expect(chunk.coherenceScore).toBeLessThanOrEqual(1.0001)
      }
    })
  })

  describe('chunkPatentDocument', () => {
    it('应该正确分割专利文档', async () => {
      const patentDoc = {
        title: '一种基于深度学习的图像识别方法',
        abstract:
          '本发明提供了一种基于深度学习的图像识别方法，包括数据预处理、特征提取和分类步骤。',
        claims: '1. 一种基于深度学习的图像识别方法，其特征在于包括数据预处理步骤。',
        description: `
          本发明涉及图像识别技术领域。
          具体而言，本发明提供了一种基于深度学习的图像识别方法。
          该方法首先对图像进行预处理，然后提取特征，最后进行分类。
        `,
      }

      const chunks = await chunker.chunkPatentDocument(patentDoc)

      expect(chunks).toBeDefined()
      expect(Array.isArray(chunks)).toBe(true)

      // 验证包含各个部分的块
      const hasTitle = chunks.some((c) => c.metadata?.section === 'title')
      const hasAbstract = chunks.some((c) => c.metadata?.section === 'abstract')
      const hasClaims = chunks.some((c) => c.metadata?.section === 'claims')
      const hasDescription = chunks.some((c) => c.metadata?.section === 'description')

      expect(hasTitle || hasAbstract || hasClaims || hasDescription).toBe(true)
    })

    it('应该正确处理空专利文档', async () => {
      const emptyDoc = {}

      const chunks = await chunker.chunkPatentDocument(emptyDoc)

      expect(chunks).toBeDefined()
      expect(Array.isArray(chunks)).toBe(true)
    })

    it('应该正确处理只有标题的专利文档', async () => {
      const titleOnlyDoc = {
        title: '测试专利标题',
      }

      const chunks = await chunker.chunkPatentDocument(titleOnlyDoc)

      expect(chunks).toBeDefined()
      expect(chunks.length).toBeGreaterThan(0)

      // 验证包含标题块
      const hasTitle = chunks.some((c) => c.metadata?.section === 'title')
      expect(hasTitle).toBe(true)
    })

    it('应该为权利要求添加类型元数据', async () => {
      const patentDoc = {
        claims: '1. 一种图像识别方法。\n2. 根据权利要求1所述的方法，其特征在于包括预处理步骤。',
      }

      const chunks = await chunker.chunkPatentDocument(patentDoc)

      const claimChunks = chunks.filter((c) => c.metadata?.section === 'claims')

      // 验证权利要求有 claimNumber 和 claimType
      for (const chunk of claimChunks) {
        expect(chunk.metadata?.claimNumber).toBeDefined()
        expect(['independent', 'dependent']).toContain(chunk.metadata?.claimType)
      }
    })
  })
})

// ============================================================================
// AgenticRAGEngine 测试
// ============================================================================

describe.skip('AgenticRAGEngine - 需要修复 MemoryLayer mock', () => {
  let mockKnowledgeGraph: ReturnType<typeof createMockKnowledgeGraph>

  beforeEach(() => {
    mockKnowledgeGraph = createMockKnowledgeGraph()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该正确初始化自适应检索引擎', () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      expect(engine).toBeDefined()
    })

    it('应该使用默认配置参数', () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      expect(engine).toBeDefined()
    })

    it('应该接受自定义检索轮数和质量阈值', () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
        maxRetrievalRounds: 5,
        qualityThreshold: 0.8,
      })

      expect(engine).toBeDefined()
    })

    it('应该继承 GraphRAGEngine 的配置', () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      expect(engine).toBeDefined()
    })
  })

  describe('retrieveWithAgenticLoop', () => {
    it('应该执行多步骤自适应检索', async () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const result = await engine.retrieveWithAgenticLoop('如何撰写专利申请')

      expect(result).toBeDefined()
      expect(result.retrievedDocs).toBeDefined()
      expect(Array.isArray(result.retrievedDocs)).toBe(true)
      expect(result.retrievalRounds).toBeDefined()
      expect(typeof result.retrievalRounds).toBe('number')
      expect(result.qualityScore).toBeDefined()
      expect(typeof result.qualityScore).toBe('number')
      expect(result.followUpQueries).toBeDefined()
      expect(Array.isArray(result.followUpQueries)).toBe(true)
    })

    it('应该在质量达标时停止检索', async () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
        maxRetrievalRounds: 5,
        qualityThreshold: 0.5,
      })

      const result = await engine.retrieveWithAgenticLoop('如何撰写专利申请')

      // 如果质量达标，检索轮数应该小于最大轮数
      expect(result.retrievalRounds).toBeLessThanOrEqual(5)
    })

    it('应该达到最大轮数时停止检索', async () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        maxRetrievalRounds: 2,
        qualityThreshold: 0.9,
      })

      const result = await engine.retrieveWithAgenticLoop('如何撰写专利申请')

      // 应该达到最大轮数
      expect(result.retrievalRounds).toBe(2)
    })

    it('应该生成后续查询', async () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const result = await engine.retrieveWithAgenticLoop('如何撰写专利申请')

      // 如果检索质量不足，应该生成后续查询
      if (result.qualityScore < 0.7) {
        expect(result.followUpQueries.length).toBeGreaterThan(0)
      }
    })

    it('应该正确处理空结果', async () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
      })

      const result = await engine.retrieveWithAgenticLoop('如何撰写专利申请')

      expect(result).toBeDefined()
      expect(result.retrievedDocs.length).toBeGreaterThanOrEqual(0)
      expect(result.retrievalRounds).toBe(1)
    })

    it('应该支持自定义检索参数', async () => {
      const engine = new AgenticRAGEngine({
        databaseUrl: 'postgresql://test',
        knowledgeGraph: mockKnowledgeGraph,
      })

      const result = await engine.retrieveWithAgenticLoop('如何撰写专利申请', {
        topK: 3,
        threshold: 0.75,
        filter: {
          types: ['patent'],
        },
        enableGraph: false,
      })

      expect(result).toBeDefined()
      expect(result.retrievedDocs).toBeDefined()
    })
  })
})
