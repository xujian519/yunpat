/**
 * Chain-of-Thought 推理策略测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ChainOfThoughtStrategy,
  createChainOfThought,
  StepFormat,
  type ReasoningStep,
} from '../../src/reasoning/ChainOfThoughtStrategy.js';

// Mock LLM Adapter
const createMockLLM = () => ({
  chat: vi.fn(),
});

describe('ChainOfThoughtStrategy', () => {
  let mockLLM: ReturnType<typeof createMockLLM>;
  let cot: ChainOfThoughtStrategy;

  beforeEach(() => {
    mockLLM = createMockLLM();
    cot = new ChainOfThoughtStrategy(mockLLM as any);
  });

  describe('基础推理功能', () => {
    it('应该成功执行完整的 CoT 推理', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content:
            '步骤1：理解问题\n这是第一步推理。\n\n步骤2：分析问题\n这是第二步推理。\n\n结论：最终答案',
        },
        usage: { totalTokens: 100 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result).toBeDefined();
      expect(result.steps).toBeInstanceOf(Array);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.conclusion).toContain('最终答案');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('应该使用提供的上下文信息', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const context = {
        domain: '专利审查',
        rules: ['规则1', '规则2'],
      };

      await cot.reason('测试问题', context);

      const prompt = mockLLM.chat.mock.calls[0][0];
      expect(prompt.messages[1].content).toContain('上下文信息');
      expect(prompt.messages[1].content).toContain('domain');
    });

    it('应该使用指定的步骤格式', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      await cot.reason('测试问题', {}, StepFormat.NUMBERED);

      const prompt = mockLLM.chat.mock.calls[0][0];
      expect(prompt.messages[1].content).toContain('步骤格式');
    });
  });

  describe('步骤解析', () => {
    it('应该正确解析"步骤1"、"步骤2"格式', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：理解问题\n这是第一步。\n\n步骤2：收集信息\n这是第二步。\n\n结论：答案',
        },
        usage: { totalTokens: 100 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result.steps.length).toBe(2);
      expect(result.steps[0].step).toBe(1);
      expect(result.steps[0].description).toContain('理解问题');
      expect(result.steps[1].step).toBe(2);
    });

    it('应该正确解析"1."、"2."编号格式', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content:
            '1. 第一步推理\n这是第一步内容。\n\n2. 第二步推理\n这是第二步内容。\n\n结论：最终答案',
        },
        usage: { totalTokens: 100 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result.steps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('结论提取', () => {
    it('应该提取"结论："标记后的内容', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理过程\n\n结论：这是最终答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result.conclusion).toContain('这是最终答案');
    });

    it('应该提取"答案："标记后的内容', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n\n答案：这是答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result.conclusion).toContain('这是答案');
    });
  });

  describe('置信度计算', () => {
    it('应该为合理的推理过程计算较高置信度', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理1\n步骤2：推理2\n步骤3：推理3\n结论：答案',
        },
        usage: { totalTokens: 100 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      // 3个步骤、有明确结论 → 应该有较高置信度
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('流式推理', () => {
    it('应该逐步返回推理步骤和结论', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理1\n步骤2：推理2\n结论：答案',
        },
        usage: { totalTokens: 100 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const results: any[] = [];
      for await (const item of cot.reasonStream('测试问题')) {
        results.push(item);
      }

      // 应该包含所有步骤 + 结论
      expect(results.length).toBeGreaterThanOrEqual(3);

      // 最后一个应该是结论
      const lastItem = results[results.length - 1];
      expect(lastItem).toHaveProperty('conclusion');
    });
  });

  describe('批量推理', () => {
    it('应该处理多个问题', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const problems = ['问题1', '问题2', '问题3'];
      const results = await cot.reasonBatch(problems);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.steps).toBeDefined();
        expect(result.conclusion).toBeDefined();
      });
    });
  });

  describe('错误处理和重试', () => {
    it('应该在推理失败时重试', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockRejectedValueOnce(new Error('网络错误')).mockResolvedValueOnce(mockResponse);

      const result = await cot.reason('测试问题');

      expect(mockLLM.chat).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      mockLLM.chat.mockRejectedValue(new Error('持久错误'));

      await expect(cot.reason('测试问题')).rejects.toThrow('持久错误');
    });
  });

  describe('配置选项', () => {
    it('应该支持自定义最大步骤数', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理1\n步骤2：推理2\n步骤3：推理3\n步骤4：推理4\n结论：答案',
        },
        usage: { totalTokens: 200 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const customCot = new ChainOfThoughtStrategy(mockLLM as any, {
        maxSteps: 2,
      });

      const result = await customCot.reason('测试问题');

      // 应该只返回2个步骤
      expect(result.steps.length).toBeLessThanOrEqual(2);
    });

    it('应该支持自定义温度参数', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const customCot = new ChainOfThoughtStrategy(mockLLM as any, {
        temperature: 0.7,
      });

      await customCot.reason('测试问题');

      const call = mockLLM.chat.mock.calls[0];
      expect(call[0].temperature).toBe(0.7);
    });
  });

  describe('便捷函数', () => {
    it('createChainOfThought 应该创建 CoT 实例', () => {
      const cot2 = createChainOfThought(mockLLM as any);

      expect(cot2).toBeInstanceOf(ChainOfThoughtStrategy);
    });

    it('createChainOfThought 应该支持配置', () => {
      const cot2 = createChainOfThought(mockLLM as any, {
        maxSteps: 5,
        temperature: 0.5,
      });

      expect(cot2).toBeInstanceOf(ChainOfThoughtStrategy);
    });
  });

  describe('性能和资源使用', () => {
    it('应该记录推理耗时', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 50 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该记录 token 消耗', async () => {
      const mockResponse = {
        message: {
          role: 'assistant' as const,
          content: '步骤1：推理\n结论：答案',
        },
        usage: { totalTokens: 100 },
      };

      mockLLM.chat.mockResolvedValue(mockResponse);

      const result = await cot.reason('测试问题');

      expect(result.tokensUsed).toBe(100);
    });
  });
});
