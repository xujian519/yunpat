/**
 * 答复策略推荐器
 *
 * 基于以下因素生成最佳答复策略：
 * 1. 审查意见分析结果
 * 2. 历史成功案例
 * 3. 用户偏好
 * 4. 风险评估
 * 5. 成功概率预测
 *
 * @module strategy/StrategyRecommender
 */

import type {
  OAParseResult,
  RejectionReason,
  StrategyRecommendation,
  ResponseArgument,
  AmendmentSuggestion,
  HistoricalCase,
} from '../types/index.js'
import { ResponseStrategy, RejectionType, Severity } from '../types/index.js'

/**
 * 策略推荐器配置
 */
export interface StrategyRecommenderConfig {
  /** 默认策略偏好 */
  defaultPreference?: 'aggressive' | 'moderate' | 'conservative'
  /** 是否启用历史案例学习 */
  enableCaseBasedLearning?: boolean
  /** 最小案例相似度阈值 */
  minCaseSimilarity?: number
  /** 最大参考案例数量 */
  maxReferenceCases?: number
  /** 风险容忍度 (0-1) */
  riskTolerance?: number
}

/**
 * 策略评分结果
 */
interface StrategyScore {
  strategy: ResponseStrategy
  score: number
  details: {
    baseScore: number
    rejectionMatch: number
    historicalSuccess: number
    riskAdjustment: number
    userPreference: number
  }
}

/**
 * 策略推荐器类
 */
export class StrategyRecommender {
  private config: Required<StrategyRecommenderConfig>
  private historicalCases: Map<string, HistoricalCase> = new Map()

  // 策略评分权重
  private readonly WEIGHTS = {
    baseScore: 0.3,
    rejectionMatch: 0.25,
    historicalSuccess: 0.2,
    riskAdjustment: 0.15,
    userPreference: 0.1,
  }

