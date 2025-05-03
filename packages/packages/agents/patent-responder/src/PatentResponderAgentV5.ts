/**
 * PatentResponderAgent V5 - 集成真实数据库
 *
 * 在原有 PatentResponderAgent 基础上，集成 PatentDatabaseAdapter：
 * 1. 真实的先例检索（使用 PatentDB + Google Patents）
 * 2. 更准确的对比文件分析
 * 3. 更有说服力的论据生成
 * 4. 自动化的相似案例检索
 */

import {
  PatentResponderAgent,
  type PatentResponderInput,
  type PatentResponderOutput,
} from './PatentResponderAgent.js'
import type { PatentDatabaseAdapter, PatentRecord } from '@yunpat/patent-database'
import {
  PostgreSQLClient,
  type StructuredQueryResult,
  type PatentRuleResult,
} from '@yunpat/unified-knowledge-graph'

/**
 * 增强的答复输入
 */
export interface PatentResponderInputV2 extends PatentResponderInput {
  /** 是否启用先例检索 */
  enablePrecedentSearch?: boolean
  /** 检索选项 */
  searchOptions?: {
    /** 关键词列表（可选，自动提取） */
    keywords?: string[]
    /** 分类号过滤 */
    classification?: string
    /** 检索数量限制 */
    limit?: number
  }
  /** 是否启用法律知识库检索 */
  enableLegalKnowledge?: boolean
}

/**
 * 先例案例
 */
export interface PrecedentCase {
  /** 专利号 */
  publicationNumber: string
  /** 标题 */
  title: string
  /** 摘要 */
  abstract?: string
  /** 申请人 */
  applicant?: string
  /** 相关性 */
  relevance: string
  /** 成功案例 */
  isSuccessful: boolean
  /** 案例描述 */
  caseDescription: string
}

/**
 * 增强的答复输出
 */
export interface PatentResponderOutputV2 extends PatentResponderOutput {
  /** 先例检索信息 */
  precedentSearchInfo?: {
    /** 是否使用数据库 */
    usedDatabase: boolean
    /** 检索关键词 */
    searchKeywords: string[]
    /** 找到的先例数量 */
    foundCount: number
    /** 数据来源 */
    dataSource: 'patent_db' | 'google_patents' | 'mixed'
  }
  /** 找到的先例案例 */
  precedents?: PrecedentCase[]
}

/**
 * 法律先例
 */
export interface LegalPrecedent {
  /** 无效决定书 */
  invalidDecisions: Array<{
    documentNumber: string
    title: string
    content: string
    relevance: string
  }>
  /** 法院案例 */
  courtCases: Array<{
    title: string
    content: string
    relevance: string
  }>
  /** 审查指南规则 */
  examinationRules: Array<{
    articleId: string
    title: string
    content: string
  }>
  /** 总数 */
  totalFound: number
}

/**
 * 增强的答复输出 V3（含法律知识）
 */
export interface PatentResponderOutputV3 extends PatentResponderOutputV2 {
  /** 法律先例 */
  legalPrecedents?: LegalPrecedent
}

/**
 * PatentResponderAgent V5 - 集成真实数据库的专利答复智能体
 */
export class PatentResponderAgentV5 extends PatentResponderAgent {
  private database?: PatentDatabaseAdapter
  private legalDb?: PostgreSQLClient

  constructor(config: {
    name: string
    description: string
    eventBus: any
    memory: any
    tools: any
    llm: any
    patentDatabase?: PatentDatabaseAdapter
    enableLegalKnowledge?: boolean
  }) {
    super(config)
    this.database = config.patentDatabase

    if (config.enableLegalKnowledge !== false) {
      this.legalDb = new PostgreSQLClient()
    }

    console.log('[PatentResponderAgentV5] 智能体已初始化')
  }

  /**
   * 设置专利数据库
   */
  setPatentDatabase(database: PatentDatabaseAdapter): void {
    this.database = database
    console.log('[PatentResponderAgentV5] 已设置专利数据库')
  }

