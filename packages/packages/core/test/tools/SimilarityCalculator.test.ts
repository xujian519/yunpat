import { describe, it, expect } from 'vitest'
import { SimilarityCalculator, similarityCalculator } from '../../src/tools/SimilarityCalculator.js'

describe('SimilarityCalculator', () => {
  let calc: SimilarityCalculator

  beforeEach(() => {
    calc = new SimilarityCalculator()
  })

  describe('calculateSimilarity', () => {
    it('应该计算Jaccard相似度', () => {
      const sim = calc.calculateSimilarity('hello world', 'hello there', 'jaccard')
      expect(sim).toBeGreaterThan(0)
      expect(sim).toBeLessThanOrEqual(1)
    })

    it('应该计算完全相同的文本', () => {
      const sim = calc.calculateSimilarity('same text', 'same text', 'jaccard')
      expect(sim).toBe(1)
    })

    it('应该计算完全不同的文本', () => {
      const sim = calc.calculateSimilarity('abc', 'xyz', 'jaccard')
      expect(sim).toBe(0)
    })

    it('应该计算空文本', () => {
      const sim = calc.calculateSimilarity('', '', 'jaccard')
      expect(sim).toBe(1)
    })

    it('应该计算Cosine相似度', () => {
      const sim = calc.calculateSimilarity('hello world', 'hello there', 'cosine')
      expect(sim).toBeGreaterThan(0)
      expect(sim).toBeLessThanOrEqual(1)
    })

    it('应该计算Levenshtein相似度', () => {
      const sim = calc.calculateSimilarity('hello', 'hallo', 'levenshtein')
      expect(sim).toBeGreaterThan(0)
      expect(sim).toBeLessThanOrEqual(1)
    })

    it('应该使用默认算法', () => {
      const sim = calc.calculateSimilarity('a b c', 'a b d')
      expect(sim).toBeGreaterThan(0)
    })

    it('应该使用缓存', () => {
      calc.calculateSimilarity('test', 'test', 'jaccard')
      calc.calculateSimilarity('test', 'test', 'jaccard')
      const stats = calc.getCacheStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })
  })

  describe('tokenize', () => {
    it('应该分词英文', () => {
      const sim = calc.calculateSimilarity('hello world', 'hello')
      expect(sim).toBeGreaterThan(0)
    })

    it('应该分词中文（2-gram）', () => {
      const sim = calc.calculateSimilarity('中华人民共和国', '中华人民')
      expect(sim).toBeGreaterThan(0)
    })

    it('应该处理混合文本', () => {
      const sim = calc.calculateSimilarity('hello 世界', 'hello 世界')
      expect(sim).toBe(1)
    })

    it('应该处理标点符号', () => {
      const sim = calc.calculateSimilarity('hello, world!', 'hello world')
      expect(sim).toBeGreaterThan(0)
    })
  })

  describe('cache', () => {
    it('应该清除缓存', () => {
      calc.calculateSimilarity('a', 'b')
      calc.clearCache()
      const stats = calc.getCacheStats()
      expect(stats.size).toBe(0)
      expect(stats.hits).toBe(0)
    })

    it('应该在缓存满时清除', () => {
      for (let i = 0; i < 1002; i++) {
        calc.calculateSimilarity(`text${i}`, `other${i}`)
      }
      const stats = calc.getCacheStats()
      expect(stats.size).toBeLessThanOrEqual(1000)
    })
  })

  describe('calculateBatchSimilarities', () => {
    it('应该批量计算Jaccard', () => {
      const results = calc.calculateBatchSimilarities(
        'hello',
        ['hello', 'world', 'hello world'],
        'jaccard'
      )
      expect(results).toHaveLength(3)
      expect(results[0].similarity).toBe(1)
    })

    it('应该批量计算Cosine', () => {
      const results = calc.calculateBatchSimilarities('hello world', ['hello', 'world'], 'cosine')
      expect(results).toHaveLength(2)
      expect(results[0].similarity).toBeGreaterThan(0)
    })

    it('应该批量计算Levenshtein', () => {
      const results = calc.calculateBatchSimilarities('hello', ['hallo', 'world'], 'levenshtein')
      expect(results).toHaveLength(2)
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity)
    })
  })

  describe('findMostSimilar', () => {
    it('应该找到最相似的', () => {
      const result = calc.findMostSimilar('hello', ['world', 'hello', 'help'], 'jaccard')
      expect(result).not.toBeNull()
      expect(result!.text).toBe('hello')
      expect(result!.similarity).toBe(1)
    })

    it('应该返回null（无匹配）', () => {
      const result = calc.findMostSimilar('hello', ['world', 'abc'], 'jaccard', 0.9)
      expect(result).toBeNull()
    })

    it('应该使用默认阈值', () => {
      const result = calc.findMostSimilar('hello', ['world'], 'jaccard')
      expect(result).not.toBeNull()
    })
  })

  describe('singleton', () => {
    it('应该存在单例', () => {
      expect(similarityCalculator).toBeDefined()
    })
  })
})
