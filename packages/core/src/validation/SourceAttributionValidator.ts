/**
 * 源归属验证器 (SourceAttributionValidator)
 *
 * 检测内容中缺少引用、引用格式错误、来源不可信等问题
 */

import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import {
  Claim,
  ClaimCategory,
  SourceReference,
  SourceType,
  TextLocation,
  SourceAttributionIssue,
  SourceAttributionIssueType,
  SourceAttributionValidatorConfig,
} from './hallucination-types.js'

/**
 * 源归属验证器
 */
export class SourceAttributionValidator {
  private llm: LLMAdapter
  private knowledgeBase: KnowledgeBase
  private config: SourceAttributionValidatorConfig

  constructor(
    llm: LLMAdapter,
    knowledgeBase: KnowledgeBase,
    config?: Partial<SourceAttributionValidatorConfig>
  ) {
    this.llm = llm
    this.knowledgeBase = knowledgeBase
    this.config = {
      requiredCitationCategories: [
        ClaimCategory.LEGAL_PRECEDENT,
        ClaimCategory.TECHNICAL_FACT,
        ClaimCategory.STATISTICAL_DATA,
      ],
      allowedCitationFormats: [
        '\\[\\d+\\]', // [1]
        '\\[@.*?\\]\\(.*?\\)', // [@author](url)
        '\\(.*?,\\s*\\d{4}\\)', // (author, 2024)
      ],
      minSourceCredibility: 0.7,
      ...config,
    }
  }

  /**
   * 验证内容的源归属
   *
   * @param content 要验证的内容
   * @param claims 内容中的声明列表（可选）
   * @returns 源归属问题列表
   */
  async validateAttribution(content: string, claims?: Claim[]): Promise<SourceAttributionIssue[]> {
    const issues: SourceAttributionIssue[] = []

    // 如果没有提供声明，先提取声明
    if (!claims) {
      // 简单的声明提取
      claims = this.extractSimpleClaims(content)
    }

    // 1. 检查缺少引用的问题
    const missingCitations = await this.checkMissingCitations(content, claims)
    issues.push(...missingCitations)

    // 2. 检查引用格式问题
    const formatIssues = this.checkCitationFormats(content)
    issues.push(...formatIssues)

    // 3. 检查来源可信度
    const credibilityIssues = await this.checkSourceCredibility(content)
    issues.push(...credibilityIssues)

    return issues
  }

  /**
   * 简单的声明提取
   *
   * @param content 内容文本
   * @returns 声明列表
   */
  private extractSimpleClaims(content: string): Claim[] {
    const claims: Claim[] = []
    let claimId = 0

    // 提取需要引用的陈述模式
    const patterns = [
      // 法律引用
      /(?:根据|按照|依据)[^。]*?(专利法|商标法|著作权法)[^。]*?(第)?(\d+)?条[^。]*/g,

      // 统计数据
      /\d+[%％][^。]*?(增长|下降|提高|降低)/g,

      // 技术参数
      /(?:性能|效率|准确率)[^。]*?(达到|超过|为)[^。]*?\d+[%％]/g,
    ]

    const lines = content.split('\n')
    let currentPosition = 0

    for (const line of lines) {
      const lineStart = currentPosition
      const lineEnd = currentPosition + line.length

      for (const pattern of patterns) {
        const matches = line.match(pattern)
        if (matches) {
          for (const match of matches) {
            const start = line.indexOf(match)
            const end = start + match.length

            claims.push({
              id: `claim-${claimId++}`,
              content: match,
              category: this.categorizeClaim(match),
              confidence: 0.7,
              location: {
                start: lineStart + start,
                end: lineStart + end,
                text: match,
              },
            })
          }
        }
      }

      currentPosition = lineEnd + 1
    }

    return claims
  }

