import type {
  SpecificationContent,
  SpecificationSection,
  SpecificationDrafterOutput,
} from './SpecTypes.js'

// 禁止用语词库
const COMMERCIAL_TERMS = [
  '最佳',
  '最优',
  '最好',
  '革命性',
  '颠覆性',
  '突破性',
  '世界领先',
  '国内首创',
  '首创',
  '独特',
]
const UNCERTAIN_TERMS = ['厚', '薄', '强', '弱', '高温', '高压', '很宽范围', '很大', '很小']
const VAGUE_RANGE_TERMS = ['例如', '最好是', '尤其是', '必要时', '约', '接近', '或类似物']
const REFERENCE_PHRASES = [/如权利要求\d+所述/, /如上述权利要求所述/, /如前述权利要求所述/]
const FUZZY_ACTION_TERMS = ['适当调整', '合理设置', '适当选择', '合理确定', '根据需要']

/**
 * 术语一致性检查
 */
export function checkTerminologyConsistency(specification: SpecificationContent): boolean {
  const extractTerms = (text: string): Set<string> => {
    const terms = text.match(/[一-龥]{2,4}(?:装置|设备|系统|方法|模块|单元)/g) || []
    return new Set(terms)
  }

  const fieldTerms = extractTerms(specification.technical_field.content)
  const contentTerms = extractTerms(specification.invention_content.content)
  const embodimentTerms = extractTerms(specification.embodiments.content)

  const allTerms = new Set([...fieldTerms, ...contentTerms, ...embodimentTerms])

  if (allTerms.size > 5) {
    const intersection = new Set([...fieldTerms].filter((x) => contentTerms.has(x)))
    return intersection.size >= Math.min(fieldTerms.size, contentTerms.size) * 0.7
  }

  return true
}

/**
 * 连贯性检查
 */
export function checkCoherence(specification: SpecificationContent): boolean {
  const { technical_problem, technical_solution, beneficial_effects } =
    specification.invention_content

  if (!technical_problem || !technical_solution || !beneficial_effects) {
    return false
  }

  const problemWords = new Set(technical_problem.match(/[一-龥]{2,}/g) || [])
  const solutionWords = new Set(technical_solution.match(/[一-龥]{2,}/g) || [])

  let overlap = 0
  problemWords.forEach((word) => {
    if (solutionWords.has(word)) overlap++
  })

  return overlap > 0
}

/**
 * 充分公开检查
 */
export function checkEnablement(specification: SpecificationContent): boolean {
  const { embodiments } = specification

  if (embodiments.wordCount < 300) {
    return false
  }

  if (!embodiments.embodiment_list || embodiments.embodiment_list.length === 0) {
    return false
  }

  const hasKeyFeatures = embodiments.embodiment_list.some(
    (emb) => emb.keyFeatures && emb.keyFeatures.length > 0
  )

  return hasKeyFeatures
}

/**
 * 支持性检查
 */
export function checkSupport(specification: SpecificationContent): boolean {
  const { embodiments, invention_content } = specification

  const solutionWords = new Set(invention_content.technical_solution.match(/[一-龥]{2,}/g) || [])
  const embodimentWords = new Set(embodiments.content.match(/[一-龥]{2,}/g) || [])

  let overlap = 0
  solutionWords.forEach((word) => {
    if (embodimentWords.has(word)) overlap++
  })

  return overlap >= Math.min(solutionWords.size, 5)
}

/**
 * 禁止用语检测
 */
export function checkProhibitedTerms(specification: SpecificationContent): {
  passed: boolean
  violations: string[]
} {
  const violations: string[] = []
  const allContent = [
    specification.technical_field.content,
    specification.background_art.content,
    specification.invention_content.content,
    specification.embodiments.content,
    specification.drawings_description.content,
  ].join('\n')

  for (const term of COMMERCIAL_TERMS) {
    if (allContent.includes(term)) {
      violations.push(`商业宣传用语: "${term}"`)
    }
  }

  for (const term of UNCERTAIN_TERMS) {
    const regex = new RegExp(`(?<![\\d.])${term}(?![\\d.])`)
    if (regex.test(allContent)) {
      violations.push(`不确定用语: "${term}"`)
    }
  }

  for (const term of VAGUE_RANGE_TERMS) {
    if (allContent.includes(term)) {
      violations.push(`范围模糊词: "${term}"`)
    }
  }

  for (const pattern of REFERENCE_PHRASES) {
    const match = allContent.match(pattern)
    if (match) {
      violations.push(`禁用引用语: "${match[0]}"`)
    }
  }

  for (const term of FUZZY_ACTION_TERMS) {
    if (allContent.includes(term)) {
      violations.push(`模糊操作词: "${term}"`)
    }
  }

  return { passed: violations.length === 0, violations }
}