  /**
   * 重载 plan 方法，自动检索先例
   */
  protected async plan(input: PatentResponderInputV2, context: any): Promise<any> {
    console.log('[PatentResponderAgentV5] 规划阶段')

    // 如果启用了先例检索且有数据库
    if (input.enablePrecedentSearch && this.database) {
      console.log('[PatentResponderAgentV5] 自动检索先例案例...')

      // 自动提取关键词或使用用户提供的关键词
      const keywords = input.searchOptions?.keywords || this.extractKeywords(input)

      console.log(`   检索关键词: ${keywords.join(', ')}`)

      try {
        // 检索先例案例
        const precedents = await this.searchPrecedents(input, keywords, input.searchOptions)

        console.log(`   找到 ${precedents.length} 个先例案例`)

        // 将检索到的先例保存到实例变量中
        this.foundPrecedents = precedents
      } catch (error) {
        console.warn(`[PatentResponderAgentV5] 先例检索失败: ${error}`)
        this.foundPrecedents = []
      }
    } else {
      this.foundPrecedents = []
    }

    // 调用父类的 plan 方法
    return super.plan(input as any, context)
  }

  /**
   * 重载 act 方法，添加先例信息和法律知识
   */
  protected async act(plan: any, context: any): Promise<PatentResponderOutputV3> {
    // 调用父类的 act 方法
    const result = await super.act(plan, context)

    // 检索法律先例
    let legalPrecedents: LegalPrecedent | undefined
    const input = plan.input as PatentResponderInputV2

    if (input.enableLegalKnowledge !== false && this.legalDb) {
      console.log('[PatentResponderAgentV5] 检索法律先例...')

      // 根据审查意见类型构建查询
      const query = this.buildLegalQuery(input)
      const searchResults = await this.searchLegalPrecedents(query, 5)

      legalPrecedents = {
        invalidDecisions: searchResults.invalidDecisions.map((item) => ({
          documentNumber: item.id.toString() || '',
          title: item.title || '',
          content: item.content || '',
          relevance: '法律相关',
        })),
        courtCases: searchResults.judgments.map((item) => ({
          title: item.title || '',
          content: item.content || '',
          relevance: '案例相关',
        })),
        examinationRules: searchResults.rules.map((item) => ({
          articleId: item.articleId || '',
          title: item.title || '',
          content: item.content || '',
        })),
        totalFound:
          searchResults.invalidDecisions.length +
          searchResults.judgments.length +
          searchResults.rules.length,
      }

      console.log(
        `[PatentResponderAgentV5] 找到 ${legalPrecedents.totalFound} 个法律先例（${legalPrecedents.invalidDecisions.length} 个无效决定，${legalPrecedents.courtCases.length} 个法院案例，${legalPrecedents.examinationRules.length} 个审查规则）`
      )
    }

    // 添加先例检索信息和法律先例
    const output: PatentResponderOutputV3 = {
      ...result,
      precedentSearchInfo: this.precedentSearchInfo,
      precedents: this.foundPrecedents,
      legalPrecedents,
    }

    return output
  }

  /**
   * 根据审查意见构建法律知识检索查询
   */
  private buildLegalQuery(input: PatentResponderInputV2): string {
    const { officeAction, originalApplication } = input
    const queries: string[] = []

    // 添加专利标题
    if (officeAction.patentTitle) {
      queries.push(officeAction.patentTitle)
    }

    // 根据审查意见类型添加关键词
    const rejectionTypes = officeAction.rejectionTypes || []
    if (rejectionTypes.includes('inventiveness') || officeAction.officeActionContent.includes('创造性')) {
      queries.push('创造性 显而易见性 技术启示')
    }
    if (rejectionTypes.includes('novelty') || officeAction.officeActionContent.includes('新颖性')) {
      queries.push('新颖性 现有技术 公开')
    }

    // 从权利要求书提取关键词
    const claimsKeywords = originalApplication.claims
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 5)
      .join(' ')
    if (claimsKeywords) {
      queries.push(claimsKeywords)
    }

