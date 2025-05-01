/**
 * 知识库检索工具
 *
 * 从 YunPat 专利知识库中检索相关卡片和文档
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

/**
 * 卡片元数据
 */
export interface CardMetadata {
  /** 卡片ID（文件名） */
  id: string
  /** 卡片标题 */
  title: string
  /** 核心概念 */
  concept: string
  /** 质量分数 */
  quality: number
  /** 领域分类 */
  domain: string
  /** 文件路径 */
  filePath: string
  /** 相关概念 */
  relatedConcepts: string[]
  /** 生成时间 */
  generatedAt: string
  /** 版本 */
  version: number
}

/**
 * 知识库索引
 */
export interface KnowledgeIndex {
  /** 卡片总数 */
  totalCards: number
  /** 卡片列表 */
  cards: CardMetadata[]
  /** 概念索引（概念 -> 卡片ID列表） */
  conceptIndex: Record<string, string[]>
  /** 领域索引（领域 -> 卡片ID列表） */
  domainIndex: Record<string, string[]>
  /** 最后更新时间 */
  lastUpdated: string
}

/**
 * 检索结果
 */
export interface SearchResult {
  /** 匹配的卡片 */
  cards: Array<{
    metadata: CardMetadata
    content?: string
    relevanceScore: number
  }>
  /** 相关概念 */
  relatedConcepts: string[]
  /** 检索时间 */
  searchTime: number
}

/**
 * 知识库检索工具
 */
export class KnowledgeSearchTool extends EnhancedBaseTool<
  {
    query: string
    concepts?: string[]
    domains?: string[]
    limit?: number
    includeContent?: boolean
  },
  SearchResult
> {
  private knowledgeBasePath: string
  private indexPath: string
  private index: KnowledgeIndex | null = null

  readonly metadata = {
    name: 'knowledge_search',
    description: '从专利知识库中检索相关卡片和文档',
    category: 'knowledge' as any,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('检索查询（关键词或问题）'),
      concepts: z.array(z.string()).optional().describe('限定概念范围'),
      domains: z.array(z.string()).optional().describe('限定领域范围'),
      limit: z.number().optional().default(10).describe('返回结果数量限制'),
      includeContent: z.boolean().optional().default(true).describe('是否包含卡片内容'),
    }),
    outputSchema: z.object({
      cards: z.array(
        z.object({
          metadata: z.object({
            id: z.string(),
            title: z.string(),
            concept: z.string(),
            quality: z.number(),
            domain: z.string(),
            filePath: z.string(),
            relatedConcepts: z.array(z.string()),
            generatedAt: z.string(),
            version: z.number(),
          }),
          content: z.string().optional(),
          relevanceScore: z.number(),
        })
      ),
      relatedConcepts: z.array(z.string()),
      searchTime: z.number(),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  constructor(knowledgeBasePath?: string, indexPath?: string) {
    super()
    const basePath =
      knowledgeBasePath ||
      process.env.KNOWLEDGE_BASE_PATH ||
      '/Users/xujian/projects/YunPat/knowledge-base'
    this.knowledgeBasePath = basePath
    this.indexPath = indexPath || `${basePath}/card-index.json`
  }

  async execute(
    input: {
      query: string
      concepts?: string[]
      domains?: string[]
      limit?: number
      includeContent?: boolean
    },
    _context: ToolContext
  ): Promise<SearchResult> {
    const startTime = Date.now()

    // 1. 加载或构建索引
    if (!this.index) {
      await this.loadIndex()
    }

    if (!this.index) {
      throw new Error('知识库索引加载失败')
    }

    // 2. 搜索匹配的卡片
    const matchedCards = this.searchCards(
      input.query,
      input.concepts,
      input.domains,
      input.limit || 10
    )

    // 3. 读取卡片内容（如果需要）
    const results = await Promise.all(
      matchedCards.map(async (cardMeta) => {
        const content =
          input.includeContent !== false ? await this.loadCardContent(cardMeta.filePath) : ''

        return {
          metadata: cardMeta,
          content: content || '', // 确保不为 undefined
          relevanceScore: this.calculateRelevance(input.query, cardMeta),
        }
      })
    )

    // 4. 查找相关概念
    const relatedConcepts = this.findRelatedConcepts(
      input.query,
      results.map((r) => r.metadata.concept)
    )

    return {
      cards: results,
      relatedConcepts,
      searchTime: Date.now() - startTime,
    }
  }

  /**
   * 加载索引
   */
  private async loadIndex(): Promise<void> {
    try {
      if (fs.existsSync(this.indexPath)) {
        const indexData = fs.readFileSync(this.indexPath, 'utf-8')
        this.index = JSON.parse(indexData)
      } else {
        // 索引不存在，构建新索引
        await this.buildIndex()
      }
    } catch (error) {
      console.error('加载索引失败:', error)
      await this.buildIndex()
    }
  }

  /**
   * 构建索引
   */
  async buildIndex(): Promise<void> {
    const cardsPath = path.join(this.knowledgeBasePath, 'cards')
    const files = fs.readdirSync(cardsPath).filter((f) => f.endsWith('.md'))

    const cards: CardMetadata[] = []
    const conceptIndex: Record<string, string[]> = {}
    const domainIndex: Record<string, string[]> = {}

    for (const file of files) {
      const filePath = path.join(cardsPath, file)
      const metadata = await this.parseCardMetadata(filePath)

      if (metadata) {
        cards.push(metadata)

        // 构建概念索引
        if (!conceptIndex[metadata.concept]) {
          conceptIndex[metadata.concept] = []
        }
        conceptIndex[metadata.concept].push(metadata.id)

        // 构建领域索引
        if (!domainIndex[metadata.domain]) {
          domainIndex[metadata.domain] = []
        }
        domainIndex[metadata.domain].push(metadata.id)
      }
    }

    this.index = {
      totalCards: cards.length,
      cards,
      conceptIndex,
      domainIndex,
      lastUpdated: new Date().toISOString(),
    }

    // 保存索引
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8')
  }

  /**
   * 解析卡片元数据
   */
  private async parseCardMetadata(filePath: string): Promise<CardMetadata | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      // 解析 front-matter
      const metadata: any = {}

      for (const line of lines) {
        if (line.startsWith('- ')) {
          const match = line.match(/^-\s*(\w+):\s*(.+)$/)
          if (match) {
            const [, key, value] = match
            metadata[key] = value
          }
        } else if (line.trim() === '') {
          break // front-matter 结束
        }
      }

      // 提取标题（第一个 # 标题）
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : path.basename(filePath)

      return {
        id: path.basename(filePath, '.md'),
        title,
        concept: metadata['概念'] || '未分类',
        quality: parseFloat(metadata['质量分'] || '0.5'),
        domain: metadata['领域'] || '其他',
        filePath,
        relatedConcepts: [],
        generatedAt: metadata['生成时间'] || new Date().toISOString(),
        version: parseInt(metadata['版本'] || '1'),
      }
    } catch (error) {
      console.error(`解析卡片元数据失败: ${filePath}`, error)
      return null
    }
  }

  /**
   * 搜索卡片
   */
  private searchCards(
    query: string,
    concepts?: string[],
    domains?: string[],
    limit: number = 10
  ): CardMetadata[] {
    if (!this.index) {
      return []
    }

    let candidates = this.index.cards

    // 按概念过滤
    if (concepts && concepts.length > 0) {
      candidates = candidates.filter((card) => concepts.includes(card.concept))
    }

    // 按领域过滤
    if (domains && domains.length > 0) {
      candidates = candidates.filter((card) => domains.includes(card.domain))
    }

    // 按查询词匹配
    const queryLower = query.toLowerCase()
    const scored = candidates.map((card) => ({
      card,
      score: this.calculateRelevance(query, card),
    }))

    // 按相关性排序
    scored.sort((a, b) => b.score - a.score)

    // 返回前 N 个
    return scored.slice(0, limit).map((s) => s.card)
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevance(query: string, card: CardMetadata): number {
    let score = 0
    const queryLower = query.toLowerCase()

    // 标题匹配（权重最高）
    if (card.title.toLowerCase().includes(queryLower)) {
      score += 3.0
    }

    // 概念匹配
    if (card.concept.toLowerCase().includes(queryLower)) {
      score += 2.0
    }

    // 质量分加权
    score *= card.quality

    return score
  }

  /**
   * 查找相关概念
   */
  private findRelatedConcepts(_query: string, matchedConcepts: string[]): string[] {
    if (!this.index) {
      return []
    }

    const related: Set<string> = new Set()

    for (const concept of matchedConcepts) {
      // 查找包含该概念的卡片
      const cardIds = this.index.conceptIndex[concept] || []

      // 收集这些卡片的相关概念
      for (const cardId of cardIds) {
        const card = this.index.cards.find((c) => c.id === cardId)
        if (card) {
          card.relatedConcepts.forEach((rc) => related.add(rc))
        }
      }
    }

    return Array.from(related).slice(0, 10)
  }

  /**
   * 加载卡片内容
   */
  private async loadCardContent(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.error(`加载卡片内容失败: ${filePath}`, error)
      return ''
    }
  }
}

