/**
 * PatentSearchAgent v3 - 集成真实数据库
 *
 * 使用 PatentDatabaseSearchTool 支持双数据源：
 * - PatentDB（本地，7500万CN专利）
 * - Google Patents（在线，全球专利）
 */

import {
  Agent,
  type ExecutionContext,
  type EventBus,
  type MemoryStore,
  type ToolRegistry,
  type LLMAdapter,
} from '@yunpat/core'
import {
  PatentDatabaseSearchTool,
  PatentDatabaseSearchMode,
  type StandardPatentRecord,
  type PatentDatabaseSearchConfig,
} from '@yunpat/patent-tools'
import { AcademicSearchTool } from '@yunpat/builtin-tools'
import type { BaseAgentInput, BaseAgentOutput } from '@yunpat/agent-base'

export interface SearchStrategy {
  keywords: string[]
  ipcCodes: string[]
  searchQuery: string
  rationale: string
}

export interface SearchInput extends BaseAgentInput {
  title: string
  field: string
  technicalProblem: string
  technicalSolution: string
  keyFeatures: string[]
}

export interface SearchOutput extends BaseAgentOutput {
  strategy: SearchStrategy
  results: StandardPatentRecord[]
  totalFound: number
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

/**
 * PatentSearchAgent v3 - 使用真实数据库的专利检索智能体
 */
export class PatentSearchAgentV3 extends Agent {
  private searchTool: PatentDatabaseSearchTool
  private academicSearchTool: AcademicSearchTool

  constructor(config: {
    name: string
    description: string
    eventBus: EventBus
    memory: MemoryStore
    tools: ToolRegistry
    llm: LLMAdapter
    databaseConfig?: PatentDatabaseSearchConfig
    searchTool?: PatentDatabaseSearchTool
    academicSearchTool?: AcademicSearchTool
  }) {
    super(config)

    // 使用真实的数据库检索工具
    this.searchTool = config.searchTool || new PatentDatabaseSearchTool(config.databaseConfig)
    this.academicSearchTool = config.academicSearchTool || new AcademicSearchTool()

    console.log('[PatentSearchAgentV3] 智能体已初始化')
    console.log(`  - 数据源: ${this.searchTool.getDataSources().join(', ')}`)
  }

  protected async plan(input: SearchInput, _context: ExecutionContext): Promise<SearchPlan> {
    if (!input.title?.trim()) {
      throw new Error('发明名称不能为空')
    }
    if (!input.field?.trim()) {
      throw new Error('技术领域不能为空')
    }

    console.log('\n🔍 [专利检索 v3] 步骤1: 规划阶段')
    console.log(`   发明名称: ${input.title}`)
    console.log(`   技术领域: ${input.field}`)

    return { input }
  }

  protected async act(plan: SearchPlan, context: ExecutionContext): Promise<SearchOutput> {
    console.log('\n🔎 [专利检索 v3] 步骤2: 执行阶段')

    const { input } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成检索策略')
    }

    const startTime = Date.now()

    // 生成检索策略
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

    // 专利检索（使用真实数据库）
    console.log('\n📊 [专利检索 v3] 正在检索专利数据库...')
    const searchResult = await this.searchTool.execute(
      {
        query: strategy.searchQuery,
        mode: PatentDatabaseSearchMode.KEYWORD,
        page: 1,
        limit: 20, // 增加到20条结果
        language: 'zh', // 默认中文优先
      },
      toolContext as unknown as Parameters<typeof this.searchTool.execute>[1]
    )

    console.log(`   数据源: ${searchResult.dataSource}`)
    console.log(`   找到 ${searchResult.total} 条专利`)

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

    const executionTime = Date.now() - startTime

    console.log(`\n✅ [专利检索 v3] 完成`)
    console.log(`   专利: ${searchResult.total} 条`)
    console.log(`   数据源: ${searchResult.dataSource}`)
    if (academicPapers) {
      console.log(`   学术论文: ${academicPapers.length} 篇`)
    }
    console.log(`   耗时: ${executionTime}ms`)

    return {
      strategy,
      results: searchResult.patents,
      totalFound: searchResult.total,
      executionTime,
      dataSource: searchResult.dataSource,
      academicPapers,
    }
  }

  /**
   * 生成检索策略
   */
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
      console.warn('[PatentSearchAgentV3] 检索策略生成失败，使用默认策略:', e)
    }

    return this.createFallbackStrategy(input)
  }

  /**
   * 规范化检索策略
   */
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

  /**
   * 创建后备检索策略
   */
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

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    return await this.searchTool.healthCheck()
  }

  /**
   * 获取数据源列表
   */
  getDataSources(): string[] {
    return this.searchTool.getDataSources()
  }

  /**
   * 获取统计数据（仅 PatentDB 支持）
   */
  async getStatistics(): Promise<Record<string, unknown>> {
    return await this.searchTool.getStatistics()
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.searchTool.close()
    console.log('[PatentSearchAgentV3] 智能体已关闭')
  }
}
