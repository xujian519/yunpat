/**
 * FewShotPromptManager 测试
 *
 * TDD方式：
 * 1. 先写测试（红色 - 失败）
 * 2. 修复代码
 * 3. 运行测试（绿色 - 通过）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FewShotPromptManager } from '../../src/reasoning/FewShotPromptManager.js';
import type { EnhancedTool } from '../../src/tools/types.js';

describe('FewShotPromptManager', () => {
  let manager: FewShotPromptManager;

  beforeEach(() => {
    manager = new FewShotPromptManager();
  });

  describe('addExample', () => {
    it('应该能够添加示例', () => {
      const example = {
        id: 'test-001',
        scenario: '测试场景',
        userInput: '测试输入',
        reasoning: '测试推理',
        selectedTool: 'TestTool',
        toolParameters: {},
        outcome: '成功',
      };

      manager.addExample(example);

      const examples = manager.getRelevantExamples('测试输入', [], 10);
      expect(examples).toContainEqual(expect.objectContaining({ id: 'test-001' }));
    });

    it('应该支持添加多个示例', () => {
      const example1 = {
        id: 'test-001',
        scenario: '场景1',
        userInput: '输入1',
        reasoning: '推理1',
        selectedTool: 'Tool1',
        toolParameters: {},
        outcome: '成功',
      };

      const example2 = {
        id: 'test-002',
        scenario: '场景2',
        userInput: '输入2',
        reasoning: '推理2',
        selectedTool: 'Tool2',
        toolParameters: {},
        outcome: '成功',
      };

      manager.addExample(example1);
      manager.addExample(example2);

      const examples = manager.getRelevantExamples('输入', [], 10);
      expect(examples.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getRelevantExamples', () => {
    beforeEach(() => {
      // 添加一些测试示例
      manager.addExample({
        id: 'pdf-001',
        scenario: 'PDF转Markdown',
        userInput: '帮我把这个PDF文件转换成Markdown格式',
        reasoning: '选择专门的转换工具',
        selectedTool: 'PdfToMarkdownTool',
        toolParameters: { filePath: 'doc.pdf' },
        outcome: '成功',
        lessons: '优先使用专门工具',
      });

      manager.addExample({
        id: 'web-001',
        scenario: '网页抓取',
        userInput: '打开百度首页并截图',
        reasoning: '需要导航和截图工具',
        selectedTool: 'WebNavigateTool',
        toolParameters: { url: 'https://www.baidu.com' },
        outcome: '成功',
        lessons: '多步骤任务需要规划',
      });

      manager.addExample({
        id: 'ocr-001',
        scenario: '图片OCR',
        userInput: '识别这张图片中的文字内容',
        reasoning: '使用OCR工具',
        selectedTool: 'ImageOcrTool',
        toolParameters: { imagePath: 'image.png' },
        outcome: '成功',
        lessons: '注意工具适用范围',
      });
    });

    it('应该返回相关的示例', () => {
      const userInput = '帮我把PDF转成Markdown';
      const availableTools: EnhancedTool[] = [];

      const examples = manager.getRelevantExamples(userInput, availableTools, 3);

      expect(examples).toBeInstanceOf(Array);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.length).toBeLessThanOrEqual(3);
    });

    it('应该根据用户输入匹配相关示例', () => {
      const pdfInput = '转换PDF到Markdown';
      const ocrInput = '识别图片文字';

      const pdfExamples = manager.getRelevantExamples(pdfInput, [], 3);
      const ocrExamples = manager.getRelevantExamples(ocrInput, [], 3);

      // PDF相关的示例应该更靠前
      const pdfExampleIds = pdfExamples.map(e => e.id);
      const ocrExampleIds = ocrExamples.map(e => e.id);

      expect(pdfExampleIds).toContain('pdf-001');
      expect(ocrExampleIds).toContain('ocr-001');
    });

    it('应该限制返回的示例数量', () => {
      const userInput = '处理文档';
      const availableTools: EnhancedTool[] = [];

      const examples = manager.getRelevantExamples(userInput, availableTools, 2);

      expect(examples.length).toBeLessThanOrEqual(2);
    });

    it('应该根据可用工具过滤示例', () => {
      const userInput = '转换PDF';
      const availableTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: 'PDF转Markdown',
            category: 'document',
          },
          execute: async () => ({ markdown: '#' }),
        },
      ];

      const examples = manager.getRelevantExamples(userInput, availableTools, 3);

      expect(examples.length).toBeGreaterThan(0);
      // 应该包含PDF相关的示例
      const hasPdfExample = examples.some(e => e.id === 'pdf-001');
      expect(hasPdfExample).toBe(true);
    });
  });

  describe('generateFewShotPrompt', () => {
    beforeEach(() => {
      manager.addExample({
        id: 'test-001',
        scenario: '测试场景',
        userInput: '测试输入',
        reasoning: '测试推理过程',
        selectedTool: 'TestTool',
        toolParameters: { param1: 'value1' },
        outcome: '成功',
        lessons: '测试经验',
      });
    });

    it('应该生成Few-shot提示', () => {
      const userInput = '测试输入';
      const availableTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'TestTool',
            description: '测试工具',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
        },
      ];

      const prompt = manager.generateFewShotPrompt(userInput, availableTools);

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('工具选择指南');
      expect(prompt).toContain('可用工具');
      expect(prompt).toContain('工具选择示例');
      expect(prompt).toContain('当前任务');
    });

    it('应该包含用户输入', () => {
      const userInput = '帮我处理PDF文档';
      const availableTools: EnhancedTool[] = [];

      const prompt = manager.generateFewShotPrompt(userInput, availableTools);

      expect(prompt).toContain('帮我处理PDF文档');
    });

    it('应该包含对话历史（如果提供）', () => {
      const userInput = '转换PDF';
      const availableTools: EnhancedTool[] = [];
      const context = {
        conversationHistory: [
          { role: 'user', content: '我需要处理文档' },
          { role: 'assistant', content: '我可以帮您' },
        ],
      };

      const prompt = manager.generateFewShotPrompt(userInput, availableTools, context);

      expect(prompt).toContain('对话历史');
    });

    it('应该格式化工具列表', () => {
      const userInput = '测试';
      const availableTools: EnhancedTool[] = [
        {
          metadata: {
            name: 'TestTool',
            description: '测试工具',
            category: 'test',
          },
          execute: async () => ({ result: 'success' }),
        },
      ];

      const prompt = manager.generateFewShotPrompt(userInput, availableTools);

      expect(prompt).toContain('TestTool');
      expect(prompt).toContain('测试工具');
    });

    it('应该格式化示例', () => {
      const userInput = '测试输入';
      const availableTools: EnhancedTool[] = [];

      const prompt = manager.generateFewShotPrompt(userInput, availableTools);

      expect(prompt).toContain('示例：');
      expect(prompt).toContain('用户输入');
      expect(prompt).toContain('思考过程');
      expect(prompt).toContain('选择工具');
      expect(prompt).toContain('工具参数');
      expect(prompt).toContain('执行结果');
    });
  });

  describe('initializeDefaultExamples', () => {
    it('应该初始化默认示例', () => {
      const newManager = new FewShotPromptManager();

      // 初始化前应该没有示例
      const examplesBefore = newManager.getRelevantExamples('PDF', [], 10);
      expect(examplesBefore.length).toBe(0);

      // 初始化
      newManager.initializeDefaultExamples();

      // 初始化后应该有示例
      const examplesAfter = newManager.getRelevantExamples('PDF', [], 10);
      expect(examplesAfter.length).toBeGreaterThan(0);
    });

    it('应该包含所有预置示例', () => {
      const newManager = new FewShotPromptManager();
      newManager.initializeDefaultExamples();

      const allExamples = newManager.getRelevantExamples('', [], 100);

      // 检查是否包含预置的示例
      const scenarios = allExamples.map(e => e.scenario);
      expect(scenarios).toContain('PDF转Markdown');
      expect(scenarios).toContain('网页数据抓取');
      expect(scenarios).toContain('Excel数据分析');
      expect(scenarios).toContain('图片文字识别');
      expect(scenarios).toContain('语音转文字');
    });
  });

  describe('示例分类', () => {
    it('应该正确分类文档相关示例', () => {
      manager.addExample({
        id: 'doc-001',
        scenario: '文档处理',
        userInput: '处理PDF文档',
        reasoning: '文档相关',
        selectedTool: 'PdfTool',
        toolParameters: {},
        outcome: '成功',
      });

      const examples = manager.getRelevantExamples('处理DOCX文件', [], 10);
      const hasDocExample = examples.some(e => e.id === 'doc-001');
      expect(hasDocExample).toBe(true);
    });

    it('应该正确分类图片相关示例', () => {
      manager.addExample({
        id: 'img-001',
        scenario: '图片处理',
        userInput: '识别图片文字',
        reasoning: '图片相关',
        selectedTool: 'OcrTool',
        toolParameters: {},
        outcome: '成功',
      });

      const examples = manager.getRelevantExamples('处理PNG图片', [], 10);
      const hasImgExample = examples.some(e => e.id === 'img-001');
      expect(hasImgExample).toBe(true);
    });

    it('应该正确分类网页相关示例', () => {
      manager.addExample({
        id: 'web-001',
        scenario: '网页操作',
        userInput: '打开网页',
        reasoning: '网页相关',
        selectedTool: 'WebTool',
        toolParameters: {},
        outcome: '成功',
      });

      const examples = manager.getRelevantExamples('访问网站', [], 10);
      const hasWebExample = examples.some(e => e.id === 'web-001');
      expect(hasWebExample).toBe(true);
    });
  });

  describe('exportExamples & importExamples', () => {
    it('应该能够导出示例为JSON', () => {
      manager.addExample({
        id: 'test-001',
        scenario: '测试',
        userInput: '测试',
        reasoning: '测试',
        selectedTool: 'TestTool',
        toolParameters: {},
        outcome: '成功',
      });

      const json = manager.exportExamples();

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('应该能够从JSON导入示例', () => {
      const jsonData = JSON.stringify([
        {
          id: 'import-001',
          scenario: '导入测试',
          userInput: '导入',
          reasoning: '导入',
          selectedTool: 'ImportTool',
          toolParameters: {},
          outcome: '成功',
        },
      ]);

      manager.importExamples(jsonData);

      const examples = manager.getRelevantExamples('导入', [], 10);
      const hasImportedExample = examples.some(e => e.id === 'import-001');
      expect(hasImportedExample).toBe(true);
    });
  });
});
