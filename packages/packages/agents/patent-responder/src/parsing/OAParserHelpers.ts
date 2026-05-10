/**
 * OA 解析器纯辅助函数
 *
 * 不依赖 OAParser 实例 (this) 的工具函数集合。
 *
 * @module parsing/OAParserHelpers
 */

import type { RejectionReason, CitedReference } from '../types/index.js'
import { RejectionType, Severity } from '../types/index.js'
import { PATTERNS } from './OAParserPatterns.js'

/**
 * 预处理内容：标准化空白和标点，截断过长文本
 */
export function preprocessContent(content: string, maxTextLength: number): string {
  // 移除多余空白
  let processed = content.replace(/\s+/g, ' ')

  // 标准化标点符号
  processed = processed
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/：/g, ':')
    .replace(/；/g, ';')

  // 截断过长内容
  if (processed.length > maxTextLength) {
    processed = processed.substring(0, maxTextLength)
  }

  return processed.trim()
}

/**
 * 提取申请号
 */
export function extractApplicationNumber(content: string, documentType: string): string {
  const pattern =
    PATTERNS.applicationNumber[documentType as keyof typeof PATTERNS.applicationNumber]
  if (!pattern) {
    return ''
  }

  const match = content.match(pattern)
  return match ? match[0].replace(/\s/g, '') : ''
}

/**
 * 确定严重程度
 */
export function determineSeverity(text: string, defaultSeverity: Severity): Severity {
  const lowerText = text.toLowerCase()

  for (const [severity, keywords] of Object.entries(PATTERNS.severityKeywords)) {
    if (keywords.some((kw) => lowerText.includes(kw.toLowerCase()))) {
      return severity as Severity
    }
  }

  return defaultSeverity
}

/**
 * 从文本中提取权利要求编号
 */
export function extractClaimsFromText(text: string): number[] {
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
 * 从文本中提取引用文献编号
 */
export function extractReferencesFromText(text: string, documentType: string): string[] {
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
 * 估计可克服性概率
 */
export function estimateOvercomeProbability(
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
export function suggestResponse(
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
export function generateRejectionDescription(
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
 * 对驳回文本进行分类
 */
export function classifyRejectionText(text: string): RejectionType | null {
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
 * 估计相关性等级
 */
export function estimateRelevanceLevel(relevance: string): number {
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
 * 提取引用文献标题
 */
export function extractReferenceTitle(content: string, referenceNumber: string): string {
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
 * 生成摘要
 */
export function generateSummary(
  rejectionReasons: RejectionReason[],
  affectedClaims: number[]
): string {
  if (rejectionReasons.length === 0) {
    return '未识别到明确的驳回理由'
  }

  const types = [...new Set(rejectionReasons.map((r) => r.type))]
  const highSeverity = rejectionReasons.filter((r) => r.severity === 'high').length
  const claimsText =
    affectedClaims.length > 0 ? `涉及权利要求：${affectedClaims.join(', ')}` : '涉及权利要求：全部'

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
export function calculateConfidence(
  rejectionReasons: RejectionReason[],
  citedReferences: CitedReference[]
): number {
  let confidence = 0.5 // 基础置信度

  // 驳回理由数量贡献
  confidence += Math.min(rejectionReasons.length * 0.1, 0.3)

  // 引用文献数量贡献
  confidence += Math.min(citedReferences.length * 0.05, 0.15)

  // 权利要求提取贡献
  const totalAffectedClaims = rejectionReasons.reduce((sum, r) => sum + r.affectedClaims.length, 0)
  if (totalAffectedClaims > 0) {
    confidence += 0.1
  }

  return Math.min(confidence, 1.0)
}
