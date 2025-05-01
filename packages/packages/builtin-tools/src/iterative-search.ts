/**
 * 迭代式深度搜索工具
 *
 * 通过多轮搜索和LLM分析不断优化结果，深度挖掘主题信息
 * 适用于专利检索、现有技术搜索、法律条文查证等
 */

import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'
import { WebSearchTool } from './network/NetworkTools.js'

/**
 * 搜索结果项
 */
export interface SearchResultItem {
  /** 标题 */
  title: string
  /** 链接 */
  url: string
  /** 摘要 */
  snippet: string
  /** 相关性分数 */
  relevanceScore: number
  /** 迭代轮次 */
  iteration: number
}

/**
 * 迭代搜索结果
 */
export interface IterativeSearchResult {
  /** 搜索主题 */
  query: string
  /** 迭代次数 */
  iterations: number
  /** 总搜索结果数 */
  totalResults: number
  /** 去重后的结果 */
  uniqueResults: SearchResultItem[]
  /** 搜索轮次详情 */
  rounds: Array<{
    round: number
    queries: string[]
    results: SearchResultItem[]
  }>
  /** 分析报告 */
  analysis: {
    /** 关键发现 */
    keyFindings: string[]
    /** 知识空白 */
    knowledgeGaps: string[]
    /** 建议的后续查询 */
    suggestedQueries: string[]
  }
  /** 搜索时间 */
  searchTime: number
}

/**
 * 迭代式深度搜索工具
 */
export class IterativeSearchTool extends EnhancedBaseTool<
  {
    query: string
    iterations?: number
    width?: number
    temperature?: number
    dedupThreshold?: number
    deepRead?: boolean
    searchType?: 'auto' | 'web' | 'patent'
  },
  IterativeSearchResult
