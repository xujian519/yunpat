/**
 * 性能基准测试
 *
 * 测试各模块的性能表现，建立性能基准
 */

import { describe, it, expect } from 'vitest';
import {
  HallucinationDetector,
  ConstitutionalAI,
  DynamicReplanner,
  TaskDecomposer,
  PATENT_PRINCIPLES,
} from '../../src/index.js';
import { DependencyVisualizer } from '@yunpat/cli';
import { createDeepSeekModel } from '../../src/llm/NativeLLMAdapter.js';

describe('性能基准测试', () => {
  /**
   * 辅助函数：创建测试数据
   */
  function createTestPatentContent(length: number): string {
    const baseContent = `
      一种数据处理装置，包括处理器、存储器和总线。

      1. 一种数据处理装置，其特征在于，包括：
         处理器，用于执行指令；
         存储器，耦合到所述处理器，用于存储数据；
         总线，用于在所述处理器和所述存储器之间传输数据。

      2. 根据权利要求1所述的数据处理装置，其特征在于，
         所述处理器包括多个处理核心。

      3. 根据权利要求1所述的数据处理装置，其特征在于，
         所述存储器包括动态随机存取存储器（DRAM）。
    `;

    // 重复内容以达到指定长度
    let content = '';
    while (content.length < length) {
      content += baseContent;
    }

    return content.substring(0, length);
  }

  describe('幻觉检测系统性能', () => {
    it('应该在合理时间内完成小文档检测 (< 2秒)', async () => {
      const detector = new HallucinationDetector(null as any, {
        enableFactCheck: true,
        enableLogicalCheck: true,
        enableSourceCheck: false, // 跳过需要知识库的检查
      });

      const content = createTestPatentContent(1000); // 1000字符
      const startTime = Date.now();

      const report = await detector.detect(content);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
      expect(report).toBeDefined();
    });

    it('应该在合理时间内完成中等文档检测 (< 5秒)', async () => {
      const detector = new HallucinationDetector(null as any, {
        enableFactCheck: true,
        enableLogicalCheck: true,
        enableSourceCheck: false,
      });

      const content = createTestPatentContent(5000); // 5000字符
      const startTime = Date.now();

      const report = await detector.detect(content);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
      expect(report).toBeDefined();
    });

    it('应该在合理时间内完成大文档检测 (< 15秒)', async () => {
      const detector = new HallucinationDetector(null as any, {
        enableFactCheck: true,
        enableLogicalCheck: true,
        enableSourceCheck: false,
      });

      const content = createTestPatentContent(20000); // 20000字符
      const startTime = Date.now();

      const report = await detector.detect(content);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(15000);
      expect(report).toBeDefined();
    });
  });

  describe('Constitutional AI性能', () => {
    it('应该在合理时间内完成合规检查 (< 3秒)', async () => {
      const ai = new ConstitutionalAI(PATENT_PRINCIPLES, null as any);

      const content = createTestPatentContent(2000);
      const startTime = Date.now();

      const report = await ai.checkCompliance(content);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000);
      expect(report).toBeDefined();
    });

    it('应该在合理时间内完成自动纠正 (< 5秒)', async () => {
      const ai = new ConstitutionalAI(PATENT_PRINCIPLES, null as any);

      const content = createTestPatentContent(2000);
      const startTime = Date.now();

      const correction = await ai.correct(content);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
      expect(correction).toBeDefined();
    });
  });

  describe('目标分解性能', () => {
    it('应该在合理时间内完成简单任务分解 (< 5秒)', async () => {
      const decomposer = new TaskDecomposer(null as any);

      const goal = '撰写一份专利申请';
      const startTime = Date.now();

      const plan = await decomposer.decompose(goal);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
      expect(plan).toBeDefined();
    });

    it('应该在合理时间内完成复杂任务分解 (< 10秒)', async () => {
      const decomposer = new TaskDecomposer(null as any);

      const goal = '撰写一份完整的专利申请，包括权利要求书、说明书和摘要';
      const startTime = Date.now();

      const plan = await decomposer.decompose(goal, {
        maxDepth: 4,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000);
      expect(plan).toBeDefined();
    });
  });

  describe('动态重规划性能', () => {
    it('应该在合理时间内完成偏离检测 (< 2秒)', async () => {
      const replanner = new DynamicReplanner(null, {
        enableDeviationDetection: true,
        enableFailureDetection: false,
        enableTimeoutDetection: false,
        enableQualityDropDetection: false,
      });

      const plannedState: any = {
        plan: { subGoals: [] },
        completedGoals: new Set(['goal1']),
        failedGoals: new Set(),
        startTime: Date.now(),
        elapsedTime: 100,
        qualityMetrics: {
          overallQuality: 0.9,
          taskSuccessRate: 1.0,
          averageQuality: 0.9,
          qualityTrend: 'stable',
        },
        resourceUsage: {
          tokensUsed: 1000,
          estimatedTokens: 5000,
          timeElapsed: 100,
          estimatedTime: 1000,
          resources: new Map(),
        },
      };

      const actualState: any = {
        ...plannedState,
        completedGoals: new Set(),
      };

      const startTime = Date.now();

      const result = await replanner.shouldReplan(plannedState, actualState);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
      expect(result).toBeDefined();
    });

    it('应该在合理时间内完成重规划 (< 5秒)', async () => {
      const replanner = new DynamicReplanner();

      const plan: any = {
        id: 'plan1',
        goal: '测试计划',
        subGoals: [],
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 1000,
        estimatedTokens: 5000,
        status: 'ready',
        createdAt: new Date(),
      };

      const executionState: any = {
        plan,
        completedGoals: new Set(),
        failedGoals: new Set(['goal1']),
        startTime: Date.now(),
        elapsedTime: 100,
        qualityMetrics: {
          overallQuality: 0.9,
          taskSuccessRate: 1.0,
          averageQuality: 0.9,
          qualityTrend: 'stable',
        },
        resourceUsage: {
          tokensUsed: 1000,
          estimatedTokens: 5000,
          timeElapsed: 100,
          estimatedTime: 1000,
          resources: new Map(),
        },
      };

      const trigger: any = {
        type: 'failure',
        threshold: 0,
        description: '任务失败',
        condition: () => true,
      };

      const startTime = Date.now();

      const result = await replanner.replan(plan, executionState, trigger);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
      expect(result).toBeDefined();
    });
  });

  describe('可视化性能', () => {
    it('应该在合理时间内完成文本渲染 (< 1秒)', () => {
      const visualizer = new DependencyVisualizer();

      const plan: any = {
        id: 'plan1',
        goal: '测试计划',
        subGoals: Array(50).fill(null).map((_, i) => ({
          id: `goal${i}`,
          title: `任务${i}`,
          description: `任务${i}的描述`,
          tasks: [],
          dependencies: i > 0 ? [`goal${i - 1}`] : [],
          priority: 'medium',
          status: 'pending',
          estimatedDuration: 100,
          estimatedTokens: 1000,
        })),
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 5000,
        estimatedTokens: 50000,
        status: 'ready',
        createdAt: new Date(),
      };

      const startTime = Date.now();

      const result = visualizer.render(plan, { format: 'text' });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
      expect(result.content).toBeDefined();
    });

    it('应该在合理时间内完成树状渲染 (< 1秒)', () => {
      const visualizer = new DependencyVisualizer();

      const plan: any = {
        id: 'plan1',
        goal: '测试计划',
        subGoals: Array(50).fill(null).map((_, i) => ({
          id: `goal${i}`,
          title: `任务${i}`,
          description: `任务${i}的描述`,
          tasks: [],
          dependencies: i > 0 ? [`goal${i - 1}`] : [],
          priority: 'medium',
          status: 'pending',
          estimatedDuration: 100,
          estimatedTokens: 1000,
        })),
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 5000,
        estimatedTokens: 50000,
        status: 'ready',
        createdAt: new Date(),
      };

      const startTime = Date.now();

      const result = visualizer.render(plan, { format: 'tree' });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
      expect(result.content).toBeDefined();
    });

    it('应该在合理时间内完成TUI渲染 (< 1秒)', () => {
      const visualizer = new DependencyVisualizer();

      const plan: any = {
        id: 'plan1',
        goal: '测试计划',
        subGoals: Array(50).fill(null).map((_, i) => ({
          id: `goal${i}`,
          title: `任务${i}`,
          description: `任务${i}的描述`,
          tasks: [],
          dependencies: i > 0 ? [`goal${i - 1}`] : [],
          priority: 'medium',
          status: i < 25 ? 'completed' : 'pending',
          estimatedDuration: 100,
          estimatedTokens: 1000,
        })),
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 5000,
        estimatedTokens: 50000,
        status: 'ready',
        createdAt: new Date(),
      };

      const startTime = Date.now();

      const result = visualizer.render(plan, { format: 'tui' as any });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
      expect(result.content).toBeDefined();
    });
  });

  describe('内存使用', () => {
    it('应该在合理内存范围内运行', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 创建多个实例
      const detectors = Array(10).fill(null).map(
        () => new HallucinationDetector(null as any)
      );

      const plans = Array(10).fill(null).map((_, i) => ({
        id: `plan${i}`,
        goal: `计划${i}`,
        subGoals: Array(20).fill(null).map((_, j) => ({
          id: `goal${i}-${j}`,
          title: `任务${j}`,
          description: `任务${j}的描述`,
          tasks: [],
          dependencies: [],
          priority: 'medium',
          status: 'pending',
          estimatedDuration: 100,
          estimatedTokens: 1000,
        })),
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 2000,
        estimatedTokens: 20000,
        status: 'ready',
        createdAt: new Date(),
      }));

      const visualizer = new DependencyVisualizer();

      // 渲染多个计划
      plans.forEach(plan => {
        visualizer.render(plan, { format: 'text' });
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // 内存增长应该小于100MB
      expect(memoryIncreaseMB).toBeLessThan(100);
    });
  });

  describe('并发性能', () => {
    it('应该能够并发处理多个任务', async () => {
      const decomposer = new TaskDecomposer(null as any);

      const goals = Array(5).fill(null).map((_, i) => `撰写专利申请${i}`);

      const startTime = Date.now();

      const plans = await Promise.all(
        goals.map(goal => decomposer.decompose(goal))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 并发处理应该比串行快
      expect(duration).toBeLessThan(20000); // 5个任务，每个<5秒
      expect(plans).toHaveLength(5);
    });
  });
});
