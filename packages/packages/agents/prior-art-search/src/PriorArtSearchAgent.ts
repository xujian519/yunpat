import { ProfessionalAgent, type ProfessionalAgentConfig, type ExtendedExecutionContext } from '@yunpat/agent-base'
import { ExternalServiceError, createLogger } from '@yunpat/core'

/**
 * Google专利搜索结果
 */
interface GooglePatentResult {
  patentId: string
  title: string
  snippet: string
  url: string
  assignee?: string
  publicationDate?: string
  ipcCodes?: string[]
}

/**
 * 先导技术检索输入
 */
export interface PriorArtSearchInput {
  /** 发明理解结果（可选，用于简化输入） */
  inventionUnderstanding?: any
  /** 权利要求书 */
  claims: Array<{
    type: 'independent' | 'dependent'
    number: number
    content: string
    dependsOn?: number
  }>
  /** 专利类型 */
  patentType: 'invention' | 'utilityModel' | 'design'
  /** 发明名称 */
  inventionTitle: string
  /** 说明书（可选） */
  specification?: {
    technicalField?: string
    backgroundArt?: string
    inventionContent?: string
    embodiment?: string
  }
  /** 检索选项 */
  searchOptions?: {
    /** 关键词列表 */
    keywords?: string[]
    /** 分类号列表 */
    classification?: string[]
    /** 日期范围 */
    dateRange?: { start: Date; end: Date }
    /** 申请人 */
    applicant?: string
    /** 结果数量限制 */
    limit?: number
  }
}

/**
 * 专利引用信息
 */
export interface PatentReference {
  /** 专利ID */
  patentId: string
  /** 标题 */
  title: string
  /** 摘要 */
  abstract: string
  /** 相关性评分 (0-1) */
  relevanceScore: number
  /** 公开日期 */
  publicationDate: Date
  /** 申请人 */
  applicants: string[]
  /** 分类号 */
  classifications: string[]
  /** 引用次数 */
  citationCount: number
  /** 法律状态 */
  legalStatus: string
  /** 同族专利成员 */
  familyMembers: string[]
  /** URL */
  url: string
}

/**
 * 时间分布统计
 */
export interface TimeDistribution {
  /** 年份 */
  year: number
  /** 专利数量 */
  count: number
}

/**
 * 申请人统计
 */
export interface ApplicantStats {
  /** 申请人名称 */
  name: string
  /** 专利数量 */
  count: number
}

/**
 * 引用关系
 */
export interface CitationRelation {
  /** 源专利 */
  source: string
  /** 目标专利 */
  target: string
}

/**
 * 新颖性评估
 */
export interface NoveltyAssessment {
  /** 新颖性评分 (0-1) */
  score: number
  /** 区别特征 */
  distinguishingFeatures: string[]
  /** 最接近的现有技术 */
  closestPriorArt: string[]
}

/**
 * 对比分析
 */
export interface ComparisonAnalysis {
  /** 最接近的现有技术 */
  closestPriorArt: {
    title: string
    similarityScore: number
    publicationDate?: Date
    applicants?: string[]
  }
  /** 区别特征列表 */
  differences: string[]
  /** 实际解决的技术问题 */
  technicalProblemSolved: string
}

/**
 * 现有技术分析
 */
export interface PriorArtAnalysis {
  /** 技术领域 */
  technologyField: string
  /** 时间分布 */
  timeDistribution: TimeDistribution[]
  /** 顶级申请人 */
  topApplicants: ApplicantStats[]
  /** 引用网络 */
  citationNetwork: CitationRelation[]
  /** 新颖性评估 */
  noveltyAssessment: NoveltyAssessment
}

/**
 * 检索报告
 */
export interface SearchReport {
  /** 检索策略 */
  searchStrategy: string[]
  /** 数据库 */
  database: string
  /** 查询数量 */
  queryCount: number
  /** 结果数量 */
  resultCount: number
}

/**
 * 总体报告
 */
export interface OverallReport {
  /** 是否通过 */
  passed: boolean
  /** 问题总数 */
  totalIssues: number
  /** 建议 */
  recommendations: string[]
}

/**
 * 先导技术检索输出
 */
export interface PriorArtSearchResult {
  /** 检索报告 */
  searchReport: SearchReport
  /** 相关专利列表 */
  relevantPatents: PatentReference[]
  /** 现有技术分析 */
  analysis: PriorArtAnalysis
  /** 总体报告 */
  overallReport: OverallReport
  /** 对比分析 */
  comparisonAnalysis?: ComparisonAnalysis
  /** 兼容属性：检索策略（用于简化访问） */
  searchStrategy?: string[]
}

interface PriorArtSearchPlan {
  input: PriorArtSearchInput
  extractedKeywords: string[]
  searchQueries: string[]
}

