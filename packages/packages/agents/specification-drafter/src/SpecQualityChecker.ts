import type {
  SpecificationContent,
  SpecificationSection,
  SpecificationDrafterOutput,
} from './SpecTypes.js'

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

  const overall =
    technicalFieldQuality * 0.1 +
    backgroundArtQuality * 0.15 +
    inventionContentQuality * 0.3 +
    embodimentsQuality * 0.35 +
    drawingsQuality * 0.1

  return {
    overall,
    clarity: (technicalFieldQuality + inventionContentQuality + embodimentsQuality) / 3,
    completeness: (backgroundArtQuality + inventionContentQuality + embodimentsQuality) / 3,
    consistency: (technicalFieldQuality + inventionContentQuality) / 2,
  }
}
