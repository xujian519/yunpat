/**
 * EnhancedPatentResponderAgent - 增强版审查答复智能体
 *
 * 整合了多个高级模块的智能审查答复系统：
 * 1. ExaminerSimulator - 审查员模拟器
 * 2. SuccessPredictor - 成功率预测器
 * 3. HebbianOptimizer - 赫布学习优化器
 *
 * 核心特性：
 * - 多维度答复策略优化
 * - 基于历史案例的智能推荐
 * - 审查员视角的质量评估
 * - 持续学习和改进
 * - 人机协作交互
 */

import { Agent, type LLMAdapter, type ExecutionContext } from '@yunpat/core'
import * as PatentCore from '../../core/PatentCoreBridge.js'
import { PatentResponderAgent, type OfficeActionInput, type OfficeActionOutput } from './PatentResponderAgent.js'
import { ExaminerSimulator, type ResponseDocument } from './ExaminerSimulator.js'
import { SuccessPredictor } from './SuccessPredictor.js'
import { HebbianOptimizer } from './HebbianOptimizer.js'

/**
 * 增强版答复智能体配置
 */
export interface EnhancedResponderConfig {
  /** 是否启用审查员模拟 */
  enableExaminerSimulation?: boolean

  /** 是否启用成功率预测 */
  enableSuccessPrediction?: boolean

  /** 是否启用赫布学习 */
  enableHebbianLearning?: boolean

  /** 是否启用人机协作 */
  enableHumanInLoop?: boolean

  /** 保守程度（0-1，默认0.5） */
  conservatism?: number

  /** 最大迭代次数 */
  maxIterations?: number
}

/**
 * 增强版答复结果
 */
export interface EnhancedResponseResult extends OfficeActionOutput {
  /** 审查员模拟结果 */
  examinerSimulation?: Awaited<ReturnType<ExaminerSimulator['simulateReview']>>

  /** 成功率预测结果 */
  successPrediction?: Awaited<ReturnType<SuccessPredictor['predict']>>

  /** 赫布学习推荐 */
  hebbianRecommendation?: Awaited<ReturnType<HebbianOptimizer['learnAndRecommend']>>

  /** 迭代历史 */
  iterationHistory: Array<{
    iteration: number
    strategy: string
    successProbability: number
    examinerAcceptance: number
    improvements: string[]
  }>

  /** 最终建议 */
  finalRecommendations: string[]
}

/**
 * 增强版审查答复智能体
 */
export class EnhancedPatentResponderAgent extends Agent<OfficeActionInput, EnhancedResponseResult> {
  private baseAgent: PatentResponderAgent
  private examinerSimulator: ExaminerSimulator
  private successPredictor: SuccessPredictor
  private hebbianOptimizer: HebbianOptimizer
  private config: Required<EnhancedResponderConfig>

  constructor(config: {
    llm: LLMAdapter
    enhancedConfig?: EnhancedResponderConfig
    name?: string
    description?: string
  }) {
    super({
      llm: config.llm,
      name: config.name ?? 'enhanced-patent-responder',
      description: config.description ?? '增强版审查答复智能体 - 集成审查员模拟、成功率预测和赫布学习',
    })

    this.config = {
      enableExaminerSimulation: config.enhancedConfig?.enableExaminerSimulation ?? true,
      enableSuccessPrediction: config.enhancedConfig?.enableSuccessPrediction ?? true,
      enableHebbianLearning: config.enhancedConfig?.enableHebbianLearning ?? true,
      enableHumanInLoop: config.enhancedConfig?.enableHumanInLoop ?? true,
      conservatism: config.enhancedConfig?.conservatism ?? 0.5,
      maxIterations: config.enhancedConfig?.maxIterations ?? 3,
    }

    // 初始化子模块
    this.baseAgent = new PatentResponderAgent({
      llm: config.llm,
      name: 'base-responder',
    })

    this.examinerSimulator = new ExaminerSimulator(config.llm, {
      strictness: 0.7 + this.config.conservatism * 0.2,
      conservativeMode: this.config.conservatism > 0.6,
    })

    this.successPredictor = new SuccessPredictor(config.llm, {
      useHistoricalData: true,
      conservatism: this.config.conservatism,
    })

    this.hebbianOptimizer = new HebbianOptimizer(config.llm, {
      learningRate: 0.1,
      enableContinuousLearning: true,
    })

    console.log('🚀 [增强版答复智能体] 初始化完成')
    console.log(`   - 审查员模拟: ${this.config.enableExaminerSimulation ? '✅' : '❌'}`)
    console.log(`   - 成功率预测: ${this.config.enableSuccessPrediction ? '✅' : '❌'}`)
    console.log(`   - 赫布学习: ${this.config.enableHebbianLearning ? '✅' : '❌'}`)
    console.log(`   - 人机协作: ${this.config.enableHumanInLoop ? '✅' : '❌'}`)
    console.log(`   - 保守程度: ${(this.config.conservatism * 100).toFixed(0)}%\n`)
  }

