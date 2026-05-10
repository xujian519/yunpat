/**
 * 增量规划器 — Facade
 *
 * 对现有计划进行局部调整，而非完全重规划。
 * 纯计算函数委托到 PlanCalculations.ts。
 */

import type {
  HierarchicalPlan,
  PlanAdjustment,
  ReplanningContext,
  IncrementalPlannerConfig,
  TaskModification,
  CriticalPath,
  ImpactAssessment,
  TaskAdditionResult,
} from './types.js'
import { PlanConflictError, CircularDependencyError } from './types.js'
import { Priority, TaskStatus, DependencyType, TaskType } from '../planning/types.js'
import type { TaskDecomposer } from '../planning/TaskDecomposer.js'
import { DependencyAnalyzer } from '../planning/DependencyAnalyzer.js'
import {
  calculateCriticalPath,
  assessImpact,
  generateRetryModifications,
  generateSkipModifications,
  generateReorderModifications,
  generateDecomposeModifications,
  generateAdaptModifications,
  getPriorityValue,
} from './PlanCalculations.js'

/**
 * 增量规划器
 */
export class IncrementalPlanner {
  private config: Required<IncrementalPlannerConfig>
  private taskDecomposer?: TaskDecomposer
  private dependencyAnalyzer: DependencyAnalyzer
  private taskIdCounter: number = 0
  private currentCriticalPath: CriticalPath | null = null

  constructor(config: Partial<IncrementalPlannerConfig> = {}, taskDecomposer?: TaskDecomposer) {
    this.config = {
      maxModifications: config.maxModifications ?? 5,
      preserveCriticalPath: config.preserveCriticalPath ?? true,
      allowDependencyChanges: config.allowDependencyChanges ?? false,
      minImprovementThreshold: config.minImprovementThreshold ?? 0.1,
    }
    this.taskDecomposer = taskDecomposer
    this.dependencyAnalyzer = new DependencyAnalyzer()
  }

  async applyAdjustment(
    plan: HierarchicalPlan,
    adjustment: PlanAdjustment
  ): Promise<HierarchicalPlan> {
    const adjustedPlan = this.clonePlan(plan)

    for (const modification of adjustment.modifications) {
      await this.applyModification(adjustedPlan, modification)
    }

    this.recalculateDependencies(adjustedPlan)

    return adjustedPlan
  }

  async generateIncrementalAdjustment(
    context: ReplanningContext,
    strategy: PlanAdjustment
  ): Promise<PlanAdjustment> {
    const modifications: TaskModification[] = []

    switch (strategy.type) {
      case 'retry':
        modifications.push(...generateRetryModifications(context))
        break
      case 'skip':
        modifications.push(...generateSkipModifications(context, this.findBlockedGoals(context)))
        break
      case 'reorder':
        modifications.push(...generateReorderModifications(context))
        break
      case 'decompose':
        modifications.push(...generateDecomposeModifications(context))
        break
      case 'adapt':
        modifications.push(...generateAdaptModifications(context))
        break
      case 'abort':
        break
    }

    const limitedModifications = modifications.slice(0, this.config.maxModifications)

    return {
      type: strategy.type,
      modifications: limitedModifications,
      estimatedImprovement: strategy.estimatedImprovement,
      reasoning: strategy.reasoning,
    }
  }

  async validateAdjustment(plan: HierarchicalPlan, adjustment: PlanAdjustment): Promise<boolean> {
    if (adjustment.modifications.length > this.config.maxModifications) {
      console.warn(
        `[IncrementalPlanner] 修改数量超过限制: ${adjustment.modifications.length} > ${this.config.maxModifications}`
      )
      return false
    }

    if (adjustment.estimatedImprovement < this.config.minImprovementThreshold) {
      console.warn(
        `[IncrementalPlanner] 预期改进低于阈值: ${adjustment.estimatedImprovement} < ${this.config.minImprovementThreshold}`
      )
      return false
    }

    if (this.config.preserveCriticalPath && plan.dependencies.topologicalOrder) {
      const criticalPath = calculateCriticalPath(plan)
      for (const mod of adjustment.modifications) {
        if (criticalPath.tasks.includes(mod.goalId) && mod.type === 'remove') {
          console.warn(`[IncrementalPlanner] 拒绝修改: 目标 ${mod.goalId} 在关键路径上，不允许删除`)
          return false
        }
      }
    }

    return true
  }

