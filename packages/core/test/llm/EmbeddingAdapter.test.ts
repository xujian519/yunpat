import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmbeddingAdapter,
  createBGEEmbedding,
  createM3EEmbedding,
  type OpenAIEmbeddingConfig,
} from '../../src/llm/EmbeddingAdapter.js';
import { EmbeddingError, EmbeddingErrorCode } from '../../src/llm/EmbeddingProvider.js';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('EmbeddingAdapter', () => {
  let adapter: EmbeddingAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new EmbeddingAdapter({ baseURL: 'http://localhost:8009/v1' });
  });

  function createTestAdapter(dim = 3): EmbeddingAdapter {
    const a = new EmbeddingAdapter({ baseURL: 'http://test', normalize: false });
    a.setCapabilities({ dimension: dim });
    return a;
  }

  describe('constructor', () => {
    it('应该使用默认配置', () => {
      const a = new EmbeddingAdapter({ baseURL: 'http://test' });
      expect(a.getModel()).toBe('bge-m3-mlx-8bit');
      expect(a.getCapabilities().dimension).toBe(1024);
    });

    it('应该使用自定义配置', () => {
      const a = new EmbeddingAdapter({
        baseURL: 'http://test',
        model: 'custom-model',
        timeout: 5000,
        batchSize: 16,
        normalize: false,
        apiKey: 'test-key',
      });
      expect(a.getModel()).toBe('custom-model');
    });
  });

  describe('embed', () => {
    it('应该返回空数组（空输入）', async () => {
      const result = await adapter.embed({ texts: [] });
      expect(result.embeddings).toEqual([]);
      expect(result.dimension).toBe(1024);
    });

    it('应该成功嵌入文本', async () => {
      const a = createTestAdapter(3);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
            model: 'bge-m3-mlx-8bit',
          }),
      });

      const result = await a.embed({ texts: ['hello'] });
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('应该归一化嵌入', async () => {
      const a = createTestAdapter(3);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: [3, 4, 0], index: 0 }],
            model: 'bge-m3-mlx-8bit',
          }),
      });

      const result = await a.embed({ texts: ['hello'], normalize: true });
      const emb = result.embeddings[0];
      const norm = Math.sqrt(emb[0] * emb[0] + emb[1] * emb[1] + emb[2] * emb[2]);
      expect(Math.abs(norm - 1)).toBeLessThan(0.001);
    });

    it('应该跳过归一化', async () => {
      const a = createTestAdapter(3);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: [3, 4, 0], index: 0 }],
            model: 'bge-m3-mlx-8bit',
          }),
      });

      const result = await a.embed({ texts: ['hello'], normalize: false });
      expect(result.embeddings[0]).toEqual([3, 4, 0]);
    });

    it('应该处理API错误', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('error'),
      });

      await expect(adapter.embed({ texts: ['hello'] })).rejects.toThrow(EmbeddingError);
    });

    it('应该处理API错误（含JSON错误）', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ error: { message: 'invalid request' } }),
      });

      await expect(adapter.embed({ texts: ['hello'] })).rejects.toThrow(EmbeddingError);
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(adapter.embed({ texts: ['hello'] })).rejects.toThrow(EmbeddingError);
    });

    it('应该处理无效响应格式', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'test' }),
      });

      await expect(adapter.embed({ texts: ['hello'] })).rejects.toThrow(EmbeddingError);
    });

    it('应该分批处理', async () => {
      const a = new EmbeddingAdapter({ baseURL: 'http://test', batchSize: 2, normalize: false });
      a.setCapabilities({ dimension: 1 });
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { embedding: [0.1], index: 0 },
                { embedding: [0.2], index: 1 },
              ],
              model: 'test',
            }),
        });
      });

      const result = await a.embed({ texts: ['a', 'b', 'c', 'd'] });
      expect(result.embeddings).toHaveLength(4);
      expect(callCount).toBe(2);
    });

    it('应该使用apiKey发送请求', async () => {
      const a = new EmbeddingAdapter({ baseURL: 'http://test', apiKey: 'secret' });
      a.setCapabilities({ dimension: 1 });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: [0.1], index: 0 }],
            model: 'test',
          }),
      });

      await a.embed({ texts: ['hello'] });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test/embeddings',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret',
          }),
        })
      );
    });
  });

  describe('embedSingle', () => {
    it('应该嵌入单个文本', async () => {
      const a = createTestAdapter(2);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: [0.1, 0.2], index: 0 }],
            model: 'test',
          }),
      });

      const result = await a.embedSingle('hello');
      expect(result.embedding).toEqual([0.1, 0.2]);
    });
  });

  describe('getCapabilities', () => {
    it('应该返回能力元数据', () => {
      const caps = adapter.getCapabilities();
      expect(caps.dimension).toBe(1024);
      expect(caps.maxTokens).toBe(8192);
      expect(caps.supportsNormalization).toBe(true);
    });
  });

  describe('getModel', () => {
    it('应该返回模型名称', () => {
      expect(adapter.getModel()).toBe('bge-m3-mlx-8bit');
    });
  });

  describe('setCapabilities', () => {
    it('应该更新能力配置', () => {
      adapter.setCapabilities({ dimension: 768 });
      expect(adapter.getCapabilities().dimension).toBe(768);
    });
  });

  describe('createBGEEmbedding', () => {
    it('应该创建BGE-M3适配器', () => {
      const a = createBGEEmbedding('http://localhost:8009/v1');
      expect(a.getModel()).toBe('bge-m3-mlx-8bit');
      expect(a.getCapabilities().dimension).toBe(1024);
    });
  });

  describe('createM3EEmbedding', () => {
    it('应该创建M3E-base适配器', () => {
      const a = createM3EEmbedding('http://localhost:8009/v1');
      expect(a.getModel()).toBe('m3e-base');
      expect(a.getCapabilities().dimension).toBe(768);
    });
  });

  describe('validateInput', () => {
    it('应该在输入无效时抛出错误', async () => {
      await expect(adapter.embed({ texts: [null as any] })).rejects.toThrow('不是字符串');
    });

    it('应该在文本过长时抛出错误', async () => {
      const longText = 'a'.repeat(10000);
      await expect(adapter.embed({ texts: [longText] })).rejects.toThrow(EmbeddingError);
    });
  });

  describe('validateDimension', () => {
    it('应该在维度不匹配时抛出错误', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: [0.1], index: 0 }],
            model: 'test',
          }),
      });

      await expect(adapter.embed({ texts: ['hello'] })).rejects.toThrow(EmbeddingError);
    });
  });
});