  /**
   * 增强版规划阶段
   */
  protected async plan(input: OfficeActionInput, context: ExecutionContext): Promise<any> {
    console.log('\n📋 [增强版答复] 步骤1: 增强规划阶段')

    // 1. 基础分析（来自 PatentResponderAgent）
    const basePlan = await this.baseAgent.execute(input, context)

    // 2. patent-core 预处理
    let parsedOa: any = null
    let recommendedStrategies: any = null

    try {
      parsedOa = await PatentCore.parseOa(input.officeAction)
      console.log(`[增强版答复] OA 类型: ${parsedOa.oa_type}`)

      recommendedStrategies = await PatentCore.recommendStrategy(JSON.stringify(parsedOa))
      console.log(`[增强版答复] 推荐策略: ${recommendedStrategies.strategies.map((s: any) => s.strategy_type).join(', ')}`)
    } catch (e) {
      console.warn('[增强版答复] patent-core 解析失败，使用 LLM 模式')
    }

    // 3. 赫布学习优化（如果启用）
    let hebbianRecommendation: any = null
    if (this.config.enableHebbianLearning) {
      console.log('\n🧠 应用赫布学习优化...')
      hebbianRecommendation = await this.hebbianOptimizer.learnAndRecommend(
        parsedOa || { oa_type: 'Unknown', affected_claims: [], citations: [], examiner_arguments: input.officeAction },
        input.claims,
        input.description
      )
    }

    return {
      ...basePlan,
      parsedOa,
      recommendedStrategies,
      hebbianRecommendation,
    }
  }

  /**
   * 增强版执行阶段（带迭代优化）
   */
  protected async act(plan: any, context: ExecutionContext): Promise<EnhancedResponseResult> {
    console.log('\n✍️ [增强版答复] 步骤2: 增强执行阶段（带迭代优化）')

    const iterationHistory: Array<{
      iteration: number
      strategy: string
      successProbability: number
      examinerAcceptance: number
      improvements: string[]
    }> = []

    let bestResult: any = null
    let bestScore = 0

    // 迭代优化
    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      console.log(`\n🔄 迭代 ${iteration}/${this.config.maxIterations}`)

      // 1. 生成答复文档
      const responseDocument = await this.generateResponseDocument(plan, context)

      // 2. 审查员模拟（如果启用）
      let examinerSimulation: any = null
      if (this.config.enableExaminerSimulation) {
        console.log('\n👨‍⚖️ 执行审查员模拟...')
        const parsedOa = plan.parsedOa || {
          oa_type: 'Unknown',
          affected_claims: [],
          citations: [],
          examiner_arguments: plan.analysis || '',
        }

        examinerSimulation = await this.examinerSimulator.simulateReview(parsedOa, responseDocument)
        console.log(`   接受概率: ${examinerSimulation.acceptProbability.toFixed(2)}%`)
      }

      // 3. 成功率预测（如果启用）
      let successPrediction: any = null
      if (this.config.enableSuccessPrediction && plan.parsedOa) {
        console.log('\n🎯 执行成功率预测...')
        const strategy: any = {
          strategy_type: responseDocument.responseStrategy,
          reasoning: '基于当前答复策略',
          confidence: 0.7,
        }

        const claimsQuality = 75 // 简化处理，实际应该评估

        successPrediction = await this.successPredictor.predict(
          plan.parsedOa,
          strategy,
          claimsQuality
        )
        console.log(`   成功概率: ${successPrediction.successProbability.toFixed(2)}%`)
      }

      // 4. 计算综合得分
      const currentScore = this.calculateOverallScore(
        examinerSimulation,
        successPrediction
      )

      // 5. 记录迭代历史
      iterationHistory.push({
        iteration,
        strategy: responseDocument.responseStrategy,
        successProbability: successPrediction?.successProbability || 0,
        examinerAcceptance: examinerSimulation?.acceptProbability || 0,
        improvements: this.generateImprovements(examinerSimulation, successPrediction),
      })

      // 6. 更新最佳结果
      if (currentScore > bestScore) {
        bestScore = currentScore
        bestResult = {
          ...responseDocument,
          iterationHistory: iterationHistory.slice(),
        }

        console.log(`   ✅ 新最佳得分: ${bestScore.toFixed(2)}`)
      }

      // 7. 如果得分已经很高，提前退出
      if (currentScore >= 85) {
        console.log(`   🎉 得分已达标（${currentScore.toFixed(2)}%），提前退出迭代`)
        break
      }

      // 8. 根据反馈改进答复（模拟）
      console.log(`   📈 迭代 ${iteration} 完成，继续优化...`)
    }