  async addTask(
    plan: HierarchicalPlan,
    task: import('./types.js').SubGoal,
    dependencies?: string[]
  ): Promise<TaskAdditionResult> {
    this.validateTask(task)

    const conflicts = this.detectConflicts(plan, task)
    if (conflicts.length > 0) {
      throw new PlanConflictError(conflicts)
    }

    const updatedPlan = this.clonePlan(plan)
    updatedPlan.subGoals.push(task)

    if (dependencies) {
      for (const depId of dependencies) {
        updatedPlan.dependencies.edges.push({
          from: depId,
          to: task.id,
          type: DependencyType.STRONG,
          strength: 1.0,
          description: '显式依赖',
        })
      }
    }

    this.recalculateDependencies(updatedPlan)

    const newCriticalPath = calculateCriticalPath(updatedPlan)
    this.currentCriticalPath = newCriticalPath

    const impact = assessImpact(task, newCriticalPath, updatedPlan, this.currentCriticalPath)

    return {
      addedTask: {
        taskId: task.id,
        task,
      },
      affectedTasks: impact.affectedTasks,
      newCriticalPath,
      impact,
    }
  }

  recalculateDependencies(plan: HierarchicalPlan): void {
    const nodes = new Map<string, import('./types.js').SubGoal>()
    plan.subGoals.forEach((goal) => {
      nodes.set(goal.id, goal)
    })

    const edges = [...plan.dependencies.edges]

    let hasCycles = false
    if (this.dependencyAnalyzer['detectCycles'](nodes, edges)) {
      hasCycles = true
    }

    if (hasCycles) {
      throw new CircularDependencyError('检测到循环依赖')
    }

    let topologicalOrder: string[] | undefined
    if (!hasCycles) {
      topologicalOrder = this.dependencyAnalyzer['topologicalSort'](nodes, edges)
    }

    plan.dependencies = {
      nodes,
      edges,
      hasCycles,
      topologicalOrder,
    }
  }

  recalculateCriticalPath(plan: HierarchicalPlan): CriticalPath {
    return calculateCriticalPath(plan)
  }

  assessImpact(
    task: import('./types.js').SubGoal,
    newCriticalPath: CriticalPath,
    oldPlan: HierarchicalPlan
  ): ImpactAssessment {
    return assessImpact(task, newCriticalPath, oldPlan, this.currentCriticalPath)
  }

  updateConfig(config: Partial<IncrementalPlannerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): IncrementalPlannerConfig {
    return { ...this.config }
  }

  private async applyModification(
    plan: HierarchicalPlan,
    modification: TaskModification
  ): Promise<void> {
    const goal = plan.subGoals.find((g) => g.id === modification.goalId)
    if (!goal) {
      console.warn(`[IncrementalPlanner] 找不到子目标: ${modification.goalId}`)
      return
    }

    switch (modification.type) {
      case 'add':
        if (!this.taskDecomposer) {
          throw new Error('需要TaskDecomposer来添加新子目标')
        }

        if (
          modification.changes?.newDependencies &&
          Array.isArray(modification.changes.newDependencies)
        ) {
          for (const depId of modification.changes.newDependencies) {
            if (!plan.subGoals.some((g) => g.id === depId)) {
              console.warn(`[IncrementalPlanner] 依赖目标 ${depId} 不存在，跳过添加`)
            }
          }
        }

        const newGoal = this.createSubGoalFromModification(modification)
        plan.subGoals.push(newGoal)

        if (
          modification.changes?.newDependencies &&
          Array.isArray(modification.changes.newDependencies)
        ) {
          for (const depId of modification.changes.newDependencies) {
            if (plan.subGoals.some((g) => g.id === depId)) {
              plan.dependencies.edges.push({
                from: depId,
                to: newGoal.id,
                type: DependencyType.STRONG,
                strength: 1.0,
                description: '增量添加的依赖',
              })
            }
          }
        }
        break

      case 'remove': {
        const index = plan.subGoals.indexOf(goal)
        if (index > -1) {
          plan.subGoals.splice(index, 1)
        }
        break
      }

      case 'modify':
        if (modification.changes) {
          if (modification.changes.newDependencies !== undefined) {
            if (!this.config.allowDependencyChanges) {
              console.warn('[IncrementalPlanner] 不允许修改依赖关系')
            } else {
              goal.dependencies = modification.changes.newDependencies
            }
          }

          if (modification.changes.newPriority !== undefined) {
            goal.priority = modification.changes.newPriority as unknown as Priority
          }

          if (modification.changes.newStatus !== undefined) {
            goal.status = modification.changes.newStatus as TaskStatus
          }

          if (modification.changes.newEstimate !== undefined) {
            if (modification.changes.newEstimate.duration !== undefined) {
              goal.estimatedDuration = modification.changes.newEstimate.duration
            }
            if (modification.changes.newEstimate.tokens !== undefined) {
              goal.estimatedTokens = modification.changes.newEstimate.tokens
            }
          }
        }
        break

      case 'reorder':
        break
    }
  }

