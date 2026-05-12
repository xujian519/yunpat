/**
 * 专业层Agent单元测试
 * 测试 PatentResponderAgent、ComparisonAnalyzerAgent、CreativeAnalyzerAgent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PatentResponderAgent,
  type PatentResponderInput,
  type PatentResponderOutput as _PatentResponderOutput,
} from '../patent-responder/src/PatentResponderAgent.v4.js'
import {
  ComparisonAnalyzerAgent,
  type ComparisonAnalyzerInput,
  type ComparisonAnalyzerOutput as _ComparisonAnalyzerOutput,
} from '../patent-analyzer/src/ComparisonAnalyzerAgent.js'
import {
  CreativeAnalyzerAgent,
  type CreativeAnalyzerInput,
  type CreativeAnalyzerOutput as _CreativeAnalyzerOutput,
} from '../patent-analyzer/src/CreativeAnalyzerAgent.js'

describe('专业层Agent单元测试', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockContext: any

  beforeEach(() => {
    // 创建Mock LLM
    mockLLM = {
      invoke: vi.fn().mockResolvedValue({
        content: 'Mock LLM response',
      }),
    }

    // 创建Mock Context
    mockContext = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    }
  })

  describe('PatentResponderAgent', () => {
    let agent: PatentResponderAgent

    beforeEach(() => {
      agent = new PatentResponderAgent({
        name: 'patent-responder',
        description: '专利答复智能体',
        llm: mockLLM,
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        enableKnowledgeGraph: false,
      })
    })

    it('应该验证输入参数', async () => {
      const invalidInput = {
        officeAction: {
          applicationNumber: '',
          patentTitle: '',
          officeActionContent: '',
        },
        originalApplication: {
          title: '',
          claims: '',
          description: '',
        },
      } as PatentResponderInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow('applicationNumber不能为空')
    })

    it('应该规划答复阶段', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          officeActionContent: '权利要求1不具备新颖性',
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器...',
          description: '技术领域...',
        },
        strategyPreference: 'moderate',
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.strategyPreference).toBe('moderate')
      expect(plan.stages).toContain('parse-oa')
      expect(plan.stages).toContain('recommend-strategy')
      expect(plan.stages).toContain('draft-response')
    })

    it('应该根据偏好选择策略', async () => {
      const input: PatentResponderInput = {
        officeAction: {
          applicationNumber: 'CN202310000000',
          patentTitle: '智能控制器',
          officeActionContent: '权利要求1不具备新颖性',
        },
        originalApplication: {
          title: '智能控制器',
          claims: '1. 一种智能控制器...',
          description: '技术领域...',
        },
        strategyPreference: 'aggressive',
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.strategyPreference).toBe('aggressive')
    })

    it('应该生成后续建议', () => {
      const output = {
        analysis: {
          summary: '审查意见摘要',
          keyIssues: [],
          overcomeProbability: 70,
        },
        strategy: {
          overallStrategy: 'amend' as const,
          successProbability: 75,
          keyArguments: ['论点1', '论点2'],
          suggestedAmendments: [
            {
              claimNumber: 1,
              currentText: '当前文本',
              proposedText: '修改后文本',
              reason: '理由',
            },
          ],
          additionalEvidence: ['证据1'],
          risks: ['风险1'],
        },
        responseDocument: {
          responseLetter: '答复内容',
          metrics: {
            wordCount: 100,
            argumentCount: 2,
            amendmentCount: 1,
            generationTime: 0,
          },
        },
        nextSteps: [],
      }

      const nextSteps = agent['generateNextSteps'](output, {})

      expect(nextSteps.length).toBeGreaterThan(0)
      expect(nextSteps).toContain('建议按照当前策略提交答复')
    })

    it('应该处理放弃策略', () => {
      const output = {
        analysis: {
          summary: '审查意见摘要',
          keyIssues: [],
          overcomeProbability: 10,
        },
        strategy: {
          overallStrategy: 'abandon' as const,
          successProbability: 15,
          keyArguments: [],
          suggestedAmendments: [],
          additionalEvidence: [],
          risks: ['风险1'],
        },
        responseDocument: {
          responseLetter: '答复内容',
          metrics: {
            wordCount: 50,
            argumentCount: 0,
            amendmentCount: 0,
            generationTime: 0,
          },
        },
        nextSteps: [],
      }

      const nextSteps = agent['generateNextSteps'](output, {})

      expect(nextSteps).toContain('建议重新评估答复策略')
    })
  })

  describe('ComparisonAnalyzerAgent', () => {
    let agent: ComparisonAnalyzerAgent

    beforeEach(() => {
      agent = new ComparisonAnalyzerAgent({
        name: 'comparison-analyzer',
        description: '对比分析智能体',
        llm: mockLLM,
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        enableKnowledgeGraph: false,
      })
    })

    it('应该验证输入参数 - 对比文件不能为空', async () => {
      const invalidInput = {
        priorArtAnalyses: [],
      } as ComparisonAnalyzerInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow(
        '对比文件分析结果不能为空'
      )
    })

    it('应该规划完整分析阶段（含发明理解）', async () => {
      const input: ComparisonAnalyzerInput = {
        inventionUnderstanding: {
          technicalProblem: '控制精度低',
          technicalSolution: '采用模糊控制算法',
          keyFeatures: ['模糊控制', '传感器融合'],
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

      expect(plan.hasInvention).toBe(true)
      expect(plan.stages).toContain('compare-prior-arts')
      expect(plan.stages).toContain('find-closest-prior-art')
      expect(plan.stages).toContain('assess-creativity')
      expect(plan.stages).toContain('assess-risks')
      expect(plan.stages).toContain('generate-recommendations')
    })

    it('应该规划仅对比文件模式', async () => {
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
                implementation: '实现方式',
                technicalEffects: [{ effect: '效果A', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '问题描述',
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

      expect(plan.hasInvention).toBe(false)
      expect(plan.stages).not.toContain('find-closest-prior-art')
      expect(plan.stages).not.toContain('assess-creativity')
      expect(plan.stages).toContain('compare-prior-arts')
      expect(plan.stages).toContain('assess-risks')
    })

    it('应该生成优化建议', () => {
      const output = {
        creativityAssessment: {
          level: 'lacks_inventiveness' as const,
          score: 40,
          reasoning: '创造性不足',
        },
        riskAssessment: {
          invalidityRisk: 'high' as const,
          infringementRisk: 'low' as const,
          riskFactors: ['因素1'],
        },
        comparisons: [],
        recommendations: [],
      }

      const recommendations = agent['generateRecommendations'](output)

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
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        enableKnowledgeGraph: false,
      })
    })

    it('应该验证输入参数', async () => {
      const invalidInput = {
        patent: {
          publicationNumber: '',
          title: '',
          abstract: '',
        },
      } as CreativeAnalyzerInput

      await expect(agent['plan'](invalidInput, mockContext)).rejects.toThrow()
    })

    it('应该规划分析阶段', async () => {
      const input: CreativeAnalyzerInput = {
        patent: {
          publicationNumber: 'CN112345678A',
          title: '智能控制器',
          abstract: '一种智能控制方法',
        },
        assessmentStandard: 'cn',
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
          abstract: '一种智能控制方法',
        },
      }

      const plan = await agent['plan'](input, mockContext)

      expect(plan.assessmentStandard).toBe('cn')
    })

    it('应该生成优化建议', () => {
      const problemAnalysis = {
        solvedProblem: '技术问题',
        problemDifficulty: 'low' as const,
        unforeseeable: false,
      }

      const effectAnalysis = {
        technicalEffects: ['效果1', '效果2'],
        unexpected: false,
      }

      const creativityAssessment = {
        level: 'obvious' as const,
        score: 50,
        dimensions: {
          substantiveCharacteristics: { score: 50, reasoning: '理由' },
          significantProgress: { score: 50, reasoning: '理由' },
          technicalContribution: { score: 50, reasoning: '理由' },
        },
        reasoning: '总体理由',
      }

      const recommendations = agent['generateRecommendations'](
        problemAnalysis,
        effectAnalysis,
        creativityAssessment,
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
          technicalContribution: { score: 85, reasoning: '理由' },
        },
        reasoning: '总体理由',
      }

      const recommendationsHigh = agent['generateRecommendations'](
        undefined,
        undefined,
        creativityAssessmentHigh,
      )

      expect(recommendationsHigh.strengthenCreativity.length).toBe(0)
    })
  })
})
