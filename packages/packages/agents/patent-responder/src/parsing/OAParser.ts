/**
 * OA 审查意见解析器
 *
 * 负责从各种格式的审查意见中提取结构化信息：
 * 1. 驳回理由识别和分类
 * 2. 引用文献提取
 * 3. 权利要求关联分析
 * 4. 严重程度评估
 * 5. 支持多种格式 (CN/PCT/US/EP)
 *
 * @module parsing/OAParser
 */

import type { OAParseResult, RejectionReason, CitedReference } from '../types/index.js'
import { RejectionType, Severity } from '../types/index.js'

/**
 * OA 解析器配置
 */
export interface OAParserConfig {
  /** 默认严重程度 */
  defaultSeverity?: 'high' | 'medium' | 'low'
  /** 是否启用深度解析 */
  enableDeepParsing?: boolean
  /** 最大文本长度 */
  maxTextLength?: number
}

/**
 * 审查意见原始数据
 */
export interface OARawData {
  /** 申请号 */
  applicationNumber: string
  /** 专利名称 */
  patentTitle: string
  /** 审查意见内容 */
  content: string
  /** 文档类型 */
  documentType?: 'cn' | 'pct' | 'us' | 'ep'
  /** 审查员 */
  examiner?: string
  /** 通知日期 */
  notificationDate?: string
  /** 答复期限 */
  deadline?: string
}

/**
 * 正则表达式模式集合
 */
const PATTERNS = {
  // 申请号模式
  applicationNumber: {
    cn: /CN\s*\d{9,13}[\.0-9A-Z]+/i,
    pct: /PCT\/[A-Z]{2}\d{4}\/\d{6,8}/i,
    us: /\d{2}\/\d{3},?\d{3}/,
    ep: /EP\s*\d{6,9}/i,
  },

  // 权利要求引用模式
  claimReference: /权利要求\s*(\d+[-\d]*)|claim\s*(\d+[-\d]*)/gi,

  // 对比文件引用模式 (CN)
  referenceCN: /([A-Z]{2}\d+[A-Z]?|CN\d+[A-Z])/gi,

  // 对比文件引用模式 (US)
  referenceUS: /US\s*\d+,?\d{3}/gi,

  // 驳回理由关键词
  rejectionKeywords: {
    novelty: [
      '不具备新颖性',
      '不具有新颖性',
      '缺乏新颖性',
      '新颖性缺陷',
      'not novel',
      'lack of novelty',
      'anticipated by',
      '被...公开',
      '已在...中披露',
      '现有技术已公开',
    ],
    inventiveness: [
      '不具备创造性',
      '不具有创造性',
      '缺乏创造性',
      '创造性缺陷',
      'not inventive',
      'lack of inventiveness',
      'obvious',
      '显而易见',
      '对于本领域技术人员来说是显而易见的',
      '结合得到',
      '给出技术启示',
    ],
    support: [
      '不支持',
      '得不到说明书支持',
      '支持缺陷',
      'not supported',
      'lack of support',
      '说明书未充分公开',
      '公开不充分',
    ],
    clarity: [
      '不清晰',
      '不清楚',
      '模糊',
      '歧义',
      'not clear',
      'unclear',
      'ambiguous',
      '保护范围不明确',
    ],
    scope: ['保护范围过宽', '缺乏必要技术特征', 'broad scope', 'too broad', '缺乏限定'],
    unity: ['单一性', 'lack of unity', 'not a single general inventive concept'],
    formality: ['形式缺陷', '格式错误', 'formalities', 'formal defect'],
  },

  // 严重程度关键词
  severityKeywords: {
    high: ['致命缺陷', '实质性缺陷', '无法克服', 'fatal', 'substantial defect'],
    medium: ['需要修改', '应当克服', 'should be amended', 'needs to be overcome'],
    low: ['建议修改', '可以优化', 'suggested', 'minor issue'],
  },
}

/**
 * OA 解析器类
 */
export class OAParser {
  private config: Required<OAParserConfig>

  constructor(config: OAParserConfig = {}) {
    this.config = {
      defaultSeverity: config.defaultSeverity || 'medium',
      enableDeepParsing: config.enableDeepParsing ?? true,
      maxTextLength: config.maxTextLength || 50000,
    }
  }

