/**
 * 成功率预测器
 *
 * 使用机器学习和统计分析预测答复成功率：
 * 1. 基于历史案例的预测
 * 2. 特征工程和权重计算
 * 3. 置信区间估计
 * 4. 关键成功因素识别
 * 5. 风险因素识别
 *
 * @module prediction/SuccessPredictor
 */

import type { OAParseResult, SuccessPrediction, HistoricalCase } from '../types/index.js'
import { RejectionType, ResponseStrategy } from '../types/index.js'
import { DEFAULT_WEIGHTS } from './predictionTypes.js'
import type {
  PredictionFeatures,
  FeatureWeights,
  SuccessPredictorConfig,
} from './predictionTypes.js'
import {
  calculateOverallSeverity,
  inferTechnicalField,
  calculateBasePrediction,
  findSimilarCases,
  calculateCaseSimilarity,
  mergeRejectionProbabilities,
  calculateConfidenceInterval,
  generateFactors,
  extractSuccessFactorsFromCases,
  extractRiskFactorsFromCases,
  mergeWeights,
} from './predictionUtils.js'

// Re-export types for backward compatibility
export type { SuccessPredictorConfig, PredictionFeatures }

/**
 * 成功率预测器类
 */
export class SuccessPredictor {
  private config: Required<SuccessPredictorConfig>
  private historicalCases: HistoricalCase[] = []
  private weights: FeatureWeights

  constructor(config: SuccessPredictorConfig = {}) {
    this.config = {
      enableML: config.enableML ?? true,
      minSamples: config.minSamples || 10,
      confidenceLevel: config.confidenceLevel || 0.95,
      customWeights: config.customWeights || {},
    }

    // 合并自定义权重
    this.weights = mergeWeights(DEFAULT_WEIGHTS, this.config.customWeights)
  }

  /**
   * 添加历史案例
   */
  addHistoricalCase(caseData: HistoricalCase): void {
    this.historicalCases.push(caseData)
  }

  /**
   * 批量添加历史案例
   */
  addHistoricalCases(cases: HistoricalCase[]): void {
    this.historicalCases.push(...cases)
  }

  /**
   * 预测成功率
   */
  async predict(
    parseResult: OAParseResult,
    strategy: ResponseStrategy,
    round: number = 1
  ): Promise<SuccessPrediction> {
    // 提取特征
    const features = this.extractFeatures(parseResult, strategy, round)

    // 计算基础预测
    const basePrediction = calculateBasePrediction(features, this.weights)

    // 如果有足够的历史案例，使用案例增强预测
    let caseEnhancedPrediction = basePrediction
    let basedOnCases = 0

    if (this.historicalCases.length >= this.config.minSamples) {
      const caseBasedPrediction = await this.calculateCaseBasedPrediction(features)
      if (caseBasedPrediction) {
        // 加权融合基础预测和案例预测
        const caseWeight = Math.min(this.historicalCases.length / 100, 0.5)
        caseEnhancedPrediction = {
          overallProbability:
            basePrediction.overallProbability * (1 - caseWeight) +
            caseBasedPrediction.overallProbability * caseWeight,
          rejectionProbabilities: mergeRejectionProbabilities(
            basePrediction.rejectionProbabilities,
            caseBasedPrediction.rejectionProbabilities,
            caseWeight
          ),
          confidenceInterval: basePrediction.confidenceInterval,
          keySuccessFactors: [
            ...basePrediction.keySuccessFactors,
            ...caseBasedPrediction.keySuccessFactors,
          ],
          riskFactors: [...basePrediction.riskFactors, ...caseBasedPrediction.riskFactors],
          basedOnCases: caseBasedPrediction.basedOnCases,
        }
        basedOnCases = caseBasedPrediction.basedOnCases
      }
    }

    // 计算置信区间
    const confidenceInterval = calculateConfidenceInterval(
      caseEnhancedPrediction.overallProbability,
      basedOnCases,
      this.config.confidenceLevel
    )

    return {
      overallProbability: Math.round(caseEnhancedPrediction.overallProbability),
      rejectionProbabilities: caseEnhancedPrediction.rejectionProbabilities,
      confidenceInterval,
      keySuccessFactors: [...new Set(caseEnhancedPrediction.keySuccessFactors)].slice(0, 5),
      riskFactors: [...new Set(caseEnhancedPrediction.riskFactors)].slice(0, 5),
      basedOnCases,
    }
  }

  /**
   * 提取预测特征
   */
  private extractFeatures(
    parseResult: OAParseResult,
    strategy: ResponseStrategy,
    round: number
  ): PredictionFeatures {
    return {
      rejectionTypes: new Set(parseResult.rejectionTypes),
      severity: calculateOverallSeverity(parseResult.rejectionReasons),
      claimCount: parseResult.affectedClaims.length,
      referenceCount: parseResult.citedReferences.length,
      strategy,
      round,
      technicalField: inferTechnicalField(parseResult),
    }
  }

