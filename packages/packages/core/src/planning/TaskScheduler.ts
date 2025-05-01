/**
 * 任务调度器
 *
 * 根据依赖图和调度策略，生成最优的任务执行顺序
 */

import type {
  DependencyGraph,
  HierarchicalPlan,
  ScheduleResult,
  PlanningTask,
  TaskSchedulerConfig,
} from './types.js'
import { Priority, TaskStatus } from './types.js'

/**
 * 任务调度器
 */
export class TaskScheduler {
  private config: Required<TaskSchedulerConfig>

  constructor(config: TaskSchedulerConfig = {}) {
    this.config = {
      strategy: config.strategy ?? 'topological',
      maxParallelTasks: config.maxParallelTasks ?? 3,
      considerResourceConstraints: config.considerResourceConstraints ?? true,
      availableResources: config.availableResources ?? [],
    }
  }

  /**
   * 调度计划，生成执行顺序
   */
  schedule(plan: HierarchicalPlan): ScheduleResult {
    switch (this.config.strategy) {
      case 'topological':
        return this.scheduleTopological(plan)
      case 'priority':
        return this.scheduleByPriority(plan)
      case 'critical_path':
        return this.scheduleByCriticalPath(plan)
      case 'parallel':
        return this.scheduleParallel(plan)
      default:
        return this.scheduleTopological(plan)
    }
  }

  /**
   * 拓扑排序调度
   */
  private scheduleTopological(plan: HierarchicalPlan): ScheduleResult {
    const { dependencies } = plan

    if (!dependencies.topologicalOrder) {
      // 有循环依赖，使用简单的顺序调度
      const executionOrder = plan.subGoals.map((g) => g.id)
      return {
        executionOrder,
        parallelGroups: [executionOrder],
        criticalPath: executionOrder,
        estimatedCompletionTime: plan.estimatedDuration,
        resourceUtilization: 1.0,
      }
    }

    const executionOrder = [...dependencies.topologicalOrder]
    const parallelGroups = this.groupParallelTasks(executionOrder, dependencies)
    const criticalPath = this.findCriticalPath(plan)

    return {
      executionOrder,
      parallelGroups,
      criticalPath,
      estimatedCompletionTime: plan.estimatedDuration,
      resourceUtilization: this.calculateResourceUtilization(parallelGroups),
    }
  }

  /**
   * 优先级调度
   */
  private scheduleByPriority(plan: HierarchicalPlan): ScheduleResult {
    // 按优先级排序
    const priorityOrder = plan.subGoals.map((g) => g.id)
    priorityOrder.sort((a, b) => {
      const goalA = plan.subGoals.find((g) => g.id === a)!
      const goalB = plan.subGoals.find((g) => g.id === b)!
      // 优先级值大的排在前面（critical=4 > high=3 > medium=2 > low=1）
      const priorityDiff =
        this.getPriorityValue(goalB.priority) - this.getPriorityValue(goalA.priority)
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      // 优先级相同时，按 ID 排序
      return a.localeCompare(b)
    })

    // 考虑依赖关系
    const executionOrder = this.respectDependencies(priorityOrder, plan.dependencies)
    const parallelGroups = this.groupParallelTasks(executionOrder, plan.dependencies)
    const criticalPath = this.findCriticalPath(plan)

    return {
      executionOrder,
      parallelGroups,
      criticalPath,
      estimatedCompletionTime: plan.estimatedDuration,
      resourceUtilization: this.calculateResourceUtilization(parallelGroups),
    }
  }

  /**
   * 关键路径调度
   */
  private scheduleByCriticalPath(plan: HierarchicalPlan): ScheduleResult {
    const criticalPath = this.findCriticalPath(plan)
    const nonCriticalGoals = plan.subGoals
      .map((g) => g.id)
      .filter((id) => !criticalPath.includes(id))

    // 关键路径优先，然后是其他任务
    const executionOrder = [...criticalPath, ...nonCriticalGoals]
    const parallelGroups = this.groupParallelTasks(executionOrder, plan.dependencies)
    const criticalPathGoals = criticalPath

    return {
      executionOrder,
      parallelGroups,
      criticalPath: criticalPathGoals,
      estimatedCompletionTime: plan.estimatedDuration,
      resourceUtilization: this.calculateResourceUtilization(parallelGroups),
    }
  }

  /**
   * 并行调度
   */
  private scheduleParallel(plan: HierarchicalPlan): ScheduleResult {
    const { dependencies } = plan

    if (!dependencies.topologicalOrder) {
      return this.scheduleTopological(plan)
    }

    const executionOrder = [...dependencies.topologicalOrder]
    const parallelGroups = this.maxParallelGrouping(executionOrder, dependencies)
    const criticalPath = this.findCriticalPath(plan)

    // 重新计算完成时间（考虑并行）
    const estimatedTime = this.calculateParallelCompletionTime(parallelGroups, plan)

    return {
      executionOrder,
      parallelGroups,
      criticalPath,
      estimatedCompletionTime: estimatedTime,
      resourceUtilization: this.calculateResourceUtilization(parallelGroups),
    }
  }