  private get defaultSeverityValue(): Severity {
    return this.config.defaultSeverity as Severity
  }

  /**
   * 解析审查意见
   */
  async parse(rawData: OARawData): Promise<OAParseResult> {
    const {
      applicationNumber,
      patentTitle,
      content,
      documentType = 'cn',
      examiner,
      notificationDate,
      deadline,
    } = rawData

    // 预处理内容
    const processedContent = this.preprocessContent(content)

    // 提取申请号（如果未提供）
    const extractedApplicationNumber =
      applicationNumber || this.extractApplicationNumber(processedContent, documentType)

    // 提取驳回理由
    const rejectionReasons = this.extractRejectionReasons(processedContent, documentType)

    // 提取引用文献
    const citedReferences = this.extractCitedReferences(processedContent, documentType)

    // 确定驳回类型
    const rejectionTypes = rejectionReasons.map((r) => r.type)

    // 提取涉及的权利要求
    const affectedClaims = this.extractAffectedClaims(processedContent, rejectionReasons)

    // 生成摘要
    const summary = this.generateSummary(rejectionReasons, affectedClaims)

    // 计算置信度
    const confidence = this.calculateConfidence(rejectionReasons, citedReferences)

    return {
      applicationNumber: extractedApplicationNumber,
      patentTitle,
      examiner,
      notificationDate: notificationDate ? new Date(notificationDate) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      rawContent: content,
      rejectionReasons,
      citedReferences,
      rejectionTypes,
      affectedClaims,
      summary,
      confidence,
      parserVersion: '2.0.0',
    }
  }

  /**
   * 预处理内容
   */
  private preprocessContent(content: string): string {
    // 移除多余空白
    let processed = content.replace(/\s+/g, ' ')

    // 标准化标点符号
    processed = processed
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/：/g, ':')
      .replace(/；/g, ';')

    // 截断过长内容
    if (processed.length > this.config.maxTextLength) {
      processed = processed.substring(0, this.config.maxTextLength)
    }

