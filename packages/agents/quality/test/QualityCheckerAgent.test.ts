import { describe, it, expect } from 'vitest'
import { QualityCheckerAgent } from '../src/QualityCheckerAgent.js'

describe('QualityCheckerAgent', () => {
  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          score: 90,
          protection_scope: { status: 'pass', issues: [] },
          clarity: { status: 'pass', issues: [] },
          support: { status: 'warning', issues: ['说明书支持不够'] },
        }),
      },
    }),
  }

  const mockEventBus = {
    publish: () => {},
    subscribe: () => {},
  }

  const mockInput = {
    claims: {
      independentClaims: [
        {
          claimNumber: 1,
          fullText: '一种智能设备，其特征在于：包括处理器。',
          claimType: 'device',
          essentialFeatures: ['处理器'],
        },
      ],
      dependentClaims: [
        {
          claimNumber: 2,
          content: '如权利要求1所述的智能设备，其特征在于：还包括存储器。',
          parentClaim: 1,
          additionalFeatures: ['存储器'],
        },
      ],
    },
    specification: {
      technicalField: '人工智能',
      backgroundArt: '现有技术效率低',
      inventionContent: {
        technicalProblem: '效率低',
        technicalSolution: '使用AI芯片',
        beneficialEffects: '效率高',
      },
      drawingsDescription: '图1是系统示意图',
      detailedDescription: '实施例一：使用AI芯片...',
      abstract: '本发明提供一种智能设备...',
    },
  }

  it('应该成功执行质量检查', async () => {
    const agent = new QualityCheckerAgent({
      name: 'test-quality',
      description: '测试质量检查智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    })

    const result = await agent.execute(mockInput)

    expect(result.overallScore).toBeGreaterThan(0)
    expect(result.claimsCheck.score).toBeGreaterThan(0)
    expect(result.specificationCheck.score).toBeGreaterThan(0)
    expect(result.formalCheck.score).toBeGreaterThan(0)
    expect(result.formalCheck.errors.length).toBe(0)
  })

  it('应该检测权利要求编号重复', async () => {
    const agent = new QualityCheckerAgent({
      name: 'test-quality',
      description: '测试质量检查智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    })

    const badInput = {
      ...mockInput,
      claims: {
        independentClaims: [
          { claimNumber: 1, fullText: '权利要求1', claimType: 'device', essentialFeatures: [] },
          { claimNumber: 1, fullText: '权利要求1重复', claimType: 'device', essentialFeatures: [] },
        ],
        dependentClaims: [],
      },
    }

    const result = await agent.execute(badInput)

    const duplicateErrors = result.formalCheck.errors.filter((e) => e.type === '编号重复')
    expect(duplicateErrors.length).toBeGreaterThan(0)
  })

  it('应该检测引用错误', async () => {
    const agent = new QualityCheckerAgent({
      name: 'test-quality',
      description: '测试质量检查智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    })

    const badInput = {
      ...mockInput,
      claims: {
        independentClaims: [
          { claimNumber: 1, fullText: '权利要求1', claimType: 'device', essentialFeatures: [] },
        ],
        dependentClaims: [
          { claimNumber: 2, content: '如权利要求3所述...', parentClaim: 3, additionalFeatures: [] },
        ],
      },
    }

    const result = await agent.execute(badInput)

    const referenceErrors = result.formalCheck.errors.filter((e) => e.type === '引用错误')
    expect(referenceErrors.length).toBeGreaterThan(0)
  })

  it('应该验证输入参数', async () => {
    const agent = new QualityCheckerAgent({
      name: 'test-quality',
      description: '测试质量检查智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    })

    await expect(
      agent.execute({ claims: undefined as any, specification: undefined as any })
    ).rejects.toThrow('权利要求不能为空')
  })
})