  /**
   * 将任务分组为可并行的组
   */
  private groupParallelTasks(executionOrder: string[], dependencies: DependencyGraph): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()

    for (const taskId of executionOrder) {
      if (processed.has(taskId)) {
        continue
      }

      // 找到可以和当前任务并行执行的任务
      const parallelGroup = [taskId]
      processed.add(taskId)

      // 检查剩余任务中哪些可以并行
      for (const otherId of executionOrder) {
        if (processed.has(otherId)) {
          continue
        }

        // 检查是否有依赖关系
        const hasDependency = this.checkDependency(taskId, otherId, dependencies)
        if (!hasDependency) {
          parallelGroup.push(otherId)
          processed.add(otherId)
        }

        // 限制组大小
        if (parallelGroup.length >= this.config.maxParallelTasks) {
          break
        }
      }

      groups.push(parallelGroup)
    }

    return groups
  }

  /**
   * 最大并行分组（考虑资源约束）
   */
  private maxParallelGrouping(executionOrder: string[], dependencies: DependencyGraph): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()
    const usedResources = new Set<string>()

    for (const taskId of executionOrder) {
      if (processed.has(taskId)) {
        continue
      }

      const group: string[] = []
      const groupResources = new Set<string>()

      // 找到可以并行的任务
      for (const candidateId of executionOrder) {
        if (processed.has(candidateId)) {
          continue
        }

        // 检查依赖关系
        const hasDependency = group.some((id) =>
          this.checkDependency(id, candidateId, dependencies)
        )
        if (hasDependency) {
          continue
        }

        // 检查资源约束
        const candidateResources = this.getRequiredResources(candidateId, dependencies)
        const hasResourceConflict = this.checkResourceConflict(groupResources, candidateResources)

        if (!hasResourceConflict) {
          group.push(candidateId)
          candidateResources.forEach((r) => groupResources.add(r))
          processed.add(candidateId)

          // 限制并行数
          if (group.length >= this.config.maxParallelTasks) {
            break
          }
        }
      }

      if (group.length > 0) {
        groups.push(group)
        groupResources.forEach((r) => usedResources.add(r))
      }
    }

    return groups
  }

  /**
   * 检查两个任务是否有依赖关系
   */
  private checkDependency(
    taskIdA: string,
    taskIdB: string,
    dependencies: DependencyGraph
  ): boolean {
    // 检查 A -> B
    const aToB = dependencies.edges.some((e) => e.from === taskIdA && e.to === taskIdB)
    // 检查 B -> A
    const bToA = dependencies.edges.some((e) => e.from === taskIdB && e.to === taskIdA)

    return aToB || bToA
  }

  /**
   * 获取任务需要的资源
   */
  private getRequiredResources(taskId: string, dependencies: DependencyGraph): string[] {
    const node = dependencies.nodes.get(taskId)
    if (!node) {
      return []
    }

    const resources = new Set<string>()
    node.tasks.forEach((task) => {
      task.requiredCapabilities.forEach((cap) => resources.add(cap))
    })

    return Array.from(resources)
  }

  /**
   * 检查资源冲突
   */
  private checkResourceConflict(usedResources: Set<string>, requiredResources: string[]): boolean {
    if (!this.config.considerResourceConstraints) {
      return false
    }

    // 如果没有可用资源限制，则无冲突
    if (this.config.availableResources.length === 0) {
      return false
    }

    // 检查是否有资源重叠且超过限制
    for (const resource of requiredResources) {
      if (usedResources.has(resource)) {
        return true
      }
    }

    return false
  }

  /**
   * 调整顺序以尊重依赖关系
   */
  private respectDependencies(order: string[], dependencies: DependencyGraph): string[] {
    const adjusted: string[] = []
    const remaining = new Set(order)

    while (remaining.size > 0) {
      // 找到所有依赖已满足的任务
      let added = false
      for (const taskId of remaining) {
        const incomingEdges = dependencies.edges.filter((e) => e.to === taskId)
        const dependenciesSatisfied = incomingEdges.every((e) => adjusted.includes(e.from))

        if (dependenciesSatisfied) {
          adjusted.push(taskId)
          remaining.delete(taskId)
          added = true
          break
        }
      }

      // 如果没有找到（可能有循环），取第一个
      if (!added) {
        const first = remaining.values().next().value as string
        if (first) {
          adjusted.push(first)
          remaining.delete(first)
        }
      }
    }

    return adjusted
  }

  /**
   * 查找关键路径
   */
  private findCriticalPath(plan: HierarchicalPlan): string[] {
    const { dependencies } = plan

    if (dependencies.hasCycles || !dependencies.topologicalOrder) {
      return plan.subGoals.map((g) => g.id)
    }

    const earliestStart = new Map<string, number>()
    const latestStart = new Map<string, number>()

    // 初始化
    dependencies.nodes.forEach((node, id) => {
      earliestStart.set(id, 0)
      latestStart.set(id, Infinity)
    })

    // 计算最早开始时间
    const order = dependencies.topologicalOrder
    for (const nodeId of order) {
      const incomingEdges = dependencies.edges.filter((e) => e.to === nodeId)
      for (const edge of incomingEdges) {
        const fromDuration = dependencies.nodes.get(edge.from)?.estimatedDuration || 0
        const newStart = (earliestStart.get(edge.from) || 0) + fromDuration
        earliestStart.set(nodeId, Math.max(earliestStart.get(nodeId) || 0, newStart))
      }
    }

    // 计算最晚开始时间（从后往前）
    for (let i = order.length - 1; i >= 0; i--) {
      const nodeId = order[i]
      const outgoingEdges = dependencies.edges.filter((e) => e.from === nodeId)
      const currentNode = dependencies.nodes.get(nodeId)

      if (outgoingEdges.length === 0) {
        // 终点节点：最晚开始时间 = 最早开始时间
        latestStart.set(nodeId, earliestStart.get(nodeId) || 0)
      } else {
        // 非终点节点：最晚开始时间 = min(后继节点的最晚开始时间) - 当前节点持续时间
        let minLatest = Infinity
        for (const edge of outgoingEdges) {
          const toLatest = latestStart.get(edge.to) || Infinity
          minLatest = Math.min(minLatest, toLatest)
        }
        // 减去当前节点的持续时间
        const currentDuration = currentNode?.estimatedDuration || 0
        latestStart.set(nodeId, Math.max(0, minLatest - currentDuration))
      }
    }

    // 找出关键路径上的节点
    const criticalPath: string[] = []
    for (const nodeId of order) {
      if (Math.abs((earliestStart.get(nodeId) || 0) - (latestStart.get(nodeId) || 0)) < 0.01) {
        criticalPath.push(nodeId)
      }
    }

    return criticalPath
  }

  /**
   * 计算并行完成时间
   */
  private calculateParallelCompletionTime(
    parallelGroups: string[][],
    plan: HierarchicalPlan
  ): number {
    let totalTime = 0

    for (const group of parallelGroups) {
      // 每组的时间 = 组中最长的任务时间
      const maxGroupTime = Math.max(
        ...group.map((id) => {
          const goal = plan.subGoals.find((g) => g.id === id)
          return goal?.estimatedDuration || 0
        })
      )
      totalTime += maxGroupTime
    }

    return totalTime
  }

  /**
   * 计算资源利用率
   */
  private calculateResourceUtilization(parallelGroups: string[][]): number {
    if (parallelGroups.length === 0) {
      return 0
    }

    const avgTasksPerGroup =
      parallelGroups.reduce((sum, group) => sum + group.length, 0) / parallelGroups.length

    const utilization = avgTasksPerGroup / this.config.maxParallelTasks
    return Math.min(1.0, Math.max(0.0, utilization))
  }

  /**
   * 获取优先级数值（用于排序）
   */
  private getPriorityValue(priority: Priority): number {
    const values = {
      [Priority.CRITICAL]: 4,
      [Priority.HIGH]: 3,
      [Priority.MEDIUM]: 2,
      [Priority.LOW]: 1,
    }
    return values[priority] || 0
  }

  /**
   * 获取下一个可执行的任务
   */
  getNextExecutableTasks(plan: HierarchicalPlan, completedTasks: Set<string>): PlanningTask[] {
    const nextTasks: PlanningTask[] = []

    for (const subGoal of plan.subGoals) {
      // 跳过已完成的子目标
      if (completedTasks.has(subGoal.id)) {
        continue
      }

      // 检查依赖是否满足
      const dependencies = plan.dependencies.edges.filter((e) => e.to === subGoal.id)
      const dependenciesSatisfied = dependencies.every((e) => completedTasks.has(e.from))

      if (dependenciesSatisfied) {
        // 找到该子目标中待执行的任务
        const pendingTasks = subGoal.tasks.filter((t) => t.status === TaskStatus.PENDING)
        nextTasks.push(...pendingTasks)
      }
    }

    return nextTasks
  }

  /**
   * 检查是否所有任务都已完成
   */
  isPlanComplete(plan: HierarchicalPlan): boolean {
    return plan.subGoals.every((goal) =>
      goal.tasks.every((task) => task.status === TaskStatus.COMPLETED)
    )
  }

  /**
   * 获取执行进度
   */
  getProgress(plan: HierarchicalPlan): {
    totalTasks: number
    completedTasks: number
    progress: number // 0-1
    byGoal: Array<{ goalId: string; goalTitle: string; progress: number }>
  } {
    let totalTasks = 0
    let completedTasks = 0
    const byGoal: Array<{ goalId: string; goalTitle: string; progress: number }> = []

    for (const goal of plan.subGoals) {
      const goalTotal = goal.tasks.length
      const goalCompleted = goal.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length
      const goalProgress = goalTotal > 0 ? goalCompleted / goalTotal : 1

      totalTasks += goalTotal
      completedTasks += goalCompleted

      byGoal.push({
        goalId: goal.id,
        goalTitle: goal.title,
        progress: goalProgress,
      })
    }

    const progress = totalTasks > 0 ? completedTasks / totalTasks : 1

    return {
      totalTasks,
      completedTasks,
      progress,
      byGoal,
    }
  }
}