  // 驳回类型与最佳策略的映射
  private readonly REJECTION_STRATEGY_MAP: Record<RejectionType, ResponseStrategy[]> = {
    novelty: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    inventiveness: [ResponseStrategy.ARGUE, ResponseStrategy.AMEND, ResponseStrategy.BOTH],
    utility: [ResponseStrategy.AMEND, ResponseStrategy.ABANDON],
    support: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE],
    clarity: [ResponseStrategy.AMEND],
    scope: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE],
    amendment_scope: [ResponseStrategy.AMEND, ResponseStrategy.ABANDON],
    unity: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE],
    formality: [ResponseStrategy.AMEND],
    other: [ResponseStrategy.ARGUE, ResponseStrategy.AMEND],
  }

  constructor(config: StrategyRecommenderConfig = {}) {
    this.config = {
      defaultPreference: config.defaultPreference || 'moderate',
      enableCaseBasedLearning: config.enableCaseBasedLearning ?? true,
      minCaseSimilarity: config.minCaseSimilarity || 0.6,
      maxReferenceCases: config.maxReferenceCases || 5,
      riskTolerance: config.riskTolerance || 0.5,
    }
  }

  /**
   * 添加历史案例
   */
  addHistoricalCase(caseData: HistoricalCase): void {
    this.historicalCases.set(caseData.id, caseData)
  }

  /**
   * 批量添加历史案例
   */
  addHistoricalCases(cases: HistoricalCase[]): void {
    for (const caseData of cases) {
      this.historicalCases.set(caseData.id, caseData)
    }
  }

  /**
   * 生成策略推荐
   */
  async recommend(
    parseResult: OAParseResult,
    userPreference?: 'aggressive' | 'moderate' | 'conservative'
  ): Promise<StrategyRecommendation> {
    const preference = userPreference || this.config.defaultPreference

    // 1. 评估各策略的得分
    const strategyScores = await this.evaluateStrategies(parseResult, preference)

    // 2. 选择最佳策略
    const bestStrategy = this.selectBestStrategy(strategyScores)

    // 3. 生成关键论点
    const keyArguments = await this.generateKeyArguments(parseResult, bestStrategy.strategy)

    // 4. 生成修改建议
    const amendmentSuggestions = await this.generateAmendmentSuggestions(
      parseResult,
      bestStrategy.strategy
    )

    // 5. 识别风险
    const risks = this.identifyRisks(parseResult, bestStrategy.strategy, keyArguments)

    // 6. 生成替代策略
    const alternativeStrategies = this.generateAlternatives(strategyScores, bestStrategy.strategy)

    // 7. 查找相关案例
    const basedOnCases = this.findRelevantCases(parseResult, bestStrategy.strategy)

    // 8. 生成推荐理由
    const rationale = this.generateRationale(bestStrategy, parseResult, basedOnCases)

    return {
      strategy: bestStrategy.strategy,
      successProbability: bestStrategy.score,
      rationale,
      keyArguments,
      amendmentSuggestions,
      additionalEvidence: this.suggestAdditionalEvidence(parseResult, keyArguments),
      risks,
      alternativeStrategies,
      basedOnCases,
    }
  }

  /**
   * 评估各策略得分
   */
  private async evaluateStrategies(
    parseResult: OAParseResult,
    userPreference: 'aggressive' | 'moderate' | 'conservative'
  ): Promise<StrategyScore[]> {
    const strategies: ResponseStrategy[] = [
      ResponseStrategy.ARGUE,
      ResponseStrategy.AMEND,
      ResponseStrategy.BOTH,
      ResponseStrategy.ABANDON,
      ResponseStrategy.APPEAL,
    ]

    const scores: StrategyScore[] = []

    for (const strategy of strategies) {
      const score = await this.calculateStrategyScore(parseResult, strategy, userPreference)
      scores.push(score)
    }

    return scores.sort((a, b) => b.score - a.score)
  }

  /**
   * 计算单个策略的得分
   */
  private async calculateStrategyScore(
    parseResult: OAParseResult,
    strategy: ResponseStrategy,
    userPreference: 'aggressive' | 'moderate' | 'conservative'
  ): Promise<StrategyScore> {
    // 基础得分
    const baseScore = this.getBaseStrategyScore(strategy, userPreference)

    // 驳回理由匹配度
    const rejectionMatch = this.calculateRejectionMatch(parseResult.rejectionReasons, strategy)

    // 历史成功率
    const historicalSuccess = await this.calculateHistoricalSuccess(parseResult, strategy)

    // 风险调整
    const riskAdjustment = this.calculateRiskAdjustment(parseResult, strategy)

    // 用户偏好调整
    const userPreferenceScore = this.calculateUserPreferenceScore(strategy, userPreference)

    // 加权总分
    const totalScore =
      baseScore * this.WEIGHTS.baseScore +
      rejectionMatch * this.WEIGHTS.rejectionMatch +
      historicalSuccess * this.WEIGHTS.historicalSuccess +
      riskAdjustment * this.WEIGHTS.riskAdjustment +
      userPreferenceScore * this.WEIGHTS.userPreference

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
   * 获取策略基础得分
   */
  private getBaseStrategyScore(
    strategy: ResponseStrategy,
    userPreference: 'aggressive' | 'moderate' | 'conservative'
  ): number {
    const preferenceScores: Record<typeof userPreference, Record<ResponseStrategy, number>> = {
      aggressive: {
        argue: 85,
        amend: 60,
        both: 75,
        abandon: 20,
        appeal: 70,
      },
      moderate: {
        argue: 70,
        amend: 75,
        both: 80,
        abandon: 30,
        appeal: 50,
      },
      conservative: {
        argue: 50,
        amend: 85,
        both: 70,
        abandon: 50,
        appeal: 40,
      },
    }

    return preferenceScores[userPreference][strategy]
  }

  /**
   * 计算驳回理由匹配度
   */
  private calculateRejectionMatch(
    rejectionReasons: RejectionReason[],
    strategy: ResponseStrategy
  ): number {
    if (rejectionReasons.length === 0) {
      return 50
    }

    let totalScore = 0
    let weightSum = 0

    for (const reason of rejectionReasons) {
      // 权重基于严重程度
      const weight = reason.severity === 'high' ? 1.5 : reason.severity === 'medium' ? 1 : 0.5

      // 检查建议的应对方式是否匹配策略
      const suggestedMatch = this.isStrategyMatchingSuggestion(strategy, reason.suggestedResponse)

      // 检查策略类型是否适合驳回类型
      const typeMatch = this.isStrategySuitableForRejection(strategy, reason.type)

      const score = (suggestedMatch ? 80 : 40) * 0.6 + (typeMatch ? 90 : 50) * 0.4

      totalScore += score * weight
      weightSum += weight
    }

    return weightSum > 0 ? totalScore / weightSum : 50
  }

  /**
   * 检查策略是否匹配建议的应对方式
   */
  private isStrategyMatchingSuggestion(
    strategy: ResponseStrategy,
    suggested: 'argue' | 'amend' | 'both' | 'abandon'
  ): boolean {
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

  /**
   * 检查策略是否适合驳回类型
   */
  private isStrategySuitableForRejection(
    strategy: ResponseStrategy,
    rejectionType: RejectionType
  ): boolean {
    const suitableStrategies = this.REJECTION_STRATEGY_MAP[rejectionType] || []
    return suitableStrategies.includes(strategy)
  }

  /**
   * 计算历史成功率
   */
  private async calculateHistoricalSuccess(
    parseResult: OAParseResult,
    strategy: ResponseStrategy
  ): Promise<number> {
    if (!this.config.enableCaseBasedLearning || this.historicalCases.size === 0) {
      return 60 // 默认值
    }

    const relevantCases = this.findRelevantCases(parseResult, strategy)

    if (relevantCases.length === 0) {
      return 60
    }

    // 计算使用该策略的成功率
    const strategyCases = relevantCases.filter((caseId) => {
      const caseData = this.historicalCases.get(caseId)
      return caseData?.strategy === strategy
    })

    if (strategyCases.length === 0) {
      return 60
    }

    const successCount = strategyCases.filter((caseId) => {
      const caseData = this.historicalCases.get(caseId)
      return caseData?.outcome === 'success' || caseData?.outcome === 'partial_success'
    }).length

    return (successCount / strategyCases.length) * 100
  }

  /**
   * 计算风险调整
   */
  private calculateRiskAdjustment(parseResult: OAParseResult, strategy: ResponseStrategy): number {
    let riskScore = 100

    // 根据驳回理由的严重程度调整
    const highSeverityCount = parseResult.rejectionReasons.filter(
      (r) => r.severity === 'high'
    ).length
    if (highSeverityCount > 2) {
      riskScore -= 20
    } else if (highSeverityCount > 0) {
      riskScore -= 10
    }

    // 根据涉及的权利要求数量调整
    if (parseResult.affectedClaims.length > 5) {
      riskScore -= 15
    } else if (parseResult.affectedClaims.length > 3) {
      riskScore -= 8
    }

    // 根据策略类型调整
    if (strategy === ResponseStrategy.ABANDON) {
      riskScore -= 30 // 放弃策略风险较高
    } else if (strategy === ResponseStrategy.APPEAL) {
      riskScore -= 25 // 复审策略风险较高
    } else if (strategy === ResponseStrategy.BOTH) {
      riskScore -= 10 // 混合策略有一定风险
    }

    // 根据风险容忍度调整
    const toleranceFactor = (this.config.riskTolerance - 0.5) * 20
    riskScore += toleranceFactor

    return Math.max(20, Math.min(100, riskScore))
  }

  /**
   * 计算用户偏好得分
   */
  private calculateUserPreferenceScore(
    strategy: ResponseStrategy,
    userPreference: 'aggressive' | 'moderate' | 'conservative'
  ): number {
    const preferences: Record<typeof userPreference, Partial<Record<ResponseStrategy, number>>> = {
      aggressive: {
        argue: 100,
        both: 85,
        appeal: 80,
        amend: 60,
        abandon: 30,
      },
      moderate: {
        both: 100,
        amend: 90,
        argue: 80,
        appeal: 60,
        abandon: 40,
      },
      conservative: {
        amend: 100,
        both: 80,
        argue: 50,
        abandon: 60,
        appeal: 40,
      },
    }

    return preferences[userPreference][strategy] || 60
  }

  /**
   * 选择最佳策略
   */
  private selectBestStrategy(scores: StrategyScore[]): StrategyScore {
    // 排除放弃策略，除非它是唯一选项且得分很低
    const nonAbandonScores = scores.filter((s) => s.strategy !== ResponseStrategy.ABANDON)

    if (nonAbandonScores.length > 0 && nonAbandonScores[0].score > 30) {
      return nonAbandonScores[0]
    }

    return scores[0]
  }

  /**
   * 生成关键论点
   */
  private async generateKeyArguments(
    parseResult: OAParseResult,
    strategy: ResponseStrategy
  ): Promise<ResponseArgument[]> {
    const responseArguments: ResponseArgument[] = []

    for (const rejection of parseResult.rejectionReasons) {
      const argsForRejection = this.generateArgumentsForRejection(rejection, strategy, parseResult)
      responseArguments.push(...argsForRejection)
    }

    return responseArguments
  }

  /**
   * 为特定驳回理由生成论点
   */
  private generateArgumentsForRejection(
    rejection: RejectionReason,
    strategy: ResponseStrategy,
    parseResult: OAParseResult
  ): ResponseArgument[] {
    const args: ResponseArgument[] = []

    // 根据驳回类型和策略生成论点
    const argumentTemplates = this.getArgumentTemplates(rejection.type, strategy)

    for (const template of argumentTemplates) {
      const argument: ResponseArgument = {
        category: template.category,
        argument: this.customizeArgumentTemplate(template.template, rejection, parseResult),
        evidence: this.generateEvidence(rejection, parseResult),
        targetRejection: rejection.type,
        strength: template.strength || 3,
        precedents: this.findPrecedents(rejection, strategy),
      }

      args.push(argument)
    }

    return args
  }

  /**
   * 获取论点模板
   */
  private getArgumentTemplates(
    rejectionType: RejectionType,
    strategy: ResponseStrategy
  ): Array<{
    category: string
    template: string
    strength?: number
  }> {
    const templates: Record<
      RejectionType,
      Array<{ category: string; template: string; strength?: number }>
    > = {
      novelty: [
        {
          category: '区别技术特征',
          template:
            '本申请权利要求{claims}与{reference}相比，至少存在以下区别技术特征：{features}。这些区别技术特征在{reference}中并未公开，也不属于本领域技术人员的公知常识。',
          strength: 4,
        },
        {
          category: '技术效果',
          template: '上述区别技术特征带来了{effect}的技术效果，这是{reference}所未曾预期和实现的。',
          strength: 4,
        },
      ],
      inventiveness: [
        {
          category: '非显而易见性',
          template:
            '{reference}虽然公开了相似的技术方案，但并未给出将{features}应用于本申请技术领域以解决{problem}的技术启示。',
          strength: 4,
        },
        {
          category: '预料不到的技术效果',
          template:
            '本申请通过{features}的设置，实现了{effect}的技术效果，这对于本领域技术人员来说是预料不到的。',
          strength: 5,
        },
        {
          category: '技术障碍',
          template:
            '本领域技术人员在面对{problem}时，存在{obstacle}的技术障碍，而本申请通过{features}成功克服了该障碍。',
          strength: 4,
        },
      ],
      support: [
        {
          category: '充分公开',
          template:
            '说明书在{section}部分对{features}进行了详细描述，本领域技术人员根据说明书公开的内容能够实现该技术方案。',
          strength: 3,
        },
      ],
      clarity: [
        {
          category: '保护范围明确',
          template:
            '权利要求{claims}中{features}的表述是清晰的，其保护范围是明确的，本领域技术人员能够理解其含义。',
          strength: 3,
        },
      ],
      scope: [
        {
          category: '必要技术特征',
          template: '权利要求{claims}包含了实现{function}所需的全部必要技术特征，保护范围适当。',
          strength: 3,
        },
      ],
      unity: [
        {
          category: '单一发明构思',
          template:
            '各项权利要求属于同一个总的发明构思，因为它们都基于{concept}这一技术特征，解决了{problem}这一技术问题。',
          strength: 3,
        },
      ],
      formality: [
        {
          category: '形式问题修正',
          template: '已对权利要求{claims}中的形式问题进行修正，修正后的表述符合专利法要求。',
          strength: 2,
        },
      ],
      utility: [
        {
          category: '实用性',
          template: '本申请的技术方案能够制造和使用，并产生了积极效果，具备实用性。',
          strength: 3,
        },
      ],
      amendment_scope: [
        {
          category: '修改依据',
          template: '修改内容来源于说明书{section}的记载，未超出原说明书和权利要求书记载的范围。',
          strength: 3,
        },
      ],
      other: [
        {
          category: '一般性答辩',
          template: '针对审查员指出的问题，申请人认为...',
          strength: 2,
        },
      ],
    }

    return templates[rejectionType] || templates.other
  }

  /**
   * 自定义论点模板
   */
  private customizeArgumentTemplate(
    template: string,
    rejection: RejectionReason,
    parseResult: OAParseResult
  ): string {
    let customized = template

    // 替换权利要求占位符
    if (rejection.affectedClaims.length > 0) {
      customized = customized.replace('{claims}', rejection.affectedClaims.join(', '))
    } else {
      customized = customized.replace('{claims}', '相关')
    }

    // 替换引用文献占位符
    if (rejection.relatedReferences && rejection.relatedReferences.length > 0) {
      customized = customized.replace('{reference}', rejection.relatedReferences[0])
    } else if (parseResult.citedReferences.length > 0) {
      customized = customized.replace(
        '{reference}',
        parseResult.citedReferences[0].publicationNumber
      )
    }

    return customized
  }

  /**
   * 生成证据
   */
  private generateEvidence(rejection: RejectionReason, parseResult: OAParseResult): string[] {
    const evidence: string[] = []

    // 添加引用文献作为证据
    if (rejection.relatedReferences && rejection.relatedReferences.length > 0) {
      for (const ref of rejection.relatedReferences) {
        const refData = parseResult.citedReferences.find((r) => r.publicationNumber === ref)
        if (refData) {
          evidence.push(`对比文件${ref}: ${refData.title}`)
        }
      }
    }

    return evidence
  }

  /**
   * 查找先例
   */
  private findPrecedents(rejection: RejectionReason, strategy: ResponseStrategy): string[] {
    // 在实际实现中，这里会查询案例数据库
    return []
  }

  /**
   * 生成修改建议
   */
  private async generateAmendmentSuggestions(
    parseResult: OAParseResult,
    strategy: ResponseStrategy
  ): Promise<AmendmentSuggestion[]> {
    // 只在需要修改时生成建议
    if (strategy === ResponseStrategy.ARGUE) {
      return []
    }

    const suggestions: AmendmentSuggestion[] = []

    for (const rejection of parseResult.rejectionReasons) {
      // 根据驳回类型生成修改建议
      const amendment = this.generateAmendmentForRejection(rejection, parseResult)
      if (amendment) {
        suggestions.push(amendment)
      }
    }

    return suggestions
  }

  /**
   * 为特定驳回理由生成修改建议
   */
  private generateAmendmentForRejection(
    rejection: RejectionReason,
    parseResult: OAParseResult
  ): AmendmentSuggestion | null {
    // 根据驳回类型生成不同的修改建议
    switch (rejection.type) {
      case RejectionType.NOVELTY:
      case RejectionType.INVENTIVENESS:
        if (rejection.affectedClaims.length > 0) {
          return {
            claimNumber: rejection.affectedClaims[0],
            currentText: '（原文）',
            proposedText: '（添加区别技术特征）',
            reason: '通过添加区别技术特征来克服新颖性/创造性问题',
            amendmentType: 'modify',
            expectedEffect: '使权利要求与对比文件明确区分',
            addsNewMatter: false,
          }
        }
        break

      case RejectionType.CLARITY:
      case RejectionType.SCOPE:
        if (rejection.affectedClaims.length > 0) {
          return {
            claimNumber: rejection.affectedClaims[0],
            currentText: '（原文）',
            proposedText: '（进一步限定技术特征）',
            reason: '通过进一步限定来明确保护范围',
            amendmentType: 'modify',
            expectedEffect: '使权利要求的保护范围更加清晰明确',
            addsNewMatter: false,
          }
        }
        break

      case RejectionType.FORMALITY:
        return {
          claimNumber: 1,
          currentText: '（原文）',
          proposedText: '（修正后的表述）',
          reason: '修正形式缺陷',
          amendmentType: 'modify',
          expectedEffect: '符合专利法形式要求',
          addsNewMatter: false,
        }

      default:
        return null
    }

    return null
  }

  /**
   * 识别风险
   */
  private identifyRisks(
    parseResult: OAParseResult,
    strategy: ResponseStrategy,
    responseArguments: ResponseArgument[]
  ): string[] {
    const risks: string[] = []

    // 基于驳回理由的风险
    const highSeverityRejections = parseResult.rejectionReasons.filter((r) => r.severity === 'high')
    if (highSeverityRejections.length > 0) {
      risks.push(`存在${highSeverityRejections.length}项高严重程度驳回理由，可能较难克服`)
    }

    // 基于策略的风险
    if (strategy === ResponseStrategy.ARGUE) {
      const hasFormalityIssues = parseResult.rejectionReasons.some(
        (r) => r.type === RejectionType.FORMALITY
      )
      if (hasFormalityIssues) {
        risks.push('存在形式缺陷，建议一并修改')
      }
    } else if (strategy === ResponseStrategy.AMEND) {
      risks.push('修改可能导致保护范围缩小')
      risks.push('需要注意避免引入新事项')
    }

    // 基于涉及权利要求数量的风险
    if (parseResult.affectedClaims.length > 5) {
      risks.push('涉及权利要求数量较多，答复难度较大')
    }

    // 基于引用文献的风险
    if (parseResult.citedReferences.length > 3) {
      risks.push('引用对比文件较多，需要逐一针对性答辩')
    }

    return risks
  }

  /**
   * 生成替代策略
   */
  private generateAlternatives(
    scores: StrategyScore[],
    selectedStrategy: ResponseStrategy
  ): Array<{ strategy: ResponseStrategy; probability: number; rationale: string }> {
    return scores
      .filter((s) => s.strategy !== selectedStrategy && s.strategy !== ResponseStrategy.ABANDON)
      .slice(0, 2)
      .map((s) => ({
        strategy: s.strategy,
        probability: s.score,
        rationale: this.generateAlternativeRationale(s),
      }))
  }

  /**
   * 生成替代策略理由
   */
  private generateAlternativeRationale(score: StrategyScore): string {
    const rationaleParts: string[] = []

    if (score.details.rejectionMatch > 70) {
      rationaleParts.push('与驳回理由匹配度较高')
    }
    if (score.details.historicalSuccess > 70) {
      rationaleParts.push('历史成功率较高')
    }
    if (score.details.riskAdjustment > 70) {
      rationaleParts.push('风险较低')
    }

    return rationaleParts.length > 0 ? rationaleParts.join('；') : '可作为备选方案'
  }

  /**
   * 查找相关案例
   */
  private findRelevantCases(parseResult: OAParseResult, strategy: ResponseStrategy): string[] {
    if (!this.config.enableCaseBasedLearning || this.historicalCases.size === 0) {
      return []
    }

    const relevantCases: string[] = []

    for (const [id, caseData] of this.historicalCases) {
      // 计算相似度
      const similarity = this.calculateCaseSimilarity(parseResult, caseData)

      if (similarity >= this.config.minCaseSimilarity) {
        relevantCases.push(id)
      }
    }

    // 按相似度排序并返回前N个
    return relevantCases
      .sort((a, b) => {
        const similarityA = this.calculateCaseSimilarity(parseResult, this.historicalCases.get(a)!)
        const similarityB = this.calculateCaseSimilarity(parseResult, this.historicalCases.get(b)!)
        return similarityB - similarityA
      })
      .slice(0, this.config.maxReferenceCases)
  }

  /**
   * 计算案例相似度
   */
  private calculateCaseSimilarity(parseResult: OAParseResult, caseData: HistoricalCase): number {
    let similarity = 0
    let factors = 0

    // 驳回类型相似度
    const parseTypes = new Set(parseResult.rejectionTypes)
    const caseTypes = new Set(caseData.rejectionReasons.map((r) => r.type))
    const typeIntersection = [...parseTypes].filter((t) => caseTypes.has(t))
    const typeSimilarity = typeIntersection.length / Math.max(parseTypes.size, caseTypes.size)
    similarity += typeSimilarity * 0.4
    factors += 0.4

    // 权利要求数量相似度
    const claimCountDiff = Math.abs(
      parseResult.affectedClaims.length - caseData.grantedClaims?.length || 0
    )
    const claimSimilarity = Math.max(0, 1 - claimCountDiff / 10)
    similarity += claimSimilarity * 0.2
    factors += 0.2

    // 引用文献数量相似度
    const refCountDiff = Math.abs(
      parseResult.citedReferences.length - caseData.rejectionReasons.length
    )
    const refSimilarity = Math.max(0, 1 - refCountDiff / 5)
    similarity += refSimilarity * 0.2
    factors += 0.2

    // 技术领域相似度
    if (parseResult.patentTitle && caseData.technicalField) {
      // 简化的关键词匹配
      const titleWords = parseResult.patentTitle.split(/\s+/)
      const fieldWords = caseData.technicalField.split(/\s+/)
      const wordMatch = titleWords.filter((w) => fieldWords.includes(w)).length
      const fieldSimilarity = Math.min(1, wordMatch / 3)
      similarity += fieldSimilarity * 0.2
      factors += 0.2
    }

    return factors > 0 ? similarity / factors : 0
  }

  /**
   * 建议补充证据
   */
  private suggestAdditionalEvidence(
    parseResult: OAParseResult,
    responseArguments: ResponseArgument[]
  ): string[] {
    const evidence: string[] = []

    // 根据驳回类型建议证据
    for (const rejection of parseResult.rejectionReasons) {
      switch (rejection.type) {
        case RejectionType.INVENTIVENESS:
          evidence.push('补充实验数据证明技术效果')
          evidence.push('提供技术对比表格')
          break
        case RejectionType.NOVELTY:
          evidence.push('准备区别特征对比表')
          break
        case RejectionType.UTILITY:
          evidence.push('提供样品或试用报告')
          evidence.push('附上产业化证明材料')
          break
      }
    }

    return [...new Set(evidence)]
  }

  /**
   * 生成推荐理由
   */
  private generateRationale(
    strategyScore: StrategyScore,
    parseResult: OAParseResult,
    basedOnCases: string[]
  ): string {
    const parts: string[] = []

    // 策略说明
    const strategyNames: Record<ResponseStrategy, string> = {
      argue: '争辩策略',
      amend: '修改策略',
      both: '混合策略',
      abandon: '放弃策略',
      appeal: '复审策略',
    }

    parts.push(`推荐采用${strategyNames[strategyScore.strategy]}`)

    // 详细说明
    if (strategyScore.details.rejectionMatch > 75) {
      parts.push('，该策略与审查意见指出的驳回理由高度匹配')
    }

    if (strategyScore.details.historicalSuccess > 70 && basedOnCases.length > 0) {
      parts.push(`，基于${basedOnCases.length}个相似案例的分析，该策略具有较高的成功率`)
    }

    if (strategyScore.details.riskAdjustment > 70) {
      parts.push('，且风险可控')
    }

    return parts.join('') + '。'
  }
}

/**
 * 创建默认策略推荐器实例
 */
export function createStrategyRecommender(config?: StrategyRecommenderConfig): StrategyRecommender {
  return new StrategyRecommender(config)
}
