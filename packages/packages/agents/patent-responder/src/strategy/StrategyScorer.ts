import type { OAParseResult, RejectionReason, HistoricalCase } from '../types/index.js'
import { ResponseStrategy } from '../types/index.js'
import type { StrategyScore } from './StrategyTypes.js'
import { WEIGHTS, REJECTION_STRATEGY_MAP } from './StrategyTypes.js'

type UserPreference = 'aggressive' | 'moderate' | 'conservative'

const BASE_PREFERENCE_SCORES: Record<UserPreference, Record<ResponseStrategy, number>> = {
  aggressive: { argue: 85, amend: 60, both: 75, abandon: 20, appeal: 70 },
  moderate: { argue: 70, amend: 75, both: 80, abandon: 30, appeal: 50 },
  conservative: { argue: 50, amend: 85, both: 70, abandon: 50, appeal: 40 },
}

const USER_PREFERENCE_SCORES: Record<UserPreference, Partial<Record<ResponseStrategy, number>>> = {
  aggressive: { argue: 100, both: 85, appeal: 80, amend: 60, abandon: 30 },
  moderate: { both: 100, amend: 90, argue: 80, appeal: 60, abandon: 40 },
  conservative: { amend: 100, both: 80, argue: 50, abandon: 60, appeal: 40 },
}

/**
 * 评估各策略得分
 */
export function evaluateStrategies(
  parseResult: OAParseResult,
  userPreference: UserPreference,
  historicalCases: Map<string, HistoricalCase>,
  riskTolerance: number
): StrategyScore[] {
  const strategies: ResponseStrategy[] = [
    ResponseStrategy.ARGUE,
    ResponseStrategy.AMEND,
    ResponseStrategy.BOTH,
    ResponseStrategy.ABANDON,
    ResponseStrategy.APPEAL,
  ]

  return strategies
    .map((strategy) =>
      calculateStrategyScore(parseResult, strategy, userPreference, historicalCases, riskTolerance)
    )
    .sort((a, b) => b.score - a.score)
}

/**
 * 计算单个策略的得分
 */
export function calculateStrategyScore(
  parseResult: OAParseResult,
  strategy: ResponseStrategy,
  userPreference: UserPreference,
  historicalCases: Map<string, HistoricalCase>,
  riskTolerance: number
): StrategyScore {
  const baseScore = BASE_PREFERENCE_SCORES[userPreference][strategy]
  const rejectionMatch = calculateRejectionMatch(parseResult.rejectionReasons, strategy)
  const historicalSuccess = calculateHistoricalSuccess(parseResult, strategy, historicalCases)
  const riskAdjustment = calculateRiskAdjustment(parseResult, strategy, riskTolerance)
  const userPreferenceScore = USER_PREFERENCE_SCORES[userPreference][strategy] || 60

  const totalScore =
    baseScore * WEIGHTS.baseScore +
    rejectionMatch * WEIGHTS.rejectionMatch +
    historicalSuccess * WEIGHTS.historicalSuccess +
    riskAdjustment * WEIGHTS.riskAdjustment +
    userPreferenceScore * WEIGHTS.userPreference

  return {
    strategy,
    score: Math.max(0, Math.min(100, totalScore)),
    details: {
      baseScore,
      rejectionMatch,
      historicalSuccess,
      riskAdjustment,
      userPreference: userPreferenceScore,
    },
  }
}

/**
 * 计算驳回理由匹配度
 */
export function calculateRejectionMatch(
  rejectionReasons: RejectionReason[],
  strategy: ResponseStrategy
): number {
  if (rejectionReasons.length === 0) return 50

  let totalScore = 0
  let weightSum = 0

  for (const reason of rejectionReasons) {
    const weight = reason.severity === 'high' ? 1.5 : reason.severity === 'medium' ? 1 : 0.5
    const suggestedMatch = isStrategyMatchingSuggestion(strategy, reason.suggestedResponse)
    const typeMatch = isStrategySuitableForRejection(strategy, reason.type)
    const score = (suggestedMatch ? 80 : 40) * 0.6 + (typeMatch ? 90 : 50) * 0.4

    totalScore += score * weight
    weightSum += weight
  }

  return weightSum > 0 ? totalScore / weightSum : 50
}

/**
 * 计算历史成功率
 */
export function calculateHistoricalSuccess(
  parseResult: OAParseResult,
  strategy: ResponseStrategy,
  historicalCases: Map<string, HistoricalCase>
): number {
  if (historicalCases.size === 0) return 60

  const relevantCases = findRelevantCaseIds(parseResult, historicalCases)
  const strategyCases = relevantCases.filter((id) => {
    const caseData = historicalCases.get(id)
    return caseData?.strategy === strategy
  })

  if (strategyCases.length === 0) return 60

  const successCount = strategyCases.filter((id) => {
    const caseData = historicalCases.get(id)
    return caseData?.outcome === 'success' || caseData?.outcome === 'partial_success'
  }).length

  return (successCount / strategyCases.length) * 100
}

