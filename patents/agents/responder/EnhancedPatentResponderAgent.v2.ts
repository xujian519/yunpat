/**
 * EnhancedPatentResponderAgent - 增强版审查答复智能体（重构版）
 *
 * 整合了多个高级模块的智能审查答复系统
 *
 * v2.0 更新：
 * - 使用 v2 版本的子模块
 * - 添加输入验证
 * - 结构化错误处理
 * - 集成日志系统
 * - 集成性能监控
 * - 使用常量管理
 */

// 导入基础设施
import type { LLMAdapter } from '../../core/llm-types.js'
import {
  OAResponderError,
  ValidationError,
} from '../../core/errors.js'
import {
  validateConfig,
} from '../../core/validators.js'
import {
  createModuleLogger,
  StructuredLogger,
} from '../../core/logger.js'
import { PerformanceMonitor } from '../../core/performance-monitor.js'

// 导入原有类型
import type { OfficeActionInput, OfficeActionOutput } from './PatentResponderAgent.js'
import type { ResponseDocument } from './ExaminerSimulator.js'

// 导入 v2 版本的模块
import { ExaminerSimulator } from './ExaminerSimulator.v2.js'
import { SuccessPredictor } from './SuccessPredictor.v2.js'
import { HebbianOptimizer } from './HebbianOptimizer.v2.js'

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

  /** 审查员模拟器严格程度 */
  examinerStrictness?: number

  /** 权利要求质量评估分数（默认75） */
  defaultClaimsQuality?: number
}

/**
 * 迭代历史记录
 */
export interface IterationHistory {
  iteration: number
  strategy: string
  successProbability: number
  examinerAcceptance: number
  improvements: string[]
}

/**
 * 增强版答复结果
 */
export interface EnhancedResponseResult {
  /** 答复文档 */
  writtenArgument: string
  amendedClaims: string[]
  amendmentComparison: string
  responseStrategy: 'amendment' | 'argument' | 'combination'

  /** 审查员模拟结果 */
  examinerSimulation?: Awaited<ReturnType<ExaminerSimulator['simulateReview']>>

  /** 成功率预测结果 */
  successPrediction?: Awaited<ReturnType<SuccessPredictor['predict']>>

  /** 赫布学习推荐 */
  hebbianRecommendation?: Awaited<ReturnType<HebbianOptimizer['learnAndRecommend']>>

  /** 迭代历史 */
  iterationHistory: IterationHistory[]

  /** 最终建议 */
  finalRecommendations: string[]
}

/**
 * 增强版规划结果
 */
interface EnhancedPlan {
  basePlan: any
  parsedOa: any
  recommendedStrategies: any
  hebbianRecommendation?: Awaited<ReturnType<HebbianOptimizer['learnAndRecommend']>>
}

/**
 * 增强版审查答复智能体（重构版）
 */
export class EnhancedPatentResponderAgent {
  private llm: LLMAdapter
  private examinerSimulator: ExaminerSimulator
  private successPredictor: SuccessPredictor
  private hebbianOptimizer: HebbianOptimizer
  private config: Required<EnhancedResponderConfig>
  private logger: StructuredLogger
  private perfMonitor: PerformanceMonitor

  constructor(llm: LLMAdapter, config: EnhancedResponderConfig = {}) {
    // 验证配置
    validateConfig(config, {
      enableExaminerSimulation: { required: false, type: 'boolean' },
      enableSuccessPrediction: { required: false, type: 'boolean' },
      enableHebbianLearning: { required: false, type: 'boolean' },
      enableHumanInLoop: { required: false, type: 'boolean' },
      conservatism: { required: false, type: 'number', range: [0, 1] },
      maxIterations: { required: false, type: 'number', range: [1, 10] },
      examinerStrictness: { required: false, type: 'number', range: [0, 1] },
      defaultClaimsQuality: { required: false, type: 'number', range: [0, 100] },
    })

    this.llm = llm
    this.config = {
      enableExaminerSimulation: config.enableExaminerSimulation ?? true,
      enableSuccessPrediction: config.enableSuccessPrediction ?? true,
      enableHebbianLearning: config.enableHebbianLearning ?? true,
      enableHumanInLoop: config.enableHumanInLoop ?? true,
      conservatism: config.conservatism ?? 0.5,
      maxIterations: config.maxIterations ?? 3,
      examinerStrictness: config.examinerStrictness ?? 0.7,
      defaultClaimsQuality: config.defaultClaimsQuality ?? 75,
    }

    // 创建日志器
    this.logger = new StructuredLogger('EnhancedPatentResponder')

    // 创建性能监控器
    this.perfMonitor = new PerformanceMonitor()

    // 初始化子模块
    this.examinerSimulator = new ExaminerSimulator(llm, {
      strictness: this.config.examinerStrictness + this.config.conservatism * 0.2,
      conservativeMode: this.config.conservatism > 0.6,
    })

    this.successPredictor = new SuccessPredictor(llm, {
      useHistoricalData: true,
      conservatism: this.config.conservatism,
    })

    this.hebbianOptimizer = new HebbianOptimizer(llm, {
      learningRate: 0.1,
      enableContinuousLearning: true,
    })

    this.logger.info('EnhancedPatentResponderAgent 初始化完成', {
      enableExaminerSimulation: this.config.enableExaminerSimulation,
      enableSuccessPrediction: this.config.enableSuccessPrediction,
      enableHebbianLearning: this.config.enableHebbianLearning,
      enableHumanInLoop: this.config.enableHumanInLoop,
      conservatism: this.config.conservatism,
      maxIterations: this.config.maxIterations,
    })
  }

