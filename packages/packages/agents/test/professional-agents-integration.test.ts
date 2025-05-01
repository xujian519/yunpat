/**
 * 专业层Agent集成测试
 * 测试Agent在真实场景中的端到端功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PatentResponderAgent,
  type PatentResponderInput,
} from '../patent-responder/src/PatentResponderAgent.v2.js'
import {
  ComparisonAnalyzerAgent,
  type ComparisonAnalyzerInput,
} from '../patent-analyzer/src/ComparisonAnalyzerAgent.js'
import {
  CreativeAnalyzerAgent,
  type CreativeAnalyzerInput,
} from '../patent-analyzer/src/CreativeAnalyzerAgent.js'

describe('专业层Agent集成测试', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockContext: any

  beforeEach(() => {
    // PatentResponderAgent.v2 用 invoke()，PatentAnalyzerAgent/CreativeAnalyzerAgent 用 chat()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invokeImpl = vi.fn().mockImplementation(async (params: any) => {
      const content = params.messages[1].content

      if (content.includes('分析审查意见')) {
        return {
          content:
            '审查意见摘要：审查员认为权利要求1不具备新颖性。\n\n关键问题：\n1. 新颖性问题（高）\n\n可克服性：70%',
        }
      } else if (content.includes('制定答复策略')) {
        return {
          content:
            '总体策略：修改\n成功概率：75%\n\n关键论点：\n1. 增加技术特征"采用模糊控制算法"\n2. 强调技术效果的显著性\n\n建议修改：\n权利要求1：增加"所述控制模块采用模糊控制算法"',
        }
      } else if (content.includes('撰写答复文档')) {
        return {
          content:
            '答复陈述意见\n\n审查员：\n\n关于权利要求1的新颖性问题，申请人认为...\n\n修改后的权利要求书：\n1. 一种智能控制器，其特征在于，包括：\n控制模块，采用模糊控制算法；\n传感器模块；\n执行模块。',
        }
      }

      return {
        content: 'Mock LLM response',
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatImpl = vi.fn().mockImplementation(async (_params: any) => {
      return {
        message: {
          content: JSON.stringify({
            field: '自动化控制',
            problems: ['控制精度低'],
            solution: '采用模糊控制算法',
            effects: ['提高控制精度'],
            keyFeatures: ['模糊控制', '传感器融合'],
          }),
        },
      }
    })

    mockLLM = {
      invoke: invokeImpl,
      chat: chatImpl,
    }

    // 创建Mock Context
    mockContext = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
      memory: {
        get: vi.fn(),
        set: vi.fn(),
      },
      eventBus: {
        publish: vi.fn(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        emit: vi.fn(),
        on: vi.fn(),
      },
    }
  })

  describe('PatentResponderAgent端到端测试', () => {
    let agent: PatentResponderAgent

    beforeEach(() => {
      agent = new PatentResponderAgent({
        name: 'patent-responder',
        description: '专利答复智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {},
        enableKnowledgeGraph: false,
      })
    })

    it('应该完整处理审查意见答复', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          examiner: '审查员A',
          notificationDate: '2024-01-01',
          deadline: '2024-04-01',
          officeActionContent: '权利要求1不具备新颖性，对比文件1公开了类似技术方案。',
          citedReferences: [
            {
              publicationNumber: 'CN112345678A',
              title: '一种控制方法',
              relevance: '公开了控制模块',
            },
          ],
          rejectionTypes: ['novelty'],
        },
        originalApplication: {
          title: '智能控制器',
          claims:
            '1. 一种智能控制器，其特征在于，包括：控制模块，用于接收控制指令；传感器模块，用于检测环境参数。',
          description: '技术领域：自动化控制...',
          abstract: '一种智能控制器...',
        },
        strategyPreference: 'moderate',
        documentType: 'cn',
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.analysis.summary).toBeTruthy()
      expect(result.analysis.keyIssues.length).toBeGreaterThan(0)
      expect(result.strategy.overallStrategy).toBeTruthy()
      expect(result.strategy.successProbability).toBeGreaterThan(0)
      expect(result.responseDocument.responseLetter).toBeTruthy()
      expect(result.responseDocument.metrics.generationTime).toBeGreaterThanOrEqual(0)
      expect(result.nextSteps.length).toBeGreaterThan(0)
    })

    it('应该根据策略偏好调整答复', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          officeActionContent: '权利要求1不具备创造性',
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器...',
          description: '技术领域...',
        },
        strategyPreference: 'aggressive',
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.strategy.overallStrategy).toBeDefined()
    })
  })

  describe('ComparisonAnalyzerAgent端到端测试', () => {
    let agent: ComparisonAnalyzerAgent

    beforeEach(() => {
      agent = new ComparisonAnalyzerAgent({
        name: 'comparison-analyzer',
        description: '对比分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {},
        enableKnowledgeGraph: false,
      })
    })

    it('应该完整执行对比分析（含发明理解）', async () => {
      const input: ComparisonAnalyzerInput = {
        inventionUnderstanding: {
          technicalProblem: '控制精度低',
          technicalSolution: '采用模糊控制算法',
          keyFeatures: ['模糊控制', '传感器融合'],
          beneficialEffects: '提高控制精度',
        },
        priorArtAnalyses: [
          {
            documentInfo: {
              title: '传统控制器',
              type: 'patent' as const,
            },
            technicalAnalysis: {
              technicalSolution: {
                core: 'PID控制',
                keyFeatures: [
                  { feature: 'PID控制', necessity: 'essential' as const, confidence: 0.9 },
                ],
                implementation: '传统PID控制器',
                technicalEffects: [{ effect: '基础控制', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '控制精度不足',
                sub: [],
              },
            },
            metadata: {
              depth: 2 as const,
              timestamp: Date.now(),
              confidence: 0.8,
              knowledgeGraphUsed: false,
            },
          },
        ],
        scenario: 'new_application',
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['act'](plan, mockContext)

      expect(result.scenario).toBe('new_application')
      expect(result.hasInventionUnderstanding).toBe(true)
      expect(result.comparisons.length).toBeGreaterThan(0)
      expect(result.metadata.priorArtCount).toBe(1)
    })

    it('应该执行仅对比文件模式的对比分析', async () => {
      const input: ComparisonAnalyzerInput = {
        priorArtAnalyses: [
          {
            documentInfo: {
              title: '对比文件1',
              type: 'patent' as const,
            },
            technicalAnalysis: {
              technicalSolution: {
                core: '特征A方案',
                keyFeatures: [
                  { feature: '特征A', necessity: 'essential' as const, confidence: 0.9 },
                ],
                implementation: '实现A',
                technicalEffects: [{ effect: '效果A', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '问题A',
                sub: [],
              },
            },
            metadata: {
              depth: 2 as const,
              timestamp: Date.now(),
              confidence: 0.8,
              knowledgeGraphUsed: false,
            },
          },
          {
            documentInfo: {
              title: '对比文件2',
              type: 'paper' as const,
            },
            technicalAnalysis: {
              technicalSolution: {
                core: '特征B方案',
                keyFeatures: [
                  { feature: '特征B', necessity: 'essential' as const, confidence: 0.9 },
                ],
                implementation: '实现B',
                technicalEffects: [{ effect: '效果B', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '问题B',
                sub: [],
              },
            },
            metadata: {
              depth: 2 as const,
              timestamp: Date.now(),
              confidence: 0.8,
              knowledgeGraphUsed: false,
            },
          },
        ],
        scenario: 'office_action',
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['act'](plan, mockContext)

      expect(result.hasInventionUnderstanding).toBe(false)
      expect(result.comparisons.length).toBe(2)
      expect(result.metadata.priorArtCount).toBe(2)
    })
  })

  describe('CreativeAnalyzerAgent端到端测试', () => {
    let agent: CreativeAnalyzerAgent

    beforeEach(() => {
      agent = new CreativeAnalyzerAgent({
        name: 'creative-analyzer',
        description: '创造性分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {},
        enableKnowledgeGraph: false,
      })
    })

    it('应该完整评估创造性', async () => {
      const input: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制器，采用模糊控制算法',
          claims: '1. 一种智能控制器，其特征在于，采用模糊控制算法。',
          description: '技术领域：自动化控制...',
        },
        priorArt: [
          {
            publicationNumber: 'CN112345679A',
            title: '传统控制器',
            abstract: '一种传统控制器，采用PID控制算法',
          },
        ],
        assessmentStandard: 'cn',
        technicalField: '自动化控制',
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.basicInfo.publicationNumber).toBe('CN112345678A')
      expect(result.basicInfo.assessmentStandard).toBe('cn')
      expect(result.creativityAssessment.level).toBeDefined()
      expect(result.creativityAssessment.score).toBeGreaterThan(0)
      expect(
        result.creativityAssessment.dimensions.substantiveCharacteristics.score
      ).toBeGreaterThan(0)
      expect(result.creativityAssessment.dimensions.significantProgress.score).toBeGreaterThan(0)
      expect(result.creativityAssessment.dimensions.technicalContribution.score).toBeGreaterThan(0)
      expect(result.problemAnalysis.solvedProblem).toBeTruthy()
      expect(result.solutionAnalysis.technicalMeans.length).toBeGreaterThan(0)
      expect(result.effectAnalysis.technicalEffects.length).toBeGreaterThan(0)
      expect(result.recommendations.strengthenCreativity).toBeDefined()
      expect(result.recommendations.highlightContribution).toBeDefined()
      expect(result.recommendations.emphasizeEffects).toBeDefined()
    })

    it('应该根据创造性等级生成不同建议', async () => {
      const inputLow: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '简单控制器',
          abstract: '一种简单的控制器',
        },
      }

      const planLow = await agent['plan'](inputLow, mockContext)
      const resultLow = await agent['execute'](planLow, mockContext)

      // 如果创造性低，应该有增强建议
      if (resultLow.creativityAssessment.level === 'obvious') {
        expect(resultLow.recommendations.strengthenCreativity.length).toBeGreaterThan(0)
      }
    })
  })

  describe('多Agent协作测试', () => {
    it('应该在对比分析后评估创造性', async () => {
      // 步骤1：使用ComparisonAnalyzerAgent进行对比分析
      const analyzerAgent = new ComparisonAnalyzerAgent({
        name: 'comparison-analyzer',
        description: '对比分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {},
        enableKnowledgeGraph: false,
      })

      const analyzerInput: ComparisonAnalyzerInput = {
        inventionUnderstanding: {
          technicalProblem: '控制精度低',
          technicalSolution: '采用模糊控制算法',
          keyFeatures: ['模糊控制'],
        },
        priorArtAnalyses: [
          {
            documentInfo: {
              title: '传统控制器',
              type: 'patent' as const,
            },
            technicalAnalysis: {
              technicalSolution: {
                core: 'PID控制',
                keyFeatures: [
                  { feature: 'PID控制', necessity: 'essential' as const, confidence: 0.9 },
                ],
                implementation: '传统控制器',
                technicalEffects: [{ effect: '基础控制', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '精度不足',
                sub: [],
              },
            },
            metadata: {
              depth: 2 as const,
              timestamp: Date.now(),
              confidence: 0.8,
              knowledgeGraphUsed: false,
            },
          },
        ],
        scenario: 'new_application',
      }

      const analyzerPlan = await analyzerAgent['plan'](analyzerInput, mockContext)
      const _analyzerResult = await analyzerAgent['act'](analyzerPlan, mockContext)

      // 步骤2：使用CreativeAnalyzerAgent评估创造性
      const creativeAgent = new CreativeAnalyzerAgent({
        name: 'creative-analyzer',
        description: '创造性分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {},
        enableKnowledgeGraph: false,
      })

      const creativeInput: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制器，采用模糊控制算法',
        },
        priorArt: [
          {
            publicationNumber: 'CN112345679A',
            title: '传统控制器',
            abstract: '一种传统控制器，采用PID控制算法',
          },
        ],
        assessmentStandard: 'cn',
      }

      const creativePlan = await creativeAgent['plan'](creativeInput, mockContext)
      const creativeResult = await creativeAgent['execute'](creativePlan, mockContext)

      expect(creativeResult.creativityAssessment.level).toBeDefined()
      expect(creativeResult.recommendations.strengthenCreativity).toBeDefined()
    })
  })
})
