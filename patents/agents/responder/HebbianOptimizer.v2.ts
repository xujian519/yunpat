/**
 * HebbianOptimizer - 赫布学习优化器（重构版）
 *
 * 基于赫布学习理论（"Cells that fire together, wire together"）的专利答复策略优化器
 *
 * v2.0 更新：
 * - 使用严格的类型系统
 * - 添加输入验证
 * - 结构化错误处理
 * - 集成日志系统
 * - 集成性能监控
 * - 使用常量管理系统
 */

// 导入基础设施
import type { LLMAdapter } from '../../core/llm-types.js'
import {
  HebbianOptimizerError,
  StorageError,
} from '../../core/errors.js'
import {
  HEBBIAN_CONSTANTS,
  STORAGE_CONSTANTS,
} from '../../core/constants.js'
import {
  validateOfficeAction,
  validateConfig,
} from '../../core/validators.js'
import {
  createModuleLogger,
  StructuredLogger,
} from '../../core/logger.js'
import { PerformanceMonitor } from '../../core/performance-monitor.js'

// 导入原有类型
import type { OfficeAction, ResponseStrategy } from '../../core/PatentCoreBridge.js'

/**
 * 策略神经元
 */
interface StrategyNeuron {
  id: string
  type: 'AmendClaims' | 'Argue' | 'Hybrid' | 'Withdraw'
  activationLevel: number // 激活水平（0-1）
  successCount: number
  failureCount: number
  lastActivation: Date
}

/**
 * 特征神经元
 */
interface FeatureNeuron {
  id: string
  feature: string // 例如："新颖性-高严重程度"
  activationLevel: number
  connectedStrategies: Map<string, number> // 策略ID -> 突触权重
}

/**
 * 学习案例
 */
export interface LearningCase {
  caseId: string
  officeAction: OfficeAction
  selectedStrategy: ResponseStrategy
  outcome: 'success' | 'failure' | 'pending'
  features: string[]
  timestamp: Date
  feedbackScore?: number // 用户反馈评分（0-100）
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  recommendedStrategy: ResponseStrategy
  confidence: number
  reasoning: string
  alternatives: Array<ResponseStrategy & { score: number }>
  learningStats: {
    totalCases: number
    relevantCases: number
    successRate: number
  }
}

/**
 * 赫布学习优化器配置
 */
export interface HebbianOptimizerConfig {
  /** 学习率（0-1，默认0.1） */
  learningRate?: number

  /** 遗忘因子（0-1，默认0.05） */
  forgettingFactor?: number

  /** 激活阈值（0-1，默认0.3） */
  activationThreshold?: number

  /** 是否启用持续学习 */
  enableContinuousLearning?: boolean

  /** 案例保存路径 */
  caseStoragePath?: string
}

/**
 * 赫布学习优化器（重构版）
 */
export class HebbianOptimizer {
  private llm: LLMAdapter
  private config: Required<HebbianOptimizerConfig>

  // 神经网络
  private strategyNeurons: Map<string, StrategyNeuron> = new Map()
  private featureNeurons: Map<string, FeatureNeuron> = new Map()

  // 学习案例库
  private learningCases: LearningCase[] = []

  // 统计信息
  private stats = {
    totalLearningEvents: 0,
    successfulPredictions: 0,
    failedPredictions: 0,
  }

  private logger: StructuredLogger
  private perfMonitor: PerformanceMonitor

  constructor(llm: LLMAdapter, config: HebbianOptimizerConfig = {}) {
    this.llm = llm

    // 验证配置
    validateConfig(config, {
      learningRate: { required: false, type: 'number', range: [0, 1] },
      forgettingFactor: { required: false, type: 'number', range: [0, 1] },
      activationThreshold: { required: false, type: 'number', range: [0, 1] },
      enableContinuousLearning: { required: false, type: 'boolean' },
      caseStoragePath: { required: false, type: 'string' },
    })

    this.config = {
      learningRate: config.learningRate ?? HEBBIAN_CONSTANTS.DEFAULT_LEARNING_RATE,
      forgettingFactor: config.forgettingFactor ?? HEBBIAN_CONSTANTS.DEFAULT_FORGETTING_FACTOR,
      activationThreshold: config.activationThreshold ?? HEBBIAN_CONSTANTS.DEFAULT_ACTIVATION_THRESHOLD,
      enableContinuousLearning: config.enableContinuousLearning ?? true,
      caseStoragePath: config.caseStoragePath ?? STORAGE_CONSTANTS.DEFAULT_CASE_STORAGE_PATH,
    }

    // 创建日志器
    this.logger = new StructuredLogger('HebbianOptimizer')

    // 创建性能监控器
    this.perfMonitor = new PerformanceMonitor()

    // 初始化神经网络
    this.initializeNetwork()

    this.logger.info('HebbianOptimizer 初始化完成', {
      learningRate: this.config.learningRate,
      forgettingFactor: this.config.forgettingFactor,
      activationThreshold: this.config.activationThreshold,
    })
  }