  /**
   * 执行增强版答复
   */
  async execute(input: OfficeActionInput): Promise<EnhancedResponseResult> {
    // 输入验证
    this.validateInput(input)

    this.logger.logOperationStart('增强版答复', {
      hasOfficeAction: !!input.officeAction,
      enableExaminerSimulation: this.config.enableExaminerSimulation,
      enableSuccessPrediction: this.config.enableSuccessPrediction,
      enableHebbianLearning: this.config.enableHebbianLearning,
    })

    try {
      const result = await this.perfMonitor.measure(
        '增强版答复完整流程',
        async () => {
          // 1. 增强版规划阶段
          const plan = await this.plan(input)

          // 2. 增强版执行阶段（带迭代优化）
          return await this.act(plan, input)
        }
      )

      this.logger.logOperationEnd('增强版答复', {
        iterations: result.iterationHistory.length,
        finalScore: result.iterationHistory[result.iterationHistory.length - 1]?.successProbability,
      })

      return result
    } catch (error) {
      this.logger.logOperationFailure('增强版答复', error as Error)
      throw error
    }
  }

  /**
   * 增强版规划阶段
   */
  private async plan(input: OfficeActionInput): Promise<EnhancedPlan> {
    this.logger.info('开始增强规划阶段')

    // 1. 赫布学习优化（如果启用）
    let hebbianRecommendation: Awaited<ReturnType<HebbianOptimizer['learnAndRecommend']>> | undefined
    if (this.config.enableHebbianLearning) {
      try {
        // 创建简化的 OfficeAction 对象
        const mockOA = {
          oa_type: 'Unknown',
          affected_claims: [],
          citations: [],
          examiner_arguments: input.officeAction ?? '',
        }

        hebbianRecommendation = await this.hebbianOptimizer.learnAndRecommend(
          mockOA,
          input.claims,
          input.description
        )

        this.logger.debug('赫布学习推荐完成', {
          recommendedStrategy: hebbianRecommendation.recommendedStrategy.strategy_type,
          confidence: hebbianRecommendation.confidence,
        })
      } catch (error) {
        this.logger.warn('赫布学习推荐失败，继续执行', { error: (error as Error).message })
      }
    }

    return {
      basePlan: {},
      parsedOa: undefined,
      recommendedStrategies: null,
      hebbianRecommendation,
    }
  }

  /**
   * 增强版执行阶段（带迭代优化）
   */
  private async act(
    plan: EnhancedPlan,
    input: OfficeActionInput
  ): Promise<EnhancedResponseResult> {
    this.logger.info('开始增强执行阶段')

    const iterationHistory: IterationHistory[] = []
    let bestResult: any = null
    let bestScore = 0

    // 迭代优化
    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      this.logger.info(`开始迭代 ${iteration}/${this.config.maxIterations}`)

      // 1. 生成答复文档
      const responseDocument = await this.generateResponseDocument(plan, input, iteration)

      // 2. 审查员模拟（如果启用）
      let examinerSimulation: Awaited<ReturnType<ExaminerSimulator['simulateReview']>> | undefined
      if (this.config.enableExaminerSimulation && plan.parsedOa) {
        try {
          this.logger.debug('执行审查员模拟')
          examinerSimulation = await this.examinerSimulator.simulateReview(
            plan.parsedOa,
            responseDocument
          )

          this.logger.debug('审查员模拟完成', {
            acceptProbability: examinerSimulation.acceptProbability,
          })
        } catch (error) {
          this.logger.warn('审查员模拟失败', { error: (error as Error).message })
        }
      }

      // 3. 成功率预测（如果启用）
      let successPrediction: Awaited<ReturnType<SuccessPredictor['predict']>> | undefined
      if (this.config.enableSuccessPrediction && plan.parsedOa) {
        try {
          this.logger.debug('执行成功率预测')

          // 映射策略类型
          const strategyTypeMap: Record<string, 'AmendClaims' | 'Argue' | 'Hybrid' | 'Withdraw'> = {
            'amendment': 'AmendClaims',
            'argument': 'Argue',
            'combination': 'Hybrid',
          }

          const strategy = {
            strategy_type: strategyTypeMap[responseDocument.responseStrategy] ?? 'Hybrid',
            reasoning: '基于当前答复策略',
            confidence: 0.7,
          }

          successPrediction = await this.successPredictor.predict(
            plan.parsedOa,
            strategy,
            this.config.defaultClaimsQuality
          )

          this.logger.debug('成功率预测完成', {
            successProbability: successPrediction.successProbability,
          })
        } catch (error) {
          this.logger.warn('成功率预测失败', { error: (error as Error).message })
        }
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
        successProbability: successPrediction?.successProbability ?? 0,
        examinerAcceptance: examinerSimulation?.acceptProbability ?? 0,
        improvements: this.generateImprovements(examinerSimulation, successPrediction),
      })

