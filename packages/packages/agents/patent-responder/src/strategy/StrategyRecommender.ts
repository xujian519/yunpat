/**
 * 答复策略推荐器
 *
 * 基于审查意见分析、历史案例、用户偏好、风险评估和成功概率生成最佳答复策略。
 *
 * @module strategy/StrategyRecommender
 */

import type { OAParseResult, StrategyRecommendation, HistoricalCase } from '../types/index.js'
import type { StrategyRecommenderConfig, StrategyScore } from './StrategyTypes.js'
import { evaluateStrategies, selectBestStrategy, findRelevantCaseIds } from './StrategyScorer.js'
import {
  generateKeyArguments,
  generateAmendmentSuggestions,
  identifyRisks,
  generateAlternatives,
  suggestAdditionalEvidence,
  generateRationale,
} from './StrategyArgumentGenerator.js'

export type { StrategyRecommenderConfig } from './StrategyTypes.js'

/**
 * 策略推荐器类
 */
export class StrategyRecommender {
  private config: Required<StrategyRecommenderConfig>
  private historicalCases: Map<string, HistoricalCase> = new Map()

  constructor(config: StrategyRecommenderConfig = {}) {
    this.config = {
      defaultPreference: config.defaultPreference || 'moderate',
      enableCaseBasedLearning: config.enableCaseBasedLearning ?? true,
      minCaseSimilarity: config.minCaseSimilarity || 0.6,
      maxReferenceCases: config.maxReferenceCases || 5,
      riskTolerance: config.riskTolerance || 0.5,
    }
  }

  addHistoricalCase(caseData: HistoricalCase): void {
    this.historicalCases.set(caseData.id, caseData)
  }

  addHistoricalCases(cases: HistoricalCase[]): void {
    for (const caseData of cases) {
      this.historicalCases.set(caseData.id, caseData)
    }
  }

  async recommend(
    parseResult: OAParseResult,
    userPreference?: 'aggressive' | 'moderate' | 'conservative'
  ): Promise<StrategyRecommendation> {
    const preference = userPreference || this.config.defaultPreference

    const strategyScores = evaluateStrategies(
      parseResult,
      preference,
      this.historicalCases,
      this.config.riskTolerance
    )

    const bestStrategy = selectBestStrategy(strategyScores)

    const keyArguments = await generateKeyArguments(parseResult, bestStrategy.strategy)
    const amendmentSuggestions = await generateAmendmentSuggestions(
      parseResult,
      bestStrategy.strategy
    )
    const risks = identifyRisks(parseResult, bestStrategy.strategy, keyArguments)
    const alternativeStrategies = generateAlternatives(strategyScores, bestStrategy.strategy)
    const basedOnCases = this.findRelevantCases(parseResult)
    const rationale = generateRationale(bestStrategy, basedOnCases)

    return {
      strategy: bestStrategy.strategy,
      successProbability: bestStrategy.score,
      rationale,
      keyArguments,
      amendmentSuggestions,
      additionalEvidence: suggestAdditionalEvidence(parseResult, keyArguments),
      risks,
      alternativeStrategies,
      basedOnCases,
    }
  }

  private findRelevantCases(parseResult: OAParseResult): string[] {
    if (!this.config.enableCaseBasedLearning || this.historicalCases.size === 0) return []

    return findRelevantCaseIds(
      parseResult,
      this.historicalCases,
      this.config.minCaseSimilarity,
      this.config.maxReferenceCases
    )
  }
}

/**
 * 创建默认策略推荐器实例
 */
export function createStrategyRecommender(config?: StrategyRecommenderConfig): StrategyRecommender {
  return new StrategyRecommender(config)
}
