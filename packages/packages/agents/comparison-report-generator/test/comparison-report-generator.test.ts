import { describe, it, expect, beforeEach } from 'vitest'
import { ComparisonReportGeneratorAgent } from '../src/ComparisonReportGeneratorAgent'

describe('ComparisonReportGeneratorAgent', () => {
  let agent: ComparisonReportGeneratorAgent

  beforeEach(() => {
    agent = new ComparisonReportGeneratorAgent({
      name: 'test-comparison-report-generator',
      description: '测试用对比报告生成Agent',
      eventBus: {
        publish: () => {},
      },
      memory: {},
      tools: {},
      llm: {},
    })
  })

  describe('特征提取', () => {
    it('应该从申请中提取特征', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种包括"控制器"和"传感器"的测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
            inventionContent: '本发明提供一种测试装置',
            embodiment: '具体实施方式',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN123456789A',
            title: '现有测试装置',
            abstract: '一种测试装置，包括处理器',
            claims: ['一种测试装置'],
            description: '测试装置描述',
          },
        ],
      }

      const plan = await agent.plan(input, {} as any)

      expect(plan.extractedFeatures.application.length).toBeGreaterThan(0)
      expect(plan.extractedFeatures.application).toContain('控制器')
      expect(plan.extractedFeatures.application).toContain('传感器')
    })

    it('应该从现有技术中提取特征', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN123456789A',
            title: '现有测试装置',
            abstract: '一种测试装置，包括处理器和存储器',
            claims: ['一种测试装置，包括处理器'],
            description: '测试装置描述',
          },
        ],
      }

      const plan = await agent.plan(input, {} as any)

      expect(plan.extractedFeatures.priorArt[0].length).toBeGreaterThan(0)
    })
  })

  describe('技术差异识别', () => {
    it('应该识别技术差异', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种包括"量子处理器"的测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN123456789A',
            title: '传统测试装置',
            abstract: '一种测试装置，包括传统处理器',
            claims: ['一种测试装置，包括传统处理器'],
            description: '传统测试装置描述',
          },
        ],
      }

      const result = await agent.execute(input)

      expect(result.analysis.technicalDifferences.length).toBeGreaterThan(0)
    })
  })

  describe('优势识别', () => {
    it('应该识别申请的优势', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
            {
              type: 'dependent' as const,
              number: 2,
              content: '根据权利要求1所述的装置',
              dependsOn: 1,
            },
            {
              type: 'dependent' as const,
              number: 3,
              content: '根据权利要求1所述的装置',
              dependsOn: 1,
            },
          ],
          specification: {
            technicalField: '测试技术领域',
            backgroundArt: '现有技术',
            inventionContent: '本发明内容',
            embodiment: '具体实施方式',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [],
      }

      const result = await agent.execute(input)

      expect(result.analysis.advantages.length).toBeGreaterThan(0)
    })
  })

  describe('劣势识别', () => {
    it('应该识别申请的劣势', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
            embodiment: '简短',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN1',
            title: '测试装置1',
            abstract: '测试',
            claims: ['测试'],
            description: '测试',
          },
          {
            patentId: 'CN2',
            title: '测试装置2',
            abstract: '测试',
            claims: ['测试'],
            description: '测试',
          },
          {
            patentId: 'CN3',
            title: '测试装置3',
            abstract: '测试',
            claims: ['测试'],
            description: '测试',
          },
          {
            patentId: 'CN4',
            title: '测试装置4',
            abstract: '测试',
            claims: ['测试'],
            description: '测试',
          },
          {
            patentId: 'CN5',
            title: '测试装置5',
            abstract: '测试',
            claims: ['测试'],
            description: '测试',
          },
          {
            patentId: 'CN6',
            title: '测试装置6',
            abstract: '测试',
            claims: ['测试'],
            description: '测试',
          },
        ],
      }

      const result = await agent.execute(input)

      expect(result.analysis.disadvantages.length).toBeGreaterThan(0)
    })
  })

  describe('报告生成', () => {
    it('应该生成完整的报告', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
            backgroundArt: '现有技术',
            inventionContent: '本发明内容',
            embodiment: '具体实施方式',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN123456789A',
            title: '现有测试装置',
            abstract: '一种测试装置',
            claims: ['一种测试装置'],
            description: '测试装置描述',
          },
        ],
      }

      const result = await agent.execute(input)

      expect(result.report).toBeDefined()
      expect(result.report.title).toContain('测试装置')
      expect(result.report.summary).toBeDefined()
      expect(result.report.sections.length).toBeGreaterThan(0)
      expect(result.report.conclusions.length).toBeGreaterThan(0)
      expect(result.report.recommendations.length).toBeGreaterThan(0)
    })

    it('应该生成对比表格', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN123456789A',
            title: '现有测试装置',
            abstract: '一种测试装置',
            claims: ['一种测试装置'],
            description: '测试装置描述',
          },
        ],
        options: {
          includeTables: true,
        },
      }

      const result = await agent.execute(input)

      const comparisonSection = result.report.sections.find((s) => s.heading === '三、技术对比')
      expect(comparisonSection).toBeDefined()
      expect(comparisonSection?.tables).toBeDefined()
      expect(comparisonSection?.tables?.length).toBeGreaterThan(0)
    })
  })

  describe('新颖性评估', () => {
    it('应该评估新颖性', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种包括"量子处理器"的测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [
          {
            patentId: 'CN123456789A',
            title: '传统测试装置',
            abstract: '一种测试装置，包括传统处理器',
            claims: ['一种测试装置，包括传统处理器'],
            description: '传统测试装置描述',
          },
        ],
      }

      const result = await agent.execute(input)

      expect(result.analysis.novelty).toBeDefined()
      expect(result.analysis.novelty.length).toBeGreaterThan(0)
    })
  })

  describe('创造性评估', () => {
    it('应该评估创造性', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
            {
              type: 'dependent' as const,
              number: 2,
              content: '根据权利要求1所述的装置，其特征在于所述控制器为单片机',
              dependsOn: 1,
            },
          ],
          specification: {
            technicalField: '测试技术领域',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [],
      }

      const result = await agent.execute(input)

      expect(result.analysis.inventiveStep).toBeDefined()
      expect(result.analysis.inventiveStep.length).toBeGreaterThan(0)
    })
  })

  describe('元数据', () => {
    it('应该生成元数据', async () => {
      const input = {
        application: {
          claims: [
            {
              type: 'independent' as const,
              number: 1,
              content: '一种测试装置',
            },
          ],
          specification: {
            technicalField: '测试技术领域',
          },
          inventionTitle: '测试装置',
        },
        priorArt: [],
        options: {
          format: 'markdown' as const,
        },
      }

      const result = await agent.execute(input)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.format).toBe('markdown')
      expect(result.metadata.version).toBeDefined()
      expect(result.metadata.generatedAt).toBeInstanceOf(Date)
    })
  })
})
