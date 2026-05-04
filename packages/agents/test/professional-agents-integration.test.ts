/**
 * 专业层Agent集成测试
 * 测试Agent在真实场景中的端到端功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PatentWriterAgent,
  type PatentWriterInput
} from '../patent-writer/src/PatentWriterAgent.v2.js'
import {
  PatentResponderAgent,
  type PatentResponderInput
} from '../patent-responder/src/PatentResponderAgent.v2.js'
import {
  PatentAnalyzerAgent,
  type PatentAnalyzerInput
} from '../patent-analyzer/src/PatentAnalyzerAgent.v2.js'
import {
  CreativeAnalyzerAgent,
  type CreativeAnalyzerInput
} from '../patent-analyzer/src/CreativeAnalyzerAgent.js'

describe('专业层Agent集成测试', () => {
  let mockLLM: any
  let mockContext: any

  beforeEach(() => {
    // 创建Mock LLM，返回更真实的响应
    mockLLM = {
      invoke: vi.fn().mockImplementation(async (params: any) => {
        const content = params.messages[1].content

        // 根据不同的提示词返回不同的响应
        if (content.includes('撰写权利要求')) {
          return {
            content: '1. 一种智能控制器，其特征在于，包括：\n控制模块，用于接收控制指令；\n传感器模块，用于检测环境参数；\n执行模块，用于执行控制动作。\n\n2. 根据权利要求1所述的智能控制器，其特征在于，所述控制模块采用PID控制算法。'
          }
        } else if (content.includes('撰写专利说明书')) {
          return {
            content: '技术领域\n本发明涉及自动化控制技术领域，具体涉及一种智能控制器。\n\n背景技术\n现有控制器存在控制精度低、响应速度慢等问题。\n\n发明内容\n本发明提供一种智能控制器，包括控制模块、传感器模块和执行模块...'
          }
        } else if (content.includes('撰写专利摘要')) {
          return {
            content: '本发明公开了一种智能控制器，包括控制模块、传感器模块和执行模块。控制模块采用PID控制算法，能够实现精确控制，提高控制精度和响应速度，适用于工业自动化控制领域。'
          }
        } else if (content.includes('分析审查意见')) {
          return {
            content: '审查意见摘要：审查员认为权利要求1不具备新颖性。\n\n关键问题：\n1. 新颖性问题（高）\n\n可克服性：70%'
          }
        } else if (content.includes('制定答复策略')) {
          return {
            content: '总体策略：修改\n成功概率：75%\n\n关键论点：\n1. 增加技术特征"采用模糊控制算法"\n2. 强调技术效果的显著性\n\n建议修改：\n权利要求1：增加"所述控制模块采用模糊控制算法"'
          }
        } else if (content.includes('撰写答复文档')) {
          return {
            content: '答复陈述意见\n\n审查员：\n\n关于权利要求1的新颖性问题，申请人认为...\n\n修改后的权利要求书：\n1. 一种智能控制器，其特征在于，包括：\n控制模块，采用模糊控制算法；\n传感器模块；\n执行模块。'
          }
        } else if (content.includes('分析技术方案')) {
          return {
            content: '技术领域：自动化控制\n技术问题：控制精度低\n技术方案：采用模糊控制算法\n技术效果：提高控制精度\n关键技术特征：模糊控制、传感器融合'
          }
        } else if (content.includes('分析权利要求')) {
          return {
            content: '独立权利要求：1条\n从属权利要求：3条\n保护范围：中等\n清楚性：清楚\n风险：低\n质量评分：75'
          }
        } else if (content.includes('评估创造性')) {
          return {
            content: '创造性等级：有创造性\n创造性评分：80\n\n突出实质性特点：75分\n理由：采用模糊控制算法，具有实质性特点\n\n显著进步：80分\n理由：显著提高控制精度\n\n技术贡献：85分\n理由：为自动化控制领域做出显著贡献'
          }
        } else if (content.includes('分析技术问题')) {
          return {
            content: '解决的技术问题：如何提高控制精度\n问题难度：中等\n不可预见性：是'
          }
        } else if (content.includes('分析技术方案(方法)')) {
          return {
            content: '技术手段：模糊控制、传感器融合\n特征组合：多层次控制\n协同效应：是'
          }
        } else if (content.includes('分析技术效果')) {
          return {
            content: '技术效果：提高控制精度、加快响应速度\n意料之外：是\n量化效果：精度提升50%'
          }
        } else if (content.includes('对比现有技术')) {
          return {
            content: '区别技术特征：\n1. 采用模糊控制算法\n2. 多传感器融合\n\n显而易见性：不显而易见\n启示：无启示'
          }
        }

        return {
          content: 'Mock LLM response'
        }
      })
    }

    // 创建Mock Context
    mockContext = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      },
      memory: {
        get: vi.fn(),
        set: vi.fn()
      },
      eventBus: {
        emit: vi.fn(),
        on: vi.fn()
      }
    }
  })

  describe('PatentWriterAgent端到端测试', () => {
    let agent: PatentWriterAgent

    beforeEach(() => {
      agent = new PatentWriterAgent({
        name: 'patent-writer',
        description: '专利撰写智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {}
      })
    })

    it('应该完整撰写专利申请文件', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试科技有限公司',
        inventors: ['张三', '李四'],
        technicalDisclosure: '一种智能控制器，采用模糊控制算法，能够提高控制精度。包括控制模块、传感器模块和执行模块。',
        drawings: ['图1 控制器结构图', '图2 控制流程图']
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.title).toBe('智能控制器')
      expect(result.claims).toContain('一种智能控制器')
      expect(result.description).toContain('技术领域')
      expect(result.abstract).toContain('智能控制器')
      expect(result.metrics.claimsCount).toBeGreaterThan(0)
      expect(result.metrics.qualityScore).toBeGreaterThan(0)
      expect(result.metrics.duration).toBeGreaterThan(0)
    })

    it('应该只撰写权利要求', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试科技有限公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制器',
        mode: 'claims-only'
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.claims).toBeTruthy()
      expect(result.claims.length).toBeGreaterThan(0)
      expect(result.description).toBe('')
    })

    it('应该只撰写说明书', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试科技有限公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制器',
        mode: 'specification-only'
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.description).toBeTruthy()
      expect(result.description.length).toBeGreaterThan(0)
      expect(result.claims).toBe('')
    })
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
        tools: {}
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
              relevance: '公开了控制模块'
            }
          ],
          rejectionTypes: ['novelty']
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器，其特征在于，包括：控制模块，用于接收控制指令；传感器模块，用于检测环境参数。',
          description: '技术领域：自动化控制...',
          abstract: '一种智能控制器...'
        },
        strategyPreference: 'moderate',
        documentType: 'cn'
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.analysis.summary).toBeTruthy()
      expect(result.analysis.keyIssues.length).toBeGreaterThan(0)
      expect(result.strategy.overallStrategy).toBeTruthy()
      expect(result.strategy.successProbability).toBeGreaterThan(0)
      expect(result.responseDocument.responseLetter).toBeTruthy()
      expect(result.responseDocument.metrics.generationTime).toBeGreaterThan(0)
      expect(result.nextSteps.length).toBeGreaterThan(0)
    })

    it('应该根据策略偏好调整答复', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          officeActionContent: '权利要求1不具备创造性'
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器...',
          description: '技术领域...'
        },
        strategyPreference: 'aggressive'
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.strategy.overallStrategy).toBeDefined()
    })
  })

  describe('PatentAnalyzerAgent端到端测试', () => {
    let agent: PatentAnalyzerAgent

    beforeEach(() => {
      agent = new PatentAnalyzerAgent({
        name: 'patent-analyzer',
        description: '专利分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {}
      })
    })

    it('应该完整分析专利', async () => {
      const input: PatentAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制器，采用模糊控制算法',
          applicant: '测试科技有限公司',
          inventors: ['张三', '李四'],
          publicationDate: '2024-01-01'
        },
        analysisTypes: ['technical', 'claims', 'creativity', 'risk']
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.basicInfo.publicationNumber).toBe('CN112345678A')
      expect(result.technicalAnalysis).toBeDefined()
      expect(result.technicalAnalysis?.field).toBeTruthy()
      expect(result.technicalAnalysis?.keyFeatures.length).toBeGreaterThan(0)
      expect(result.claimsAnalysis).toBeDefined()
      expect(result.creativityAssessment).toBeDefined()
      expect(result.riskAssessment).toBeDefined()
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('应该对比现有技术', async () => {
      const input: PatentAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制器，采用模糊控制算法'
        },
        comparisonPatents: [
          {
            publicationNumber: 'CN112345679A',
            title: '传统控制器',
            abstract: '一种传统控制器，采用PID控制算法'
          }
        ],
        analysisTypes: ['technical', 'priorArt']
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.priorArtAnalysis).toBeDefined()
      expect(result.priorArtAnalysis?.closestPriorArt.length).toBeGreaterThan(0)
      expect(result.priorArtAnalysis?.innovations.length).toBeGreaterThan(0)
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
        tools: {}
      })
    })

    it('应该完整评估创造性', async () => {
      const input: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制器，采用模糊控制算法',
          claims: '1. 一种智能控制器，其特征在于，采用模糊控制算法。',
          description: '技术领域：自动化控制...'
        },
        priorArt: [
          {
            publicationNumber: 'CN112345679A',
            title: '传统控制器',
            abstract: '一种传统控制器，采用PID控制算法'
          }
        ],
        assessmentStandard: 'cn',
        technicalField: '自动化控制'
      }

      const plan = await agent['plan'](input, mockContext)
      const result = await agent['execute'](plan, mockContext)

      expect(result.basicInfo.publicationNumber).toBe('CN112345678A')
      expect(result.basicInfo.assessmentStandard).toBe('cn')
      expect(result.creativityAssessment.level).toBeDefined()
      expect(result.creativityAssessment.score).toBeGreaterThan(0)
      expect(result.creativityAssessment.dimensions.substantiveCharacteristics.score).toBeGreaterThan(0)
      expect(result.creativityAssessment.dimensions.significantProgress.score).toBeGreaterThan(0)
      expect(result.creativityAssessment.dimensions.technicalContribution.score).toBeGreaterThan(0)
      expect(result.problemAnalysis.solvedProblem).toBeTruthy()
      expect(result.solutionAnalysis.technicalMeans.length).toBeGreaterThan(0)
      expect(result.effectAnalysis.technicalEffects.length).toBeGreaterThan(0)
      expect(result.differencesFromPriorArt.distinguishingFeatures.length).toBeGreaterThan(0)
      expect(result.recommendations.strengthenCreativity).toBeDefined()
      expect(result.recommendations.highlightContribution).toBeDefined()
      expect(result.recommendations.emphasizeEffects).toBeDefined()
    })

    it('应该根据创造性等级生成不同建议', async () => {
      const inputLow: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '简单控制器',
          abstract: '一种简单的控制器'
        }
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
    it('应该在撰写后分析专利', async () => {
      // 步骤1：使用PatentWriterAgent撰写专利
      const writerAgent = new PatentWriterAgent({
        name: 'patent-writer',
        description: '专利撰写智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {}
      })

      const writerInput: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试科技有限公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制器，采用模糊控制算法'
      }

      const writerPlan = await writerAgent['plan'](writerInput, mockContext)
      const writerResult = await writerAgent['execute'](writerPlan, mockContext)

      // 步骤2：使用PatentAnalyzerAgent分析撰写的专利
      const analyzerAgent = new PatentAnalyzerAgent({
        name: 'patent-analyzer',
        description: '专利分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {}
      })

      const analyzerInput: PatentAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: writerResult.title,
          abstract: writerResult.abstract,
          fullText: `${writerResult.claims}\n\n${writerResult.description}`
        }
      }

      const analyzerPlan = await analyzerAgent['plan'](analyzerInput, mockContext)
      const analyzerResult = await analyzerAgent['execute'](analyzerPlan, mockContext)

      expect(writerResult.title).toBe(analyzerResult.basicInfo.title)
      expect(analyzerResult.technicalAnalysis).toBeDefined()
      expect(analyzerResult.claimsAnalysis).toBeDefined()
    })

    it('应该在分析后评估创造性', async () => {
      // 步骤1：使用PatentAnalyzerAgent分析专利
      const analyzerAgent = new PatentAnalyzerAgent({
        name: 'patent-analyzer',
        description: '专利分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {}
      })

      const analyzerInput: PatentAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制器，采用模糊控制算法'
        },
        comparisonPatents: [
          {
            publicationNumber: 'CN112345679A',
            title: '传统控制器',
            abstract: '一种传统控制器，采用PID控制算法'
          }
        ]
      }

      const analyzerPlan = await analyzerAgent['plan'](analyzerInput, mockContext)
      const analyzerResult = await analyzerAgent['execute'](analyzerPlan, mockContext)

      // 步骤2：使用CreativeAnalyzerAgent评估创造性
      const creativeAgent = new CreativeAnalyzerAgent({
        name: 'creative-analyzer',
        description: '创造性分析智能体',
        llm: mockLLM,
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: {}
      })

      const creativeInput: CreativeAnalyzerInput = {
        patent: analyzerInput.patent,
        priorArt: analyzerInput.comparisonPatents,
        assessmentStandard: 'cn'
      }

      const creativePlan = await creativeAgent['plan'](creativeInput, mockContext)
      const creativeResult = await creativeAgent['execute'](creativePlan, mockContext)

      expect(analyzerResult.priorArtAnalysis).toBeDefined()
      expect(creativeResult.creativityAssessment.level).toBeDefined()
      expect(creativeResult.differencesFromPriorArt.distinguishingFeatures.length).toBeGreaterThan(0)
    })
  })
})
