/**
 * 优化后的推理引擎集成测试
 *
 * 测试 Tree-of-Thoughts 和 Plan-and-Solve 的优化功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TreeOfThoughtsStrategy,
  PlanAndSolveStrategy,
  type ThoughtNode,
} from '../../src/reasoning/ReActLoop.js';

// ========== Mock LLM Adapter ==========

const createMockLLM = () => ({
  chat: vi.fn(),
});

// ========== Tree-of-Thoughts 测试 ==========

describe('TreeOfThoughtsStrategy (优化版)', () => {
  let mockLLM: ReturnType<typeof createMockLLM>;
  let tot: TreeOfThoughtsStrategy;

  beforeEach(() => {
    mockLLM = createMockLLM();
    tot = new TreeOfThoughtsStrategy(mockLLM as any);
  });

  describe('多维度评估', () => {
    it('应该正确解析多维度评估结果', async () => {
      // 模拟 LLM 返回的评估结果
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content:
            '1. 可行性: 8分, 创新性: 7分, 完整性: 9分, 清晰度: 8分, 总分: 32分\n2. 可行性: 6分, 创新性: 9分, 完整性: 7分, 清晰度: 8分, 总分: 30分',
        },
        usage: { totalTokens: 100 },
      });

      const thoughts = [
        { thought: '思路1：使用深度学习方法', score: 5.0 },
        { thought: '思路2：使用规则引擎方法', score: 5.0 },
      ];

      const results = await tot.evaluateThoughts('如何优化专利审查流程', thoughts);

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(32);
      expect(results[0].evaluation).toEqual({
        feasibility: 8,
        innovation: 7,
        completeness: 9,
        clarity: 8,
      });
      expect(results[1].score).toBe(30);
    });

    it('应该处理不完整的评估结果', async () => {
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '1. 可行性: 7分, 创新性: 8分',
        },
        usage: { totalTokens: 50 },
      });

      const thoughts = [{ thought: '思路1', score: 5.0 }];
      const results = await tot.evaluateThoughts('问题', thoughts);

      // 应该有默认值
      expect(results[0].evaluation).toBeDefined();
      expect(results[0].evaluation?.feasibility).toBe(7);
    });
  });

  describe('最佳优先搜索', () => {
    it('应该执行最佳优先搜索找到最佳节点', async () => {
      // 生成思路的响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `1. 使用深度学习模型
2. 使用规则引擎
3. 使用混合方法`,
        },
        usage: { totalTokens: 100 },
      });

      // 评估的响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content:
            '1. 可行性: 8分, 创新性: 9分, 完整性: 7分, 清晰度: 8分, 总分: 32分\n2. 可行性: 6分, 创新性: 5分, 完整性: 7分, 清晰度: 6分, 总分: 24分\n3. 可行性: 7分, 创新性: 8分, 完整性: 8分, 清晰度: 7分, 总分: 30分',
        },
        usage: { totalTokens: 150 },
      });

      const bestNode = await tot.bestFirstSearch('如何优化专利审查', 2, 3);

      expect(bestNode).toBeDefined();
      expect(bestNode.score).toBeGreaterThan(0);
      expect(bestNode.depth).toBeGreaterThan(0);
      expect(bestNode.evaluation).toBeDefined();
    });

    it('应该追踪最佳路径', async () => {
      // 简化的响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '1. 思路A\n2. 思路B',
        },
        usage: { totalTokens: 50 },
      });

      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content:
            '1. 可行性: 8分, 创新性: 7分, 完整性: 9分, 清晰度: 8分, 总分: 32分\n2. 可行性: 6分, 创新性: 5分, 完整性: 7分, 清晰度: 6分, 总分: 24分',
        },
        usage: { totalTokens: 100 },
      });

      const bestNode = await tot.bestFirstSearch('测试问题', 1, 2);
      const path = tot.getBestPath(bestNode);

      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toBe('测试问题');
    });
  });

  describe('思路解析', () => {
    it('应该解析多种格式的思路', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `1. 使用深度学习方法
2. 使用规则引擎方法
3. 使用混合方法`,
        },
        usage: { totalTokens: 100 },
      });

      const thoughts = await tot.generateThoughts('优化专利审查', 3);

      expect(thoughts).toHaveLength(3);
      expect(thoughts[0].thought).toContain('深度学习');
      expect(thoughts[1].thought).toContain('规则引擎');
    });
  });
});

// ========== Plan-and-Solve 测试 ==========

describe('PlanAndSolveStrategy (优化版)', () => {
  let mockLLM: ReturnType<typeof createMockLLM>;
  let pas: PlanAndSolveStrategy;

  beforeEach(() => {
    mockLLM = createMockLLM();
    pas = new PlanAndSolveStrategy(mockLLM as any);
  });

  describe('计划生成', () => {
    it('应该生成包含多个步骤的计划', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `1. 分析专利申请的技术领域
2. 检查专利申请的形式要求
3. 评估专利申请的新颖性
4. 评估专利申请的创造性
5. 给出审查结论`,
        },
        usage: { totalTokens: 150 },
      });

      const plan = await pas.makePlan('审查一项专利申请');

      expect(plan).toHaveLength(5);
      expect(plan[0]).toContain('分析');
      expect(plan[4]).toContain('结论');
    });

    it('应该使用提供的上下文信息', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '1. 步骤1\n2. 步骤2',
        },
        usage: { totalTokens: 50 },
      });

      const context = { domain: '专利审查', rules: ['专利法第26条'] };
      await pas.makePlan('审查专利', context);

      const prompt = mockLLM.chat.mock.calls[0][0];
      expect(prompt.messages[1].content).toContain('domain');
      expect(prompt.messages[1].content).toContain('专利审查');
    });
  });

  describe('计划执行（增强版）', () => {
    it('应该执行每个步骤并生成结果', async () => {
      // 生成计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '1. 分析问题\n2. 解决问题\n3. 验证结果',
        },
        usage: { totalTokens: 100 },
      });

      // 验证计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '计划质量评分：8/10。步骤清晰、逻辑合理。',
        },
        usage: { totalTokens: 50 },
      });

      // 执行步骤1
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '问题分析完成：核心问题是...',
        },
        usage: { totalTokens: 80 },
      });

      // 执行步骤2
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '解决方案已实施...',
        },
        usage: { totalTokens: 100 },
      });

      // 执行步骤3
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '验证通过，问题已解决。',
        },
        usage: { totalTokens: 70 },
      });

      const results = [];
      for await (const result of pas.planAndSolve('解决复杂问题')) {
        results.push(result);
      }

      // 应该包含：计划验证 + 3个执行步骤
      expect(results.length).toBeGreaterThanOrEqual(4);

      // 检查计划验证结果
      expect(results[0].plan).toBeDefined();
      expect(results[0].validation).toBeDefined();

      // 检查执行步骤
      const step1 = results.find((r) => r.step === 1);
      expect(step1?.result).toContain('问题分析完成');

      const step2 = results.find((r) => r.step === 2);
      expect(step2?.result).toContain('解决方案');

      const step3 = results.find((r) => r.step === 3);
      expect(step3?.done).toBe(true);
    });

    it('应该在步骤失败时停止执行', async () => {
      // 生成计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '1. 步骤1\n2. 步骤2\n3. 步骤3',
        },
        usage: { totalTokens: 100 },
      });

      // 验证计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '计划质量评分：7/10',
        },
        usage: { totalTokens: 50 },
      });

      // 步骤1成功
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '步骤1执行成功',
        },
        usage: { totalTokens: 50 },
      });

      // 步骤2失败
      mockLLM.chat.mockRejectedValueOnce(new Error('执行失败'));

      const results = [];
      for await (const result of pas.planAndSolve('测试任务')) {
        results.push(result);
      }

      // 应该在步骤2失败后停止
      const failedStep = results.find((r) => r.step === 2);
      expect(failedStep?.success).toBe(false);
      expect(failedStep?.error).toContain('执行失败');

      // 不应该有步骤3
      const step3 = results.find((r) => r.step === 3);
      expect(step3).toBeUndefined();
    });

    it('应该传递前序步骤的结果给后续步骤', async () => {
      // 生成计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '1. 步骤1\n2. 步骤2',
        },
        usage: { totalTokens: 50 },
      });

      // 验证计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '计划质量评分：8/10',
        },
        usage: { totalTokens: 50 },
      });

      // 执行步骤1
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '步骤1结果：数据已收集',
        },
        usage: { totalTokens: 50 },
      });

      // 执行步骤2（应该包含步骤1的结果）
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '步骤2执行成功',
        },
        usage: { totalTokens: 50 },
      });

      const results = [];
      for await (const result of pas.planAndSolve('测试任务')) {
        results.push(result);
      }

      // 检查所有调用
      const calls = mockLLM.chat.mock.calls;
      const step2Call = calls.find(
        (call) =>
          call[0].messages[1].content.includes('步骤2') &&
          call[0].messages[1].content.includes('当前步骤')
      );

      expect(step2Call).toBeDefined();
      expect(step2Call![0].messages[1].content).toContain('step1Result');
    });
  });

  describe('计划验证', () => {
    it('应该验证计划质量', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content:
            '计划质量评估：\n完整性：9/10\n可行性：8/10\n逻辑性：9/10\n清晰性：8/10\n总体评分：8.5/10\n\n建议：可以考虑增加风险评估步骤。',
        },
        usage: { totalTokens: 100 },
      });

      const plan = ['步骤1', '步骤2', '步骤3'];
      const validation = await pas.validatePlan('测试目标', plan);

      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(0.6);
      expect(validation.feedback).toContain('风险评估');
    });

    it('应该拒绝低质量计划', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '计划质量评估：\n总体评分：4/10\n\n问题：步骤不够详细，缺少具体实施方案。',
        },
        usage: { totalTokens: 80 },
      });

      const plan = ['做任务', '完成'];
      const validation = await pas.validatePlan('模糊目标', plan);

      expect(validation.isValid).toBe(false);
      expect(validation.score).toBeLessThan(0.6);
    });
  });

  describe('完整工作流', () => {
    it('应该完整执行 plan-and-solve 流程', async () => {
      // 生成计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '1. 收集数据\n2. 分析数据\n3. 生成报告',
        },
        usage: { totalTokens: 100 },
      });

      // 验证计划
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '评分：9/10',
        },
        usage: { totalTokens: 50 },
      });

      // 执行步骤
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '步骤执行完成',
        },
        usage: { totalTokens: 50 },
      });

      const results = [];
      for await (const result of pas.planAndSolve('数据分析任务')) {
        results.push(result);
      }

      // 验证流程
      expect(results.length).toBeGreaterThanOrEqual(4); // 1验证 + 3步骤

      // 第一个结果应该是计划验证
      expect(results[0].step).toBe(0);
      expect(results[0].plan).toBeDefined();
      expect(results[0].validation).toBeDefined();

      // 最后一个结果应该标记为完成
      const lastResult = results[results.length - 1];
      expect(lastResult.done).toBe(true);
    });
  });
});

// ========== 集成测试 ==========

describe('推理引擎集成测试', () => {
  let mockLLM: ReturnType<typeof createMockLLM>;

  beforeEach(() => {
    mockLLM = createMockLLM();
  });

  describe('Tree-of-Thoughts vs Plan-and-Solve', () => {
    it('应该为同一个问题生成不同类型的解决方案', async () => {
      // ToT 响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '1. 深度学习方法\n2. 规则引擎方法\n3. 混合方法',
        },
        usage: { totalTokens: 100 },
      });

      // ToT 评估响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '1. 可行性: 8分, 创新性: 9分, 完整性: 7分, 清晰度: 8分, 总分: 32分',
        },
        usage: { totalTokens: 100 },
      });

      // PaS 响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '1. 分析问题\n2. 设计方案\n3. 实施方案\n4. 验证结果',
        },
        usage: { totalTokens: 100 },
      });

      // ToT: 生成多个思路并评估
      const tot = new TreeOfThoughtsStrategy(mockLLM as any);
      const thoughts = await tot.generateThoughts('优化专利审查');
      const evaluated = await tot.evaluateThoughts('优化专利审查', thoughts);

      // PaS: 生成单一计划
      const pas = new PlanAndSolveStrategy(mockLLM as any);
      const plan = await pas.makePlan('优化专利审查');

      // 验证差异
      expect(evaluated.length).toBeGreaterThan(1); // ToT 生成多个思路
      expect(plan.length).toBeGreaterThan(1); // PaS 生成单一计划的多个步骤
      expect(evaluated[0].evaluation).toBeDefined(); // ToT 有详细评估
    });
  });
});
