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
  TaskModification,
  CriticalPath,
  ImpactAssessment,
  TaskAdditionResult,
  ResourceConflict,
  DependencyGraph,
  SubGoal,
} from './types.js';
import { PlanConflictError, CircularDependencyError } from './types.js';
import { Priority, TaskStatus, DependencyType } from '../planning/types.js';
import type { TaskDecomposer } from '../planning/TaskDecomposer.js';
import { DependencyAnalyzer } from '../planning/DependencyAnalyzer.js';

/**
 * 增量规划器
 */
export class IncrementalPlanner {
  private config: Required<IncrementalPlannerConfig>;
  private taskDecomposer?: TaskDecomposer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private taskIdCounter: number = 0;
  private currentCriticalPath: CriticalPath | null = null;

  constructor(config: Partial<IncrementalPlannerConfig> = {}, taskDecomposer?: TaskDecomposer) {
    this.config = {
      maxModifications: config.maxModifications ?? 5,
      preserveCriticalPath: config.preserveCriticalPath ?? true,
      allowDependencyChanges: config.allowDependencyChanges ?? false,
      minImprovementThreshold: config.minImprovementThreshold ?? 0.1,
    };
    this.taskDecomposer = taskDecomposer;
    this.dependencyAnalyzer = new DependencyAnalyzer();
  }

  /**
   * 应用增量调整
   */
  async applyAdjustment(
    plan: HierarchicalPlan,
    adjustment: PlanAdjustment
  ): Promise<HierarchicalPlan> {
    // 创建计划的深拷贝
    const adjustedPlan = this.clonePlan(plan);

    // 应用每个修改
    for (const modification of adjustment.modifications) {
      await this.applyModification(adjustedPlan, modification);
    }

    // 重新计算依赖关系和拓扑排序
    this.recalculateDependencies(adjustedPlan);

    return adjustedPlan;
  }

  /**
   * 生成增量调整
   */
  async generateIncrementalAdjustment(
    context: ReplanningContext,
    strategy: PlanAdjustment
  ): Promise<PlanAdjustment> {
    const modifications: TaskModification[] = [];

    // 根据策略类型生成相应的修改
    switch (strategy.type) {
      case 'retry':
        modifications.push(...this.generateRetryModifications(context));
        break;

      case 'skip':
        modifications.push(...this.generateSkipModifications(context));
        break;

      case 'reorder':
        modifications.push(...this.generateReorderModifications(context));
        break;

      case 'decompose':
        modifications.push(...this.generateDecomposeModifications(context));
        break;

      case 'adapt':
        modifications.push(...this.generateAdaptModifications(context));
        break;

      case 'abort':
        // 中止策略不需要修改
        break;
    }

    // 限制修改数量
    const limitedModifications = modifications.slice(0, this.config.maxModifications);

    return {
      type: strategy.type,
      modifications: limitedModifications,
      estimatedImprovement: strategy.estimatedImprovement,
      reasoning: strategy.reasoning,
    };
  }

  /**
   * 生成重试修改
   */
  private generateRetryModifications(context: ReplanningContext): TaskModification[] {
    const modifications: TaskModification[] = [];

    for (const failedGoal of context.currentState.failedGoals) {
      const goal = context.originalPlan.subGoals.find((g) => g.id === failedGoal);
      if (goal) {
        modifications.push({
          type: 'modify',
          goalId: failedGoal,
          changes: {
            newStatus: 'pending',
            newEstimate: {
              duration: goal.estimatedDuration * 1.2, // 增加20%时间
              tokens: goal.estimatedTokens * 1.1, // 增加10% tokens
            },
          },
        });
      }
    }

    return modifications;
  }

  /**
   * 生成跳过修改
   */
  private generateSkipModifications(context: ReplanningContext): TaskModification[] {
    const modifications: TaskModification[] = [];

    // 找出被阻塞的任务
    const blockedGoals = this.findBlockedGoals(context);

    for (const blockedGoal of blockedGoals) {
      modifications.push({
        type: 'modify',
        goalId: blockedGoal,
        changes: {
          newStatus: 'skipped',
        },
      });
    }

    return modifications;
  }

