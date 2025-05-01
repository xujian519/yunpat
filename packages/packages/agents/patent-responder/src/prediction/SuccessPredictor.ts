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

import type { OAParseResult, SuccessPrediction } from '../types/index.js'
import { RejectionType, Severity, HistoricalCase, ResponseStrategy } from '../types/index.js'

/**
 * 预测特征
 */
export interface PredictionFeatures {
  /** 驳回类型特征 */
  rejectionTypes: Set<RejectionType>
  /** 严重程度特征 */
  severity: Severity
  /** 涉及权利要求数量 */
  claimCount: number
  /** 引用文献数量 */
  referenceCount: number
  /** 答复策略 */
  strategy: ResponseStrategy
  /** 审查轮次 */
  round: number
  /** 技术领域 */
  technicalField?: string
}

/**
 * 特征权重
 */
interface FeatureWeights {
  rejectionTypeWeights: Map<RejectionType, number>
  severityWeights: Map<Severity, number>
  claimCountWeight: number
  referenceCountWeight: number
  strategyWeights: Map<ResponseStrategy, number>
  roundWeight: number
}

/**
 * 预测器配置
 */
export interface SuccessPredictorConfig {
  /** 是否启用机器学习 */
  enableML?: boolean
  /** 最小样本数量 */
  minSamples?: number
  /** 置信水平 (0-1) */
  confidenceLevel?: number
  /** 自定义权重 */
  customWeights?: Partial<FeatureWeights>
}

/**
 * 成功率预测器类
 */
export class SuccessPredictor {
  private config: Required<SuccessPredictorConfig>
  private historicalCases: HistoricalCase[] = []
  private weights: FeatureWeights

  // 默认特征权重
  private readonly DEFAULT_WEIGHTS: FeatureWeights = {
    rejectionTypeWeights: new Map([
      [RejectionType.NOVELTY, 0.25],
      [RejectionType.INVENTIVENESS, 0.3],
      [RejectionType.UTILITY, 0.15],
      [RejectionType.SUPPORT, 0.2],
      [RejectionType.CLARITY, 0.25],
      [RejectionType.SCOPE, 0.22],
      [RejectionType.AMENDMENT_SCOPE, 0.18],
      [RejectionType.UNITY, 0.2],
      [RejectionType.FORMALITY, 0.4],
      [RejectionType.OTHER, 0.2],
    ]),
    severityWeights: new Map([
      [Severity.HIGH, -0.25],
      [Severity.MEDIUM, 0],
      [Severity.LOW, 0.15],
    ]),
    claimCountWeight: -0.03,
    referenceCountWeight: -0.05,
    strategyWeights: new Map([
      [ResponseStrategy.ARGUE, 0.55],
      [ResponseStrategy.AMEND, 0.6],
      [ResponseStrategy.BOTH, 0.65],
      [ResponseStrategy.ABANDON, 0.1],
      [ResponseStrategy.APPEAL, 0.35],
    ]),
    roundWeight: -0.08,
  }