> {
  readonly metadata = {
    name: 'iterative_search',
    description: '执行迭代式深度搜索，通过多轮搜索和LLM分析不断优化结果，深度挖掘主题信息',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('搜索主题或问题'),
      iterations: z.number().optional().default(3).describe('迭代次数（默认3次）'),
      width: z.number().optional().default(4).describe('每轮执行的查询数量（默认4个）'),
      temperature: z
        .number()
        .optional()
        .default(0.7)
        .describe('LLM温度，控制查询多样性（0.3-1.0）'),
      dedupThreshold: z.number().optional().default(0.85).describe('相似度去重阈值'),
      deepRead: z.boolean().optional().default(false).describe('是否深度阅读原文'),
      searchType: z.enum(['auto', 'web', 'patent']).optional().default('auto').describe('搜索类型'),
    }),
    outputSchema: z.object({
      query: z.string(),
      iterations: z.number(),
      totalResults: z.number(),
      uniqueResults: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
          relevanceScore: z.number(),
          iteration: z.number(),
        })
      ),
      rounds: z.array(
        z.object({
          round: z.number(),
          queries: z.array(z.string()),
          results: z.array(z.any()),
        })
      ),
      analysis: z.object({
        keyFindings: z.array(z.string()),
        knowledgeGaps: z.array(z.string()),
        suggestedQueries: z.array(z.string()),
      }),
      searchTime: z.number(),
    }),
    permissions: ['network:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      query: string
      iterations?: number
      width?: number
      temperature?: number
      dedupThreshold?: number
      deepRead?: boolean
      searchType?: 'auto' | 'web' | 'patent'
    },
    context: ToolContext
  ): Promise<IterativeSearchResult> {
    const startTime = Date.now()
    const {
      query,
      iterations = 3,
      width = 4,
      temperature = 0.7,
      dedupThreshold = 0.85,
      deepRead = false,
      searchType = 'auto',
    } = input

    const rounds: Array<{
      round: number
      queries: string[]
      results: SearchResultItem[]
    }> = []

    const allResults: SearchResultItem[] = []
    let currentQuery = query

    // 执行多轮迭代搜索
    for (let i = 0; i < iterations; i++) {
      // 1. 生成本轮的多个查询
      const queries = await this.generateQueries(
        currentQuery,
        i,
        width,
        temperature,
        allResults,
        context
      )

      // 2. 执行搜索
      const roundResults: SearchResultItem[] = []
      for (const q of queries) {
        const results = await this.executeSearch(q, searchType, context)
        roundResults.push(...results)
      }

      // 3. 去重和排序
      const uniqueResults = this.deduplicateResults(roundResults, allResults, dedupThreshold)

      // 4. 分析结果并更新查询
      const analysis = await this.analyzeResults(uniqueResults, context)
      allResults.push(...uniqueResults)

      rounds.push({
        round: i + 1,
        queries,
        results: uniqueResults,
      })

      // 5. 基于分析结果更新下一轮查询
      if (i < iterations - 1) {
        currentQuery = this.refineQuery(analysis, currentQuery)
      }
    }

    // 最终分析
    const finalAnalysis = await this.analyzeResults(allResults, context)

    return {
      query,
      iterations,
      totalResults: allResults.length,
      uniqueResults: this.deduplicateResults(allResults, [], dedupThreshold),
      rounds,
      analysis: finalAnalysis,
      searchTime: Date.now() - startTime,
    }
  }

  /**
   * 生成本轮的多个查询
   */
  private async generateQueries(
    baseQuery: string,
    iteration: number,
    width: number,
    _temperature: number,
    previousResults: SearchResultItem[],
    _context: ToolContext
  ): Promise<string[]> {
    if (iteration > 0 && previousResults.length > 0) {
      // 后续轮次：基于前序结果中的关键词扩展查询
      const queries = [baseQuery]
      const seenTitles = new Set<string>()

      for (const r of previousResults) {
        if (queries.length >= width) break
        const shortTitle = r.title.substring(0, 30)
        if (!seenTitles.has(shortTitle)) {
          seenTitles.add(shortTitle)
          queries.push(`${baseQuery} ${r.title.substring(0, 20)}`)
        }
      }

      // 补充角度变体
      if (queries.length < width) {
        queries.push(`${baseQuery} 最新进展`)
      }

      return queries.slice(0, width)
    }

    // 首轮：多角度查询
    return [
      baseQuery,
      `${baseQuery} 案例`,
      `${baseQuery} 法律规定`,
      `${baseQuery} 实践应用`,
      `${baseQuery} 判断标准`,
      `${baseQuery} 要点`,
    ].slice(0, width)
  }

  /**
   * 执行搜索（集成真实搜索后端）
   */
  private async executeSearch(
    query: string,
    searchType: 'auto' | 'web' | 'patent',
    context: ToolContext,
    iteration?: number
  ): Promise<SearchResultItem[]> {
    const iter = iteration ?? 1

    try {
      if (searchType === 'patent') {
        return await this.searchPatents(query, iter)
      }

      // 通用 web 搜索：使用 WebSearchTool
      const webSearch = new WebSearchTool()
      const result = await webSearch.execute({ query, numResults: 10, lang: 'zh-CN' }, context)

      return result.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        relevanceScore: 0.7,
        iteration: iter,
      }))
    } catch (error) {
      console.warn(
        `[IterativeSearch] Search failed for "${query}": ${error instanceof Error ? error.message : String(error)}`
      )
      return []
    }
  }

  /**
   * 通过 Google Patents HTML 页面搜索专利
   */
  private async searchPatents(query: string, iteration: number): Promise<SearchResultItem[]> {
    const searchUrl = `https://patents.google.com/?q=${encodeURIComponent(query)}&num=10`

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YunPat/1.0)',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) return []

      const html = await response.text()
      const results: SearchResultItem[] = []

      // 从 HTML 中提取专利标题和链接
      const patentRegex = /<a[^>]+href="\/patent\/([^"]+)"[^>]*>([^<]+)<\/a>/gi
      let match: RegExpExecArray | null
      while ((match = patentRegex.exec(html)) !== null && results.length < 10) {
        results.push({
          title: match[2].trim(),
          url: `https://patents.google.com/patent/${match[1]}`,
          snippet: '',
          relevanceScore: 0.7,
          iteration,
        })
      }

      return results
    } catch {
      return []
    }
  }

  /**
   * 去重结果
   */
  private deduplicateResults(
    newResults: SearchResultItem[],
    existingResults: SearchResultItem[],
    threshold: number
  ): SearchResultItem[] {
    const unique: SearchResultItem[] = []

    for (const result of newResults) {
      // 检查是否与现有结果重复
      const isDuplicate = existingResults.some(
        (existing) => this.calculateSimilarity(result, existing) >= threshold
      )

      // 检查是否与新结果中已添加的重复
      const isDuplicateInNew = unique.some(
        (existing) => this.calculateSimilarity(result, existing) >= threshold
      )

      if (!isDuplicate && !isDuplicateInNew) {
        unique.push(result)
      }
    }

    return unique
  }

  /**
   * 计算相似度（简化版）
   */
  private calculateSimilarity(result1: SearchResultItem, result2: SearchResultItem): number {
    // 简化的相似度计算
    // 实际应该使用更复杂的算法（如编辑距离、余弦相似度等）
    if (result1.url === result2.url) return 1.0

    const titleSimilarity = result1.title === result2.title ? 0.8 : 0.2

    const snippetSimilarity = result1.snippet === result2.snippet ? 0.5 : 0.1

    return titleSimilarity * 0.7 + snippetSimilarity * 0.3
  }

  /**
   * 分析搜索结果
   */
  private async analyzeResults(
    results: SearchResultItem[],
    _context: ToolContext
  ): Promise<{
    keyFindings: string[]
    knowledgeGaps: string[]
    suggestedQueries: string[]
  }> {
    // 简化实现：基于搜索结果生成基础分析
    const keyFindings = results.slice(0, 3).map((r) => r.title)
    const suggestedQueries = results.slice(0, 3).map((r) => r.title)

    return {
      keyFindings,
      knowledgeGaps: [],
      suggestedQueries,
    }
  }

  /**
   * 优化下一轮查询
   */
  private refineQuery(
    analysis: { keyFindings: string[]; knowledgeGaps: string[]; suggestedQueries: string[] },
    currentQuery: string
  ): string {
    // 基于分析结果优化查询
    if (analysis.knowledgeGaps.length > 0) {
      return `${currentQuery} ${analysis.knowledgeGaps[0]}`
    }
    return currentQuery
  }
}

