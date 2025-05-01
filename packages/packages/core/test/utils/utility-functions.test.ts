import { describe, it, expect } from 'vitest'
import { generateCardId, cardToMarkdown } from '../../src/knowledge/KnowledgeCard.js'
import {
  getSourceWeight,
  calculateConsensus,
  aggregateResults,
} from '../../src/validation/ExternalFactChecker.js'

describe('Utility Functions', () => {
  describe('KnowledgeCard', () => {
    it('应该生成卡片ID', () => {
      const id = generateCardId('问题', '概念')
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('应该转换卡片为Markdown', () => {
      const md = cardToMarkdown({
        id: 'test',
        question: '问题',
        answer: '答案',
        content: '内容',
        category: '测试',
        concept: '概念',
        domain: '领域',
        quality: 0.95,
        sourcePages: ['page1'],
        relatedCards: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        tags: ['tag1'],
      })
      expect(md).toContain('问题')
      expect(md).toContain('内容')
    })
  })

  describe('ExternalFactChecker', () => {
    it('应该获取来源权重', () => {
      expect(getSourceWeight('google_factcheck')).toBeGreaterThan(0)
      expect(getSourceWeight('unknown')).toBeGreaterThan(0)
    })

    it('应该计算共识', () => {
      const result = calculateConsensus([
        {
          isValid: 'TRUE',
          confidence: 0.9,
          source: 'a',
          claim: 'c1',
          sources: [],
          timestamp: new Date(),
        },
        {
          isValid: 'TRUE',
          confidence: 0.8,
          source: 'b',
          claim: 'c2',
          sources: [],
          timestamp: new Date(),
        },
      ])
      expect(result).toBe('CONSENSUS_TRUE')
    })

    it('应该聚合结果', () => {
      const result = aggregateResults([
        {
          claim: '声明',
          isValid: 'TRUE',
          confidence: 0.9,
          sources: [],
          source: 'a',
          timestamp: new Date(),
        },
      ])
      expect(result.claim).toBe('声明')
      expect(result.consensus).toBe('CONSENSUS_TRUE')
    })
  })
})