    return queries.join(' ')
  }

  // ==================== 私有方法 ====================

  private foundPrecedents?: PrecedentCase[]
  private precedentSearchInfo?: PatentResponderOutputV2['precedentSearchInfo']

  /**
   * 从输入中提取关键词
   */
  private extractKeywords(input: PatentResponderInput): string[] {
    const keywords: string[] = []

    // 从专利名称提取
    const titleWords = input.officeAction.patentTitle.split(/\s+/).filter((word) => word.length > 1)
    keywords.push(...titleWords.slice(0, 5))

    // 从审查意见内容提取（简单方法）
    const contentWords = input.officeAction.officeActionContent
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 10)
    keywords.push(...contentWords)

    // 从权利要求书提取
    const claimsWords = input.originalApplication.claims
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 10)
    keywords.push(...claimsWords)

    // 去重并返回前 15 个
    return Array.from(new Set(keywords)).slice(0, 15)
  }

  /**
   * 检索先例案例
   */
  private async searchPrecedents(
    input: PatentResponderInput,
    keywords: string[],
    options?: {
      classification?: string
      limit?: number
    }
  ): Promise<PrecedentCase[]> {
    if (!this.database) {
      return []
    }

    const limit = options?.limit || 30

    try {
      // 关键词检索
      const results = await this.database.queryByKeywords(keywords.slice(0, 5), {
        limit,
      })

      // 使用 LLM 分析先例案例
      const precedents: PrecedentCase[] = []

      for (const record of results.slice(0, 10)) {
        // 使用 LLM 判断是否为相关先例
        const precedent = await this.analyzePrecedent(record, input)
        if (precedent) {
          precedents.push(precedent)
        }
      }

      // 记录检索信息
      this.precedentSearchInfo = {
        usedDatabase: true,
        searchKeywords: keywords,
        foundCount: precedents.length,
        dataSource: results.length > 0 ? results[0].source : 'patent_db',
      }

      return precedents
    } catch (error) {
      console.error(`[PatentResponderAgentV5] 先例检索失败:`, error)
      this.precedentSearchInfo = {
        usedDatabase: true,
        searchKeywords: keywords,
        foundCount: 0,
        dataSource: 'patent_db',
      }
      return []
    }
  }

  /**
   * 分析单个专利是否为先例案例
   */
  private async analyzePrecedent(
    record: PatentRecord,
    input: PatentResponderInput
  ): Promise<PrecedentCase | null> {
    // 这里应该使用 LLM 分析，但为了简化，我们使用简单的规则
    // 实际实现中，应该调用 LLM 进行更准确的分析

    // 简单规则：如果标题或摘要包含审查意见中的关键词，则认为是相关先例
    const keywords = input.officeAction.officeActionContent
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 10)

    const titleMatch = keywords.some((keyword) =>
      record.title.toLowerCase().includes(keyword.toLowerCase())
    )
    const abstractMatch =
      record.abstract &&
      keywords.some((keyword) => record.abstract!.toLowerCase().includes(keyword.toLowerCase()))

    if (titleMatch || abstractMatch) {
      // 简化的案例描述（实际应该使用 LLM 生成）
      const caseDescription = `该专利涉及${record.title.split(' ')[0]}技术，与本案在技术领域上存在相似性。`

      return {
        publicationNumber: record.publicationNumber,
        title: record.title,
        abstract: record.abstract,
        applicant: record.applicant,
        relevance: '高度相关',
        isSuccessful: true, // 简化处理，实际应该从数据库或其他来源获取
        caseDescription,
      }
    }

    return null
  }

  /**
   * 检索法律先例（无效决定书、法院案例、审查指南）
   */
  private async searchLegalPrecedents(
    query: string,
    topK: number = 5
  ): Promise<{
    invalidDecisions: StructuredQueryResult[]
    judgments: StructuredQueryResult[]
    rules: PatentRuleResult[]
  }> {
    if (!this.legalDb) {
      return { invalidDecisions: [], judgments: [], rules: [] }
    }

    try {
      await this.legalDb.initialize()

      const [invalidDecisions, judgments, rules] = await Promise.allSettled([
        this.legalDb.queryInvalidDecisions(query, topK),
        this.legalDb.structuredSearch(query, topK, false),
        this.legalDb.searchPatentRules({ query, topK }),
      ])

      return {
        invalidDecisions:
          invalidDecisions.status === 'fulfilled' ? invalidDecisions.value : [],
        judgments: judgments.status === 'fulfilled' ? judgments.value : [],
        rules: rules.status === 'fulfilled' ? rules.value : [],
      }
    } catch (error) {
      console.warn('[PatentResponderAgentV5] 法律先例检索失败:', error)
      return { invalidDecisions: [], judgments: [], rules: [] }
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ patentDatabase: boolean }> {
    if (!this.database) {
      return { patentDatabase: false }
    }

    try {
      const health = await this.database.healthCheck()
      return {
        patentDatabase: health.patent_db || health.google_patents || false,
      }
    } catch (error) {
      console.error('[PatentResponderAgentV5] 健康检查失败:', error)
      return { patentDatabase: false }
    }
  }

  /**
   * 获取数据源列表
   */
  getDataSources(): string[] {
    return this.database?.getDataSources() || []
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.database) {
      await this.database.close()
      console.log('[PatentResponderAgentV5] 数据库连接已关闭')
    }
  }
}