  /**
   * 生成重排序修改
   */
  private generateReorderModifications(context: ReplanningContext): TaskModification[] {
    const modifications: TaskModification[] = [];

    // 找出未完成的任务
    const pendingGoals = context.originalPlan.subGoals
      .filter((g) => !context.currentState.completedGoals.has(g.id))
      .sort((a, b) => {
        // 优先级高的排前面
        const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        // 优先级相同时，按预计时间排序（短任务优先）
        return a.estimatedDuration - b.estimatedDuration;
      });

    // 重新分配优先级
    for (let i = 0; i < pendingGoals.length; i++) {
      modifications.push({
        type: 'modify',
        goalId: pendingGoals[i].id,
        changes: {
          newPriority: Math.max(1, 10 - i), // 10, 9, 8, ...
        },
      });
    }

    return modifications;
  }

  /**
   * 生成分解修改
   */
  private generateDecomposeModifications(context: ReplanningContext): TaskModification[] {
    const modifications: TaskModification[] = [];

    // 找出复杂的任务（时间或token超过阈值）
    const complexGoals = context.originalPlan.subGoals.filter((g) => {
      const avgDuration =
        context.originalPlan.subGoals.reduce((sum, g) => sum + g.estimatedDuration, 0) /
        context.originalPlan.subGoals.length;

      const avgTokens =
        context.originalPlan.subGoals.reduce((sum, g) => sum + g.estimatedTokens, 0) /
        context.originalPlan.subGoals.length;

      return (
        !context.currentState.completedGoals.has(g.id) &&
        (g.estimatedDuration > avgDuration * 1.5 || g.estimatedTokens > avgTokens * 1.5)
      );
    });

    for (const goal of complexGoals) {
      modifications.push({
        type: 'modify',
        goalId: goal.id,
        changes: {
          newEstimate: {
            duration: goal.estimatedDuration * 0.6, // 减少40%
            tokens: goal.estimatedTokens * 0.6, // 减少40%
          },
        },
      });
    }

    return modifications;
  }

  /**
   * 生成适应修改
   */
  private generateAdaptModifications(context: ReplanningContext): TaskModification[] {
    const modifications: TaskModification[] = [];

    // 根据资源使用情况调整估算
    const resourceUsage = context.currentState.resourceUsage;
    const tokenOverrun = resourceUsage.tokensUsed / resourceUsage.estimatedTokens;

    if (tokenOverrun > 1.2) {
      // Token超预算20%以上，减少所有任务的token估算
      for (const goal of context.originalPlan.subGoals) {
        if (!context.currentState.completedGoals.has(goal.id)) {
          modifications.push({
            type: 'modify',
            goalId: goal.id,
            changes: {
              newEstimate: {
                tokens: Math.floor(goal.estimatedTokens * 0.8), // 减少20%
              },
            },
          });
        }
      }
    }

    return modifications;
  }

  /**
   * 应用单个修改
   */
  private async applyModification(
    plan: HierarchicalPlan,
    modification: TaskModification
  ): Promise<void> {
    const goal = plan.subGoals.find((g) => g.id === modification.goalId);
    if (!goal) {
      console.warn(`[IncrementalPlanner] 找不到子目标: ${modification.goalId}`);
      return;
    }

    switch (modification.type) {
      case 'add':
        // 添加新子目标（需要taskDecomposer）
        if (!this.taskDecomposer) {
          throw new Error('需要TaskDecomposer来添加新子目标');
        }
        // TODO: 实现添加逻辑
        break;

      case 'remove':
        // 移除子目标
        const index = plan.subGoals.indexOf(goal);
        if (index > -1) {
          plan.subGoals.splice(index, 1);
        }
        break;

      case 'modify':
        // 修改子目标
        if (modification.changes) {
          if (modification.changes.newDependencies !== undefined) {
            if (!this.config.allowDependencyChanges) {
              console.warn('[IncrementalPlanner] 不允许修改依赖关系');
            } else {
              goal.dependencies = modification.changes.newDependencies;
            }
          }

          if (modification.changes.newPriority !== undefined) {
            goal.priority = modification.changes.newPriority as unknown as Priority;
          }

          if (modification.changes.newStatus !== undefined) {
            goal.status = modification.changes.newStatus as TaskStatus;
          }

          if (modification.changes.newEstimate !== undefined) {
            if (modification.changes.newEstimate.duration !== undefined) {
              goal.estimatedDuration = modification.changes.newEstimate.duration;
            }
            if (modification.changes.newEstimate.tokens !== undefined) {
              goal.estimatedTokens = modification.changes.newEstimate.tokens;
            }
          }
        }
        break;

      case 'reorder':
        // 重排序（在generateReorderModifications中处理）
        break;
    }
  }

