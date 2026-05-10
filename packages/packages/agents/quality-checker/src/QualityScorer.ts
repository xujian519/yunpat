import type {
  QualityCheckInput,
  ClaimsQuality,
  SpecificationQuality,
  LanguageQuality,
  LegalQuality,
  QualityScores,
  Issue,
  FixOperation,
  Recommendation,
  Comparison,
} from './QualityTypes.js'

/**
 * 完整性检查
 */
export function checkCompleteness(input: QualityCheckInput): number {
  let score = 0

  if (input.inventionTitle && input.inventionTitle.length > 0) {
    score += 5
  }

  if (input.claims && input.claims.length > 0) {
    const hasIndependent = input.claims.some((c) => c.type === 'independent')
    if (hasIndependent) score += 20
    if (input.claims.length >= 2) score += 10
    if (input.claims.length >= 5) score += 5
  }

  const spec = input.specification
  if (spec) {
    if (spec.technicalField && spec.technicalField.length > 10) score += 12
    if (spec.backgroundArt && spec.backgroundArt.length > 20) score += 12
    if (spec.inventionContent && spec.inventionContent.length > 50) score += 12
    if (spec.embodiment && spec.embodiment.length > 100) score += 12
    if (input.drawings && input.drawings.length > 0) score += 12
  }

  return Math.min(score, 100)
}

/**
 * 计算质量评分
 */
export function calculateQualityScores(input: QualityCheckInput): QualityScores {
  return {
    claims: assessClaimsQuality(input),
    specification: assessSpecificationQuality(input),
    language: assessLanguageQuality(input),
    legal: assessLegalQuality(input),
  }
}

/**
 * 评估权利要求质量
 */
function assessClaimsQuality(input: QualityCheckInput): ClaimsQuality {
  let clarity = 100
  let support = 100
  let breadth = 100
  let protectionScope = 100

  if (input.claims.length === 0) {
    return { clarity: 0, support: 0, breadth: 0, protectionScope: 0, overall: 0 }
  }

  const avgClaimLength =
    input.claims.reduce((sum, c) => sum + c.content.length, 0) / input.claims.length
  if (avgClaimLength > 200) clarity -= 15
  if (avgClaimLength > 300) clarity -= 15
  if (avgClaimLength > 400) clarity -= 20

  const complexSentences = input.claims.filter(
    (c) => (c.content.match(/，/g) || []).length > 5
  ).length
  clarity -= (complexSentences / input.claims.length) * 20

  const dependentCount = input.claims.filter((c) => c.type === 'dependent').length
  const independentCount = input.claims.filter((c) => c.type === 'independent').length
  if (independentCount > 0) {
    const ratio = dependentCount / independentCount
    if (ratio < 1) support -= 30
    if (ratio < 2) support -= 15
    if (ratio >= 3) support += 10
  }

  if (input.claims.length < 2) breadth -= 30
  if (input.claims.length < 3) breadth -= 15
  if (input.claims.length >= 5) breadth += 10
  if (input.claims.length >= 10) breadth += 10

  const independentClaims = input.claims.filter((c) => c.type === 'independent')
  if (independentClaims.length === 1) {
    protectionScope = 100
  } else if (independentClaims.length > 3) {
    protectionScope -= 20
  }

  const overall = (clarity + support + breadth + protectionScope) / 4
  return { clarity, support, breadth, protectionScope, overall }
}

/**
 * 评估说明书质量
 */
