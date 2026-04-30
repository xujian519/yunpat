/**
 * ToolSelectionOptimizer 性能测试
 *
 * 测试工具选择优化器的性能和资源使用
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolSelectionOptimizer } from '../../src/tools/ToolSelectionOptimizer.js';
import { toolUsageTracker } from '../../src/tools/ToolUsageTracker.js';
import type { EnhancedTool } from '../../src/tools/types.js';

describe('ToolSelectionOptimizer - 性能测试', () => {
  let optimizer: ToolSelectionOptimizer;

  beforeEach(() => {
    toolUsageTracker.clear();
    toolUsageTracker.setAutoSave(false);
    optimizer = new ToolSelectionOptimizer();
  });

  // 创建模拟工具
  const createMockTools = (count: number): EnhancedTool[] => {
    return Array.from({ length: count }, (_, i) => ({
      metadata: {
        name: `Tool${i}`,
        description: `工具${i}的描述`,
        category: i % 2 === 0 ? 'document' : 'image',
      },
      execute: async () => ({ result: `success${i}` }),
    }));
  };

  describe('提示生成性能', () => {
    it('应该快速生成优化提示（少量工具）', () => {
      const tools = createMockTools(10);
      const userInput = '测试输入';

      const start = performance.now();
      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, tools);
      const duration = performance.now() - start;

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该快速生成优化提示（大量工具）', () => {
      const tools = createMockTools(100);
      const userInput = '测试输入';

      const start = performance.now();
      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, tools);
      const duration = performance.now() - start;

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // 应该在500ms内完成
    });

    it('应该支持带上下文的提示生成', () => {
      const tools = createMockTools(50);
      const userInput = '测试输入';
      const context = {
        conversationHistory: Array.from({ length: 20 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `消息${i}`,
        })),
        currentTask: '测试任务',
      };

      const start = performance.now();
      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, tools, context);
      const duration = performance.now() - start;

      expect(prompt).toBeDefined();
      expect(prompt).toContain('对话历史');
      expect(duration).toBeLessThan(300); // 应该在300ms内完成
    });
  });

  describe('记录使用性能', () => {
    it('应该快速记录工具使用', () => {
      const start = performance.now();
      optimizer.recordToolUsage(
        'TestTool',
        '测试输入',
        { param1: 'value1' },
        {
          success: true,
          executionTime: 1000,
          output: { result: 'success' },
        }
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10); // 应该在10ms内完成
    });

    it('应该支持批量记录', () => {
      const count = 1000;
      const start = performance.now();

      for (let i = 0; i < count; i++) {
        optimizer.recordToolUsage(
          `Tool${i % 10}`,
          `测试输入${i}`,
          {},
          {
            success: i % 10 < 7, // 70%成功率
            executionTime: 1000 + Math.random() * 1000,
            output: { result: 'success' },
          }
        );
      }

      const duration = performance.now() - start;

      // 1000次记录应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该支持带上下文的记录', () => {
      const context = {
        sessionId: 'test-session',
        userId: 'test-user',
        conversationHistory: Array.from({ length: 50 }, (_, i) => ({
          role: 'user',
          content: `消息${i}`,
        })),
      };

      const start = performance.now();
      optimizer.recordToolUsage(
        'TestTool',
        '测试输入',
        {},
        {
          success: true,
          executionTime: 1000,
          output: {},
        },
        context
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20); // 应该在20ms内完成
    });
  });

  describe('性能报告生成', () => {
    beforeEach(() => {
      // 添加一些测试数据
      for (let i = 0; i < 100; i++) {
        optimizer.recordToolUsage(
          `Tool${i % 5}`,
          `测试输入${i}`,
          {},
          {
            success: i % 10 < 7,
            executionTime: 1000 + i * 10,
            output: {},
          }
        );
      }
    });

    it('应该快速生成性能报告', () => {
      const start = performance.now();
      const report = optimizer.getPerformanceReport();
      const duration = performance.now() - start;

      expect(report).toBeDefined();
      expect(report.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该快速分析选择准确性', () => {
      const start = performance.now();
      const analysis = optimizer.analyzeSelectionAccuracy();
      const duration = performance.now() - start;

      expect(analysis).toBeDefined();
      expect(analysis.accuracy).toBeDefined();
      expect(duration).toBeLessThan(50); // 应该在50ms内完成
    });
  });

  describe('推荐性能', () => {
    beforeEach(() => {
      // 添加工具使用历史
      for (let i = 0; i < 100; i++) {
        optimizer.recordToolUsage(
          'PdfTool',
          '处理PDF文档',
          {},
          {
            success: true,
            executionTime: 1000,
            output: {},
          }
        );
      }

      for (let i = 0; i < 50; i++) {
        optimizer.recordToolUsage(
          'PdfTool',
          '处理PDF文档',
          {},
          {
            success: false,
            executionTime: 500,
            error: 'Error',
          }
        );
      }
    });

    it('应该快速生成推荐', () => {
      const userInput = '处理PDF文档';
      const availableTools = ['PdfTool', 'ImageTool', 'AudioTool'];

      const start = performance.now();
      const recommendations = optimizer.optimizeToolSelectionPrompt(userInput, createMockTools(3));
      const duration = performance.now() - start;

      expect(recommendations).toBeDefined();
      expect(duration).toBeLessThan(100); // 应该在100ms内完成
    });
  });

  describe('内存使用', () => {
    it('应该在大量记录后保持合理的内存使用', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 添加大量记录
      for (let i = 0; i < 10000; i++) {
        optimizer.recordToolUsage(
          `Tool${i % 100}`,
          `测试输入${i}`,
          { data: 'x'.repeat(100) }, // 每次记录100字节
          {
            success: true,
            executionTime: 1000,
            output: { result: 'x'.repeat(200) },
          }
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该在合理范围内（<100MB）
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('并发性能', () => {
    it('应该支持并发生成提示', async () => {
      const tools = createMockTools(50);
      const requests = Array.from({ length: 20 }, (_, i) => ({
        userInput: `测试输入${i}`,
        tools,
      }));

      const start = performance.now();

      // 模拟并发请求
      const promises = requests.map((req) =>
        Promise.resolve(optimizer.optimizeToolSelectionPrompt(req.userInput, req.tools))
      );

      const results = await Promise.all(promises);
      const duration = performance.now() - start;

      expect(results.length).toBe(20);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