  /**
   * 检查缺少引用的问题
   *
   * @param content 内容文本
   * @param claims 声明列表
   * @returns 缺少引用的问题列表
   */
  private async checkMissingCitations(
    content: string,
    claims: Claim[]
  ): Promise<SourceAttributionIssue[]> {
    const issues: SourceAttributionIssue[] = []
    let issueId = 0

    // 检查每个需要引用的声明
    for (const claim of claims) {
      // 检查是否在必需引用的类别中
      if (this.config.requiredCitationCategories?.includes(claim.category)) {
        // 检查该声明附近是否有引用
        const hasCitation = this.hasCitationNearby(content, claim)

        if (!hasCitation) {
          // 尝试在知识库中查找相关来源
          const suggestedSources = await this.suggestSources(claim)

          const severityVal =
            claim.category === ClaimCategory.LEGAL_PRECEDENT ? 'critical' : 'major'

          issues.push({
            id: `missing-citation-${issueId++}`,
            type: SourceAttributionIssueType.MISSING_CITATION,
            severity: severityVal,
            content: claim.content,
            location: claim.location || this.findLocationInText(content, claim.content),
            suggestedSources,
            description: `缺少${this.getCategoryLabel(claim.category)}的引用`,
          })
        }
      }
    }

    return issues
  }

  /**
   * 检查文本中某位置附近是否有引用
   *
   * @param content 完整文本
   * @param claim 声明
   * @returns 是否有引用
   */
  private hasCitationNearby(content: string, claim: Claim): boolean {
    if (!claim.location) {
      return false
    }

    const { start, end } = claim.location
    const contextWindow = 200 // 前后200个字符

    const beforeStart = Math.max(0, start - contextWindow)
    const afterEnd = Math.min(content.length, end + contextWindow)

    const context = content.substring(beforeStart, afterEnd)

    // 检查是否包含引用标记
    const citationPatterns = [
      /\[\d+\]/, // [1]
      /\[@.*?\]/, // [@author]
      /\(.*?,\s*\d{4}\)/, // (author, 2024)
      /参见.*?\[\d+\]/,
      /根据.*?\[\d+\]/,
    ]

    for (const pattern of citationPatterns) {
      if (pattern.test(context)) {
        return true
      }
    }

    return false
  }

  /**
   * 为声明建议来源
   *
   * @param claim 声明
   * @returns 建议的来源列表
   */
  private async suggestSources(claim: Claim): Promise<SourceReference[]> {
    try {
      // 在知识库中搜索相关内容
      const searchResults = await this.knowledgeBase.search(claim.content, {
        limit: 3,
        minSimilarity: 0.7,
      })

      return searchResults.map((result) => ({
        id: result.entry.id,
        type: SourceType.KNOWLEDGE_ENTRY,
        title: result.entry.title || result.entry.content.substring(0, 50),
        credibility: (result.entry.priority || 5) / 10,
        lastVerified: new Date(),
      }))
    } catch (error) {
      console.error('建议来源失败:', error)
      return []
    }
  }

  /**
   * 检查引用格式问题
   *
   * @param content 内容文本
   * @returns 格式问题列表
   */
  private checkCitationFormats(content: string): SourceAttributionIssue[] {
    const issues: SourceAttributionIssue[] = []
    let issueId = 0

    // 检查各种引用格式
    const citationPatterns = [
      {
        pattern: /\[(\d+)\]/g,
        type: 'numbered',
        description: '数字引用 [1]',
      },
      {
        pattern: /\[@([^\]]+)\]/g,
        type: 'author',
        description: '作者引用 [@author]',
      },
      {
        pattern: /\(([^,]+),\s*(\d{4})\)/g,
        type: 'academic',
        description: '学术引用 (author, 2024)',
      },
    ]

    // 提取所有引用
    const citations: Array<{
      match: string
      type: string
      location: TextLocation
    }> = []

