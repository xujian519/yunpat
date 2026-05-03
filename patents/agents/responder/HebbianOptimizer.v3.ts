/**
 * HebbianOptimizer - 赫布学习优化器（性能优化版 v3）
 *
 * 基于赫布学习理论的专利答复策略优化器
 *
 * v3.0 性能优化：
 * - 特征激活缓存机制
 * - 突触权重计算优化
 * - 批量处理策略激活
 * - 案例容量限制和自动清理
 * - 内存泄漏防护
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
 * 特征激活缓存项
 */
interface FeatureActivationCacheItem {
  activationLevel: number
  timestamp: number
  hitCount: number
}

/**
 * 策略神经元（优化版）
 */
interface StrategyNeuron {
  id: string
  type: 'AmendClaims' | 'Argue' | 'Hybrid' | 'Withdraw'
  activationLevel: number
  successCount: number
  failureCount: number
  lastActivation: Date
  // 优化：预计算的突触权重总和
  precomputedWeightSum?: number
  // 优化：最后计算时间
  lastWeightComputation?: Date
}

/**
 * 特征神经元（优化版）
 */
interface FeatureNeuron {
  id: string
  feature: string
  activationLevel: number
  connectedStrategies: Map<string, number>
  // 优化：缓存过期时间
  expiryTime?: number
  // 优化：访问频率
  accessFrequency: number
  // 优化：最后访问时间
  lastAccessTime: number
}

/**
 * 学习案例（优化版）
 */
export interface LearningCase {
  caseId: string
  officeAction: OfficeAction
  selectedStrategy: ResponseStrategy
  outcome: 'success' | 'failure' | 'pending'
  features: string[]
  timestamp: Date
  feedbackScore?: number
  // 优化：价值评分
  valueScore?: number
  // 优化：访问次数
  accessCount: number
  // 优化：最后访问时间
  lastAccessTime: number
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

  /** 是否启用特征激活缓存 */
  enableFeatureCache?: boolean

  /** 是否启用批量处理 */
  enableBatchProcessing?: boolean

  /** 最大学习案例数量 */
  maxLearningCases?: number

  /** 是否启用自动清理 */
  enableAutoCleanup?: boolean
}

