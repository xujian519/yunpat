/**
 * Token 计数器和批处理器优化器单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  TokenCounter,
  ModelType,
  createTokenCounter,
  tokenCounter,
} from '../../src/llm/tokenization/TokenCounter.js';
import {
  BatchProcessorOptimizer,
  createBatchProcessorOptimizer,
  batchProcessorOptimizer,
} from '../../src/llm/tokenization/BatchProcessorOptimizer.js';

describe('TokenCounter', () => {
  describe('基础功能', () => {
    it('应该正确创建 Token 计数器实例', () => {
      const counter = createTokenCounter();
      expect(counter).toBeInstanceOf(TokenCounter);
    });

    it('空文本应该返回 0 Token', () => {
      const counter = createTokenCounter();
      expect(counter.estimateTokens('', 'gpt-3.5-turbo')).toBe(0);
      expect(counter.estimateTokens('', 'claude-3')).toBe(0);
    });

    it('应该正确处理纯英文文本', () => {
      const counter = createTokenCounter();
      const englishText = 'This is a test sentence with some English words.';
      const tokens = counter.estimateTokens(englishText, 'gpt-3.5-turbo');

      // 英文约 4 字符/token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(englishText.length);
    });

    it('应该正确处理纯中文文本', () => {
      const counter = createTokenCounter();
      const chineseText = '这是一个测试句子，包含一些中文字符。';
      const tokens = counter.estimateTokens(chineseText, 'gpt-3.5-turbo');

      // 中文约 2.5 字符/token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(chineseText.length);
    });

    it('应该正确处理混合文本', () => {
      const counter = createTokenCounter();
      const mixedText = 'This is English。这是中文。Mixed content 混合内容。';
      const tokens = counter.estimateTokens(mixedText, 'gpt-3.5-turbo');

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(mixedText.length);
    });
  });

  describe('不同模型的 Token 计数', () => {
    it('GPT 模型 Token 计数', () => {
      const counter = createTokenCounter();
      const text = 'Hello world 你好世界';

      const gptTokens = counter.estimateTokens(text, 'gpt-3.5-turbo');
      const gpt4Tokens = counter.estimateTokens(text, 'gpt-4');

      expect(gptTokens).toBe(gpt4Tokens); // 相同编码
    });

    it('Claude 模型 Token 计数', () => {
      const counter = createTokenCounter();
      const text = 'Hello world 你好世界';

      const claudeTokens = counter.estimateTokens(text, 'claude-3-opus');
      expect(claudeTokens).toBeGreaterThan(0);
    });

    it('DeepSeek 模型 Token 计数', () => {
      const counter = createTokenCounter();
      const text = 'Hello world 你好世界';

      const deepseekTokens = counter.estimateTokens(text, 'deepseek-chat');
      expect(deepseekTokens).toBeGreaterThan(0);
    });

    it('通义千问模型 Token 计数', () => {
      const counter = createTokenCounter();
      const text = 'Hello world 你好世界';

      const qwenTokens = counter.estimateTokens(text, 'qwen-turbo');
      expect(qwenTokens).toBeGreaterThan(0);
    });

    it('未知模型应该使用默认计数方法', () => {
      const counter = createTokenCounter();
      const text = 'Hello world 你好世界';

      const unknownTokens = counter.estimateTokens(text, 'unknown-model');
      expect(unknownTokens).toBeGreaterThan(0);
    });
  });

  describe('批量 Token 计数', () => {
    it('应该正确批量估算 Token', () => {
      const counter = createTokenCounter();
      const texts = [
        'First text 第一段文本',
        'Second text 第二段文本',
        'Third text 第三段文本',
      ];

      const tokenCounts = counter.estimateTokensBatch(texts, 'gpt-3.5-turbo');

      expect(tokenCounts).toHaveLength(3);
      expect(tokenCounts.every(count => count > 0)).toBe(true);
    });

    it('应该正确计算总 Token 数', () => {
      const counter = createTokenCounter();
      const texts = [
        'First text 第一段文本',
        'Second text 第二段文本',
        'Third text 第三段文本',
      ];

      const totalTokens = counter.calculateTotalTokens(texts, 'gpt-3.5-turbo');
      const tokenCounts = counter.estimateTokensBatch(texts, 'gpt-3.5-turbo');
      const expectedTotal = tokenCounts.reduce((sum, count) => sum + count, 0);

      expect(totalTokens).toBe(expectedTotal);
    });
  });

  describe('Token 使用率和限制检查', () => {
    it('应该正确计算 Token 使用率', () => {
      const counter = createTokenCounter();
      const text = 'Hello world 你好世界';

      const usageRate = counter.calculateTokenUsageRate(text, 'gpt-3.5-turbo', 100);
      expect(usageRate).toBeGreaterThan(0);
      expect(usageRate).toBeLessThanOrEqual(1);
    });

    it('应该正确检测是否超过 Token 限制', () => {
      const counter = createTokenCounter();
      const shortText = 'Hello';
      const longText = 'Hello '.repeat(1000);

      expect(counter.exceedsTokenLimit(shortText, 'gpt-3.5-turbo', 100)).toBe(false);
      expect(counter.exceedsTokenLimit(longText, 'gpt-3.5-turbo', 100)).toBe(true);
    });

    it('应该正确截断文本以适应 Token 限制', () => {
      const counter = createTokenCounter();
      const longText = 'Hello world 你好世界 '.repeat(100);

      const truncated = counter.truncateToTokenLimit(longText, 'gpt-3.5-turbo', 50);

      expect(truncated.length).toBeLessThan(longText.length);
      expect(counter.estimateTokens(truncated, 'gpt-3.5-turbo')).toBeLessThanOrEqual(50);
    });
  });

  describe('中文优化模型', () => {
    it('DeepSeek 和 Qwen 应该对中文有更好的 Token 效率', () => {
      const counter = createTokenCounter();
      const chineseText = '这是一段很长的中文文本，包含很多中文字符。'.repeat(10);

      const gptTokens = counter.estimateTokens(chineseText, 'gpt-3.5-turbo');
      const deepseekTokens = counter.estimateTokens(chineseText, 'deepseek-chat');
      const qwenTokens = counter.estimateTokens(chineseText, 'qwen-turbo');

      // DeepSeek 和 Qwen 对中文应该更高效（更少的 Token）
      // 由于我们的实现中 DeepSeek 和 Qwen 使用相同的计数方法（中文 2 字符/token）
      // 而 GPT 使用中文 2.5 字符/token，所以 DeepSeek 和 Qwen 应该更高效
      expect(deepseekTokens).toBeLessThanOrEqual(gptTokens);
      expect(qwenTokens).toBeLessThanOrEqual(gptTokens);

      // 验证具体数值：GPT 应该使用更多 tokens
      const chineseChars = (chineseText.match(/[一-龥]/g) || []).length;
      const expectedGptTokens = Math.ceil(chineseChars / 2.5);
      const expectedDeepseekTokens = Math.ceil(chineseChars / 2);

      expect(gptTokens).toBeCloseTo(expectedGptTokens, 0);
      expect(deepseekTokens).toBeCloseTo(expectedDeepseekTokens, 0);
    });
  });
});

describe('BatchProcessorOptimizer', () => {
  describe('基础功能', () => {
    it('应该正确创建批处理器优化器实例', () => {
      const optimizer = createBatchProcessorOptimizer();
      expect(optimizer).toBeInstanceOf(BatchProcessorOptimizer);
    });

    it('应该使用默认配置', () => {
      const optimizer = createBatchProcessorOptimizer();
      const config = optimizer.getConfig();

      expect(config.maxTokens).toBe(4000);
      expect(config.maxBatchSize).toBe(20);
      expect(config.safetyMargin).toBe(0.2);
    });

    it('应该支持自定义配置', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 8000,
        maxBatchSize: 10,
        safetyMargin: 0.1,
      });

      const config = optimizer.getConfig();
      expect(config.maxTokens).toBe(8000);
      expect(config.maxBatchSize).toBe(10);
      expect(config.safetyMargin).toBe(0.1);
    });
  });

  describe('最优批次大小计算', () => {
    it('应该根据 Token 限制计算最优批次大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 20,
      });

      const texts = Array(10).fill('Hello world '); // 每个 ~3 tokens
      const optimalSize = optimizer.calculateOptimalBatchSize(texts, 'gpt-3.5-turbo');

      expect(optimalSize).toBeGreaterThan(0);
      expect(optimalSize).toBeLessThanOrEqual(20);
    });

    it('短文本应该允许更大的批次', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 50,
      });

      const shortTexts = Array(100).fill('Hi'); // 每个 ~1 token
      const optimalSize = optimizer.calculateOptimalBatchSize(shortTexts, 'gpt-3.5-turbo');

      expect(optimalSize).toBeGreaterThan(10);
    });

    it('长文本应该减小批次大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 50,
      });

      const longTexts = Array(10).fill('Hello world '.repeat(100)); // 每个 ~300 tokens
      const optimalSize = optimizer.calculateOptimalBatchSize(longTexts, 'gpt-3.5-turbo');

      expect(optimalSize).toBeLessThan(5);
    });
  });

  describe('文本分批', () => {
    it('应该正确将文本分批', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 5,
      });

      const texts = Array(20).fill('Hello world ');
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      expect(result.batches.length).toBeGreaterThan(1);
      expect(result.totalBatches).toBe(result.batches.length);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('应该正确处理单个批次', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 10000,
        maxBatchSize: 50,
      });

      const texts = Array(5).fill('Hello world ');
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      expect(result.batches.length).toBe(1);
      expect(result.batches[0]).toHaveLength(5);
    });

    it('应该检测超长文本并抛出错误', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 100,
        maxBatchSize: 10,
      });

      const longText = 'Hello world '.repeat(1000); // 超过 100 tokens

      expect(() => {
        optimizer.partitionIntoBatches([longText], 'gpt-3.5-turbo');
      }).toThrow();
    });

    it('应该正确应用安全边际', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
        safetyMargin: 0.5, // 50% 安全边际
      });

      const texts = Array(10).fill('Hello world '.repeat(10)); // 每个 ~30 tokens
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');

      // 验证批次不超过 500 tokens（1000 * 0.5）
      const tokenCounter = createTokenCounter();
      for (const batch of result.batches) {
        const batchTokens = tokenCounter.calculateTotalTokens(batch, 'gpt-3.5-turbo');
        expect(batchTokens).toBeLessThanOrEqual(500);
      }
    });
  });

  describe('动态批次大小调整', () => {
    it('应该在 Token 使用率低时增加批次大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
        enableDynamicAdjustment: true,
      });

      // 历史批次：使用率很低（每个批次 ~500 tokens）
      const previousBatches = Array(5).fill(Array(10).fill('Hello world '));
      const adjustedSize = optimizer.adjustBatchSize(previousBatches, 'gpt-3.5-turbo');

      expect(adjustedSize).toBeGreaterThan(10);
    });

    it('应该在 Token 使用率高时减少批次大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 20,
        enableDynamicAdjustment: true,
      });

      // 历史批次：使用率很高（每个批次 ~950 tokens）
      const previousBatches = Array(5).fill(Array(5).fill('Hello world '.repeat(100)));
      const adjustedSize = optimizer.adjustBatchSize(previousBatches, 'gpt-3.5-turbo');

      expect(adjustedSize).toBeLessThan(5);
    });

    it('应该在禁用动态调整时保持批次大小不变', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
        enableDynamicAdjustment: false,
      });

      const previousBatches = Array(5).fill(Array(10).fill('Hello world '));
      const adjustedSize = optimizer.adjustBatchSize(previousBatches, 'gpt-3.5-turbo');

      expect(adjustedSize).toBe(20);
    });
  });

  describe('智能分批', () => {
    it('应该结合最优批次大小和动态调整', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
        enableDynamicAdjustment: true,
      });

      const texts = Array(50).fill('Hello world ');
      const result = optimizer.smartPartition(texts, 'gpt-3.5-turbo');

      expect(result.batches.length).toBeGreaterThan(1);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.averageBatchSize).toBeGreaterThan(0);
    });

    it('应该在首次分批时使用最优大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 4000,
        maxBatchSize: 20,
        enableDynamicAdjustment: true,
      });

      const texts = Array(30).fill('Hello world ');
      const result = optimizer.smartPartition(texts, 'gpt-3.5-turbo');

      // 首次分批，没有历史记录
      expect(result.batches.length).toBeGreaterThan(0);
    });
  });

  describe('批次统计和验证', () => {
    it('应该正确计算批次统计信息', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
      });

      const texts = Array(20).fill('Hello world ');
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const stats = optimizer.getBatchStatistics(result.batches, 'gpt-3.5-turbo');

      expect(stats.totalBatches).toBe(result.batches.length);
      expect(stats.totalItems).toBe(20);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.avgTokensPerBatch).toBeGreaterThan(0);
      expect(stats.avgItemsPerBatch).toBeGreaterThan(0);
    });

    it('应该正确验证批次', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
      });

      const texts = Array(20).fill('Hello world ');
      const result = optimizer.partitionIntoBatches(texts, 'gpt-3.5-turbo');
      const validation = optimizer.validateBatches(result.batches, 'gpt-3.5-turbo');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该检测无效批次', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 100,
        maxBatchSize: 5,
      });

      // 创建一个超过限制的批次
      const invalidBatches = [
        Array(10).fill('Hello world '.repeat(10)), // 超过大小和 Token 限制
      ];

      const validation = optimizer.validateBatches(invalidBatches, 'gpt-3.5-turbo');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('历史记录管理', () => {
    it('应该正确记录分批历史', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
        enableDynamicAdjustment: true,
      });

      const texts = Array(20).fill('Hello world ');
      optimizer.smartPartition(texts, 'gpt-3.5-turbo');

      const history = optimizer.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].model).toBe('gpt-3.5-turbo');
    });

    it('应该限制历史记录大小', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
        enableDynamicAdjustment: true,
      });

      const texts = Array(20).fill('Hello world ');

      // 创建 15 个分批记录
      for (let i = 0; i < 15; i++) {
        optimizer.smartPartition(texts, 'gpt-3.5-turbo');
      }

      const history = optimizer.getHistory();
      expect(history.length).toBe(10); // 最多保留 10 条
    });

    it('应该支持清空历史记录', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
        enableDynamicAdjustment: true,
      });

      const texts = Array(20).fill('Hello world ');
      optimizer.smartPartition(texts, 'gpt-3.5-turbo');
      optimizer.clearHistory();

      const history = optimizer.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('配置更新', () => {
    it('应该支持更新配置', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
      });

      optimizer.updateConfig({
        maxTokens: 8000,
        maxBatchSize: 20,
      });

      const config = optimizer.getConfig();
      expect(config.maxTokens).toBe(8000);
      expect(config.maxBatchSize).toBe(20);
    });

    it('应该支持部分更新配置', () => {
      const optimizer = createBatchProcessorOptimizer({
        maxTokens: 1000,
        maxBatchSize: 10,
        safetyMargin: 0.2,
      });

      optimizer.updateConfig({
        maxTokens: 8000,
      });

      const config = optimizer.getConfig();
      expect(config.maxTokens).toBe(8000);
      expect(config.maxBatchSize).toBe(10); // 保持不变
      expect(config.safetyMargin).toBe(0.2); // 保持不变
    });
  });
});
