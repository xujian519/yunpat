/**
 * 增量规划器 — 关键路径计算和影响评估
 *
 * @module replanning/PlanCalculations
 */

import type {
  HierarchicalPlan,
  CriticalPath,
  ImpactAssessment,
  ResourceConflict,
  SubGoal,
} from './types.js'

export function calculateEarliestStart(plan: HierarchicalPlan): Map<string, number> {
  const earliestStart = new Map<string, number>()
  const { dependencies } = plan

  dependencies.nodes.forEach((_, id) => {
    earliestStart.set(id, 0)
  })

  const order = dependencies.topologicalOrder || []

  for (const taskId of order) {
    const incomingEdges = dependencies.edges.filter((e) => e.to === taskId)

    if (incomingEdges.length === 0) {
      earliestStart.set(taskId, 0)
    } else {
      let maxDepTime = 0
      for (const edge of incomingEdges) {
        const depTask = dependencies.nodes.get(edge.from)
        if (!depTask) continue

        const depStartTime = earliestStart.get(edge.from) || 0
        const depFinishTime = depStartTime + depTask.estimatedDuration
        maxDepTime = Math.max(maxDepTime, depFinishTime)
      }
      earliestStart.set(taskId, maxDepTime)
    }
  }

  return earliestStart
}

export function calculateLatestStart(
  plan: HierarchicalPlan,
  earliestStart: Map<string, number>
): Map<string, number> {
  const latestStart = new Map<string, number>()
  const { dependencies } = plan
  const order = dependencies.topologicalOrder || []

  if (order.length === 0) {
    return latestStart
  }

  let projectDuration = 0
  for (const taskId of order) {
    const task = dependencies.nodes.get(taskId)
    const startTime = earliestStart.get(taskId) || 0
    const finishTime = startTime + (task?.estimatedDuration || 0)
    projectDuration = Math.max(projectDuration, finishTime)
  }

  const reversedOrder = [...order].reverse()

  for (const taskId of reversedOrder) {
    const task = dependencies.nodes.get(taskId)
    const taskDuration = task?.estimatedDuration || 0
    const outgoingEdges = dependencies.edges.filter((e) => e.from === taskId)

    if (outgoingEdges.length === 0) {
      latestStart.set(taskId, projectDuration - taskDuration)
    } else {
      let minDepTime = Infinity
      for (const edge of outgoingEdges) {
        const depLatestStart = latestStart.get(edge.to) || Infinity
        minDepTime = Math.min(minDepTime, depLatestStart)
      }
      latestStart.set(taskId, Math.max(0, minDepTime - taskDuration))
    }
  }

  return latestStart
}

export function calculatePathDuration(plan: HierarchicalPlan, taskIds: string[]): number {
  let totalDuration = 0
  const { dependencies } = plan

  for (const taskId of taskIds) {
    const task = dependencies.nodes.get(taskId)
    totalDuration += task?.estimatedDuration || 0
  }

  return totalDuration
}

export function identifyBottlenecks(plan: HierarchicalPlan, criticalTasks: string[]): string[] {
  const { dependencies } = plan

  return criticalTasks.filter((taskId) => {
    const outgoingEdges = dependencies.edges.filter((e) => e.from === taskId)
    return outgoingEdges.length >= 2
  })
}

export function calculateCriticalPath(plan: HierarchicalPlan): CriticalPath {
  const { dependencies } = plan

  if (dependencies.hasCycles || !dependencies.topologicalOrder) {
    return {
      tasks: plan.subGoals.map((g) => g.id),
      duration: plan.estimatedDuration,
      slackTime: new Map(),
      bottleneckTasks: [],
    }
  }

  const earliestStart = calculateEarliestStart(plan)
  const latestStart = calculateLatestStart(plan, earliestStart)

  const slackTime = new Map<string, number>()
  for (const taskId of dependencies.nodes.keys()) {
    const slack = (latestStart.get(taskId) || 0) - (earliestStart.get(taskId) || 0)
    slackTime.set(taskId, Math.max(0, slack))
  }

  const criticalTasks = Array.from(slackTime.entries())
    .filter(([_, slack]) => Math.abs(slack) < 0.01)
    .map(([taskId]) => taskId)

  const pathDuration = calculatePathDuration(plan, criticalTasks)
  const bottleneckTasks = identifyBottlenecks(plan, criticalTasks)

  return {
    tasks: criticalTasks,
    duration: pathDuration,
    slackTime,
    bottleneckTasks,
  }
}

