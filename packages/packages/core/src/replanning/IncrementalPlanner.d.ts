/**
 * 增量规划器
 *
 * 对现有计划进行局部调整，而非完全重规划
 */
import type {
  HierarchicalPlan,
  PlanAdjustment,
  ReplanningContext,
  IncrementalPlannerConfig,
  CriticalPath,
  ImpactAssessment,
  TaskAdditionResult,
  SubGoal,
} from './types.js'
import type { TaskDecomposer } from '../planning/TaskDecomposer.js'
/**
 * 增量规划器
 */
export declare class IncrementalPlanner {
  private config
  private taskDecomposer?
  private dependencyAnalyzer
  private taskIdCounter
  private currentCriticalPath
  constructor(config?: Partial<IncrementalPlannerConfig>, taskDecomposer?: TaskDecomposer)
  /**
   * 应用增量调整
   */
  applyAdjustment(plan: HierarchicalPlan, adjustment: PlanAdjustment): Promise<HierarchicalPlan>
  /**
   * 生成增量调整
   */
  generateIncrementalAdjustment(
    context: ReplanningContext,
    strategy: PlanAdjustment
  ): Promise<PlanAdjustment>
  /**
   * 生成重试修改
   */
  private generateRetryModifications
  /**
   * 生成跳过修改
   */
  private generateSkipModifications
  /**
   * 生成重排序修改
   */
  private generateReorderModifications
  /**
   * 生成分解修改
   */
  private generateDecomposeModifications
  /**
   * 生成适应修改
   */
  private generateAdaptModifications
  /**
   * 应用单个修改
   */
  private applyModification
  /**
   * 克隆计划
   */
  private clonePlan
  /**
   * 找出被阻塞的任务
   */
  private findBlockedGoals
  /**
   * 获取优先级数值
   */
  private getPriorityValue
  /**
   * 验证调整
   */
  validateAdjustment(plan: HierarchicalPlan, adjustment: PlanAdjustment): Promise<boolean>
  /**
   * 添加新任务到计划中
   *
   * @param plan 当前计划
   * @param task 要添加的任务
   * @param dependencies 任务依赖（可选）
   * @returns 更新后的计划和影响评估
   */
  addTask(
    plan: HierarchicalPlan,
    task: SubGoal,
    dependencies?: string[]
  ): Promise<TaskAdditionResult>
  /**
   * 重新计算依赖关系
   *
   * @param plan 计划
   * @returns 更新后的依赖图
   */
  recalculateDependencies(plan: HierarchicalPlan): void
  /**
   * 重新计算关键路径
   *
   * @param plan 计划
   * @returns 新的关键路径
   */
  recalculateCriticalPath(plan: HierarchicalPlan): CriticalPath
  /**
   * 计算最早开始时间
   */
  private calculateEarliestStart
  /**
   * 计算最晚开始时间
   */
  private calculateLatestStart
  /**
   * 计算路径时长
   */
  private calculatePathDuration
  /**
   * 识别瓶颈任务
   */
  private identifyBottlenecks
  /**
   * 评估任务变更的影响
   *
   * @param task 变更的任务
   * @param newCriticalPath 新的关键路径
   * @param oldPlan 旧计划
   * @returns 影响评估报告
   */
  assessImpact(
    task: SubGoal,
    newCriticalPath: CriticalPath,
    oldPlan: HierarchicalPlan
  ): ImpactAssessment
  /**
   * 检查是否影响关键路径
   */
  private affectsCriticalPath
  /**
   * 检查资源冲突
   */
  private checkResourceConflicts
  /**
   * 生成建议措施
   */
  private generateRecommendations
  /**
   * 验证任务
   */
  private validateTask
  /**
   * 检测冲突
   */
  private detectConflicts
  /**
   * 比较两个数组是否相等
   */
  private arraysEqual
  /**
   * 生成任务ID
   */
  private generateTaskId
  /**
   * 更新配置
   */
  updateConfig(config: Partial<IncrementalPlannerConfig>): void
  /**
   * 获取配置
   */
  getConfig(): IncrementalPlannerConfig
}
//# sourceMappingURL=IncrementalPlanner.d.ts.map
