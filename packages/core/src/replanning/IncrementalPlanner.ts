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
} from './types.js';
import { Priority, TaskStatus } from '../planning/types.js';
import type { TaskDecomposer } from '../planning/TaskDecomposer.js';

/**
 * 增量规划器
 */
export class IncrementalPlanner {
  private config: IncrementalPlannerConfig;
  private taskDecomposer?: TaskDecomposer;

  constructor(config: Partial<IncrementalPlannerConfig> = {}, taskDecomposer?: TaskDecomposer) {
    this.config = {
      maxModifications: config.maxModifications ?? 5,
      preserveCriticalPath: config.preserveCriticalPath ?? true,
      allowDependencyChanges: config.allowDependencyChanges ?? false,
      minImprovementThreshold: config.minImprovementThreshold ?? 0.1,
    };
    this.taskDecomposer = taskDecomposer;
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
   * 重新计算依赖关系
   */
  private recalculateDependencies(_plan: HierarchicalPlan): void {
    // TODO: 实现依赖关系重新计算
    // 这里应该调用DependencyAnalyzer来重新分析依赖关系
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
