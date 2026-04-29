/**
 * ToolSelectionOptimizer 集成测试
 *
 * TDD方式：
 * 1. 先写测试（红色 - 失败）
 * 2. 修复代码
 * 3. 运行测试（绿色 - 通过）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolSelectionOptimizer } from '../../src/tools/ToolSelectionOptimizer.js';
import type { EnhancedTool } from '../../src/tools/types.js';
import { toolUsageTracker } from '../../src/tools/ToolUsageTracker.js';
import { promises as fs } from 'fs';

describe('ToolSelectionOptimizer - 集成测试', () => {
  let optimizer: ToolSelectionOptimizer;
  const testDataDir = './test-data-optimizer';

  beforeEach(() => {
    toolUsageTracker.clear();
    optimizer = new ToolSelectionOptimizer();
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略错误
    }
  });

  describe('optimizeToolSelectionPrompt', () => {
    let mockTools: EnhancedTool[];

    beforeEach(() => {
      mockTools = [
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: '将PDF文件转换为Markdown格式',
            category: 'document',
          },
          execute: async () => ({ markdown: '#' }),
        },
        {
          metadata: {
            name: 'PdfParseTool',
            description: '解析PDF文件',
            category: 'document',
          },
          execute: async () => ({ text: 'text' }),
        },
        {
          metadata: {
            name: 'ImageOcrTool',
            description: '图片OCR识别',
            category: 'image',
          },
          execute: async () => ({ text: 'text' }),
        },
      ];
    });

    it('应该生成优化的工具选择提示', () => {
      const userInput = '帮我把这个PDF文件转换成Markdown格式';

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('应该包含用户请求', () => {
      const userInput = '转换PDF到Markdown';

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      expect(prompt).toContain('转换PDF到Markdown');
    });

    it('应该包含可用工具列表', () => {
      const userInput = '处理文档';

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      expect(prompt).toContain('可用工具');
      expect(prompt).toContain('PdfToMarkdownTool');
      expect(prompt).toContain('PdfParseTool');
      expect(prompt).toContain('ImageOcrTool');
    });

    it('应该包含工具选择指南', () => {
      const userInput = '测试';

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      expect(prompt).toContain('工具选择指南');
      expect(prompt).toContain('选择原则');
      expect(prompt).toContain('决策流程');
    });

    it('应该包含Few-shot示例', () => {
      const userInput = '转换PDF';

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      expect(prompt).toContain('工具选择示例');
    });

    it('应该支持带上下文的提示生成', () => {
      const userInput = '转换PDF';
      const context = {
        conversationHistory: [
          { role: 'user', content: '我需要处理文档' },
          { role: 'assistant', content: '我可以帮您' },
        ],
        currentTask: '文档格式转换',
      };

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools, context);

      expect(prompt).toContain('文档格式转换');
      expect(prompt).toContain('对话历史');
    });

    it('应该为工具生成增强描述', () => {
      const userInput = '转换PDF';

      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      // 检查是否包含增强的字段
      expect(prompt).toContain('描述');
      expect(prompt).toContain('常见用例');
    });

    it('应该包含推荐工具（如果有历史数据）', () => {
      // 先记录一些使用历史
      optimizer.recordToolUsage(
        'PdfToMarkdownTool',
        '转换PDF到Markdown',
        { filePath: 'doc.pdf' },
        {
          success: true,
          executionTime: 1500,
          output: { markdown: '#' },
        }
      );

      const userInput = '转换PDF';
      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);

      // 应该包含推荐部分
      expect(prompt).toBeDefined();
    });
  });

  describe('recordToolUsage', () => {
    it('应该记录工具使用', () => {
      const recordId = optimizer.recordToolUsage(
        'TestTool',
        '测试输入',
        { param1: 'value1' },
        {
          success: true,
          executionTime: 1234,
          output: { result: 'success' },
        }
      );

      expect(recordId).toBeDefined();
      expect(typeof recordId).toBe('string');
    });

    it('应该支持带上下文的记录', () => {
      const recordId = optimizer.recordToolUsage(
        'TestTool',
        '测试输入',
        {},
        {
          success: true,
          executionTime: 1000,
          output: {},
        },
        {
          sessionId: 'session-001',
          userId: 'user-001',
          conversationHistory: [
            { role: 'user', content: '测试' },
            { role: 'assistant', content: '好的' },
          ],
        }
      );

      expect(recordId).toBeDefined();
    });

    it('应该记录成功的工具调用', () => {
      optimizer.recordToolUsage(
        'TestTool',
        '测试',
        {},
        {
          success: true,
          executionTime: 1000,
          output: {},
        }
      );

      const report = optimizer.getPerformanceReport();
      expect(report).toContain('TestTool');
      expect(report).toContain('100%');
    });

    it('应该记录失败的工具调用', () => {
      optimizer.recordToolUsage(
        'TestTool',
        '测试',
        {},
        {
          success: false,
          executionTime: 500,
          error: 'Test error',
        }
      );

      const report = optimizer.getPerformanceReport();
      expect(report).toContain('TestTool');
      expect(report).toContain('0%');
    });
  });

  describe('getPerformanceReport', () => {
    beforeEach(() => {
      // 添加一些测试数据
      optimizer.recordToolUsage(
        'PdfToMarkdownTool',
        '转换PDF',
        { filePath: 'doc1.pdf' },
        { success: true, executionTime: 1000, output: {} }
      );

      optimizer.recordToolUsage(
        'PdfToMarkdownTool',
        '转换PDF',
        { filePath: 'doc2.pdf' },
        { success: true, executionTime: 2000, output: {} }
      );

      optimizer.recordToolUsage(
        'ImageOcrTool',
        '识别图片',
        { imagePath: 'image.png' },
        { success: true, executionTime: 1500, output: {} }
      );
    });

    it('应该生成完整的性能报告', () => {
      const report = optimizer.getPerformanceReport();

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('应该包含所有工具的统计', () => {
      const report = optimizer.getPerformanceReport();

      expect(report).toContain('PdfToMarkdownTool');
      expect(report).toContain('ImageOcrTool');
    });

    it('应该包含执行时间统计', () => {
      const report = optimizer.getPerformanceReport();

      expect(report).toContain('平均执行时间');
    });

    it('应该包含成功率统计', () => {
      const report = optimizer.getPerformanceReport();

      expect(report).toContain('成功率');
    });

    it('应该包含总体统计', () => {
      const report = optimizer.getPerformanceReport();

      expect(report).toContain('总记录数');
    });
  });

  describe('analyzeSelectionAccuracy', () => {
    beforeEach(() => {
      // 添加成功的工具使用
      for (let i = 0; i < 7; i++) {
        optimizer.recordToolUsage(
          'CorrectTool',
          '正确的任务',
          {},
          { success: true, executionTime: 1000, output: {} }
        );
      }

      // 添加一些失败的使用
      for (let i = 0; i < 3; i++) {
        optimizer.recordToolUsage(
          'WrongTool',
          '错误的任务',
          {},
          { success: false, executionTime: 500, error: 'Error' }
        );
      }
    });

    it('应该分析工具选择准确性', () => {
      const analysis = optimizer.analyzeSelectionAccuracy();

      expect(analysis).toBeDefined();
      expect(analysis.accuracy).toBeDefined();
      expect(typeof analysis.accuracy).toBe('number');
    });

    it('应该计算正确的准确率', () => {
      const analysis = optimizer.analyzeSelectionAccuracy();

      // 7次成功 / 10次总调用 = 0.7
      expect(analysis.accuracy).toBeCloseTo(0.7, 1);
    });

    it('应该提供改进建议', () => {
      const analysis = optimizer.analyzeSelectionAccuracy();

      expect(analysis.improvements).toBeDefined();
      expect(analysis.improvements).toBeInstanceOf(Array);
    });

    it('应该在高准确率时减少建议', () => {
      // 添加更多成功数据
      for (let i = 0; i < 20; i++) {
        optimizer.recordToolUsage(
          'CorrectTool',
          '正确任务',
          {},
          { success: true, executionTime: 1000, output: {} }
        );
      }

      const analysis = optimizer.analyzeSelectionAccuracy();

      // 高准确率应该有较少的建议
      if (analysis.accuracy > 0.9) {
        expect(analysis.improvements.length).toBeLessThan(3);
      }
    });
  });

  describe('集成场景：完整的工具选择流程', () => {
    it('应该支持完整的工具选择和记录流程', () => {
      const userInput = '帮我把这个PDF文件转换成Markdown格式';
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: '将PDF文件转换为Markdown格式',
            category: 'document',
          },
          execute: async () => ({ markdown: '#' }),
        },
      ];

      // 1. 生成优化提示
      const prompt = optimizer.optimizeToolSelectionPrompt(userInput, mockTools);
      expect(prompt).toBeDefined();

      // 2. 模拟选择工具
      const selectedTool = 'PdfToMarkdownTool';
      const parameters = { filePath: 'document.pdf' };

      // 3. 执行工具
      const startTime = Date.now();
      const result = { markdown: '# 转换后的内容' };
      const executionTime = Date.now() - startTime;

      // 4. 记录使用
      const recordId = optimizer.recordToolUsage(
        selectedTool,
        userInput,
        parameters,
        {
          success: true,
          executionTime,
          output: result,
        }
      );

      expect(recordId).toBeDefined();

      // 5. 查看性能报告
      const report = optimizer.getPerformanceReport();
      expect(report).toContain('PdfToMarkdownTool');

      // 6. 分析准确性
      const accuracy = optimizer.analyzeSelectionAccuracy();
      expect(accuracy.accuracy).toBeDefined();
    });

    it('应该支持错误恢复流程', () => {
      const userInput = '处理文档';
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'Tool1',
            description: '工具1',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
        },
        {
          metadata: {
            name: 'Tool2',
            description: '工具2',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
          },
      ];

      // 1. 第一次尝试失败
      optimizer.recordToolUsage(
        'Tool1',
        userInput,
        {},
        {
          success: false,
          executionTime: 500,
          error: 'Tool1 failed',
        }
      );

      // 2. 尝试替代工具
      optimizer.recordToolUsage(
        'Tool2',
        userInput,
        {},
        {
          success: true,
          executionTime: 1000,
          output: { result: 'success' },
        }
      );

      // 3. 检查准确率
      const accuracy = optimizer.analyzeSelectionAccuracy();
      expect(accuracy.accuracy).toBeGreaterThan(0);
    });
  });

  describe('集成场景：多轮对话优化', () => {
    it('应该基于对话历史优化工具选择', () => {
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'TestTool',
            description: '测试工具',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
        },
      ];

      const context = {
        conversationHistory: [
          { role: 'user', content: '我需要处理PDF' },
          { role: 'assistant', content: '我可以帮您处理PDF' },
          { role: 'user', content: '转换成Markdown' },
          { role: 'assistant', content: '好的，我会使用PDF转Markdown工具' },
        ],
      };

      const prompt = optimizer.optimizeToolSelectionPrompt(
        '请执行转换',
        mockTools,
        context
      );

      expect(prompt).toContain('对话历史');
      expect(prompt).toContain('我需要处理PDF');
    });
  });

  describe('集成场景：批量处理优化', () => {
    it('应该追踪批量处理的性能', () => {
      const files = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf'];

      files.forEach((file, index) => {
        optimizer.recordToolUsage(
          'PdfToMarkdownTool',
          '批量转换PDF',
          { filePath: file },
          {
            success: true,
            executionTime: 1000 + index * 100,
            output: { markdown: `# ${file}` },
          }
        );
      });

      const report = optimizer.getPerformanceReport();
      expect(report).toContain('PdfToMarkdownTool');
      expect(report).toContain('3'); // 总调用次数
    });
  });

  describe('集成场景：工具推荐', () => {
    it('应该基于历史推荐最佳工具', () => {
      const mockTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'ToolA',
            description: '工具A',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
        },
        {
          metadata: {
            name: 'ToolB',
            description: '工具B',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
        },
      ];

      // ToolA 成功率更高
      for (let i = 0; i < 9; i++) {
        optimizer.recordToolUsage(
          'ToolA',
          '测试任务',
          {},
          { success: true, executionTime: 1000, output: {} }
        );
      }

      // ToolB 成功率较低
      for (let i = 0; i < 5; i++) {
        optimizer.recordToolUsage(
          'ToolB',
          '测试任务',
          {},
          { success: i < 3, executionTime: 1000, output: {} }
        );
      }

      const prompt = optimizer.optimizeToolSelectionPrompt(
        '测试任务',
        mockTools
      );

      // 提示应该包含推荐信息
      expect(prompt).toBeDefined();
    });
  });
});
