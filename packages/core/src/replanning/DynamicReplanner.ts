/**
 * 动态重规划器主类
 *
 * 整合偏离检测、策略选择和增量规划功能
 */

import type {
  LLMAdapter,
  HierarchicalPlan,
  ExecutionState,
  DeviationReport,
  ReplanningContext,
  ReplanningResult,
  ReplanningTrigger,
  DynamicReplannerConfig,
  ReplanningHistory,
  PlanAdjustment,
} from './types.js'
import { ReplanningTriggerType, RecoveryStrategyType } from './types.js'
import { DeviationDetector } from './DeviationDetector.js'
import { RecoveryStrategySelector } from './RecoveryStrategySelector.js'
import { IncrementalPlanner } from './IncrementalPlanner.js'

/**
 * 默认配置
 */
const DEFAULT_CONFIG: DynamicReplannerConfig = {
  enableDeviationDetection: true,
  enableFailureDetection: true,
  enableTimeoutDetection: true,
  enableQualityDropDetection: true,
  deviationThreshold: 0.2,
  qualityDropThreshold: 0.15,
  timeoutTolerance: 0.25,
  preferredStrategies: [],
  maxReplanningAttempts: 3,
  minConfidenceThreshold: 0.6,
  useLLMForAnalysis: false,
  useLLMForPlanning: false,
}

/**
 * 动态重规划器
 */
export class DynamicReplanner {
  private config: DynamicReplannerConfig
  private deviationDetector: DeviationDetector
  private strategySelector: RecoveryStrategySelector
  private incrementalPlanner: IncrementalPlanner
  private replanningHistory: ReplanningHistory[]
  private llm: LLMAdapter | null

  constructor(llm: LLMAdapter | null = null, config: Partial<DynamicReplannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.llm = llm
    this.deviationDetector = new DeviationDetector()
    this.strategySelector = new RecoveryStrategySelector()
    this.incrementalPlanner = new IncrementalPlanner()
    this.replanningHistory = []
  }

  /**
   * 检测是否需要重规划
   */
  async shouldReplan(
    plannedState: ExecutionState,
    actualState: ExecutionState
  ): Promise<{ shouldReplan: boolean; trigger?: ReplanningTrigger; reason?: string }> {
    // 1. 检测失败（最高优先级）
    if (this.config.enableFailureDetection && actualState.failedGoals.size > 0) {
      return {
        shouldReplan: true,
        trigger: {
          type: ReplanningTriggerType.FAILURE,
          threshold: 0,
          description: '检测到任务失败',
          condition: (state) => state.failedGoals.size > 0,
        },
        reason: `失败任务数: ${actualState.failedGoals.size}`,
      }
    }

    // 2. 检测质量下降（高优先级）
    if (this.config.enableQualityDropDetection) {
      const qualityDrop =
        plannedState.qualityMetrics.overallQuality - actualState.qualityMetrics.overallQuality

      if (qualityDrop > this.config.qualityDropThreshold) {
        return {
          shouldReplan: true,
          trigger: {
            type: ReplanningTriggerType.QUALITY_DROP,
            threshold: this.config.qualityDropThreshold,
            description: '检测到质量下降',
            condition: (state) =>
              plannedState.qualityMetrics.overallQuality - state.qualityMetrics.overallQuality >
              this.config.qualityDropThreshold,
          },
          reason: `质量下降: ${(qualityDrop * 100).toFixed(1)}%`,
        }
      }
    }

    // 3. 检测超时
    if (this.config.enableTimeoutDetection) {
      const timeOverrun = actualState.elapsedTime / actualState.resourceUsage.estimatedTime
      if (timeOverrun > 1 + this.config.timeoutTolerance) {
        return {
          shouldReplan: true,
          trigger: {
            type: ReplanningTriggerType.TIMEOUT,
            threshold: 1 + this.config.timeoutTolerance,
            description: '检测到超时',
            condition: (state) =>
              state.elapsedTime / state.resourceUsage.estimatedTime >
              1 + this.config.timeoutTolerance,
          },
          reason: `超时比例: ${(timeOverrun * 100).toFixed(1)}%`,
        }
      }
    }

    // 4. 检测偏离（最低优先级，避免与其他检测冲突）
    if (this.config.enableDeviationDetection) {
      const deviationReport = await this.deviationDetector.detectDeviations(
        plannedState,
        actualState,
        {
          scheduleDeviation: this.config.deviationThreshold,
          qualityDeviation: this.config.qualityDropThreshold,
          resourceDeviation: this.config.timeoutTolerance,
        }
      )

      if (deviationReport.hasDeviation) {
        return {
          shouldReplan: true,
          trigger: {
            type: ReplanningTriggerType.DEVIATION,
            threshold: this.config.deviationThreshold,
            description: '检测到偏离',
            condition: (_state) =>
              deviationReport.overallDeviationScore > this.config.deviationThreshold,
          },
          reason: `偏离分数: ${deviationReport.overallDeviationScore.toFixed(2)}`,
        }
      }
    }

    return { shouldReplan: false }
  }