  /**
   * 基于历史案例计算预测
   */
  private async calculateCaseBasedPrediction(
    features: PredictionFeatures
  ): Promise<SuccessPrediction | null> {
    // 查找相似案例
    const similarCases = findSimilarCases(features, this.historicalCases)

    if (similarCases.length < 3) {
      return null
    }

    // 计算平均成功率
    const successCases = similarCases.filter(
      (c) => c.outcome === 'success' || c.outcome === 'partial_success'
    )
    const overallProbability = (successCases.length / similarCases.length) * 100

    // 计算各驳回类型的概率
    const rejectionProbabilities = new Map<RejectionType, number>()
    for (const rejectionType of features.rejectionTypes) {
      const typeCases = similarCases.filter((c) =>
        c.rejectionReasons.some((r) => r.type === rejectionType)
      )
      if (typeCases.length > 0) {
        const typeSuccessCases = typeCases.filter(
          (c) => c.outcome === 'success' || c.outcome === 'partial_success'
        )
        rejectionProbabilities.set(
          rejectionType,
          (typeSuccessCases.length / typeCases.length) * 100
        )
      }
    }

    // 提取成功因素
    const successFactors = extractSuccessFactorsFromCases(
      similarCases.filter((c) => c.outcome === 'success' || c.outcome === 'partial_success')
    )

    // 提取风险因素
    const riskFactors = extractRiskFactorsFromCases(
      similarCases.filter((c) => c.outcome === 'failure')
    )

    return {
      overallProbability,
      rejectionProbabilities,
      confidenceInterval: {
        lower: Math.max(0, overallProbability - 10),
        upper: Math.min(100, overallProbability + 10),
      },
      keySuccessFactors: successFactors,
      riskFactors,
      basedOnCases: similarCases.length,
    }
  }

  /**
   * 批量预测
   */
  async predictBatch(
    inputs: Array<{ parseResult: OAParseResult; strategy: ResponseStrategy; round?: number }>
  ): Promise<SuccessPrediction[]> {
    const predictions: SuccessPrediction[] = []

    for (const input of inputs) {
      const prediction = await this.predict(input.parseResult, input.strategy, input.round || 1)
      predictions.push(prediction)
    }

    return predictions
  }

  /**
   * 获取预测解释
   */
  explainPrediction(prediction: SuccessPrediction): string {
    const parts: string[] = []

    parts.push(`预测成功率: ${prediction.overallProbability}%`)

    if (prediction.confidenceInterval) {
      parts.push(
        `置信区间 (${this.config.confidenceLevel * 100}%): ` +
          `${prediction.confidenceInterval.lower}% - ${prediction.confidenceInterval.upper}%`
      )
    }

    if (prediction.basedOnCases > 0) {
      parts.push(`基于 ${prediction.basedOnCases} 个相似案例`)
    }

    if (prediction.keySuccessFactors.length > 0) {
      parts.push(
        '\n关键成功因素:\n' + prediction.keySuccessFactors.map((f) => `  • ${f}`).join('\n')
      )
    }

    if (prediction.riskFactors.length > 0) {
      parts.push('\n风险因素:\n' + prediction.riskFactors.map((f) => `  • ${f}`).join('\n'))
    }

    return parts.join('\n')
  }

  /**
   * 获取当前权重配置
   */
  getWeights(): FeatureWeights {
    return {
      rejectionTypeWeights: new Map(this.weights.rejectionTypeWeights),
      severityWeights: new Map(this.weights.severityWeights),
      claimCountWeight: this.weights.claimCountWeight,
      referenceCountWeight: this.weights.referenceCountWeight,
      strategyWeights: new Map(this.weights.strategyWeights),
      roundWeight: this.weights.roundWeight,
    }
  }

  /**
   * 更新权重配置
   */
  updateWeights(customWeights: Partial<FeatureWeights>): void {
    this.weights = mergeWeights(this.weights, customWeights)
  }

  /**
   * 重置为默认权重
   */
  resetWeights(): void {
    this.weights = {
      rejectionTypeWeights: new Map(DEFAULT_WEIGHTS.rejectionTypeWeights),
      severityWeights: new Map(DEFAULT_WEIGHTS.severityWeights),
      claimCountWeight: DEFAULT_WEIGHTS.claimCountWeight,
      referenceCountWeight: DEFAULT_WEIGHTS.referenceCountWeight,
      strategyWeights: new Map(DEFAULT_WEIGHTS.strategyWeights),
      roundWeight: DEFAULT_WEIGHTS.roundWeight,
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCases: number
    successRate: number
    casesByRejectionType: Map<RejectionType, number>
    casesByStrategy: Map<ResponseStrategy, number>
    casesByOutcome: Map<string, number>
  } {
    const successCount = this.historicalCases.filter(
      (c) => c.outcome === 'success' || c.outcome === 'partial_success'
    ).length

    const casesByRejectionType = new Map<RejectionType, number>()
    const casesByStrategy = new Map<ResponseStrategy, number>()
    const casesByOutcome = new Map<string, number>()

    for (const caseData of this.historicalCases) {
      for (const rejection of caseData.rejectionReasons) {
        casesByRejectionType.set(
          rejection.type,
          (casesByRejectionType.get(rejection.type) || 0) + 1
        )
      }

      casesByStrategy.set(caseData.strategy, (casesByStrategy.get(caseData.strategy) || 0) + 1)

      casesByOutcome.set(caseData.outcome, (casesByOutcome.get(caseData.outcome) || 0) + 1)
    }

    return {
      totalCases: this.historicalCases.length,
      successRate: this.historicalCases.length > 0 ? successCount / this.historicalCases.length : 0,
      casesByRejectionType,
      casesByStrategy,
      casesByOutcome,
    }
  }
}

/**
 * 创建默认成功率预测器实例
 */
export function createSuccessPredictor(config?: SuccessPredictorConfig): SuccessPredictor {
  return new SuccessPredictor(config)
}