  /**
   * 初始化神经网络
   */
  private initializeNetwork(): void {
    this.logger.info('初始化神经网络')

    // 创建策略神经元
    const strategyTypes: Array<'AmendClaims' | 'Argue' | 'Hybrid' | 'Withdraw'> = [
      'AmendClaims',
      'Argue',
      'Hybrid',
      'Withdraw',
    ]

    strategyTypes.forEach((type) => {
      const neuron: StrategyNeuron = {
        id: `strategy-${type}`,
        type,
        activationLevel: HEBBIAN_CONSTANTS.INITIAL_ACTIVATION_LEVEL,
        successCount: 0,
        failureCount: 0,
        lastActivation: new Date(),
      }
      this.strategyNeurons.set(neuron.id, neuron)
    })

    this.logger.debug('策略神经元创建完成', {
      count: this.strategyNeurons.size,
    })

    // 创建特征神经元（基于常见的审查意见特征）
    const commonFeatures = [
      'Novelty-low',
      'Novelty-medium',
      'Novelty-high',
      'InventiveStep-low',
      'InventiveStep-medium',
      'InventiveStep-high',
      'Clarity-low',
      'Clarity-medium',
      'Clarity-high',
    ]

    commonFeatures.forEach((feature) => {
      const neuron: FeatureNeuron = {
        id: `feature-${feature}`,
        feature,
        activationLevel: HEBBIAN_CONSTANTS.INITIAL_ACTIVATION_LEVEL,
        connectedStrategies: new Map(),
      }

      // 初始化突触权重（随机小值）
      this.strategyNeurons.forEach((strategyNeuron) => {
        neuron.connectedStrategies.set(
          strategyNeuron.id,
          Math.random() * HEBBIAN_CONSTANTS.INITIAL_SYNAPSE_WEIGHT_MAX
        )
      })

      this.featureNeurons.set(neuron.id, neuron)
    })

    this.logger.debug('特征神经元创建完成', {
      count: this.featureNeurons.size,
    })

    this.logger.info('神经网络初始化完成')
  }

  /**
   * 从审查意见中学习并推荐策略
   */
  async learnAndRecommend(
    officeAction: OfficeAction,
    currentClaims: string[],
    description: string
  ): Promise<OptimizationResult> {
    // 输入验证
    validateOfficeAction(officeAction)

    if (!Array.isArray(currentClaims) || currentClaims.length === 0) {
      throw new HebbianOptimizerError(
        '权利要求数组不能为空',
        { claimsCount: currentClaims.length }
      )
    }

    if (typeof description !== 'string' || description.trim().length === 0) {
      throw new HebbianOptimizerError(
        '技术描述不能为空',
        { descriptionLength: description?.length }
      )
    }

    this.logger.logOperationStart('学习和推荐', {
      oaType: officeAction.oa_type,
      claimsCount: currentClaims.length,
    })

    try {
      const result = await this.perfMonitor.measure(
        '赫布学习推荐',
        async () => await this.executeLearningAndRecommendation(officeAction, currentClaims, description)
      )

      this.logger.logOperationEnd('学习和推荐', {
        recommendedStrategy: result.recommendedStrategy.strategy_type,
        confidence: result.confidence,
        relevantCases: result.learningStats.relevantCases,
      })

      return result
    } catch (error) {
      this.logger.logOperationFailure('学习和推荐', error as Error)
      throw error
    }
  }

