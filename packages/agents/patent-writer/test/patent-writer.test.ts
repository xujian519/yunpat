import { describe, it, expect, vi } from 'vitest';
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core';
import { PatentWriterAgent } from '../src/PatentWriterAgent.js';

describe('PatentWriterAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    return new PatentWriterAgent({
      name: 'test-patent-writer',
      description: '测试专利撰写智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: { content: '测试响应' },
        }),
      } as any,
      enableKnowledge: false,
      enableTemplates: false,
    });
  };

  it('should be instantiable', () => {
    const agent = createAgent();
    expect(agent).toBeDefined();
  });

  it('should throw error for empty title', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        title: '',
        field: '人工智能',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('发明名称不能为空');
  });

  it('should throw error for empty field', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('技术领域不能为空');
  });

  it('should throw error for empty applicant', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        applicant: '',
        inventors: ['张三'],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('申请人不能为空');
  });

  it('should throw error for empty disclosure', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '',
        drawings: [],
      })
    ).rejects.toThrow('技术交底书不能为空');
  });

  it('should throw error for empty inventors', async () => {
    const agent = createAgent();
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        applicant: '测试公司',
        inventors: [],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('发明人列表不能为空');
  });

  it('should execute with valid input', async () => {
    const agent = createAgent();
    const result = await agent.execute({
      title: '一种基于深度学习的图像识别方法',
      field: '人工智能',
      applicant: '测试科技有限公司',
      inventors: ['张三', '李四'],
      technicalDisclosure: '本发明提供一种基于深度学习的图像识别方法，通过卷积神经网络提取图像特征。',
      drawings: ['图1: 系统架构图'],
    });

    expect(result).toBeDefined();
    expect(result.patentApplication).toBeDefined();
    expect(result.metrics).toBeDefined();
  });

  it('should throw error when LLM fails', async () => {
    const eventBus = new EventBus();
    const memory = new ShortTermMemory();
    const tools = new ToolRegistry(eventBus);

    const agent = new PatentWriterAgent({
      name: 'test-patent-writer',
      description: '测试专利撰写智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockRejectedValue(new Error('LLM API 错误')),
      } as any,
      enableKnowledge: false,
      enableTemplates: false,
    });

    await expect(
      agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        applicant: '测试科技有限公司',
        inventors: ['张三'],
        technicalDisclosure: '本发明提供一种基于深度学习的图像识别方法。',
        drawings: [],
      })
    ).rejects.toThrow();
  });
});