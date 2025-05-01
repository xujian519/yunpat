/**
 * 专利分析工作流 E2E 测试
 *
 * 测试专利分析流水线：
 * InventionUnderstanding -> PatentTechnicalAnalysis -> ComparisonReport
 *
 * 仅在 MOCK_TESTS=true 时运行
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createWorkflowInfrastructure,
  createAnalyzeWorkflowLLM,
  collectEvents,
  mockInventionResponse,
  mockTechnicalAnalysisResponse,
  mockComparisonReportResponse,
} from './helpers/workflow-setup.js'
import type { WorkflowInfrastructure } from './helpers/workflow-setup.js'

const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

const TEST_DISCLOSURE = {
  title: '一种基于相变材料的高效散热装置',
  field: '电子设备散热技术',
  disclosure: `
    本发明涉及一种基于相变材料的高效散热装置。
    技术方案：采用相变材料作为散热介质，配置多层复合散热结构，
    集成智能温控调节模块。相变材料在相变过程中吸收大量热量。
    技术效果：散热效率提高60%，工作温度范围扩大至-40°C至120°C，能耗降低30%。
  `.trim(),
}

const TEST_PATENT = {
  publicationNumber: 'CN202310000001.0',
  title: '一种基于相变材料的高效散热装置',
  abstract: '本发明公开了一种基于相变材料的高效散热装置，包括散热基板、相变材料层和智能温控模块。',
}

describeE2E('专利分析工作流', () => {
  let infra: WorkflowInfrastructure

  beforeAll(() => {
    infra = createWorkflowInfrastructure({
      responses: [
        mockInventionResponse(),
        mockTechnicalAnalysisResponse(),
        mockComparisonReportResponse(),
      ],
    })
  })

  describe('阶段1: 发明理解', () => {
    it('应从技术交底书中提取关键信息', async () => {
      const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')

      const agent = new InventionUnderstandingAgent({
        name: 'invention-understanding',
        description: '发明理解智能体',
        llm: infra.llm,
        memory: infra.memory,
        tools: infra.tools,
        eventBus: infra.eventBus,
      })

      const result = await agent.execute({
        title: TEST_DISCLOSURE.title,
        field: TEST_DISCLOSURE.field,
        technicalDisclosure: TEST_DISCLOSURE.disclosure,
      })

      expect(result).toBeDefined()
      expect(result.technicalField).toBeTruthy()
      expect(result.keyFeatures).toBeInstanceOf(Array)
      expect(result.keyFeatures.length).toBeGreaterThan(0)

      // 兼容性字段
      expect(result.technicalProblem).toBeTruthy()
      expect(result.technicalSolution).toBeTruthy()
    })
  })

  describe('阶段2: 专利技术分析', () => {
    it('应完成专利技术分析并返回结构化结果', async () => {
      const { PriorArtAnalyzerAgent } = await import('@yunpat/agent-analysis')

      const agent = new PriorArtAnalyzerAgent({
        name: 'prior-art-analyzer',
        description: '对比文件分析智能体',
        llm: infra.llm,
        memory: infra.memory,
        tools: infra.tools,
        eventBus: infra.eventBus,
      })

      const result = await agent.execute({
        document: {
          type: 'patent',
          title: TEST_PATENT.title,
          content: TEST_PATENT.abstract,
          metadata: { publicationNumber: TEST_PATENT.publicationNumber },
        },
        analysisDepth: 2,
        enableKnowledgeEnhancement: false,
      })

      expect(result).toBeDefined()
      // 验证分析结果结构
      expect(result).toHaveProperty('technicalAnalysis')
    })

    it('应支持论文类型的对比文件分析', async () => {
      const { PriorArtAnalyzerAgent } = await import('@yunpat/agent-analysis')

      const agent = new PriorArtAnalyzerAgent({
        name: 'prior-art-analyzer',
        description: '对比文件分析智能体',
        llm: infra.llm,
        memory: infra.memory,
        tools: infra.tools,
        eventBus: infra.eventBus,
      })

      const result = await agent.execute({
        document: {
          type: 'paper',
          title: TEST_PATENT.title,
          content: TEST_PATENT.abstract,
          metadata: { authors: ['张三', '李四'], venue: '测试期刊' },
        },
        analysisDepth: 2,
        enableKnowledgeEnhancement: false,
      })

      expect(result).toBeDefined()
    })
  })

  describe('阶段3: 对比分析报告生成', () => {
    it('应生成包含最接近现有技术的对比报告', async () => {
      const { ComparisonReportGeneratorAgent } = await import('@yunpat/agent-analysis')

      const agent = new ComparisonReportGeneratorAgent({
        name: 'comparison-report-generator',
        description: '对比分析报告生成智能体',
        llm: infra.llm,
        memory: infra.memory,
        tools: infra.tools,
        eventBus: infra.eventBus,
      })

      const result = await agent.execute({
        inventionUnderstanding: {
          technicalProblem: '散热效率低',
          technicalSolution: '采用相变材料散热',
          technicalEffects: '效率提高60%',
          keyFeatures: ['相变材料', '智能温控', '多层复合结构'],
        },
        priorArtAnalysis: [
          {
            patentInfo: {
              publicationNumber: 'CN1234567A',
              title: '一种电子设备散热器',
            },
            technicalAnalysis: {
              technicalProblems: {
                main: '散热效率不足',
                sub: ['高温环境下性能下降'],
              },
              technicalSolution: {
                core: '传统金属散热片方案',
                keyFeatures: [{ feature: '金属散热片', necessity: 'essential' }],
              },
              technicalEffects: {
                main: '基本散热功能',
                sub: ['成本低'],
              },
            },
            comparison: {
              similarity: 0.65,
              overlappingFeatures: ['散热基板'],
              distinctFeatures: ['相变材料层', '智能温控模块'],
              novelty: true,
            },
          },
        ],
      })

      expect(result).toBeDefined()
      // 验证报告结构
      expect(result).toHaveProperty('closestPriorArt')
      expect(result).toHaveProperty('distinctFeatures')
      expect(result).toHaveProperty('technicalProblem')
      expect(result).toHaveProperty('inventiveness')

      // 验证创造性评估
      expect(result.inventiveness).toHaveProperty('score')
      expect(result.inventiveness.score).toBeGreaterThanOrEqual(0)
      expect(result.inventiveness.score).toBeLessThanOrEqual(1)
    })

    it('应在缺少现有技术分析时抛出错误', async () => {
      const { ComparisonReportGeneratorAgent } = await import('@yunpat/agent-analysis')

      const agent = new ComparisonReportGeneratorAgent({
        name: 'comparison-report-generator',
        description: '对比分析报告生成智能体',
        llm: infra.llm,
        memory: infra.memory,
        tools: infra.tools,
        eventBus: infra.eventBus,
      })

      await expect(
        agent.execute({
          inventionUnderstanding: {
            technicalProblem: '散热效率低',
            technicalSolution: '采用相变材料',
            technicalEffects: '效率提高',
            keyFeatures: ['相变材料'],
          },
          priorArtAnalysis: [],
        })
      ).rejects.toThrow()
    })
  })

  describe('完整分析流水线', () => {
    it('应从头到尾完成整个分析工作流', async () => {
      const pipelineInfra = createWorkflowInfrastructure({
        responses: [
          mockInventionResponse(),
          mockTechnicalAnalysisResponse(),
          mockComparisonReportResponse(),
        ],
      })

      const eventCollector = collectEvents(pipelineInfra.eventBus, 'agent:*')

      // 步骤1: 发明理解
      const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
      const { PriorArtAnalyzerAgent, ComparisonReportGeneratorAgent } =
        await import('@yunpat/agent-analysis')

      const inventionAgent = new InventionUnderstandingAgent({
        name: 'invention-understanding',
        description: '发明理解智能体',
        llm: pipelineInfra.llm,
        memory: pipelineInfra.memory,
        tools: pipelineInfra.tools,
        eventBus: pipelineInfra.eventBus,
      })

      const inventionResult = await inventionAgent.execute({
        title: TEST_DISCLOSURE.title,
        field: TEST_DISCLOSURE.field,
        technicalDisclosure: TEST_DISCLOSURE.disclosure,
      })

      expect(inventionResult).toBeDefined()
      expect(inventionResult.keyFeatures.length).toBeGreaterThan(0)

      // 步骤2: 对比文件分析
      const analyzerAgent = new PriorArtAnalyzerAgent({
        name: 'prior-art-analyzer',
        description: '对比文件分析智能体',
        llm: pipelineInfra.llm,
        memory: pipelineInfra.memory,
        tools: pipelineInfra.tools,
        eventBus: pipelineInfra.eventBus,
      })

      const analysisResult = await analyzerAgent.execute({
        document: {
          type: 'patent',
          title: TEST_PATENT.title,
          content: TEST_PATENT.abstract,
          metadata: { publicationNumber: TEST_PATENT.publicationNumber },
        },
        analysisDepth: 2,
        enableKnowledgeEnhancement: false,
      })

      expect(analysisResult).toBeDefined()

      // 步骤3: 对比报告生成
      const reportAgent = new ComparisonReportGeneratorAgent({
        name: 'comparison-report-generator',
        description: '对比分析报告生成智能体',
        llm: pipelineInfra.llm,
        memory: pipelineInfra.memory,
        tools: pipelineInfra.tools,
        eventBus: pipelineInfra.eventBus,
      })

      const reportResult = await reportAgent.execute({
        inventionUnderstanding: {
          technicalProblem: inventionResult.technicalProblem,
          technicalSolution: inventionResult.technicalSolution,
          technicalEffects: inventionResult.beneficialEffects,
          keyFeatures: inventionResult.keyFeatures,
        },
        priorArtAnalysis: [
          {
            patentInfo: {
              publicationNumber: 'CN1234567A',
              title: '传统散热器',
            },
            technicalAnalysis: {
              technicalProblems: { main: '效率不足', sub: [] },
              technicalSolution: {
                core: '金属散热片',
                keyFeatures: [{ feature: '金属散热片', necessity: 'essential' }],
              },
              technicalEffects: { main: '基本散热', sub: [] },
            },
            comparison: {
              similarity: 0.6,
              overlappingFeatures: ['散热基板'],
              distinctFeatures: ['相变材料'],
              novelty: true,
            },
          },
        ],
      })

      expect(reportResult).toBeDefined()
      expect(reportResult.closestPriorArt).toBeDefined()
      expect(reportResult.inventiveness).toBeDefined()

      // 验证事件收集
      eventCollector.stop()
      const eventTypes = eventCollector.events.map((e) => e.type)
      expect(eventTypes).toContain('agent:started')
      expect(eventTypes).toContain('agent:completed')
    })
  })
})