  /**
   * 执行学习和推荐（内部方法）
   */
  private async executeLearningAndRecommendation(
    officeAction: OfficeAction,
    currentClaims: string[],
    description: string
  ): Promise<OptimizationResult> {
    // 1. 提取当前案例的特征
    const features = this.extractFeatures(officeAction, currentClaims, description)

    // 2. 激活相关特征神经元
    this.activateFeatureNeurons(features)

    // 3. 计算每个策略神经元的激活水平
    const strategyScores = await this.calculateStrategyActivations(features)

    // 4. 选择最优策略
    const recommendedStrategy = this.selectBestStrategy(strategyScores)

    // 5. 查找相关历史案例
    const relevantCases = this.findRelevantCases(features)

    // 6. 计算统计信息
    const learningStats = this.calculateLearningStats(relevantCases)

    // 7. 生成推荐理由
    const reasoning = await this.generateReasoning(
      features,
      recommendedStrategy,
      relevantCases
    )

    // 8. 生成替代方案
    const alternatives = strategyScores
      .filter((s) => s.strategy_type !== recommendedStrategy.strategy_type)
      .slice(0, 2)
      .map((s) => ({
        ...s,
        score: s.confidence,
      }))

    return {
      recommendedStrategy,
      confidence: recommendedStrategy.confidence,
      reasoning,
      alternatives,
      learningStats,
    }
  }

  /**
   * 反馈学习：根据实际结果调整突触权重
   */
  async learnFromFeedback(
    caseId: string,
    outcome: 'success' | 'failure',
    feedback?: number
  ): Promise<void> {
    this.logger.logOperationStart('反馈学习', {
      caseId,
      outcome,
      feedback,
    })

    try {
      // 查找案例
      const learningCase = this.learningCases.find((c) => c.caseId === caseId)

      if (!learningCase) {
        throw new HebbianOptimizerError(
          `找不到案例: ${caseId}`,
          { caseId }
        )
      }

      // 更新案例结果
      learningCase.outcome = outcome
      if (feedback !== undefined) {
        learningCase.feedbackScore = feedback
      }

      // 应用赫布学习规则
      this.applyHebbianLearning(learningCase, outcome)

      // 更新统计
      this.stats.totalLearningEvents++
      if (outcome === 'success') {
        this.stats.successfulPredictions++
      } else {
        this.stats.failedPredictions++
      }

      // 保存到持久化存储
      if (this.config.enableContinuousLearning) {
        await this.saveLearningCases()
      }

      this.logger.logOperationEnd('反馈学习', {
        totalEvents: this.stats.totalLearningEvents,
      })
    } catch (error) {
      this.logger.logOperationFailure('反馈学习', error as Error)
      throw error
    }
  }

  /**
   * 提取特征
   */
  private extractFeatures(
    officeAction: OfficeAction,
    currentClaims: string[],
    description: string
  ): string[] {
    const features: string[] = []

    // 驳回类型 + 严重程度
    const severity = this.assessSeverity(officeAction)
    features.push(`${officeAction.oa_type}-${severity}`)

    return features
  }

  /**
   * 评估严重程度
   */
  private assessSeverity(officeAction: OfficeAction): 'low' | 'medium' | 'high' {
    let score = 0

    // 受影响权利要求数量
    score += Math.min(officeAction.affected_claims.length * 5, 25)

    // 引用文献数量
    score += Math.min(officeAction.citations.length * 3, 20)

    // 审查员论点长度
    score += Math.min(officeAction.examiner_arguments.length / 100, 15)

    if (score < 40) return 'low'
    if (score < 65) return 'medium'
    return 'high'
  }

  /**
   * 激活特征神经元
   */
  private activateFeatureNeurons(features: string[]): void {
    features.forEach((feature) => {
      const neuronId = `feature-${feature}`
      const neuron = this.featureNeurons.get(neuronId)

      if (neuron) {
        // 增加激活水平
        neuron.activationLevel = Math.min(
          HEBBIAN_CONSTANTS.MAX_ACTIVATION,
          neuron.activationLevel + this.config.learningRate
        )
      } else {
        // 创建新的特征神经元
        const newNeuron: FeatureNeuron = {
          id: neuronId,
          feature,
          activationLevel: this.config.activationThreshold,
          connectedStrategies: new Map(),
        }

        // 初始化突触权重
        this.strategyNeurons.forEach((strategyNeuron) => {
          newNeuron.connectedStrategies.set(
            strategyNeuron.id,
            Math.random() * HEBBIAN_CONSTANTS.INITIAL_SYNAPSE_WEIGHT_MAX
          )
        })

        this.featureNeurons.set(neuronId, newNeuron)

        this.logger.debug('创建新特征神经元', {
          feature,
          neuronId,
        })
      }
    })
  }

