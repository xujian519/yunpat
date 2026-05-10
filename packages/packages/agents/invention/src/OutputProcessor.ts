/**
 * 输出处理模块
 *
 * 纯函数：术语标准化、一致性验证、输出格式化、特征提取
 */

import type {
  InventionUnderstandingOutput,
  InventionUnderstandingInput,
  ValidationResult,
} from './types.js'

/**
 * 术语标准化
 */
export function normalizeTerminology(
  result: InventionUnderstandingOutput,
  terminologyMap: Map<string, string>
): InventionUnderstandingOutput {
  const normalize = (text: string): string => {
    let normalized = text
    for (const [informal, standard] of terminologyMap) {
      const regex = new RegExp(informal, 'g')
      normalized = normalized.replace(regex, standard)
    }
    return normalized
  }

  return {
    ...result,
    inventionConcepts: result.inventionConcepts.map((concept) => ({
      ...concept,
      technicalProblem: normalize(concept.technicalProblem),
      keyFeatures: concept.keyFeatures.map((f) => normalize(f)),
      technicalEffects: concept.technicalEffects.map((e) => normalize(e)),
    })),
    technicalField: normalize(result.technicalField),
  }
}

/**
 * 一致性验证
 */
export function validateConsistency(
  result: InventionUnderstandingOutput,
  _validationRules: string[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const info: string[] = []

  for (let i = 0; i < result.inventionConcepts.length; i++) {
    const concept = result.inventionConcepts[i]
    const prefix = `三元组${i + 1}`

    if (concept.keyFeatures.length === 0) {
      errors.push(`${prefix}: 缺少技术特征`)
    }

    if (concept.technicalEffects.length === 0) {
      errors.push(`${prefix}: 缺少技术效果`)
    }

    if (concept.keyFeatures.length > concept.technicalEffects.length) {
      warnings.push(`${prefix}: 技术特征多于技术效果，可能存在无对应效果的特征`)
    }

    const forbiddenWords = ['通过', '采用', '使用', '利用']
    if (forbiddenWords.some((word) => concept.technicalProblem.includes(word))) {
      errors.push(`${prefix}: 技术问题包含解决手段`)
    }

    const comparisonWords = ['提高', '降低', '延长', '缩短', '改善', '优于']
    const hasComparison = concept.technicalEffects.some(
      (e) => comparisonWords.some((word) => e.includes(word)) || e.includes('%') || e.includes('倍')
    )
    if (!hasComparison) {
      warnings.push(`${prefix}: 技术效果缺乏明确的对比数据`)
    }

    const vagueWords = ['改进', '优化', '提升', '完善']
    const vagueFeatures = concept.keyFeatures.filter((f) =>
      vagueWords.some((word) => f.includes(word))
    )
    if (vagueFeatures.length > 0) {
      warnings.push(`${prefix}: 以下技术特征过于抽象: ${vagueFeatures.join(', ')}`)
    }
  }

  if (result.inventionConcepts.length > 1) {
    const problems = new Set(result.inventionConcepts.map((c) => c.technicalProblem))
    if (problems.size < result.inventionConcepts.length) {
      info.push('多个三元组解决了相同的技术问题，可能需要合并')
    }
  }

  return { passed: errors.length === 0, errors, warnings, info }
}

/**
 * 标准化 LLM 输出
 */
export function normalizeOutput(
  parsed: Record<string, unknown>,
  input: InventionUnderstandingInput
): InventionUnderstandingOutput {
  const getString = (obj: Record<string, unknown>, key: string): string => {
    const value = obj[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  const getStringArray = (obj: Record<string, unknown>, key: string): string[] => {
    const value = obj[key]
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string').map((s) => s.trim())
      : []
  }

  const getNumber = (obj: Record<string, unknown>, key: string, fallback: number): number => {
    const value = obj[key]
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, Math.min(1, value))
    }
    return fallback
  }

  const conceptsRaw = parsed.inventionConcepts
  const inventionConcepts = []

  if (Array.isArray(conceptsRaw)) {
    for (const item of conceptsRaw) {
      if (typeof item === 'object' && item !== null) {
        inventionConcepts.push({
          technicalProblem: getString(item as Record<string, unknown>, 'technicalProblem') || '',
          keyFeatures: getStringArray(item as Record<string, unknown>, 'keyFeatures'),
          technicalEffects: getStringArray(item as Record<string, unknown>, 'technicalEffects'),
          confidence: getNumber(item as Record<string, unknown>, 'confidence', 0.8),
        })
      }
    }
  }

  if (inventionConcepts.length === 0) {
    inventionConcepts.push({
      technicalProblem: getString(parsed, 'technicalProblem') || '',
      keyFeatures: getStringArray(parsed, 'keyFeatures'),
      technicalEffects: getStringArray(parsed, 'beneficialEffects'),
      confidence: 0.7,
    })
  }

  let allKeyFeatures = inventionConcepts.flatMap((concept) => concept.keyFeatures)
  const allTechnicalEffects = inventionConcepts.flatMap((concept) => concept.technicalEffects)

  if (allKeyFeatures.length === 0) {
    allKeyFeatures = extractFeaturesFromDisclosure(input.technicalDisclosure)
    console.log(`[InventionUnderstandingAgent] 自动提取特征: ${allKeyFeatures.length} 个`)
  }

  const primaryProblem = inventionConcepts.length > 0 ? inventionConcepts[0].technicalProblem : ''
  const primarySolution = allKeyFeatures.join('；')

  return {
    inventionConcepts,
    technicalField: getString(parsed, 'technicalField') || input.field,
    backgroundArt: '',
    embodimentSummary: getString(parsed, 'embodimentSummary'),
    drawingDescriptions: getStringArray(parsed, 'drawingDescriptions'),
    confidence: 0.8,
    keyFeatures: allKeyFeatures,
    technicalProblem: primaryProblem,
    technicalSolution: primarySolution,
    beneficialEffects: allTechnicalEffects.join('；'),
  }
}

/**
 * 计算总体置信度
 */
export function calculateOverallConfidence(concepts: Array<{ confidence: number }>): number {
  if (concepts.length === 0) return 0
  return concepts.reduce((acc, c) => acc + c.confidence, 0) / concepts.length
}

/**
 * 提取实施方式
 */
export function extractEmbodiment(disclosure: string): string {
  return disclosure.substring(0, Math.min(500, disclosure.length))
}

/**
 * 总结现有技术
 */
export function summarizePriorArt(priorArt?: string[]): string {
  if (!priorArt || priorArt.length === 0) {
    return '未提供现有技术信息'
  }
  return priorArt.join('\n\n')
}

/**
 * 从技术交底书中提取特征（兜底机制）
 */
export function extractFeaturesFromDisclosure(disclosure: string): string[] {
  const features: string[] = []
  const cleanedDisclosure = cleanTechnicalContent(disclosure)

  const includePatterns = [
    /包括\s*([^，。；\n]{2,40})/g,
    /具有\s*([^，。；\n]{2,40})/g,
    /包含\s*([^，。；\n]{2,40})/g,
    /设有\s*([^，。；\n]{2,40})/g,
    /设置有\s*([^，。；\n]{2,40})/g,
    /由\s*([^，。；\n]{2,40})\s*组成/g,
    /配置有\s*([^，。；\n]{2,40})/g,
    /安装有\s*([^，。；\n]{2,40})/g,
    /采用\s*([^，。；\n]{2,40})/g,
  ]

  for (const pattern of includePatterns) {
    let match
    while ((match = pattern.exec(cleanedDisclosure)) !== null) {
      const feature = match[1].trim()
      if (feature.length > 2 && feature.length <= 40 && !features.includes(feature)) {
        features.push(feature)
      }
    }
  }

  const characteristicPattern = /其特征在于[：:]\s*([^。；\n]{3,80})/g
  let charMatch
  while ((charMatch = characteristicPattern.exec(cleanedDisclosure)) !== null) {
    const feature = charMatch[1].trim()
    if (feature.length > 3 && !features.includes(feature)) {
      features.push(feature)
    }
  }

  const claimComponentPattern =
    /权利要求\s*\d+[^。]*?(?:包括|具有|包含|设有)[^。]*?(?:的)?([^，。；\n]{2,30})/g
  let compMatch
  while ((compMatch = claimComponentPattern.exec(cleanedDisclosure)) !== null) {
    const feature = compMatch[1].trim()
    if (feature.length > 2 && !features.includes(feature)) {
      features.push(feature)
    }
  }

  const purposePattern = /(?:用于|用来|用以|旨在|以便)\s*([^，。；\n]{3,50})/g
  let purposeMatch
  while ((purposeMatch = purposePattern.exec(cleanedDisclosure)) !== null) {
    const feature = purposeMatch[1].trim()
    if (feature.length > 3 && !features.includes(feature)) {
      features.push(feature)
    }
  }

  if (features.length === 0) {
    const segments = cleanedDisclosure
      .split(/[，。；]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5 && s.length < 60)
      .filter((s) => !/^\d+[\.、]/.test(s))
    features.push(...segments.slice(0, 8))
  }

  return features.slice(0, 15)
}

/**
 * 清洗技术内容
 */
export function cleanTechnicalContent(disclosure: string): string {
  const nonTechPatterns = [
    /答题须知[\s\S]*?(?=\n\n|\Z)/,
    /评分标准[\s\S]*?(?=\n\n|\Z)/,
    /考试说明[\s\S]*?(?=\n\n|\Z)/,
    /注意事项[\s\S]*?(?=\n\n|\Z)/,
    /^\s*\d+\s*分\s*$/m,
    /^(?:一|二|三|四|五|六|七|八|九|十)[、．.]\s*$/m,
  ]

  let cleaned = disclosure
  for (const pattern of nonTechPatterns) {
    cleaned = cleaned.replace(pattern, '')
  }
  return cleaned
}

/**
 * 提取术语映射
 */
export function extractTerminologyMappings(content: string): Array<[string, string]> {
  const mappings: Array<[string, string]> = []

  const patterns = [
    /[""「]([^""」]+)[""」]\s*[（(]\s*([^)）]+)\s*[)）]/g,
    /(?:又称|也称为|也叫|简称|缩写为|亦称|又名)\s*[：:""「]?([^,，。；\n""」]+?)[""」]?/g,
    /([^,，。；\n（(]+?)\s*[（(]\s*(?:英文|全称|简称)\s*[：:]\s*([^)）]+)\s*[)）]/g,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[（(]\s*([^)）]+)\s*[)）]/g,
    /([^\s,，。；\n（(]{2,10})\s*(?:→|->|➡|即|指的是?|代表)\s*([^\s,，。；\n]+)/g,
  ]

  const seen = new Set<string>()
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const from = match[1].trim()
      const to = match[2]?.trim() || match[1].trim()
      if (from && to && from !== to && !seen.has(`${from}:${to}`)) {
        seen.add(`${from}:${to}`)
        mappings.push([from, to])
      }
    }
  }

  const bracketPattern = /[（(]([^)）]{2,30})[)）]/g
  let bracketMatch
  while ((bracketMatch = bracketPattern.exec(content)) !== null) {
    const inner = bracketMatch[1].trim()
    const beforeText = content.substring(Math.max(0, bracketMatch.index - 20), bracketMatch.index)
    const chineseMatch = beforeText.match(/([一-鿿]{2,10})\s*$/)
    if (chineseMatch) {
      const from = chineseMatch[1]
      const to = inner
      if (from !== to && !seen.has(`${from}:${to}`)) {
        const looksLikeEnglish = /^[A-Za-z]/.test(to)
        const looksLikeChinese = /^[一-鿿]/.test(to)
        if (looksLikeEnglish || looksLikeChinese) {
          seen.add(`${from}:${to}`)
          mappings.push([from, to])
        }
      }
    }
  }

  return mappings.slice(0, 50)
}