  /**
   * 克隆计划
   */
  private clonePlan(plan: HierarchicalPlan): HierarchicalPlan {
    return {
      ...plan,
      subGoals: plan.subGoals.map((goal) => ({ ...goal })),
      dependencies: {
        ...plan.dependencies,
        nodes: new Map(plan.dependencies.nodes),
        edges: [...plan.dependencies.edges],
      },
    };
  }

  /**
   * 找出被阻塞的任务
   */
  private findBlockedGoals(context: ReplanningContext): string[] {
    const blockedGoals: string[] = [];
    const completedGoals = context.currentState.completedGoals;

    for (const edge of context.originalPlan.dependencies.edges) {
      const fromCompleted = completedGoals.has(edge.from);
      const toCompleted = completedGoals.has(edge.to);

      // 如果依赖未满足但目标已完成，说明可能跳过了依赖
      if (toCompleted && !fromCompleted) {
        // 检查是否有其他任务依赖这个目标
        const dependents = context.originalPlan.dependencies.edges
          .filter((e) => e.from === edge.to)
          .map((e) => e.to);

        if (dependents.length > 0) {
          blockedGoals.push(...dependents);
        }
      }
    }

    return [...new Set(blockedGoals)];
  }

  /**
   * 获取优先级数值
   */
  private getPriorityValue(priority: unknown): number {
    const values: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return values[priority as keyof typeof values] || 0;
  }

  /**
   * 验证调整
   */
  async validateAdjustment(plan: HierarchicalPlan, adjustment: PlanAdjustment): Promise<boolean> {
    // 检查修改数量
    if (adjustment.modifications.length > this.config.maxModifications) {
      console.warn(
        `[IncrementalPlanner] 修改数量超过限制: ${adjustment.modifications.length} > ${this.config.maxModifications}`
      );
      return false;
    }

    // 检查预期改进
    if (adjustment.estimatedImprovement < this.config.minImprovementThreshold) {
      console.warn(
        `[IncrementalPlanner] 预期改进低于阈值: ${adjustment.estimatedImprovement} < ${this.config.minImprovementThreshold}`
      );
      return false;
    }

    // 检查是否保护关键路径
    if (this.config.preserveCriticalPath && plan.dependencies.topologicalOrder) {
      // TODO: 实现关键路径检查
    }

    return true;
  }

  /**
   * 添加新任务到计划中
   *
   * @param plan 当前计划
   * @param task 要添加的任务
   * @param dependencies 任务依赖（可选）
   * @returns 更新后的计划和影响评估
   */
  async addTask(
    plan: HierarchicalPlan,
    task: SubGoal,
    dependencies?: string[]
  ): Promise<TaskAdditionResult> {
    // 1. 验证任务合法性
    this.validateTask(task);

    // 2. 检查冲突
    const conflicts = this.detectConflicts(plan, task);
    if (conflicts.length > 0) {
      throw new PlanConflictError(conflicts);
    }

    // 3. 添加任务到计划
    const updatedPlan = this.clonePlan(plan);
    updatedPlan.subGoals.push(task);

    // 4. 添加依赖关系
    if (dependencies) {
      for (const depId of dependencies) {
        updatedPlan.dependencies.edges.push({
          from: depId,
          to: task.id,
          type: DependencyType.STRONG,
          strength: 1.0,
          description: '显式依赖',
        });
      }
    }

    // 5. 重新计算依赖关系
    this.recalculateDependencies(updatedPlan);

    // 6. 重新计算关键路径
    const newCriticalPath = this.recalculateCriticalPath(updatedPlan);
    this.currentCriticalPath = newCriticalPath;

    // 7. 评估影响（使用更新后的计划）
    const impact = this.assessImpact(task, newCriticalPath, updatedPlan);

    return {
      addedTask: {
        taskId: task.id,
        task,
      },
      affectedTasks: impact.affectedTasks,
      newCriticalPath,
      impact,
    };
  }

