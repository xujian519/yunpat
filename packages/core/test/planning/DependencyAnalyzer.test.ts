/**
 * DependencyAnalyzer 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyAnalyzer } from '../../src/planning/DependencyAnalyzer.js';
import type { SubGoal, Dependency } from '../../src/planning/types.js';
import { Priority, TaskStatus, TaskType, DependencyType } from '../../src/planning/types.js';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer({
      detectCycles: true,
      autoFixCycles: false,
      minDependencyStrength: 0.2, // 降低阈值以检测关键词重叠
    });
  });

  /**
   * 辅助函数：创建测试用的子目标
   */
  function createTestSubGoal(id: string, title: string, dependencies: string[] = []): SubGoal {
    // 为每个子目标生成完全不同的描述，避免关键词重叠
    const descriptions = {
      goal1: '第一步工作内容',
      goal2: '第二阶段事项',
      goal3: '第三项活动计划',
    };

    const taskTitles = {
      goal1: '初始执行',
      goal2: '后续操作',
      goal3: '最终实施',
    };

    const taskDescs = {
      goal1: '开始相关工作',
      goal2: '继续执行流程',
      goal3: '完成既定目标',
    };

    return {
      id,
      title,
      description: descriptions[id as keyof typeof descriptions] || `${id}任务`,
      tasks: [
        {
          id: `${id}-task1`,
          title: taskTitles[id as keyof typeof taskTitles] || `${id}工作`,
          description: taskDescs[id as keyof typeof taskDescs] || `${id}执行`,
          type: TaskType.WRITING,
          status: TaskStatus.PENDING,
          requiredCapabilities: ['writing'],
          estimatedTokens: 1000,
          estimatedDuration: 300,
          createdAt: new Date(),
        },
      ],
      dependencies,
      priority: Priority.MEDIUM,
      status: TaskStatus.PENDING,
      estimatedDuration: 300,
      estimatedTokens: 1000,
    };
  }

  describe('analyzeDependencies', () => {
    it('应该分析没有依赖的子目标', () => {
      const subGoals = [
        createTestSubGoal('goal1', '数据收集'), // 关键词: 数据, 据收
        createTestSubGoal('goal2', '模型训练'), // 关键词: 模型, 型训
        createTestSubGoal('goal3', '结果验证'), // 关键词: 结果, 果验
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      // 临时调试输出
      if (graph.edges.length > 0) {
        console.log('Debug - Unexpected edges:');
        graph.edges.forEach((e) => {
          console.log(`  ${e.from} -> ${e.to}: ${e.description} (strength: ${e.strength})`);
        });
      }

      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.length).toBe(0);
      expect(graph.hasCycles).toBe(false);
      expect(graph.topologicalOrder).toBeDefined();
      expect(graph.topologicalOrder?.length).toBe(3);
    });

    it('应该检测显式依赖', () => {
      const subGoals = [
        createTestSubGoal('goal1', '研究阶段'),
        createTestSubGoal('goal2', '撰写阶段', ['goal1']),
        createTestSubGoal('goal3', '审查阶段', ['goal2']),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.length).toBeGreaterThanOrEqual(2); // 至少包含显式依赖

      // 检查显式依赖
      const goal2DependsOnGoal1 = graph.edges.some((e) => e.from === 'goal1' && e.to === 'goal2');
      const goal3DependsOnGoal2 = graph.edges.some((e) => e.from === 'goal2' && e.to === 'goal3');

      expect(goal2DependsOnGoal1).toBe(true);
      expect(goal3DependsOnGoal2).toBe(true);
    });

    it('应该检测隐式依赖（关键词重叠）', () => {
      // 手动创建子目标，确保产生关键词重叠
      const subGoals: SubGoal[] = [
        {
          id: 'goal1',
          title: '深度学习模型训练',
          description: '神经网络相关工作',
          tasks: [],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 1000,
        },
        {
          id: 'goal2',
          title: '深度学习模型评估',
          description: '神经网络验证工作',
          tasks: [],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 1000,
        },
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      // 应该检测到关键词重叠（"深度学习"、"神经网络"、"模型"等）
      const hasImplicitDependency = graph.edges.some((e) => e.strength > 0 && e.strength < 1.0);

      expect(hasImplicitDependency).toBe(true);
    });

    it('应该检测任务类型依赖', () => {
      const subGoals = [
        createTestSubGoal('goal1', '研究任务'),
        createTestSubGoal('goal2', '分析任务'),
      ];

      // 修改任务类型
      subGoals[0].tasks[0].type = TaskType.RESEARCH;
      subGoals[1].tasks[0].type = TaskType.ANALYSIS;

      const graph = analyzer.analyzeDependencies(subGoals);

      // 应该检测到研究 -> 分析的依赖
      const hasTypeDependency = graph.edges.some((e) => e.description?.includes('任务类型依赖'));

      expect(hasTypeDependency).toBe(true);
    });

    it('应该检测循环依赖', () => {
      const subGoals = [
        createTestSubGoal('goal1', '目标1', ['goal3']),
        createTestSubGoal('goal2', '目标2', ['goal1']),
        createTestSubGoal('goal3', '目标3', ['goal2']),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      expect(graph.hasCycles).toBe(true);
      expect(graph.topologicalOrder).toBeUndefined();
    });

    it('应该自动修复循环依赖（如果配置）', () => {
      const autoFixAnalyzer = new DependencyAnalyzer({
        detectCycles: true,
        autoFixCycles: true,
      });

      const subGoals = [
        createTestSubGoal('goal1', '目标1', ['goal3']),
        createTestSubGoal('goal2', '目标2', ['goal1']),
        createTestSubGoal('goal3', '目标3', ['goal2']),
      ];

      const graph = autoFixAnalyzer.analyzeDependencies(subGoals);

      expect(graph.hasCycles).toBe(false);
      expect(graph.topologicalOrder).toBeDefined();
    });
  });

  describe('topologicalSort', () => {
    it('应该对无依赖的任务进行拓扑排序', () => {
      const subGoals = [
        createTestSubGoal('goal1', '目标1'),
        createTestSubGoal('goal2', '目标2'),
        createTestSubGoal('goal3', '目标3'),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      expect(graph.topologicalOrder).toBeDefined();
      expect(graph.topologicalOrder?.length).toBe(3);
      expect(graph.topologicalOrder).toContain('goal1');
      expect(graph.topologicalOrder).toContain('goal2');
      expect(graph.topologicalOrder).toContain('goal3');
    });

    it('应该尊重依赖关系进行排序', () => {
      const subGoals = [
        createTestSubGoal('goal1', '研究'),
        createTestSubGoal('goal2', '撰写', ['goal1']),
        createTestSubGoal('goal3', '审查', ['goal2']),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);
      const order = graph.topologicalOrder!;

      // goal1 应该在 goal2 之前
      const goal1Index = order.indexOf('goal1');
      const goal2Index = order.indexOf('goal2');
      const goal3Index = order.indexOf('goal3');

      expect(goal1Index).toBeLessThan(goal2Index);
      expect(goal2Index).toBeLessThan(goal3Index);
    });
  });

  describe('findCriticalPath', () => {
    it('应该找到关键路径', () => {
      const subGoals = [
        createTestSubGoal('goal1', '研究', [], 600),
        createTestSubGoal('goal2', '撰写', ['goal1'], 900),
        createTestSubGoal('goal3', '审查', ['goal2'], 300),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);
      const criticalPath = analyzer.findCriticalPath(graph);

      expect(criticalPath.length).toBeGreaterThan(0);
      expect(criticalPath).toContain('goal1');
      expect(criticalPath).toContain('goal2');
      expect(criticalPath).toContain('goal3');
    });

    it('应该对有循环依赖的图返回空路径', () => {
      const subGoals = [
        createTestSubGoal('goal1', '目标1', ['goal2']),
        createTestSubGoal('goal2', '目标2', ['goal1']),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);
      const criticalPath = analyzer.findCriticalPath(graph);

      expect(criticalPath.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应该计算正确的统计信息', () => {
      const subGoals = [
        createTestSubGoal('goal1', '目标1'),
        createTestSubGoal('goal2', '目标2', ['goal1']),
        createTestSubGoal('goal3', '目标3', ['goal1']),
      ];

      const graph = analyzer.analyzeDependencies(subGoals);
      const stats = analyzer.getStats(graph);

      expect(stats.totalNodes).toBe(3);
      expect(stats.totalEdges).toBeGreaterThan(0);
      expect(stats.avgDegree).toBeGreaterThan(0);
      expect(stats.maxDegree).toBeGreaterThan(0);
      expect(stats.hasCycles).toBe(false);
      expect(stats.criticalPathLength).toBeGreaterThan(0);
    });

    it('应该正确处理空图', () => {
      const graph = analyzer.analyzeDependencies([]);
      const stats = analyzer.getStats(graph);

      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.avgDegree).toBe(0);
      expect(stats.maxDegree).toBe(0);
    });
  });

  describe('关键词提取和重叠计算', () => {
    it('应该正确提取关键词', () => {
      // 手动创建子目标，确保产生关键词重叠
      const subGoals: SubGoal[] = [
        {
          id: 'goal1',
          title: '深度学习模型训练',
          description: '神经网络深度学习相关工作',
          tasks: [
            {
              id: 'goal1-task1',
              title: '神经网络任务',
              description: '深度网络相关工作',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 300,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 1000,
        },
        {
          id: 'goal2',
          title: '深度学习算法优化',
          description: '神经网络深度学习优化工作',
          tasks: [
            {
              id: 'goal2-task1',
              title: '神经网络调优',
              description: '深度网络优化工作',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 300,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 1000,
        },
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      // 调试输出
      if (graph.edges.length === 0) {
        console.log('Debug - No edges found for keyword overlap test');
        console.log('Goal 1:', subGoals[0].title, subGoals[0].description);
        console.log('Goal 2:', subGoals[1].title, subGoals[1].description);
      } else {
        console.log('Debug - Found edges:', graph.edges.length);
        graph.edges.forEach((e) => {
          console.log(
            `  ${e.from} -> ${e.to}: ${e.description} (strength: ${e.strength.toFixed(2)})`
          );
        });
      }

      // 应该有基于关键词的隐式依赖（strength在0到1之间，不是显式的1.0）
      const implicitDeps = graph.edges.filter((e) => e.strength > 0 && e.strength < 1.0);

      expect(implicitDeps.length).toBeGreaterThan(0);
    });

    it('应该计算关键词重叠度', () => {
      // 手动创建子目标，确保产生关键词重叠
      const subGoals: SubGoal[] = [
        {
          id: 'goal1',
          title: '深度学习训练',
          description: 'AI模型训练',
          tasks: [
            {
              id: 'goal1-task1',
              title: '神经网络训练',
              description: '深度网络相关工作',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 300,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 1000,
        },
        {
          id: 'goal2',
          title: '深度学习评估',
          description: 'AI模型评估',
          tasks: [
            {
              id: 'goal2-task1',
              title: '神经网络验证',
              description: '深度网络验证工作',
              type: TaskType.WRITING,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 1000,
              estimatedDuration: 300,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 1000,
        },
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      // 应该有依赖关系，因为"深度学习"、"神经网络"、"深度网络"重叠
      expect(graph.edges.length).toBeGreaterThan(0);

      const dep = graph.edges[0];
      expect(dep.strength).toBeGreaterThan(0);
    });
  });

  describe('依赖类型推断', () => {
    it('应该根据强度推断依赖类型', () => {
      const subGoals = [
        createTestSubGoal('goal1', '目标1'),
        createTestSubGoal('goal2', '目标2', ['goal1']), // 显式依赖，强度应该高
      ];

      const graph = analyzer.analyzeDependencies(subGoals);
      const strongDeps = graph.edges.filter((e) => e.type === 'strong');

      expect(strongDeps.length).toBeGreaterThan(0);
    });
  });
});
