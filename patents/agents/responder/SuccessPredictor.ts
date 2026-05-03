/**
 * SuccessPredictor - 专利答复成功率预测模型
 *
 * 基于多维度因素预测专利答复的授权成功率
 *
 * 核心功能：
 * 1. 多维度特征提取（驳回类型、答复策略、权利要求质量等）
 * 2. 基于历史数据和规则的混合预测
 * 3. 提供可解释的预测结果
 * 4. 敏感性分析（哪些因素最影响成功率）
 */

import type { LLMAdapter } from '@yunpat/core'
import type { OfficeAction, ResponseStrategy } from '../../core/PatentCoreBridge.js'

/**
 * 预测特征
 */
export interface PredictionFeatures {
  /** 审查意见特征 */
  oaFeatures: {
    type: string
    severity: 'low' | 'medium' | 'high'
    affectedClaimsCount: number
    citationsCount: number
    examinerArgumentLength: number
  }

  /** 答复策略特征 */
  strategyFeatures: {
    type: 'AmendClaims' | 'Argue' | 'Hybrid' | 'Withdraw'
    confidence: number
    argumentsCount: number
    amendmentCount: number
  }

  /** 权利要求质量特征 */
  claimsQualityFeatures: {
    clarityScore: number
    supportScore: number
    scopeScore: number
    overallScore: number
    issuesCount: number
  }

  /** 技术领域特征 */
  technicalFeatures: {
    domain: string
    complexity: 'low' | 'medium' | 'high'
  }

  /** 时间特征 */
  temporalFeatures: {
    responseDelay: number // 答复延迟天数
    examinationDuration: number // 审查时长（月）
  }
}

/**
 * 预测结果
 */
export interface PredictionResult {
  /** 成功概率（0-100） */
  successProbability: number

  /** 置信区间 */
  confidenceInterval: {
    lower: number
    upper: number
  }

  /** 特征重要性分析 */
  featureImportance: Array<{
    feature: string
    importance: number
    impact: 'positive' | 'negative'
  }>

  /** 详细分析 */
  analysis: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }

  /** 与基准对比 */
  comparison: {
    baseline: number
    improvement: number
    percentile: string
  }
}

/**
 * 历史案例数据（简化版）
 */
interface HistoricalCase {
  oaType: string
  strategyType: string
  claimsQuality: number
  outcome: 'success' | 'failure'
  features: PredictionFeatures
}

/**
 * 成功率预测器配置
 */
export interface SuccessPredictorConfig {
  /** 是否使用历史案例学习 */
  useHistoricalData?: boolean

  /** 保守程度（0-1，默认0.5） */
  conservatism?: number

  /** 技术领域专长 */
  domainExpertise?: Map<string, number>
}

/**
 * 成功率预测器
 */
export class SuccessPredictor {
  private llm: LLMAdapter
  private config: Required<SuccessPredictorConfig>
  private historicalCases: HistoricalCase[] = []

  // 基准成功率（来自行业数据）
  private readonly baselineSuccessRates = {
    'Novelty': 45, // 新颖性问题
    'InventiveStep': 35, // 创造性问题
    'Clarity': 65, // 清楚性问题
    'Support': 55, // 支持性问题
    'Formality': 85, // 形式问题
  }

  constructor(llm: LLMAdapter, config: SuccessPredictorConfig = {}) {
    this.llm = llm
    this.config = {
      useHistoricalData: config.useHistoricalData ?? true,
      conservatism: config.conservatism ?? 0.5,
      domainExpertise: config.domainExpertise ?? new Map(),
    }

    // 初始化一些模拟历史案例
    this.initializeHistoricalCases()
  }

  /**
   * 预测成功率
   */
  async predict(
    officeAction: OfficeAction,
    strategy: ResponseStrategy,
    claimsQuality: number,
    additionalContext?: Partial<PredictionFeatures>
  ): Promise<PredictionResult> {
    console.log('\n🎯 [成功率预测器] 开始预测...')

    // 1. 提取特征
    const features = await this.extractFeatures(
      officeAction,
      strategy,
      claimsQuality,
      additionalContext
    )

    // 2. 基于规则的基础预测
    const ruleBasedScore = this.ruleBasedPrediction(features)

    // 3. 基于历史案例的预测
    const caseBasedScore = this.caseBasedPrediction(features)

    // 4. LLM 增强预测
    const llmBasedScore = await this.llmBasedPrediction(features)

    // 5. 集成预测（加权平均）
    const weights = {
      rules: 0.3,
      cases: 0.4,
      llm: 0.3,
    }

    let finalProbability =
      ruleBasedScore * weights.rules +
      caseBasedScore * weights.cases +
      llmBasedScore * weights.llm

    // 应用保守程度调整
    finalProbability = this.applyConservatism(finalProbability, features)

    // 6. 计算置信区间
    const confidenceInterval = this.calculateConfidenceInterval(
      finalProbability,
      features
    )

    // 7. 特征重要性分析
    const featureImportance = this.analyzeFeatureImportance(features)

    // 8. 生成分析报告
    const analysis = await this.generateAnalysis(features, finalProbability)

    // 9. 与基准对比
    const comparison = this.compareToBaseline(features, finalProbability)

    console.log(`   ✅ 预测成功率: ${finalProbability.toFixed(2)}%`)
    console.log(`   📊 置信区间: [${confidenceInterval.lower.toFixed(2)}%, ${confidenceInterval.upper.toFixed(2)}%]`)

    return {
      successProbability: finalProbability,
      confidenceInterval,
      featureImportance,
      analysis,
      comparison,
    }
  }