function assessSpecificationQuality(input: QualityCheckInput): SpecificationQuality {
  const spec = input.specification

  let clarity = 100
  let sufficiency = 100
  let consistency = 100
  let supportiveness = 100

  if (!spec.technicalField || spec.technicalField.trim().length < 20) clarity -= 20
  if (!spec.inventionContent || spec.inventionContent.trim().length < 50) clarity -= 20
  if (!spec.embodiment || spec.embodiment.trim().length < 100) clarity -= 20
  if (!spec.embodiment || spec.embodiment.trim().length < 200) clarity -= 20

  if (!spec.technicalField || spec.technicalField.trim().length === 0) sufficiency -= 25
  if (!spec.backgroundArt || spec.backgroundArt.trim().length === 0) sufficiency -= 25
  if (!spec.inventionContent || spec.inventionContent.trim().length === 0) sufficiency -= 25
  if (!spec.embodiment || spec.embodiment.trim().length === 0) sufficiency -= 25

  const hasTechField = spec.technicalField && spec.technicalField.trim().length > 0
  const hasInventionContent = spec.inventionContent && spec.inventionContent.trim().length > 0
  if (hasTechField && hasInventionContent) {
    const fieldTerms = extractKeywords(spec.technicalField!)
    const contentTerms = extractKeywords(spec.inventionContent!)
    const overlap = calculateKeywordOverlap(fieldTerms, contentTerms)
    if (overlap < 0.2) consistency -= 30
  } else {
    consistency -= 30
  }

  if (spec.embodiment && spec.embodiment.trim().length > 0 && input.claims.length > 0) {
    const claimTerms = new Set<string>()
    input.claims.forEach((c) => {
      const terms = extractKeywords(c.content)
      terms.forEach((t) => claimTerms.add(t))
    })

    let supportedTerms = 0
    claimTerms.forEach((term) => {
      if (spec.embodiment!.includes(term)) supportedTerms++
    })

    if (claimTerms.size > 0) {
      const supportRatio = supportedTerms / claimTerms.size
      supportiveness = supportRatio * 100
    }
  } else if (input.claims.length > 0) {
    supportiveness = 0
  }

  const overall = (clarity + sufficiency + consistency + supportiveness) / 4
  return { clarity, sufficiency, consistency, supportiveness, overall }
}

/**
 * 评估语言质量
 */
function assessLanguageQuality(input: QualityCheckInput): LanguageQuality {
  let grammar = 100
  let terminology = 100
  let accuracy = 100

  input.claims.forEach((claim) => {
    if (claim.content.includes('。。') || claim.content.includes('，，')) grammar -= 10
    if (claim.content.includes('、。') || claim.content.includes('、，')) grammar -= 5
    if (!claim.content.endsWith('。')) grammar -= 5
  })

  const technicalTerms = ['装置', '方法', '系统', '设备', '模块', '单元', '组件']
  let hasTechnicalTerm = false
  input.claims.forEach((claim) => {
    if (technicalTerms.some((term) => claim.content.includes(term))) {
      hasTechnicalTerm = true
    }
  })
  if (!hasTechnicalTerm) terminology -= 40

  const vagueTerms = ['大约', '左右', '可能', '也许', '大概']
  input.claims.forEach((claim) => {
    vagueTerms.forEach((term) => {
      if (claim.content.includes(term)) accuracy -= 10
    })
  })

  const overall = (grammar + terminology + accuracy) / 3
  return { grammar, terminology, accuracy, overall }
}

/**
 * 评估法律质量
 */
function assessLegalQuality(input: QualityCheckInput): LegalQuality {
  let formality = 100
  let patentability = 80
  let riskLevel: 'low' | 'medium' | 'high' = 'low'

  if (!input.inventionTitle) formality -= 20
  if (input.claims.length === 0) formality -= 50
  if (input.claims.length > 0 && input.claims[0].type !== 'independent') formality -= 30

  const spec = input.specification
  if (!spec.technicalField || !spec.backgroundArt || !spec.inventionContent) {
    patentability -= 30
  }

  if (!spec.embodiment || spec.embodiment.length < 100) {
    patentability -= 20
  }

  if (formality < 70 || patentability < 60) {
    riskLevel = 'high'
  } else if (formality < 85 || patentability < 75) {
    riskLevel = 'medium'
  }

  const overall = (formality + patentability) / 2
  return { formality, patentability, riskLevel, overall }
}

/**
 * 计算总体质量
 */
export function calculateOverallQuality(
  completenessScore: number,
  qualityScores: QualityScores
): number {
  return (
    completenessScore * 0.25 +
    qualityScores.claims.overall * 0.3 +
    qualityScores.specification.overall * 0.25 +
    qualityScores.language.overall * 0.1 +
    qualityScores.legal.overall * 0.1
  )
}

/**
 * 获取质量等级
 */