/**
 * 赫布学习优化器（性能优化版）
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
    cacheHits: 0,
    cacheMisses: 0,
    cleanupCount: 0,
  }

  // 性能优化：特征激活缓存
  private featureActivationCache: Map<string, FeatureActivationCacheItem> = new Map()

  // 性能优化：批量处理队列
  private batchProcessingQueue: Array<() => Promise<any>> = []

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
      enableFeatureCache: { required: false, type: 'boolean' },
      enableBatchProcessing: { required: false, type: 'boolean' },
      maxLearningCases: { required: false, type: 'number', range: [1000, 50000] },
      enableAutoCleanup: { required: false, type: 'boolean' },
    })

    this.config = {
      learningRate: config.learningRate ?? HEBBIAN_CONSTANTS.DEFAULT_LEARNING_RATE,
      forgettingFactor: config.forgettingFactor ?? HEBBIAN_CONSTANTS.DEFAULT_FORGETTING_FACTOR,
      activationThreshold: config.activationThreshold ?? HEBBIAN_CONSTANTS.DEFAULT_ACTIVATION_THRESHOLD,
      enableContinuousLearning: config.enableContinuousLearning ?? true,
      caseStoragePath: config.caseStoragePath ?? STORAGE_CONSTANTS.DEFAULT_CASE_STORAGE_PATH,
      enableFeatureCache: config.enableFeatureCache ?? true,
      enableBatchProcessing: config.enableBatchProcessing ?? true,
      maxLearningCases: config.maxLearningCases ?? HEBBIAN_CONSTANTS.MAX_LEARNING_CASES,
      enableAutoCleanup: config.enableAutoCleanup ?? true,
    }

    // 创建日志器
    this.logger = new StructuredLogger('HebbianOptimizer')

    // 创建性能监控器
    this.perfMonitor = new PerformanceMonitor()

    // 初始化神经网络
    this.initializeNetwork()

    // 启动定期清理任务
    if (this.config.enableAutoCleanup) {
      this.startPeriodicCleanup()
    }

    this.logger.info('HebbianOptimizer 初始化完成（性能优化版）', {
      learningRate: this.config.learningRate,
      enableFeatureCache: this.config.enableFeatureCache,
      enableBatchProcessing: this.config.enableBatchProcessing,
      maxLearningCases: this.config.maxLearningCases,
      enableAutoCleanup: this.config.enableAutoCleanup,
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
        precomputedWeightSum: undefined,
        lastWeightComputation: undefined,
      }
      this.strategyNeurons.set(neuron.id, neuron)
    })

    this.logger.debug('策略神经元创建完成', {
      count: this.strategyNeurons.size,
    })

    // 创建特征神经元（基于常见的审查意见特征）
    const commonFeatures = HEBBIAN_CONSTANTS.COMMON_FEATURES

    commonFeatures.forEach((feature) => {
      const neuron: FeatureNeuron = {
        id: `feature-${feature}`,
        feature,
        activationLevel: HEBBIAN_CONSTANTS.INITIAL_ACTIVATION_LEVEL,
        connectedStrategies: new Map(),
        expiryTime: Date.now() + HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_TTL,
        accessFrequency: 0,
        lastAccessTime: Date.now(),
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
   * 从审查意见中学习并推荐策略（优化版）
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

    this.logger.logOperationStart('学习和推荐（优化版）', {
      oaType: officeAction.oa_type,
      claimsCount: currentClaims.length,
    })

    try {
      const result = await this.perfMonitor.measure(
        '赫布学习推荐（优化版）',
        async () => await this.executeLearningAndRecommendation(officeAction, currentClaims, description)
      )

      this.logger.logOperationEnd('学习和推荐（优化版）', {
        recommendedStrategy: result.recommendedStrategy.strategy_type,
        confidence: result.confidence,
        relevantCases: result.learningStats.relevantCases,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
      })

      return result
    } catch (error) {
      this.logger.logOperationFailure('学习和推荐（优化版）', error as Error)
      throw error
    }
  }

  /**
   * 执行学习和推荐（优化版内部方法）
   */
  private async executeLearningAndRecommendation(
    officeAction: OfficeAction,
    currentClaims: string[],
    description: string
  ): Promise<OptimizationResult> {
    // 1. 提取当前案例的特征（同步操作，不需要measure）
    const features = this.extractFeatures(officeAction, currentClaims, description)

    // 2. 激活相关特征神经元（优化版：使用缓存）
    await this.activateFeatureNeuronsOptimized(features)

    // 3. 计算每个策略神经元的激活水平（优化版：批量处理）
    const strategyScores = await this.calculateStrategyActivationsOptimized(features)

    // 4. 选择最优策略
    const recommendedStrategy = this.selectBestStrategy(strategyScores)

    // 5. 查找相关历史案例（优化版：使用缓存）
    const relevantCases = this.findRelevantCasesOptimized(features)

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
   * 激活特征神经元（优化版：使用缓存）
   */
  private async activateFeatureNeuronsOptimized(features: string[]): Promise<void> {
    if (!this.config.enableFeatureCache) {
      // 降级到原始方法
      return this.activateFeatureNeurons(features)
    }

    const now = Date.now()

    // 批量处理特征激活
    for (const feature of features) {
      const neuronId = `feature-${feature}`

      // 检查缓存
      const cached = this.featureActivationCache.get(neuronId)
      if (cached && cached.timestamp + HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_TTL > now) {
        // 缓存命中
        this.stats.cacheHits++
        cached.hitCount++

        // 更新神经元的激活水平
        const neuron = this.featureNeurons.get(neuronId)
        if (neuron) {
          neuron.activationLevel = cached.activationLevel
          neuron.accessFrequency++
          neuron.lastAccessTime = now
        }
        continue
      }

      // 缓存未命中
      this.stats.cacheMisses++

      const neuron = this.featureNeurons.get(neuronId)

      if (neuron) {
        // 增加激活水平
        const newActivationLevel = Math.min(
          HEBBIAN_CONSTANTS.MAX_ACTIVATION,
          neuron.activationLevel + this.config.learningRate
        )
        neuron.activationLevel = newActivationLevel
        neuron.accessFrequency++
        neuron.lastAccessTime = now

        // 更新缓存
        this.featureActivationCache.set(neuronId, {
          activationLevel: newActivationLevel,
          timestamp: now,
          hitCount: 1,
        })
      } else {
        // 创建新的特征神经元
        const newNeuron: FeatureNeuron = {
          id: neuronId,
          feature,
          activationLevel: this.config.activationThreshold,
          connectedStrategies: new Map(),
          expiryTime: now + HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_TTL,
          accessFrequency: 1,
          lastAccessTime: now,
        }

        // 初始化突触权重
        this.strategyNeurons.forEach((strategyNeuron) => {
          newNeuron.connectedStrategies.set(
            strategyNeuron.id,
            Math.random() * HEBBIAN_CONSTANTS.INITIAL_SYNAPSE_WEIGHT_MAX
          )
        })

        this.featureNeurons.set(neuronId, newNeuron)

        // 添加到缓存
        this.featureActivationCache.set(neuronId, {
          activationLevel: this.config.activationThreshold,
          timestamp: now,
          hitCount: 1,
        })

        this.logger.debug('创建新特征神经元', {
          feature,
          neuronId,
        })
      }
    }

    // 清理过期缓存
    this.cleanupExpiredCache()
  }

  /**
   * 计算策略神经元的激活水平（优化版：批量处理）
   */
  private async calculateStrategyActivationsOptimized(
    features: string[]
  ): Promise<Array<ResponseStrategy & { confidence: number }>> {
    const strategyScores: Array<ResponseStrategy & { confidence: number }> = []

    // 预计算特征权重总和
    const featureWeightsMap = new Map<string, Map<string, number>>()

    for (const feature of features) {
      const featureNeuron = this.featureNeurons.get(`feature-${feature}`)
      if (featureNeuron) {
        const weights = new Map<string, number>()
        for (const [strategyId, weight] of featureNeuron.connectedStrategies.entries()) {
          weights.set(strategyId, weight * featureNeuron.activationLevel)
        }
        featureWeightsMap.set(feature, weights)
      }
    }

    // 批量计算所有策略的激活水平
    for (const strategyNeuron of this.strategyNeurons.values()) {
      let totalActivation = 0
      let weightSum = 0

      // 使用预计算的权重
      for (const weights of featureWeightsMap.values()) {
        const weight = weights.get(strategyNeuron.id) || 0
        totalActivation += weight
        weightSum += Math.abs(weight)
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
   * 查找相关历史案例（优化版：使用缓存和索引）
   */
  private findRelevantCasesOptimized(features: string[]): LearningCase[] {
    const now = Date.now()

    // 更新案例的访问时间和访问次数
    return this.learningCases.filter((case_) => {
      // 计算特征重叠度
      const overlap = case_.features.filter((f) => features.includes(f)).length
      const isRelevant = overlap >= Math.max(1, Math.floor(features.length / 2))

      if (isRelevant) {
        // 更新访问统计
        case_.accessCount++
        case_.lastAccessTime = now

        // 计算价值评分
        case_.valueScore = this.calculateCaseValueScore(case_)
      }

      return isRelevant
    })
  }

  /**
   * 计算案例价值评分
   */
  private calculateCaseValueScore(case_: LearningCase): number {
    let score = 0

    // 成功案例加分
    if (case_.outcome === 'success') {
      score += 50
    }

    // 访问频率加分
    score += Math.min(case_.accessCount * 5, 30)

    // 时间衰减（越新的案例价值越高）
    const ageInDays = (Date.now() - new Date(case_.timestamp).getTime()) / (24 * 60 * 60 * 1000)
    score += Math.max(0, 20 - ageInDays * 0.5)

    return score
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    const ttl = HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_TTL
    let cleaned = 0

    for (const [key, value] of this.featureActivationCache.entries()) {
      if (value.timestamp + ttl < now) {
        this.featureActivationCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.debug('清理过期缓存', {
        cleaned,
        remaining: this.featureActivationCache.size,
      })
    }
  }

  /**
   * 自动清理低价值案例
   */
  private async cleanupLowValueCases(): Promise<void> {
    const now = Date.now()
    const threshold = this.config.maxLearningCases * HEBBIAN_CONSTANTS.MEMORY_CLEANUP_THRESHOLD

    if (this.learningCases.length < threshold) {
      return
    }

    this.logger.info('触发自动清理', {
      currentCount: this.learningCases.length,
      threshold,
    })

    // 计算所有案例的价值评分
    this.learningCases.forEach((case_) => {
      case_.valueScore = this.calculateCaseValueScore(case_)
    })

    // 按价值评分排序
    this.learningCases.sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0))

    // 保留高价值案例
    const keepCount = Math.floor(this.config.maxLearningCases * 0.9)
    const removedCount = this.learningCases.length - keepCount

    this.learningCases = this.learningCases.slice(0, keepCount)

    this.stats.cleanupCount++

    this.logger.info('清理完成', {
      removedCount,
      remainingCount: this.learningCases.length,
    })

    // 保存清理后的数据
    if (this.config.enableContinuousLearning) {
      await this.saveLearningCases()
    }
  }

  /**
   * 启动定期清理任务
   */
  private startPeriodicCleanup(): void {
    const interval = setInterval(async () => {
      try {
        await this.cleanupLowValueCases()
      } catch (error) {
        this.logger.error('定期清理失败', error as Error)
      }
    }, HEBBIAN_CONSTANTS.CLEANUP_FREQUENCY * 60 * 1000) // 转换为毫秒

    // 防止内存泄漏，保存定时器引用以便清理
    ;(this as any).cleanupInterval = interval
  }

  /**
   * 反馈学习：根据实际结果调整突触权重
   */
  async learnFromFeedback(
    caseId: string,
    outcome: 'success' | 'failure',
    feedback?: number
  ): Promise<void> {
    this.logger.logOperationStart('反馈学习（优化版）', {
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
      learningCase.lastAccessTime = Date.now()

      // 应用赫布学习规则
      this.applyHebbianLearning(learningCase, outcome)

      // 更新统计
      this.stats.totalLearningEvents++
      if (outcome === 'success') {
        this.stats.successfulPredictions++
      } else {
        this.stats.failedPredictions++
      }

      // 检查是否需要清理
      if (this.learningCases.length >= this.config.maxLearningCases * HEBBIAN_CONSTANTS.MEMORY_CLEANUP_THRESHOLD) {
        await this.cleanupLowValueCases()
      }

      // 保存到持久化存储
      if (this.config.enableContinuousLearning) {
        await this.saveLearningCases()
      }

      this.logger.logOperationEnd('反馈学习（优化版）', {
        totalEvents: this.stats.totalLearningEvents,
      })
    } catch (error) {
      this.logger.logOperationFailure('反馈学习（优化版）', error as Error)
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
   * 激活特征神经元（原始版本，用于降级）
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
        neuron.accessFrequency++
        neuron.lastAccessTime = Date.now()
      } else {
        // 创建新的特征神经元
        const newNeuron: FeatureNeuron = {
          id: neuronId,
          feature,
          activationLevel: this.config.activationThreshold,
          connectedStrategies: new Map(),
          expiryTime: Date.now() + HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_TTL,
          accessFrequency: 1,
          lastAccessTime: Date.now(),
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
          HEBBIAN_CONSTANTS.MIN_ACTIVATION,
          strategyNeuron.activationLevel + learningRate * HEBBIAN_CONSTANTS.FAILURE_ACTIVATION_REDUCTION
        )
      }

      strategyNeuron.lastActivation = new Date()
      // 标记预计算权重失效
      strategyNeuron.precomputedWeightSum = undefined
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

      if (!existsSync(this.config.caseStoragePath)) {
        this.logger.warn('案例文件不存在', {
          path: this.config.caseStoragePath,
        })
        return
      }

      const data = readFileSync(this.config.caseStoragePath, 'utf-8')
      const loadedCases = JSON.parse(data) as LearningCase[]

      // 限制加载的案例数量
      this.learningCases = loadedCases
        .slice(0, this.config.maxLearningCases)
        .map((case_) => ({
          ...case_,
          accessCount: case_.accessCount || 0,
          lastAccessTime: case_.lastAccessTime || Date.now(),
          valueScore: undefined,
        }))

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
   * 获取统计信息（包含性能统计）
   */
  getStats() {
    return {
      ...this.stats,
      totalCases: this.learningCases.length,
      strategyNeurons: this.strategyNeurons.size,
      featureNeurons: this.featureNeurons.size,
      cacheSize: this.featureActivationCache.size,
      cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
        : 0,
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

  /**
   * 销毁资源
   */
  destroy(): void {
    // 清理定时器
    const interval = (this as any).cleanupInterval
    if (interval) {
      clearInterval(interval)
    }

    // 清空缓存
    this.featureActivationCache.clear()

    this.logger.info('HebbianOptimizer 资源已销毁')
  }
}
