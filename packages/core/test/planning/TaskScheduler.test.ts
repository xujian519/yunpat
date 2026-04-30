/**
 * TaskScheduler 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskScheduler } from '../../src/planning/TaskScheduler.js';
import type { HierarchicalPlan, DependencyGraph, SubGoal } from '../../src/planning/types.js';
import { Priority, TaskStatus, TaskType, PlanStatus } from '../../src/planning/types.js';

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler({
      strategy: 'topological',
      maxParallelTasks: 3,
      considerResourceConstraints: false,
    });
  });

  /**
   * 辅助函数：创建测试计划
   */
  function createTestPlan(): HierarchicalPlan {
    const subGoals: SubGoal[] = [
      {
        id: 'goal1',
        title: '研究阶段',
        description: '收集信息',
        tasks: [
          {
            id: 'task1',
            title: '搜索资料',
            description: '搜索相关资料',
            type: TaskType.RESEARCH,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['search'],
            estimatedTokens: 2000,
            estimatedDuration: 300,
            createdAt: new Date(),
          },
        ],
        dependencies: [],
        priority: Priority.HIGH,
        status: TaskStatus.PENDING,
        estimatedDuration: 300,
        estimatedTokens: 2000,
      },
      {
        id: 'goal2',
        title: '撰写阶段',
        description: '撰写内容',
        tasks: [
          {
            id: 'task2',
            title: '撰写草稿',
            description: '撰写初稿',
            type: TaskType.WRITING,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['writing'],
            estimatedTokens: 3000,
            estimatedDuration: 600,
            createdAt: new Date(),
          },
        ],
        dependencies: ['goal1'],
        priority: Priority.HIGH,
        status: TaskStatus.PENDING,
        estimatedDuration: 600,
        estimatedTokens: 3000,
      },
      {
        id: 'goal3',
        title: '审查阶段',
        description: '审查内容',
        tasks: [
          {
            id: 'task3',
            title: '质量检查',
            description: '检查质量',
            type: TaskType.VALIDATION,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['validation'],
            estimatedTokens: 1500,
            estimatedDuration: 240,
            createdAt: new Date(),
          },
        ],
        dependencies: ['goal2'],
        priority: Priority.MEDIUM,
        status: TaskStatus.PENDING,
        estimatedDuration: 240,
        estimatedTokens: 1500,
      },
    ];

    const dependencies: DependencyGraph = {
      nodes: new Map(subGoals.map((g) => [g.id, g])),
      edges: [
        { from: 'goal1', to: 'goal2', type: 'strong', strength: 1.0 },
        { from: 'goal2', to: 'goal3', type: 'strong', strength: 1.0 },
      ],
      hasCycles: false,
      topologicalOrder: ['goal1', 'goal2', 'goal3'],
    };

    return {
      id: 'plan1',
      goal: '测试计划',
      subGoals,
      dependencies,
      estimatedDuration: 1140,
      estimatedTokens: 6500,
      status: PlanStatus.READY,
      createdAt: new Date(),
    };
  }

  describe('schedule - 拓扑排序策略', () => {
    it('应该按拓扑顺序调度任务', () => {
      const plan = createTestPlan();
      const result = scheduler.schedule(plan);

      expect(result.executionOrder).toBeDefined();
      expect(result.executionOrder.length).toBe(3);
      expect(result.executionOrder[0]).toBe('goal1');
      expect(result.executionOrder[1]).toBe('goal2');
      expect(result.executionOrder[2]).toBe('goal3');
    });

    it('应该生成并行组', () => {
      const plan = createTestPlan();
      const result = scheduler.schedule(plan);

      expect(result.parallelGroups).toBeDefined();
      expect(result.parallelGroups.length).toBeGreaterThan(0);
    });

    it('应该识别关键路径', () => {
      const plan = createTestPlan();
      const result = scheduler.schedule(plan);

      expect(result.criticalPath).toBeDefined();
      expect(result.criticalPath.length).toBe(3);
      expect(result.criticalPath).toContain('goal1');
      expect(result.criticalPath).toContain('goal2');
      expect(result.criticalPath).toContain('goal3');
    });

    it('应该计算资源利用率', () => {
      const plan = createTestPlan();
      const result = scheduler.schedule(plan);

      expect(result.resourceUtilization).toBeGreaterThanOrEqual(0);
      expect(result.resourceUtilization).toBeLessThanOrEqual(1);
    });
  });

  describe('schedule - 优先级策略', () => {
    it('应该按优先级排序（在依赖关系允许的范围内）', () => {
      const priorityScheduler = new TaskScheduler({
        strategy: 'priority',
      });

      const plan = createTestPlan();
      // 修改优先级
      plan.subGoals[0].priority = Priority.LOW;
      plan.subGoals[2].priority = Priority.CRITICAL;

      const result = priorityScheduler.schedule(plan);

      // 由于有强依赖关系 goal1 -> goal2 -> goal3，
      // 执行顺序必须尊重依赖关系
      // 但优先级会影响同一层级的选择
      expect(result.executionOrder).toEqual(['goal1', 'goal2', 'goal3']);

      // 验证依赖关系被正确遵守
      const goal1Index = result.executionOrder.indexOf('goal1');
      const goal2Index = result.executionOrder.indexOf('goal2');
      const goal3Index = result.executionOrder.indexOf('goal3');

      expect(goal1Index).toBeLessThan(goal2Index);
      expect(goal2Index).toBeLessThan(goal3Index);
    });

    it('应该在无依赖关系时按优先级排序', () => {
      const priorityScheduler = new TaskScheduler({
        strategy: 'priority',
      });

      // 创建没有依赖关系的测试计划
      const subGoals: SubGoal[] = [
        {
          id: 'goal1',
          title: '低优先级任务',
          description: '测试',
          tasks: [
            {
              id: 'task1',
              title: '任务1',
              description: '测试',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 100,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.LOW,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
        {
          id: 'goal2',
          title: '中优先级任务',
          description: '测试',
          tasks: [
            {
              id: 'task2',
              title: '任务2',
              description: '测试',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 100,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
        {
          id: 'goal3',
          title: '关键任务',
          description: '测试',
          tasks: [
            {
              id: 'task3',
              title: '任务3',
              description: '测试',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 100,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.CRITICAL,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
      ];

      const dependencies: DependencyGraph = {
        nodes: new Map(subGoals.map((g) => [g.id, g])),
        edges: [],
        hasCycles: false,
        topologicalOrder: ['goal3', 'goal2', 'goal1'], // 按优先级排序的拓扑顺序
      };

      const plan: HierarchicalPlan = {
        id: 'test-plan',
        goal: '测试优先级',
        subGoals,
        dependencies,
        estimatedDuration: 300,
        estimatedTokens: 3000,
        status: PlanStatus.READY,
        createdAt: new Date(),
      };

      const result = priorityScheduler.schedule(plan);

      // CRITICAL 应该在最前面
      expect(result.executionOrder[0]).toBe('goal3');
    });
  });

  describe('schedule - 关键路径策略', () => {
    it('应该优先调度关键路径任务', () => {
      const criticalPathScheduler = new TaskScheduler({
        strategy: 'critical_path',
      });

      const plan = createTestPlan();
      const result = criticalPathScheduler.schedule(plan);

      // 关键路径任务应该在前面
      expect(result.executionOrder[0]).toBe(result.criticalPath[0]);
    });
  });

  describe('schedule - 并行策略', () => {
    it('应该最大化并行执行', () => {
      const parallelScheduler = new TaskScheduler({
        strategy: 'parallel',
        maxParallelTasks: 2,
      });

      const plan = createTestPlan();
      const result = parallelScheduler.schedule(plan);

      // 应该有并行组
      expect(result.parallelGroups.length).toBeGreaterThan(0);
    });

    it('应该重新计算并行完成时间', () => {
      const parallelScheduler = new TaskScheduler({
        strategy: 'parallel',
        maxParallelTasks: 2,
      });

      const plan = createTestPlan();
      const result = parallelScheduler.schedule(plan);

      // 并行时间应该小于或等于顺序时间
      expect(result.estimatedCompletionTime).toBeLessThanOrEqual(plan.estimatedDuration);
    });
  });

  describe('getNextExecutableTasks', () => {
    it('应该返回没有依赖的任务', () => {
      const plan = createTestPlan();
      const completedTasks = new Set<string>();

      const nextTasks = scheduler.getNextExecutableTasks(plan, completedTasks);

      expect(nextTasks.length).toBeGreaterThan(0);
      expect(nextTasks[0].id).toBe('task1'); // goal1 的任务
    });

    it('应该在依赖满足后返回后续任务', () => {
      const plan = createTestPlan();
      const completedTasks = new Set<string>(['goal1']);

      const nextTasks = scheduler.getNextExecutableTasks(plan, completedTasks);

      expect(nextTasks.length).toBeGreaterThan(0);
      expect(nextTasks[0].id).toBe('task2'); // goal2 的任务
    });

    it('应该返回空列表当所有任务完成', () => {
      const plan = createTestPlan();
      const completedTasks = new Set<string>(['goal1', 'goal2', 'goal3']);

      const nextTasks = scheduler.getNextExecutableTasks(plan, completedTasks);

      expect(nextTasks.length).toBe(0);
    });
  });

  describe('isPlanComplete', () => {
    it('应该检测未完成的计划', () => {
      const plan = createTestPlan();
      expect(scheduler.isPlanComplete(plan)).toBe(false);
    });

    it('应该检测已完成的计划', () => {
      const plan = createTestPlan();

      // 标记所有任务为完成
      plan.subGoals.forEach((goal) => {
        goal.tasks.forEach((task) => {
          task.status = TaskStatus.COMPLETED;
        });
      });

      expect(scheduler.isPlanComplete(plan)).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('应该计算总体进度', () => {
      const plan = createTestPlan();

      // 完成第一个任务
      plan.subGoals[0].tasks[0].status = TaskStatus.COMPLETED;

      const progress = scheduler.getProgress(plan);

      expect(progress.totalTasks).toBe(3);
      expect(progress.completedTasks).toBe(1);
      expect(progress.progress).toBeCloseTo(1 / 3, 2);
    });

    it('应该计算每个子目标的进度', () => {
      const plan = createTestPlan();

      // 完成第一个子目标的所有任务
      plan.subGoals[0].tasks[0].status = TaskStatus.COMPLETED;

      const progress = scheduler.getProgress(plan);

      expect(progress.byGoal).toBeDefined();
      expect(progress.byGoal.length).toBe(3);

      const goal1Progress = progress.byGoal.find((g) => g.goalId === 'goal1');
      expect(goal1Progress?.progress).toBe(1);
    });

    it('应该处理空计划', () => {
      const plan: HierarchicalPlan = {
        id: 'empty-plan',
        goal: '空计划',
        subGoals: [],
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 0,
        estimatedTokens: 0,
        status: PlanStatus.READY,
        createdAt: new Date(),
      };

      const progress = scheduler.getProgress(plan);

      expect(progress.totalTasks).toBe(0);
      expect(progress.completedTasks).toBe(0);
      expect(progress.progress).toBe(1); // 空计划算完成
    });
  });

  describe('资源约束', () => {
    it('应该考虑资源约束（如果启用）', () => {
      const resourceAwareScheduler = new TaskScheduler({
        strategy: 'parallel',
        maxParallelTasks: 2,
        considerResourceConstraints: true,
        availableResources: ['writing'], // 只有一个 writing 资源
      });

      const plan = createTestPlan();
      const result = resourceAwareScheduler.schedule(plan);

      // 资源利用率应该被限制
      expect(result.resourceUtilization).toBeLessThanOrEqual(1);
    });

    it('应该检测资源冲突', () => {
      const resourceAwareScheduler = new TaskScheduler({
        strategy: 'parallel',
        maxParallelTasks: 10,
        considerResourceConstraints: true,
        availableResources: ['writing'], // 只有一个 writing 资源
      });

      // 创建多个需要 writing 的任务
      const plan = createTestPlan();
      plan.subGoals.forEach((goal) => {
        goal.tasks.forEach((task) => {
          task.requiredCapabilities = ['writing'];
        });
      });

      const result = resourceAwareScheduler.schedule(plan);

      // 不应该所有任务都并行
      result.parallelGroups.forEach((group) => {
        expect(group.length).toBeLessThanOrEqual(1); // 每次只能执行一个
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理有循环依赖的计划', () => {
      const plan = createTestPlan();
      plan.dependencies.hasCycles = true;
      plan.dependencies.topologicalOrder = undefined;

      const result = scheduler.schedule(plan);

      // 应该回退到简单顺序调度
      expect(result.executionOrder).toBeDefined();
      expect(result.executionOrder.length).toBe(3);
    });

    it('应该处理空计划', () => {
      const emptyPlan: HierarchicalPlan = {
        id: 'empty',
        goal: '空',
        subGoals: [],
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 0,
        estimatedTokens: 0,
        status: PlanStatus.READY,
        createdAt: new Date(),
      };

      const result = scheduler.schedule(emptyPlan);

      expect(result.executionOrder).toEqual([]);
      expect(result.parallelGroups).toEqual([]);
      expect(result.criticalPath).toEqual([]);
    });
  });
});