  /**
   * 重新计算依赖关系
   *
   * @param plan 计划
   * @returns 更新后的依赖图
   */
  recalculateDependencies(plan: HierarchicalPlan): void {
    // 构建节点映射
    const nodes = new Map<string, SubGoal>();
    plan.subGoals.forEach((goal) => {
      nodes.set(goal.id, goal);
    });

    // 只使用显式依赖边，不重新检测隐式依赖
    const edges = [...plan.dependencies.edges];

    // 检测循环依赖
    let hasCycles = false;
    if (this.dependencyAnalyzer['detectCycles'](nodes, edges)) {
      hasCycles = true;
    }

    if (hasCycles) {
      throw new CircularDependencyError('检测到循环依赖');
    }

    // 计算拓扑排序（如果无循环依赖）
    let topologicalOrder: string[] | undefined;
    if (!hasCycles) {
      topologicalOrder = this.dependencyAnalyzer['topologicalSort'](nodes, edges);
    }

    // 更新 plan.dependencies
    plan.dependencies = {
      nodes,
      edges,
      hasCycles,
      topologicalOrder,
    };
  }

  /**
   * 重新计算关键路径
   *
   * @param plan 计划
   * @returns 新的关键路径
   */
  recalculateCriticalPath(plan: HierarchicalPlan): CriticalPath {
    const { dependencies } = plan;

    if (dependencies.hasCycles || !dependencies.topologicalOrder) {
      // 有循环依赖，返回所有任务作为关键路径
      return {
        tasks: plan.subGoals.map((g) => g.id),
        duration: plan.estimatedDuration,
        slackTime: new Map(),
        bottleneckTasks: [],
      };
    }

    // 1. 计算最早开始时间
    const earliestStart = this.calculateEarliestStart(plan);

    // 2. 计算最晚开始时间
    const latestStart = this.calculateLatestStart(plan, earliestStart);

    // 3. 计算松弛时间 (Slack)
    const slackTime = new Map<string, number>();
    for (const taskId of dependencies.nodes.keys()) {
      const slack = (latestStart.get(taskId) || 0) - (earliestStart.get(taskId) || 0);
      slackTime.set(taskId, Math.max(0, slack));
    }

    // 4. 识别关键路径上的任务（松弛时间为 0）
    const criticalTasks = Array.from(slackTime.entries())
      .filter(([_, slack]) => Math.abs(slack) < 0.01)
      .map(([taskId]) => taskId);

    // 5. 计算关键路径时长
    const pathDuration = this.calculatePathDuration(plan, criticalTasks);

    // 6. 识别瓶颈任务
    const bottleneckTasks = this.identifyBottlenecks(plan, criticalTasks);

    return {
      tasks: criticalTasks,
      duration: pathDuration,
      slackTime,
      bottleneckTasks,
    };
  }

  /**
   * 计算最早开始时间
   */
  private calculateEarliestStart(plan: HierarchicalPlan): Map<string, number> {
    const earliestStart = new Map<string, number>();
    const { dependencies } = plan;

    // 初始化所有节点的最早开始时间为0
    dependencies.nodes.forEach((_, id) => {
      earliestStart.set(id, 0);
    });

    // 按拓扑排序处理
    const order = dependencies.topologicalOrder || [];

    for (const taskId of order) {
      const incomingEdges = dependencies.edges.filter((e) => e.to === taskId);

      if (incomingEdges.length === 0) {
        // 没有依赖的任务，最早开始时间为0
        earliestStart.set(taskId, 0);
      } else {
        // 有依赖的任务，最早开始时间为所有依赖任务完成后的最大时间
        let maxDepTime = 0;
        for (const edge of incomingEdges) {
          const depTask = dependencies.nodes.get(edge.from);
          if (!depTask) continue;

          const depStartTime = earliestStart.get(edge.from) || 0;
          const depFinishTime = depStartTime + depTask.estimatedDuration;
          maxDepTime = Math.max(maxDepTime, depFinishTime);
        }
        earliestStart.set(taskId, maxDepTime);
      }
    }

    return earliestStart;
  }