    for (const { pattern, type } of citationPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        citations.push({
          match: match[0],
          type,
          location: this.findLocationInText(content, match[0]),
        })
      }
    }

    // 检查是否有引用但不规范
    if (citations.length === 0) {
      // 检查是否有疑似引用但没有正确格式
      const suspectedCitations = content.match(/(?:参见|根据|引用|来源)[^。\n]*/g)
      if (suspectedCitations) {
        for (const suspected of suspectedCitations) {
          issues.push({
            id: `citation-format-${issueId++}`,
            type: SourceAttributionIssueType.INCORRECT_CITATION_FORMAT,
            severity: 'minor',
            content: suspected,
            location: this.findLocationInText(content, suspected),
            description: '疑似引用但格式不标准',
          })
        }
      }
    }

    // 检查引用格式的一致性
    const citationTypes = new Set(citations.map((c) => c.type))
    if (citationTypes.size > 1) {
      issues.push({
        id: `citation-format-${issueId++}`,
        type: SourceAttributionIssueType.INCORRECT_CITATION_FORMAT,
        severity: 'minor',
        content: '使用了多种引用格式',
        location: {
          start: 0,
          end: content.length,
          text: content.substring(0, 50) + '...',
        },
        description: `混用了 ${Array.from(citationTypes).join(', ')} 等多种引用格式，建议统一`,
      })
    }

    return issues
  }

  /**
   * 检查来源可信度
   *
   * @param content 内容文本
   * @returns 可信度问题列表
   */
  private async checkSourceCredibility(content: string): Promise<SourceAttributionIssue[]> {
    const issues: SourceAttributionIssue[] = []
    let issueId = 0

    // 提取所有引用
    const citations = this.extractCitations(content)

    // 检查每个引用的可信度
    for (const citation of citations) {
      const credibility = await this.assessSourceCredibility(citation)

      if (credibility < (this.config.minSourceCredibility || 0.7)) {
        issues.push({
          id: `source-credibility-${issueId++}`,
          type: SourceAttributionIssueType.UNRELIABLE_SOURCE,
          severity: 'major',
          content: citation.text,
          location: citation.location,
          description: `来源可信度较低（${(credibility * 100).toFixed(0)}%）`,
        })
      }
    }

    return issues
  }

  /**
   * 提取引用
   *
   * @param content 内容文本
   * @returns 引用列表
   */
  private extractCitations(content: string): Array<{
    text: string
    type: SourceType
    location: TextLocation
  }> {
    const citations: Array<{
      text: string
      type: SourceType
      location: TextLocation
    }> = []

    // 这里简化处理，实际应该解析各种引用格式
    const patterns = [
      {
        pattern: /\[(\d+)\]/g,
        type: SourceType.KNOWLEDGE_ENTRY,
      },
      {
        pattern: /([^\s]+(?:等|编|著))[,:]\s*\d{4}/g,
        type: SourceType.ACADEMIC_PAPER,
      },
    ]

    for (const { pattern, type } of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        citations.push({
          text: match[0],
          type,
          location: this.findLocationInText(content, match[0]),
        })
      }
    }

    return citations
  }

  /**
   * 评估来源可信度
   *
   * @param citation 引用
   * @returns 可信度分数（0-1）
   */
  private async assessSourceCredibility(citation: {
    text: string
    type: SourceType
    location: TextLocation
  }): Promise<number> {
    // 基于来源类型的基准可信度
    const baseCredibility: Record<SourceType, number> = {
      [SourceType.LEGAL_DOCUMENT]: 0.95,
      [SourceType.ACADEMIC_PAPER]: 0.9,
      [SourceType.TECHNICAL_STANDARD]: 0.95,
      [SourceType.PATENT_DOCUMENT]: 0.9,
      [SourceType.KNOWLEDGE_ENTRY]: 0.7,
      [SourceType.EXTERNAL_API]: 0.6,
    }

    let credibility = baseCredibility[citation.type] || 0.7

    // 如果是知识库条目，尝试从知识库获取质量评分
    if (citation.type === SourceType.KNOWLEDGE_ENTRY) {
      try {
        const searchResults = await this.knowledgeBase.search(citation.text, {
          limit: 1,
          minSimilarity: 0.9,
        })

        if (searchResults.length > 0) {
          credibility = Math.max(credibility, (searchResults[0].entry.priority || 5) / 10)
        }
      } catch (error) {
        // 搜索失败，使用默认可信度
      }
    }

    return credibility
  }

  /**
   * 对声明进行分类
   *
   * @param content 声明内容
   * @returns 声明类别
   */
  private categorizeClaim(content: string): ClaimCategory {
    const lowerContent = content.toLowerCase()

    if (
      lowerContent.includes('专利法') ||
      lowerContent.includes('商标法') ||
      lowerContent.includes('著作权法')
    ) {
      return ClaimCategory.LEGAL_PRECEDENT
    }

    if (
      lowerContent.includes('标准') ||
      lowerContent.includes('规范') ||
      lowerContent.includes('gb/') ||
      lowerContent.includes('iso/')
    ) {
      return ClaimCategory.TECHNICAL_FACT
    }

    if (/\d+[%％]/.test(content)) {
      return ClaimCategory.STATISTICAL_DATA
    }

    return ClaimCategory.GENERAL_STATEMENT
  }

  /**
   * 获取类别标签
   *
   * @param category 声明类别
   * @returns 类别中文名称
   */
  private getCategoryLabel(category: ClaimCategory): string {
    const labels: Record<ClaimCategory, string> = {
      [ClaimCategory.LEGAL_PRECEDENT]: '法律判例',
      [ClaimCategory.TECHNICAL_FACT]: '技术事实',
      [ClaimCategory.STATISTICAL_DATA]: '统计数据',
      [ClaimCategory.DOMAIN_KNOWLEDGE]: '领域知识',
      [ClaimCategory.GENERAL_STATEMENT]: '一般陈述',
    }

    return labels[category] || '声明'
  }

  /**
   * 在文本中查找位置
   *
   * @param content 完整文本
   * @param substring 要查找的子字符串
   * @returns 文本位置
   */
  private findLocationInText(content: string, substring: string): TextLocation {
    const index = content.indexOf(substring)
    if (index === -1) {
      return {
        start: 0,
        end: substring.length,
        text: substring.substring(0, 50),
      }
    }

    const textBefore = content.substring(0, index)
    const line = textBefore.split('\n').length
    const column = textBefore.split('\n').pop()?.length || 0

    return {
      start: index,
      end: index + substring.length,
      line,
      column,
      text: substring.substring(0, 50) + (substring.length > 50 ? '...' : ''),
    }
  }

  /**
   * 生成源归属报告
   *
   * @param issues 源归属问题列表
   * @returns 报告文本
   */
  generateAttributionReport(issues: SourceAttributionIssue[]): string {
    if (issues.length === 0) {
      return '✅ 源归属检查通过，未发现问题'
    }

    let report = `⚠️  发现 ${issues.length} 个源归属问题\n\n`

    // 按严重程度分组
    const bySeverity = issues.reduce(
      (acc, issue) => {
        if (!acc[issue.severity]) {
          acc[issue.severity] = []
        }
        acc[issue.severity].push(issue)
        return acc
      },
      {} as Record<string, SourceAttributionIssue[]>
    )

    // 输出严重问题
    if (bySeverity.critical) {
      report += '🔴 严重问题:\n'
      for (const issue of bySeverity.critical) {
        report += `  - ${issue.description}\n`
        if (issue.suggestedSources && issue.suggestedSources.length > 0) {
          report += `    建议来源: ${issue.suggestedSources.map((s) => s.title).join(', ')}\n`
        }
      }
      report += '\n'
    }

    // 输出主要问题
    if (bySeverity.major) {
      report += '🟠 主要问题:\n'
      for (const issue of bySeverity.major) {
        report += `  - ${issue.description}: ${issue.content.substring(0, 50)}...\n`
      }
      report += '\n'
    }

    // 输出次要问题
    if (bySeverity.minor) {
      report += '🟡 次要问题:\n'
      for (const issue of bySeverity.minor) {
        report += `  - ${issue.description}\n`
      }
    }

    return report
  }

  /**
   * 获取源归属统计
   *
   * @param issues 源归属问题列表
   * @returns 统计信息
   */
  getAttributionStats(issues: SourceAttributionIssue[]): {
    total: number
    critical: number
    major: number
    minor: number
    byType: Record<string, number>
  } {
    const stats = {
      total: issues.length,
      critical: 0,
      major: 0,
      minor: 0,
      byType: {} as Record<string, number>,
    }

    for (const issue of issues) {
      if (issue.severity === 'critical') stats.critical++
      else if (issue.severity === 'major') stats.major++
      else if (issue.severity === 'minor') stats.minor++

      if (!stats.byType[issue.type]) {
        stats.byType[issue.type] = 0
      }
      stats.byType[issue.type]++
    }

    return stats
  }
}
