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
import { PATTERNS } from './OAParserPatterns.js'
import {
  preprocessContent,
  extractApplicationNumber,
  determineSeverity,
  extractClaimsFromText,
  extractReferencesFromText,
  estimateOvercomeProbability,
  suggestResponse,
  generateRejectionDescription,
  classifyRejectionText,
  estimateRelevanceLevel,
  extractReferenceTitle,
  generateSummary,
  calculateConfidence,
} from './OAParserHelpers.js'

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

// 重新导出供外部使用
export { PATTERNS } from './OAParserPatterns.js'

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
    const processedContent = preprocessContent(content, this.config.maxTextLength)

    // 提取申请号（如果未提供）
    const extractedApplicationNumber =
      applicationNumber || extractApplicationNumber(processedContent, documentType)

    // 提取驳回理由
    const rejectionReasons = this.extractRejectionReasons(processedContent, documentType)

    // 提取引用文献
    const citedReferences = this.extractCitedReferences(processedContent, documentType)

    // 确定驳回类型
    const rejectionTypes = rejectionReasons.map((r) => r.type)

    // 提取涉及的权利要求
    const affectedClaims = this.extractAffectedClaims(processedContent, rejectionReasons)

    // 生成摘要
    const summary = generateSummary(rejectionReasons, affectedClaims)

    // 计算置信度
    const confidence = calculateConfidence(rejectionReasons, citedReferences)

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
        const severity = determineSeverity(relevantText, this.defaultSeverityValue)

        // 提取涉及的权利要求
        const affectedClaims = extractClaimsFromText(relevantText)

        // 提取相关引用文献
        const relatedReferences = extractReferencesFromText(relevantText, documentType)

        // 评估可克服性
        const overcomeProbability = estimateOvercomeProbability(
          type as RejectionType,
          severity,
          affectedClaims.length
        )

        // 建议应对方式
        const suggestedResponse = suggestResponse(
          type as RejectionType,
          severity,
          overcomeProbability
        )

        reasons.push({
          type: type as RejectionType,
          description: generateRejectionDescription(
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
          const type = classifyRejectionText(match)
          if (type) {
            reasons.push({
              type,
              description: match.trim(),
              severity: determineSeverity(match, this.defaultSeverityValue),
              affectedClaims: extractClaimsFromText(match),
              relatedReferences: extractReferencesFromText(match, documentType),
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
        title: extractReferenceTitle(content, publicationNumber) || '',
        relevance,
        relevanceLevel: estimateRelevanceLevel(relevance),
      })
    }

    return references
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
    const directClaims = extractClaimsFromText(content)
    directClaims.forEach((claim) => allClaims.add(claim))

    return Array.from(allClaims).sort((a, b) => a - b)
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