  /**
   * 计算最晚开始时间
   */
  private calculateLatestStart(
    plan: HierarchicalPlan,
    earliestStart: Map<string, number>
  ): Map<string, number> {
    const latestStart = new Map<string, number>();
    const { dependencies } = plan;
    const order = dependencies.topologicalOrder || [];

    if (order.length === 0) {
      return latestStart;
    }

    // 计算项目总时长（所有任务的最晚完成时间）
    let projectDuration = 0;
    for (const taskId of order) {
      const task = dependencies.nodes.get(taskId);
      const startTime = earliestStart.get(taskId) || 0;
      const finishTime = startTime + (task?.estimatedDuration || 0);
      projectDuration = Math.max(projectDuration, finishTime);
    }

    // 从后往前计算
    const reversedOrder = [...order].reverse();

    for (const taskId of reversedOrder) {
      const task = dependencies.nodes.get(taskId);
      const taskDuration = task?.estimatedDuration || 0;
      const outgoingEdges = dependencies.edges.filter((e) => e.from === taskId);

      if (outgoingEdges.length === 0) {
        // 终点节点：最晚开始时间 = 项目时长 - 任务时长
        latestStart.set(taskId, projectDuration - taskDuration);
      } else {
        // 非终点节点：最晚开始时间 = min(后继节点的最晚开始时间) - 当前任务时长
        let minDepTime = Infinity;
        for (const edge of outgoingEdges) {
          const depLatestStart = latestStart.get(edge.to) || Infinity;
          minDepTime = Math.min(minDepTime, depLatestStart);
        }
        latestStart.set(taskId, Math.max(0, minDepTime - taskDuration));
      }
    }

    return latestStart;
  }

  /**
   * 计算路径时长
   */
  private calculatePathDuration(plan: HierarchicalPlan, taskIds: string[]): number {
    let totalDuration = 0;
    const { dependencies } = plan;

    for (const taskId of taskIds) {
      const task = dependencies.nodes.get(taskId);
      totalDuration += task?.estimatedDuration || 0;
    }

    return totalDuration;
  }

