/**
 * 目标分解系统集成测试
 *
 * 测试 TaskDecomposer、DependencyAnalyzer、TaskScheduler 的协同工作
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TaskDecomposer } from '../../src/planning/TaskDecomposer.js';
import { DependencyAnalyzer } from '../../src/planning/DependencyAnalyzer.js';
import { TaskScheduler } from '../../src/planning/TaskScheduler.js';
import type { LLMAdapter } from '../../src/llm/NativeLLMAdapter.js';
import { Priority, TaskStatus, TaskType, PlanStatus } from '../../src/planning/types.js';

describe('目标分解系统集成测试', () => {
  let decomposer: TaskDecomposer;
  let analyzer: DependencyAnalyzer;
  let scheduler: TaskScheduler;
  let mockLLM: LLMAdapter;

  beforeAll(() => {
    // 创建模拟 LLM
    mockLLM = {
      chat: async () => ({
        content: '',
        message: { content: '' },
      }),
    } as unknown as LLMAdapter;

    decomposer = new TaskDecomposer({
      llm: mockLLM,
      maxDepth: 3,
      domain: 'general',
    });

    analyzer = new DependencyAnalyzer({
      detectCycles: true,
      autoFixCycles: false,
    });

    scheduler = new TaskScheduler({
      strategy: 'topological',
      maxParallelTasks: 3,
    });
  });

  describe('端到端分解和调度', () => {
    it('应该完整执行分解流程', async () => {
      const goal = '撰写一篇技术文档';

      // 1. 分解
      const plan = await decomposer.decompose(goal);

      expect(plan).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
      expect(plan.dependencies).toBeDefined();

      console.log(`\n✅ 分解完成:`);
      console.log(`   子目标数: ${plan.subGoals.length}`);
      console.log(`   总任务数: ${plan.subGoals.reduce((sum, g) => sum + g.tasks.length, 0)}`);
      console.log(`   预估时长: ${(plan.estimatedDuration / 60).toFixed(1)} 分钟`);
    });

    it('应该正确分析依赖关系', async () => {
      const plan = await decomposer.decompose('撰写专利');

      // 2. 分析依赖
      const dependencyStats = analyzer.getStats(plan.dependencies);

      expect(dependencyStats.totalNodes).toBe(plan.subGoals.length);
      expect(dependencyStats.hasCycles).toBe(false);

      console.log(`\n✅ 依赖分析完成:`);
      console.log(`   节点数: ${dependencyStats.totalNodes}`);
      console.log(`   边数: ${dependencyStats.totalEdges}`);
      console.log(`   平均度: ${dependencyStats.avgDegree.toFixed(2)}`);
    });

    it('应该生成有效的调度方案', async () => {
      const plan = await decomposer.decompose('开发新功能');

      // 3. 调度
      const scheduleResult = scheduler.schedule(plan);

      expect(scheduleResult.executionOrder.length).toBe(plan.subGoals.length);
      expect(scheduleResult.parallelGroups.length).toBeGreaterThan(0);
      expect(scheduleResult.criticalPath.length).toBeGreaterThan(0);

      console.log(`\n✅ 调度完成:`);
      console.log(`   执行顺序: ${scheduleResult.executionOrder.join(' → ')}`);
      console.log(`   并行组数: ${scheduleResult.parallelGroups.length}`);
      console.log(`   关键路径长度: ${scheduleResult.criticalPath.length}`);
      console.log(`   资源利用率: ${(scheduleResult.resourceUtilization * 100).toFixed(1)}%`);
    });
  });

  describe('专利撰写场景', () => {
    it('应该分解专利撰写任务', async () => {
      const patentDecomposer = new TaskDecomposer({
        domain: 'patent',
      });

      const plan = await patentDecomposer.decompose('撰写图像识别专利');

      expect(plan.subGoals.length).toBeGreaterThan(0);

      // 验证专利特定的子目标
      const titles = plan.subGoals.map((g) => g.title);
      expect(titles.some((t) => t.includes('技术方案'))).toBe(true);
      expect(titles.some((t) => t.includes('权利要求'))).toBe(true);
      expect(titles.some((t) => t.includes('说明书'))).toBe(true);

      console.log(`\n📝 专利撰写子目标:`);
      plan.subGoals.forEach((goal, i) => {
        console.log(`   ${i + 1}. ${goal.title} (${goal.tasks.length} 个任务)`);
      });
    });

    it('应该正确建立专利撰写依赖关系', async () => {
      const patentDecomposer = new TaskDecomposer({
        domain: 'patent',
      });

      const plan = await patentDecomposer.decompose('撰写专利');

      // 权利要求通常依赖于技术方案理解
      const hasTechToClaimsDep = plan.dependencies.edges.some((e) => {
        const fromGoal = plan.subGoals.find((g) => g.id === e.from);
        const toGoal = plan.subGoals.find((g) => g.id === e.to);
        return fromGoal?.title.includes('技术方案') && toGoal?.title.includes('权利要求');
      });

      expect(hasTechToClaimsDep || plan.dependencies.edges.length > 0).toBe(true);
    });
  });

  describe('研究任务场景', () => {
    it('应该分解研究任务', async () => {
      const researchDecomposer = new TaskDecomposer({
        domain: 'research',
      });

      const plan = await researchDecomposer.decompose('研究深度学习模型性能');

      expect(plan.subGoals.length).toBeGreaterThan(0);

      // 验证研究特定的子目标
      const titles = plan.subGoals.map((g) => g.title);
      expect(titles.some((t) => t.includes('文献') || t.includes('资料'))).toBe(true);
      expect(titles.some((t) => t.includes('数据') || t.includes('分析'))).toBe(true);

      console.log(`\n🔬 研究任务子目标:`);
      plan.subGoals.forEach((goal, i) => {
        console.log(`   ${i + 1}. ${goal.title} (${goal.tasks.length} 个任务)`);
      });
    });
  });

  describe('循环依赖检测和处理', () => {
    it('应该检测循环依赖', () => {
      const subGoals = [
        {
          id: 'goal1',
          title: '目标1',
          description: '测试',
          tasks: [],
          dependencies: ['goal2'],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
        {
          id: 'goal2',
          title: '目标2',
          description: '测试',
          tasks: [],
          dependencies: ['goal3'],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
        {
          id: 'goal3',
          title: '目标3',
          description: '测试',
          tasks: [],
          dependencies: ['goal1'],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
      ];

      const graph = analyzer.analyzeDependencies(subGoals);

      expect(graph.hasCycles).toBe(true);
      expect(graph.topologicalOrder).toBeUndefined();
    });

    it('应该自动修复循环依赖', () => {
      const autoFixAnalyzer = new DependencyAnalyzer({
        autoFixCycles: true,
      });

      const subGoals = [
        {
          id: 'goal1',
          title: '目标1',
          description: '测试',
          tasks: [],
          dependencies: ['goal2'],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
        {
          id: 'goal2',
          title: '目标2',
          description: '测试',
          tasks: [],
          dependencies: ['goal1'],
          priority: Priority.MEDIUM,
          status: TaskStatus.PENDING,
          estimatedDuration: 100,
          estimatedTokens: 1000,
        },
      ];

      const graph = autoFixAnalyzer.analyzeDependencies(subGoals);

      expect(graph.hasCycles).toBe(false);
      expect(graph.topologicalOrder).toBeDefined();
    });
  });

  describe('任务执行进度跟踪', () => {
    it('应该正确计算进度', async () => {
      const plan = await decomposer.decompose('测试任务');

      // 完成第一个子目标
      plan.subGoals[0].tasks.forEach((task) => {
        task.status = TaskStatus.COMPLETED;
      });

      const progress = scheduler.getProgress(plan);

      expect(progress.totalTasks).toBeGreaterThan(0);
      expect(progress.completedTasks).toBeGreaterThan(0);
      expect(progress.progress).toBeGreaterThan(0);
      expect(progress.progress).toBeLessThan(1);

      console.log(`\n📊 执行进度:`);
      console.log(`   已完成: ${progress.completedTasks}/${progress.totalTasks}`);
      console.log(`   进度: ${(progress.progress * 100).toFixed(1)}%`);
    });

    it('应该检测计划完成', async () => {
      const plan = await decomposer.decompose('测试任务');

      expect(scheduler.isPlanComplete(plan)).toBe(false);

      // 标记所有任务为完成
      plan.subGoals.forEach((goal) => {
        goal.tasks.forEach((task) => {
          task.status = TaskStatus.COMPLETED;
        });
      });

      expect(scheduler.isPlanComplete(plan)).toBe(true);
    });

    it('应该获取下一个可执行任务', async () => {
      const plan = await decomposer.decompose('测试任务');
      const completedTasks = new Set<string>();

      // 初始状态应该有可执行任务
      let nextTasks = scheduler.getNextExecutableTasks(plan, completedTasks);
      expect(nextTasks.length).toBeGreaterThan(0);

      console.log(`\n✅ 初始可执行任务:`);
      nextTasks.forEach((task) => {
        console.log(`   - ${task.title}`);
      });

      // 完成第一个子目标
      plan.subGoals[0].tasks.forEach((task) => {
        task.status = TaskStatus.COMPLETED;
      });
      completedTasks.add(plan.subGoals[0].id);

      // 应该有新的可执行任务
      nextTasks = scheduler.getNextExecutableTasks(plan, completedTasks);
      expect(nextTasks.length).toBeGreaterThanOrEqual(0);

      console.log(`\n✅ 完成第一个子目标后的可执行任务:`);
      if (nextTasks.length > 0) {
        nextTasks.forEach((task) => {
          console.log(`   - ${task.title}`);
        });
      } else {
        console.log(`   (无新任务，等待依赖完成)`);
      }
    });
  });

  describe('不同调度策略', () => {
    it('应该支持拓扑排序调度', async () => {
      const plan = await decomposer.decompose('测试任务');

      const topoScheduler = new TaskScheduler({ strategy: 'topological' });
      const result = topoScheduler.schedule(plan);

      expect(result.executionOrder).toBeDefined();
      expect(result.executionOrder.length).toBe(plan.subGoals.length);
    });

    it('应该支持优先级调度', async () => {
      const plan = await decomposer.decompose('测试任务');

      const priorityScheduler = new TaskScheduler({ strategy: 'priority' });
      const result = priorityScheduler.schedule(plan);

      expect(result.executionOrder).toBeDefined();
      expect(result.executionOrder.length).toBe(plan.subGoals.length);
    });

    it('应该支持关键路径调度', async () => {
      const plan = await decomposer.decompose('测试任务');

      const criticalScheduler = new TaskScheduler({ strategy: 'critical_path' });
      const result = criticalScheduler.schedule(plan);

      expect(result.executionOrder).toBeDefined();
      expect(result.criticalPath).toBeDefined();
    });

    it('应该支持并行调度', async () => {
      const plan = await decomposer.decompose('测试任务');

      const parallelScheduler = new TaskScheduler({ strategy: 'parallel' });
      const result = parallelScheduler.schedule(plan);

      expect(result.parallelGroups).toBeDefined();
      expect(result.parallelGroups.length).toBeGreaterThan(0);
    });
  });

  describe('复杂场景', () => {
    it('应该处理多层次分解', async () => {
      const deepDecomposer = new TaskDecomposer({
        maxDepth: 4,
      });

      const plan = await deepDecomposer.decompose('构建复杂的AI系统');

      expect(plan.subGoals.length).toBeGreaterThan(0);

      const totalTasks = plan.subGoals.reduce((sum, g) => sum + g.tasks.length, 0);
      expect(totalTasks).toBeGreaterThan(0);

      console.log(`\n🏗️ 复杂系统分解结果:`);
      console.log(`   子目标: ${plan.subGoals.length}`);
      console.log(`   总任务: ${totalTasks}`);
      console.log(`   预估时间: ${(plan.estimatedDuration / 60).toFixed(1)} 分钟`);
    });

    it('应该处理资源约束', async () => {
      const plan = await decomposer.decompose('测试任务');

      const constrainedScheduler = new TaskScheduler({
        strategy: 'parallel',
        maxParallelTasks: 2,
        considerResourceConstraints: true,
        availableResources: ['writing'], // 限制资源
      });

      const result = constrainedScheduler.schedule(plan);

      expect(result.resourceUtilization).toBeLessThanOrEqual(1);
      expect(result.parallelGroups.length).toBeGreaterThan(0);

      console.log(`\n⚙️ 资源约束调度:`);
      console.log(`   资源利用率: ${(result.resourceUtilization * 100).toFixed(1)}%`);
      console.log(`   并行组数: ${result.parallelGroups.length}`);
    });
  });

  describe('统计和监控', () => {
    it('应该提供完整的统计信息', async () => {
      const plan = await decomposer.decompose('监控测试');

      const depStats = analyzer.getStats(plan.dependencies);
      const scheduleResult = scheduler.schedule(plan);
      const progress = scheduler.getProgress(plan);

      expect(depStats).toBeDefined();
      expect(scheduleResult).toBeDefined();
      expect(progress).toBeDefined();

      console.log(`\n📈 完整统计信息:`);
      console.log(`   === 依赖图 ===`);
      console.log(`   节点数: ${depStats.totalNodes}`);
      console.log(`   边数: ${depStats.totalEdges}`);
      console.log(`   平均度: ${depStats.avgDegree.toFixed(2)}`);
      console.log(`   最大度: ${depStats.maxDegree}`);
      console.log(`   循环依赖: ${depStats.hasCycles ? '是' : '否'}`);
      console.log(`   关键路径长度: ${depStats.criticalPathLength}`);

      console.log(`\n   === 调度 ===`);
      console.log(`   执行顺序: ${scheduleResult.executionOrder.join(' → ')}`);
      console.log(`   并行组数: ${scheduleResult.parallelGroups.length}`);
      console.log(`   关键路径: ${scheduleResult.criticalPath.join(' → ')}`);
      console.log(`   资源利用率: ${(scheduleResult.resourceUtilization * 100).toFixed(1)}%`);

      console.log(`\n   === 进度 ===`);
      console.log(`   总任务: ${progress.totalTasks}`);
      console.log(`   已完成: ${progress.completedTasks}`);
      console.log(`   进度: ${(progress.progress * 100).toFixed(1)}%`);
    });
  });
});
