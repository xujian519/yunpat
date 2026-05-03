import { describe, it, expect } from 'vitest'
import { SpecificationDrafterAgent } from '../src/SpecificationDrafterAgent.js'

describe('SpecificationDrafterAgent', () => {
  const mockLLM = {
    chat: async ({ messages }: { messages: any[] }) => {
      const lastMessage = messages[messages.length - 1].content

      if (lastMessage.includes('技术领域')) {
        return {
          message: {
            content: '本发明涉及人工智能领域，具体而言，涉及一种基于AI芯片的智能处理方法。',
          },
        }
      }
      if (lastMessage.includes('背景技术')) {
        return {
          message: {
            content:
              '现有技术存在效率低下的问题。传统方法无法满足实时处理需求。因此，需要提供一种更高效的处理方法。',
          },
        }
      }
      if (lastMessage.includes('发明内容')) {
        return {
          message: {
            content: JSON.stringify({
              technical_problem: '现有技术处理效率低，无法满足实时性要求',
              technical_solution: '使用AI芯片进行硬件加速，通过并行处理提升效率',
              beneficial_effects: '处理效率提升50%，能耗降低30%',
            }),
          },
        }
      }
      if (lastMessage.includes('附图说明')) {
        return { message: { content: '图1是本发明的系统结构示意图。' } }
      }
      if (lastMessage.includes('具体实施方式')) {
        return { message: { content: '实施例一：使用AI芯片进行数据处理...' } }
      }
      if (lastMessage.includes('摘要')) {
        return {
          message: { content: '本发明提供一种智能处理方法，使用AI芯片加速，效率提升显著。' },
        }
      }
      if (lastMessage.includes('质量检查')) {
        return {
          message: {
            content: JSON.stringify({
              disclosure: '充分公开',
              clarity: '清楚',
              completeness: '完整',
              support: '支持权利要求',
              potential_issues: [],
            }),
          },
        }
      }

      return { message: { content: '默认响应' } }
    },
  }

  const mockEventBus = {
    publish: () => {},
    subscribe: () => {},
  }

  const mockInput = {
    inventionUnderstanding: {
      technicalField: '人工智能',
      backgroundArt: '现有技术效率低',
      technicalProblem: '处理效率低',
      technicalSolution: '使用AI芯片',
      beneficialEffects: '效率提升50%',
      keyFeatures: ['AI芯片', '并行处理'],
      drawingDescriptions: ['系统结构示意图'],
    },
    claims: {
      independentClaims: [{ claimNumber: 1, fullText: '一种智能设备...', claimType: 'device' }],
      dependentClaims: [{ claimNumber: 2, content: '如权利要求1所述...', parentClaim: 1 }],
    },
  }

  it('应该成功撰写说明书', async () => {
    const agent = new SpecificationDrafterAgent({
      name: 'test-spec',
      description: '测试说明书撰写智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    })

    const result = await agent.execute(mockInput)

    expect(result.technicalField).toBeTruthy()
    expect(result.backgroundArt).toBeTruthy()
    expect(result.inventionContent.technicalProblem).toBeTruthy()
    expect(result.inventionContent.technicalSolution).toBeTruthy()
    expect(result.inventionContent.beneficialEffects).toBeTruthy()
    expect(result.drawingsDescription).toBeTruthy()
    expect(result.detailedDescription).toBeTruthy()
    expect(result.abstract).toBeTruthy()
    expect(result.qualityCheck.disclosure).toBeTruthy()
  })

  it('应该验证输入参数', async () => {
    const agent = new SpecificationDrafterAgent({
      name: 'test-spec',
      description: '测试说明书撰写智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    })

    await expect(agent.execute({ inventionUnderstanding: undefined as any })).rejects.toThrow(
      '技术领域不能为空'
    )
  })
})
