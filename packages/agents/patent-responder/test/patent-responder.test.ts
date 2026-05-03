import { describe, it, expect, vi } from 'vitest';
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core';
import { PatentResponderAgent } from '../src/PatentResponderAgent.js';

describe('PatentResponderAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    return new PatentResponderAgent({
      name: 'test-patent-responder',
      description: '测试专利答复智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: { content: '{"summary":"测试分析","keyIssues":[],"overcomeProbability":60}' },
        }),
      } as any,
      enableKnowledge: false,
      enableTemplates: false,
    });
  };

  const createValidInput = () => ({
    officeAction: {
      applicationNumber: 'CN202310000000.0',
      patentTitle: '测试专利',
      officeActionContent: '本申请权利要求1-3不具备创造性。',
      citedReferences: [
        {
          publicationNumber: 'CN112345678A',
          title: '对比文件1',
          relevance: '用于评价创造性',
        },
      ],
      rejectionTypes: ['inventiveness'],
    },
    originalApplication: {
      title: '测试专利',
      claims: '1. 一种测试方法，其特征在于...',
      description: '本发明提供一种测试方法...',
    },
    strategyPreference: 'moderate' as const,
    documentType: 'cn' as const,
  });

  it('should be instantiable', () => {
    const agent = createAgent();
    expect(agent).toBeDefined();
  });

  it('should throw error for empty office action content', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        ...createValidInput(),
        officeAction: {
          ...createValidInput().officeAction,
          officeActionContent: '',
        },
      })
    ).rejects.toThrow('审查意见内容不能为空');
  });

  it('should throw error for empty claims', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        ...createValidInput(),
        originalApplication: {
          ...createValidInput().originalApplication,
          claims: '',
        },
      })
    ).rejects.toThrow('原始权利要求书不能为空');
  });

  it('should throw error for empty description', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        ...createValidInput(),
        originalApplication: {
          ...createValidInput().originalApplication,
          description: '',
        },
      })
    ).rejects.toThrow('原始说明书不能为空');
  });

  it('should execute with valid input', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.strategy).toBeDefined();
    expect(result.responseDocument).toBeDefined();
    expect(result.nextSteps).toBeDefined();
  });

  it('should analyze office action correctly', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.analysis.summary).toBeDefined();
    expect(result.analysis.keyIssues).toBeInstanceOf(Array);
    expect(result.analysis.overcomeProbability).toBeGreaterThanOrEqual(0);
    expect(result.analysis.overcomeProbability).toBeLessThanOrEqual(100);
  });

  it('should generate response strategy', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.strategy.overallStrategy).toBeDefined();
    expect(['argue', 'amend', 'abandon', 'appeal']).toContain(result.strategy.overallStrategy);
    expect(result.strategy.successProbability).toBeGreaterThanOrEqual(0);
    expect(result.strategy.successProbability).toBeLessThanOrEqual(100);
  });

  it('should generate response document', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.responseDocument.documentType).toBe('cn');
    expect(result.responseDocument.responseLetter).toBeDefined();
    expect(result.responseDocument.detailedArguments).toBeInstanceOf(Array);
    expect(result.responseDocument.metrics).toBeDefined();
  });

  it('should generate next steps', async () => {
    const agent = createAgent();
    const result = await agent.execute(createValidInput());

    expect(result.nextSteps).toBeInstanceOf(Array);
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });

  it('should throw error when LLM fails', async () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    const agent = new PatentResponderAgent({
      name: 'test-patent-responder',
      description: '测试专利答复智能体',
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

  describe('exportToFormat', () => {
    it('should export to CN format', async () => {
      const agent = createAgent();

      // 先执行答复
      const executeResult = await agent.execute(createValidInput());

      // 导出为 CN 格式
      const result = await agent.exportToFormat(executeResult, createValidInput(), 'cn');

      expect(result.format).toBe('cn');
      expect(result.content).toBeDefined();
      expect(result.content).toContain('审查意见答复书');
      expect(result.content).toContain('答复书');
      expect(result.metadata.applicationNumber).toBe('CN202310000000.0');
      expect(result.metadata.patentTitle).toBe('测试专利');
    });

    it('should export to PCT format', async () => {
      const agent = createAgent();

      const input = {
        ...createValidInput(),
        documentType: 'pct',
      };
      const executeResult = await agent.execute(input);

      const result = await agent.exportToFormat(executeResult, input, 'pct');

      expect(result.format).toBe('pct');
      expect(result.content).toBeDefined();
      expect(result.content).toContain('RESPONSE TO OFFICE ACTION');
    });

    it('should export to US format', async () => {
      const agent = createAgent();

      const input = {
        ...createValidInput(),
        documentType: 'us',
      };
      const executeResult = await agent.execute(input);

      const result = await agent.exportToFormat(executeResult, input, 'us');

      expect(result.format).toBe('us');
      expect(result.content).toBeDefined();
      expect(result.content).toContain('USPTO');
    });

    it('should throw error when exporting before execution', async () => {
      const agent = createAgent();

      // 传入空结果
      const emptyResult = {} as any;
      const emptyInput = {} as any;

      // 应该抛出错误
      await expect(
        agent.exportToFormat(emptyResult, emptyInput, 'cn')
      ).rejects.toThrow();
    });

    it('should include metadata in export', async () => {
      const agent = createAgent();

      const input = createValidInput();
      const executeResult = await agent.execute(input);

      const result = await agent.exportToFormat(executeResult, input, 'cn');

      expect(result.metadata).toBeDefined();
      expect(result.metadata.exportDate).toBeInstanceOf(Date);
      expect(result.metadata.argumentCount).toBeGreaterThanOrEqual(0);
      expect(result.metadata.wordCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('strategy preferences', () => {
    it('should handle aggressive strategy', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        ...createValidInput(),
        strategyPreference: 'aggressive',
      });

      expect(result.strategy).toBeDefined();
    });

    it('should handle moderate strategy', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        ...createValidInput(),
        strategyPreference: 'moderate',
      });

      expect(result.strategy).toBeDefined();
    });

    it('should handle conservative strategy', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        ...createValidInput(),
        strategyPreference: 'conservative',
      });

      expect(result.strategy).toBeDefined();
    });
  });
});
