/**
 * 权利要求必要技术特征匹配工具
 *
 * 用于验证独立权利要求是否包含发明理解中的所有必要技术特征。
 * 被 ClaimsFormalityChecker 和 ClaimGeneratorAgent 共用。
 */

/**
 * 发明理解数据的最小接口（只包含特征匹配需要的字段）
 */
export interface InventionFeatureData {
  technicalProblem: string
  keyFeatures: string[]
  inventionConcepts?: Array<{
    technicalProblem: string
    keyFeatures: string[]
    technicalEffects: string[]
  }>
}

/**
 * 从发明理解数据中提取所有必要技术特征（去重）
 */
export function extractRequiredFeatures(inventionData: InventionFeatureData): string[] {
  const features: string[] = []

  for (const feature of inventionData.keyFeatures) {
    if (!features.some((existing) => isSemanticallySimilar(existing, feature))) {
      features.push(feature)
    }
  }

  if (inventionData.inventionConcepts) {
    for (const concept of inventionData.inventionConcepts) {
      for (const feature of concept.keyFeatures) {
        if (!features.some((existing) => isSemanticallySimilar(existing, feature))) {
          features.push(feature)
        }
      }
    }
  }

  return features
}

/**
 * 判断必要技术特征是否被权利要求文本覆盖
 *
 * 匹配策略：
 * 1. 精确子串匹配（快速、零误判）
 * 2. 关键词重叠加权（≥60%覆盖率视为匹配）
 */
export function isFeatureCoveredInClaim(feature: string, claimContent: string): boolean {
  if (!feature?.trim() || !claimContent?.trim()) return false

  // 精确子串匹配
  if (claimContent.includes(feature)) return true

  // 关键词重叠加权
  const featureTerms: string[] = feature.match(/[一-龥a-zA-Z]{2,}/g) || []
  if (featureTerms.length >= 2) {
    const matchCount = featureTerms.filter((t: string) => claimContent.includes(t)).length
    if (matchCount / featureTerms.length >= 0.6) return true
  }

  return false
}

/**
 * 简单的语义相似性判断（用于特征去重）
 *
 * 基于中文/英文关键词重叠率，阈值 70%
 */
export function isSemanticallySimilar(a: string, b: string): boolean {
  if (a === b) return true
  const termsA: string[] = a.match(/[一-龥a-zA-Z]{2,}/g) || []
  const termsB: string[] = b.match(/[一-龥a-zA-Z]{2,}/g) || []
  if (termsA.length === 0 || termsB.length === 0) return false
  const overlap = termsA.filter((t: string) => termsB.includes(t)).length
  return overlap / Math.min(termsA.length, termsB.length) >= 0.7
}