  /**
   * 提取特征
   */
  private async extractFeatures(
    officeAction: OfficeAction,
    strategy: ResponseStrategy,
    claimsQuality: number,
    additionalContext?: Partial<PredictionFeatures>
  ): Promise<PredictionFeatures> {
    // 评估驳回严重程度
    const severity = this.assessSeverity(officeAction)

    return {
      oaFeatures: {
        type: officeAction.oa_type,
        severity,
        affectedClaimsCount: officeAction.affected_claims.length,
        citationsCount: officeAction.citations.length,
        examinerArgumentLength: officeAction.examiner_arguments.length,
      },
      strategyFeatures: {
        type: strategy.strategy_type,
        confidence: strategy.confidence,
        argumentsCount: 3, // 默认值，实际应从策略中提取
        amendmentCount: strategy.strategy_type === 'AmendClaims' ? 5 : 0,
      },
      claimsQualityFeatures: {
        clarityScore: claimsQuality,
        supportScore: claimsQuality * 0.95, // 简化处理
        scopeScore: claimsQuality * 0.9,
        overallScore: claimsQuality,
        issuesCount: Math.floor((100 - claimsQuality) / 10),
      },
      technicalFeatures: additionalContext?.technicalFeatures ?? {
        domain: 'Unknown',
        complexity: 'medium',
      },
      temporalFeatures: additionalContext?.temporalFeatures ?? {
        responseDelay: 30,
        examinationDuration: 12,
      },
    }
  }

  /**
   * 基于规则的预测
   */
  private ruleBasedPrediction(features: PredictionFeatures): number {
    let score = 50 // 基础分

    // 1. 驳回类型影响（权重：30%）
    const baselineRate = this.baselineSuccessRates[features.oaFeatures.type] ?? 50
    score += (baselineRate - 50) * 0.3

    // 2. 严重程度影响（权重：20%）
    const severityImpact = { low: 15, medium: 0, high: -20 }
    score += severityImpact[features.oaFeatures.severity] * 0.2

    // 3. 答复策略影响（权重：25%）
    const strategyImpact = {
      AmendClaims: 15,
      Argue: 5,
      Hybrid: 10,
      Withdraw: -50,
    }
    score += strategyImpact[features.strategyFeatures.type] * 0.25

    // 4. 权利要求质量影响（权重：25%）
    const qualityImpact = (features.claimsQualityFeatures.overallScore - 70) * 0.5
    score += qualityImpact * 0.25

    return Math.max(10, Math.min(95, score))
  }

  /**
   * 基于历史案例的预测
   */
  private caseBasedPrediction(features: PredictionFeatures): number {
    if (!this.config.useHistoricalData || this.historicalCases.length === 0) {
      return 50 // 默认值
    }

    // 找到相似案例
    const similarCases = this.findSimilarCases(features, 5)

    if (similarCases.length === 0) {
      return 50
    }

    // 计算成功率
    const successCount = similarCases.filter((c) => c.outcome === 'success').length
    const successRate = (successCount / similarCases.length) * 100

    // 考虑案例相似度权重
    const weightedScore = similarCases.reduce((sum, case_) => {
      const similarity = this.calculateSimilarity(features, case_.features)
      const outcomeScore = case_.outcome === 'success' ? 100 : 0
      return sum + outcomeScore * similarity
    }, 0) / similarCases.length

    return weightedScore
  }

  /**
   * 基于 LLM 的预测
   */
  private async llmBasedPrediction(features: PredictionFeatures): Promise<number> {
    const prompt = `你是一位资深的专利代理人，请预测以下专利答复的成功率。

审查意见类型：${features.oaFeatures.type}
严重程度：${features.oaFeatures.severity}
受影响权利要求数量：${features.oaFeatures.affectedClaimsCount}

答复策略：${features.strategyFeatures.type}
策略置信度：${features.strategyFeatures.confidence}

权利要求质量评分：${features.claimsQualityFeatures.overallScore}

请给出成功率预测（0-100），并简要说明理由。`

    try {
      const response = await this.llm.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      })

