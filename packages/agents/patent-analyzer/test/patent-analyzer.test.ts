import { describe, it, expect, vi } from 'vitest';
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core';
import { PatentAnalyzerAgent } from '../src/PatentAnalyzerAgent.js';

describe('PatentAnalyzerAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    return new PatentAnalyzerAgent({
      name: 'test-patent-analyzer',
      description: '测试专利分析智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: { content: '{"field":"AI","problems":[],"solution":"测试","effects":[],"keyFeatures":[]}' },
        }),
      } as any,
      enableKnowledge: false,
      enableTemplates: false,
    });
  };

  const createValidInput = () => ({
    patent: {
      publicationNumber: 'CN112345678A',
      title: '一种基于深度学习的图像识别方法',
      abstract: '本发明公开了一种图像识别方法...',
      applicant: '测试科技有限公司',
      inventors: ['张三', '李四'],
      publicationDate: '2023-10-15',
      fullText: '权利要求书\n\n1. 一种图像识别方法...',
    },
    analysisTypes: ['technical', 'claims', 'creativity', 'risk'] as const,
  });

  it('should be instantiable', () => {
    const agent = createAgent();
    expect(agent).toBeDefined();
  });

  it('should throw error for empty publication number', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        ...createValidInput(),
        patent: { ...createValidInput().patent, publicationNumber: '' },
      })
    ).rejects.toThrow('专利公开号不能为空');
  });

  it('should throw error for empty title', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        ...createValidInput(),
        patent: { ...createValidInput().patent, title: '' },
      })
    ).rejects.toThrow('专利标题不能为空');
  });

  it('should throw error for empty abstract', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        ...createValidInput(),
        patent: { ...createValidInput().patent, abstract: '' },
      })
    ).rejects.toThrow('专利摘要不能为空');
  });

  it('should execute with valid input', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result).toBeDefined();
    expect(result.basicInfo).toBeDefined();
    expect(result.technicalAnalysis).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });

  it('should analyze technical aspects', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.technicalAnalysis).toBeDefined();
    expect(result.technicalAnalysis.field).toBeDefined();
    expect(result.technicalAnalysis.problems).toBeInstanceOf(Array);
    expect(result.technicalAnalysis.solution).toBeDefined();
    expect(result.technicalAnalysis.effects).toBeInstanceOf(Array);
    expect(result.technicalAnalysis.keyFeatures).toBeInstanceOf(Array);
  });

  it('should analyze claims when full text provided', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.claimsAnalysis).toBeDefined();
    expect(result.claimsAnalysis.independentCount).toBeGreaterThanOrEqual(0);
    expect(result.claimsAnalysis.dependentCount).toBeGreaterThanOrEqual(0);
    expect(result.claimsAnalysis.protectionScope).toBeDefined();
    expect(result.claimsAnalysis.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.claimsAnalysis.qualityScore).toBeLessThanOrEqual(100);
  });

  it('should assess creativity', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.creativityAssessment).toBeDefined();
    expect(['inventive', 'obvious', 'lacksInventiveness']).toContain(result.creativityAssessment.level);
    expect(result.creativityAssessment.score).toBeGreaterThanOrEqual(0);
    expect(result.creativityAssessment.score).toBeLessThanOrEqual(100);
    expect(result.creativityAssessment.reasoning).toBeDefined();
  });

  it('should assess risks', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.riskAssessment).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(result.riskAssessment.invalidityRisk);
    expect(['low', 'medium', 'high']).toContain(result.riskAssessment.infringementRisk);
    expect(result.riskAssessment.riskFactors).toBeInstanceOf(Array);
  });

  it('should generate recommendations', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.recommendations).toBeInstanceOf(Array);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should handle partial analysis types', async () => {
    const agent = createAgent();
    const result = await agent.execute({
      ...createValidInput(),
      analysisTypes: ['technical'] as const,
    });

    expect(result.technicalAnalysis).toBeDefined();
    // 其他分析可能为空或默认值
  });

  it('should include basic info', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.basicInfo.publicationNumber).toBe('CN112345678A');
    expect(result.basicInfo.title).toBe('一种基于深度学习的图像识别方法');
    expect(result.basicInfo.applicant).toBe('测试科技有限公司');
    expect(result.basicInfo.publicationDate).toBe('2023-10-15');
  });

  it('should throw error when LLM fails', async () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    const agent = new PatentAnalyzerAgent({
      name: 'test-patent-analyzer',
      description: '测试专利分析智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockRejectedValue(new Error('LLM API 错误')),
      } as any,
      enableKnowledge: false,
      enableTemplates: false,
    });

    await expect(agent.execute(createValidInput())).rejects.toThrow();
  });

  describe('prior art analysis', () => {
    it('should analyze prior art when comparison patents provided', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        ...createValidInput(),
        analysisTypes: ['priorArt'] as const,
        comparisonPatents: [
          {
            publicationNumber: 'CN987654321A',
            title: '相关专利',
            abstract: '相关技术方案',
          },
        ],
      });

      expect(result.priorArtAnalysis).toBeDefined();
      expect(result.priorArtAnalysis.closestPriorArt).toBeInstanceOf(Array);
      expect(result.priorArtAnalysis.innovations).toBeInstanceOf(Array);
    });

    it('should return empty prior art analysis when no comparison patents', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        ...createValidInput(),
        analysisTypes: ['priorArt'] as const,
      });

      expect(result.priorArtAnalysis).toBeDefined();
      expect(result.priorArtAnalysis.closestPriorArt).toEqual([]);
      expect(result.priorArtAnalysis.innovations).toEqual([]);
    });
  });

  describe('full analysis', () => {
    it('should perform all analysis types when specified', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        ...createValidInput(),
        analysisTypes: ['technical', 'claims', 'priorArt', 'creativity', 'risk'] as const,
      });

      expect(result.technicalAnalysis).toBeDefined();
      expect(result.claimsAnalysis).toBeDefined();
      expect(result.creativityAssessment).toBeDefined();
      expect(result.riskAssessment).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});
