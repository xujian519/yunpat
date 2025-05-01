import {
  Agent,
  type ExecutionContext,
  type EventBus,
  type MemoryStore,
  type ToolRegistry,
  type LLMAdapter,
} from '@yunpat/core'
import { PatentSearchTool, PatentSearchMode, type PatentRecord } from '@yunpat/patent-tools'
import { AcademicSearchTool } from '@yunpat/builtin-tools'

export interface SearchStrategy {
  keywords: string[]
  ipcCodes: string[]
  searchQuery: string
  rationale: string
}

export interface SearchInput {
  title: string
  field: string
  technicalProblem: string
  technicalSolution: string
  keyFeatures: string[]
}

export interface SearchOutput {
  strategy: SearchStrategy
  results: PatentRecord[]
  totalFound: number
  searchTimeMs: number
  academicPapers?: Array<{
    title: string
    authors: string
    year: string
    venue: string
    citations: number
    url: string
    abstract: string
  }>
}

interface SearchPlan {
  input: SearchInput
}

export class PatentSearchAgent extends Agent {
  private searchTool: PatentSearchTool
  private academicSearchTool: AcademicSearchTool

  constructor(config: {
    name: string
    description: string
    eventBus: EventBus
    memory: MemoryStore
    tools: ToolRegistry
    llm: LLMAdapter
    searchTool?: PatentSearchTool
    academicSearchTool?: AcademicSearchTool
  }) {
    super(config)
    this.searchTool = config.searchTool || new PatentSearchTool()
    this.academicSearchTool = config.academicSearchTool || new AcademicSearchTool()
  }

  protected async plan(input: SearchInput, _context: ExecutionContext): Promise<SearchPlan> {
    if (!input.title?.trim()) {
      throw new Error('发明名称不能为空')
    }
    if (!input.field?.trim()) {
      throw new Error('技术领域不能为空')
    }

    console.log('\n🔍 [专利检索] 步骤1: 规划阶段')
    console.log(`   发明名称: ${input.title}`)
    console.log(`   技术领域: ${input.field}`)

    return { input }
  }

  protected async act(plan: SearchPlan, context: ExecutionContext): Promise<SearchOutput> {
    console.log('\n🔎 [专利检索] 步骤2: 执行阶段')

    const { input } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成检索策略')
    }

    const startTime = Date.now()

    const strategy = await this.generateSearchStrategy(input, context.llm)
    console.log(`   检索策略: ${strategy.searchQuery}`)
    console.log(`   关键词: ${strategy.keywords.join(', ')}`)
    console.log(`   IPC分类: ${strategy.ipcCodes.join(', ') || '无'}`)

    const toolContext = {
      registry: this.tools,
      llm: context.llm,
      memory: this.memory,
      eventBus: this.eventBus,
      metadata: {
        agentName: this.name,
        executionId: `search-${Date.now()}`,
      },
    }

    // 专利检索
    console.log('\n📊 [专利检索] 正在检索专利数据库...')
    const searchResult = await this.searchTool.execute(
      {
        query: strategy.searchQuery,
        mode: PatentSearchMode.KEYWORD,
        page: 1,
        limit: 10,
      },
      toolContext as unknown as Parameters<typeof this.searchTool.execute>[1]
    )

    // 学术论文检索
    console.log('\n📚 [学术论文检索] 正在检索学术论文...')
    let academicPapers: SearchOutput['academicPapers'] = undefined

    try {
      const academicResult = await this.academicSearchTool.execute(
        {
          query: strategy.searchQuery,
          limit: 5,
        },
        toolContext as unknown as Parameters<typeof this.academicSearchTool.execute>[1]
      )

      if (academicResult.success && academicResult.results.length > 0) {
        academicPapers = academicResult.results.map((paper) => ({
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          venue: paper.venue,
          citations: paper.citations,
          url: paper.url,
          abstract: paper.abstract,
        }))
        console.log(`   找到 ${academicResult.totalResults} 篇学术论文`)
      }
    } catch (error) {
      console.warn(`   学术论文检索失败: ${error instanceof Error ? error.message : String(error)}`)
      // 学术论文检索失败不影响专利检索结果
    }

    const searchTimeMs = Date.now() - startTime

    console.log(`\n✅ [专利检索] 完成 (找到 ${searchResult.total} 条专利结果)`)
    if (academicPapers) {
      console.log(`   学术论文: ${academicPapers.length} 篇`)
    }
    console.log(`   耗时: ${searchTimeMs}ms`)

    return {
      strategy,
      results: searchResult.patents,
      totalFound: searchResult.total,
      searchTimeMs,
      academicPapers,
    }
  }

  private async generateSearchStrategy(
    input: SearchInput,
    llm: NonNullable<ExecutionContext['llm']>
  ): Promise<SearchStrategy> {
    const systemPrompt = `你是一位资深的专利检索专家，擅长构建高效的专利检索策略。

你的任务是基于发明理解结果，生成最优的检索策略。

检索策略要求：
1. 关键词：提取核心技术特征的关键词（中文和英文）
2. IPC分类号：推断可能相关的IPC分类号（如 H04L, G06N 等）
3. 检索式：构建逻辑清晰的检索查询（使用 AND/OR 组合）
4. 理由：解释为什么这样构建检索策略

输出格式必须是严格的 JSON：
{
  "keywords": ["关键词1", "关键词2"],
  "ipcCodes": ["IPC1", "IPC2"],
  "searchQuery": "检索查询字符串",
  "rationale": "策略理由"
}`

    const userPrompt = `发明名称：${input.title}

技术领域：${input.field}

技术问题：${input.technicalProblem}

技术方案：${input.technicalSolution}

关键特征：${input.keyFeatures.join('、')}

请生成检索策略。`

    try {
      const response = await llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      })

      const content = response.message.content
      const parsed = this.safeParseJSON(content)

      if (parsed) {
        return this.normalizeStrategy(parsed)
      }
    } catch (e) {
      console.warn('[PatentSearchAgent] 检索策略生成失败，使用默认策略:', e)
    }

    return this.createFallbackStrategy(input)
  }

  private normalizeStrategy(parsed: Record<string, unknown>): SearchStrategy {
    const getStringArray = (key: string): string[] => {
      const value = parsed[key]
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
    }

    const getString = (key: string, fallback: string): string => {
      const value = parsed[key]
      return typeof value === 'string' ? value.trim() : fallback
    }

    return {
      keywords: getStringArray('keywords'),
      ipcCodes: getStringArray('ipcCodes'),
      searchQuery: getString('searchQuery', ''),
      rationale: getString('rationale', ''),
    }
  }

  private createFallbackStrategy(input: SearchInput): SearchStrategy {
    const keywords = [input.title, input.field, ...input.keyFeatures.slice(0, 3)]

    const searchQuery = keywords.join(' AND ')

    return {
      keywords,
      ipcCodes: [],
      searchQuery,
      rationale: '基于发明标题、技术领域和关键特征构建的默认检索策略',
    }
  }
}
