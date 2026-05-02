import { describe, it, expect } from 'vitest';
import { ComparisonReportGeneratorAgent } from '../src/ComparisonReportGeneratorAgent.js';

describe('ComparisonReportGeneratorAgent', () => {
  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          closest_prior_art: {
            publication_number: 'CN123456789',
            title: '现有技术1',
            similarity: 0.8,
            reason: '技术方案最相似',
          },
          distinct_features: [
            { feature: 'AI芯片', novelty: 'high', evidence: ['未在现有技术中公开'] },
          ],
          technical_problem: {
            original: '效率低',
            refined: '在特定场景下的效率问题',
            refinement_reason: '更精确地描述问题',
          },
          technical_solution: {
            original: '使用AI',
            refined: { core: '专用AI芯片', innovative: ['硬件加速'], obvious: ['软件优化'] },
          },
          technical_effects: {
            original: ['效率高'],
            refined: { unexpected: ['能耗降低50%'], expected: ['速度提升'] },
          },
          inventiveness: {
            score: 0.85,
            key_factors: ['技术效果出乎意料'],
          },
          protection_scope: {
            independent_claims: ['一种智能设备'],
            dependent_claims: [['进一步限定']],
            breadth: '适中',
          },
        }),
      },
    }),
  };

  const mockEventBus = {
    publish: () => {},
    subscribe: () => {},
  };

  const mockInput = {
    inventionUnderstanding: {
      technicalProblem: '效率低',
      technicalSolution: '使用AI',
      technicalEffects: '效率高',
      keyFeatures: ['AI芯片'],
    },
    priorArtAnalysis: [
      {
        patentInfo: { publicationNumber: 'CN123456789', title: '现有技术1' },
        technicalAnalysis: {
          technicalProblems: { main: '效率低', sub: [] },
          technicalSolution: { core: '传统方法', keyFeatures: [] },
          technicalEffects: { main: '一般', sub: [] },
        },
        comparison: {
          similarity: 0.8,
          overlappingFeatures: ['数据处理'],
          distinctFeatures: ['AI优化'],
          novelty: true,
        },
      },
    ],
  };

  it('应该成功生成对比报告', async () => {
    const agent = new ComparisonReportGeneratorAgent({
      name: 'test-comparison',
      description: '测试对比报告智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    });

    const result = await agent.execute(mockInput);

    expect(result.closestPriorArt.publicationNumber).toBe('CN123456789');
    expect(result.distinctFeatures).toHaveLength(1);
    expect(result.distinctFeatures[0].novelty).toBe('high');
    expect(result.inventiveness.score).toBe(0.85);
    expect(result.protectionScope.independentClaims).toHaveLength(1);
  });

  it('应该验证输入参数', async () => {
    const agent = new ComparisonReportGeneratorAgent({
      name: 'test-comparison',
      description: '测试对比报告智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    });

    await expect(agent.execute({ inventionUnderstanding: undefined as any, priorArtAnalysis: [] }))
      .rejects.toThrow('发明理解结果不能为空');
  });
});
