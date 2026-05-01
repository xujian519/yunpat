/**
 * 增量规划器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IncrementalPlanner } from '../../src/replanning/IncrementalPlanner.js';
import { Priority, TaskStatus, TaskType, DependencyType } from '../../src/planning/types.js';
import type { SubGoal, HierarchicalPlan } from '../../src/planning/types.js';

describe('IncrementalPlanner', () => {
  let planner: IncrementalPlanner;
  let mockPlan: HierarchicalPlan;

  beforeEach(() => {
    planner = new IncrementalPlanner();

    // 创建模拟计划
    mockPlan = {
      id: 'test-plan-1',
      goal: '测试目标',
      subGoals: [
        {
          id: 'goal-1',
          title: '子目标1',
          description: '第一个子目标',
          tasks: [
            {
              id: 'task-1-1',
              title: '任务1-1',
              description: '子任务',
              type: TaskType.RESEARCH,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['research'],
              estimatedTokens: 1000,
              estimatedDuration: 60,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.HIGH,
          status: TaskStatus.PENDING,
          estimatedDuration: 60,
          estimatedTokens: 1000,
        },
        {
          id: 'goal-2',
          title: '子目标2',
          description: '第二个子目标',
          tasks: [
            {
              id: 'task-2-1',
              title: '任务2-1',
              description: '子任务',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 2000,
              estimatedDuration: 120,
              createdAt: new Date(),
            },
          ],
          dependencies: ['goal-1'],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 120,
          estimatedTokens: 2000,
        },
      ],
      dependencies: {
        nodes: new Map([
          [
            'goal-1',
            {
              id: 'goal-1',
              title: '子目标1',
              description: '第一个子目标',
              tasks: [],
              dependencies: [],
              priority: Priority.HIGH,
              status: TaskStatus.PENDING,
              estimatedDuration: 60,
              estimatedTokens: 1000,
            },
          ],
          [
            'goal-2',
            {
              id: 'goal-2',
              title: '子目标2',
              description: '第二个子目标',
              tasks: [],
              dependencies: ['goal-1'],
              priority: Priority.MEDIUM,
              status: TaskStatus.PENDING,
              estimatedDuration: 120,
              estimatedTokens: 2000,
            },
          ],
        ]),
        edges: [
          {
            from: 'goal-1',
            to: 'goal-2',
            type: DependencyType.STRONG,
            strength: 1.0,
            description: '显式依赖',
          },
        ],
        hasCycles: false,
        topologicalOrder: ['goal-1', 'goal-2'],
      },
      estimatedDuration: 180,
      estimatedTokens: 3000,
      status: 'draft' as any,
      createdAt: new Date(),
    };
  });

  describe('addTask', () => {
    it('应该成功添加新任务', async () => {
      const newTask: SubGoal = {
        id: 'goal-3',
        title: '子目标3',
        description: '第三个子目标',
        tasks: [
          {
            id: 'task-3-1',
            title: '任务3-1',
            description: '子任务',
            type: TaskType.ANALYSIS,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['analysis'],
            estimatedTokens: 1500,
            estimatedDuration: 90,
            createdAt: new Date(),
          },
        ],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 90,
        estimatedTokens: 1500,
      };

      const result = await planner.addTask(mockPlan, newTask);

      expect(result.addedTask.taskId).toBe('goal-3');
      expect(result.addedTask.task).toEqual(newTask);
      expect(result.newCriticalPath.tasks).toContain('goal-1');
      expect(result.newCriticalPath.tasks).toContain('goal-2');
    });

    it('应该正确处理任务依赖', async () => {
      const newTask: SubGoal = {
        id: 'goal-3',
        title: '子目标3',
        description: '第三个子目标',
        tasks: [
          {
            id: 'task-3-1',
            title: '任务3-1',
            description: '子任务',
            type: TaskType.ANALYSIS,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['analysis'],
            estimatedTokens: 1500,
            estimatedDuration: 90,
            createdAt: new Date(),
          },
        ],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 90,
        estimatedTokens: 1500,
      };

      const result = await planner.addTask(mockPlan, newTask, ['goal-1']);

      expect(result.affectedTasks).toContain('goal-3');
      expect(result.newCriticalPath.tasks.length).toBeGreaterThan(0);
    });

    it('应该拒绝空ID的任务', async () => {
      const invalidTask: SubGoal = {
        id: '',
        title: '无效任务',
        description: '这个任务没有ID',
        tasks: [],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 60,
        estimatedTokens: 1000,
      };

      await expect(planner.addTask(mockPlan, invalidTask)).rejects.toThrow('任务ID不能为空');
    });

    it('应该拒绝空标题的任务', async () => {
      const invalidTask: SubGoal = {
        id: 'goal-invalid',
        title: '',
        description: '这个任务没有标题',
        tasks: [],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 60,
        estimatedTokens: 1000,
      };

      await expect(planner.addTask(mockPlan, invalidTask)).rejects.toThrow('任务标题不能为空');
    });

    it('应该拒绝负时长的任务', async () => {
      const invalidTask: SubGoal = {
        id: 'goal-invalid',
        title: '无效任务',
        description: '这个任务时长为负',
        tasks: [],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: -60,
        estimatedTokens: 1000,
      };

      await expect(planner.addTask(mockPlan, invalidTask)).rejects.toThrow(
        '任务预估时长必须大于0'
      );
    });

    it('应该拒绝负Token数的任务', async () => {
      const invalidTask: SubGoal = {
        id: 'goal-invalid',
        title: '无效任务',
        description: '这个任务Token数为负',
        tasks: [],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 60,
        estimatedTokens: -1000,
      };

      await expect(planner.addTask(mockPlan, invalidTask)).rejects.toThrow(
        '任务预估Token数必须大于0'
      );
    });

    it('应该拒绝没有子任务的任务', async () => {
      const invalidTask: SubGoal = {
        id: 'goal-invalid',
        title: '无效任务',
        description: '这个任务没有子任务',
        tasks: [],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 60,
        estimatedTokens: 1000,
      };

      await expect(planner.addTask(mockPlan, invalidTask)).rejects.toThrow(
        '任务必须包含至少一个子任务'
      );
    });

    it('应该拒绝重复ID的任务', async () => {
      const duplicateTask: SubGoal = {
        id: 'goal-1', // 重复ID
        title: '重复任务',
        description: '这个任务ID已存在',
        tasks: [
          {
            id: 'task-dup-1',
            title: '任务',
            description: '子任务',
            type: TaskType.RESEARCH,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['research'],
            estimatedTokens: 1000,
            estimatedDuration: 60,
            createdAt: new Date(),
          },
        ],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 60,
        estimatedTokens: 1000,
      };

      await expect(planner.addTask(mockPlan, duplicateTask)).rejects.toThrow('计划冲突');
    });
  });

  describe('recalculateDependencies', () => {
    it('应该正确重新计算依赖关系', () => {
      const result = planner['recalculateDependencies'](mockPlan);

      expect(result).toBeDefined();
      expect(result.nodes.size).toBe(2);
      expect(result.edges.length).toBeGreaterThan(0);
      expect(result.hasCycles).toBe(false);
      expect(result.topologicalOrder).toBeDefined();
      expect(result.topologicalOrder?.length).toBe(2);
    });

    it('应该检测循环依赖', () => {
      // 创建循环依赖的计划
      const cyclicPlan = { ...mockPlan };
      cyclicPlan.dependencies = {
        ...cyclicPlan.dependencies,
        edges: [
          ...cyclicPlan.dependencies.edges,
          {
            from: 'goal-2',
            to: 'goal-1',
            type: DependencyType.STRONG,
            strength: 1.0,
            description: '循环依赖',
          },
        ],
      };

      expect(() => {
        planner['recalculateDependencies'](cyclicPlan);
      }).toThrow('检测到循环依赖');
    });
  });

  describe('recalculateCriticalPath', () => {
    it('应该正确计算关键路径', () => {
      const criticalPath = planner['recalculateCriticalPath'](mockPlan);

      expect(criticalPath).toBeDefined();
      expect(criticalPath.tasks.length).toBeGreaterThan(0);
      expect(criticalPath.duration).toBeGreaterThan(0);
      expect(criticalPath.slackTime instanceof Map).toBe(true);
      expect(Array.isArray(criticalPath.bottleneckTasks)).toBe(true);
    });

    it('应该正确识别关键路径上的任务', () => {
      const criticalPath = planner['recalculateCriticalPath'](mockPlan);

      // goal-1 和 goal-2 都应该在关键路径上
      expect(criticalPath.tasks).toContain('goal-1');
      expect(criticalPath.tasks).toContain('goal-2');
    });

    it('应该正确计算松弛时间', () => {
      const criticalPath = planner['recalculateCriticalPath'](mockPlan);

      // 关键路径上的任务松弛时间应该为0
      for (const taskId of criticalPath.tasks) {
        const slack = criticalPath.slackTime.get(taskId);
        expect(slack).toBe(0);
      }
    });

    it('应该正确计算路径时长', () => {
      const criticalPath = planner['recalculateCriticalPath'](mockPlan);

      // 路径时长应该是所有关键任务时长之和
      const expectedDuration = 60 + 120; // goal-1 + goal-2
      expect(criticalPath.duration).toBe(expectedDuration);
    });
  });

  describe('assessImpact', () => {
    it('应该正确评估影响级别', async () => {
      const newTask: SubGoal = {
        id: 'goal-3',
        title: '子目标3',
        description: '第三个子目标',
        tasks: [
          {
            id: 'task-3-1',
            title: '任务3-1',
            description: '子任务',
            type: TaskType.ANALYSIS,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['analysis'],
            estimatedTokens: 1500,
            estimatedDuration: 90,
            createdAt: new Date(),
          },
        ],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 90,
        estimatedTokens: 1500,
      };

      const result = await planner.addTask(mockPlan, newTask);

      expect(result.impact).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.impact.impactLevel);
      expect(result.impact.newProjectDuration).toBeGreaterThan(0);
      expect(typeof result.impact.delay).toBe('number');
      expect(Array.isArray(result.impact.resourceConflicts)).toBe(true);
      expect(typeof result.impact.criticalPathChanged).toBe('boolean');
      expect(Array.isArray(result.impact.recommendations)).toBe(true);
    });

    it('应该检测资源冲突', async () => {
      const newTask: SubGoal = {
        id: 'goal-3',
        title: '子目标3',
        description: '第三个子目标',
        tasks: [
          {
            id: 'task-3-1',
            title: '任务3-1',
            description: '子任务',
            type: TaskType.RESEARCH, // 与 goal-1 相同类型
            status: TaskStatus.PENDING,
            requiredCapabilities: ['research'], // 与 goal-1 相同能力
            estimatedTokens: 1500,
            estimatedDuration: 90,
            createdAt: new Date(),
          },
        ],
        dependencies: [],
        priority: Priority.LOW,
        status: TaskStatus.PENDING,
        estimatedDuration: 90,
        estimatedTokens: 1500,
      };

      const result = await planner.addTask(mockPlan, newTask);

      // 应该检测到资源冲突
      expect(result.impact.resourceConflicts.length).toBeGreaterThan(0);
    });
  });

  describe('validateAdjustment', () => {
    it('应该接受有效的调整', async () => {
      const adjustment = {
        type: 'retry' as const,
        modifications: [],
        estimatedImprovement: 0.5,
        reasoning: '测试调整',
      };

      const isValid = await planner.validateAdjustment(mockPlan, adjustment);

      expect(isValid).toBe(true);
    });

    it('应该拒绝超过修改数量限制的调整', async () => {
      const adjustment = {
        type: 'retry' as const,
        modifications: Array(10).fill({ type: 'modify', goalId: 'test' }),
        estimatedImprovement: 0.5,
        reasoning: '测试调整',
      };

      const isValid = await planner.validateAdjustment(mockPlan, adjustment);

      expect(isValid).toBe(false);
    });

    it('应该拒绝低于改进阈值的调整', async () => {
      const adjustment = {
        type: 'retry' as const,
        modifications: [],
        estimatedImprovement: 0.05, // 低于默认阈值 0.1
        reasoning: '测试调整',
      };

      const isValid = await planner.validateAdjustment(mockPlan, adjustment);

      expect(isValid).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('应该正确更新配置', () => {
      planner.updateConfig({
        maxModifications: 10,
        preserveCriticalPath: false,
      });

      const config = planner.getConfig();

      expect(config.maxModifications).toBe(10);
      expect(config.preserveCriticalPath).toBe(false);
      expect(config.allowDependencyChanges).toBe(false); // 保持原值
      expect(config.minImprovementThreshold).toBe(0.1); // 保持原值
    });
  });

  describe('getConfig', () => {
    it('应该返回配置的副本', () => {
      const config1 = planner.getConfig();
      const config2 = planner.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // 不同引用
    });
  });
});
