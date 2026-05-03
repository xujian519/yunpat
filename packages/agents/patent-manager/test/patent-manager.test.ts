import { describe, it, expect, vi } from 'vitest';
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core';
import { PatentManagerAgent } from '../src/PatentManagerAgent.js';

describe('PatentManagerAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    return new PatentManagerAgent({
      name: 'test-patent-manager',
      description: '测试专利管理智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: { content: '测试管理报告' },
        }),
      } as any,
      enableKnowledge: false,
      enableTemplates: false,
    });
  };

  const createSamplePatent = (applicationNumber: string = 'CN202310000000.0') => ({
    applicationNumber,
    title: '测试专利',
    applicant: '测试公司',
    inventors: ['张三', '李四'],
    patentType: 'invention' as const,
    filingDate: new Date('2023-01-01'),
    status: 'filed' as const,
  });

  it('should be instantiable', () => {
    const agent = createAgent();
    expect(agent).toBeDefined();
  });

  describe('add_patent', () => {
    it('should add patent successfully', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.applicationNumber).toBe('CN202310000000.0');
    });

    it('should throw error for empty application number', async () => {
      const agent = createAgent();
      await expect(
        agent.execute({
          operation: 'add_patent',
          patent: { ...createSamplePatent(), applicationNumber: '' },
        })
      ).rejects.toThrow('申请号不能为空');
    });

    it('should throw error for empty title', async () => {
      const agent = createAgent();
      await expect(
        agent.execute({
          operation: 'add_patent',
          patent: { ...createSamplePatent(), title: '' },
        })
      ).rejects.toThrow('专利标题不能为空');
    });
  });

  describe('update_patent', () => {
    it('should update patent successfully', async () => {
      const agent = createAgent();

      // 先添加
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      // 更新
      const result = await agent.execute({
        operation: 'update_patent',
        patent: { ...createSamplePatent(), title: '更新后的标题' },
      });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('更新后的标题');
    });

    it('should throw error for non-existent patent', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        operation: 'update_patent',
        patent: createSamplePatent('NONEXISTENT'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('专利不存在');
    });
  });

  describe('remove_patent', () => {
    it('should remove patent successfully', async () => {
      const agent = createAgent();

      // 先添加
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      // 删除
      const result = await agent.execute({
        operation: 'remove_patent',
        applicationNumber: 'CN202310000000.0',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should throw error for non-existent patent', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        operation: 'remove_patent',
        applicationNumber: 'NONEXISTENT',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('专利不存在');
    });
  });

  describe('get_patent', () => {
    it('should get patent successfully', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      const result = await agent.execute({
        operation: 'get_patent',
        applicationNumber: 'CN202310000000.0',
      });

      expect(result.success).toBe(true);
      expect(result.data.applicationNumber).toBe('CN202310000000.0');
    });

    it('should throw error for non-existent patent', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        operation: 'get_patent',
        applicationNumber: 'NONEXISTENT',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('专利不存在');
    });
  });

  describe('list_patents', () => {
    it('should list all patents', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent('CN001'),
      });
      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent('CN002'),
      });

      const result = await agent.execute({
        operation: 'list_patents',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter patents by status', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: { ...createSamplePatent('CN001'), status: 'filed' as const },
      });
      await agent.execute({
        operation: 'add_patent',
        patent: { ...createSamplePatent('CN002'), status: 'granted' as const },
      });

      const result = await agent.execute({
        operation: 'list_patents',
        query: { status: 'filed' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('filed');
    });

    it('should filter patents by type', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: { ...createSamplePatent('CN001'), patentType: 'invention' },
      });
      await agent.execute({
        operation: 'add_patent',
        patent: { ...createSamplePatent('CN002'), patentType: 'utility' },
      });

      const result = await agent.execute({
        operation: 'list_patents',
        query: { patentType: 'invention' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].patentType).toBe('invention');
    });
  });

  describe('deadlines', () => {
    it('should add deadline successfully', async () => {
      const agent = createAgent();

      const result = await agent.execute({
        operation: 'add_deadline',
        applicationNumber: 'CN202310000000.0',
        deadline: {
          type: 'oa_response',
          deadlineDate: new Date('2024-12-31'),
          description: 'OA答复期限',
          priority: 'high',
          completed: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.applicationNumber).toBe('CN202310000000.0');
    });

    it('should get upcoming deadlines', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_deadline',
        applicationNumber: 'CN001',
        deadline: {
          type: 'oa_response',
          deadlineDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15天后
          description: '即将到期',
          priority: 'high',
          completed: false,
        },
      });

      const result = await agent.execute({
        operation: 'get_upcoming_deadlines',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('fees', () => {
    it('should add fee successfully', async () => {
      const agent = createAgent();

      const result = await agent.execute({
        operation: 'add_fee',
        applicationNumber: 'CN202310000000.0',
        fee: {
          feeType: '申请费',
          amount: 1000,
          currency: 'CNY',
          dueDate: new Date('2024-12-31'),
          status: 'pending',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.applicationNumber).toBe('CN202310000000.0');
    });

    it('should get pending fees', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_fee',
        applicationNumber: 'CN001',
        fee: {
          feeType: '年费',
          amount: 2000,
          currency: 'CNY',
          dueDate: new Date(), // 今天到期
          status: 'pending',
        },
      });

      const result = await agent.execute({
        operation: 'get_pending_fees',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('get_portfolio', () => {
    it('should get portfolio overview', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      const result = await agent.execute({
        operation: 'get_portfolio',
      });

      expect(result.success).toBe(true);
      expect(result.data.patents).toBeDefined();
      expect(result.data.statistics).toBeDefined();
      expect(result.data.statistics.total).toBe(1);
    });

    it('should include risk alerts', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      await agent.execute({
        operation: 'add_fee',
        applicationNumber: 'CN202310000000.0',
        fee: {
          feeType: '年费',
          amount: 2000,
          currency: 'CNY',
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10天前到期
          status: 'pending',
        },
      });

      const result = await agent.execute({
        operation: 'get_portfolio',
      });

      expect(result.success).toBe(true);
      expect(result.data.riskAlerts).toBeDefined();
      expect(result.data.riskAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('generate_report', () => {
    it('should generate management report', async () => {
      const agent = createAgent();

      await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      const result = await agent.execute({
        operation: 'generate_report',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
    });
  });

  describe('metadata', () => {
    it('should include operation metadata', async () => {
      const agent = createAgent();
      const result = await agent.execute({
        operation: 'add_patent',
        patent: createSamplePatent(),
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.operation).toBe('add_patent');
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });
  });
});