    return processed.trim()
  }

  /**
   * 提取申请号
   */
  private extractApplicationNumber(content: string, documentType: string): string {
    const pattern =
      PATTERNS.applicationNumber[documentType as keyof typeof PATTERNS.applicationNumber]
    if (!pattern) {
      return ''
    }

    const match = content.match(pattern)
    return match ? match[0].replace(/\s/g, '') : ''
  }

  /**
   * 提取驳回理由
   */
  private extractRejectionReasons(content: string, documentType: string): RejectionReason[] {
    const reasons: RejectionReason[] = []
    const lowerContent = content.toLowerCase()

    // 检查每种驳回类型
    for (const [type, keywords] of Object.entries(PATTERNS.rejectionKeywords)) {
      // 检查关键词匹配
      const matchedKeywords = keywords.filter((kw) => lowerContent.includes(kw.toLowerCase()))

      if (matchedKeywords.length > 0) {
        // 提取相关段落
        const relevantText = this.extractRelevantText(content, matchedKeywords)

        // 确定严重程度
        const severity = this.determineSeverity(relevantText)

        // 提取涉及的权利要求
        const affectedClaims = this.extractClaimsFromText(relevantText)

        // 提取相关引用文献
        const relatedReferences = this.extractReferencesFromText(relevantText, documentType)

        // 评估可克服性
        const overcomeProbability = this.estimateOvercomeProbability(
          type as RejectionType,
          severity,
          affectedClaims.length
        )

        // 建议应对方式
        const suggestedResponse = this.suggestResponse(
          type as RejectionType,
          severity,
          overcomeProbability
        )

        reasons.push({
          type: type as RejectionType,
          description: this.generateRejectionDescription(
            type as RejectionType,
            relevantText,
            matchedKeywords
          ),
          severity,
          affectedClaims,
          relatedReferences,
          overcomeProbability,
          suggestedResponse,
        })
      }
    }

    // 如果没有找到明确的驳回理由，尝试深度解析
    if (reasons.length === 0 && this.config.enableDeepParsing) {
      return this.deepParseRejections(content, documentType)
    }

    return reasons
  }

  /**
   * 提取相关文本段落
   */
  private extractRelevantText(content: string, keywords: string[]): string {
    // 查找包含关键词的句子
    const sentences = content.split(/[。.！!??\n]/)
    const relevantSentences = sentences.filter((sentence) =>
      keywords.some((kw) => sentence.toLowerCase().includes(kw.toLowerCase()))
    )

    // 返回前3个相关句子的组合
    return relevantSentences.slice(0, 3).join('。')
  }

  /**
   * 确定严重程度
   */
  private determineSeverity(text: string): Severity {
    const lowerText = text.toLowerCase()

    for (const [severity, keywords] of Object.entries(PATTERNS.severityKeywords)) {
      if (keywords.some((kw) => lowerText.includes(kw.toLowerCase()))) {
        return severity as Severity
      }
    }

    return this.defaultSeverityValue
  }

  /**
   * 从文本中提取权利要求编号
   */
  private extractClaimsFromText(text: string): number[] {
    const claims = new Set<number>()

    // 匹配 "权利要求1-3" 范围格式
    const rangeMatches = text.matchAll(/权利要求\s*(\d+)\s*[-–—]\s*(\d+)/gi)
    for (const match of rangeMatches) {
      const start = parseInt(match[1])
      const end = parseInt(match[2])
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          claims.add(i)
        }
      }
    }

    // 匹配单个 "权利要求N" 或 "claim N"
    const singleMatches = text.matchAll(/权利要求\s*(\d+)|claim\s*(\d+)/gi)
    for (const match of singleMatches) {
      const claimNum = parseInt(match[1] || match[2])
      if (!isNaN(claimNum)) {
        claims.add(claimNum)
      }
    }

    return Array.from(claims).sort((a, b) => a - b)
  }

  /**
   * 从文本中提取引用文献
   */
  private extractReferencesFromText(text: string, documentType: string): string[] {
    const references = new Set<string>()

    // 根据文档类型使用不同的正则
    const patterns = {
      cn: /[A-Z]{2}\d+[A-Z]?|CN\d+[A-Z]/gi,
      us: /US\s*\d+,?\d{3}/gi,
      pct: /WO\s*\d{4}\/\d{6,8}/gi,
      ep: /EP\s*\d{6,9}/gi,
    }

    const pattern = patterns[documentType as keyof typeof patterns] || patterns.cn
    const matches = text.matchAll(pattern)

    for (const match of matches) {
      references.add(match[0].toUpperCase())
    }

    return Array.from(references)
  }

  /**
   * 估计可克服性
   */
  private estimateOvercomeProbability(
    type: RejectionType,
    severity: Severity,
    affectedClaimsCount: number
  ): number {
    // 基础概率
    let baseProbability = 50

    // 根据驳回类型调整
    const typeAdjustments: Record<RejectionType, number> = {
      novelty: 40,
      inventiveness: 35,
      utility: 30,
      support: 60,
      clarity: 70,
      scope: 55,
      amendment_scope: 45,
      unity: 65,
      formality: 90,
      other: 50,
    }

    baseProbability = typeAdjustments[type] || 50

    // 根据严重程度调整
    const severityAdjustments: Record<Severity, number> = {
      high: -20,
      medium: 0,
      low: 15,
    }

    baseProbability += severityAdjustments[severity]

    // 根据涉及权利要求数量调整
    if (affectedClaimsCount > 5) {
      baseProbability -= 10
    } else if (affectedClaimsCount <= 2) {
      baseProbability += 10
    }

    // 确保在合理范围内
    return Math.max(10, Math.min(95, baseProbability))
  }

  /**
   * 建议应对方式
   */
  private suggestResponse(
    type: RejectionType,
    severity: Severity,
    overcomeProbability: number
  ): 'argue' | 'amend' | 'both' | 'abandon' {
    // 形式缺陷通常只需要修改
    if (type === RejectionType.FORMALITY) {
      return 'amend'
    }

    // 清晰度和支持问题通常需要修改
    if (type === RejectionType.CLARITY || type === RejectionType.SUPPORT) {
      return 'amend'
    }

    // 高严重程度且低克服概率
    if (severity === Severity.HIGH && overcomeProbability < 30) {
      return 'abandon'
    }

    // 新颖性和创造性通常需要争辩或修改
    if (type === RejectionType.NOVELTY || type === RejectionType.INVENTIVENESS) {
      if (overcomeProbability > 60) {
        return 'argue'
      } else if (overcomeProbability > 40) {
        return 'both'
      } else {
        return 'amend'
      }
    }

    // 默认策略
    return overcomeProbability > 50 ? 'argue' : 'amend'
  }

  /**
   * 生成驳回理由描述
   */
  private generateRejectionDescription(
    type: RejectionType,
    relevantText: string,
    matchedKeywords: string[]
  ): string {
    const typeNames: Record<RejectionType, string> = {
      novelty: '新颖性',
      inventiveness: '创造性',
      utility: '实用性',
      support: '充分公开/支持',
      clarity: '清晰度',
      scope: '保护范围',
      amendment_scope: '修改超范围',
      unity: '单一性',
      formality: '形式缺陷',
      other: '其他',
    }

    const typeName = typeNames[type] || '未知类型'

    // 清理文本
    const cleanedText = relevantText.replace(/\s+/g, ' ').trim().substring(0, 200)

    return `[${typeName}] 审查员认为：${cleanedText}`
  }

  /**
   * 深度解析驳回理由（当关键词匹配失败时使用）
   */
  private deepParseRejections(content: string, documentType: string): RejectionReason[] {
    const reasons: RejectionReason[] = []

    // 尝试识别问题段落
    const problemPatterns = [
      /审查员认为[^。.]*[。.]?/gi,
      /权利要求\d+[^。.]*?[问题|缺陷|不符合][^。.]*[。.]?/gi,
      /根据[^\n]*?[规定|条款][^。.\n]*[。.]?/gi,
    ]

    for (const pattern of problemPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          // 尝试分类
          const type = this.classifyRejectionText(match)
          if (type) {
            reasons.push({
              type,
              description: match.trim(),
              severity: this.determineSeverity(match),
              affectedClaims: this.extractClaimsFromText(match),
              relatedReferences: this.extractReferencesFromText(match, documentType),
              overcomeProbability: 50,
              suggestedResponse: 'argue',
            })
          }
        }
      }
    }

    return reasons
  }

  /**
   * 对驳回文本进行分类
   */
  private classifyRejectionText(text: string): RejectionType | null {
    const lowerText = text.toLowerCase()

    if (lowerText.includes('新颖') || lowerText.includes('novel')) {
      return RejectionType.NOVELTY
    }
    if (
      lowerText.includes('创造') ||
      lowerText.includes('obvious') ||
      lowerText.includes('inventive')
    ) {
      return RejectionType.INVENTIVENESS
    }
    if (lowerText.includes('公开') || lowerText.includes('support')) {
      return RejectionType.SUPPORT
    }
    if (lowerText.includes('清晰') || lowerText.includes('clear')) {
      return RejectionType.CLARITY
    }
    if (lowerText.includes('范围') || lowerText.includes('scope')) {
      return RejectionType.SCOPE
    }
    if (lowerText.includes('单一') || lowerText.includes('unity')) {
      return RejectionType.UNITY
    }

    return RejectionType.OTHER
  }

  /**
   * 提取引用文献
   */
  private extractCitedReferences(content: string, documentType: string): CitedReference[] {
    const references: CitedReference[] = []

    const patterns = {
      cn: /([A-Z]{2}\d+[A-Z]?)([：:，,\s][^。.\n]+|[^\dA-Z][^。.\n]+)?/gi,
      us: /US\s*(\d+,?\d{3}[A-Z]?)([^。.\n]+)?/gi,
      pct: /WO\s*(\d{4}\/\d{6,8})([^。.\n]+)?/gi,
      ep: /EP\s*(\d{6,9})([^。.\n]+)?/gi,
    }

    const pattern = patterns[documentType as keyof typeof patterns] || patterns.cn
    let match

    while ((match = pattern.exec(content)) !== null) {
      const publicationNumber = match[1].replace(/\s/g, '').toUpperCase()
      const relevance = match[2]?.trim() || '未说明相关性'

      references.push({
        publicationNumber,
        title: this.extractReferenceTitle(content, publicationNumber) || '',
        relevance,
        relevanceLevel: this.estimateRelevanceLevel(relevance),
      })
    }

    return references
  }

  /**
   * 提取引用文献标题
   */
  private extractReferenceTitle(content: string, referenceNumber: string): string {
    // 尝试在引用文献附近找到标题
    const patterns = [
      new RegExp(`${referenceNumber}\\s*[:：]\\s*([^。\n]{5,100})`, 'i'),
      new RegExp(`${referenceNumber}\\s*\\(([^)]{5,100})\\)`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return ''
  }

  /**
   * 估计相关性等级
   */
  private estimateRelevanceLevel(relevance: string): number {
    const highKeywords = ['最接近', '主要', 'closest', 'primary', 'main']
    const mediumKeywords = ['相关', 'relevant', 'related']

    const lowerRelevance = relevance.toLowerCase()

    if (highKeywords.some((kw) => lowerRelevance.includes(kw))) {
      return 5
    }
    if (mediumKeywords.some((kw) => lowerRelevance.includes(kw))) {
      return 3
    }

    return 2 // 默认中等偏下
  }

  /**
   * 提取所有涉及的权利要求
   */
  private extractAffectedClaims(content: string, rejectionReasons: RejectionReason[]): number[] {
    const allClaims = new Set<number>()

    // 从驳回理由中提取
    for (const reason of rejectionReasons) {
      reason.affectedClaims.forEach((claim) => allClaims.add(claim))
    }

    // 直接从内容中提取（可能遗漏一些）
    const directClaims = this.extractClaimsFromText(content)
    directClaims.forEach((claim) => allClaims.add(claim))

    return Array.from(allClaims).sort((a, b) => a - b)
  }

  /**
   * 生成摘要
   */
  private generateSummary(rejectionReasons: RejectionReason[], affectedClaims: number[]): string {
    if (rejectionReasons.length === 0) {
      return '未识别到明确的驳回理由'
    }

    const types = [...new Set(rejectionReasons.map((r) => r.type))]
    const highSeverity = rejectionReasons.filter((r) => r.severity === 'high').length
    const claimsText =
      affectedClaims.length > 0
        ? `涉及权利要求：${affectedClaims.join(', ')}`
        : '涉及权利要求：全部'

    const summaryParts = [
      `审查意见包含 ${types.length} 类驳回理由：${types.join(', ')}`,
      highSeverity > 0 ? `其中 ${highSeverity} 项为高严重程度` : '',
      claimsText,
    ]

    return summaryParts.filter(Boolean).join('；')
  }

  /**
   * 计算解析置信度
   */
  private calculateConfidence(
    rejectionReasons: RejectionReason[],
    citedReferences: CitedReference[]
  ): number {
    let confidence = 0.5 // 基础置信度

    // 驳回理由数量贡献
    confidence += Math.min(rejectionReasons.length * 0.1, 0.3)

    // 引用文献数量贡献
    confidence += Math.min(citedReferences.length * 0.05, 0.15)

    // 权利要求提取贡献
    const totalAffectedClaims = rejectionReasons.reduce(
      (sum, r) => sum + r.affectedClaims.length,
      0
    )
    if (totalAffectedClaims > 0) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * 批量解析审查意见
   */
  async parseBatch(rawDataList: OARawData[]): Promise<OAParseResult[]> {
    const results: OAParseResult[] = []

    for (const rawData of rawDataList) {
      try {
        const result = await this.parse(rawData)
        results.push(result)
      } catch (error) {
        console.error(`解析失败 [${rawData.applicationNumber}]:`, error)
        // 返回部分结果而不是完全失败
        results.push({
          applicationNumber: rawData.applicationNumber,
          patentTitle: rawData.patentTitle,
          rawContent: rawData.content,
          rejectionReasons: [],
          citedReferences: [],
          rejectionTypes: [],
          affectedClaims: [],
          summary: '解析失败',
          confidence: 0,
          parserVersion: '2.0.0',
        })
      }
    }

    return results
  }
}

/**
 * 创建默认解析器实例
 */
export function createOAParser(config?: OAParserConfig): OAParser {
  return new OAParser(config)
}