/**
 * 引证完整性检查（背景技术）
 */
export function checkCitationCompleteness(specification: SpecificationContent): {
  passed: boolean
  issues: string[]
} {
  const issues: string[] = []
  const bgContent = specification.background_art.content

  if (!bgContent || bgContent.length < 50) {
    issues.push('背景技术内容过短，未充分描述现有技术')
  }

  const hasPatentCitation = /CN\d+|US\d+|EP\d+|WO\d+|JP\d+/.test(bgContent)
  const hasNonPatetCitation = /参见|引用|文献|公开日/.test(bgContent)

  if (!hasPatentCitation && !hasNonPatetCitation) {
    issues.push('背景技术未引证任何现有技术文件')
  }

  if (hasPatentCitation) {
    const hasDate = /公开日|申请日|\d{4}年\d{1,2}月\d{1,2}日/.test(bgContent)
    if (!hasDate) {
      issues.push('引证了专利文件但未注明公开日/申请日')
    }
  }

  const hasProblem = /存在|问题|缺陷|不足|缺点|限制|无法|不能|较低|较差/.test(bgContent)
  if (!hasProblem) {
    issues.push('背景技术未客观指出现有技术存在的问题')
  }

  return { passed: issues.length === 0, issues }
}

/**
 * 实施例充分性检查
 */
export function checkEmbodimentSufficiency(specification: SpecificationContent): {
  passed: boolean
  issues: string[]
} {
  const issues: string[] = []
  const { embodiments } = specification

  const embodimentCount = embodiments.embodiment_list?.length || 0

  if (embodimentCount === 0) {
    issues.push('未提供任何实施例')
  } else if (embodimentCount === 1) {
    issues.push('仅1个实施例，保护范围较宽时可能不足以支持权利要求')
  }

  const content = embodiments.content || ''

  const hasNumericalRange = /(\d+)[~-](\d+)/.test(
    specification.invention_content.technical_solution
  )
  if (hasNumericalRange && embodimentCount < 3) {
    issues.push('技术方案含数值范围，建议提供至少3个实施例（两端值+中间值）')
  }

  const hasDrawingRef = /图\d+|附图\d+/.test(content)
  if (specification.drawings_description.drawings?.length > 0 && !hasDrawingRef) {
    issues.push('有附图但具体实施方式未对照附图说明')
  }

  const figureMarkPattern = /[一二三四五六七八九十\d]+[）)]/
  const hasFigureMarks = figureMarkPattern.test(content)
  if (!hasFigureMarks && content.length > 200) {
    issues.push('实施方式较长但未使用附图标记（应在名称后标注，不加括号）')
  }

  return { passed: issues.length === 0, issues }
}

/**
 * 计算质量评分
 */
export function calculateQualityScore(
  specification: SpecificationContent
): SpecificationDrafterOutput['qualityScore'] {
  const calculateSectionQuality = (section: SpecificationSection): number => {
    if (!section.quality) return 0.8
    return (
      (section.quality.clarity + section.quality.completeness + section.quality.consistency) / 3
    )
  }

  const technicalFieldQuality = calculateSectionQuality(specification.technical_field)
  const backgroundArtQuality = calculateSectionQuality(specification.background_art)
  const inventionContentQuality = calculateSectionQuality(specification.invention_content)
  const embodimentsQuality = calculateSectionQuality(specification.embodiments)
  const drawingsQuality = calculateSectionQuality(specification.drawings_description)

  const baseOverall =
    technicalFieldQuality * 0.1 +
    backgroundArtQuality * 0.15 +
    inventionContentQuality * 0.3 +
    embodimentsQuality * 0.35 +
    drawingsQuality * 0.1

  const prohibitedCheck = checkProhibitedTerms(specification)
  const penalty = prohibitedCheck.passed
    ? 0
    : Math.min(prohibitedCheck.violations.length * 0.05, 0.2)

  return {
    overall: Math.max(0, baseOverall - penalty),
    clarity: (technicalFieldQuality + inventionContentQuality + embodimentsQuality) / 3,
    completeness: (backgroundArtQuality + inventionContentQuality + embodimentsQuality) / 3,
    consistency: (technicalFieldQuality + inventionContentQuality) / 2,
  }
}
