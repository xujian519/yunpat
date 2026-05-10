/**
 * 特征提取纯函数
 *
 * 从权利要求文本中提取技术特征的纯函数，
 * 不依赖类实例，便于独立测试。
 */

import type { TechnicalSchemeType, MinimumTechUnit } from './types.js'

/** 检测技术方案类型：产品 vs 方法 */
export function detectSchemeType(claimText: string): TechnicalSchemeType {
  const methodKeywords = [
    '方法',
    '步骤',
    '工艺',
    '流程',
    '包括以下步骤',
    '其特征在于，所述方法',
    '制备',
    '检测',
    '处理方法',
  ]
  const productKeywords = [
    '装置',
    '系统',
    '设备',
    '结构',
    '包括',
    '设置有',
    '连接',
    '包含',
    '由...组成',
  ]

  const lower = claimText.toLowerCase()
  const methodScore = methodKeywords.filter((k) => lower.includes(k)).length
  const productScore = productKeywords.filter((k) => lower.includes(k)).length

  if (methodScore > productScore) return 'method'
  if (lower.includes('一种') && lower.includes('方法')) return 'method'

  return 'product'
}

/** 从权利要求文本提取原始特征 */
export function extractRawFeatures(
  claimText: string,
  schemeType: TechnicalSchemeType
): Array<Partial<MinimumTechUnit>> {
  const cleanText = claimText
    .replace(/^\d+\.\s*/, '')
    .replace(/^一种/, '')
    .trim()

  if (schemeType === 'product') {
    return extractProductFeatures(cleanText)
  }
  return extractMethodFeatures(cleanText)
}

/** 提取产品权利要求的特征 */
export function extractProductFeatures(text: string): Array<Partial<MinimumTechUnit>> {
  const features: Array<Partial<MinimumTechUnit>> = []
  let id = 0

  const commaPattern = /[,，]/
  const segments = text
    .split(commaPattern)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const compoundSegments = mergeRelatedSegments(segments)

  for (const segment of compoundSegments) {
    const startPos = text.indexOf(segment)
    features.push({
      id: `TU-${String(++id).padStart(3, '0')}`,
      name: extractFeatureName(segment),
      description: segment,
      sourceText: segment,
      position: startPos >= 0 ? { start: startPos, end: startPos + segment.length } : undefined,
      confidence: 0.6,
    })
  }

  return features
}

/** 提取方法权利要求的特征 */
export function extractMethodFeatures(text: string): Array<Partial<MinimumTechUnit>> {
  const features: Array<Partial<MinimumTechUnit>> = []
  let id = 0

  const stepPatterns = [
    /步骤[一二三四五六七八九十\d]+[：:]\s*([^步骤]+?)(?=步骤|$)/g,
    /S\d+[：:]\s*([^S\d]+?)(?=S\d+|$)/g,
    /第一步[：:]?\s*([^第]+?)(?=第[二三四五六七八九十]步|$)/g,
  ]

  let matched = false
  for (const pattern of stepPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      matched = true
      const stepText = match[1].trim()
      features.push({
        id: `TU-${String(++id).padStart(3, '0')}`,
        name: extractFeatureName(stepText),
        description: stepText,
        sourceText: match[0].trim(),
        confidence: 0.7,
      })
    }
    if (matched) break
  }

  if (!matched) {
    const commaPattern = /[，,]/
    const segments = text
      .split(commaPattern)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)

    for (const segment of segments) {
      features.push({
        id: `TU-${String(++id).padStart(3, '0')}`,
        name: extractFeatureName(segment),
        description: segment,
        sourceText: segment,
        confidence: 0.5,
      })
    }
  }

  return features
}

/** 合并相关片段（如引用关系） */
export function mergeRelatedSegments(segments: string[]): string[] {
  const merged: string[] = []
  let i = 0

  while (i < segments.length) {
    const current = segments[i]
    const next = segments[i + 1]

    if (next && areSegmentsRelated(current, next)) {
      merged.push(`${current}，${next}`)
      i += 2
    } else {
      merged.push(current)
      i += 1
    }
  }

  return merged
}

/** 判断两个片段是否相关（通过引用词） */
export function areSegmentsRelated(first: string, second: string): boolean {
  const connectionKeywords = ['其', '所述', '该', '其中', '以及']
  return connectionKeywords.some((kw) => second.startsWith(kw))
}

/** 提取特征名称（去除前缀修饰词，截断过长文本） */
export function extractFeatureName(text: string): string {
  const cleaned = text.replace(/^(包括|包含|设有|具有|其特征在于)[，,]?\s*/, '').trim()
  if (cleaned.length > 30) {
    return cleaned.slice(0, 28) + '...'
  }
  return cleaned
}
