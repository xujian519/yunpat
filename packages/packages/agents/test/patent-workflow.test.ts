/**
 * 端到端测试 - 完整专利工作流程
 *
 * 测试场景：
 * 1. 说明书撰写流程：发明理解 → 说明书
 * 2. OA 答复流程：OA → 答复文档
 * 3. 专利分析流程：专利 → 分析报告
 * 4. 专利管理流程：全生命周期管理
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeAll } from 'vitest'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { SpecificationDrafterAgent } from '@yunpat/agent-specification-drafter'
import { ComparisonAnalyzerAgent } from '@yunpat/agent-patent-analyzer'
import type { ComparisonAnalyzerInput } from '@yunpat/agent-patent-analyzer'
import { PatentResponderAgent } from '@yunpat/agent-patent-responder'

function createMockLLM(responseContent: Record<string, any>) {
  return {
    chat: async (_params: any) => ({
      message: {
        content: JSON.stringify(responseContent),
      },
    }),
  }
}

describe('端到端测试 - 专利工作流程', () => {
  let eventBus: EventBus
  let memory: ShortTermMemory
  let tools: ToolRegistry

  beforeAll(() => {
    eventBus = new EventBus()
    memory = new ShortTermMemory()
    tools = new ToolRegistry(eventBus)
  })

  describe('场景1: 说明书撰写流程', () => {
    it('应该完成从发明理解到说明书的撰写', async () => {
      const specAgent = new SpecificationDrafterAgent({
        name: 'e2e-spec-drafter',
        description: '端到端测试 - 说明书撰写',
        eventBus,
        memory,
        tools,
        llm: createMockLLM({
          technical_field: {
            content: '人工智能技术领域',
            chapter: '技术领域',
            title: '技术领域',
            wordCount: 50,
          },
          background_art: {
            content: '现有图像识别方法在复杂场景下准确率低',
            chapter: '背景技术',
            title: '背景技术',
            wordCount: 200,
          },
          invention_content: {
            content: '采用多层卷积神经网络提取图像特征',
            chapter: '发明内容',
            title: '发明内容',
            wordCount: 800,
            technical_problem: '识别准确率低',
            technical_solution: '采用CNN提取特征',
            beneficial_effects: '准确率提升20%',
            beneficial_effects_list: [],
          },
          embodiments: {
            content: '具体实施方式...',
            chapter: '具体实施方式',
            title: '具体实施方式',
            wordCount: 1500,
            embodiment_list: [],
            completeness_score: 0.8,
          },
          drawings_description: {
            content: '图1为系统架构图',
            chapter: '附图说明',
            title: '附图说明',
            wordCount: 100,
            drawings: [],
          },
        }),
      })

      const result = await specAgent.execute({
        inventionUnderstanding: {
          technicalField: '人工智能',
          technicalProblem: '图像识别准确率低',
          technicalSolution: '采用深度神经网络提取特征',
          beneficialEffects: '准确率提升20%',
          keyFeatures: ['卷积层', '池化层', '全连接层'],
          backgroundArt: '现有技术存在识别准确率低的问题',
        },
      })

      expect(result).toBeDefined()
      expect(result.specification).toBeDefined()
      expect(result.metrics).toBeDefined()
    })

    it('应该支持并行处理多个说明书', async () => {
      const specAgent = new SpecificationDrafterAgent({
        name: 'e2e-batch-spec',
        description: '端到端测试 - 批量说明书撰写',
        eventBus,
        memory,
        tools,
        llm: createMockLLM({
          technical_field: {
            content: '测试领域',
            chapter: '技术领域',
            title: '技术领域',
            wordCount: 50,
          },
          background_art: {
            content: '测试背景',
            chapter: '背景技术',
            title: '背景技术',
            wordCount: 100,
          },
          invention_content: {
            content: '测试方案',
            chapter: '发明内容',
            title: '发明内容',
            wordCount: 300,
            technical_problem: '测试问题',
            technical_solution: '测试方案',
            beneficial_effects: '测试效果',
            beneficial_effects_list: [],
          },
          embodiments: {
            content: '测试实施方式',
            chapter: '具体实施方式',
            title: '具体实施方式',
            wordCount: 500,
            embodiment_list: [],
            completeness_score: 0.7,
          },
          drawings_description: {
            content: '无附图',
            chapter: '附图说明',
            title: '附图说明',
            wordCount: 20,
            drawings: [],
          },
        }),
      })

      const inventions = [
        {
          technicalField: 'AI',
          technicalProblem: '问题1',
          technicalSolution: '方案1',
          beneficialEffects: '效果1',
          keyFeatures: ['特征1'],
          backgroundArt: '背景1',
        },
        {
          technicalField: '区块链',
          technicalProblem: '问题2',
          technicalSolution: '方案2',
          beneficialEffects: '效果2',
          keyFeatures: ['特征2'],
          backgroundArt: '背景2',
        },
      ]

      const results = await Promise.all(
        inventions.map((inv) => specAgent.execute({ inventionUnderstanding: inv }))
      )

      expect(results).toHaveLength(2)
      results.forEach((result) => {
        expect(result.specification).toBeDefined()
        expect(result.metrics).toBeDefined()
      })
    })
  })

  describe('场景2: OA 答复流程', () => {
    it('应该完成从 OA 到答复文档的完整流程', async () => {
      const responderAgent = new PatentResponderAgent({
        name: 'e2e-responder',
        description: '端到端测试 - OA 答复',
        eventBus,
        memory,
        tools,
        llm: createMockLLM({
          summary: '审查员认为权利要求1-3不具备创造性',
          keyIssues: [
            {
              type: 'inventiveness',
              description: '与对比文件1相比缺乏创造性',
              severity: 'high',
            },
          ],
          overcomeProbability: 75,
          overallStrategy: 'argue',
          successProbability: 75,
          keyArguments: ['对比文件1未公开特征X'],
          suggestedAmendments: [],
          additionalEvidence: [],
          risks: ['成功概率中等'],
          documentType: 'cn',
          responseLetter:
            '尊敬的审查员：\n\n关于申请号CN202310000000.0的审查意见，申请人陈述如下意见...',
          detailedArguments: [],
        }),
        enableKnowledgeGraph: false,
        enableTemplates: false,
      })

      const responseResult = await responderAgent.execute({
        officeAction: {
          applicationNumber: 'CN202310000000.0',
          patentTitle: '一种图像识别方法',
          notificationDate: '2024-01-15',
          deadline: '2024-04-15',
          officeActionContent: '权利要求1-3不具备创造性。',
          citedReferences: [],
          rejectionTypes: ['inventiveness'],
        },
        originalApplication: {
          title: '一种图像识别方法',
          claims: '1. 一种图像识别方法，其特征在于...',
          description: '本发明提供一种图像识别方法...',
        },
        strategyPreference: 'moderate',
        documentType: 'cn',
      })

      expect(responseResult).toBeDefined()
      expect(responseResult.analysis).toBeDefined()
      expect(responseResult.strategy).toBeDefined()
      expect(['argue', 'amend', 'both', 'abandon']).toContain(
        responseResult.strategy.overallStrategy
      )
    })
  })

  describe('场景3: 对比分析流程', () => {
    it('应该完成发明与对比文件的对比分析', async () => {
      const analyzerAgent = new ComparisonAnalyzerAgent({
        name: 'e2e-comparison-analyzer',
        description: '端到端测试 - 对比分析',
        eventBus,
        memory,
        tools,
        llm: createMockLLM({
          level: 'obvious',
          score: 55,
          reasoning: '与对比文件存在一定区别但创造性一般',
        }),
        enableKnowledgeGraph: false,
      })

      const input: ComparisonAnalyzerInput = {
        inventionUnderstanding: {
          technicalProblem: '图像识别准确率低',
          technicalSolution: '采用深度神经网络提取特征',
          keyFeatures: ['卷积层', '池化层', '全连接层'],
          beneficialEffects: '准确率提升20%',
        },
        priorArtAnalyses: [
          {
            documentInfo: {
              title: '传统图像识别方法',
              type: 'patent' as const,
            },
            technicalAnalysis: {
              technicalSolution: {
                core: 'SIFT特征提取',
                keyFeatures: [
                  { feature: 'SIFT特征提取', necessity: 'essential' as const, confidence: 0.9 },
                ],
                implementation: '传统SIFT方法',
                technicalEffects: [{ effect: '基础图像识别', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '识别准确率低',
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

      const result = await analyzerAgent.execute(input)

      expect(result).toBeDefined()
      expect(result.scenario).toBe('new_application')
      expect(result.hasInventionUnderstanding).toBe(true)
      expect(result.comparisons.length).toBeGreaterThan(0)
      expect(result.metadata.priorArtCount).toBe(1)
    })
  })

  // 场景4: 专利管理流程 - 需要 PostgreSQL 数据库，跳过
  describe('场景4: 专利管理流程', () => {
    it.skip('应该完成完整的专利生命周期管理', async () => {
      // 此测试需要真实的 PostgreSQL 数据库连接
    })
  })

  describe('场景5: 说明书撰写 + 对比分析集成', () => {
    it('应该在撰写说明书后进行对比分析', async () => {
      // 1. 撰写说明书
      const specAgent = new SpecificationDrafterAgent({
        name: 'e2e-integrated-spec',
        description: '端到端测试 - 集成说明书撰写',
        eventBus,
        memory,
        tools,
        llm: createMockLLM({
          technical_field: {
            content: 'AI领域',
            chapter: '技术领域',
            title: '技术领域',
            wordCount: 50,
          },
          background_art: {
            content: '背景',
            chapter: '背景技术',
            title: '背景技术',
            wordCount: 100,
          },
          invention_content: {
            content: '方案描述',
            chapter: '发明内容',
            title: '发明内容',
            wordCount: 500,
            technical_problem: '测试问题',
            technical_solution: '测试方案',
            beneficial_effects: '测试效果',
            beneficial_effects_list: [],
          },
          embodiments: {
            content: '实施方式',
            chapter: '具体实施方式',
            title: '具体实施方式',
            wordCount: 800,
            embodiment_list: [],
            completeness_score: 0.8,
          },
          drawings_description: {
            content: '无附图',
            chapter: '附图说明',
            title: '附图说明',
            wordCount: 20,
            drawings: [],
          },
        }),
      })

      const specResult = await specAgent.execute({
        inventionUnderstanding: {
          technicalField: 'AI',
          technicalProblem: '测试问题',
          technicalSolution: '测试方案',
          beneficialEffects: '测试效果',
          keyFeatures: ['特征1'],
          backgroundArt: '背景',
        },
      })

      expect(specResult.specification).toBeDefined()

      // 2. 使用ComparisonAnalyzerAgent进行对比分析
      const analyzerAgent = new ComparisonAnalyzerAgent({
        name: 'e2e-integrated-analyzer',
        description: '端到端测试 - 集成对比分析',
        eventBus,
        memory,
        tools,
        llm: createMockLLM({
          level: 'inventive',
          score: 80,
          reasoning: '具有创造性',
        }),
        enableKnowledgeGraph: false,
      })

      const analysisResult = await analyzerAgent.execute({
        inventionUnderstanding: {
          technicalProblem: '测试问题',
          technicalSolution: '测试方案',
          keyFeatures: ['特征1'],
        },
        priorArtAnalyses: [
          {
            documentInfo: {
              title: '对比文件',
              type: 'patent' as const,
            },
            technicalAnalysis: {
              technicalSolution: {
                core: '对比方案',
                keyFeatures: [
                  { feature: '对比特征', necessity: 'essential' as const, confidence: 0.9 },
                ],
                implementation: '对比实现',
                technicalEffects: [{ effect: '对比效果', confidence: 0.8 }],
              },
              technicalProblems: {
                main: '对比问题',
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
      })

      expect(analysisResult.scenario).toBe('new_application')
      expect(analysisResult.comparisons).toBeDefined()
    })
  })
})