  /**
   * 识别瓶颈任务
   */
  private identifyBottlenecks(plan: HierarchicalPlan, criticalTasks: string[]): string[] {
    const { dependencies } = plan;

    return criticalTasks.filter((taskId) => {
      const outgoingEdges = dependencies.edges.filter((e) => e.from === taskId);

      // 如果一个关键任务有多个后续任务，则是瓶颈
      return outgoingEdges.length >= 2;
    });
  }

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
  ): ImpactAssessment {
    const oldCriticalPath = this.currentCriticalPath || {
      tasks: [],
      duration: 0,
      slackTime: new Map(),
      bottleneckTasks: [],
    };

    const affectedTasks: string[] = [];
    let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // 1. 检查是否影响关键路径
    if (this.affectsCriticalPath(task, oldCriticalPath, newCriticalPath)) {
      affectedTasks.push(...newCriticalPath.tasks);
      impactLevel = 'HIGH';
    }

    // 2. 添加新任务本身到受影响任务列表
    affectedTasks.push(task.id);

    // 3. 检查依赖任务（查找哪些任务依赖于新添加的任务）
    const dependents = oldPlan.dependencies.edges
      .filter((e) => e.from === task.id)
      .map((e) => e.to);
    affectedTasks.push(...dependents);

    // 3. 检查资源冲突
    const resourceConflicts = this.checkResourceConflicts(task, oldPlan);
    if (resourceConflicts.length > 0) {
      impactLevel = impactLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    // 4. 估算新的项目完成时间
    const newProjectDuration = newCriticalPath.duration;
    const oldProjectDuration = oldCriticalPath.duration || oldPlan.estimatedDuration;
    const delay = newProjectDuration - oldProjectDuration;

    // 5. 根据延迟调整影响级别
    if (Math.abs(delay) > oldProjectDuration * 0.1) {
      // 延迟超过10%
      impactLevel = 'HIGH';
    } else if (Math.abs(delay) > oldProjectDuration * 0.05) {
      // 延迟超过5%
      impactLevel = impactLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    return {
      affectedTasks: Array.from(new Set(affectedTasks)),
      impactLevel,
      newProjectDuration,
      delay,
      resourceConflicts,
      criticalPathChanged: !this.arraysEqual(oldCriticalPath.tasks, newCriticalPath.tasks),
      recommendations: this.generateRecommendations(impactLevel, delay),
    };
  }

  /**
   * 检查是否影响关键路径
   */
  private affectsCriticalPath(
    task: SubGoal,
    oldCriticalPath: CriticalPath,
    newCriticalPath: CriticalPath
  ): boolean {
    // 检查任务是否在新的关键路径上
    const taskInNewPath = newCriticalPath.tasks.includes(task.id);

    // 检查关键路径是否改变
    const pathChanged = !this.arraysEqual(oldCriticalPath.tasks, newCriticalPath.tasks);

    return taskInNewPath || pathChanged;
  }

  /**
   * 检查资源冲突
   */
  private checkResourceConflicts(task: SubGoal, plan: HierarchicalPlan): ResourceConflict[] {
    const conflicts: ResourceConflict[] = [];

    // 收集任务需要的资源
    const taskResources = new Set<string>();
    task.tasks.forEach((t) => {
      t.requiredCapabilities.forEach((cap) => taskResources.add(cap));
    });

    // 检查与其他任务的资源冲突
    for (const otherGoal of plan.subGoals) {
      if (otherGoal.id === task.id) continue;

      const otherResources = new Set<string>();
      otherGoal.tasks.forEach((t) => {
        t.requiredCapabilities.forEach((cap) => otherResources.add(cap));
      });

      // 检查资源重叠
      const overlappingResources = Array.from(taskResources).filter((r) => otherResources.has(r));

      if (overlappingResources.length > 0) {
        conflicts.push({
          resourceType: overlappingResources[0],
          taskIds: [task.id, otherGoal.id],
          severity: overlappingResources.length > 2 ? 'severe' : 'moderate',
        });
      }
    }

    return conflicts;
  }

  /**
   * 生成建议措施
   */
  private generateRecommendations(impactLevel: 'LOW' | 'MEDIUM' | 'HIGH', delay: number): string[] {
    const recommendations: string[] = [];

    if (impactLevel === 'HIGH') {
      if (delay > 0) {
        recommendations.push('考虑增加并行度以缩短关键路径');
        recommendations.push('评估是否可以移除某些依赖关系');
      } else {
        recommendations.push('优化已显著改善计划');
      }
    } else if (impactLevel === 'MEDIUM') {
      recommendations.push('监控资源使用情况');
      if (delay > 0) {
        recommendations.push('考虑调整非关键任务的优先级');
      }
    }

    return recommendations;
  }

  /**
   * 验证任务
   */
  private validateTask(task: SubGoal): void {
    if (!task.id || task.id.trim() === '') {
      throw new Error('任务ID不能为空');
    }

    if (!task.title || task.title.trim() === '') {
      throw new Error('任务标题不能为空');
    }

    if (task.estimatedDuration <= 0) {
      throw new Error('任务预估时长必须大于0');
    }

    if (task.estimatedTokens <= 0) {
      throw new Error('任务预估Token数必须大于0');
    }

    if (task.tasks.length === 0) {
      throw new Error('任务必须包含至少一个子任务');
    }
  }

  /**
   * 检测冲突
   */
  private detectConflicts(plan: HierarchicalPlan, task: SubGoal): string[] {
    const conflicts: string[] = [];

    // 检查ID冲突
    if (plan.subGoals.some((g) => g.id === task.id)) {
      conflicts.push(`任务ID ${task.id} 已存在`);
    }

    // 检查依赖循环（如果提供了依赖）
    if (task.dependencies.length > 0) {
      // 检查依赖的任务是否存在
      for (const depId of task.dependencies) {
        if (!plan.subGoals.some((g) => g.id === depId)) {
          conflicts.push(`依赖的任务 ${depId} 不存在`);
        }
      }
    }

    return conflicts;
  }

  /**
   * 比较两个数组是否相等
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${this.taskIdCounter++}`;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IncrementalPlannerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): IncrementalPlannerConfig {
    return { ...this.config };
  }
}
