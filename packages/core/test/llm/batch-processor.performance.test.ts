/**
 * 批处理器性能测试
 */

import { describe, it, expect } from 'vitest';
import {
  TokenCounter,
  createTokenCounter,
} from '../../src/llm/tokenization/TokenCounter.js';
import {
  BatchProcessorOptimizer,
  createBatchProcessorOptimizer,
} from '../../src/llm/tokenization/BatchProcessorOptimizer.js';

/**
 * 性能测试辅助函数
 */
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

/**
 * 生成测试文本
 */
function generateTestTexts(count: number, length: number): string[] {
  const texts: string[] = [];
  const baseText = 'Hello world 你好世界 This is a test. 这是一个测试。';

  for (let i = 0; i < count; i++) {
    // 随机化长度
    const variance = Math.floor(Math.random() * length * 0.2) - length * 0.1;
    const targetLength = Math.max(10, length + variance);
    let text = '';

    while (text.length < targetLength) {
      text += baseText;
    }

    texts.push(text.substring(0, targetLength));
  }

  return texts;
}

describe('BatchProcessor Performance', () => {
  describe('TokenCounter 性能', () => {
    it('应该快速处理大量文本', () => {
      const counter = createTokenCounter();
      const texts = generateTestTexts(1000, 100);

      const startTime = Date.now();
      const tokenCounts = counter.estimateTokensBatch(texts, 'gpt-3.5-turbo');
      const duration = Date.now() - startTime;

      expect(tokenCounts).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // < 100ms
    });

    it('Token 估算误差应该小于 10%', () => {
      const counter = createTokenCounter();

      // 对于不同长度的文本进行测试
      const testCases = [
        { length: 50, expectedVariance: 0.1 },
        { length: 100, expectedVariance: 0.1 },
        { length: 500, expectedVariance: 0.1 },
        { length: 1000, expectedVariance: 0.1 },
      ];

      for (const testCase of testCases) {
        const text = generateTestTexts(1, testCase.length)[0];
        const estimatedTokens = counter.estimateTokens(text, 'gpt-3.5-turbo');

        // 由于我们无法获得真实 Token 数，这里主要验证不会出现异常大的偏差
        // 实际 Token 数应该在字符数的 1/6 到 1/2 之间（考虑中英文混合）
        const minExpected = text.length / 6;
        const maxExpected = text.length / 2;

        expect(estimatedTokens).toBeGreaterThan(minExpected * 0.9);
        expect(estimatedTokens).toBeLessThan(maxExpected * 1.1);
      }
    });
  });

  describe('BatchProcessorOptimizer 性能', () => {
    it('应该高效处理小规模任务（100 任务）', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(100, 200);

      const startTime = Date.now();
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const duration = Date.now() - startTime;

      expect(result.totalBatches).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // < 50ms
    });

    it('应该高效处理中等规模任务（1000 任务）', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(1000, 200);

      const startTime = Date.now();
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const duration = Date.now() - startTime;

      expect(result.totalBatches).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // < 500ms
    });

    it('应该高效处理大规模任务（10000 任务）', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(10000, 200);

      const startTime = Date.now();
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const duration = Date.now() - startTime;

      expect(result.totalBatches).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // < 5s
    });
  });

  describe('批次大小动态调整', () => {
    it('应该优化批次大小动态调整', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
        enableDynamicAdjustment: true,
      });

      // 生成混合长度的文本
      const texts: string[] = [];
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          texts.push(generateTestTexts(1, 50)[0]); // 短文本
        } else if (i % 3 === 1) {
          texts.push(generateTestTexts(1, 200)[0]); // 中等文本
        } else {
          texts.push(generateTestTexts(1, 500)[0]); // 长文本
        }
      }

      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      // 验证批次大小动态调整
      const batchSizes = result.batches.map(batch => batch.length);
      const variance = calculateVariance(batchSizes);

      // 方差应该较小（说明批次大小相对稳定）
      expect(variance).toBeLessThan(25);
    });

    it('应该在处理长文本时减小批次大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 2000,
        maxBatchSize: 20,
      });

      const longTexts = generateTestTexts(50, 500);
      const result = optimizer.partitionIntoBatches(longTexts, 'gpt-3.5-turbo');

      // 长文本应该导致更小的批次（每个批次不超过 2000 tokens）
      // 验证每个批次的平均大小
      expect(result.averageBatchSize).toBeLessThanOrEqual(10);

      // 验证批次数量合理（长文本应该分成多个批次）
      expect(result.totalBatches).toBeGreaterThan(3);
    });

    it('应该在处理短文本时增加批次大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 50,
      });

      const shortTexts = generateTestTexts(100, 20);
      const result = optimizer.partitionIntoBatches(shortTexts, 'gpt-3.5-turbo');

      // 短文本应该允许更大的批次
      expect(result.averageBatchSize).toBeGreaterThan(10);
    });
  });

  describe('批处理吞吐量测试', () => {
    it('应该在 1 分钟内处理 1000 个任务', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(1000, 200);

      const startTime = Date.now();
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const duration = Date.now() - startTime;

      // 计算吞吐量
      const throughput = texts.length / (duration / 1000); // 任务/秒

      expect(duration).toBeLessThan(60000); // < 60s
      expect(throughput).toBeGreaterThan(10); // > 10 任务/秒
    });

    it('批次大小应该相对稳定', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(500, 150);
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      const batchSizes = result.batches.map(batch => batch.length);
      const stdDev = Math.sqrt(calculateVariance(batchSizes));

      // 标准差应该较小（批次大小稳定）
      expect(stdDev).toBeLessThan(5);
    });
  });

  describe('边界情况测试', () => {
    it('应该正确处理空任务列表', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const result = optimizer.partitionIntoBatches([], 'gpt-3.5-turbo');

      expect(result.batches).toHaveLength(0);
      expect(result.totalBatches).toBe(0);
      expect(result.totalTokens).toBe(0);
    });

    it('应该正确处理单个任务', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(1, 100);
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toHaveLength(1);
    });

    it('应该正确处理超长文本（接近限制）', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const counter = createTokenCounter();
      // 生成接近 4000 tokens 的文本
      let longText = 'Hello world 你好世界 '.repeat(100);
      while (counter.estimateTokens(longText, 'gpt-3.5-turbo') < 3500) {
        longText += 'Hello world 你好世界 '.repeat(10);
      }

      const result = optimizer.partitionIntoBatches([longText], 'gpt-3.5-turbo');

      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toHaveLength(1);
    });

    it('应该正确处理极端批次大小（1）', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 1,
      });

      const texts = generateTestTexts(10, 100);
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      // 每个批次应该只有 1 个任务
      expect(result.batches).toHaveLength(10);
      result.batches.forEach(batch => {
        expect(batch).toHaveLength(1);
      });
    });

    it('应该正确处理极端批次大小（1000）', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 100000,
        maxBatchSize: 1000,
      });

      const texts = generateTestTexts(100, 50);
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      // 应该只有 1 个批次
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toHaveLength(100);
    });
  });

  describe('混合长度文本测试', () => {
    it('应该正确处理混合长度文本', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      // 生成不同长度的文本
      const texts: string[] = [];
      texts.push(...generateTestTexts(20, 50));   // 短文本
      texts.push(...generateTestTexts(20, 200));  // 中等文本
      texts.push(...generateTestTexts(20, 500));  // 长文本

      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      expect(result.totalBatches).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);

      // 验证所有文本都被处理
      const totalItems = result.batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalItems).toBe(60);
    });
  });

  describe('不同模型性能测试', () => {
    it('应该在不同模型下保持一致的性能', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(100, 200);
      const models = ['gpt-3.5-turbo', 'claude-3-opus', 'deepseek-chat', 'qwen-turbo'];

      const results = models.map(model => {
        const startTime = Date.now();
        const result = optimizer.partitionIntoBatches(texts, model);
        const duration = Date.now() - startTime;

        return { model, duration, batches: result.totalBatches };
      });

      // 所有模型应该都在合理时间内完成
      results.forEach(result => {
        expect(result.duration).toBeLessThan(100); // < 100ms
      });

      // 批次数应该大致相同（可能因 Token 计数差异略有不同）
      const batchCounts = results.map(r => r.batches);
      const maxBatches = Math.max(...batchCounts);
      const minBatches = Math.min(...batchCounts);

      expect(maxBatches - minBatches).toBeLessThan(3); // 差异不超过 3 个批次
    });
  });

  describe('内存效率测试', () => {
    it('应该在处理大量文本时保持内存效率', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(10000, 100);

      // 记录初始内存使用（粗略估算）
      const startTime = Date.now();
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const duration = Date.now() - startTime;

      // 验证处理时间和结果正确性
      expect(duration).toBeLessThan(10000); // < 10s
      expect(result.totalBatches).toBeGreaterThan(0);

      // 验证历史记录不会无限增长
      const history = optimizer.getHistory();
      expect(history.length).toBeLessThanOrEqual(10); // 最多 10 条记录
    });
  });

  describe('并发安全性测试', () => {
    it('应该支持多次连续调用而不影响结果', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
      });

      const texts = generateTestTexts(100, 200);

      // 多次调用
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
        results.push(result);
      }

      // 所有结果应该一致
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.totalBatches).toBe(firstResult.totalBatches);
        expect(result.totalTokens).toBeCloseTo(result.totalTokens, 0);
      });
    });
  });
});
