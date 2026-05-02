import { describe, it, expect } from 'vitest';
import { PatentTechnicalAnalyzerAgent } from '../src/PatentTechnicalAnalyzerAgent.js';

describe('PatentTechnicalAnalyzerAgent', () => {
  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          technical_analysis: {
            technical_problems: { main: '效率低下', sub: ['能耗高'] },
            technical_solution: {
              core: '使用AI优化',
              key_features: [
                { feature: '神经网络', necessity: 'essential' },
                { feature: '并行计算', necessity: 'optional' },
              ],
              implementation: '在云端部署',
            },
            technical_effects: { main: '效率提升50%', sub: ['能耗降低30%'] },
            drawings: [],
          },
          comparison: {
            similarity: 0.3,
            overlapping_features: ['数据处理'],
            distinct_features: ['AI优化'],
            novelty: true,
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
    patent: {
      publicationNumber: 'CN123456789',
      title: '一种智能处理方法',
      abstract: '本发明涉及一种智能处理方法，使用AI技术提升效率。',
    },
    inventionUnderstanding: {
      technicalProblem: '处理效率低',
      technicalSolution: '使用AI优化算法',
      keyFeatures: ['AI芯片', '并行处理'],
    },
  };

  it('应该成功分析专利技术', async () => {
    const agent = new PatentTechnicalAnalyzerAgent({
      name: 'test-analyzer',
      description: '测试分析智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    });

    const result = await agent.execute(mockInput);

    expect(result.technicalAnalysis.technicalProblems.main).toBe('效率低下');
    expect(result.technicalAnalysis.technicalSolution.keyFeatures).toHaveLength(2);
    expect(result.comparison.similarity).toBe(0.3);
    expect(result.comparison.novelty).toBe(true);
  });

  it('应该验证输入参数', async () => {
    const agent = new PatentTechnicalAnalyzerAgent({
      name: 'test-analyzer',
      description: '测试分析智能体',
      eventBus: mockEventBus,
      memory: {},
      tools: {},
      llm: mockLLM,
    });

    await expect(agent.execute({ patent: { publicationNumber: '', title: '', abstract: '' } }))
      .rejects.toThrow('专利公开号不能为空');
  });
});
