import type { FormalityIssue, ClaimGeneratorOutput } from './types.js'
import { MAX_INDEPENDENT_CLAIM_LENGTH, MAX_DETAIL_PATTERN_COUNT } from './types.js'

/**
 * 执行形式检查（清楚性、简要性、非必要技术特征）
 */
export function performFormalityCheck(output: ClaimGeneratorOutput): {
  passed: boolean
  clarityIssues: FormalityIssue[]
  unnecessaryFeatures: Array<{ claimNumber: number; feature: string; reason: string }>
  recommendations: string[]
} {
  const clarityIssues: FormalityIssue[] = []
  const unnecessaryFeatures: Array<{ claimNumber: number; feature: string; reason: string }> = []

  // 检查独立权利要求
  for (const claim of output.claimsSet.independent_claims) {
    // 清楚性检查（第26条第4款）
    if (isUnclear(claim.full_text)) {
      clarityIssues.push({
        claimNumber: claim.claim_number,
        issue: '权利要求包含模糊表述',
        suggestion: '建议使用明确的技术术语，避免"大约""左右""可能"等模糊词汇',
      })
    }

    // 简要性检查
    if (!isConcise(claim.full_text)) {
      clarityIssues.push({
        claimNumber: claim.claim_number,
        issue: '权利要求过于冗长',
        suggestion: '建议删除非必要的技术细节，保持权利要求简洁',
      })
    }

    // 非必要技术特征检查（实施细则第20条第1款）
    const identified = identifyUnnecessaryFeatures(claim.full_text)
    for (const item of identified) {
      unnecessaryFeatures.push({
        claimNumber: claim.claim_number,
        feature: item.feature,
        reason: item.reason,
      })
    }
  }

  // 检查从属权利要求的清楚性
  for (const claim of output.claimsSet.dependent_claims) {
    if (isUnclear(claim.content)) {
      clarityIssues.push({
        claimNumber: claim.claim_number,
        issue: '从属权利要求包含模糊表述',
        suggestion: '建议使用明确的技术术语',
      })
    }
  }

  const recommendations: string[] = []
  if (clarityIssues.length > 0) {
    recommendations.push('建议修改不清楚或过于冗长的权利要求')
  }
  if (unnecessaryFeatures.length > 0) {
    recommendations.push('建议删除非必要技术特征（公知常识、常规技术等）')
  }

  const passed = clarityIssues.length === 0 && unnecessaryFeatures.length === 0

  return { passed, clarityIssues, unnecessaryFeatures, recommendations }
}

/** 检查是否包含模糊表述 */
function isUnclear(content: string): boolean {
  const unclearPatterns = [
    /大约/g,
    /左右/g,
    /上下/g,
    /等等/g,
    /可能/g,
    /大概/g,
    /约/g,
    /或者其组合/g,
  ]
  return unclearPatterns.some((pattern) => pattern.test(content))
}

/** 检查是否简要 */
function isConcise(content: string): boolean {
  if (content.length > MAX_INDEPENDENT_CLAIM_LENGTH) return false
  const detailPatterns = [/其中所述/g, /具体来说/g, /优选地/g, /更优选地/g]
  const detailCount = detailPatterns.reduce(
    (count, pattern) => count + (content.match(pattern) || []).length,
    0
  )
  return detailCount < MAX_DETAIL_PATTERN_COUNT
}

/** 识别非必要技术特征 */
function identifyUnnecessaryFeatures(content: string): Array<{ feature: string; reason: string }> {
  const commonKnowledge = [
    { pattern: /采用常规技术/g, reason: '常规技术不需要写入权利要求' },
    { pattern: /使用现有技术/g, reason: '现有技术不需要写入权利要求' },
    { pattern: /本领域技术人员熟知/g, reason: '本领域技术人员熟知的内容不需要写入权利要求' },
  ]

  const result: Array<{ feature: string; reason: string }> = []
  for (const item of commonKnowledge) {
    if (item.pattern.test(content)) {
      result.push({ feature: item.pattern.source, reason: item.reason })
    }
  }
  return result
}