export function getQualityLevel(overallQuality: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (overallQuality >= 90) return 'excellent'
  if (overallQuality >= 75) return 'good'
  if (overallQuality >= 60) return 'fair'
  return 'poor'
}

/**
 * 生成对比数据
 */
export function generateComparison(overallQuality: number, patentType: string): Comparison {
  const benchmarks: Record<string, { avg: number; stdDev: number }> = {
    invention: { avg: 75, stdDev: 10 },
    utilityModel: { avg: 70, stdDev: 12 },
    design: { avg: 72, stdDev: 11 },
  }

  const benchmark = benchmarks[patentType] || benchmarks.invention
  const percentile = calculatePercentile(overallQuality, benchmark.avg, benchmark.stdDev)

  let ranking = '一般'
  if (percentile >= 90) ranking = '优秀'
  else if (percentile >= 75) ranking = '良好'
  else if (percentile >= 50) ranking = '中等'
  else ranking = '待改进'

  return {
    averageQuality: benchmark.avg,
    percentile,
    ranking,
    comparisonGroup:
      patentType === 'invention'
        ? '发明专利申请'
        : patentType === 'utilityModel'
          ? '实用新型申请'
          : '外观设计申请',
  }
}

/**
 * 生成修复操作
 */
export function generateFixOperations(issues: Issue[]): FixOperation[] {
  const operations: FixOperation[] = []
  for (const issue of issues) {
    if (issue.autoFix) {
      operations.push({
        type: 'replace',
        target: issue.location || '未知',
        original: issue.autoFix.original,
        fixed: issue.autoFix.fixed,
        description: issue.description,
      })
    }
  }
  return operations
}

/**
 * 生成改进建议
 */
export function generateRecommendations(
  input: QualityCheckInput,
  issues: Issue[],
  qualityScores: QualityScores
): Recommendation[] {
  const recommendations: Recommendation[] = []

  issues.forEach((issue) => {
    recommendations.push({
      area: issue.category,
      priority: issue.severity === 'critical' || issue.severity === 'high' ? 'high' : 'medium',
      current: issue.description,
      suggested: issue.suggestion,
      rationale: `根据规则${issue.ruleReference || ''}，${issue.description}`,
    })
  })

  if (qualityScores.claims.breadth < 80) {
    recommendations.push({
      area: '权利要求',
      priority: 'medium',
      current: `权利要求数量为${input.claims.length}项`,
      suggested: '建议增加从属权利要求，形成多层次保护',
      rationale: '多层次保护可以提高专利的稳定性和抗无效能力',
      expectedImpact: '预计提高保护范围得分10-20分',
    })
  }

  if (qualityScores.specification.supportiveness < 80) {
    recommendations.push({
      area: '说明书',
      priority: 'high',
      current: '说明书对权利要求的支持不足',
      suggested: '在具体实施方式中详细描述权利要求中的技术特征',
      rationale: 'A26.4要求权利要求应当得到说明书的支持',
      expectedImpact: '预计提高支持性得分20-30分',
    })
  }

  if (qualityScores.language.accuracy < 85) {
    recommendations.push({
      area: '语言表达',
      priority: 'medium',
      current: '存在模糊或不精确的表达',
      suggested: '使用精确的技术术语，避免模糊词汇',
      rationale: '精确的表达有助于明确保护范围',
      expectedImpact: '预计提高表达准确性得分10-15分',
    })
  }

  return recommendations
}

function calculatePercentile(value: number, mean: number, stdDev: number): number {
  const zScore = (value - mean) / stdDev
  const percentile = 100 * (1 - Math.exp(-0.717 * zScore - 0.416 * zScore * zScore))
  return Math.max(0, Math.min(100, percentile))
}

export function extractKeywords(text: string): string[] {
  const words = text.match(/[一-龥]{2,}/g) || []
  const stopWords = new Set(['的', '是', '在', '和', '与', '或', '等', '为', '有', '中'])
  return words.filter((w) => !stopWords.has(w))
}

export function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  let overlap = 0
  set1.forEach((k) => {
    if (set2.has(k)) overlap++
  })

  return overlap / Math.max(set1.size, set2.size)
}
