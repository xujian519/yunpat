/**
 * 预测模块纯计算函数
 *
 * 不依赖类实例状态的纯函数集合，供 SuccessPredictor 调用。
 *
 * @module prediction/predictionUtils
 */

import type { OAParseResult, SuccessPrediction, HistoricalCase } from '../types/index.js'
import { RejectionType, Severity, ResponseStrategy } from '../types/index.js'
import type { PredictionFeatures, FeatureWeights } from './predictionTypes.js'

/**
 * 计算整体严重程度
 */
export function calculateOverallSeverity(rejections: Array<{ severity: Severity }>): Severity {
  if (rejections.length === 0) {
    return Severity.MEDIUM
  }

  const highCount = rejections.filter((r) => r.severity === Severity.HIGH).length
  const lowCount = rejections.filter((r) => r.severity === Severity.LOW).length

  if (highCount > rejections.length / 2) {
    return Severity.HIGH
  } else if (lowCount > rejections.length / 2) {
    return Severity.LOW
  }
  return Severity.MEDIUM
}

/**
 * 推断技术领域
 */
export function inferTechnicalField(parseResult: OAParseResult): string | undefined {
  const title = parseResult.patentTitle.toLowerCase()

  const fieldKeywords: Record<string, string[]> = {
    电子通信: ['通信', '网络', '信号', '天线', '基站', '通信系统', '5g', '6g'],
    计算机软件: ['软件', '程序', '算法', '数据', '计算', '处理系统', 'ai', '人工智能'],
    机械制造: ['机械', '装置', '设备', '机构', '传动', '加工', '制造'],
    化学材料: ['化学', '材料', '组合物', '合成', '反应', '催化剂'],
    医疗器械: ['医疗', '治疗', '诊断', '医疗器械', '药物', '医用'],
    汽车工程: ['汽车', '车辆', '驾驶', '制动', '转向', '动力'],
  }

  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some((kw) => title.includes(kw))) {
      return field
    }
  }

  return undefined
}

/**
 * 计算基础预测
 */
export function calculateBasePrediction(
  features: PredictionFeatures,
  weights: FeatureWeights
): SuccessPrediction {
  let score = 50 // 基础分

  // 1. 驳回类型影响
  let rejectionWeightSum = 0
  for (const rejectionType of features.rejectionTypes) {
    const weight = weights.rejectionTypeWeights.get(rejectionType) || 0.2
    score += weight * 100
    rejectionWeightSum += weight
  }
  if (features.rejectionTypes.size > 0) {
    score /= features.rejectionTypes.size
  }

  // 2. 严重程度影响
  const severityWeight = weights.severityWeights.get(features.severity) || 0
  score += severityWeight * 100

  // 3. 权利要求数量影响
  score += (features.claimCount - 3) * weights.claimCountWeight * 100

  // 4. 引用文献数量影响
  score += (features.referenceCount - 1) * weights.referenceCountWeight * 100

  // 5. 策略影响
  const strategyWeight = weights.strategyWeights.get(features.strategy) || 0.5
  score = score * 0.6 + strategyWeight * 100 * 0.4

  // 6. 审查轮次影响
  score += (features.round - 1) * weights.roundWeight * 100

  // 确保分数在合理范围内
  score = Math.max(10, Math.min(95, score))

  // 计算各驳回类型的概率
  const rejectionProbabilities = new Map<RejectionType, number>()
  for (const rejectionType of features.rejectionTypes) {
    const typeScore = score + (weights.rejectionTypeWeights.get(rejectionType) || 0.2) * 50
    rejectionProbabilities.set(rejectionType, Math.max(20, Math.min(95, typeScore)))
  }

  // 生成关键成功因素和风险因素
  const { successFactors, riskFactors } = generateFactors(features)

  return {
    overallProbability: Math.round(score),
    rejectionProbabilities,
    confidenceInterval: {
      lower: Math.max(0, score - 15),
      upper: Math.min(100, score + 15),
    },
    keySuccessFactors: successFactors,
    riskFactors: riskFactors,
    basedOnCases: 0,
  }
}

/**
 * 查找相似案例
 */
