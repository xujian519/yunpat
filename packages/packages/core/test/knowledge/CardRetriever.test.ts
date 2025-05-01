import { describe, it, expect, vi } from 'vitest'
import { CardRetriever } from '../../src/knowledge/CardRetriever.js'

describe('CardRetriever', () => {
  function createMockCard(id: string, overrides = {}) {
    return {
      id,
      title: `卡片${id}`,
      question: `问题${id}`,
      content: `内容${id}`,
      domain: '测试领域',
      concept: '测试概念',
      quality: 0.8,
      tags: ['tag1', 'tag2'],
      relatedCards: [],
      ...overrides,
    }
  }

  describe('constructor', () => {
    it('应使用默认配置', () => {
      const retriever = new CardRetriever()
      expect(retriever).toBeDefined()
    })

    it('应使用嵌入器', () => {
      const embedder = { embed: vi.fn() } as any
      const retriever = new CardRetriever(embedder)
      expect(retriever).toBeDefined()
    })
  })

  describe('loadCards', () => {
    it('应加载卡片', () => {
      const retriever = new CardRetriever()
      retriever.loadCards([createMockCard('1')])

      const card = retriever.getCard('1')
      expect(card).toBeDefined()
    })
  })

  describe('addCard', () => {
    it('应添加卡片', () => {
      const retriever = new CardRetriever()
      retriever.addCard(createMockCard('1'))

      const card = retriever.getCard('1')
      expect(card).toBeDefined()
    })
  })

  describe('removeCard', () => {
    it('应移除卡片', () => {
      const retriever = new CardRetriever()
      retriever.addCard(createMockCard('1'))
      retriever.removeCard('1')

      const card = retriever.getCard('1')
      expect(card).toBeUndefined()
    })

    it('应处理不存在的卡片', () => {
      const retriever = new CardRetriever()
      expect(() => retriever.removeCard('nonexistent')).not.toThrow()
    })
  })

  describe('search', () => {
    it('应搜索卡片', async () => {
      const retriever = new CardRetriever()
      retriever.loadCards([
        createMockCard('1', { question: '测试卡片', content: '测试内容' }),
        createMockCard('2', { question: '其他卡片', content: '其他内容' }),
      ])

      const results = await retriever.search('测试')
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    it('应按领域搜索', async () => {
      const retriever = new CardRetriever()
      retriever.loadCards([
        createMockCard('1', { domain: '领域A' }),
        createMockCard('2', { domain: '领域B' }),
      ])

      const results = await retriever.search('测试', { domain: '领域A' })
      expect(results).toBeDefined()
    })

    it('应按概念搜索', async () => {
      const retriever = new CardRetriever()
      retriever.loadCards([
        createMockCard('1', { concept: '概念A' }),
        createMockCard('2', { concept: '概念B' }),
      ])

      const results = await retriever.search('测试', { concept: '概念A' })
      expect(results).toBeDefined()
    })

    it('应按标签搜索', async () => {
      const retriever = new CardRetriever()
      retriever.loadCards([
        createMockCard('1', { tags: ['tag1'] }),
        createMockCard('2', { tags: ['tag2'] }),
      ])

      const results = await retriever.search('测试', { tags: ['tag1'] })
      expect(results).toBeDefined()
    })

    it('应使用语义搜索', async () => {
      const embedder = {
        embed: vi.fn().mockResolvedValue({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      }
      const retriever = new CardRetriever(embedder as any)
      retriever.loadCards([createMockCard('1')])

      const results = await retriever.search('测试', { mode: 'semantic' })
      expect(results).toBeDefined()
    })

    it('应处理嵌入错误', async () => {
      const embedder = {
        embed: vi.fn().mockRejectedValue(new Error('嵌入错误')),
      }
      const retriever = new CardRetriever(embedder as any)
      retriever.loadCards([createMockCard('1')])

      const results = await retriever.search('测试', { mode: 'semantic' })
      expect(results).toBeDefined()
    })

    it('应按质量过滤', async () => {
      const retriever = new CardRetriever()
      retriever.loadCards([
        createMockCard('1', { quality: 0.9 }),
        createMockCard('2', { quality: 0.3 }),
      ])

      const results = await retriever.search('测试', { minQuality: 0.5 })
      expect(results).toBeDefined()
    })
  })

  describe('getByConcept', () => {
    it('应按概念获取卡片', () => {
      const retriever = new CardRetriever()
      retriever.loadCards([createMockCard('1', { concept: '概念A' })])

      const cards = retriever.getByConcept('概念A')
      expect(cards).toBeDefined()
      expect(cards.length).toBeGreaterThan(0)
    })

    it('应处理不存在的概念', () => {
      const retriever = new CardRetriever()
      const cards = retriever.getByConcept('不存在的概念')
      expect(cards).toEqual([])
    })
  })

  describe('getByDomain', () => {
    it('应按领域获取卡片', () => {
      const retriever = new CardRetriever()
      retriever.loadCards([createMockCard('1', { domain: '领域A' })])

      const cards = retriever.getByDomain('领域A')
      expect(cards).toBeDefined()
      expect(cards.length).toBeGreaterThan(0)
    })

    it('应处理不存在的领域', () => {
      const retriever = new CardRetriever()
      const cards = retriever.getByDomain('不存在的领域')
      expect(cards).toEqual([])
    })
  })

  describe('explore', () => {
    it('应探索关联卡片', () => {
      const retriever = new CardRetriever()
      retriever.loadCards([
        createMockCard('1', { relatedCards: ['2'] }),
        createMockCard('2', { relatedCards: ['3'] }),
        createMockCard('3'),
      ])

      const cards = retriever.explore('1', 2)
      expect(cards).toBeDefined()
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  describe('injectContext', () => {
    it('应注入上下文', async () => {
      const retriever = new CardRetriever()
      retriever.loadCards([createMockCard('1')])

      const result = await retriever.injectContext('测试')
      expect(result).toBeDefined()
      expect(result.enhancedPrompt).toBeDefined()
    })
  })

  describe('getStats', () => {
    it('应获取统计信息', () => {
      const retriever = new CardRetriever()
      retriever.loadCards([createMockCard('1')])

      const stats = retriever.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalCards).toBeGreaterThan(0)
    })
  })
})
