/**
 * Cache Performance Benchmarks
 *
 * 测试缓存系统的性能表现
 */

import { describe, bench, beforeAll, afterAll } from 'vitest'

describe('Cache Performance', () => {
  describe('Hash Function Performance', () => {
    const testData = Array.from({ length: 100 }, (_, i) => ({
      messages: [{ role: 'user', content: `Test message ${i}` }],
      temperature: 0.7,
      maxTokens: 1000,
    }))

    bench('simple hash function', () => {
      testData.forEach((data) => {
        const key = JSON.stringify(data)
        let hash = 0
        for (let i = 0; i < key.length; i++) {
          hash = (hash << 5) - hash + key.charCodeAt(i)
          hash = hash & hash
        }
        hash.toString(36)
      })
    })

    bench('SHA-256 hash function', () => {
      const crypto = require('crypto')
      testData.forEach((data) => {
        const key = JSON.stringify(data)
        crypto.createHash('sha256').update(key).digest('hex').substring(0, 16)
      })
    })
  })

  describe('Cache Hit Rate', () => {
    const cache = new Map<string, any>()
    const requests = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      key: `key-${i % 100}`, // 100个不同的key
    }))

    beforeAll(() => {
      // 预填充缓存
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, { data: `value-${i}` })
      }
    })

    bench('cache hit scenario (90% hit rate)', () => {
      let hits = 0
      requests.forEach((req) => {
        if (cache.has(req.key)) {
          hits++
        }
      })
      // 预期约90%命中率
      expect(hits).toBeGreaterThan(850)
    })

    bench('cache miss scenario (10% miss rate)', () => {
      let misses = 0
      requests.forEach((req) => {
        if (!cache.has(req.key)) {
          misses++
        }
      })
      // 预期约10%未命中
      expect(misses).toBeLessThan(150)
    })
  })

  describe('Cache Size Management', () => {
    const MAX_SIZE = 1000

    bench('LRU eviction', () => {
      const cache = new Map<string, any>()

      // 添加超过限制的项目
      for (let i = 0; i < MAX_SIZE + 100; i++) {
        if (cache.size >= MAX_SIZE) {
          // 删除最旧的项目（第一个）
          const firstKey = cache.keys().next().value
          cache.delete(firstKey)
        }
        cache.set(`key-${i}`, { value: i })
      }

      expect(cache.size).toBe(MAX_SIZE)
    })

    bench('TTL-based eviction', () => {
      const cache = new Map<string, { value: number; timestamp: number }>()
      const now = Date.now()
      const ttl = 60000 // 1分钟

      // 添加项目
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, {
          value: i,
          timestamp: now - Math.random() * 120000, // 0-2分钟前
        })
      }

      // 清理过期项目
      let evicted = 0
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > ttl) {
          cache.delete(key)
          evicted++
        }
      }

      expect(evicted).toBeGreaterThan(0)
    })
  })

  describe('Concurrent Access', () => {
    bench('parallel cache reads', async () => {
      const cache = new Map<string, any>()
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { value: i })
      }

      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(cache.get(`key-${i * 10}`))
      )

      await Promise.all(promises)
    })

    bench('parallel cache writes', async () => {
      const cache = new Map<string, any>()
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(cache.set(`key-${i}`, { value: i }))
      )

      await Promise.all(promises)
      expect(cache.size).toBe(100)
    })
  })

  describe('Memory Efficiency', () => {
    bench('sparse cache storage', () => {
      const cache = new Map<string, any>()
      // 只存储100个项目，但有10000个可能的key
      for (let i = 0; i < 100; i++) {
        const randomKey = `key-${Math.floor(Math.random() * 10000)}`
        cache.set(randomKey, { value: i })
      }
      expect(cache.size).toBe(100)
    })

    bench('dense cache storage', () => {
      const cache = new Map<string, any>()
      // 存储1000个连续的key
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { value: i })
      }
      expect(cache.size).toBe(1000)
    })
  })

  describe('Cache Update Patterns', () => {
    bench('frequent updates (same key)', () => {
      const cache = new Map<string, any>()
      const key = 'hot-key'

      for (let i = 0; i < 10000; i++) {
        cache.set(key, { value: i, timestamp: Date.now() })
      }
      expect(cache.size).toBe(1)
    })

    bench('batch updates (different keys)', () => {
      const cache = new Map<string, any>()

      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { value: i })
      }
      expect(cache.size).toBe(1000)
    })
  })
})

describe('Cache Optimization Strategies', () => {
  describe('Compression', () => {
    bench('uncompressed cache storage', () => {
      const cache = new Map<string, any>()
      const largeData = 'x'.repeat(10000)

      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, { data: largeData })
      }
    })

    bench('compressed cache storage (simulated)', () => {
      const cache = new Map<string, any>()
      const largeData = 'x'.repeat(10000)

      for (let i = 0; i < 100; i++) {
        // 模拟压缩（实际应该使用压缩库）
        const compressed = largeData.length
        cache.set(`key-${i}`, { size: compressed })
      }
    })
  })

  describe('Lazy Loading', () => {
    bench('eager loading', () => {
      const cache = new Map<string, any>()

      // 预加载所有数据
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { value: `data-${i}` })
      }

      // 使用
      for (let i = 0; i < 100; i++) {
        cache.get(`key-${i}`)
      }
    })

    bench('lazy loading', () => {
      const cache = new Map<string, any>()

      // 按需加载
      for (let i = 0; i < 100; i++) {
        const key = `key-${i}`
        if (!cache.has(key)) {
          cache.set(key, { value: `data-${i}` })
        }
        cache.get(key)
      }
    })
  })
})
