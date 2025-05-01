/**
 * 任务调度器
 *
 * 根据依赖图和调度策略，生成最优的任务执行顺序
 */
import type {
  HierarchicalPlan,
  ScheduleResult,
  PlanningTask,
  TaskSchedulerConfig,
} from './types.js'
/**
 * 任务调度器
 */
export declare class TaskScheduler {
  private config
  constructor(config?: TaskSchedulerConfig)
  /**
   * 调度计划，生成执行顺序
   */
  schedule(plan: HierarchicalPlan): ScheduleResult
  /**
   * 拓扑排序调度
   */
  private scheduleTopological
  /**
   * 优先级调度
   */
  private scheduleByPriority
  /**
   * 关键路径调度
   */
  private scheduleByCriticalPath
  /**
   * 并行调度
   */
  private scheduleParallel
  /**
   * 将任务分组为可并行的组
   */
  private groupParallelTasks
  /**
   * 最大并行分组（考虑资源约束）
   */
  private maxParallelGrouping
  /**
   * 检查两个任务是否有依赖关系
   */
  private checkDependency
  /**
   * 获取任务需要的资源
   */
  private getRequiredResources
  /**
   * 检查资源冲突
   */
  private checkResourceConflict
  /**
   * 调整顺序以尊重依赖关系
   */
  private respectDependencies
  /**
   * 查找关键路径
   */
  private findCriticalPath
  /**
   * 计算并行完成时间
   */
  private calculateParallelCompletionTime
  /**
   * 计算资源利用率
   */
  private calculateResourceUtilization
  /**
   * 获取优先级数值（用于排序）
   */
  private getPriorityValue
  /**
   * 获取下一个可执行的任务
   */
  getNextExecutableTasks(plan: HierarchicalPlan, completedTasks: Set<string>): PlanningTask[]
  /**
   * 检查是否所有任务都已完成
   */
  isPlanComplete(plan: HierarchicalPlan): boolean
  /**
   * 获取执行进度
   */
  getProgress(plan: HierarchicalPlan): {
    totalTasks: number
    completedTasks: number
    progress: number
    byGoal: Array<{
      goalId: string
      goalTitle: string
      progress: number
    }>
  }
}
//# sourceMappingURL=TaskScheduler.d.ts.map