export function findSimilarCases(
  features: PredictionFeatures,
  historicalCases: HistoricalCase[]
): HistoricalCase[] {
  const similarities: Array<{ case: HistoricalCase; similarity: number }> = []

  for (const caseData of historicalCases) {
    const similarity = calculateCaseSimilarity(features, caseData)
    if (similarity > 0.3) {
      similarities.push({ case: caseData, similarity })
    }
  }

  // 按相似度排序并返回前20个
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20)
    .map((s) => s.case)
}

/**
 * 计算案例相似度
 */
export function calculateCaseSimilarity(
  features: PredictionFeatures,
  caseData: HistoricalCase
): number {
  let similarity = 0
  let factors = 0

  // 1. 驳回类型相似度
  const caseTypes = new Set(caseData.rejectionReasons.map((r) => r.type))
  const typeIntersection = [...features.rejectionTypes].filter((t) => caseTypes.has(t))
  const typeUnion = new Set([...features.rejectionTypes, ...caseTypes])
  if (typeUnion.size > 0) {
    const typeSimilarity = typeIntersection.length / typeUnion.size
    similarity += typeSimilarity * 0.35
    factors += 0.35
  }

  // 2. 策略相似度
  if (features.strategy === caseData.strategy) {
    similarity += 0.25
    factors += 0.25
  }

  // 3. 权利要求数量相似度
  const claimDiff = Math.abs(features.claimCount - (caseData.grantedClaims?.length || 0))
  const claimSimilarity = Math.max(0, 1 - claimDiff / 10)
  similarity += claimSimilarity * 0.15
  factors += 0.15

  // 4. 审查轮次相似度
  const roundDiff = Math.abs(features.round - caseData.round)
  const roundSimilarity = Math.max(0, 1 - roundDiff / 3)
  similarity += roundSimilarity * 0.1
  factors += 0.1

  // 5. 技术领域相似度
  if (features.technicalField && caseData.technicalField) {
    if (features.technicalField === caseData.technicalField) {
      similarity += 0.15
      factors += 0.15
    }
  }

  return factors > 0 ? similarity / factors : 0
}

/**
 * 合并驳回概率
 */
export function mergeRejectionProbabilities(
  base: Map<RejectionType, number>,
  caseBased: Map<RejectionType, number>,
  caseWeight: number
): Map<RejectionType, number> {
  const merged = new Map<RejectionType, number>()

  const allTypes = new Set([...base.keys(), ...caseBased.keys()])

  for (const type of allTypes) {
    const baseValue = base.get(type) || 50
    const caseValue = caseBased.get(type) || 50

    const mergedValue = baseValue * (1 - caseWeight) + caseValue * caseWeight
    merged.set(type, mergedValue)
  }

  return merged
}

/**
 * 计算置信区间
 */
export function calculateConfidenceInterval(
  probability: number,
  basedOnCases: number,
  confidenceLevel: number
): { lower: number; upper: number } {
  // 基于案例数量的置信度调整
  const sampleFactor = Math.min(basedOnCases / 50, 1)
  const baseMargin = 20
  const adjustedMargin = baseMargin * (1 - sampleFactor * 0.5)

  // 根据置信水平调整
  const zScore = getZScore(confidenceLevel)
  const margin = (adjustedMargin * zScore) / 1.96

  return {
    lower: Math.max(0, Math.round(probability - margin)),
    upper: Math.min(100, Math.round(probability + margin)),
  }
}

/**
 * 获取Z分数
 */
export function getZScore(confidenceLevel: number): number {
  const zScores: Record<number, number> = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  }
  return zScores[confidenceLevel] || 1.96
}

/**
 * 生成关键成功因素和风险因素
 */