  private clonePlan(plan: HierarchicalPlan): HierarchicalPlan {
    return {
      ...plan,
      subGoals: plan.subGoals.map((goal) => ({ ...goal })),
      dependencies: {
        ...plan.dependencies,
        nodes: new Map(plan.dependencies.nodes),
        edges: [...plan.dependencies.edges],
      },
    }
  }

  private findBlockedGoals(context: ReplanningContext): string[] {
    const blockedGoals: string[] = []
    const completedGoals = context.currentState.completedGoals

    for (const edge of context.originalPlan.dependencies.edges) {
      const fromCompleted = completedGoals.has(edge.from)
      const toCompleted = completedGoals.has(edge.to)

      if (toCompleted && !fromCompleted) {
        const dependents = context.originalPlan.dependencies.edges
          .filter((e) => e.from === edge.to)
          .map((e) => e.to)

        if (dependents.length > 0) {
          blockedGoals.push(...dependents)
        }
      }
    }

    return [...new Set(blockedGoals)]
  }

  private validateTask(task: import('./types.js').SubGoal): void {
    if (!task.id || task.id.trim() === '') {
      throw new Error('任务ID不能为空')
    }
    if (!task.title || task.title.trim() === '') {
      throw new Error('任务标题不能为空')
    }
    if (task.estimatedDuration <= 0) {
      throw new Error('任务预估时长必须大于0')
    }
    if (task.estimatedTokens <= 0) {
      throw new Error('任务预估Token数必须大于0')
    }
    if (task.tasks.length === 0) {
      throw new Error('任务必须包含至少一个子任务')
    }
  }

  private detectConflicts(plan: HierarchicalPlan, task: import('./types.js').SubGoal): string[] {
    const conflicts: string[] = []

    if (plan.subGoals.some((g) => g.id === task.id)) {
      conflicts.push(`任务ID ${task.id} 已存在`)
    }

    if (task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        if (!plan.subGoals.some((g) => g.id === depId)) {
          conflicts.push(`依赖的任务 ${depId} 不存在`)
        }
      }
    }

    return conflicts
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${this.taskIdCounter++}`
  }

  private createSubGoalFromModification(
    modification: TaskModification
  ): import('./types.js').SubGoal {
    const goalId = `goal_${this.generateTaskId()}`
    return {
      id: goalId,
      title: `新增目标 ${goalId}`,
      description: '',
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      estimatedDuration: modification.changes?.newEstimate?.duration ?? 1.0,
      estimatedTokens: modification.changes?.newEstimate?.tokens ?? 500,
      dependencies: (modification.changes?.newDependencies as string[]) || [],
      tasks: [
        {
          id: `task_${this.generateTaskId()}`,
          title: `执行 ${goalId}`,
          description: '新增子目标的默认任务',
          type: TaskType.ANALYSIS,
          status: TaskStatus.PENDING,
          requiredCapabilities: [],
          estimatedTokens: modification.changes?.newEstimate?.tokens ?? 500,
          estimatedDuration: modification.changes?.newEstimate?.duration ?? 1.0,
          createdAt: new Date(),
        },
      ],
    }
  }
}
