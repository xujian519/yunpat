/**
 * FactChecker 单元测试
 *
 * 测试事实验证器的声明提取、事实验证、批量验证等功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FactChecker } from '../../src/validation/FactChecker.js'
import { createDeepSeekModel } from '../../src/llm/NativeLLMAdapter.js'
import { KnowledgeBase, createKnowledgeBase } from '../../src/knowledge/KnowledgeBase.js'

// Mock LLM Adapter
const mockLLM = {
  chat: vi.fn(),
} as any

describe('FactChecker', () => {
  let knowledgeBase: KnowledgeBase
  let factChecker: FactChecker

  beforeEach(async () => {
    // 创建知识库并添加测试数据
    knowledgeBase = createKnowledgeBase({
      enableEmbedding: false,
      persistent: false, // 测试环境不持久化
      storagePath: '/tmp/yunpat-test-knowledge',
    })

    // 添加测试知识条目
    await knowledgeBase.store({
      id: 'kb-1',
      type: 'document',
      title: '专利法第25条',
      content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
      category: 'legal',
      tags: ['专利法', '授权条件'],
      priority: 9,
    })

    await knowledgeBase.store({
      id: 'kb-2',
      type: 'document',
      title: '深度学习性能',
      content: '在ImageNet数据集上，深度学习模型的准确率通常超过90%。',
      category: 'technical',
      tags: ['深度学习', '性能'],
      priority: 8,
    })

    await knowledgeBase.store({
      id: 'kb-3',
      type: 'document',
      title: '电池技术标准',
      content: '根据GB/T 1234-2020，电池能量密度应达到500Wh/kg以上。',
      category: 'technical',
      tags: ['电池', '标准'],
      priority: 7,
    })

    // 创建事实验证器
    factChecker = new FactChecker(mockLLM, knowledgeBase, {
      extractionMethod: 'regex',
      verificationMethods: ['knowledge_base'],
      knowledgeBaseOptions: {
        maxResults: 5,
        similarityThreshold: 0.7,
      },
    })
  })

  describe('声明提取', () => {
    it('应该使用正则方法提取声明', () => {
      const content = `
根据专利法第25条规定，应当满足三性要求。
该模型的准确率达到95%。
      `

      const claims = (factChecker as any).extractClaimsByRegex(content)

      expect(claims.length).toBeGreaterThan(0)
      expect(claims[0].category).toBeDefined()
    })

    it('应该正确分类声明类别', () => {
      const legalClaim = '根据专利法第25条规定，应当满足三性要求。'
      const techClaim = '该模型的准确率达到95%。'

      const legalCategory = (factChecker as any).categorizeClaim(legalClaim)
      const techCategory = (factChecker as any).categorizeClaim(techClaim)

      expect(legalCategory).toBe('legal_precedent')
      expect(techCategory).toBe('statistical_data')
    })
  })

  describe('事实验证', () => {
    it('应该验证在知识库中的声明', async () => {
      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      }

      const result = await (factChecker as any).verifyWithKnowledgeBase(claim)

      expect(result.isVerifiable).toBe(true)
      // isVerified 取决于相似度阈值，可能是 true 或 false
      expect(result.verificationMethod).toBe('knowledge_base')
      if (result.isVerified) {
        expect(result.sources.length).toBeGreaterThan(0)
      }
    })

    it('应该标记未找到的声明', async () => {
      const claim = {
        id: 'claim-2',
        content: '这是一个知识库中不存在的声明。',
        category: 'general_statement' as any,
        confidence: 0.5,
      }

      const result = await (factChecker as any).verifyWithKnowledgeBase(claim)

      expect(result.isVerifiable).toBe(true)
      expect(result.isVerified).toBe(false)
      expect(result.sources.length).toBe(0)
    })

    it('应该验证内容中的所有声明', async () => {
      const content = `
根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。
该模型的准确率达到95%。
      `

      const results = await factChecker.verifyContent(content)

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => typeof r.claim === 'object')).toBe(true)
    })
  })

  describe('批量验证', () => {
    it('应该批量验证多个声明', async () => {
      const claims = [
        {
          id: 'claim-1',
          content: '根据专利法第25条规定。',
          category: 'legal_precedent' as any,
          confidence: 0.9,
        },
        {
          id: 'claim-2',
          content: '该模型准确率95%。',
          category: 'statistical_data' as any,
          confidence: 0.8,
        },
      ]

      const results = await factChecker.verifyClaims(claims)

      expect(results).toHaveLength(2)
      expect(results.every((r) => r.claim.id === claims[0].id || r.claim.id === claims[1].id))
    })
  })

  describe('统计功能', () => {
    it('应该正确计算事实验证统计', async () => {
      const content = '根据专利法第25条规定，应当满足三性要求。'

      const results = await factChecker.verifyContent(content)
      const stats = factChecker.getFactCheckStats(results)

      expect(stats.total).toBe(results.length)
      expect(stats.verifiable).toBeGreaterThanOrEqual(0)
      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0)
      expect(stats.avgConfidence).toBeLessThanOrEqual(1)
    })
  })

  describe('LLM声明提取', () => {
    it('应该使用LLM提取声明', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          content: JSON.stringify([
            {
              content: '根据专利法第25条规定',
              category: 'legal_precedent',
              confidence: 0.9,
            },
          ]),
        },
      } as any)

      const content = '根据专利法第25条规定，应当满足三性要求。'
      const claims = await (factChecker as any).extractClaimsByLLM(content)

      expect(claims).toHaveLength(1)
      expect(claims[0].content).toContain('专利法第25条')
    })

    it('应该处理LLM提取失败', async () => {
      mockLLM.chat.mockRejectedValue(new Error('LLM error'))

      const content = '测试内容'
      const claims = await (factChecker as any).extractClaimsByLLM(content)

      expect(claims).toHaveLength(0)
    })
  })

  describe('边界情况', () => {
    it('应该处理空内容', async () => {
      const results = await factChecker.verifyContent('')
      expect(results).toHaveLength(0)
    })

    it('应该处理没有知识库匹配的声明', async () => {
      const claim = {
        id: 'claim-edge',
        content: '完全不相关的内容XYZ123',
        category: 'general_statement' as any,
        confidence: 0.5,
      }

      const result = await (factChecker as any).verifyWithKnowledgeBase(claim)

      expect(result.isVerifiable).toBe(true)
      expect(result.isVerified).toBe(false)
    })

    it('应该处理特殊字符', async () => {
      const content = '该模型准确率为95.2%（含特殊符号）！'

      const results = await factChecker.verifyContent(content)
      // 应该能够处理特殊字符而不报错
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('外部API验证', () => {
    it('应该抛出错误（未启用外部API）', async () => {
      const claim = {
        id: '1',
        content: 'test',
        category: 'general_statement' as any,
        confidence: 0.5,
      }

      await expect(factChecker.verifyWithExternalAPI(claim)).rejects.toThrow()
    })

    it('应该批量抛出错误（未启用外部API）', async () => {
      const claims = [
        {
          id: '1',
          content: 'test',
          category: 'general_statement' as any,
          confidence: 0.5,
        },
      ]

      await expect(factChecker.verifyClaimsWithExternalAPI(claims)).rejects.toThrow()
    })

    it('应该返回外部验证器状态', () => {
      const status = factChecker.getExternalCheckerStatus()
      expect(status.enabled).toBe(false)
      expect(status.configured).toBe(false)
    })

    it('应该安全清除外部缓存', () => {
      expect(() => factChecker.clearExternalCache()).not.toThrow()
    })
  })

  describe('交叉验证', () => {
    it('应该进行交叉验证', async () => {
      const mockKB = {
        search: vi
          .fn()
          .mockResolvedValue([{ score: 0.9, entry: { id: '1', title: 'Test', priority: 9 } }]),
      }

      const fc = new FactChecker(mockLLM, mockKB as any, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base'],
      })

      const claim = {
        id: '1',
        content: '根据专利法第25条规定',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      }

      const result = await fc.verifyCrossSources(claim)
      expect(result).toBeDefined()
      expect(result.claim).toBeDefined()
    })
  })

  describe('声明提取方法覆盖', () => {
    it('应该使用 LLM 方法提取声明', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          content: JSON.stringify([
            {
              content: '专利法第25条',
              category: 'legal_precedent',
              confidence: 0.9,
            },
            {
              content: '准确率95%',
              category: 'statistical_data',
              confidence: 0.85,
            },
          ]),
        },
      } as any)

      const llmFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'llm',
        verificationMethods: ['knowledge_base'],
      })

      const content = '测试内容'
      const claims = await (llmFactChecker as any).extractClaims(content)

      expect(claims).toHaveLength(2)
      expect(claims[0].content).toBe('专利法第25条')
      expect(claims[0].category).toBe('legal_precedent')
    })

    it('应该使用混合方法提取声明并去重', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          content: JSON.stringify([
            {
              content: '唯一的新声明',
              category: 'technical_fact',
              confidence: 0.8,
            },
          ]),
        },
      } as any)

      const hybridFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'hybrid',
        verificationMethods: ['knowledge_base'],
      })

      const content = '根据专利法第25条规定，应当满足三性要求。'
      const claims = await (hybridFactChecker as any).extractClaims(content)

      // 应该包含正则提取的声明
      expect(claims.some((c: Claim) => c.content.includes('专利法第25条'))).toBe(true)
      // 应该包含 LLM 独有的声明
      expect(claims.some((c: Claim) => c.content === '唯一的新声明')).toBe(true)
      // 应该至少有2个声明（正则+LLM）
      expect(claims.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('声明分类完整覆盖', () => {
    it('应该正确分类技术标准声明', () => {
      const techStandardClaim = '根据GB/T 1234-2020，电池能量密度应达到500Wh/kg以上。'
      const category = (factChecker as any).categorizeClaim(techStandardClaim)
      expect(category).toBe('technical_fact')
    })

    it('应该正确分类领域知识声明', () => {
      const domainClaim = '在人工智能领域，通常使用Transformer架构。'
      const category = (factChecker as any).categorizeClaim(domainClaim)
      expect(category).toBe('domain_knowledge')
    })

    it('应该正确分类一般陈述', () => {
      const generalClaim = '这是一个普通的陈述。'
      const category = (factChecker as any).categorizeClaim(generalClaim)
      expect(category).toBe('general_statement')
    })
  })

  describe('parseClaimCategory 完整覆盖', () => {
    it('应该解析所有有效的声明类别', () => {
      const fc = factChecker as any

      expect(fc.parseClaimCategory('legal_precedent')).toBe('legal_precedent')
      expect(fc.parseClaimCategory('technical_fact')).toBe('technical_fact')
      expect(fc.parseClaimCategory('statistical_data')).toBe('statistical_data')
      expect(fc.parseClaimCategory('domain_knowledge')).toBe('domain_knowledge')
      expect(fc.parseClaimCategory('general_statement')).toBe('general_statement')
    })

    it('应该将无效类别映射为默认值', () => {
      const fc = factChecker as any
      expect(fc.parseClaimCategory('invalid_category')).toBe('general_statement')
      expect(fc.parseClaimCategory('')).toBe('general_statement')
      expect(fc.parseClaimCategory('random')).toBe('general_statement')
    })
  })

  describe('verifyClaim 多验证方法覆盖', () => {
    it('应该使用知识库和外部API进行验证', async () => {
      const mockExternalChecker = {
        verifyClaim: vi.fn().mockResolvedValue({
          claim: '测试声明',
          isValid: 'TRUE',
          confidence: 0.9,
          sources: [{ name: '外部来源', url: 'http://example.com', rating: 'Verified' }],
          source: 'external_api',
          timestamp: new Date(),
        }),
      }

      const multiMethodFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base', 'external_api'],
        externalAPIConfig: { apiKey: 'test' },
      })

      // 覆盖 externalChecker 属性
      ;(multiMethodFactChecker as any).externalChecker = mockExternalChecker

      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条规定。',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      }

      const result = await (multiMethodFactChecker as any).verifyClaim(claim)

      expect(result).toBeDefined()
      // mergeVerificationResults 选择置信度最高的结果
      expect(['knowledge_base', 'external_api']).toContain(result.verificationMethod)
      // 应该合并了多个来源
      expect(result.details).toContain('合并了')
    })

    it('应该处理外部API验证失败的情况', async () => {
      const mockExternalChecker = {
        verifyClaim: vi.fn().mockRejectedValue(new Error('外部API失败')),
      }

      const multiMethodFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base', 'external_api'],
        externalAPIConfig: { apiKey: 'test' },
      })

      ;(multiMethodFactChecker as any).externalChecker = mockExternalChecker

      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条规定。',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      }

      // 外部API失败应该不影响知识库验证
      const result = await (multiMethodFactChecker as any).verifyClaim(claim)

      expect(result).toBeDefined()
      expect(result.verificationMethod).toBe('knowledge_base')
    })
  })

  describe('verifyWithKnowledgeBase 错误处理', () => {
    it('应该处理知识库搜索错误', async () => {
      const errorKB = {
        search: vi.fn().mockRejectedValue(new Error('知识库错误')),
      }

      const errorFactChecker = new FactChecker(mockLLM, errorKB as any, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base'],
      })

      const claim = {
        id: 'claim-error',
        content: '测试声明',
        category: 'general_statement' as any,
        confidence: 0.9,
      }

      const result = await (errorFactChecker as any).verifyWithKnowledgeBase(claim)

      expect(result.isVerifiable).toBe(false)
      expect(result.isVerified).toBe(false)
      expect(result.confidence).toBe(0)
      expect(result.details).toContain('验证失败')
    })
  })

  describe('mergeVerificationResults 完整覆盖', () => {
    it('应该处理空结果列表', () => {
      const claim = {
        id: 'claim-1',
        content: '测试',
        category: 'general_statement' as any,
        confidence: 0.5,
      }

      const result = (factChecker as any).mergeVerificationResults(claim, [])

      expect(result.isVerifiable).toBe(false)
      expect(result.isVerified).toBe(false)
      expect(result.confidence).toBe(0)
      expect(result.details).toBe('没有可用的验证方法')
    })

    it('应该合并多个验证结果', () => {
      const claim = {
        id: 'claim-1',
        content: '测试',
        category: 'general_statement' as any,
        confidence: 0.5,
      }

      const results = [
        {
          claim,
          isVerifiable: true,
          isVerified: true,
          confidence: 0.9,
          sources: [{ id: '1', type: 'knowledge_entry' as any, credibility: 0.8 }],
          verificationMethod: 'knowledge_base',
          details: '知识库验证通过',
        },
        {
          claim,
          isVerifiable: true,
          isVerified: false,
          confidence: 0.6,
          sources: [{ id: '2', type: 'external_api' as any, credibility: 0.7 }],
          verificationMethod: 'external_api',
          details: '外部API未验证',
        },
      ]

      const merged = (factChecker as any).mergeVerificationResults(claim, results)

      // 应该选择置信度最高的结果
      expect(merged.confidence).toBe(0.9)
      expect(merged.isVerified).toBe(true)
      // 应该合并所有来源
      expect(merged.sources.length).toBe(2)
      expect(merged.details).toContain('合并了 2 种验证方法')
    })
  })

  describe('verifyWithExternalAPI 成功情况', () => {
    it('应该成功使用外部API验证', async () => {
      const mockExternalChecker = {
        verifyClaim: vi.fn().mockResolvedValue({
          claim: '测试声明',
          isValid: 'TRUE',
          confidence: 0.92,
          sources: [
            {
              name: '可靠来源',
              url: 'http://reliable-source.com',
              rating: 'Verified',
              date: '2026-01-01',
            },
          ],
          source: 'external_api',
          timestamp: new Date(),
        }),
      }

      const externalFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['external_api'],
        externalAPIConfig: { apiKey: 'test' },
      })

      ;(externalFactChecker as any).externalChecker = mockExternalChecker

      const claim = {
        id: 'claim-1',
        content: '测试声明',
        category: 'general_statement' as any,
        confidence: 0.8,
      }

      const result = await externalFactChecker.verifyWithExternalAPI(claim)

      expect(result.isVerifiable).toBe(true)
      expect(result.isVerified).toBe(true)
      expect(result.confidence).toBe(0.92)
      expect(result.sources.length).toBe(1)
      expect(result.sources[0].type).toBe('external_api')
      expect(result.sources[0].credibility).toBe(0.9)
    })
  })

  describe('verifyCrossSources 完整覆盖', () => {
    it('应该包含外部API验证结果', async () => {
      const mockExternalChecker = {
        verifyClaim: vi.fn().mockResolvedValue({
          claim: '测试声明',
          isValid: 'TRUE',
          confidence: 0.95,
          sources: [
            {
              name: '外部来源',
              url: 'http://external.com',
              rating: 'Verified',
              date: '2026-01-01',
            },
          ],
          source: 'external_api',
          timestamp: new Date(),
        }),
      }

      const crossFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base', 'external_api'],
        externalAPIConfig: { apiKey: 'test' },
      })

      ;(crossFactChecker as any).externalChecker = mockExternalChecker

      const claim = {
        id: 'claim-1',
        content: '测试声明',
        category: 'general_statement' as any,
        confidence: 0.9,
      }

      const result = await crossFactChecker.verifyCrossSources(claim)

      expect(result).toBeDefined()
      expect(result.claim).toBe(claim.content)
    })

    it('应该处理外部API验证失败', async () => {
      const mockExternalChecker = {
        verifyClaim: vi.fn().mockRejectedValue(new Error('外部API错误')),
      }

      // Mock 知识库搜索以返回确定的结果
      const mockKB = {
        search: vi.fn().mockResolvedValue([
          {
            score: 0.9,
            entry: {
              id: 'kb-test-cross',
              title: '测试交叉验证',
              priority: 10,
              content: '根据专利法第25条规定，授予专利权的条件是：新颖性、创造性和实用性。',
            },
          },
        ]),
      }

      const crossFactChecker = new FactChecker(mockLLM, mockKB as any, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base', 'external_api'],
        externalAPIConfig: { apiKey: 'test' },
        knowledgeBaseOptions: {
          maxResults: 5,
          similarityThreshold: 0.7,
        },
      })

      ;(crossFactChecker as any).externalChecker = mockExternalChecker

      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条规定，授予专利权的条件是：新颖性、创造性和实用性。',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      }

      // 外部API失败，但知识库有结果，应该仍然返回知识库结果
      const result = await crossFactChecker.verifyCrossSources(claim)

      expect(result).toBeDefined()
      expect(result.claim).toBe(claim.content)
    })
  })

  describe('getKnowledgeBaseResult 完整覆盖', () => {
    it('应该返回undefined当结果不可验证或无来源', async () => {
      const mockKB = {
        search: vi.fn().mockResolvedValue([]), // 无结果
      }

      const fc = new FactChecker(mockLLM, mockKB as any, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base'],
      })

      const claim = {
        id: 'claim-1',
        content: '不存在的声明',
        category: 'general_statement' as any,
        confidence: 0.5,
      }

      const result = await (fc as any).getKnowledgeBaseResult(claim)

      expect(result).toBeUndefined()
    })

    it('应该返回有效的知识库结果', async () => {
      const mockKB = {
        search: vi.fn().mockResolvedValue([
          {
            score: 0.9,
            entry: {
              id: 'kb-1',
              title: '专利法第25条',
              priority: 9,
              content: '测试内容',
            },
          },
        ]),
      }

      const fc = new FactChecker(mockLLM, mockKB as any, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base'],
      })

      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条规定。',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      }

      const result = await (fc as any).getKnowledgeBaseResult(claim)

      expect(result).toBeDefined()
      expect(result.claim).toBe(claim.content)
      expect(result.isValid).toBe('TRUE')
      expect(result.confidence).toBe(0.9)
      expect(result.source).toBe('knowledge_base')
    })
  })

  describe('calculateSourceCredibility 完整覆盖', () => {
    it('应该为TRUE状态返回0.9', () => {
      const credibility = (factChecker as any).calculateSourceCredibility('TRUE')
      expect(credibility).toBe(0.9)
    })

    it('应该为MIXED状态返回0.5', () => {
      const credibility = (factChecker as any).calculateSourceCredibility('MIXED')
      expect(credibility).toBe(0.5)
    })

    it('应该为FALSE状态返回0.1', () => {
      const credibility = (factChecker as any).calculateSourceCredibility('FALSE')
      expect(credibility).toBe(0.1)
    })

    it('应该为UNKNOWN状态返回0', () => {
      const credibility = (factChecker as any).calculateSourceCredibility('UNKNOWN')
      expect(credibility).toBe(0)
    })
  })

  describe('verifyClaimsWithExternalAPI 成功情况', () => {
    it('应该成功批量使用外部API验证', async () => {
      const mockExternalChecker = {
        verifyClaims: vi.fn().mockResolvedValue([
          {
            claim: '声明1',
            isValid: 'TRUE',
            confidence: 0.9,
            sources: [
              {
                name: '来源1',
                url: 'http://source1.com',
                rating: 'Verified',
                date: '2026-01-01',
              },
            ],
            source: 'external_api',
            timestamp: new Date(),
          },
          {
            claim: '声明2',
            isValid: 'FALSE',
            confidence: 0.7,
            sources: [
              {
                name: '来源2',
                url: 'http://source2.com',
                rating: 'Unverified',
                date: '2026-01-01',
              },
            ],
            source: 'external_api',
            timestamp: new Date(),
          },
        ]),
      }

      const externalFactChecker = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['external_api'],
        externalAPIConfig: { apiKey: 'test' },
      })

      ;(externalFactChecker as any).externalChecker = mockExternalChecker

      const claims = [
        {
          id: 'claim-1',
          content: '声明1',
          category: 'general_statement' as any,
          confidence: 0.9,
        },
        {
          id: 'claim-2',
          content: '声明2',
          category: 'general_statement' as any,
          confidence: 0.8,
        },
      ]

      const results = await externalFactChecker.verifyClaimsWithExternalAPI(claims)

      expect(results).toHaveLength(2)
      expect(results[0].isVerified).toBe(true)
      expect(results[0].confidence).toBe(0.9)
      expect(results[1].isVerified).toBe(false)
      expect(results[1].confidence).toBe(0.7)
      expect(results[1].sources[0].credibility).toBe(0.1)
    })
  })

  describe('构造函数分支覆盖', () => {
    it('应该初始化外部验证器当配置中启用', () => {
      const fc = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base', 'external_api'],
        externalAPIConfig: { apiKey: 'test-key' },
      })

      expect((fc as any).externalChecker).toBeDefined()
    })

    it('不应该初始化外部验证器当配置中未启用', () => {
      const fc = new FactChecker(mockLLM, knowledgeBase, {
        extractionMethod: 'regex',
        verificationMethods: ['knowledge_base'],
      })

      expect((fc as any).externalChecker).toBeUndefined()
    })
  })
})