export function affectsCriticalPath(
  task: SubGoal,
  oldCriticalPath: CriticalPath,
  newCriticalPath: CriticalPath
): boolean {
  const taskInNewPath = newCriticalPath.tasks.includes(task.id)
  const pathChanged = !arraysEqual(oldCriticalPath.tasks, newCriticalPath.tasks)
  return taskInNewPath || pathChanged
}

export function checkResourceConflicts(task: SubGoal, plan: HierarchicalPlan): ResourceConflict[] {
  const conflicts: ResourceConflict[] = []

  const taskResources = new Set<string>()
  task.tasks.forEach((t) => {
    t.requiredCapabilities.forEach((cap) => taskResources.add(cap))
  })

  for (const otherGoal of plan.subGoals) {
    if (otherGoal.id === task.id) continue

    const otherResources = new Set<string>()
    otherGoal.tasks.forEach((t) => {
      t.requiredCapabilities.forEach((cap) => otherResources.add(cap))
    })

    const overlappingResources = Array.from(taskResources).filter((r) => otherResources.has(r))

    if (overlappingResources.length > 0) {
      conflicts.push({
        resourceType: overlappingResources[0],
        taskIds: [task.id, otherGoal.id],
        severity: overlappingResources.length > 2 ? 'severe' : 'moderate',
      })
    }
  }

  return conflicts
}

export function generateRecommendations(
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  delay: number
): string[] {
  const recommendations: string[] = []

  if (impactLevel === 'HIGH') {
    if (delay > 0) {
      recommendations.push('考虑增加并行度以缩短关键路径')
      recommendations.push('评估是否可以移除某些依赖关系')
    } else {
      recommendations.push('优化已显著改善计划')
    }
  } else if (impactLevel === 'MEDIUM') {
    recommendations.push('监控资源使用情况')
    if (delay > 0) {
      recommendations.push('考虑调整非关键任务的优先级')
    }
  }

  return recommendations
}

export function assessImpact(
  task: SubGoal,
  newCriticalPath: CriticalPath,
  oldPlan: HierarchicalPlan,
  oldCriticalPath: CriticalPath | null
): ImpactAssessment {
  const fallbackPath: CriticalPath = {
    tasks: [],
    duration: 0,
    slackTime: new Map(),
    bottleneckTasks: [],
  }
  const oldCP = oldCriticalPath || fallbackPath

  const affectedTasks: string[] = []
  let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'

  if (affectsCriticalPath(task, oldCP, newCriticalPath)) {
    affectedTasks.push(...newCriticalPath.tasks)
    impactLevel = 'HIGH'
  }

  affectedTasks.push(task.id)

  const dependents = oldPlan.dependencies.edges.filter((e) => e.from === task.id).map((e) => e.to)
  affectedTasks.push(...dependents)

  const resourceConflicts = checkResourceConflicts(task, oldPlan)
  if (resourceConflicts.length > 0) {
    impactLevel = impactLevel === 'HIGH' ? 'HIGH' : 'MEDIUM'
  }

  const newProjectDuration = newCriticalPath.duration
  const oldProjectDuration = oldCP.duration || oldPlan.estimatedDuration
  const delay = newProjectDuration - oldProjectDuration

  if (Math.abs(delay) > oldProjectDuration * 0.1) {
    impactLevel = 'HIGH'
  } else if (Math.abs(delay) > oldProjectDuration * 0.05) {
    impactLevel = impactLevel === 'HIGH' ? 'HIGH' : 'MEDIUM'
  }

  return {
    affectedTasks: Array.from(new Set(affectedTasks)),
    impactLevel,
    newProjectDuration,
    delay,
    resourceConflicts,
    criticalPathChanged: !arraysEqual(oldCP.tasks, newCriticalPath.tasks),
    recommendations: generateRecommendations(impactLevel, delay),
  }
}

