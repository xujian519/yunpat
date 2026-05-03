import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ReasoningCache,
  createReasoningCache,
  type CacheConfig,
} from '../../src/reasoning/ReasoningCache.js'
import { EmbeddingAdapter } from '../../src/llm/EmbeddingAdapter.js'

const mockEmbed = vi.fn()
const mockEmbeddingAdapter = {
  embed: mockEmbed,
} as unknown as EmbeddingAdapter

describe('ReasoningCache', () => {
  let cache: ReasoningCache<string>

  beforeEach(() => {
    vi.clearAllMocks()
    cache = new ReasoningCache<string>()
  })

  describe('constructor', () => {
    it('应该使用默认配置创建实例', () => {
      const c = new ReasoningCache()
      expect(c.getStats().totalEntries).toBe(0)
    })

    it('应该使用自定义配置创建实例', () => {
      const c = new ReasoningCache({ maxEntries: 5, similarityThreshold: 0.9, ttl: 1000 })
      expect(c.getStats().totalEntries).toBe(0)
    })

    it('应该在有embeddingAdapter时启用嵌入', () => {
      const c = new ReasoningCache({}, mockEmbeddingAdapter)
      expect(c.getStats().totalEntries).toBe(0)
    })
  })

  describe('store', () => {
    it('应该存储新条目', async () => {
      await cache.store('问题1', '结果1', 100)
      expect(cache.getStats().totalEntries).toBe(1)
    })

    it('应该更新已存在的条目', async () => {
      await cache.store('问题1', '结果1', 100)
      await cache.store('问题1', '结果2', 200)
      const stats = cache.getStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.totalTokens).toBe(100)
    })

    it('应该在缓存满时驱逐LRU条目', async () => {
      const smallCache = new ReasoningCache<string>({ maxEntries: 2 })
      await smallCache.store('问题1', '结果1', 100)
      await smallCache.store('问题2', '结果2', 100)
      await smallCache.store('问题3', '结果3', 100)
      expect(smallCache.getStats().totalEntries).toBe(2)
    })

    it('应该生成嵌入向量（如果启用）', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        dimension: 3,
        model: 'test',
      })

      const c = new ReasoningCache<string>({}, mockEmbeddingAdapter)
      await c.store('问题1', '结果1', 100)
      expect(mockEmbed).toHaveBeenCalledWith({ texts: ['问题1'], normalize: true })
    })

    it('应该在嵌入失败时继续存储', async () => {
      mockEmbed.mockRejectedValue(new Error('嵌入失败'))

      const c = new ReasoningCache<string>({}, mockEmbeddingAdapter)
      await c.store('问题1', '结果1', 100)
      expect(c.getStats().totalEntries).toBe(1)
    })
  })

  describe('query', () => {
    it('应该返回未命中（空缓存）', async () => {
      const result = await cache.query('问题')
      expect(result.found).toBe(false)
    })

    it('应该命中精确匹配', async () => {
      await cache.store('问题1', '结果1', 100)
      const result = await cache.query('问题1')
      expect(result.found).toBe(true)
      expect(result.result).toBe('结果1')
    })

    it('应该使用自定义阈值', async () => {
      await cache.store('问题1', '结果1', 100)
      const result = await cache.query('问题1', 0.99)
      expect(result.found).toBe(true)
    })

    it('应该未命中（低于阈值）', async () => {
      await cache.store('问题1', '结果1', 100)
      const result = await cache.query('完全不同的问题', 0.99)
      expect(result.found).toBe(false)
    })

    it('应该使用嵌入查询（如果启用）', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        dimension: 3,
        model: 'test',
      })

      const c = new ReasoningCache<string>({ similarityThreshold: 0.5 }, mockEmbeddingAdapter)
      await c.store('问题1', '结果1', 100)
      const result = await c.query('问题1')
      expect(mockEmbed).toHaveBeenCalled()
    })

    it('应该在嵌入查询失败时返回未命中', async () => {
      mockEmbed.mockRejectedValue(new Error('嵌入失败'))

      const c = new ReasoningCache<string>({}, mockEmbeddingAdapter)
      await c.store('问题1', '结果1', 100)
      const result = await c.query('问题1')
      expect(result.found).toBe(false)
    })
  })

  describe('queryBySimilarity', () => {
    it('应该使用cosine相似度', async () => {
      const c = new ReasoningCache<string>({ similarityAlgorithm: 'cosine' })
      await c.store('hello world', '结果1', 100)
      const result = await c.query('hello world')
      expect(result.found).toBe(true)
    })

    it('应该使用jaccard相似度', async () => {
      const c = new ReasoningCache<string>({ similarityAlgorithm: 'jaccard' })
      await c.store('hello world', '结果1', 100)
      const result = await c.query('hello world')
      expect(result.found).toBe(true)
    })

    it('应该使用levenshtein相似度', async () => {
      const c = new ReasoningCache<string>({ similarityAlgorithm: 'levenshtein' })
      await c.store('hello', '结果1', 100)
      const result = await c.query('hello')
      expect(result.found).toBe(true)
    })

    it('应该默认使用jaccard（未知算法）', async () => {
      const c = new ReasoningCache<string>({ similarityAlgorithm: 'unknown' as any })
      await c.store('hello world', '结果1', 100)
      const result = await c.query('hello world')
      expect(result.found).toBe(true)
    })
  })

  describe('stats', () => {
    it('应该正确计算命中率', async () => {
      await cache.store('问题1', '结果1', 100)
      await cache.query('问题1')
      await cache.query('不存在的')

      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('应该计算节省的token', async () => {
      await cache.store('问题1', '结果1', 100)
      await cache.query('问题1')

      const stats = cache.getStats()
      expect(stats.tokensSaved).toBe(100)
    })

    it('应该在空缓存时返回0命中率', () => {
      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0)
    })

    it('应该计算平均相似度', async () => {
      await cache.store('问题1', '结果1', 100)
      await cache.query('问题1')

      const stats = cache.getStats()
      expect(stats.avgSimilarity).toBeGreaterThan(0)
    })
  })

  describe('clear', () => {
    it('应该清空缓存和统计', async () => {
      await cache.store('问题1', '结果1', 100)
      cache.clear()

      const stats = cache.getStats()
      expect(stats.totalEntries).toBe(0)
      expect(stats.hits).toBe(0)
    })
  })

  describe('delete', () => {
    it('应该删除指定条目', async () => {
      await cache.store('问题1', '结果1', 100)
      const deleted = cache.delete('问题1')
      expect(deleted).toBe(true)
      expect(cache.getStats().totalEntries).toBe(0)
    })

    it('应该返回false（不存在）', () => {
      const deleted = cache.delete('不存在')
      expect(deleted).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('应该清理过期条目', async () => {
      const shortCache = new ReasoningCache<string>({ ttl: 1 })
      await shortCache.store('问题1', '结果1', 100)
      await new Promise((resolve) => setTimeout(resolve, 10))
      await shortCache.query('问题1')
      expect(shortCache.getStats().totalEntries).toBe(0)
    })
  })

  describe('getEntries', () => {
    it('应该返回所有条目', async () => {
      await cache.store('问题1', '结果1', 100)
      const entries = cache.getEntries()
      expect(entries.length).toBe(1)
      expect(entries[0].problem).toBe('问题1')
    })
  })

  describe('export/import', () => {
    it('应该导出和导入缓存', async () => {
      await cache.store('问题1', '结果1', 100)
      const exported = cache.export()
      expect(exported.length).toBe(1)

      const newCache = new ReasoningCache<string>()
      newCache.import(exported)
      expect(newCache.getStats().totalEntries).toBe(1)
    })

    it('导入时应该遵守maxEntries限制', async () => {
      const smallCache = new ReasoningCache<string>({ maxEntries: 1 })
      await smallCache.store('问题1', '结果1', 100)
      const exported = smallCache.export()

      const newCache = new ReasoningCache<string>({ maxEntries: 1 })
      await newCache.store('问题2', '结果2', 100)
      newCache.import(exported)
      expect(newCache.getStats().totalEntries).toBe(1)
    })
  })

  describe('createReasoningCache', () => {
    it('应该创建缓存实例', () => {
      const c = createReasoningCache<string>()
      expect(c.getStats().totalEntries).toBe(0)
    })
  })

  describe('cosineSimilarity', () => {
    it('应该计算相同向量的余弦相似度为1', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[1, 0, 0]],
        dimension: 3,
        model: 'test',
      })

      const c = new ReasoningCache<string>({ similarityThreshold: 0.5 }, mockEmbeddingAdapter)
      await c.store('问题1', '结果1', 100)

      mockEmbed.mockResolvedValue({
        embeddings: [[1, 0, 0]],
        dimension: 3,
        model: 'test',
      })

      const result = await c.query('问题1')
      expect(result.found).toBe(true)
    })

    it('应该在维度不匹配时返回0', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [[1, 0]],
        dimension: 2,
        model: 'test',
      })

      const c = new ReasoningCache<string>({}, mockEmbeddingAdapter)
      await c.store('问题1', '结果1', 100)

      mockEmbed.mockResolvedValue({
        embeddings: [[1, 0, 0]],
        dimension: 3,
        model: 'test',
      })

      const result = await c.query('问题1')
      expect(result.found).toBe(false)
    })
  })
})
