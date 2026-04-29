/**
 * SimilarityCalculator 性能基准测试
 *
 * 测试相似度计算的性能和准确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimilarityCalculator } from '../../src/tools/SimilarityCalculator.js';

describe('SimilarityCalculator - 性能测试', () => {
  let calculator: SimilarityCalculator;

  beforeEach(() => {
    calculator = new SimilarityCalculator();
  });

  describe('算法性能对比', () => {
    const shortText1 = '这是一个简短的文本';
    const shortText2 = '这是另一个简短文本';
    const longText1 = '这是一段很长的文本内容。'.repeat(50);
    const longText2 = '这是另一段很长的文本内容。'.repeat(50);

    it('Jaccard算法应该在短文本上快速执行', () => {
      const start = performance.now();
      const result = calculator.calculateSimilarity(shortText1, shortText2, 'jaccard');
      const duration = performance.now() - start;

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
      expect(duration).toBeLessThan(10); // 应该在10ms内完成
    });

    it('Jaccard算法应该在长文本上快速执行', () => {
      const start = performance.now();
      const result = calculator.calculateSimilarity(longText1, longText2, 'jaccard');
      const duration = performance.now() - start;

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
      expect(duration).toBeLessThan(50); // 应该在50ms内完成
    });

    it('余弦相似度应该在合理时间内完成', () => {
      const start = performance.now();
      const result = calculator.calculateSimilarity(shortText1, shortText2, 'cosine');
      const duration = performance.now() - start;

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
      expect(duration).toBeLessThan(20); // 应该在20ms内完成
    });

    it('Levenshtein算法应该在短文本上快速执行', () => {
      const start = performance.now();
      const result = calculator.calculateSimilarity(shortText1, shortText2, 'levenshtein');
      const duration = performance.now() - start;

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
      expect(duration).toBeLessThan(15); // 应该在15ms内完成
    });

    it('不同算法应该返回合理的结果范围', () => {
      const jaccard = calculator.calculateSimilarity(shortText1, shortText2, 'jaccard');
      const cosine = calculator.calculateSimilarity(shortText1, shortText2, 'cosine');
      const levenshtein = calculator.calculateSimilarity(shortText1, shortText2, 'levenshtein');

      // 所有算法都应该返回0-1之间的值
      expect(jaccard).toBeGreaterThanOrEqual(0);
      expect(jaccard).toBeLessThanOrEqual(1);
      expect(cosine).toBeGreaterThanOrEqual(0);
      expect(cosine).toBeLessThanOrEqual(1);
      expect(levenshtein).toBeGreaterThanOrEqual(0);
      expect(levenshtein).toBeLessThanOrEqual(1);
    });
  });

  describe('缓存性能', () => {
    it('缓存应该提高重复计算的效率', () => {
      const text1 = '测试文本一';
      const text2 = '测试文本二';

      // 第一次计算（无缓存）
      const start1 = performance.now();
      calculator.calculateSimilarity(text1, text2, 'jaccard');
      const duration1 = performance.now() - start1;

      // 第二次计算（有缓存）
      const start2 = performance.now();
      calculator.calculateSimilarity(text1, text2, 'jaccard');
      const duration2 = performance.now() - start2;

      // 缓存应该显著提高速度
      expect(duration2).toBeLessThan(duration1);

      // 检查缓存统计
      const stats = calculator.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('缓存命中率应该足够高', () => {
      const text1 = '测试文本';
      const text2 = '另一个文本';

      // 多次重复计算
      for (let i = 0; i < 10; i++) {
        calculator.calculateSimilarity(text1, text2, 'jaccard');
      }

      const stats = calculator.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0.8); // 应该有80%以上的命中率
    });

    it('缓存大小应该被限制', () => {
      // 清除缓存
      calculator.clearCache();

      // 添加大量不同的计算
      for (let i = 0; i < 2000; i++) {
        calculator.calculateSimilarity(`文本${i}`, `文本${i + 1}`, 'jaccard');
      }

      const stats = calculator.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(1000); // 缓存大小应该被限制
    });
  });

  describe('批量计算性能', () => {
    it('批量计算应该比单个计算更高效', () => {
      const targetText = '目标文本';
      const candidates = Array.from({ length: 100 }, (_, i) => `候选文本${i}`);

      // 批量计算
      const start1 = performance.now();
      const batchResults = calculator.calculateBatchSimilarities(targetText, candidates);
      const duration1 = performance.now() - start1;

      // 单个计算
      const start2 = performance.now();
      const singleResults = candidates.map(text => ({
        text,
        similarity: calculator.calculateSimilarity(targetText, text),
      }));
      const duration2 = performance.now() - start2;

      // 批量计算应该更快或相近
      expect(duration1).toBeLessThanOrEqual(duration2 * 1.2); // 允许20%的误差

      // 结果应该一致
      expect(batchResults.length).toBe(singleResults.length);
    });

    it('批量计算应该处理大量候选文本', () => {
      const targetText = '目标文本';
      const candidates = Array.from({ length: 1000 }, (_, i) => `候选文本${i}`);

      const start = performance.now();
      const results = calculator.calculateBatchSimilarities(targetText, candidates);
      const duration = performance.now() - start;

      expect(results.length).toBe(1000);
      expect(duration).toBeLessThan(500); // 应该在500ms内完成
    });
  });

  describe('准确性测试', () => {
    it('相同文本应该返回1.0的相似度', () => {
      const text = '测试文本';

      const jaccard = calculator.calculateSimilarity(text, text, 'jaccard');
      const cosine = calculator.calculateSimilarity(text, text, 'cosine');
      const levenshtein = calculator.calculateSimilarity(text, text, 'levenshtein');

      expect(jaccard).toBe(1.0);
      expect(cosine).toBe(1.0);
      expect(levenshtein).toBe(1.0);
    });

    it('完全不同的文本应该返回0.0的相似度', () => {
      const text1 = 'abcdefg';
      const text2 = 'hijklmn';

      const jaccard = calculator.calculateSimilarity(text1, text2, 'jaccard');
      const cosine = calculator.calculateSimilarity(text1, text2, 'cosine');
      const levenshtein = calculator.calculateSimilarity(text1, text2, 'levenshtein');

      expect(jaccard).toBe(0);
      expect(cosine).toBe(0);
      expect(levenshtein).toBe(0);
    });

    it('相似文本应该返回高相似度', () => {
      const text1 = '这是一个测试文本';
      const text2 = '这是另一个测试文本';

      const jaccard = calculator.calculateSimilarity(text1, text2, 'jaccard');
      const cosine = calculator.calculateSimilarity(text1, text2, 'cosine');

      // 应该有较高的相似度（>0.3）
      expect(jaccard).toBeGreaterThan(0.3);
      expect(cosine).toBeGreaterThan(0.3);
    });

    it('findMostSimilar应该找到最相似的文本', () => {
      const targetText = 'PDF转Markdown工具';
      const candidates = [
        'Excel数据分析工具',
        '图片文字识别工具',
        'PDF转Markdown格式工具',
        '音频转文字工具',
      ];

      const result = calculator.findMostSimilar(targetText, candidates);

      expect(result).not.toBeNull();
      expect(result!.text).toBe('PDF转Markdown格式工具');
      expect(result!.similarity).toBeGreaterThan(0.3);
    });

    it('findMostSimilar应该支持阈值过滤', () => {
      const targetText = '完全不相关的文本';
      const candidates = [
        '候选文本1',
        '候选文本2',
        '候选文本3',
      ];

      const result = calculator.findMostSimilar(targetText, candidates, 'jaccard', 0.5);

      // 如果所有相似度都低于阈值，应该返回null
      if (result) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('中英文混合支持', () => {
    it('应该正确处理中文文本', () => {
      const text1 = '这是一个中文测试文本';
      const text2 = '这是另一个中文测试文本';

      const similarity = calculator.calculateSimilarity(text1, text2, 'jaccard');

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('应该正确处理英文文本', () => {
      const text1 = 'This is a test text';
      const text2 = 'This is another test text';

      const similarity = calculator.calculateSimilarity(text1, text2, 'jaccard');

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('应该正确处理中英文混合文本', () => {
      const text1 = '这是a测试text文本';
      const text2 = '这是another测试text文本';

      const similarity = calculator.calculateSimilarity(text1, text2, 'jaccard');

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('特殊字符处理', () => {
    it('应该正确处理包含标点符号的文本', () => {
      const text1 = '测试，文本！包含标点符号。';
      const text2 = '测试，文本！包含标点符号。';

      const similarity = calculator.calculateSimilarity(text1, text2, 'jaccard');

      expect(similarity).toBe(1.0); // 应该完全相同
    });

    it('应该正确处理包含数字的文本', () => {
      const text1 = '版本1.2.3发布';
      const text2 = '版本1.2.4发布';

      const similarity = calculator.calculateSimilarity(text1, text2, 'jaccard');

      expect(similarity).toBeGreaterThan(0.5); // 应该有较高相似度
    });
  });
});

describe('SimilarityCalculator - 压力测试', () => {
  let calculator: SimilarityCalculator;

  beforeEach(() => {
    calculator = new SimilarityCalculator();
  });

  it('应该能处理大量相似度计算', () => {
    const texts = Array.from({ length: 500 }, (_, i) => `测试文本${i}`);

    const start = performance.now();
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        calculator.calculateSimilarity(texts[i], texts[j], 'jaccard');
      }
    }
    const duration = performance.now() - start;

    // 500个文本的两两比较 = 124,750次计算
    // 应该在合理时间内完成（<10秒）
    expect(duration).toBeLessThan(10000);
  });

  it('应该能处理超长文本', () => {
    const longText1 = '这是一段很长的文本内容。'.repeat(1000); // ~20,000字符
    const longText2 = '这是另一段很长的文本内容。'.repeat(1000);

    const start = performance.now();
    const result = calculator.calculateSimilarity(longText1, longText2, 'jaccard');
    const duration = performance.now() - start;

    expect(result).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(1000); // 应该在1秒内完成
  });
});
