/**
 * TUIRenderer 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TUIRenderer } from '../../src/visualization/TUIRenderer.js';
import { Priority, TaskStatus, PlanStatus } from '@yunpat/core';

describe('TUIRenderer', () => {
  let renderer: TUIRenderer;

  beforeEach(() => {
    renderer = new TUIRenderer();
  });

  /**
   * 辅助函数：创建测试计划
   */
  function createTestPlan() {
    return {
      id: 'plan1',
      goal: '专利撰写计划',
      subGoals: [
        {
          id: 'goal1',
          title: '技术方案理解',
          description: '理解技术方案',
          tasks: [
            {
              id: 'task1',
              title: '分析技术要点',
              description: '分析技术要点',
              type: 'research' as any,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['analysis'],
              estimatedTokens: 2000,
              estimatedDuration: 300,
              createdAt: new Date(),
            },
          ],
          dependencies: [],
          priority: Priority.HIGH,
          status: TaskStatus.COMPLETED,
          estimatedDuration: 300,
          estimatedTokens: 2000,
        },
        {
          id: 'goal2',
          title: '权利要求生成',
          description: '生成权利要求',
          tasks: [
            {
              id: 'task2',
              title: '撰写独立权利要求',
              description: '撰写独立权利要求',
              type: 'writing' as any,
              status: TaskStatus.PENDING,
              requiredCapabilities: ['writing'],
              estimatedTokens: 3000,
              estimatedDuration: 600,
              createdAt: new Date(),
            },
          ],
          dependencies: ['goal1'],
          priority: Priority.CRITICAL,
          status: TaskStatus.IN_PROGRESS,
          estimatedDuration: 600,
          estimatedTokens: 3000,
        },
      ],
      dependencies: {
        nodes: new Map(),
        edges: [
          {
            from: 'goal1',
            to: 'goal2',
            strength: 1.0,
            type: 'strong',
          },
        ],
        hasCycles: false,
        topologicalOrder: ['goal1', 'goal2'],
      },
      estimatedDuration: 900,
      estimatedTokens: 5000,
      status: PlanStatus.READY,
      createdAt: new Date(),
    };
  }

  describe('render', () => {
    it('应该渲染TUI界面', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan);

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe('tui');
    });

    it('应该包含标题栏', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan);

      expect(result.content).toContain('┌─');
      expect(result.content).toContain('专利撰写计划');
    });

    it('应该包含菜单栏', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan);

      expect(result.content).toContain('[F1]');
      expect(result.content).toContain('[Q]');
    });

    it('应该包含状态栏', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan);

      expect(result.content).toContain('任务:');
      expect(result.content).toContain('完成:');
    });

    it('应该显示帮助信息', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan, { showHelp: true });

      expect(result.content).toContain('键盘快捷键');
      expect(result.content).toContain('↑/↓');
    });
  });

  describe('节点选择', () => {
    it('应该选择节点', () => {
      renderer.selectNode('goal1');
      const selected = renderer.getSelectedNodes();

      expect(selected.has('goal1')).toBe(true);
    });

    it('应该取消选择节点', () => {
      renderer.selectNode('goal1');
      renderer.deselectNode('goal1');
      const selected = renderer.getSelectedNodes();

      expect(selected.has('goal1')).toBe(false);
    });

    it('应该切换节点选择状态', () => {
      renderer.toggleNode('goal1');
      expect(renderer.getSelectedNodes().has('goal1')).toBe(true);

      renderer.toggleNode('goal1');
      expect(renderer.getSelectedNodes().has('goal1')).toBe(false);
    });

    it('应该清空选择', () => {
      renderer.selectNode('goal1');
      renderer.selectNode('goal2');
      renderer.clearSelection();

      expect(renderer.getSelectedNodes().size).toBe(0);
    });

    it('应该全选', () => {
      const plan = createTestPlan();
      renderer.selectAll(plan);

      expect(renderer.getSelectedNodes().size).toBe(2);
    });
  });

  describe('当前节点', () => {
    it('应该设置当前节点', () => {
      renderer.setCurrentNode('goal1');

      expect(renderer.getCurrentNode()).toBe('goal1');
    });

    it('应该取消当前节点', () => {
      renderer.setCurrentNode('goal1');
      renderer.setCurrentNode(null);

      expect(renderer.getCurrentNode()).toBeNull();
    });
  });

  describe('状态过滤', () => {
    it('应该设置状态过滤', () => {
      renderer.setStatusFilter([TaskStatus.COMPLETED]);

      expect(renderer.getStatusFilter().has(TaskStatus.COMPLETED)).toBe(true);
      expect(renderer.getStatusFilter().has(TaskStatus.PENDING)).toBe(false);
    });

    it('应该过滤显示内容', () => {
      const plan = createTestPlan();
      renderer.setStatusFilter([TaskStatus.COMPLETED]);

      const result = renderer.render(plan);

      // 只应该显示已完成的任务
      expect(result.content).toContain('技术方案理解');
    });
  });

  describe('任务详情渲染', () => {
    it('应该显示任务详情', () => {
      const plan = createTestPlan();
      renderer.setCurrentNode('goal1');

      const result = renderer.render(plan);

      expect(result.content).toContain('任务详情');
      expect(result.content).toContain('ID: goal1');
    });

    it('应该显示依赖关系', () => {
      const plan = createTestPlan();
      renderer.setCurrentNode('goal2');

      const result = renderer.render(plan);

      expect(result.content).toContain('依赖:');
    });

    it('应该显示被依赖关系', () => {
      const plan = createTestPlan();
      renderer.setCurrentNode('goal1');

      const result = renderer.render(plan);

      expect(result.content).toContain('被依赖:');
    });
  });

  describe('进度计算', () => {
    it('应该正确计算进度', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan);

      expect(result.content).toContain('1/2');
      expect(result.content).toContain('50.0%');
    });
  });

  describe('统计计算', () => {
    it('应该正确计算统计信息', () => {
      const plan = createTestPlan();
      const result = renderer.render(plan);

      expect(result.content).toContain('任务: 2');
      expect(result.content).toContain('完成: 1');
      expect(result.content).toContain('进行中: 1');
    });
  });

  describe('边界情况', () => {
    it('应该处理空计划', () => {
      const plan: any = {
        id: 'empty',
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

      const result = renderer.render(plan);

      expect(result.content).toBeDefined();
    });

    it('应该处理无依赖关系的计划', () => {
      const plan = createTestPlan();
      plan.dependencies.edges = [];

      const result = renderer.render(plan);

      expect(result.content).toBeDefined();
    });

    it('应该处理所有任务完成的计划', () => {
      const plan = createTestPlan();
      plan.subGoals.forEach((goal) => {
        goal.status = TaskStatus.COMPLETED;
      });

      const result = renderer.render(plan);

      expect(result.content).toContain('2/2');
    });
  });

  describe('渲染性能', () => {
    it('应该在合理时间内完成渲染', () => {
      const plan = createTestPlan();
      const startTime = Date.now();

      const result = renderer.render(plan);

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      expect(result.metadata.renderTime).toBeLessThan(1000);
      expect(renderTime).toBeLessThan(1000);
    });
  });
});