export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function getPriorityValue(priority: unknown): number {
  const values: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return values[priority as keyof typeof values] || 0
}

export function generateRetryModifications(
  context: import('./types.js').ReplanningContext
): import('./types.js').TaskModification[] {
  const modifications: import('./types.js').TaskModification[] = []

  for (const failedGoal of context.currentState.failedGoals) {
    const goal = context.originalPlan.subGoals.find((g) => g.id === failedGoal)
    if (goal) {
      modifications.push({
        type: 'modify',
        goalId: failedGoal,
        changes: {
          newStatus: 'pending',
          newEstimate: {
            duration: goal.estimatedDuration * 1.2,
            tokens: goal.estimatedTokens * 1.1,
          },
        },
      })
    }
  }

  return modifications
}

export function generateSkipModifications(
  context: import('./types.js').ReplanningContext,
  blockedGoals: string[]
): import('./types.js').TaskModification[] {
  return blockedGoals.map((blockedGoal) => ({
    type: 'modify' as const,
    goalId: blockedGoal,
    changes: { newStatus: 'skipped' },
  }))
}

export function generateReorderModifications(
  context: import('./types.js').ReplanningContext
): import('./types.js').TaskModification[] {
  const modifications: import('./types.js').TaskModification[] = []

  const pendingGoals = context.originalPlan.subGoals
    .filter((g) => !context.currentState.completedGoals.has(g.id))
    .sort((a, b) => {
      const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority)
      if (priorityDiff !== 0) return priorityDiff
      return a.estimatedDuration - b.estimatedDuration
    })

  for (let i = 0; i < pendingGoals.length; i++) {
    modifications.push({
      type: 'modify',
      goalId: pendingGoals[i].id,
      changes: { newPriority: Math.max(1, 10 - i) },
    })
  }

  return modifications
}

export function generateDecomposeModifications(
  context: import('./types.js').ReplanningContext
): import('./types.js').TaskModification[] {
  const modifications: import('./types.js').TaskModification[] = []

  const complexGoals = context.originalPlan.subGoals.filter((g) => {
    const avgDuration =
      context.originalPlan.subGoals.reduce((sum, g) => sum + g.estimatedDuration, 0) /
      context.originalPlan.subGoals.length

    const avgTokens =
      context.originalPlan.subGoals.reduce((sum, g) => sum + g.estimatedTokens, 0) /
      context.originalPlan.subGoals.length

    return (
      !context.currentState.completedGoals.has(g.id) &&
      (g.estimatedDuration > avgDuration * 1.5 || g.estimatedTokens > avgTokens * 1.5)
    )
  })

  for (const goal of complexGoals) {
    modifications.push({
      type: 'modify',
      goalId: goal.id,
      changes: {
        newEstimate: {
          duration: goal.estimatedDuration * 0.6,
          tokens: goal.estimatedTokens * 0.6,
        },
      },
    })
  }

  return modifications
}

export function generateAdaptModifications(
  context: import('./types.js').ReplanningContext
): import('./types.js').TaskModification[] {
  const modifications: import('./types.js').TaskModification[] = []
  const resourceUsage = context.currentState.resourceUsage
  const tokenOverrun = resourceUsage.tokensUsed / resourceUsage.estimatedTokens

  if (tokenOverrun > 1.2) {
    for (const goal of context.originalPlan.subGoals) {
      if (!context.currentState.completedGoals.has(goal.id)) {
        modifications.push({
          type: 'modify',
          goalId: goal.id,
          changes: {
            newEstimate: {
              tokens: Math.floor(goal.estimatedTokens * 0.8),
            },
          },
        })
      }
    }
  }

  return modifications
}