  /**
   * 计算策略神经元的激活水平
   */
  private async calculateStrategyActivations(
    features: string[]
  ): Promise<Array<ResponseStrategy & { confidence: number }>> {
    const strategyScores: Array<ResponseStrategy & { confidence: number }> = []

    for (const strategyNeuron of this.strategyNeurons.values()) {
      let totalActivation = 0
      let weightSum = 0

      // 计算来自所有特征神经元的输入
      for (const feature of features) {
        const featureNeuron = this.featureNeurons.get(`feature-${feature}`)
        if (featureNeuron) {
          const synapticWeight = featureNeuron.connectedStrategies.get(strategyNeuron.id) || 0
          totalActivation += featureNeuron.activationLevel * synapticWeight
          weightSum += Math.abs(synapticWeight)
        }
      }

      // 结合历史成功率
      const totalAttempts = strategyNeuron.successCount + strategyNeuron.failureCount
      const historicalSuccessRate =
        totalAttempts > 0 ? strategyNeuron.successCount / totalAttempts : HEBBIAN_CONSTANTS.BASELINE_ACTIVATION

      // 综合激活水平
      const currentActivation = strategyNeuron.activationLevel
      const featureContribution = weightSum > 0 ? totalActivation / weightSum : 0
      const confidence =
        currentActivation * 0.3 + featureContribution * 0.4 + historicalSuccessRate * 0.3

      strategyScores.push({
        strategy_type: strategyNeuron.type,
        reasoning: `激活水平: ${currentActivation.toFixed(2)}, 特征贡献: ${featureContribution.toFixed(2)}`,
        confidence: Math.max(0, Math.min(1, confidence)),
      })
    }

    // 按置信度排序
    strategyScores.sort((a, b) => b.confidence - a.confidence)

    return strategyScores
  }

  /**
   * 选择最佳策略
   */
  private selectBestStrategy(
    strategyScores: Array<ResponseStrategy & { confidence: number }>
  ): ResponseStrategy {
    const best = strategyScores[0]

    // 如果置信度太低，使用保守策略（Hybrid）
    if (best.confidence < this.config.activationThreshold) {
      return {
        strategy_type: 'Hybrid',
        reasoning: '置信度较低，使用保守的混合策略',
        confidence: this.config.activationThreshold,
      }
    }

    return {
      strategy_type: best.strategy_type,
      reasoning: best.reasoning,
      confidence: best.confidence,
    }
  }

  /**
   * 查找相关历史案例
   */
  private findRelevantCases(features: string[]): LearningCase[] {
    return this.learningCases.filter((case_) => {
      // 计算特征重叠度
      const overlap = case_.features.filter((f) => features.includes(f)).length
      return overlap >= Math.max(1, Math.floor(features.length / 2))
    })
  }

  /**
   * 计算学习统计信息
   */
  private calculateLearningStats(relevantCases: LearningCase[]): {
    totalCases: number
    relevantCases: number
    successRate: number
  } {
    const totalCases = this.learningCases.length
    const successCount = relevantCases.filter((c) => c.outcome === 'success').length
    const successRate = relevantCases.length > 0 ? successCount / relevantCases.length : 0

    return {
      totalCases,
      relevantCases: relevantCases.length,
      successRate,
    }
  }

  /**
   * 生成推荐理由
   */
  private async generateReasoning(
    features: string[],
    recommendedStrategy: ResponseStrategy,
    relevantCases: LearningCase[]
  ): Promise<string> {
    const relevantSuccessCases = relevantCases.filter((c) => c.outcome === 'success')

    let reasoning = `## 推荐策略：${recommendedStrategy.strategy_type}\n\n`

    reasoning += `### 策略理由\n`
    reasoning += `${recommendedStrategy.reasoning}\n\n`

    if (relevantSuccessCases.length > 0) {
      reasoning += `### 历史案例支持\n`
      reasoning += `找到 ${relevantSuccessCases.length} 个相似的成功案例：\n`

      relevantSuccessCases.slice(0, 3).forEach((case_, i) => {
        reasoning += `${i + 1}. 案例 ${case_.caseId} (${case_.timestamp.toLocaleDateString()})\n`
        reasoning += `   - 策略: ${case_.selectedStrategy.strategy_type}\n`
        if (case_.feedbackScore) {
          reasoning += `   - 反馈评分: ${case_.feedbackScore}/100\n`
        }
      })

      reasoning += `\n这些案例表明该策略在相似情况下具有较高的成功率。\n`
    }

    reasoning += `\n### 特征分析\n`
    reasoning += `当前案例特征：${features.join(', ')}\n`

    return reasoning
  }

