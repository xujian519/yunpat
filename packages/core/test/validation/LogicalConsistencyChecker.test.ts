import { describe, it, expect, vi } from 'vitest';
import { LogicalConsistencyChecker } from '../../src/validation/LogicalConsistencyChecker.js';

describe('LogicalConsistencyChecker', () => {
  function createMockLLM() {
    return {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            inconsistencies: [],
          }),
        },
      }),
    } as any;
  }

  describe('constructor', () => {
    it('应使用默认配置', () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      expect(checker).toBeDefined();
    });

    it('应使用自定义配置', () => {
      const checker = new LogicalConsistencyChecker(createMockLLM(), {
        detectContradictions: false,
        detectDuplication: false,
        detectLogicalGaps: false,
        similarityThreshold: 0.8,
      });
      expect(checker).toBeDefined();
    });
  });

  describe('checkConsistency', () => {
    it('应检查一致性', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = await checker.checkConsistency('测试内容');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('应禁用矛盾检测', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM(), {
        detectContradictions: false,
      });
      const result = await checker.checkConsistency('测试内容');
      expect(result).toBeDefined();
    });

    it('应禁用重复检测', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM(), {
        detectDuplication: false,
      });
      const result = await checker.checkConsistency('测试内容');
      expect(result).toBeDefined();
    });

    it('应禁用逻辑断层检测', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM(), {
        detectLogicalGaps: false,
      });
      const result = await checker.checkConsistency('测试内容');
      expect(result).toBeDefined();
    });
  });

  describe('detectContradictionsByRules', () => {
    it('应检测显式矛盾', () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = (checker as any).detectContradictionsByRules('这是一个测试。这不是一个测试。');
      expect(result).toBeDefined();
    });

    it('应处理无矛盾内容', () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = (checker as any).detectContradictionsByRules('这是一个测试。这是另一个测试。');
      expect(result).toBeDefined();
    });
  });

  describe('detectDuplication', () => {
    it('应检测重复内容', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = await (checker as any).detectDuplication('重复内容 重复内容');
      expect(result).toBeDefined();
    });

    it('应处理无重复内容', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = await (checker as any).detectDuplication('唯一内容');
      expect(result).toBeDefined();
    });
  });

  describe('detectLogicalGaps', () => {
    it('应检测逻辑断层', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = await (checker as any).detectLogicalGaps('前提。结论。');
      expect(result).toBeDefined();
    });

    it('应处理无断层内容', async () => {
      const checker = new LogicalConsistencyChecker(createMockLLM());
      const result = await (checker as any).detectLogicalGaps('完整内容');
      expect(result).toBeDefined();
    });
  });
});
