/**
 * 动态重规划器主类
 *
 * 整合偏离检测、策略选择和增量规划功能
 */
import type {
  LLMAdapter,
  HierarchicalPlan,
  ExecutionState,
  ReplanningResult,
  ReplanningTrigger,
  DynamicReplannerConfig,
  ReplanningHistory,
} from './types.js'
import { DeviationDetector } from './DeviationDetector.js'
import { RecoveryStrategySelector } from './RecoveryStrategySelector.js'
import { IncrementalPlanner } from './IncrementalPlanner.js'
/**
 * 动态重规划器
 */
export declare class DynamicReplanner {
  private config
  private deviationDetector
  private strategySelector
  private incrementalPlanner
  private replanningHistory
  private llm
  constructor(llm?: LLMAdapter | null, config?: Partial<DynamicReplannerConfig>)
  /**
   * 检测是否需要重规划
   */
  shouldReplan(
    plannedState: ExecutionState,
    actualState: ExecutionState
  ): Promise<{
    shouldReplan: boolean
    trigger?: ReplanningTrigger
    reason?: string
  }>
  /**
   * 执行重规划
   */
  replan(
    currentPlan: HierarchicalPlan,
    executionState: ExecutionState,
    trigger: ReplanningTrigger
  ): Promise<ReplanningResult>
  /**
   * 创建计划执行状态
   */
  private createPlannedState
  /**
   * 计算置信度
   */
  private calculateConfidence
  /**
   * 生成推理说明
   */
  private generateReasoning
  /**
   * 获取重规划历史
   */
  getHistory(): ReplanningHistory[]
  /**
   * 清除历史
   */
  clearHistory(): void
  /**
   * 更新配置
   */
  updateConfig(config: Partial<DynamicReplannerConfig>): void
  /**
   * 获取配置
   */
  getConfig(): DynamicReplannerConfig
  /**
   * 获取偏离检测器
   */
  getDeviationDetector(): DeviationDetector
  /**
   * 获取策略选择器
   */
  getStrategySelector(): RecoveryStrategySelector
  /**
   * 获取增量规划器
   */
  getIncrementalPlanner(): IncrementalPlanner
}
//# sourceMappingURL=DynamicReplanner.d.ts.map