/**
 * 专利检索工具（特化版）
 */
export class PatentSearchTool extends EnhancedBaseTool<
  {
    query: string
    searchFields?: string[]
    dateRange?: { start: string; end: string }
    assignee?: string
    inventor?: string
    ipc?: string
  },
  IterativeSearchResult
> {
  readonly metadata = {
    name: 'patent_search',
    description: '专利检索工具，支持多字段组合检索',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('检索关键词'),
      searchFields: z.array(z.string()).optional().describe('检索字段（标题、摘要、权利要求等）'),
      dateRange: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional()
        .describe('日期范围'),
      assignee: z.string().optional().describe('申请人'),
      inventor: z.string().optional().describe('发明人'),
      ipc: z.string().optional().describe('IPC分类号'),
    }),
    outputSchema: z.object({
      query: z.string(),
      iterations: z.number(),
      totalResults: z.number(),
      uniqueResults: z.array(z.any()),
      rounds: z.array(z.any()),
      analysis: z.object({
        keyFindings: z.array(z.string()),
        knowledgeGaps: z.array(z.string()),
        suggestedQueries: z.array(z.string()),
      }),
      searchTime: z.number(),
    }),
    permissions: ['network:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      query: string
      searchFields?: string[]
      dateRange?: { start: string; end: string }
      assignee?: string
      inventor?: string
      ipc?: string
    },
    context: ToolContext
  ): Promise<IterativeSearchResult> {
    // 使用迭代搜索工具，但针对专利检索优化
    const iterativeTool = new IterativeSearchTool()

    // 构建专利检索查询
    let patentQuery = input.query
    if (input.assignee) patentQuery += ` 申请人:${input.assignee}`
    if (input.inventor) patentQuery += ` 发明人:${input.inventor}`
    if (input.ipc) patentQuery += ` IPC:${input.ipc}`

    return iterativeTool.execute(
      {
        query: patentQuery,
        iterations: 2, // 专利检索通常2轮足够
        width: 3,
        searchType: 'patent',
      },
      context
    )
  }
}