  /**
   * 应用赫布学习规则
   */
  private applyHebbianLearning(learningCase: LearningCase, outcome: 'success' | 'failure'): void {
    const strength = outcome === 'success' ? 1 : -1
    const learningRate = this.config.learningRate * strength

    // 更新策略神经元
    const strategyNeuronId = `strategy-${learningCase.selectedStrategy.strategy_type}`
    const strategyNeuron = this.strategyNeurons.get(strategyNeuronId)

    if (strategyNeuron) {
      if (outcome === 'success') {
        strategyNeuron.successCount++
        strategyNeuron.activationLevel = Math.min(
          HEBBIAN_CONSTANTS.MAX_ACTIVATION,
          strategyNeuron.activationLevel + learningRate * HEBBIAN_CONSTANTS.SUCCESS_ACTIVATION_BOOST
        )
      } else {
        strategyNeuron.failureCount++
        strategyNeuron.activationLevel = Math.max(
          0,
          strategyNeuron.activationLevel + learningRate * HEBBIAN_CONSTANTS.FAILURE_ACTIVATION_REDUCTION
        )
      }

      strategyNeuron.lastActivation = new Date()
    }

    // 更新突触权重
    learningCase.features.forEach((feature) => {
      const featureNeuron = this.featureNeurons.get(`feature-${feature}`)
      if (featureNeuron) {
        const currentWeight = featureNeuron.connectedStrategies.get(strategyNeuronId) || 0
        const newWeight = currentWeight + learningRate * HEBBIAN_CONSTANTS.SYNAPSE_WEIGHT_ADJUSTMENT

        // 限制权重范围 [-1, 1]
        const clampedWeight = Math.max(-1, Math.min(1, newWeight))
        featureNeuron.connectedStrategies.set(strategyNeuronId, clampedWeight)
      }
    })

    this.logger.debug('赫布学习应用完成', {
      caseId: learningCase.caseId,
      outcome,
      strategyNeuronId,
    })
  }

  /**
   * 保存学习案例到持久化存储
   */
  private async saveLearningCases(): Promise<void> {
    try {
      const { writeFileSync } = await import('fs')
      const { join } = await import('path')

      const data = JSON.stringify(this.learningCases, null, 2)
      writeFileSync(this.config.caseStoragePath, data, 'utf-8')

      this.logger.debug('学习案例已保存', {
        path: this.config.caseStoragePath,
        count: this.learningCases.length,
      })
    } catch (error) {
      throw new StorageError(
        '保存学习案例失败',
        'write',
        this.config.caseStoragePath,
        { cause: error }
      )
    }
  }

  /**
   * 从持久化存储加载学习案例
   */
  async loadLearningCases(): Promise<void> {
    this.logger.info('加载学习案例')

    try {
      const { readFileSync, existsSync } = await import('fs')
      const { join } = await import('path')

      if (!existsSync(this.config.caseStoragePath)) {
        this.logger.warn('案例文件不存在', {
          path: this.config.caseStoragePath,
        })
        return
      }

      const data = readFileSync(this.config.caseStoragePath, 'utf-8')
      this.learningCases = JSON.parse(data)

      // 重新计算统计
      this.stats.totalLearningEvents = this.learningCases.filter(
        (c) => c.outcome !== 'pending'
      ).length
      this.stats.successfulPredictions = this.learningCases.filter(
        (c) => c.outcome === 'success'
      ).length
      this.stats.failedPredictions = this.learningCases.filter(
        (c) => c.outcome === 'failure'
      ).length

      this.logger.info('学习案例加载完成', {
        count: this.learningCases.length,
        totalEvents: this.stats.totalLearningEvents,
      })
    } catch (error) {
      throw new StorageError(
        '加载学习案例失败',
        'read',
        this.config.caseStoragePath,
        { cause: error }
      )
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      totalCases: this.learningCases.length,
      strategyNeurons: this.strategyNeurons.size,
      featureNeurons: this.featureNeurons.size,
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