export function generateFactors(features: PredictionFeatures): {
  successFactors: string[]
  riskFactors: string[]
} {
  const successFactors: string[] = []
  const riskFactors: string[] = []

  // 基于驳回类型的因素
  if (features.rejectionTypes.has(RejectionType.FORMALITY)) {
    successFactors.push('形式缺陷易于修正')
  }
  if (features.rejectionTypes.has(RejectionType.NOVELTY)) {
    riskFactors.push('新颖性问题需要明确区分技术特征')
  }
  if (features.rejectionTypes.has(RejectionType.INVENTIVENESS)) {
    riskFactors.push('创造性问题通常需要较强的论点')
  }

  // 基于严重程度的因素
  if (features.severity === Severity.LOW) {
    successFactors.push('驳回理由严重程度较低')
  } else if (features.severity === Severity.HIGH) {
    riskFactors.push('存在高严重程度驳回理由')
  }

  // 基于权利要求数量的因素
  if (features.claimCount <= 2) {
    successFactors.push('涉及权利要求数量较少，答复难度相对较低')
  } else if (features.claimCount > 5) {
    riskFactors.push('涉及权利要求数量较多，答复难度较大')
  }

  // 基于引用文献数量的因素
  if (features.referenceCount <= 1) {
    successFactors.push('引用对比文件较少')
  } else if (features.referenceCount > 3) {
    riskFactors.push('引用对比文件较多，需要逐一针对性答辩')
  }

  // 基于策略的因素
  if (features.strategy === ResponseStrategy.AMEND) {
    successFactors.push('修改策略通常能较好地克服驳回')
    riskFactors.push('修改可能导致保护范围缩小')
  } else if (features.strategy === ResponseStrategy.BOTH) {
    successFactors.push('混合策略提供更全面的答复')
  }

  // 基于审查轮次的因素
  if (features.round === 1) {
    successFactors.push('首次答复，通常有较大空间')
  } else if (features.round >= 2) {
    riskFactors.push(`第${features.round}次答复，问题可能较为复杂`)
  }

  return { successFactors, riskFactors }
}

/**
 * 从成功案例中提取成功因素
 */
export function extractSuccessFactorsFromCases(cases: HistoricalCase[]): string[] {
  const factors: string[] = []

  for (const caseData of cases) {
    // 从标签中提取
    factors.push(
      ...caseData.tags.filter(
        (tag) => tag.includes('成功') || tag.includes('有效') || tag.includes('克服')
      )
    )

    // 从论点中提取
    for (const arg of caseData.arguments) {
      if (arg.strength && arg.strength >= 4) {
        factors.push(arg.category)
      }
    }
  }

  return [...new Set(factors)]
}

/**
 * 从失败案例中提取风险因素
 */
export function extractRiskFactorsFromCases(cases: HistoricalCase[]): string[] {
  const factors: string[] = []

  for (const caseData of cases) {
    // 从驳回理由中提取
    for (const rejection of caseData.rejectionReasons) {
      if (rejection.severity === Severity.HIGH) {
        factors.push(`${rejection.type}类型驳回可能导致失败`)
      }
    }
  }

  return [...new Set(factors)]
}

/**
 * 合并权重
 */
export function mergeWeights(
  defaultWeights: FeatureWeights,
  customWeights: Partial<FeatureWeights> = {}
): FeatureWeights {
  const merged: FeatureWeights = {
    rejectionTypeWeights: new Map(defaultWeights.rejectionTypeWeights),
    severityWeights: new Map(defaultWeights.severityWeights),
    claimCountWeight: defaultWeights.claimCountWeight,
    referenceCountWeight: defaultWeights.referenceCountWeight,
    strategyWeights: new Map(defaultWeights.strategyWeights),
    roundWeight: defaultWeights.roundWeight,
  }

  if (customWeights.rejectionTypeWeights) {
    for (const [key, value] of customWeights.rejectionTypeWeights) {
      merged.rejectionTypeWeights.set(key, value)
    }
  }

  if (customWeights.severityWeights) {
    for (const [key, value] of customWeights.severityWeights) {
      merged.severityWeights.set(key, value)
    }
  }

  if (customWeights.claimCountWeight !== undefined) {
    merged.claimCountWeight = customWeights.claimCountWeight
  }

  if (customWeights.referenceCountWeight !== undefined) {
    merged.referenceCountWeight = customWeights.referenceCountWeight
  }

  if (customWeights.strategyWeights) {
    for (const [key, value] of customWeights.strategyWeights) {
      merged.strategyWeights.set(key, value)
    }
  }

  if (customWeights.roundWeight !== undefined) {
    merged.roundWeight = customWeights.roundWeight
  }

  return merged
}