  /**
   * 执行重规划
   */
  async replan(
    currentPlan: HierarchicalPlan,
    executionState: ExecutionState,
    trigger: ReplanningTrigger
  ): Promise<ReplanningResult> {
    console.log(`[DynamicReplanner] 开始重规划，触发原因: ${trigger.description}`)

    // 1. 检测偏离
    const deviationReport = await this.deviationDetector.detectDeviations(
      this.createPlannedState(currentPlan),
      executionState
    )

    // 2. 创建重规划上下文
    const context: ReplanningContext = {
      originalPlan: currentPlan,
      currentState: executionState,
      deviationReport,
      trigger,
      history: this.replanningHistory,
    }

    // 3. 选择恢复策略
    const strategy = await this.strategySelector.selectBestStrategy(
      deviationReport,
      context,
      this.config.preferredStrategies
    )

    console.log(`[DynamicReplanner] 选择策略: ${strategy.name}`)

    // 4. 生成增量调整
    const adjustment = await this.incrementalPlanner.generateIncrementalAdjustment(context, {
      type: strategy.name,
      modifications: [],
      estimatedImprovement: strategy.estimatedSuccess,
      reasoning: strategy.description,
    })

    // 5. 应用调整
    const adjustedPlan = await this.incrementalPlanner.applyAdjustment(currentPlan, adjustment)

    // 6. 验证调整
    const isValid = await this.incrementalPlanner.validateAdjustment(adjustedPlan, adjustment)

    if (!isValid) {
      console.warn('[DynamicReplanner] 调整验证失败，返回原始计划')
      return {
        originalPlan: currentPlan,
        adjustedPlan: currentPlan,
        adjustment: {
          type: RecoveryStrategyType.ABORT,
          modifications: [],
          estimatedImprovement: 0,
          reasoning: '调整验证失败，中止重规划',
        },
        reasoning: '调整验证失败',
        confidence: 0,
        estimatedImprovement: 0,
      }
    }

    // 7. 计算置信度
    const confidence = this.calculateConfidence(adjustment, deviationReport)

    // 8. 记录历史
    const historyEntry: ReplanningHistory = {
      timestamp: new Date(),
      trigger: trigger.type,
      adjustment,
      result: confidence >= this.config.minConfidenceThreshold ? 'success' : 'failure',
    }
    this.replanningHistory.push(historyEntry)

    console.log(`[DynamicReplanner] 重规划完成，置信度: ${confidence.toFixed(2)}`)

    return {
      originalPlan: currentPlan,
      adjustedPlan,
      adjustment,
      reasoning: this.generateReasoning(deviationReport, strategy, adjustment),
      confidence,
      estimatedImprovement: adjustment.estimatedImprovement,
    }
  }

  /**
   * 创建计划执行状态
   */
  private createPlannedState(plan: HierarchicalPlan): ExecutionState {
    return {
      plan,
      completedGoals: new Set(),
      failedGoals: new Set(),
      startTime: Date.now(),
      elapsedTime: 0,
      qualityMetrics: {
        overallQuality: 1.0,
        taskSuccessRate: 1.0,
        averageQuality: 1.0,
        qualityTrend: 'stable',
      },
      resourceUsage: {
        tokensUsed: 0,
        estimatedTokens: plan.estimatedTokens,
        timeElapsed: 0,
        estimatedTime: plan.estimatedDuration,
        resources: new Map(),
      },
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    adjustment: PlanAdjustment,
    deviationReport: DeviationReport
  ): number {
    let confidence = 0.5 // 基础置信度

    // 根据偏离严重程度调整
    if (deviationReport.hasDeviation) {
      const maxSeverity = deviationReport.deviations.reduce(
        (max, d) => (d.severity === 'severe' ? d : max),
        {} as unknown
      )

      if ((maxSeverity as any).severity === 'severe') {
        confidence -= 0.2
      } else if ((maxSeverity as any).severity === 'moderate') {
        confidence -= 0.1
      }
    }

    // 根据修改数量调整
    const modificationCount = adjustment.modifications.length
    if (modificationCount > 5) {
      confidence -= 0.15
    } else if (modificationCount > 3) {
      confidence -= 0.05
    }

    // 根据预期改进调整
    confidence += adjustment.estimatedImprovement * 0.3

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    deviationReport: DeviationReport,
    strategy: unknown,
    adjustment: PlanAdjustment
  ): string {
    const parts: string[] = []

    // 偏离描述
    if (deviationReport.hasDeviation) {
      parts.push(`检测到${deviationReport.deviations.length}个偏离`)
      parts.push(`总体偏离分数: ${deviationReport.overallDeviationScore.toFixed(2)}`)
    }

    // 策略描述
    parts.push(`选择策略: ${(strategy as any).description}`)

    // 调整描述
    parts.push(`应用${adjustment.modifications.length}个修改`)

    return parts.join('；')
  }

  /**
   * 获取重规划历史
   */
  getHistory(): ReplanningHistory[] {
    return [...this.replanningHistory]
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.replanningHistory = []
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DynamicReplannerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取配置
   */
  getConfig(): DynamicReplannerConfig {
    return { ...this.config }
  }

  /**
   * 获取偏离检测器
   */
  getDeviationDetector(): DeviationDetector {
    return this.deviationDetector
  }

  /**
   * 获取策略选择器
   */
  getStrategySelector(): RecoveryStrategySelector {
    return this.strategySelector
  }

  /**
   * 获取增量规划器
   */
  getIncrementalPlanner(): IncrementalPlanner {
    return this.incrementalPlanner
  }
}