      // 6. 更新最佳结果
      if (currentScore > bestScore) {
        bestScore = currentScore
        bestResult = {
          responseDocument,
          examinerSimulation,
          successPrediction,
        }
      }

      // 7. 检查是否达到满意水平
      if (currentScore >= 85) {
        this.logger.info('达到满意水平，停止迭代', {
          iteration,
          score: currentScore,
        })
        break
      }

      this.logger.debug('迭代完成', {
        iteration,
        score: currentScore,
      })
    }

    // 8. 生成最终建议
    const finalRecommendations = this.generateFinalRecommendations(
      bestResult,
      iterationHistory
    )

    return {
      writtenArgument: bestResult?.responseDocument?.writtenArgument ?? '',
      amendedClaims: bestResult?.responseDocument?.amendedClaims ?? [],
      amendmentComparison: bestResult?.responseDocument?.amendmentComparison ?? '',
      responseStrategy: bestResult?.responseDocument?.responseStrategy ?? 'Hybrid',
      examinerSimulation: bestResult?.examinerSimulation,
      successPrediction: bestResult?.successPrediction,
      hebbianRecommendation: plan.hebbianRecommendation,
      iterationHistory,
      finalRecommendations,
    } as EnhancedResponseResult
  }

  /**
   * 生成答复文档
   */
  private async generateResponseDocument(
    plan: EnhancedPlan,
    input: OfficeActionInput,
    iteration: number
  ): Promise<ResponseDocument> {
    // 简化实现，实际应该调用 LLM 生成
    const strategies = ['amendment', 'argument', 'combination'] as const
    const selectedStrategy = strategies[iteration % strategies.length]

    return {
      writtenArgument: `这是第 ${iteration} 次迭代生成的意见陈述书...`,
      amendedClaims: input.claims.slice(0, 3),
      amendmentComparison: '修改对照说明...',
      responseStrategy: selectedStrategy,
    }
  }

  /**
   * 计算综合得分
   */
  private calculateOverallScore(
    examinerSimulation: Awaited<ReturnType<ExaminerSimulator['simulateReview']>> | undefined,
    successPrediction: Awaited<ReturnType<SuccessPredictor['predict']>> | undefined
  ): number {
    let score = 0

    if (examinerSimulation) {
      score += examinerSimulation.acceptProbability * 0.5
    }

    if (successPrediction) {
      score += successPrediction.successProbability * 0.5
    }

    return score
  }

  /**
   * 生成改进建议
   */
  private generateImprovements(
    examinerSimulation: Awaited<ReturnType<ExaminerSimulator['simulateReview']>> | undefined,
    successPrediction: Awaited<ReturnType<SuccessPredictor['predict']>> | undefined
  ): string[] {
    const improvements: string[] = []

    if (examinerSimulation && examinerSimulation.acceptProbability < 70) {
      improvements.push('审查员接受概率较低，建议修改答复策略')
    }

    if (successPrediction && successPrediction.successProbability < 70) {
      improvements.push('成功率预测较低，建议加强权利要求修改')
    }

    if (examinerSimulation && examinerSimulation.suggestions.length > 0) {
      improvements.push(...examinerSimulation.suggestions.slice(0, 2))
    }

    return improvements
  }

  /**
   * 生成最终建议
   */
  private generateFinalRecommendations(
    bestResult: any,
    iterationHistory: IterationHistory[]
  ): string[] {
    const recommendations: string[] = []

    const lastIteration = iterationHistory[iterationHistory.length - 1]
    if (lastIteration) {
      recommendations.push(`经过 ${iterationHistory.length} 次迭代优化`)
      recommendations.push(`最终成功概率: ${lastIteration.successProbability.toFixed(2)}%`)
      recommendations.push(`最终审查员接受概率: ${lastIteration.examinerAcceptance.toFixed(2)}%`)

      if (lastIteration.successProbability >= 80) {
        recommendations.push('✅ 答复质量优秀，建议提交')
      } else if (lastIteration.successProbability >= 60) {
        recommendations.push('⚠️ 答复质量良好，可考虑进一步完善')
      } else {
        recommendations.push('❌ 答复质量需要改进，建议继续优化')
      }
    }

    return recommendations
  }

  /**
   * 验证输入
   */
  private validateInput(input: OfficeActionInput): void {
    if (!input) {
      throw new ValidationError('输入不能为空', 'input', input)
    }

    if (!input.officeAction && !input.claims) {
      throw new ValidationError('必须提供审查意见或权利要求', 'input', input)
    }

    if (input.claims && !Array.isArray(input.claims)) {
      throw new ValidationError('权利要求必须是数组', 'claims', input.claims)
    }

    if (input.description && typeof input.description !== 'string') {
      throw new ValidationError('技术描述必须是字符串', 'description', input.description)
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.perfMonitor.getAllStats()
  }

  /**
   * 打印性能报告
   */
  printPerformanceReport() {
    this.perfMonitor.printReport()
  }
}
