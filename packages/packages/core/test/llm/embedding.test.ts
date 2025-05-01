/**
 * 嵌入向量功能单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  EmbeddingAdapter,
  createBGEEmbedding,
  createM3EEmbedding,
} from '../../src/llm/EmbeddingAdapter.js'
import {
  BaseEmbeddingProvider,
  EmbeddingCacheKeyGenerator,
  EmbeddingError,
  EmbeddingErrorCode,
} from '../../src/llm/EmbeddingProvider.js'
import { CachedEmbeddingProvider, createCachedProvider } from '../../src/llm/EmbeddingCache.js'

/**
 * Mock 嵌入提供者（用于测试）
 */
class MockEmbeddingProvider extends BaseEmbeddingProvider {
  private dimension = 1024
  private model = 'mock-model'
  private callCount = 0

  async embed(params: { texts: string[]; normalize?: boolean }) {
    this.callCount++
    const { texts, normalize = true } = params

    if (texts.length === 0) {
      return {
        embeddings: [],
        dimension: 0,
        model: this.model,
      }
    }

    const embeddings = texts.map((text) => {
      // 根据文本生成确定性的向量
      const vec: number[] = []
      for (let i = 0; i < this.dimension; i++) {
        vec.push((text.charCodeAt(i % text.length) * (i + 1)) / 10000)
      }

      return normalize ? this.normalize(vec) : vec
    })

    return {
      embeddings,
      dimension: this.dimension,
      model: this.model,
    }
  }

  async embedSingle(text: string, normalize = true) {
    const result = await this.embed({ texts: [text], normalize })
    return {
      embedding: result.embeddings[0],
      model: result.model,
    }
  }

  getCapabilities() {
    return {
      dimension: this.dimension,
      maxTokens: 8192,
      maxBatchSize: 32,
      supportsNormalization: true,
    }
  }

  getModel() {
    return this.model
  }

  getCallCount() {
    return this.callCount
  }

  resetCallCount() {
    this.callCount = 0
  }
}

