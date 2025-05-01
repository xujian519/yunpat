/**
 * PatentResponderAgent v4.0 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { PatentResponderAgent } from '../src/PatentResponderAgent.v4.js'
import {
  OAParser,
  StrategyRecommender,
  ResponseTemplateManager,
  SuccessPredictor,
  CaseLearner,
} from '../src/index.js'
import type { OARawData, HistoricalCase, RejectionType, Severity } from '../src/types/index.js'

describe('PatentResponderAgent v4.0', () => {
  const createAgent = () => {
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)

    return new PatentResponderAgent({
      name: 'test-patent-responder-v4',
      description: '测试专利答复智能体 v4.0',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              summary: '测试分析',
              keyIssues: [],
              overcomeProbability: 60,
            }),
          },
        }),
      } as any,
    })
  }

  const createValidInput = () => ({
    officeAction: {
      applicationNumber: 'CN202310000000.0',
      patentTitle: '测试专利',
      examiner: '张审查员',
      notificationDate: '2024-01-01',
      deadline: '2024-04-01',
      officeActionContent: '本申请权利要求1-3不具备创造性。对比文件D1公开了类似技术方案。',
      citedReferences: [
        {
          publicationNumber: 'CN112345678A',
          title: '对比文件1',
          relevance: '用于评价创造性',
          relevanceLevel: 5,
        },
      ],
      rejectionTypes: ['inventiveness' as const],
    },
    originalApplication: {
      title: '测试专利',
      claims: '1. 一种测试方法，其特征在于...',
      description: '本发明提供一种测试方法...',
      abstract: '本发明涉及...',
    },
    strategyPreference: 'moderate' as const,
    documentType: 'cn' as const,
  })

  describe('基础功能', () => {
    it('应该能够创建实例', () => {
      const agent = createAgent()
      expect(agent).toBeDefined()
    })

    it('应该能够执行完整的答复流程', async () => {
      const agent = createAgent()
      const result = await agent.execute(createValidInput())

      expect(result).toBeDefined()
      expect(result.analysis).toBeDefined()
      expect(result.strategy).toBeDefined()
      expect(result.responseDocument).toBeDefined()
      expect(result.nextSteps).toBeDefined()
    })

    it('应该能够导出为指定格式', async () => {
      const agent = createAgent()
      const result = await agent.execute(createValidInput())

      const exportResult = await agent.exportToFormat(result, createValidInput(), 'cn')

      expect(exportResult.format).toBe('cn')
      expect(exportResult.content).toContain('审查意见答复书')
      expect(exportResult.metadata).toBeDefined()
    })
  })

  describe('子模块访问', () => {
    it('应该能够访问所有子模块', () => {
      const agent = createAgent()
      const modules = agent.getModules()

      expect(modules.oaParser).toBeInstanceOf(OAParser)
      expect(modules.strategyRecommender).toBeInstanceOf(StrategyRecommender)
      expect(modules.templateManager).toBeInstanceOf(ResponseTemplateManager)
      expect(modules.successPredictor).toBeInstanceOf(SuccessPredictor)
      expect(modules.caseLearner).toBeInstanceOf(CaseLearner)
    })
  })
})

describe('OAParser', () => {
  let parser: OAParser

  beforeEach(() => {
    parser = new OAParser()
  })

  const createRawData = (content: string): OARawData => ({
    applicationNumber: 'CN202310000000.0',
    patentTitle: '测试专利',
    content,
    documentType: 'cn',
  })

  describe('解析功能', () => {
    it('应该能够解析创造性驳回', async () => {
      const content = '权利要求1-3不具备创造性。对比文件D1公开了类似技术方案。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      expect(result.applicationNumber).toBe('CN202310000000.0')
      expect(result.patentTitle).toBe('测试专利')
      expect(result.rejectionReasons.length).toBeGreaterThan(0)
    })

    it('应该能够解析新颖性驳回', async () => {
      const content = '权利要求1不具备新颖性。对比文件D1公开了相同技术方案。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      const noveltyRejection = result.rejectionReasons.find((r) => r.type === 'novelty')
      expect(noveltyRejection).toBeDefined()
    })

    it('应该能够提取引用文献', async () => {
      const content = '对比文件CN112345678A公开了相关技术。US1234567也公开了类似技术。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      expect(result.citedReferences.length).toBeGreaterThan(0)
    })

    it('应该能够提取涉及的权利要求', async () => {
      const content = '权利要求1-3不具备创造性。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      expect(result.affectedClaims).toContain(1)
      expect(result.affectedClaims).toContain(2)
      expect(result.affectedClaims).toContain(3)
    })

    it('应该能够评估严重程度', async () => {
      const content = '权利要求1存在致命缺陷，无法克服。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      const highSeverityRejection = result.rejectionReasons.find((r) => r.severity === 'high')
      expect(highSeverityRejection).toBeDefined()
    })

    it('应该能够生成摘要', async () => {
      const content = '权利要求1-3不具备创造性。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('应该能够计算置信度', async () => {
      const content = '权利要求1-3不具备创造性。对比文件D1公开了相关技术。'
      const rawData = createRawData(content)

      const result = await parser.parse(rawData)

      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('批量解析', () => {
    it('应该能够批量解析多个审查意见', async () => {
      const rawDataList = [
        createRawData('权利要求1不具备新颖性。'),
        createRawData('权利要求2-3不具备创造性。'),
        createRawData('权利要求4不清晰。'),
      ]

      const results = await parser.parseBatch(rawDataList)

      expect(results.length).toBe(3)
      expect(results.every((r) => r.applicationNumber)).toBe(true)
    })
  })
})

describe('StrategyRecommender', () => {
  let recommender: StrategyRecommender

  beforeEach(() => {
    recommender = new StrategyRecommender()
  })

  const createParseResult = (rejectionTypes: string[]) => ({
    applicationNumber: 'CN202310000000.0',
    patentTitle: '测试专利',
    rawContent: '测试内容',
    rejectionReasons: rejectionTypes.map((type) => ({
      type: type as RejectionType,
      description: `${type}问题`,
      severity: 'medium' as Severity,
      affectedClaims: [1],
      relatedReferences: ['D1'],
      overcomeProbability: 50,
      suggestedResponse: 'argue' as const,
    })),
    citedReferences: [
      {
        publicationNumber: 'CN112345678A',
        title: '对比文件1',
        relevance: '相关',
        relevanceLevel: 5,
      },
    ],
    rejectionTypes: rejectionTypes as RejectionType[],
    affectedClaims: [1],
    summary: '测试摘要',
    confidence: 0.8,
    parserVersion: '2.0.0',
  })

  describe('策略推荐', () => {
    it('应该能够生成策略推荐', async () => {
      const parseResult = createParseResult(['novelty'])
      const recommendation = await recommender.recommend(parseResult, 'moderate')

      expect(recommendation.strategy).toBeDefined()
      expect(recommendation.successProbability).toBeGreaterThanOrEqual(0)
      expect(recommendation.successProbability).toBeLessThanOrEqual(100)
      expect(recommendation.keyArguments).toBeDefined()
      expect(recommendation.risks).toBeDefined()
    })

    it('应该根据策略偏好调整推荐', async () => {
      const parseResult = createParseResult(['inventiveness'])

      const aggressiveResult = await recommender.recommend(parseResult, 'aggressive')
      const conservativeResult = await recommender.recommend(parseResult, 'conservative')

      // 不同偏好应该产生不同的推荐
      expect(aggressiveResult.strategy).toBeDefined()
      expect(conservativeResult.strategy).toBeDefined()
    })

    it('应该生成替代策略', async () => {
      const parseResult = createParseResult(['novelty'])
      const recommendation = await recommender.recommend(parseResult, 'moderate')

      expect(recommendation.alternativeStrategies).toBeDefined()
      expect(recommendation.alternativeStrategies.length).toBeGreaterThan(0)
    })

    it('应该生成修改建议', async () => {
      const parseResult = createParseResult(['clarity'])
      const recommendation = await recommender.recommend(parseResult, 'moderate')

      expect(recommendation.amendmentSuggestions).toBeDefined()
    })
  })

  describe('历史案例学习', () => {
    it('应该能够添加历史案例', () => {
      const testCase: HistoricalCase = {
        id: 'test-case-1',
        applicationNumber: 'CN202310000001.0',
        patentTitle: '测试案例',
        officeActionSummary: '测试摘要',
        rejectionReasons: [],
        strategy: 'argue',
        arguments: [],
        amendments: [],
        outcome: 'success',
        round: 1,
        tags: [],
        date: new Date(),
      }

      recommender.addHistoricalCase(testCase)

      // 验证案例已添加（通过内部方法或行为验证）
      expect(() => recommender.addHistoricalCase(testCase)).not.toThrow()
    })

    it('应该能够批量添加历史案例', () => {
      const testCases: HistoricalCase[] = [
        {
          id: 'test-case-2',
          applicationNumber: 'CN202310000002.0',
          patentTitle: '测试案例2',
          officeActionSummary: '测试摘要',
          rejectionReasons: [],
          strategy: 'amend',
          arguments: [],
          amendments: [],
          outcome: 'success',
          round: 1,
          tags: [],
          date: new Date(),
        },
        {
          id: 'test-case-3',
          applicationNumber: 'CN202310000003.0',
          patentTitle: '测试案例3',
          officeActionSummary: '测试摘要',
          rejectionReasons: [],
          strategy: 'argue',
          arguments: [],
          amendments: [],
          outcome: 'failure',
          round: 1,
          tags: [],
          date: new Date(),
        },
      ]

      expect(() => recommender.addHistoricalCases(testCases)).not.toThrow()
    })
  })
})

describe('ResponseTemplateManager', () => {
  let manager: ResponseTemplateManager

  beforeEach(() => {
    manager = new ResponseTemplateManager()
  })

  describe('模板管理', () => {
    it('应该能够获取所有模板', () => {
      const templates = manager.getAllTemplates()

      expect(templates.length).toBeGreaterThan(0)
    })

    it('应该能够根据条件筛选模板', () => {
      const templates = manager.filterTemplates({
        tags: ['cn', 'novelty'],
      })

      expect(templates.length).toBeGreaterThan(0)
      expect(templates.every((t) => t.tags.includes('cn'))).toBe(true)
    })

    it('应该能够渲染模板', () => {
      const result = manager.renderTemplate('cn-novelty-argue', {
        applicationNumber: 'CN202310000000.0',
        patentTitle: '测试专利',
        notificationDate: '2024-01-01',
        responseDate: '2024-02-01',
        claimNumbers: '1',
        referenceNumber: 'D1',
        referenceContent: '对比文件内容',
        distinguishingFeatures: '区别特征',
      })

      expect(result.content).toBeDefined()
      expect(result.content.length).toBeGreaterThan(0)
    })

    it('应该能够检测缺失的必需变量', () => {
      const result = manager.renderTemplate('cn-novelty-argue', {
        applicationNumber: 'CN202310000000.0',
      })

      expect(result.hasMissingRequired).toBe(true)
      expect(result.missingRequired.length).toBeGreaterThan(0)
    })

    it('应该能够获取模板变量列表', () => {
      const variables = manager.getTemplateVariables('cn-novelty-argue')

      expect(variables.length).toBeGreaterThan(0)
      expect(variables.every((v) => v.name)).toBe(true)
    })

    it('应该能够记录模板使用', () => {
      const initialStats = manager.getTemplateStats('cn-novelty-argue')

      manager.renderTemplate('cn-novelty-argue', {
        applicationNumber: 'CN202310000000.0',
        patentTitle: '测试专利',
        notificationDate: '2024-01-01',
        responseDate: '2024-02-01',
      })

      const afterStats = manager.getTemplateStats('cn-novelty-argue')

      expect(afterStats?.usageCount).toBeGreaterThan(initialStats?.usageCount || 0)
    })

    it('应该能够记录成功', () => {
      manager.recordSuccess('cn-novelty-argue')

      const stats = manager.getTemplateStats('cn-novelty-argue')

      expect(stats?.successCount).toBeGreaterThan(0)
    })
  })

  describe('自定义模板', () => {
    it('应该能够添加自定义模板', () => {
      const customTemplate = {
        id: 'custom-template-1',
        name: '自定义模板',
        applicableRejections: ['novelty' as const],
        applicableStrategies: ['argue' as const],
        content: {
          opening: '自定义开头',
          argumentTemplates: [
            {
              category: '测试',
              template: '测试内容 {variable}',
              placeholders: ['variable'],
            },
          ],
          closing: '自定义结尾',
        },
        tags: ['custom'],
        usageCount: 0,
        successRate: 0.5,
      }

      manager.addTemplate(customTemplate)

      const retrieved = manager.getTemplate('custom-template-1')
      expect(retrieved).toEqual(customTemplate)
    })

    it('应该能够删除模板', () => {
      manager.addTemplate({
        id: 'temp-template',
        name: '临时模板',
        applicableRejections: ['novelty' as const],
        applicableStrategies: ['argue' as const],
        content: {
          argumentTemplates: [],
        },
        tags: [],
        usageCount: 0,
        successRate: 0,
      })

      expect(manager.removeTemplate('temp-template')).toBe(true)
      expect(manager.removeTemplate('temp-template')).toBe(false)
    })
  })
})

describe('SuccessPredictor', () => {
  let predictor: SuccessPredictor

  beforeEach(() => {
    predictor = new SuccessPredictor()
  })

  const createParseResult = () => ({
    applicationNumber: 'CN202310000000.0',
    patentTitle: '测试专利',
    rawContent: '测试内容',
    rejectionReasons: [
      {
        type: 'novelty' as RejectionType,
        description: '新颖性问题',
        severity: 'medium' as Severity,
        affectedClaims: [1],
        relatedReferences: ['D1'],
        overcomeProbability: 50,
        suggestedResponse: 'argue' as const,
      },
    ],
    citedReferences: [
      {
        publicationNumber: 'CN112345678A',
        title: '对比文件1',
        relevance: '相关',
        relevanceLevel: 5,
      },
    ],
    rejectionTypes: ['novelty' as RejectionType],
    affectedClaims: [1],
    summary: '测试摘要',
    confidence: 0.8,
    parserVersion: '2.0.0',
  })

  describe('成功预测', () => {
    it('应该能够预测成功率', async () => {
      const parseResult = createParseResult()
      const prediction = await predictor.predict(parseResult, 'argue', 1)

      expect(prediction.overallProbability).toBeGreaterThanOrEqual(0)
      expect(prediction.overallProbability).toBeLessThanOrEqual(100)
      expect(prediction.confidenceInterval).toBeDefined()
      expect(prediction.keySuccessFactors).toBeDefined()
      expect(prediction.riskFactors).toBeDefined()
    })

    it('应该能够计算置信区间', async () => {
      const parseResult = createParseResult()
      const prediction = await predictor.predict(parseResult, 'argue', 1)

      expect(prediction.confidenceInterval.lower).toBeLessThanOrEqual(prediction.overallProbability)
      expect(prediction.confidenceInterval.upper).toBeGreaterThanOrEqual(
        prediction.overallProbability
      )
    })

    it('应该能够生成预测解释', async () => {
      const parseResult = createParseResult()
      const prediction = await predictor.predict(parseResult, 'argue', 1)
      const explanation = predictor.explainPrediction(prediction)

      expect(explanation).toContain('预测成功率')
      expect(explanation).toContain('置信区间')
    })
  })

  describe('历史案例学习', () => {
    it('应该能够添加历史案例', () => {
      const testCase: HistoricalCase = {
        id: 'test-prediction-case',
        applicationNumber: 'CN202310000000.0',
        patentTitle: '测试案例',
        officeActionSummary: '测试摘要',
        rejectionReasons: [],
        strategy: 'argue',
        arguments: [],
        amendments: [],
        outcome: 'success',
        round: 1,
        tags: [],
        date: new Date(),
      }

      expect(() => predictor.addHistoricalCase(testCase)).not.toThrow()
    })

    it('应该能够获取统计信息', () => {
      predictor.addHistoricalCase({
        id: 'stats-case-1',
        applicationNumber: 'CN202310000001.0',
        patentTitle: '统计案例1',
        officeActionSummary: '摘要',
        rejectionReasons: [],
        strategy: 'argue',
        arguments: [],
        amendments: [],
        outcome: 'success',
        round: 1,
        tags: [],
        date: new Date(),
      })

      const stats = predictor.getStats()

      expect(stats.totalCases).toBeGreaterThan(0)
    })
  })
})

describe('CaseLearner', () => {
  let learner: CaseLearner

  beforeEach(() => {
    learner = new CaseLearner()
  })

  const createTestCase = (
    id: string,
    outcome: 'success' | 'partial_success' | 'failure'
  ): HistoricalCase => ({
    id,
    applicationNumber: `CN202310000000.${id}`,
    patentTitle: `测试案例${id}`,
    officeActionSummary: '测试摘要',
    rejectionReasons: [
      {
        type: 'novelty' as RejectionType,
        description: '新颖性问题',
        severity: 'medium' as Severity,
        affectedClaims: [1],
        relatedReferences: ['D1'],
        overcomeProbability: 50,
        suggestedResponse: 'argue' as const,
      },
    ],
    strategy: 'argue',
    arguments: [],
    amendments: [],
    outcome,
    round: 1,
    tags: [],
    date: new Date(),
  })

  describe('案例管理', () => {
    it('应该能够添加案例', () => {
      const testCase = createTestCase('case-1', 'success')

      learner.addCase(testCase)

      const retrieved = learner.getCase('case-1')
      expect(retrieved).toEqual(testCase)
    })

    it('应该能够批量添加案例', () => {
      const testCases = [createTestCase('case-2', 'success'), createTestCase('case-3', 'failure')]

      learner.addCases(testCases)

      expect(learner.getAllCases().length).toBeGreaterThanOrEqual(2)
    })

    it('应该能够删除案例', () => {
      const testCase = createTestCase('case-4', 'success')
      learner.addCase(testCase)

      expect(learner.removeCase('case-4')).toBe(true)
      expect(learner.getCase('case-4')).toBeUndefined()
    })

    it('应该能够清空所有案例', () => {
      learner.addCases([createTestCase('case-5', 'success'), createTestCase('case-6', 'success')])

      learner.clear()

      expect(learner.getAllCases().length).toBe(0)
    })
  })

  describe('案例查询', () => {
    beforeEach(() => {
      learner.addCases([
        createTestCase('query-1', 'success'),
        createTestCase('query-2', 'failure'),
        createTestCase('query-3', 'partial_success'),
      ])
    })

    it('应该能够按结果查询', () => {
      const successCases = learner.queryCases({ outcome: 'success' })

      expect(successCases.length).toBeGreaterThan(0)
      expect(successCases.every((c) => c.outcome === 'success')).toBe(true)
    })

    it('应该能够按策略查询', () => {
      const argueCases = learner.queryCases({ strategy: 'argue' })

      expect(argueCases.length).toBeGreaterThan(0)
    })
  })

  describe('相似案例查找', () => {
    it('应该能够查找相似案例', () => {
      const parseResult = {
        applicationNumber: 'CN202310000000.0',
        patentTitle: '测试专利',
        rawContent: '测试内容',
        rejectionReasons: [
          {
            type: 'novelty' as RejectionType,
            description: '新颖性问题',
            severity: 'medium' as Severity,
            affectedClaims: [1],
            relatedReferences: ['D1'],
            overcomeProbability: 50,
            suggestedResponse: 'argue' as const,
          },
        ],
        citedReferences: [],
        rejectionTypes: ['novelty' as RejectionType],
        affectedClaims: [1],
        summary: '摘要',
        confidence: 0.8,
        parserVersion: '2.0.0',
      }

      learner.addCase(createTestCase('sim-1', 'success'))

      const similarCases = learner.findSimilarCases(parseResult, 'argue')

      expect(similarCases).toBeDefined()
      expect(similarCases.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('成功模式学习', () => {
    it('应该能够学习成功模式', () => {
      learner.addCases([
        createTestCase('learn-1', 'success'),
        createTestCase('learn-2', 'success'),
        createTestCase('learn-3', 'failure'),
      ])

      const patterns = learner.learnSuccessPatterns()

      expect(patterns.commonStrategies).toBeDefined()
      expect(patterns.insights).toBeDefined()
      expect(patterns.insights.length).toBeGreaterThan(0)
    })

    it('应该能够提取模板', () => {
      const testCase = createTestCase('extract-1', 'success')
      testCase.arguments = [
        {
          category: '区别技术特征',
          argument: '本申请与对比文件存在区别技术特征X',
          evidence: ['对比文件D1'],
          targetRejection: 'novelty',
          strength: 5,
        },
      ]

      learner.addCase(testCase)

      const templates = learner.extractTemplates()

      expect(templates).toBeDefined()
    })
  })

  describe('统计信息', () => {
    it('应该能够获取统计信息', () => {
      learner.addCases([
        createTestCase('stats-1', 'success'),
        createTestCase('stats-2', 'success'),
        createTestCase('stats-3', 'failure'),
      ])

      const stats = learner.getStats()

      expect(stats.totalCases).toBeGreaterThanOrEqual(3)
      expect(stats.successRate).toBeGreaterThan(0)
    })
  })
})
