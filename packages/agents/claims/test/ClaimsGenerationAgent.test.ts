import { describe, it, expect } from 'vitest';
import { ClaimsGenerationAgent, type ClaimGeneratorInput } from '../src/ClaimsGenerationAgent.js';

describe('ClaimsGenerationAgent', () => {
  const mockEventBus = {
    publish: () => {},
    subscribe: () => {},
  };

  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          independent_claims: [
            {
              claim_number: 1,
              claim_type: 'device',
              preamble: '一种智能设备',
              transition: '其特征在于',
              body: '包括处理器和存储器',
              full_text: '一种智能设备，其特征在于：包括处理器和存储器。',
              essential_features: ['处理器', '存储器'],
            },
          ],
          dependent_claims: [
            {
              claim_number: 2,
              parent_claim: 1,
              content: '如权利要求1所述的智能设备，其特征在于：所述处理器为AI芯片。',
              additional_features: ['AI芯片'],
              limitation_type: 'further_limitation',
            },
          ],
          layout_strategy: '独立权利要求保护核心发明，从属权利要求逐步限定',
          protection_scope_analysis: '保护范围覆盖所有包含处理器和存储器的智能设备',
        }),
      },
    }),
  };

  const mockInput: ClaimGeneratorInput = {
    inventionUnderstanding: {
      technicalField: '人工智能',
      backgroundArt: '现有技术存在效率低下的问题',
      technicalProblem: '如何提高处理效率',
      technicalSolution: '使用AI芯片加速处理',
      beneficialEffects: '效率提升50%',
      keyFeatures: ['AI芯片', '并行处理', '动态调度'],
      drawingDescriptions: [],
      confidence: 0.9,
    },
  };

  it('应该成功生成权利要求', async () => {
    const agent = new ClaimsGenerationAgent({
      name: 'test-claims',
      description: '测试权利要求生成',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    });

    const result = await agent.execute(mockInput);

    expect(result.independentClaims).toHaveLength(1);
    expect(result.dependentClaims).toHaveLength(1);
    expect(result.independentClaims[0].claimNumber).toBe(1);
    expect(result.independentClaims[0].essentialFeatures).toContain('处理器');
    expect(result.dependentClaims[0].parentClaim).toBe(1);
    expect(result.layoutStrategy).toBeTruthy();
    expect(result.protectionScopeAnalysis).toBeTruthy();
  });

  it('应该验证输入参数', async () => {
    const agent = new ClaimsGenerationAgent({
      name: 'test-claims',
      description: '测试权利要求生成',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    });

    await expect(agent.execute({ inventionUnderstanding: undefined as any })).rejects.toThrow('发明理解结果不能为空');
    await expect(agent.execute({
      inventionUnderstanding: { ...mockInput.inventionUnderstanding, technicalProblem: '' }
    })).rejects.toThrow('技术问题不能为空');
  });

  it('应该处理LLM返回的文本格式', async () => {
    const textLLM = {
      chat: async () => ({
        message: {
          content: `1. 一种智能设备，其特征在于：包括处理器和存储器。
2. 如权利要求1所述的智能设备，其特征在于：所述处理器为AI芯片。`,
        },
      }),
    };

    const agent = new ClaimsGenerationAgent({
      name: 'test-claims',
      description: '测试权利要求生成',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: textLLM,
    });

    const result = await agent.execute(mockInput);

    expect(result.independentClaims.length).toBeGreaterThan(0);
    expect(result.dependentClaims.length).toBeGreaterThan(0);
  });
});