describe('EmbeddingProvider', () => {
  describe('BaseEmbeddingProvider', () => {
    let provider: MockEmbeddingProvider

    beforeEach(() => {
      provider = new MockEmbeddingProvider()
    })

    describe('embed', () => {
      it('应该生成正确维度的嵌入向量', async () => {
        const result = await provider.embed({ texts: ['测试文本'] })

        expect(result.embeddings).toHaveLength(1)
        expect(result.embeddings[0]).toHaveLength(1024)
        expect(result.dimension).toBe(1024)
      })

      it('应该批量处理多个文本', async () => {
        const texts = ['文本1', '文本2', '文本3']
        const result = await provider.embed({ texts })

        expect(result.embeddings).toHaveLength(3)
        expect(result.embeddings[0]).toHaveLength(1024)
        expect(result.embeddings[1]).toHaveLength(1024)
        expect(result.embeddings[2]).toHaveLength(1024)
      })

      it('应该支持归一化', async () => {
        const text = '测试文本'
        const normalizedResult = await provider.embed({ texts: [text], normalize: true })
        const unnormalizedResult = await provider.embed({ texts: [text], normalize: false })

        // 归一化后的向量模长应该为 1
        const norm = Math.sqrt(
          normalizedResult.embeddings[0].reduce((sum, val) => sum + val * val, 0)
        )
        expect(norm).toBeCloseTo(1, 5)

        // 未归一化的向量模长不应该为 1
        const unnorm = Math.sqrt(
          unnormalizedResult.embeddings[0].reduce((sum, val) => sum + val * val, 0)
        )
        expect(unnorm).not.toBeCloseTo(1, 1)
      })

      it('空输入应该返回空数组', async () => {
        const result = await provider.embed({ texts: [] })

        expect(result.embeddings).toEqual([])
        expect(result.dimension).toBe(0)
      })
    })

    describe('embedSingle', () => {
      it('应该生成单个嵌入向量', async () => {
        const result = await provider.embedSingle('测试文本')

        expect(result.embedding).toHaveLength(1024)
        expect(result.model).toBe('mock-model')
      })
    })

    describe('cosineSimilarity', () => {
      it('应该正确计算余弦相似度', () => {
        const vec1 = [1, 0, 0]
        const vec2 = [0, 1, 0]
        const vec3 = [1, 0, 0]

        expect(provider.cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 5)
        expect(provider.cosineSimilarity(vec1, vec3)).toBeCloseTo(1, 5)
      })

      it('相同向量应该返回 1', () => {
        const vec = [1, 2, 3]
        expect(provider.cosineSimilarity(vec, vec)).toBeCloseTo(1, 5)
      })

      it('正交向量应该返回 0', () => {
        const vec1 = [1, 0, 0]
        const vec2 = [0, 1, 0]
        expect(provider.cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 5)
      })

      it('应该拒绝不同维度的向量', () => {
        const vec1 = [1, 2, 3]
        const vec2 = [1, 2]

        expect(() => provider.cosineSimilarity(vec1, vec2)).toThrow('向量维度不匹配')
      })
    })

    describe('normalize', () => {
      it('应该正确归一化向量', () => {
        const vec = [3, 4]
        const normalized = provider.normalize(vec)

        const norm = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0))
        expect(norm).toBeCloseTo(1, 5)
      })

      it('零向量应该保持不变', () => {
        const vec = [0, 0, 0]
        const normalized = provider.normalize(vec)

        expect(normalized).toEqual(vec)
      })
    })

    describe('validateDimension', () => {
      it('应该接受正确维度的向量', () => {
        const vec = new Array(1024).fill(0)

        expect(() => provider['validateDimension'](vec, 1024)).not.toThrow()
      })

      it('应该拒绝错误维度的向量', () => {
        const vec = new Array(512).fill(0)

        expect(() => provider['validateDimension'](vec, 1024)).toThrow('嵌入向量维度不匹配')
      })
    })
  })

  describe('EmbeddingCacheKeyGenerator', () => {
    it('应该为相同输入生成相同的键', () => {
      const key1 = EmbeddingCacheKeyGenerator.generate('model', 'text', true)
      const key2 = EmbeddingCacheKeyGenerator.generate('model', 'text', true)

      expect(key1).toBe(key2)
    })

    it('应该为不同输入生成不同的键', () => {
      const key1 = EmbeddingCacheKeyGenerator.generate('model', 'text1', true)
      const key2 = EmbeddingCacheKeyGenerator.generate('model', 'text2', true)

      expect(key1).not.toBe(key2)
    })

    it('归一化选项应该影响缓存键', () => {
      const key1 = EmbeddingCacheKeyGenerator.generate('model', 'text', true)
      const key2 = EmbeddingCacheKeyGenerator.generate('model', 'text', false)

      expect(key1).not.toBe(key2)
    })

    it('模型名称应该影响缓存键', () => {
      const key1 = EmbeddingCacheKeyGenerator.generate('model1', 'text', true)
      const key2 = EmbeddingCacheKeyGenerator.generate('model2', 'text', true)

      expect(key1).not.toBe(key2)
    })
  })

  describe('EmbeddingError', () => {
    it('应该创建带有错误代码的错误', () => {
      const error = new EmbeddingError('测试错误', EmbeddingErrorCode.API_ERROR, 'test-provider')

      expect(error.message).toBe('测试错误')
      expect(error.code).toBe(EmbeddingErrorCode.API_ERROR)
      expect(error.provider).toBe('test-provider')
      expect(error.name).toBe('EmbeddingError')
    })
  })

  describe('CachedEmbeddingProvider', () => {
    let provider: MockEmbeddingProvider
    let cached: CachedEmbeddingProvider

    beforeEach(() => {
      provider = new MockEmbeddingProvider()
      cached = createCachedProvider(provider)
    })

    describe('缓存功能', () => {
      it('第一次调用应该缓存结果', async () => {
        const text = '测试文本'

        const result1 = await cached.embed({ texts: [text] })
        expect(result1.embeddings).toHaveLength(1)
        expect(provider.getCallCount()).toBe(1)

        const result2 = await cached.embed({ texts: [text] })
        expect(result2.embeddings).toEqual(result1.embeddings)
        expect(provider.getCallCount()).toBe(1) // 没有增加
      })

      it('不同文本不应该共享缓存', async () => {
        await cached.embed({ texts: ['文本1'] })
        await cached.embed({ texts: ['文本2'] })

        expect(provider.getCallCount()).toBe(2)
      })

      it('应该正确记录缓存统计', async () => {
        await cached.embed({ texts: ['文本1'] })
        await cached.embed({ texts: ['文本1'] }) // 缓存命中

        const stats = cached.getStats()
        expect(stats.hits).toBe(1)
        expect(stats.misses).toBe(1)
        expect(stats.hitRate).toBeCloseTo(0.5, 5)
      })

      it('应该支持清空缓存', async () => {
        await cached.embed({ texts: ['文本1'] })
        expect(cached.size()).toBe(1)

        cached.clear()
        expect(cached.size()).toBe(0)
        expect(cached.getStats().hits).toBe(0)
        expect(cached.getStats().misses).toBe(0)
      })

      it('应该支持预热缓存', async () => {
        const texts = ['文本1', '文本2', '文本3']

        await cached.warmup(texts)

        const stats = cached.getStats()
        expect(stats.misses).toBe(3)
        expect(cached.size()).toBeGreaterThan(0)

        // 再次请求应该从缓存获取
        await cached.embed({ texts })
        expect(provider.getCallCount()).toBe(1) // 只调用一次
      })
    })

    describe('缓存禁用', () => {
      it('禁用缓存后不应该缓存结果', async () => {
        cached.setEnabled(false)

        await cached.embed({ texts: ['文本1'] })
        await cached.embed({ texts: ['文本1'] })

        expect(provider.getCallCount()).toBe(2)
      })

      it('应该能重新启用缓存', async () => {
        cached.setEnabled(false)
        expect(cached.isEnabled()).toBe(false)

        cached.setEnabled(true)
        expect(cached.isEnabled()).toBe(true)

        await cached.embed({ texts: ['文本1'] })
        await cached.embed({ texts: ['文本1'] })

        expect(provider.getCallCount()).toBe(1)
      })
    })

    describe('缓存容量限制', () => {
      it('应该在达到最大容量时淘汰旧条目', async () => {
        const smallCache = createCachedProvider(provider, { maxSize: 3 })

        await smallCache.embed({ texts: ['1'] })
        await smallCache.embed({ texts: ['2'] })
        await smallCache.embed({ texts: ['3'] })
        expect(smallCache.size()).toBe(3)

        await smallCache.embed({ texts: ['4'] })
        expect(smallCache.size()).toBe(3) // 仍然是 3，淘汰了最旧的
      })
    })

    describe('代理方法', () => {
      it('应该正确代理 getModel', () => {
        expect(cached.getModel()).toBe(provider.getModel())
      })

      it('应该正确代理 getCapabilities', () => {
        expect(cached.getCapabilities()).toEqual(provider.getCapabilities())
      })

      it('应该正确代理 cosineSimilarity', () => {
        const vec1 = [1, 0, 0]
        const vec2 = [0, 1, 0]

        expect(cached.cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 5)
      })
    })
  })

  describe('createBGEEmbedding', () => {
    it('应该创建 BGE-M3 嵌入适配器', () => {
      const adapter = createBGEEmbedding('http://localhost:8009/v1')

      const capabilities = adapter.getCapabilities()
      expect(capabilities.dimension).toBe(1024)
      expect(capabilities.maxTokens).toBe(8192)
      expect(capabilities.maxBatchSize).toBe(32)
    })
  })

  describe('createM3EEmbedding', () => {
    it('应该创建 M3E-base 嵌入适配器', () => {
      const adapter = createM3EEmbedding('http://localhost:8009/v1')

      const capabilities = adapter.getCapabilities()
      expect(capabilities.dimension).toBe(768)
      expect(capabilities.maxTokens).toBe(512)
    })
  })
})
