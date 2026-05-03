/**
 * HebbianOptimizer - 赫布学习优化器
 *
 * 基于赫布学习理论（"Cells that fire together, wire together"）的专利答复策略优化器
 *
 * 核心功能：
 * 1. 从历史案例中学习成功的答复策略
 * 2. 强化成功的策略组合（突触权重增强）
 * 3. 弱化失败的策略组合（突触权重减弱）
 * 4. 推荐最优策略组合
 * 5. 持续学习和适应
 */

import type { LLMAdapter } from '@yunpat/core'
import type { OfficeAction, ResponseStrategy } from '../../core/PatentCoreBridge.js'
import { HEBBIAN_CONSTANTS } from '../../core/constants.js'

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
 * 赫布学习优化器
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

  constructor(llm: LLMAdapter, config: HebbianOptimizerConfig = {}) {
    this.llm = llm
    this.config = {
      learningRate: config.learningRate ?? 0.1,
      forgettingFactor: config.forgettingFactor ?? 0.05,
      activationThreshold: config.activationThreshold ?? 0.3,
      enableContinuousLearning: config.enableContinuousLearning ?? true,
      caseStoragePath: config.caseStoragePath ?? './data/hebbian-cases.json',
    }

    this.initializeNetwork()
  }

  /**
   * 初始化神经网络
   */
  private initializeNetwork(): void {
    console.log('🧠 [赫布学习优化器] 初始化神经网络...')

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
        activationLevel: 0.5, // 初始激活水平
        successCount: 0,
        failureCount: 0,
        lastActivation: new Date(),
      }
      this.strategyNeurons.set(neuron.id, neuron)
    })

    console.log(`   ✅ 创建了 ${this.strategyNeurons.size} 个策略神经元`)

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
        activationLevel: 0.5,
        connectedStrategies: new Map(),
      }

      // 初始化突触权重（随机小值）
      this.strategyNeurons.forEach((strategyNeuron) => {
        neuron.connectedStrategies.set(strategyNeuron.id, Math.random() * 0.2)
      })

      this.featureNeurons.set(neuron.id, neuron)
    })

    console.log(`   ✅ 创建了 ${this.featureNeurons.size} 个特征神经元`)
    console.log(`   ✅ 神经网络初始化完成\n`)
  }

  /**
   * 从审查意见中学习并推荐策略
   */
  async learnAndRecommend(
    officeAction: OfficeAction,
    currentClaims: string[],
    description: string
  ): Promise<OptimizationResult> {
    console.log('\n🧠 [赫布学习优化器] 开始学习和推荐...')

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
    const reasoning = await this.generateReasoning(features, recommendedStrategy, relevantCases)

    // 8. 生成替代方案
    const alternatives = strategyScores
      .filter((s) => s.strategy_type !== recommendedStrategy.strategy_type)
      .slice(0, 2)
      .map((s) => ({
        ...s,
        score: s.confidence,
      }))

    console.log(`   ✅ 推荐策略: ${recommendedStrategy.strategy_type}`)
    console.log(`   📊 置信度: ${recommendedStrategy.confidence.toFixed(2)}`)
    console.log(`   📚 相关案例: ${relevantCases.length} 个`)

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
    console.log(`\n🧠 [赫布学习优化器] 从反馈中学习...`)
    console.log(`   案例ID: ${caseId}`)
    console.log(`   结果: ${outcome}`)

    // 查找案例
    const learningCase = this.learningCases.find((c) => c.caseId === caseId)
    if (!learningCase) {
      console.warn(`   ⚠️  未找到案例: ${caseId}`)
      return
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

    // 应用遗忘规则
    this.applyForgetting()

    // 保存学习案例
    if (this.config.enableContinuousLearning) {
      await this.saveLearningCases()
    }

    console.log(`   ✅ 学习完成`)
    console.log(`   📈 总学习事件: ${this.stats.totalLearningEvents}`)
  }

  /**
   * 提取案例特征
   */
  private extractFeatures(
    officeAction: OfficeAction,
    currentClaims: string[],
    description: string
  ): string[] {
    const features: string[] = []

    // 1. 驳回类型
    features.push(officeAction.oa_type)

    // 2. 严重程度
    const severity = this.assessSeverity(officeAction)
    features.push(`${officeAction.oa_type}-${severity}`)

    // 3. 受影响权利要求范围
    const affectedClaimsCount = officeAction.affected_claims.length
    if (affectedClaimsCount === 1) {
      features.push('single-claim-affected')
    } else if (affectedClaimsCount <= 3) {
      features.push('few-claims-affected')
    } else {
      features.push('many-claims-affected')
    }

    // 4. 引用文献数量
    const citationsCount = officeAction.citations.length
    if (citationsCount === 1) {
      features.push('single-citation')
    } else if (citationsCount <= 3) {
      features.push('few-citations')
    } else {
      features.push('many-citations')
    }

    return features
  }

  /**
   * 评估驳回严重程度
   */
  private assessSeverity(officeAction: OfficeAction): 'low' | 'medium' | 'high' {
    let score = 0

    // 驳回类型基础分
    const typeScore: Record<string, number> = {
      Novelty: 30,
      InventiveStep: 35,
      Clarity: 20,
      Support: 25,
      Formality: 10,
    }
    score += typeScore[officeAction.oa_type] || 25

    // 受影响权利要求数量
    score += Math.min(officeAction.affected_claims.length * 5, 20)

    // 引用文献数量
    score += Math.min(officeAction.citations.length * 3, 15)

    if (score < 35) return 'low'
    if (score < 55) return 'medium'
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
        neuron.activationLevel = Math.min(1, neuron.activationLevel + this.config.learningRate)
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
          newNeuron.connectedStrategies.set(strategyNeuron.id, Math.random() * 0.2)
        })

        this.featureNeurons.set(neuronId, newNeuron)
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
        totalAttempts > 0 ? strategyNeuron.successCount / totalAttempts : 0.5

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
          1,
          strategyNeuron.activationLevel + learningRate * 0.3
        )
      } else {
        strategyNeuron.failureCount++
        strategyNeuron.activationLevel = Math.max(
          0,
          strategyNeuron.activationLevel - learningRate * 0.2
        )
      }

      strategyNeuron.lastActivation = new Date()
    }

    // 更新特征-策略突触权重
    learningCase.features.forEach((feature) => {
      const featureNeuron = this.featureNeurons.get(`feature-${feature}`)
      if (featureNeuron && strategyNeuron) {
        const currentWeight = featureNeuron.connectedStrategies.get(strategyNeuronId) || 0
        const newWeight = currentWeight + learningRate * 0.5
        featureNeuron.connectedStrategies.set(strategyNeuronId, newWeight)
      }
    })
  }

  /**
   * 应用遗忘规则
   */
  private applyForgetting(): void {
    const forgettingFactor = this.config.forgettingFactor

    // 策略神经元缓慢衰减到基线
    this.strategyNeurons.forEach((neuron) => {
      const baseline = 0.5
      const diff = neuron.activationLevel - baseline
      neuron.activationLevel = baseline + diff * (1 - forgettingFactor)
    })

    // 特征神经元缓慢衰减
    this.featureNeurons.forEach((neuron) => {
      const baseline = this.config.activationThreshold
      const diff = neuron.activationLevel - baseline
      neuron.activationLevel = baseline + diff * (1 - forgettingFactor)
    })
  }

  /**
   * 保存学习案例
   */
  private async saveLearningCases(): Promise<void> {
    // 这里应该实现持久化存储
    // 简化版本：只在内存中保存
    console.log(`   💾 保存了 ${this.learningCases.length} 个学习案例`)
  }

  /**
   * 保存当前案例以供后续学习（带内存限制）
   */
  saveCaseForLearning(
    caseId: string,
    officeAction: OfficeAction,
    selectedStrategy: ResponseStrategy,
    features: string[]
  ): void {
    // 检查是否超过限制
    if (this.learningCases.length >= HEBBIAN_CONSTANTS.MAX_LEARNING_CASES) {
      // 删除最旧的案例
      const removedCase = this.learningCases.shift()
      console.log(`   🗑️  内存限制：删除最旧案例 ${removedCase?.caseId}`)
    }

    const learningCase: LearningCase = {
      caseId,
      officeAction,
      selectedStrategy,
      outcome: 'pending',
      features,
      timestamp: new Date(),
    }

    this.learningCases.push(learningCase)
    console.log(
      `   💾 案例 ${caseId} 已保存，等待反馈 (${this.learningCases.length}/${HEBBIAN_CONSTANTS.MAX_LEARNING_CASES})`
    )

    // 定期检查内存使用情况
    this.monitorMemoryUsage()
  }

  /**
   * 获取学习统计
   */
  getLearningStats(): {
    totalCases: number
    totalLearningEvents: number
    successfulPredictions: number
    failedPredictions: number
    predictionAccuracy: number
  } {
    const predictionAccuracy =
      this.stats.successfulPredictions + this.stats.failedPredictions > 0
        ? this.stats.successfulPredictions /
          (this.stats.successfulPredictions + this.stats.failedPredictions)
        : 0

    return {
      totalCases: this.learningCases.length,
      totalLearningEvents: this.stats.totalLearningEvents,
      successfulPredictions: this.stats.successfulPredictions,
      failedPredictions: this.stats.failedPredictions,
      predictionAccuracy,
    }
  }

  /**
   * 获取神经网络状态
   */
  getNetworkState(): {
    strategyNeurons: number
    featureNeurons: number
    totalSynapses: number
    averageActivation: number
  } {
    let totalSynapses = 0
    let totalActivation = 0

    this.featureNeurons.forEach((neuron) => {
      totalSynapses += neuron.connectedStrategies.size
    })

    this.strategyNeurons.forEach((neuron) => {
      totalActivation += neuron.activationLevel
    })

    return {
      strategyNeurons: this.strategyNeurons.size,
      featureNeurons: this.featureNeurons.size,
      totalSynapses,
      averageActivation: totalActivation / this.strategyNeurons.size,
    }
  }

  /**
   * 重置神经网络（慎用）
   */
  resetNetwork(): void {
    console.log('🧠 [赫布学习优化器] 重置神经网络...')
    this.strategyNeurons.clear()
    this.featureNeurons.clear()
    this.learningCases = []
    this.stats = {
      totalLearningEvents: 0,
      successfulPredictions: 0,
      failedPredictions: 0,
    }
    this.initializeNetwork()
    console.log('   ✅ 神经网络已重置')
  }

  /**
   * 监控内存使用情况
   */
  private monitorMemoryUsage(): void {
    // 估算内存使用量
    const estimatedMemoryMB = this.estimateMemoryUsage()

    // 如果内存使用超过阈值，发出警告
    if (estimatedMemoryMB > 50) {
      console.warn(`   ⚠️  内存使用警告: 约 ${estimatedMemoryMB.toFixed(2)} MB`)
      console.warn(`   💡 建议: 考虑清理旧案例或减小 MAX_LEARNING_CASES`)

      // 如果内存使用严重过高，自动清理
      if (estimatedMemoryMB > 100) {
        const cleanupCount = Math.floor(this.learningCases.length * 0.1)
        this.learningCases.splice(0, cleanupCount)
        console.log(`   🧹 自动清理了 ${cleanupCount} 个旧案例`)
      }
    }
  }

  /**
   * 估算内存使用量（MB）
   */
  private estimateMemoryUsage(): number {
    // 每个案例的估算大小（字节）
    const caseSizeBytes = 2048 // 保守估计每个案例2KB

    // 神经网络内存估算
    const networkMemoryBytes =
      this.strategyNeurons.size * 512 + // 策略神经元
      this.featureNeurons.size * 1024 // 特征神经元（包含突触权重）

    // 总内存（转换为MB）
    const totalBytes = this.learningCases.length * caseSizeBytes + networkMemoryBytes
    return totalBytes / (1024 * 1024)
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): {
    learningCasesCount: number
    maxLearningCases: number
    estimatedMemoryMB: number
    memoryUsagePercent: number
    strategyNeuronsCount: number
    featureNeuronsCount: number
  } {
    const estimatedMemoryMB = this.estimateMemoryUsage()
    const memoryUsagePercent =
      (this.learningCases.length / HEBBIAN_CONSTANTS.MAX_LEARNING_CASES) * 100

    return {
      learningCasesCount: this.learningCases.length,
      maxLearningCases: HEBBIAN_CONSTANTS.MAX_LEARNING_CASES,
      estimatedMemoryMB,
      memoryUsagePercent,
      strategyNeuronsCount: this.strategyNeurons.size,
      featureNeuronsCount: this.featureNeurons.size,
    }
  }
}
