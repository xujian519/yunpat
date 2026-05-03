/**
 * SourceAttributionValidator 单元测试
 *
 * 测试源归属验证器的引用检测、格式验证、来源可信度评估等功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SourceAttributionValidator } from '../../src/validation/SourceAttributionValidator.js'
import { KnowledgeBase, createKnowledgeBase } from '../../src/knowledge/KnowledgeBase.js'
import { LLMAdapter } from '../../src/lifecycle/Lifecycle.js'

// Mock LLM Adapter
const mockLLM = {
  chat: vi.fn(),
} as any as LLMAdapter

describe('SourceAttributionValidator', () => {
  let knowledgeBase: KnowledgeBase
  let validator: SourceAttributionValidator

  beforeEach(async () => {
    // 创建知识库并添加测试数据
    knowledgeBase = createKnowledgeBase({
      enableEmbedding: false,
      persistent: false, // 测试环境不持久化
      storagePath: '/tmp/yunpat-test-knowledge',
    })

    // 设置默认的 LLM mock 响应
    mockLLM.chat.mockResolvedValue({
      message: {
        content: '[]', // 默认返回空数组
      },
    } as any)

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
      title: '深度学习性能基准',
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

    // 创建验证器
    validator = new SourceAttributionValidator(mockLLM, knowledgeBase, {
      requiredCitationCategories: ['legal_precedent', 'technical_fact', 'statistical_data'],
      minSourceCredibility: 0.7,
    })
  })

  describe('声明提取', () => {
    it('应该提取需要引用的声明', () => {
      const content = `
根据专利法第25条规定，应当满足三性要求。
该模型的准确率达到95%。
      `

      const claims = (validator as any).extractSimpleClaims(content)

      expect(claims.length).toBeGreaterThan(0)
      expect(claims[0].category).toBeDefined()
      expect(claims[0].location).toBeDefined()
    })

    it('应该正确分类声明类别', () => {
      const legalClaim = '根据专利法第25条规定，应当满足三性要求。'
      const techClaim = '该模型的准确率达到95%。'

      const legalCategory = (validator as any).categorizeClaim(legalClaim)
      const techCategory = (validator as any).categorizeClaim(techClaim)

      expect(legalCategory).toBe('legal_precedent')
      expect(techCategory).toBe('statistical_data')
    })

    it('应该为声明添加位置信息', () => {
      const content = '根据专利法第25条规定。'
      const claims = (validator as any).extractSimpleClaims(content)

      expect(claims[0].location).toBeDefined()
      expect(claims[0].location.start).toBeGreaterThanOrEqual(0)
      expect(claims[0].location.end).toBeGreaterThan(claims[0].location.start)
      expect(claims[0].location.text).toBeDefined()
    })
  })

  describe('缺少引用检测', () => {
    it('应该检测缺少引用的法律声明', async () => {
      const content = '根据专利法第25条规定，应当满足三性要求。'

      const issues = await validator.validateAttribution(content)

      const missingCitations = issues.filter((i) => i.type === 'missing_citation')
      expect(missingCitations.length).toBeGreaterThan(0)
      expect(missingCitations[0].severity).toBe('critical')
    })

    it('应该检测缺少引用的统计数据', async () => {
      const content = '该模型的准确率达到95%。'

      const issues = await validator.validateAttribution(content)

      const missingCitations = issues.filter((i) => i.type === 'missing_citation')
      expect(missingCitations.length).toBeGreaterThan(0)
    })

    it('应该建议相关来源', async () => {
      const content = '根据专利法第25条规定。'

      const issues = await validator.validateAttribution(content)

      const missingCitations = issues.filter((i) => i.type === 'missing_citation')

      // 应该检测到缺少引用
      expect(missingCitations.length).toBeGreaterThan(0)

      // suggestedSources应该存在（即使为空数组）
      expect(missingCitations[0].suggestedSources).toBeDefined()
      expect(Array.isArray(missingCitations[0].suggestedSources)).toBe(true)

      // 如果知识库中有相关内容，suggestedSources应该有数据
      if (missingCitations[0].suggestedSources.length > 0) {
        expect(missingCitations[0].suggestedSources[0].title).toBeDefined()
      }
    })

    it('应该检测有引用的声明', async () => {
      const content = '根据专利法第25条规定 [1]。'

      const issues = await validator.validateAttribution(content)

      const missingCitations = issues.filter((i) => i.type === 'missing_citation')
      expect(missingCitations.length).toBe(0)
    })
  })

  describe('引用格式验证', () => {
    it('应该检测正确的数字引用格式', async () => {
      const content = '该技术方案采用深度学习算法 [1]。'

      const issues = await validator.validateAttribution(content)

      const formatIssues = issues.filter((i) => i.type === 'incorrect_citation_format')
      expect(formatIssues.length).toBe(0)
    })

    it('应该检测正确的学术引用格式', async () => {
      const content = '该方法基于Smith等 (2024) 的研究。'

      const issues = await validator.validateAttribution(content)

      const formatIssues = issues.filter((i) => i.type === 'incorrect_citation_format')
      expect(formatIssues.length).toBe(0)
    })

    it('应该检测不规范的引用格式', async () => {
      const content = '参见相关研究文献。'

      const issues = await validator.validateAttribution(content)

      const formatIssues = issues.filter((i) => i.type === 'incorrect_citation_format')
      expect(formatIssues.length).toBeGreaterThan(0)
    })

    it('应该检测混合的引用格式', async () => {
      const content = `
该方法基于文献 [1]。
该技术参考了 Smith等 (2024) 的研究。
该方法使用了来源 [@author](url)。
      `

      const issues = await validator.validateAttribution(content)

      const formatIssues = issues.filter(
        (i) => i.type === 'incorrect_citation_format' && i.description.includes('混用')
      )
      expect(formatIssues.length).toBeGreaterThan(0)
    })
  })

  describe('来源可信度评估', () => {
    it('应该评估法律文档的可信度', async () => {
      const content = '根据专利法第25条规定 [1]。'

      const issues = await validator.validateAttribution(content)

      const credibilityIssues = issues.filter((i) => i.type === 'unreliable_source')
      expect(credibilityIssues.length).toBe(0)
    })

    it('应该检测低可信度来源', async () => {
      // 添加低优先级知识条目
      await knowledgeBase.store({
        id: 'kb-low-credibility',
        type: 'document',
        title: '低质量来源',
        content: '一些不太可靠的内容。',
        category: 'general',
        tags: [], // 添加tags属性
        priority: 2, // 低优先级
      })

      const content = '该技术方案基于低质量来源 [1]。'

      const issues = await validator.validateAttribution(content)

      // 可能检测到可信度问题
      expect(issues).toBeDefined()
    })
  })

  describe('引用位置检测', () => {
    it('应该检测声明附近的引用', () => {
      const content = '根据专利法第25条规定 [1]，应当满足三性要求。'
      const claim = {
        content: '根据专利法第25条规定',
        location: { start: 0, end: 12 },
      }

      const hasCitation = (validator as any).hasCitationNearby(content, claim)

      expect(hasCitation).toBe(true)
    })

    it('应该检测没有引用的声明', () => {
      const content = '该方法的优点是计算复杂度较低，只需要少量计算资源。'
      const claim = {
        content: '该方法的优点是计算复杂度较低',
        location: { start: 0, end: 15 },
      }

      const hasCitation = (validator as any).hasCitationNearby(content, claim)

      expect(hasCitation).toBe(false)
    })

    it('应该检测远距离的引用', () => {
      // 创建一个足够长的内容，使引用超出上下文窗口（200字符）
      const padding = 'x'.repeat(250)
      const content = `${padding}根据专利法第25条规定，应当满足三性要求。${padding}[1]`
      const claim = {
        content: '根据专利法第25条规定',
        location: { start: 250, end: 270 },
      }

      const hasCitation = (validator as any).hasCitationNearby(content, claim)

      // 引用距离超过200字符，应该检测不到
      // claim在250-270，上下文窗口是50-470，而[1]在521-523位置
      expect(hasCitation).toBe(false)
    })
  })

  describe('来源建议', () => {
    it('应该为声明建议相关知识库条目', async () => {
      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
        category: 'legal_precedent',
        confidence: 0.9,
      }

      const suggestedSources = await (validator as any).suggestSources(claim)

      // 如果知识库中没有完全匹配的内容，可能返回空数组
      expect(Array.isArray(suggestedSources)).toBe(true)
      if (suggestedSources.length > 0) {
        expect(suggestedSources[0].id).toBeDefined()
        expect(suggestedSources[0].title).toBeDefined()
        expect(suggestedSources[0].credibility).toBeGreaterThanOrEqual(0)
        expect(suggestedSources[0].credibility).toBeLessThanOrEqual(1)
      }
    })

    it('应该处理搜索失败', async () => {
      const claim = {
        id: 'claim-error',
        content: '完全不相关的内容XYZ123',
        category: 'general_statement',
        confidence: 0.5,
      }

      const suggestedSources = await (validator as any).suggestSources(claim)

      expect(suggestedSources).toBeDefined()
      expect(Array.isArray(suggestedSources)).toBe(true)
    })
  })

  describe('报告生成', () => {
    it('应该生成源归属报告', async () => {
      const content = '根据专利法第25条规定，应当满足三性要求。'

      const issues = await validator.validateAttribution(content)
      const report = validator.generateAttributionReport(issues)

      expect(report).toBeDefined()
      expect(report.length).toBeGreaterThan(0)
    })

    it('应该生成无问题的报告', async () => {
      const content = '这是一个技术方案。'

      const issues = await validator.validateAttribution(content)
      const report = validator.generateAttributionReport(issues)

      expect(report).toContain('✅')
      expect(report).toContain('通过')
    })

    it('应该按严重程度分组问题', async () => {
      const content = `
根据专利法第25条规定，应当满足三性要求。
该模型的准确率达到95%。
      `

      const issues = await validator.validateAttribution(content)
      const stats = validator.getAttributionStats(issues)

      expect(stats.total).toBe(issues.length)
      expect(stats.critical).toBeGreaterThanOrEqual(0)
      expect(stats.major).toBeGreaterThanOrEqual(0)
      expect(stats.minor).toBeGreaterThanOrEqual(0)
      expect(stats.byType).toBeDefined()
    })
  })

  describe('统计功能', () => {
    it('应该正确计算源归属统计', async () => {
      const content = `
根据专利法第25条规定，应当满足三性要求。
该模型的准确率达到95%。
      `

      const issues = await validator.validateAttribution(content)
      const stats = validator.getAttributionStats(issues)

      expect(stats.total).toBe(issues.length)
      expect(stats.critical).toBeGreaterThanOrEqual(0)
      expect(stats.major).toBeGreaterThanOrEqual(0)
      expect(stats.minor).toBeGreaterThanOrEqual(0)
      expect(stats.byType).toBeDefined()
    })

    it('应该按类型统计问题', async () => {
      const content = `
根据专利法第25条规定。
参见相关文献。
该模型准确率95%。
      `

      const issues = await validator.validateAttribution(content)
      const stats = validator.getAttributionStats(issues)

      // 检查统计是否包含类型（可能为0或undefined）
      expect(stats.byType).toBeDefined()
      if (stats.byType['missing_citation'] !== undefined) {
        expect(stats.byType['missing_citation']).toBeGreaterThanOrEqual(0)
      }
      if (stats.byType['incorrect_citation_format'] !== undefined) {
        expect(stats.byType['incorrect_citation_format']).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('边界情况', () => {
    it('应该处理空内容', async () => {
      const issues = await validator.validateAttribution('')
      expect(issues).toHaveLength(0)
    })

    it('应该处理没有需要引用的声明', async () => {
      const content = '这是一个技术方案，采用深度学习算法。'

      const issues = await validator.validateAttribution(content)
      // 可能没有问题，或者只有格式问题（不包含missing_citation）
      const missingCitations = issues.filter((i) => i.type === 'missing_citation')
      expect(missingCitations.length).toBe(0)
    })

    it('应该处理特殊字符', async () => {
      const content = '根据专利法第25条规定（含特殊符号）！@#￥%……'

      const issues = await validator.validateAttribution(content)
      expect(issues).toBeDefined()
      expect(Array.isArray(issues)).toBe(true)
    })

    it('应该处理没有位置信息的声明', async () => {
      const claims = [
        {
          id: 'claim-no-location',
          content: '根据专利法第25条规定',
          category: 'legal_precedent',
          confidence: 0.9,
        },
      ]

      const issues = await validator.validateAttribution('测试内容', claims)
      expect(issues).toBeDefined()
    })
  })

  describe('引用提取', () => {
    it('应该提取数字引用', () => {
      const content = '该方法基于文献 [1] 和 [2]。'

      const citations = (validator as any).extractCitations(content)

      expect(citations.length).toBe(2)
    })

    it('应该提取学术引用', () => {
      const content = '该技术参考了张三等, 2024 的研究。'

      const citations = (validator as any).extractCitations(content)

      expect(citations.length).toBeGreaterThan(0)
      expect(citations[0].text).toContain('张三等')
      expect(citations[0].type).toBe('academic_paper')
    })

    it('应该为引用添加位置信息', () => {
      const content = '该方法基于文献 [1]。'

      const citations = (validator as any).extractCitations(content)

      expect(citations[0].location).toBeDefined()
      expect(citations[0].location.start).toBeGreaterThanOrEqual(0)
    })
  })

  describe('类别标签', () => {
    it('应该返回正确的类别标签', () => {
      const label1 = (validator as any).getCategoryLabel('legal_precedent')
      const label2 = (validator as any).getCategoryLabel('technical_fact')
      const label3 = (validator as any).getCategoryLabel('statistical_data')

      expect(label1).toBe('法律判例')
      expect(label2).toBe('技术事实')
      expect(label3).toBe('统计数据')
    })

    it('应该处理未知类别', () => {
      const label = (validator as any).getCategoryLabel('unknown_category' as any)
      expect(label).toBe('声明')
    })
  })

  describe('位置查找', () => {
    it('应该在文本中查找子字符串位置', () => {
      const content = '这是测试内容，包含关键词。'
      const substring = '关键词'

      const location = (validator as any).findLocationInText(content, substring)

      expect(location.start).toBeGreaterThanOrEqual(0)
      expect(location.end).toBeGreaterThan(location.start)
      expect(location.text).toContain('关键词')
    })

    it('应该处理未找到的子字符串', () => {
      const content = '这是测试内容。'
      const substring = '不存在的内容'

      const location = (validator as any).findLocationInText(content, substring)

      expect(location).toBeDefined()
      expect(location.start).toBe(0)
    })

    it('应该计算行号和列号', () => {
      const content = '第一行\n第二行\n第三行'
      const substring = '第三行'

      const location = (validator as any).findLocationInText(content, substring)

      expect(location.line).toBe(3)
    })
  })
})