/**
 * 先导技术检索Agent
 *
 * 功能：
 * 1. 执行专利检索（使用Google Patents API）
 * 2. 分析检索结果的相关性
 * 3. 生成现有技术分析报告
 * 4. 评估新颖性
 */
export class PriorArtSearchAgent extends ProfessionalAgent<
  PriorArtSearchInput,
  PriorArtSearchResult
> {
  private logger = createLogger('PriorArtSearchAgent')

  constructor(config: {
    name: string
    description: string
    eventBus: any
    memory: any
    tools: any
    llm: any
  }) {
    super(config)
  }

  public async plan(
    input: PriorArtSearchInput,
    _context: ExtendedExecutionContext
  ): Promise<PriorArtSearchPlan> {
    this.logger.info('开始规划检索策略', {
      inventionTitle: input.inventionTitle,
      claimsCount: input.claims.length,
    })

    // 提取关键词
    const extractedKeywords = this.extractKeywords(input)

    // 构建检索查询
    const searchQueries = this.buildSearchQueries(input, extractedKeywords)

    this.logger.info('规划完成', {
      keywordsCount: extractedKeywords.length,
      queriesCount: searchQueries.length,
    })

    return {
      input,
      extractedKeywords,
      searchQueries,
    }
  }

  protected async act(
    plan: PriorArtSearchPlan,
    _context: ExtendedExecutionContext
  ): Promise<PriorArtSearchResult> {
    this.logger.info('开始执行检索')

    const { input, searchQueries } = plan

    // 执行检索
    const allResults: GooglePatentResult[] = []
    for (const query of searchQueries) {
      this.logger.debug('执行查询', { query })
      try {
        const result = await this.fetchGooglePatents(query, 30000) // 30秒超时
        allResults.push(...result)
        this.logger.debug('查询成功', { query, resultCount: result.length })
      } catch (error) {
        this.logger.error('查询失败', error as Error)
      }
    }

    // 去重
    const uniqueResults = this.deduplicateResults(allResults)
    this.logger.info('去重完成', { uniqueCount: uniqueResults.length })

    // 计算相关性评分
    const scoredResults = this.calculateRelevanceScores(uniqueResults, input)

    // 排序并限制结果数量
    const limit = input.searchOptions?.limit || 20
    const topResults = scoredResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)

    const avgScore = this.averageScore(scoredResults)
    const highRelevanceCount = scoredResults.filter((r) => r.relevanceScore >= 0.7).length

    this.logger.info('相关性评分完成', {
      averageScore: avgScore.toFixed(2),
      highRelevanceCount,
    })

    // 转换为标准格式
    const relevantPatents = this.convertToPatentReferences(topResults)

    // 生成分析
    const analysis = this.generateAnalysis(relevantPatents, input)

    // 生成检索报告
    const searchReport: SearchReport = {
      searchStrategy: plan.searchQueries,
      database: 'Google Patents',
      queryCount: searchQueries.length,
      resultCount: relevantPatents.length,
    }

    // 生成总体报告
    const overallReport = this.generateOverallReport(relevantPatents, analysis)

    this.logger.info('检索完成', {
      resultCount: relevantPatents.length,
      noveltyScore: analysis.noveltyAssessment.score.toFixed(2),
    })

    return {
      searchReport,
      relevantPatents,
      analysis,
      overallReport,
      searchStrategy: searchReport.searchStrategy,
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(input: PriorArtSearchInput): string[] {
    const keywords = new Set<string>()

    // 从发明名称提取
    const titleWords = input.inventionTitle.split(/[\\s，。、]+/).filter((w) => w.length >= 2)
    titleWords.forEach((w) => keywords.add(w))

    // 从权利要求提取（引号内容）
    input.claims.forEach((claim) => {
      const quotedMatches = claim.content.match(/["'「『]([^"'」』]+)["'」』]/g)
      if (quotedMatches) {
        quotedMatches.forEach((match) => {
          const word = match.replace(/["'「『」』]/g, '')
          if (word.length >= 2) {
            keywords.add(word)
          }
        })
      }
    })

    // 从说明书提取
    if (input.specification?.technicalField) {
      const fieldWords = input.specification.technicalField
        .split(/[\\s，。、]+/)
        .filter((w) => w.length >= 2)
      fieldWords.forEach((w) => keywords.add(w))
    }

    // 添加用户指定的关键词
    if (input.searchOptions?.keywords) {
      input.searchOptions.keywords.forEach((k) => keywords.add(k))
    }

    return Array.from(keywords)
  }

  /**
   * 构建检索查询
   */
  private buildSearchQueries(input: PriorArtSearchInput, keywords: string[]): string[] {
    const queries: string[] = []

    // 主查询：使用前5个关键词
    if (keywords.length > 0) {
      const mainKeywords = keywords.slice(0, 5)
      queries.push(mainKeywords.join(' '))
    }

    // 组合查询：每2-3个关键词一组
    for (let i = 0; i < keywords.length; i += 2) {
      const group = keywords.slice(i, i + 3).join(' ')
      if (group.length > 0) {
        queries.push(group)
      }
    }

    // 分类号查询
    if (input.searchOptions?.classification) {
      input.searchOptions.classification.forEach((cls) => {
        queries.push(cls)
      })
    }

    // 申请人查询
    if (input.searchOptions?.applicant) {
      queries.push(`assignee:(${input.searchOptions.applicant})`)
    }

    // 去重
    return Array.from(new Set(queries))
  }

  /**
   * 去重结果
   */
  private deduplicateResults(results: GooglePatentResult[]): GooglePatentResult[] {
    const seen = new Set<string>()
    return results.filter((result) => {
      if (seen.has(result.patentId)) {
        return false
      }
      seen.add(result.patentId)
      return true
    })
  }

  /**
   * 计算相关性评分（基于TF-IDF思想）
   */
  private calculateRelevanceScores(
    results: GooglePatentResult[],
    input: PriorArtSearchInput
  ): Array<GooglePatentResult & { relevanceScore: number }> {
    // 构建关键词集合
    const keywords = new Set<string>()
    input.claims.forEach((claim) => {
      const words = claim.content.toLowerCase().split(/\\s+/)
      words.forEach((w) => {
        if (w.length >= 2) keywords.add(w)
      })
    })

    // 计算每个结果的相关性
    return results.map((result) => {
      const resultText = `${result.title} ${result.snippet}`.toLowerCase()
      let score = 0
      let matchCount = 0

      keywords.forEach((keyword) => {
        if (resultText.includes(keyword)) {
          matchCount++
          score += 1
        }
      })

      // 归一化到0-1
      const normalizedScore = keywords.size > 0 ? Math.min(score / keywords.size, 1) : 0

      // 标题匹配加权
      const titleMatch = input.inventionTitle
        .toLowerCase()
        .split(/\\s+/)
        .filter((w) => result.title.toLowerCase().includes(w)).length
      const titleBonus = Math.min(titleMatch * 0.1, 0.3)

      return {
        ...result,
        relevanceScore: Math.min(normalizedScore + titleBonus, 1),
      }
    })
  }

  /**
   * 计算平均评分
   */
  private averageScore(results: Array<{ relevanceScore: number }>): number {
    if (results.length === 0) return 0
    const sum = results.reduce((acc, r) => acc + r.relevanceScore, 0)
    return sum / results.length
  }

  /**
   * 转换为标准格式
   */
  private convertToPatentReferences(
    results: Array<GooglePatentResult & { relevanceScore: number }>
  ): PatentReference[] {
    return results.map((result) => ({
      patentId: result.patentId,
      title: result.title,
      abstract: result.snippet,
      relevanceScore: result.relevanceScore,
      publicationDate: result.publicationDate ? new Date(result.publicationDate) : new Date(),
      applicants: result.assignee ? [result.assignee] : [],
      classifications: result.ipcCodes || [],
      citationCount: 0, // Google Patents API不提供此信息
      legalStatus: 'unknown',
      familyMembers: [],
      url: result.url,
    }))
  }

  /**
   * 生成分析
   */
  private generateAnalysis(
    patents: PatentReference[],
    input: PriorArtSearchInput
  ): PriorArtAnalysis {
    // 提取技术领域
    const technologyField = input.specification?.technicalField || input.inventionTitle

    // 时间分布
    const timeDistribution = this.computeTimeDistribution(patents)

    // 顶级申请人
    const topApplicants = this.computeTopApplicants(patents)

    // 引用网络（简化版）
    const citationNetwork: CitationRelation[] = []

    // 新颖性评估
    const noveltyAssessment = this.assessNovelty(patents, input)

    return {
      technologyField,
      timeDistribution,
      topApplicants,
      citationNetwork,
      noveltyAssessment,
    }
  }

  /**
   * 计算时间分布
   */
  private computeTimeDistribution(patents: PatentReference[]): TimeDistribution[] {
    const yearCount = new Map<number, number>()

    patents.forEach((patent) => {
      const year = patent.publicationDate.getFullYear()
      yearCount.set(year, (yearCount.get(year) || 0) + 1)
    })

    return Array.from(yearCount.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year)
  }

  /**
   * 计算顶级申请人
   */
  private computeTopApplicants(patents: PatentReference[]): ApplicantStats[] {
    const applicantCount = new Map<string, number>()

    patents.forEach((patent) => {
      patent.applicants.forEach((applicant) => {
        applicantCount.set(applicant, (applicantCount.get(applicant) || 0) + 1)
      })
    })

    return Array.from(applicantCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  /**
   * 评估新颖性
   */
  private assessNovelty(patents: PatentReference[], input: PriorArtSearchInput): NoveltyAssessment {
    // 找出最接近的现有技术
    const closestPriorArt = patents
      .filter((p) => p.relevanceScore >= 0.6)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3)
      .map((p) => p.patentId)

    // 计算新颖性评分（基于高相关性专利的数量）
    const highRelevanceCount = patents.filter((p) => p.relevanceScore >= 0.8).length
    const score = Math.max(0, 1 - highRelevanceCount * 0.2)

    // 提取区别特征（简化版：基于权利要求中引号内容）
    const distinguishingFeatures: string[] = []
    input.claims.forEach((claim) => {
      const quotedMatches = claim.content.match(/["'「『]([^"'」』]+)["'」』]/g)
      if (quotedMatches) {
        distinguishingFeatures.push(...quotedMatches.map((m) => m.replace(/["'「『」』]/g, '')))
      }
    })

    return {
      score,
      distinguishingFeatures,
      closestPriorArt,
    }
  }

  /**
   * 生成总体报告
   */
  private generateOverallReport(
    patents: PatentReference[],
    analysis: PriorArtAnalysis
  ): OverallReport {
    const issues: string[] = []
    const recommendations: string[] = []

    // 检查高相关性专利
    const highRelevanceCount = patents.filter((p) => p.relevanceScore >= 0.8).length
    if (highRelevanceCount > 0) {
      issues.push(`找到 ${highRelevanceCount} 个高相关性专利，可能影响新颖性`)
      recommendations.push('建议详细分析高相关性专利的区别特征')
    }

    // 检查新颖性评分
    if (analysis.noveltyAssessment.score < 0.5) {
      issues.push('新颖性评分较低，存在现有技术风险')
      recommendations.push('建议强调区别特征和技术优势')
    }

    // 检查技术领域活跃度
    const recentPatents = patents.filter((p) => p.publicationDate.getFullYear() >= 2020).length
    if (recentPatents > patents.length * 0.5) {
      recommendations.push('该技术领域活跃，竞争激烈')
    }

    return {
      passed: issues.length === 0,
      totalIssues: issues.length,
      recommendations,
    }
  }

  /**
   * 从Google Patents获取专利数据
   */
  private async fetchGooglePatents(
    query: string,
    timeout: number = 10000
  ): Promise<GooglePatentResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query)
      const url = `https://patents.google.com/xhr/query?url=q%3D${encodedQuery}`

      // 创建超时控制器
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'zh-CN',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as any

      // 解析结果
      const results: GooglePatentResult[] = []
      if (data.results && Array.isArray(data.results)) {
        for (const item of data.results) {
          results.push({
            patentId: item.patent || item.publication_number || '',
            title: item.title || '',
            snippet: item.snippet || item.abstract || '',
            url: item.url || `https://patents.google.com/patent/${item.patent}`,
            assignee: item.assignee || item.applicant || '',
            publicationDate: item.publication_date || '',
            ipcCodes: item.ipc_codes || [],
          })
        }
      }

      return results
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ExternalServiceError(
          `Google Patents API 调用超时 (${timeout}ms)`,
          'GooglePatents',
          'TIMEOUT',
          error
        )
      } else if (error instanceof TypeError) {
        throw new ExternalServiceError(
          'Google Patents API 数据解析失败',
          'GooglePatents',
          'PARSE_ERROR',
          error
        )
      } else {
        throw new ExternalServiceError(
          `Google Patents API 调用失败: ${error}`,
          'GooglePatents',
          'UNKNOWN',
          error as Error
        )
      }
    }
  }

  /**
   * 从输入中提取查询文本（用于知识图谱检索）
   *
   * @override
   */
  protected extractQueryText(input: PriorArtSearchInput): string {
    const parts: string[] = []

    // 发明名称
    parts.push(`发明名称：${input.inventionTitle}`)

    // 专利类型
    const typeMap = {
      invention: '发明专利',
      utilityModel: '实用新型专利',
      design: '外观设计专利',
    }
    parts.push(`专利类型：${typeMap[input.patentType]}`)

    // 权利要求（独立权利要求）
    const independentClaims = input.claims.filter((c) => c.type === 'independent')
    if (independentClaims.length > 0) {
      parts.push('\n独立权利要求：')
      independentClaims.slice(0, 2).forEach((claim) => {
        parts.push(claim.content.substring(0, 300))
      })
    }

    // 技术领域
    if (input.specification?.technicalField) {
      parts.push(`\n技术领域：${input.specification.technicalField.substring(0, 200)}`)
    }

    // 用户指定的关键词
    if (input.searchOptions?.keywords && input.searchOptions.keywords.length > 0) {
      parts.push(`\n检索关键词：${input.searchOptions.keywords.join('、')}`)
    }

    return parts.join('\n')
  }
}
