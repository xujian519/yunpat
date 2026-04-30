/**
 * DependencyVisualizer 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyVisualizer } from '../../src/visualization/DependencyVisualizer.js';
import { ExportFormat } from '../../src/visualization/types.js';
import { Priority, TaskStatus, PlanStatus } from '@yunpat/core';
import { writeFile } from 'fs/promises';
import { exec } from 'child_process';

// Mock fs和child_process
vi.mock('fs/promises');
vi.mock('child_process');

describe('DependencyVisualizer', () => {
  let visualizer: DependencyVisualizer;

  beforeEach(() => {
    visualizer = new DependencyVisualizer();
    vi.clearAllMocks();
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
          tasks: [{
            id: 'task1',
            title: '分析技术要点',
            description: '分析技术要点',
            type: 'research' as any,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['analysis'],
            estimatedTokens: 2000,
            estimatedDuration: 300,
            createdAt: new Date(),
          }],
          dependencies: [],
          priority: Priority.HIGH,
          status: TaskStatus.COMPLETED,
          estimatedDuration: 300,
          estimatedTokens: 2000,
        },
      ],
      dependencies: {
        nodes: new Map(),
        edges: [],
        hasCycles: false,
        topologicalOrder: ['goal1'],
      },
      estimatedDuration: 300,
      estimatedTokens: 2000,
      status: PlanStatus.READY,
      createdAt: new Date(),
    };
  }

  describe('render', () => {
    it('应该渲染为文本格式', () => {
      const plan = createTestPlan();
      const result = visualizer.render(plan, { format: 'text' });

      expect(result.content).toBeDefined();
      expect(result.metadata.format).toBe('text');
    });

    it('应该渲染为树状格式', () => {
      const plan = createTestPlan();
      const result = visualizer.render(plan, { format: 'tree' });

      expect(result.metadata.format).toBe('tree');
    });

    it('应该渲染为图格式', () => {
      const plan = createTestPlan();
      const result = visualizer.render(plan, { format: 'graph' });

      expect(result.metadata.format).toBe('graph');
    });

    it('应该渲染为TUI格式', () => {
      const plan = createTestPlan();
      const result = visualizer.render(plan, { format: 'tui' as any });

      expect(result.metadata.format).toBe('tui');
    });
  });

  describe('export', () => {
    it('应该导出为DOT格式', async () => {
      const plan = createTestPlan();
      const outputPath = '/tmp/test.dot';

      vi.mocked(writeFile).mockResolvedValue(undefined);

      await visualizer.export(plan, {
        format: ExportFormat.DOT,
        outputPath,
      });

      expect(writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('digraph TaskDependencies'),
        'utf-8'
      );
    });

    it('应该导出为Mermaid格式', async () => {
      const plan = createTestPlan();
      const outputPath = '/tmp/test.mmd';

      vi.mocked(writeFile).mockResolvedValue(undefined);

      await visualizer.export(plan, {
        format: ExportFormat.MERMAID,
        outputPath,
      });

      expect(writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('graph TD'),
        'utf-8'
      );
    });

    it('应该导出为JSON格式', async () => {
      const plan = createTestPlan();
      const outputPath = '/tmp/test.json';

      vi.mocked(writeFile).mockResolvedValue(undefined);

      await visualizer.export(plan, {
        format: ExportFormat.JSON,
        outputPath,
      });

      expect(writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('"goal"'),
        'utf-8'
      );
    });

    it('应该在Graphviz未安装时抛出错误', async () => {
      const plan = createTestPlan();
      const outputPath = '/tmp/test.png';

      vi.mocked(exec).mockRejectedValue(new Error('command not found'));
      vi.mocked(writeFile).mockResolvedValue(undefined);

      await expect(
        visualizer.export(plan, {
          format: ExportFormat.PNG,
          outputPath,
        })
      ).rejects.toThrow('导出PNG失败');
    });

    it('应该拒绝不支持的格式', async () => {
      const plan = createTestPlan();

      await expect(
        visualizer.export(plan, {
          format: 'unsupported' as ExportFormat,
          outputPath: '/tmp/test.txt',
        })
      ).rejects.toThrow('不支持的导出格式');
    });
  });

  describe('checkExportDependencies', () => {
    it('应该检查PNG导出依赖', async () => {
      vi.mocked(exec).mockResolvedValue({ stdout: '/usr/bin/dot', stderr: '' });

      const result = await visualizer.checkExportDependencies(ExportFormat.PNG);

      expect(result.available).toBe(true);
      expect(result.message).toContain('Graphviz已安装');
    });

    it('应该检测Graphviz未安装', async () => {
      vi.mocked(exec).mockRejectedValue(new Error('command not found'));

      const result = await visualizer.checkExportDependencies(ExportFormat.PNG);

      expect(result.available).toBe(false);
      expect(result.message).toContain('需要安装Graphviz');
    });

    it('应该跳过JSON的依赖检查', async () => {
      const result = await visualizer.checkExportDependencies(ExportFormat.JSON);

      expect(result.available).toBe(true);
      expect(result.message).toContain('导出依赖已满足');
    });
  });

  describe('getSupportedFormats', () => {
    it('应该返回所有支持的格式', () => {
      const formats = visualizer.getSupportedFormats();

      expect(formats).toContain(ExportFormat.DOT);
      expect(formats).toContain(ExportFormat.PNG);
      expect(formats).toContain(ExportFormat.SVG);
      expect(formats).toContain(ExportFormat.JSON);
      expect(formats).toContain(ExportFormat.MERMAID);
    });
  });

  describe('getFormatDescription', () => {
    it('应该返回格式描述', () => {
      const description = visualizer.getFormatDescription(ExportFormat.DOT);

      expect(description).toContain('Graphviz DOT');
    });

    it('应该为未知格式返回格式名称', () => {
      const description = visualizer.getFormatDescription('unknown' as ExportFormat);

      expect(description).toBe('unknown');
    });
  });

  describe('getTextRenderer', () => {
    it('应该返回文本渲染器', () => {
      const renderer = visualizer.getTextRenderer();

      expect(renderer).toBeDefined();
      expect(renderer.render).toBeDefined();
    });
  });

  describe('getTUIRenderer', () => {
    it('应该返回TUI渲染器', () => {
      const renderer = visualizer.getTUIRenderer();

      expect(renderer).toBeDefined();
      expect(renderer.render).toBeDefined();
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

      const result = visualizer.render(plan, { format: 'text' });

      expect(result.content).toBeDefined();
      expect(result.metadata.nodeCount).toBe(0);
    });

    it('应该处理无依赖关系的计划', () => {
      const plan = createTestPlan();
      plan.dependencies.edges = [];

      const result = visualizer.render(plan, { format: 'text' });

      expect(result.content).toBeDefined();
    });
  });

  describe('渲染性能', () => {
    it('应该在合理时间内完成渲染', () => {
      const plan = createTestPlan();
      const startTime = Date.now();

      const result = visualizer.render(plan, { format: 'text' });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      expect(result.metadata.renderTime).toBeLessThan(1000);
      expect(renderTime).toBeLessThan(1000);
    });
  });
});