/**
 * 知识库索引构建工具
 */
export class KnowledgeIndexBuilderTool extends EnhancedBaseTool<
  {
    forceRebuild?: boolean
  },
  {
    success: boolean
    totalCards: number
    buildTime: number
  }
> {
  private knowledgeBasePath: string
  private indexPath: string

  readonly metadata = {
    name: 'knowledge_index_builder',
    description: '构建或更新专利知识库索引',
    category: 'knowledge' as any,
    isConcurrencySafe: false,
    inputSchema: z.object({
      forceRebuild: z.boolean().optional().default(false).describe('是否强制重建索引'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      totalCards: z.number(),
      buildTime: z.number(),
    }),
    permissions: ['fs:read', 'fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  constructor(knowledgeBasePath?: string, indexPath?: string) {
    super()
    const basePath =
      knowledgeBasePath ||
      process.env.KNOWLEDGE_BASE_PATH ||
      '/Users/xujian/projects/YunPat/knowledge-base'
    this.knowledgeBasePath = basePath
    this.indexPath = indexPath || `${basePath}/card-index.json`
  }

  async execute(
    input: { forceRebuild?: boolean },
    _context: ToolContext
  ): Promise<{ success: boolean; totalCards: number; buildTime: number }> {
    const startTime = Date.now()

    const searchTool = new KnowledgeSearchTool(this.knowledgeBasePath, this.indexPath)

    if (input.forceRebuild || !fs.existsSync(this.indexPath)) {
      await this.buildIndexInternal(searchTool)
    } else {
      searchTool['loadIndex']()
    }

    // 从索引中获取实际卡片总数
    const index = searchTool['index'] as KnowledgeIndex | null
    const totalCards = index?.totalCards ?? index?.cards?.length ?? 0

    return {
      success: true,
      totalCards,
      buildTime: Date.now() - startTime,
    }
  }

  /**
   * 内部索引构建方法
   */
  private async buildIndexInternal(searchTool: KnowledgeSearchTool): Promise<void> {
    return searchTool['buildIndex']()
  }
}