/**
 * 计算风险调整
 */
export function calculateRiskAdjustment(
  parseResult: OAParseResult,
  strategy: ResponseStrategy,
  riskTolerance: number
): number {
  let riskScore = 100

  const highSeverityCount = parseResult.rejectionReasons.filter((r) => r.severity === 'high').length
  if (highSeverityCount > 2) riskScore -= 20
  else if (highSeverityCount > 0) riskScore -= 10

  if (parseResult.affectedClaims.length > 5) riskScore -= 15
  else if (parseResult.affectedClaims.length > 3) riskScore -= 8

  if (strategy === ResponseStrategy.ABANDON) riskScore -= 30
  else if (strategy === ResponseStrategy.APPEAL) riskScore -= 25
  else if (strategy === ResponseStrategy.BOTH) riskScore -= 10

  riskScore += (riskTolerance - 0.5) * 20

  return Math.max(20, Math.min(100, riskScore))
}

/**
 * 选择最佳策略
 */
export function selectBestStrategy(scores: StrategyScore[]): StrategyScore {
  const nonAbandonScores = scores.filter((s) => s.strategy !== ResponseStrategy.ABANDON)

  if (nonAbandonScores.length > 0 && nonAbandonScores[0].score > 30) {
    return nonAbandonScores[0]
  }

  return scores[0]
}

/**
 * 计算案例相似度
 */
export function calculateCaseSimilarity(
  parseResult: OAParseResult,
  caseData: HistoricalCase
): number {
  let similarity = 0
  let factors = 0

  const parseTypes = new Set(parseResult.rejectionTypes)
  const caseTypes = new Set(caseData.rejectionReasons.map((r) => r.type))
  const typeIntersection = [...parseTypes].filter((t) => caseTypes.has(t))
  similarity += (typeIntersection.length / Math.max(parseTypes.size, caseTypes.size)) * 0.4
  factors += 0.4

  const claimCountDiff = Math.abs(
    parseResult.affectedClaims.length - (caseData.grantedClaims?.length || 0)
  )
  similarity += Math.max(0, 1 - claimCountDiff / 10) * 0.2
  factors += 0.2

  const refCountDiff = Math.abs(
    parseResult.citedReferences.length - caseData.rejectionReasons.length
  )
  similarity += Math.max(0, 1 - refCountDiff / 5) * 0.2
  factors += 0.2

  if (parseResult.patentTitle && caseData.technicalField) {
    const titleWords = parseResult.patentTitle.split(/\s+/)
    const fieldWords = caseData.technicalField.split(/\s+/)
    const wordMatch = titleWords.filter((w) => fieldWords.includes(w)).length
    similarity += Math.min(1, wordMatch / 3) * 0.2
    factors += 0.2
  }

  return factors > 0 ? similarity / factors : 0
}

/**
 * 查找相关案例ID
 */
export function findRelevantCaseIds(
  parseResult: OAParseResult,
  historicalCases: Map<string, HistoricalCase>,
  minSimilarity = 0.6,
  maxResults = 5
): string[] {
  const relevantCases: Array<{ id: string; similarity: number }> = []

  for (const [id, caseData] of historicalCases) {
    const similarity = calculateCaseSimilarity(parseResult, caseData)
    if (similarity >= minSimilarity) {
      relevantCases.push({ id, similarity })
    }
  }

  return relevantCases
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
    .map((c) => c.id)
}

function isStrategyMatchingSuggestion(
  strategy: ResponseStrategy,
  suggested?: 'argue' | 'amend' | 'both' | 'abandon'
): boolean {
  if (!suggested) return false
  if (suggested === 'abandon') {
    return strategy === ResponseStrategy.ABANDON || strategy === ResponseStrategy.APPEAL
  }
  if (suggested === 'both') {
    return (
      strategy === ResponseStrategy.BOTH ||
      strategy === ResponseStrategy.ARGUE ||
      strategy === ResponseStrategy.AMEND
    )
  }
  return strategy === suggested || strategy === ResponseStrategy.BOTH
}

function isStrategySuitableForRejection(
  strategy: ResponseStrategy,
  rejectionType: string
): boolean {
  const suitable =
    REJECTION_STRATEGY_MAP[rejectionType as keyof typeof REJECTION_STRATEGY_MAP] || []
  return suitable.includes(strategy)
}