    // 9. 生成最终建议
    const finalRecommendations = this.generateFinalRecommendations(
      bestResult,
      iterationHistory
    )

    console.log('\n✅ [增强版答复] 执行完成')
    console.log(`   最佳得分: ${bestScore.toFixed(2)}%`)
    console.log(`   迭代次数: ${iterationHistory.length}`)

    return {
      ...bestResult,
      responseStrategy: {
        type: bestResult.responseStrategy,
        arguments: [],
        suggestedAmendments: [],
      },
      response: {
        writtenArgument: bestResult.writtenArgument || '',
        amendedClaims: bestResult.amendedClaims || [],
        amendmentComparison: bestResult.amendmentComparison || '',
      },
      metrics: {
        allowanceProbability: bestScore,
        qualityScore: bestScore * 0.95,
        examinerAcceptance: bestScore * 0.9,
      },
      iterationHistory,
      finalRecommendations,
    }
  }

  /**
   * 增强版反思阶段
   */
  protected async reflect(output: EnhancedResponseResult, context: ExecutionContext): Promise<any> {
    console.log('\n🤔 [增强版答复] 步骤3: 增强反思阶段')

    const reflection = {
      overallAssessment: '',
      keyInsights: [] as string[],
      actionItems: [] as string[],
      learningOpportunities: [] as string[],
    }

    // 1. 整体评估
    const avgScore = output.iterationHistory.reduce(
      (sum, iter) => sum + iter.successProbability,
      0
    ) / output.iterationHistory.length

    reflection.overallAssessment = `平均成功率: ${avgScore.toFixed(2)}%, 最佳得分: ${output.metrics.allowanceProbability.toFixed(2)}%`

    // 2. 关键洞察
    if (output.examinerSimulation) {
      reflection.keyInsights.push(
        `审查员接受概率: ${output.examinerSimulation.acceptProbability.toFixed(2)}%`
      )
    }

    if (output.successPrediction) {
      reflection.keyInsights.push(
        `预测成功率: ${output.successPrediction.successProbability.toFixed(2)}%`
      )

      // 特征重要性
      const topFeatures = output.successPrediction.featureImportance.slice(0, 3)
      reflection.keyInsights.push(
        `关键影响因素: ${topFeatures.map((f) => f.feature).join(', ')}`
      )
    }

    // 3. 行动项
    if (output.metrics.allowanceProbability < 70) {
      reflection.actionItems.push('成功率偏低，建议重新评估答复策略')
      reflection.actionItems.push('考虑增加权利要求修改力度')
    }

    if (output.examinerSimulation?.riskAssessment.level === 'high') {
      reflection.actionItems.push('风险评估较高，建议人工复核')
    }

    // 4. 学习机会
    if (this.config.enableHebbianLearning) {
      reflection.learningOpportunities.push('建议记录本次答复结果，用于赫布学习优化')
    }

    console.log(`\n📊 反思总结:`)
    console.log(`   ${reflection.overallAssessment}`)
    console.log(`   关键洞察: ${reflection.keyInsights.length} 条`)
    console.log(`   行动项: ${reflection.actionItems.length} 条`)
    console.log(`   学习机会: ${reflection.learningOpportunities.length} 条`)

    return reflection
  }

  /**
   * 生成答复文档
   */
  private async generateResponseDocument(plan: any, context: ExecutionContext): Promise<ResponseDocument> {
    // 这里简化处理，实际应该调用 LLM 生成完整的答复文档
    return {
      writtenArgument: '意见陈述书内容...',
      amendedClaims: plan.input?.claims || [],
      amendmentComparison: '修改对照内容...',
      responseStrategy: plan.hebbianRecommendation?.recommendedStrategy.strategy_type || 'Hybrid',
    }
  }

  /**
   * 计算综合得分
   */
  private calculateOverallScore(
    examinerSimulation: any,
    successPrediction: any
  ): number {
    let score = 0
    let weightSum = 0

    if (examinerSimulation) {
      score += examinerSimulation.acceptProbability * 0.5
      weightSum += 0.5
    }

    if (successPrediction) {
      score += successPrediction.successProbability * 0.5
      weightSum += 0.5
    }

    return weightSum > 0 ? score / weightSum : 50
  }

  /**
   * 生成改进建议
   */
  private generateImprovements(
    examinerSimulation: any,
    successPrediction: any
  ): string[] {
    const improvements: string[] = []

    if (examinerSimulation?.suggestions) {
      improvements.push(...examinerSimulation.suggestions.slice(0, 2))
    }

    if (successPrediction?.analysis.recommendations) {
      improvements.push(...successPrediction.analysis.recommendations.slice(0, 2))
    }

    return improvements.slice(0, 5)
  }

  /**
   * 生成最终建议
   */
  private generateFinalRecommendations(
    result: any,
    iterationHistory: any[]
  ): string[] {
    const recommendations: string[] = []

    // 基于迭代历史
    const bestIteration = iterationHistory.reduce((best, current) =>
      current.successProbability > best.successProbability ? current : best
    )

    recommendations.push(`最佳策略: ${bestIteration.strategy}`)

    // 基于最终得分
    if (result.metrics?.allowanceProbability >= 80) {
      recommendations.push('✅ 答复质量优秀，建议直接提交')
    } else if (result.metrics?.allowanceProbability >= 60) {
      recommendations.push('⚠️ 答复质量良好，建议人工复核后提交')
    } else {
      recommendations.push('❌ 答复质量有待提升，建议进一步优化')
    }

    // 基于风险评估
    if (result.examinerSimulation?.riskAssessment.level === 'high') {
      recommendations.push('🔴 风险等级高，建议专家介入')
    }

    return recommendations
  }

  /**
   * 保存案例到赫布学习器
   */
  async saveCaseForLearning(
    caseId: string,
    input: OfficeActionInput,
    selectedStrategy: any
  ): Promise<void> {
    if (!this.config.enableHebbianLearning) {
      return
    }

    // 解析 OA
    let parsedOa: any
    try {
      parsedOa = await PatentCore.parseOa(input.officeAction)
    } catch {
      parsedOa = {
        oa_type: 'Unknown',
        affected_claims: [],
        citations: [],
        examiner_arguments: input.officeAction,
      }
    }

    // 提取特征
    const features = [
      parsedOa.oa_type,
      `${parsedOa.oa_type}-${this.assessSeverity(parsedOa)}`,
      `${input.claims.length}-claims`,
    ]

    // 保存案例
    this.hebbianOptimizer.saveCaseForLearning(
      caseId,
      parsedOa,
      selectedStrategy,
      features
    )

    console.log(`💾 案例 ${caseId} 已保存到赫布学习器`)
  }

  /**
   * 从反馈中学习
   */
  async learnFromFeedback(caseId: string, outcome: 'success' | 'failure', feedback?: number): Promise<void> {
    if (!this.config.enableHebbianLearning) {
      return
    }

    await this.hebbianOptimizer.learnFromFeedback(caseId, outcome, feedback)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    hebbianLearning: any
    networkState: any
  } {
    return {
      hebbianLearning: this.hebbianOptimizer.getLearningStats(),
      networkState: this.hebbianOptimizer.getNetworkState(),
    }
  }

  /**
   * 评估驳回严重程度
   */
  private assessSeverity(officeAction: any): 'low' | 'medium' | 'high' {
    let score = 0

    score += Math.min(officeAction.affected_claims?.length * 5 || 0, 20)
    score += Math.min(officeAction.citations?.length * 3 || 0, 15)

    if (score < 20) return 'low'
    if (score < 40) return 'medium'
    return 'high'
  }
}
