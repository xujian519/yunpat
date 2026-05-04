/**
 * 专业层Agent单元测试
 * 测试重构后的PatentWriterAgent、PatentResponderAgent、PatentAnalyzerAgent、CreativeAnalyzerAgent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PatentWriterAgent,
  type PatentWriterInput,
  type PatentWriterOutput
} from '../patent-writer/src/PatentWriterAgent.v2.js'
import {
  PatentResponderAgent,
  type PatentResponderInput,
  type PatentResponderOutput
} from '../patent-responder/src/PatentResponderAgent.v2.js'
import {
  PatentAnalyzerAgent,
  type PatentAnalyzerInput,
  type PatentAnalyzerOutput
} from '../patent-analyzer/src/PatentAnalyzerAgent.v2.js'
import {
  CreativeAnalyzerAgent,
  type CreativeAnalyzerInput,
  type CreativeAnalyzerOutput
} from '../patent-analyzer/src/CreativeAnalyzerAgent.js'

describe('专业层Agent单元测试', () => {
  let mockLLM: any
  let mockContext: any

  beforeEach(() => {
    // 创建Mock LLM
    mockLLM = {
      invoke: vi.fn().mockResolvedValue({
        content: 'Mock LLM response'
      })
    }

    // 创建Mock Context
    mockContext = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      }
    }
  })

  describe('PatentWriterAgent', () => {
    let agent: PatentWriterAgent

    beforeEach(() => {
      agent = new PatentWriterAgent({
        name: 'patent-writer',
        description: '专利撰写智能体',
        llm: mockLLM,
        eventBus: {},
        memory: {},
        tools: {}
      })
    })

    it('应该验证输入参数', async () => {
      const invalidInput = {
        title: '',
        field: '',
        applicant: '',
        inventors: [],
        technicalDisclosure: ''
      } as PatentWriterInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow('发明名称不能为空')
    })

    it('应该规划撰写阶段', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制方法',
        mode: 'full'
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.mode).toBe('full')
      expect(plan.stages).toContain('understand-invention')
      expect(plan.stages).toContain('draft-claims')
      expect(plan.stages).toContain('draft-specification')
      expect(plan.stages).toContain('generate-abstract')
    })

    it('应该执行权利要求撰写模式', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制方法',
        mode: 'claims-only'
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.stages).toContain('draft-claims')
      expect(plan.stages).not.toContain('draft-specification')
    })

    it('应该执行说明书撰写模式', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制方法',
        mode: 'specification-only'
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.stages).toContain('draft-specification')
      expect(plan.stages).not.toContain('draft-claims')
    })

    it('应该调用LLM撰写权利要求', async () => {
      const input: PatentWriterInput = {
        title: '智能控制器',
        field: '自动化控制',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种智能控制方法'
      }

      const plan = await agent['plan'](input, mockContext)
      await agent['execute'](plan, mockContext)

      expect(mockLLM.invoke).toHaveBeenCalled()
    })

    it('应该计算质量评分', () => {
      const claims = '1. 一种智能控制器，其特征在于，包括：\n2. 根据权利要求1所述的智能控制器，其特征在于：'
      const description = '技术领域：本发明涉及自动化控制领域。\n背景技术：现有技术存在缺陷。\n发明内容：本发明提供一种智能控制器。\n具体实施方式：如图1所示...'
      const abstract = '本发明公开了一种智能控制器，包括控制模块和传感器模块，能够实现智能控制，提高控制精度。'

      const score = agent['calculateQualityScore'](claims, description, abstract)

      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('应该统计权利要求数量', () => {
      const claims = '1. 一种智能控制器，其特征在于，包括：\n2. 根据权利要求1所述的智能控制器，其特征在于：\n3. 根据权利要求2所述的智能控制器，其特征在于：'

      const count = agent['countClaims'](claims)

      expect(count).toBe(3)
    })
  })

  describe('PatentResponderAgent', () => {
    let agent: PatentResponderAgent

    beforeEach(() => {
      agent = new PatentResponderAgent({
        name: 'patent-responder',
        description: '专利答复智能体',
        llm: mockLLM,
        eventBus: {},
        memory: {},
        tools: {}
      })
    })

    it('应该验证输入参数', async () => {
      const invalidInput = {
        officeAction: {
          applicationNumber: '',
          patentTitle: '',
          officeActionContent: ''
        },
        originalApplication: {
          title: '',
          claims: '',
          description: ''
        }
      } as PatentResponderInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow('申请号不能为空')
    })

    it('应该规划答复阶段', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          officeActionContent: '权利要求1不具备新颖性'
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器...',
          description: '技术领域...'
        },
        strategyPreference: 'moderate'
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.strategyPreference).toBe('moderate')
      expect(plan.stages).toContain('analyze-office-action')
      expect(plan.stages).toContain('determine-strategy')
      expect(plan.stages).toContain('draft-response')
    })

    it('应该根据偏好选择策略', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          officeActionContent: '权利要求1不具备新颖性'
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器...',
          description: '技术领域...'
        },
        strategyPreference: 'aggressive'
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.strategyPreference).toBe('aggressive')
    })

    it('应该生成后续建议', () => {
      const strategy = {
        overallStrategy: 'amend' as const,
        successProbability: 70,
        keyArguments: ['论点1', '论点2'],
        suggestedAmendments: [
          {
            claimNumber: 1,
            currentText: '当前文本',
            proposedText: '修改后文本',
            reason: '理由'
          }
        ],
        additionalEvidence: ['证据1'],
        risks: ['风险1']
      }

      const nextSteps = agent['generateNextSteps'](strategy)

      expect(nextSteps).toContain('根据答复策略修改权利要求书')
      expect(nextSteps).toContain('准备答复陈述意见')
    })

    it('应该处理放弃策略', () => {
      const strategy = {
        overallStrategy: 'abandon' as const,
        successProbability: 10,
        keyArguments: [],
        suggestedAmendments: [],
        additionalEvidence: [],
        risks: ['风险1']
      }

      const nextSteps = agent['generateNextSteps'](strategy)

      expect(nextSteps).toContain('考虑放弃本申请')
    })
  })

  describe('PatentAnalyzerAgent', () => {
    let agent: PatentAnalyzerAgent

    beforeEach(() => {
      agent = new PatentAnalyzerAgent({
        name: 'patent-analyzer',
        description: '专利分析智能体',
        llm: mockLLM,
        eventBus: {},
        memory: {},
        tools: {}
      })
    })

    it('应该验证输入参数', async () => {
      const invalidInput = {
        patent: {
          publicationNumber: '',
          title: '',
          abstract: ''
        }
      } as PatentAnalyzerInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow('专利公开号不能为空')
    })

    it('应该规划分析阶段', async () => {
      const input: PatentAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制方法'
        },
        analysisTypes: ['technical', 'claims', 'creativity']
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.analysisTypes).toContain('technical')
      expect(plan.analysisTypes).toContain('claims')
      expect(plan.analysisTypes).toContain('creativity')
      expect(plan.stages).toContain('analyze-technical')
      expect(plan.stages).toContain('analyze-claims')
    })

    it('应该默认包含核心分析类型', async () => {
      const input: PatentAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制方法'
        }
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.analysisTypes).toContain('technical')
      expect(plan.analysisTypes).toContain('claims')
      expect(plan.analysisTypes).toContain('creativity')
      expect(plan.analysisTypes).toContain('risk')
    })

    it('应该生成优化建议', () => {
      const technicalAnalysis = {
        field: '自动化控制',
        problems: ['问题1', '问题2'],
        solution: '解决方案',
        effects: ['效果1', '效果2'],
        keyFeatures: ['特征1', '特征2']
      }

      const claimsAnalysis = {
        independentCount: 1,
        dependentCount: 5,
        protectionScope: {
          breadth: 'narrow' as const,
          clarity: 'clear' as const,
          risk: 'low' as const
        },
        qualityScore: 70
      }

      const creativityAssessment = {
        level: 'obvious' as const,
        score: 50,
        reasoning: '创造性不足'
      }

      const riskAssessment = {
        invalidityRisk: 'high' as const,
        infringementRisk: 'low' as const,
        riskFactors: ['因素1', '因素2']
      }

      const recommendations = agent['generateRecommendations'](
        technicalAnalysis,
        claimsAnalysis,
        creativityAssessment,
        riskAssessment
      )

      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('CreativeAnalyzerAgent', () => {
    let agent: CreativeAnalyzerAgent

    beforeEach(() => {
      agent = new CreativeAnalyzerAgent({
        name: 'creative-analyzer',
        description: '创造性分析智能体',
        llm: mockLLM,
        eventBus: {},
        memory: {},
        tools: {}
      })
    })

    it('应该验证输入参数', async () => {
      const invalidInput = {
        patent: {
          publicationNumber: '',
          title: '',
          abstract: ''
        }
      } as CreativeAnalyzerInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow('专利公开号不能为空')
    })

    it('应该规划分析阶段', async () => {
      const input: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制方法'
        },
        assessmentStandard: 'cn'
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.assessmentStandard).toBe('cn')
      expect(plan.stages).toContain('analyze-problem')
      expect(plan.stages).toContain('analyze-solution')
      expect(plan.stages).toContain('analyze-effects')
      expect(plan.stages).toContain('assess-creativity')
    })

    it('应该默认使用中国评估标准', async () => {
      const input: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制方法'
        }
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.assessmentStandard).toBe('cn')
    })

    it('应该生成优化建议', () => {
      const problemAnalysis = {
        solvedProblem: '技术问题',
        problemDifficulty: 'low' as const,
        unforeseeable: false
      }

      const solutionAnalysis = {
        technicalMeans: ['手段1', '手段2'],
        featureCombination: '组合描述',
        synergisticEffect: false
      }

      const effectAnalysis = {
        technicalEffects: ['效果1', '效果2'],
        unexpected: false
      }

      const creativityAssessment = {
        level: 'obvious' as const,
        score: 50,
        dimensions: {
          substantiveCharacteristics: { score: 50, reasoning: '理由' },
          significantProgress: { score: 50, reasoning: '理由' },
          technicalContribution: { score: 50, reasoning: '理由' }
        },
        reasoning: '总体理由'
      }

      const recommendations = agent['generateRecommendations'](
        {} as CreativeAnalyzerInput,
        problemAnalysis,
        solutionAnalysis,
        effectAnalysis,
        creativityAssessment,
        mockContext
      )

      expect(recommendations.strengthenCreativity.length).toBeGreaterThan(0)
      expect(recommendations.highlightContribution.length).toBeGreaterThan(0)
    })

    it('应该根据创造性等级调整建议', () => {
      const creativityAssessmentHigh = {
        level: 'inventive' as const,
        score: 85,
        dimensions: {
          substantiveCharacteristics: { score: 85, reasoning: '理由' },
          significantProgress: { score: 85, reasoning: '理由' },
          technicalContribution: { score: 85, reasoning: '理由' }
        },
        reasoning: '总体理由'
      }

      const recommendationsHigh = agent['generateRecommendations'](
        {} as CreativeAnalyzerInput,
        undefined,
        undefined,
        undefined,
        creativityAssessmentHigh,
        mockContext
      )

      expect(recommendationsHigh.strengthenCreativity.length).toBe(0)
    })
  })
})
