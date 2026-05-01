/**
 * 嵌入向量功能集成测试
 *
 * 注意：这些测试需要真实的嵌入服务运行
 * - 本地 BGE-M3 服务：http://localhost:8009/v1
 * - DeepSeek API：需要 DEEPSEEK_API_KEY 环境变量
 * - 通义千问 API：需要 DASHSCOPE_API_KEY 环境变量
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createBGEEmbedding, createM3EEmbedding } from '../../src/llm/EmbeddingAdapter.js';
import { createDeepSeekModel } from '../../src/llm/NativeLLMAdapter.js';
import { createCachedProvider } from '../../src/llm/EmbeddingCache.js';

// 跳过集成测试的标志
const SKIP_INTEGRATION = !process.env.RUN_INTEGRATION_TESTS;

describe.runIf(!SKIP_INTEGRATION)('嵌入向量集成测试', () => {
  describe('本地 BGE-M3 嵌入服务', () => {
    const baseURL = 'http://localhost:8009/v1';
    let embeddingProvider: ReturnType<typeof createBGEEmbedding>;

    beforeAll(() => {
      embeddingProvider = createBGEEmbedding(baseURL);
    });

    it('应该成功生成单个嵌入向量', async () => {
      const result = await embeddingProvider.embedSingle('测试文本');

      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(1024);
      expect(result.model).toBeDefined();
    }, 30000);

    it('应该成功批量生成嵌入向量', async () => {
      const texts = ['文本1', '文本2', '文本3'];
      const result = await embeddingProvider.embed({ texts });

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0].length).toBe(1024);
      expect(result.dimension).toBe(1024);
    }, 30000);

    it('相似文本的向量距离应该更小', async () => {
      const similarTexts = [
        '人工智能是计算机科学的一个分支',
        '人工智能属于计算机科学领域',
        '今天天气很好',
      ];

      const result = await embeddingProvider.embed({ texts: similarTexts });

      const [vec1, vec2, vec3] = result.embeddings;

      // 相似文本的余弦相似度应该更高
      const similarity12 = embeddingProvider.cosineSimilarity(vec1, vec2);
      const similarity13 = embeddingProvider.cosineSimilarity(vec1, vec3);

      expect(similarity12).toBeGreaterThan(similarity13);
      expect(similarity12).toBeGreaterThan(0.7); // 相似文本应该 > 0.7
      expect(similarity13).toBeLessThan(0.5); // 不相关文本应该 < 0.5
    }, 30000);

    it('应该正确处理空输入', async () => {
      const result = await embeddingProvider.embed({ texts: [] });

      expect(result.embeddings).toEqual([]);
      expect(result.dimension).toBe(0);
    }, 30000);

    it('归一化后的向量模长应该为 1', async () => {
      const result = await embeddingProvider.embed({ texts: ['测试'], normalize: true });

      const vec = result.embeddings[0];
      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));

      expect(norm).toBeCloseTo(1, 4);
    }, 30000);

    it('批量嵌入性能应该满足要求', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `测试文本 ${i}`);

      const startTime = Date.now();
      await embeddingProvider.embed({ texts });
      const duration = Date.now() - startTime;

      // 性能要求：100 个文本应该在 30 秒内完成
      expect(duration).toBeLessThan(30000);

      // 计算吞吐量
      const throughput = texts.length / (duration / 1000);
      console.log(`批量嵌入吞吐量: ${throughput.toFixed(2)} docs/s`);

      // 至少应该达到 10 docs/s（考虑本地服务限制）
      expect(throughput).toBeGreaterThan(10);
    }, 60000);
  });

  describe.runIf(process.env.DEEPSEEK_API_KEY)('DeepSeek 嵌入 API', () => {
    let llm: ReturnType<typeof createDeepSeekModel>;

    beforeAll(() => {
      const apiKey = process.env.DEEPSEEK_API_KEY!;
      llm = createDeepSeekModel(apiKey);
    });

    it('应该成功生成嵌入向量', async () => {
      const result = await llm.embed(['测试文本']);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].length).toBeGreaterThan(0);
      // DeepSeek 嵌入维度
      expect(result[0].length).toBe(1024);
    }, 30000);

    it('应该支持批量嵌入', async () => {
      const texts = ['文本1', '文本2', '文本3'];
      const result = await llm.embed(texts);

      expect(result.length).toBe(3);
      expect(result[0].length).toBe(1024);
    }, 30000);
  });

  describe('嵌入缓存集成测试', () => {
    const baseURL = 'http://localhost:8009/v1';
    let embeddingProvider: ReturnType<typeof createBGEEmbedding>;
    let cachedProvider: ReturnType<typeof createCachedProvider>;

    beforeAll(() => {
      embeddingProvider = createBGEEmbedding(baseURL);
      cachedProvider = createCachedProvider(embeddingProvider, {
        maxSize: 100,
        ttl: 60000, // 1 分钟
      });
    });

    it('缓存应该提高重复请求的性能', async () => {
      const text = '性能测试文本';

      // 第一次请求（无缓存）
      const start1 = Date.now();
      await cachedProvider.embed({ texts: [text] });
      const duration1 = Date.now() - start1;

      // 第二次请求（有缓存）
      const start2 = Date.now();
      await cachedProvider.embed({ texts: [text] });
      const duration2 = Date.now() - start2;

      // 缓存命中应该快得多
      expect(duration2).toBeLessThan(duration1);

      console.log(`首次请求: ${duration1}ms, 缓存请求: ${duration2}ms`);
    }, 30000);

    it('缓存统计应该正确', async () => {
      const texts = ['文本1', '文本2', '文本3'];

      // 第一次请求
      await cachedProvider.embed({ texts });

      // 第二次请求（部分命中）
      await cachedProvider.embed({ texts: ['文本1', '文本4'] });

      const stats = cachedProvider.getStats();
      expect(stats.hits).toBe(1); // '文本1' 命中
      expect(stats.misses).toBe(4); // '文本1', '文本2', '文本3', '文本4' 未命中
      expect(stats.hitRate).toBeCloseTo(0.2, 1);
    }, 30000);

    it('预热缓存应该提高后续性能', async () => {
      const texts = ['预热1', '预热2', '预热3'];

      // 预热
      await cachedProvider.warmup(texts);

      // 检查缓存大小
      expect(cachedProvider.size()).toBe(3);

      // 后续请求应该从缓存获取
      const start = Date.now();
      await cachedProvider.embed({ texts });
      const duration = Date.now() - start;

      // 应该非常快（< 100ms）
      expect(duration).toBeLessThan(100);
    }, 30000);
  });

  describe('M3E-base 嵌入模型', () => {
    const baseURL = 'http://localhost:8009/v1';
    let embeddingProvider: ReturnType<typeof createM3EEmbedding>;

    beforeAll(() => {
      embeddingProvider = createM3EEmbedding(baseURL, 'bge-m3-mlx-8bit');
    });

    it('应该生成 768 维向量', async () => {
      const result = await embeddingProvider.embedSingle('测试');

      expect(result.embedding.length).toBe(768);
    }, 30000);

    it('能力信息应该正确', () => {
      const capabilities = embeddingProvider.getCapabilities();

      expect(capabilities.dimension).toBe(768);
      expect(capabilities.maxTokens).toBe(512);
      expect(capabilities.supportsNormalization).toBe(true);
    });
  });
});

// 跳过提示
describe.skipIf(!SKIP_INTEGRATION)('嵌入向量集成测试（跳过）', () => {
  it('要运行集成测试，请设置环境变量 RUN_INTEGRATION_TESTS=1', () => {
    console.log('跳过集成测试');
    console.log('运行集成测试需要:');
    console.log('1. 本地 BGE-M3 服务运行在 http://localhost:8009/v1');
    console.log('2. 设置 RUN_INTEGRATION_TESTS=1');
    console.log('3. (可选) 设置 DEEPSEEK_API_KEY 测试 DeepSeek 嵌入');
  });
});