      const content = response.message.content as string
      const scoreMatch = content.match(/(\d+)/)
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50

      return Math.max(10, Math.min(95, score))
    } catch {
      return 50 // LLM 调用失败时返回默认值
    }
  }

  /**
   * 应用保守程度调整
   */
  private applyConservatism(
    probability: number,
    features: PredictionFeatures
  ): number {
    const conservatism = this.config.conservatism

    // 保守模式下，降低高概率预测
    if (conservatism > 0.5 && probability > 70) {
      const adjustment = (conservatism - 0.5) * 20
      return probability - adjustment
    }

    // 激进模式下，提高低概率预测
    if (conservatism < 0.5 && probability < 50) {
      const adjustment = (0.5 - conservatism) * 15
      return probability + adjustment
    }

    return probability
  }

  /**
   * 计算置信区间
   */
  private calculateConfidenceInterval(
    probability: number,
    features: PredictionFeatures
  ): { lower: number; upper: number } {
    // 基于特征质量计算置信度
    let variance = 15 // 基础方差

    // 权利要求质量越高，置信度越高
    variance -= (features.claimsQualityFeatures.overallScore - 70) * 0.1

    // 策略置信度越高，置信度越高
    variance -= (features.strategyFeatures.confidence - 0.7) * 5

    variance = Math.max(5, Math.min(25, variance))

    return {
      lower: Math.max(0, probability - variance),
      upper: Math.min(100, probability + variance),
    }
  }

  /**
   * 特征重要性分析
   */
  private analyzeFeatureImportance(
    features: PredictionFeatures
  ): Array<{ feature: string; importance: number; impact: 'positive' | 'negative' }> {
    const importance: Array<{ feature: string; importance: number; impact: 'positive' | 'negative' }> = []

    // 1. 驳回类型
    const baselineRate = this.baselineSuccessRates[features.oaFeatures.type] ?? 50
    importance.push({
      feature: '驳回类型',
      importance: Math.abs(baselineRate - 50),
      impact: baselineRate > 50 ? 'positive' : 'negative',
    })

    // 2. 答复策略
    const strategyImpact = {
      AmendClaims: 15,
      Argue: 5,
      Hybrid: 10,
      Withdraw: -50,
    }
    const strategyValue = strategyImpact[features.strategyFeatures.type]
    importance.push({
      feature: '答复策略',
      importance: Math.abs(strategyValue),
      impact: strategyValue > 0 ? 'positive' : 'negative',
    })

    // 3. 权利要求质量
    const qualityScore = features.claimsQualityFeatures.overallScore
    importance.push({
      feature: '权利要求质量',
      importance: Math.abs(qualityScore - 70),
      impact: qualityScore > 70 ? 'positive' : 'negative',
    })

    // 4. 严重程度
    const severityValue = { low: 15, medium: 0, high: -20 }[features.oaFeatures.severity]
    importance.push({
      feature: '驳回严重程度',
      importance: Math.abs(severityValue),
      impact: severityValue > 0 ? 'positive' : 'negative',
    })

    // 按重要性排序
    importance.sort((a, b) => b.importance - a.importance)

    return importance.slice(0, 5)
  }

  /**
   * 生成分析报告
   */
  private async generateAnalysis(
    features: PredictionFeatures,
    probability: number
  ): Promise<{ strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    const strengths: string[] = []
    const weaknesses: string[] = []
    const recommendations: string[] = []

    // 分析优势
    if (features.claimsQualityFeatures.overallScore >= 80) {
      strengths.push('权利要求质量优秀')
    }
    if (features.strategyFeatures.type === 'AmendClaims') {
      strengths.push('采用修改策略，通常成功率高')
    }
    if (features.oaFeatures.severity === 'low') {
      strengths.push('驳回问题严重程度较低')
    }

    // 分析劣势
    if (features.claimsQualityFeatures.overallScore < 60) {
      weaknesses.push('权利要求质量需要改进')
    }
    if (features.oaFeatures.severity === 'high') {
      weaknesses.push('驳回问题严重程度较高')
    }
    if (features.strategyFeatures.confidence < 0.6) {
      weaknesses.push('答复策略置信度较低')
    }

    // 生成建议
    if (probability < 50) {
      recommendations.push('建议重新评估答复策略')
      recommendations.push('考虑缩小权利要求保护范围')
    } else if (probability < 70) {
      recommendations.push('建议加强权利要求修改')
      recommendations.push('补充技术效果的论证')
    } else {
      recommendations.push('当前策略良好，建议继续完善细节')
    }

    return { strengths, weaknesses, recommendations }
  }

  /**
   * 与基准对比
   */
  private compareToBaseline(
    features: PredictionFeatures,
    probability: number
  ): { baseline: number; improvement: number; percentile: string } {
    const baseline = this.baselineSuccessRates[features.oaFeatures.type] ?? 50
    const improvement = probability - baseline

    let percentile = 'average'
    if (improvement > 20) percentile = 'top 20%'
    else if (improvement > 10) percentile = 'top 40%'
    else if (improvement < -10) percentile = 'bottom 40%'
    else if (improvement < -20) percentile = 'bottom 20%'

    return { baseline, improvement, percentile }
  }

  /**
   * 评估驳回严重程度
   */
  private assessSeverity(officeAction: OfficeAction): 'low' | 'medium' | 'high' {
    // 基于多个因素评估严重程度
    let severityScore = 0

    // 受影响权利要求数量
    severityScore += Math.min(officeAction.affected_claims.length * 5, 20)

    // 引用文献数量
    severityScore += Math.min(officeAction.citations.length * 3, 15)

    // 审查员论点长度
    severityScore += Math.min(officeAction.examiner_arguments.length / 100, 15)

    // 驳回类型
    const typeSeverity: Record<string, number> = {
      'Novelty': 25,
      'InventiveStep': 30,
      'Clarity': 15,
      'Support': 20,
      'Formality': 5,
    }
    severityScore += typeSeverity[officeAction.oa_type] || 20

    // 确定严重程度
    if (severityScore < 30) return 'low'
    if (severityScore < 50) return 'medium'
    return 'high'
  }

  /**
   * 初始化历史案例（模拟数据）
   */
  private initializeHistoricalCases(): void {
    // 这里应该是从数据库加载真实的历史案例
    // 目前使用模拟数据
    this.historicalCases = [
      {
        oaType: 'Novelty',
        strategyType: 'AmendClaims',
        claimsQuality: 85,
        outcome: 'success',
        features: {} as PredictionFeatures,
      },
      {
        oaType: 'InventiveStep',
        strategyType: 'Hybrid',
        claimsQuality: 75,
        outcome: 'success',
        features: {} as PredictionFeatures,
      },
      // ... 更多案例
    ]
  }

  /**
   * 查找相似案例
   */
  private findSimilarCases(features: PredictionFeatures, topK: number): HistoricalCase[] {
    const casesWithSimilarity = this.historicalCases.map((case_) => ({
      case: case_,
      similarity: this.calculateSimilarity(features, case_.features),
    }))

    casesWithSimilarity.sort((a, b) => b.similarity - a.similarity)

    return casesWithSimilarity.slice(0, topK).map((item) => item.case)
  }

  /**
   * 计算特征相似度
   */
  private calculateSimilarity(
    features1: PredictionFeatures,
    features2: PredictionFeatures
  ): number {
    let similarity = 0

    // 驳回类型相似度
    if (features1.oaFeatures.type === features2.oaFeatures.type) {
      similarity += 0.3
    }

    // 策略类型相似度
    if (features1.strategyFeatures.type === features2.strategyFeatures.type) {
      similarity += 0.3
    }

    // 质量分数相似度
    const qualityDiff = Math.abs(
      features1.claimsQualityFeatures.overallScore -
      features2.claimsQualityFeatures.overallScore
    )
    similarity += (1 - qualityDiff / 100) * 0.2

    // 严重程度相似度
    if (features1.oaFeatures.severity === features2.oaFeatures.severity) {
      similarity += 0.2
    }

    return similarity
  }

  /**
   * 敏感性分析：分析哪些因素对成功率影响最大
   */
  async sensitivityAnalysis(
    officeAction: OfficeAction,
    strategy: ResponseStrategy,
    claimsQuality: number
  ): Promise<Array<{ factor: string; impact: number }>> {
    const basePrediction = await this.predict(officeAction, strategy, claimsQuality)
    const baseScore = basePrediction.successProbability

    const sensitivities: Array<{ factor: string; impact: number }> = []

    // 测试不同策略的影响
    for (const strategyType of ['AmendClaims', 'Argue', 'Hybrid'] as const) {
      const testStrategy: ResponseStrategy = {
        ...strategy,
        strategy_type: strategyType,
      }
      const testPrediction = await this.predict(officeAction, testStrategy, claimsQuality)
      sensitivities.push({
        factor: `策略: ${strategyType}`,
        impact: testPrediction.successProbability - baseScore,
      })
    }

    // 测试不同质量分数的影响
    for (const qualityDelta of [-10, 10]) {
      const testPrediction = await this.predict(
        officeAction,
        strategy,
        Math.max(0, Math.min(100, claimsQuality + qualityDelta))
      )
      sensitivities.push({
        factor: `质量分数: ${claimsQuality + qualityDelta}`,
        impact: testPrediction.successProbability - baseScore,
      })
    }

    // 按影响程度排序
    sensitivities.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))

    return sensitivities.slice(0, 5)
  }
}
