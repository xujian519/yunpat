import { describe, it, expect } from 'vitest'
import { DisclosureRefinerAgent } from '../src/DisclosureRefinerAgent.js'

describe('DisclosureRefinerAgent', () => {
  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          refined: {
            invention_title: '优化的智能处理方法',
            core_innovation: '使用专用AI芯片加速',
            technical_problem: '在边缘计算场景下的实时处理效率问题',
            technical_solution: '基于AI芯片的异构计算架构',
            technical_effects: ['实时处理', '低能耗'],
            features: {
              innovative: [{ feature: 'AI芯片', description: '专用硬件加速', source: 'invention' }],
              known: [{ feature: '数据采集', description: '常规传感器', source: 'prior_art' }],
              combination: [
                { feature: '异构计算', description: 'CPU+AI芯片协同', source: 'combination' },
              ],
            },
            protection_scope: {
              independent: '一种基于AI芯片的数据处理设备',
              dependent: ['进一步限定处理单元'],
            },
          },
          improvements: [{ category: '技术问题', description: '更精确描述', priority: 'high' }],
        }),
      },
    }),
  }

  const mockEventBus = {
    publish: () => {},
    subscribe: () => {},
  }

  const mockInput = {
    originalInvention: {
      technicalField: '人工智能',
      backgroundArt: '现有技术',
      technicalProblem: '效率低',
      technicalSolution: '使用AI',
      beneficialEffects: '效率高',
      keyFeatures: ['AI芯片'],
      drawingDescriptions: [],
      confidence: 0.8,
    },
    comparisonReport: {
      distinctFeatures: [{ feature: 'AI芯片', novelty: 'high', evidence: [] }],
      technicalProblem: { refined: '更精确的问题', refinementReason: '分析结果' },
      technicalSolution: { refined: { core: '专用芯片', innovative: [], obvious: [] } },
      technicalEffects: { refined: { unexpected: ['能耗低'], expected: [] } },
      inventiveness: { score: 0.85, keyFactors: [] },
    },
  }

  it('应该成功提炼发明理解', async () => {
    const agent = new DisclosureRefinerAgent({
      name: 'test-refiner',
      description: '测试提炼智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
      enableKnowledgeGraph: false,
    })

    const result = await agent.execute(mockInput)

    expect(result.refined.inventionTitle).toBe('优化的智能处理方法')
    expect(result.refined.coreInnovation).toBe('使用专用AI芯片加速')
    expect(result.refined.features.innovative).toHaveLength(1)
    expect(result.refined.features.known).toHaveLength(1)
    expect(result.improvements).toHaveLength(1)
    expect(result.improvements[0].priority).toBe('high')
  })

  it('应该验证输入参数', async () => {
    const agent = new DisclosureRefinerAgent({
      name: 'test-refiner',
      description: '测试提炼智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
      enableKnowledgeGraph: false,
    })

    await expect(
      agent.execute({
        originalInvention: undefined as any,
        comparisonReport: { distinctFeatures: [] },
      })
    ).rejects.toThrow('原始发明理解不能为空')
  })
})