  constructor(config: SuccessPredictorConfig = {}) {
    this.config = {
      enableML: config.enableML ?? true,
      minSamples: config.minSamples || 10,
      confidenceLevel: config.confidenceLevel || 0.95,
      customWeights: config.customWeights || {},
    }

    // 合并自定义权重
    this.weights = this.mergeWeights(this.DEFAULT_WEIGHTS, this.config.customWeights)
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
    const basePrediction = this.calculateBasePrediction(features)

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
          rejectionProbabilities: this.mergeRejectionProbabilities(
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
    const confidenceInterval = this.calculateConfidenceInterval(
      caseEnhancedPrediction.overallProbability,
      basedOnCases
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
      severity: this.calculateOverallSeverity(parseResult.rejectionReasons),
      claimCount: parseResult.affectedClaims.length,
      referenceCount: parseResult.citedReferences.length,
      strategy,
      round,
      technicalField: this.inferTechnicalField(parseResult),
    }
  }

  /**
   * 计算整体严重程度
   */
  private calculateOverallSeverity(rejections: Array<{ severity: Severity }>): Severity {
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
  private inferTechnicalField(parseResult: OAParseResult): string | undefined {
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
  private calculateBasePrediction(features: PredictionFeatures): SuccessPrediction {
    let score = 50 // 基础分

    // 1. 驳回类型影响
    let rejectionWeightSum = 0
    for (const rejectionType of features.rejectionTypes) {
      const weight = this.weights.rejectionTypeWeights.get(rejectionType) || 0.2
      score += weight * 100
      rejectionWeightSum += weight
    }
    if (features.rejectionTypes.size > 0) {
      score /= features.rejectionTypes.size
    }

    // 2. 严重程度影响
    const severityWeight = this.weights.severityWeights.get(features.severity) || 0
    score += severityWeight * 100

    // 3. 权利要求数量影响
    score += (features.claimCount - 3) * this.weights.claimCountWeight * 100

    // 4. 引用文献数量影响
    score += (features.referenceCount - 1) * this.weights.referenceCountWeight * 100

    // 5. 策略影响
    const strategyWeight = this.weights.strategyWeights.get(features.strategy) || 0.5
    score = score * 0.6 + strategyWeight * 100 * 0.4

    // 6. 审查轮次影响
    score += (features.round - 1) * this.weights.roundWeight * 100

    // 确保分数在合理范围内
    score = Math.max(10, Math.min(95, score))

    // 计算各驳回类型的概率
    const rejectionProbabilities = new Map<RejectionType, number>()
    for (const rejectionType of features.rejectionTypes) {
      const typeScore = score + (this.weights.rejectionTypeWeights.get(rejectionType) || 0.2) * 50
      rejectionProbabilities.set(rejectionType, Math.max(20, Math.min(95, typeScore)))
    }

    // 生成关键成功因素和风险因素
    const { successFactors, riskFactors } = this.generateFactors(features)

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
   * 基于历史案例计算预测
   */
  private async calculateCaseBasedPrediction(
    features: PredictionFeatures
  ): Promise<SuccessPrediction | null> {
    // 查找相似案例
    const similarCases = this.findSimilarCases(features)

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
    const successFactors = this.extractSuccessFactorsFromCases(
      similarCases.filter((c) => c.outcome === 'success' || c.outcome === 'partial_success')
    )

    // 提取风险因素
    const riskFactors = this.extractRiskFactorsFromCases(
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
   * 查找相似案例
   */
  private findSimilarCases(features: PredictionFeatures): HistoricalCase[] {
    const similarities: Array<{ case: HistoricalCase; similarity: number }> = []

    for (const caseData of this.historicalCases) {
      const similarity = this.calculateCaseSimilarity(features, caseData)
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
  private calculateCaseSimilarity(features: PredictionFeatures, caseData: HistoricalCase): number {
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
  private mergeRejectionProbabilities(
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
  private calculateConfidenceInterval(
    probability: number,
    basedOnCases: number
  ): { lower: number; upper: number } {
    // 基于案例数量的置信度调整
    const sampleFactor = Math.min(basedOnCases / 50, 1)
    const baseMargin = 20
    const adjustedMargin = baseMargin * (1 - sampleFactor * 0.5)

    // 根据置信水平调整
    const zScore = this.getZScore(this.config.confidenceLevel)
    const margin = (adjustedMargin * zScore) / 1.96

    return {
      lower: Math.max(0, Math.round(probability - margin)),
      upper: Math.min(100, Math.round(probability + margin)),
    }
  }

  /**
   * 获取Z分数
   */
  private getZScore(confidenceLevel: number): number {
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
  private generateFactors(features: PredictionFeatures): {
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
  private extractSuccessFactorsFromCases(cases: HistoricalCase[]): string[] {
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
  private extractRiskFactorsFromCases(cases: HistoricalCase[]): string[] {
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
  private mergeWeights(
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
    this.weights = this.mergeWeights(this.weights, customWeights)
  }

  /**
   * 重置为默认权重
   */
  resetWeights(): void {
    this.weights = {
      rejectionTypeWeights: new Map(this.DEFAULT_WEIGHTS.rejectionTypeWeights),
      severityWeights: new Map(this.DEFAULT_WEIGHTS.severityWeights),
      claimCountWeight: this.DEFAULT_WEIGHTS.claimCountWeight,
      referenceCountWeight: this.DEFAULT_WEIGHTS.referenceCountWeight,
      strategyWeights: new Map(this.DEFAULT_WEIGHTS.strategyWeights),
      roundWeight: this.DEFAULT_WEIGHTS.roundWeight,
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
