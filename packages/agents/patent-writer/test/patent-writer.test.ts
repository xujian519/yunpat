import { describe, it, expect, vi } from 'vitest'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { PatentWriterAgent } from '../src/PatentWriterAgent.js'

describe('PatentWriterAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)

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
    })
  }

  it('should be instantiable', () => {
    const agent = createAgent()
    expect(agent).toBeDefined()
  })

  it('should throw error for empty title', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '',
        field: '人工智能',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('发明名称不能为空')
  })

  it('should throw error for empty field', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('技术领域不能为空')
  })

  it('should throw error for empty applicant', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        applicant: '',
        inventors: ['张三'],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('申请人不能为空')
  })

  it('should throw error for empty disclosure', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '',
        drawings: [],
      })
    ).rejects.toThrow('技术交底书不能为空')
  })

  it('should throw error for empty inventors', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        applicant: '测试公司',
        inventors: [],
        technicalDisclosure: '一种深度学习图像识别方法',
        drawings: [],
      })
    ).rejects.toThrow('发明人列表不能为空')
  })

  it('should execute with valid input', async () => {
    const agent = createAgent()
    const result = await agent.execute({
      title: '一种基于深度学习的图像识别方法',
      field: '人工智能',
      applicant: '测试科技有限公司',
      inventors: ['张三', '李四'],
      technicalDisclosure:
        '本发明提供一种基于深度学习的图像识别方法，通过卷积神经网络提取图像特征。',
      drawings: ['图1: 系统架构图'],
    })

    expect(result).toBeDefined()
    expect(result.patentApplication).toBeDefined()
    expect(result.metrics).toBeDefined()
  })

  it('should throw error when LLM fails', async () => {
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)

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
    })

    await expect(
      agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        applicant: '测试科技有限公司',
        inventors: ['张三'],
        technicalDisclosure: '本发明提供一种基于深度学习的图像识别方法。',
        drawings: [],
      })
    ).rejects.toThrow()
  })

  describe('exportToFormat', () => {
    it('should export to CN format', async () => {
      const agent = createAgent()

      // 先执行撰写
      await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        applicant: '测试科技有限公司',
        inventors: ['张三', '李四'],
        technicalDisclosure:
          '本发明提供一种基于深度学习的图像识别方法，通过卷积神经网络提取图像特征。',
        drawings: ['图1: 系统架构图'],
      })

      // 导出为 CN 格式
      const result = await agent.exportToFormat('cn')

      expect(result.format).toBe('cn')
      expect(result.content).toBeDefined()
      expect(result.content).toContain('发明名称')
      expect(result.content).toContain('摘要')
      expect(result.content).toContain('权利要求书')
      expect(result.content).toContain('说明书')
      expect(result.metadata.title).toBe('一种基于深度学习的图像识别方法')
      expect(result.metadata.applicant).toBe('测试科技有限公司')
      expect(result.metadata.inventors).toEqual(['张三', '李四'])
    })

    it('should export to PCT format', async () => {
      const agent = createAgent()

      // 先执行撰写
      await agent.execute({
        title: 'Image Recognition Method Based on Deep Learning',
        field: 'Artificial Intelligence',
        applicant: 'Test Tech Ltd',
        inventors: ['John Doe', 'Jane Smith'],
        technicalDisclosure: 'An image recognition method using deep learning.',
        drawings: ['Figure 1: System Architecture'],
      })

      // 导出为 PCT 格式
      const result = await agent.exportToFormat('pct')

      expect(result.format).toBe('pct')
      expect(result.content).toBeDefined()
      expect(result.content).toContain('PCT INTERNATIONAL APPLICATION')
      expect(result.content).toContain('ABSTRACT')
      expect(result.content).toContain('CLAIMS')
      expect(result.content).toContain('DESCRIPTION')
      expect(result.metadata.title).toBe('Image Recognition Method Based on Deep Learning')
    })

    it('should throw error when exporting before writing', async () => {
      const agent = createAgent()

      // 未执行撰写就导出
      await expect(agent.exportToFormat('cn')).rejects.toThrow('请先完成专利撰写，再进行导出')
    })

    it('should include metadata in export', async () => {
      const agent = createAgent()

      await agent.execute({
        title: '测试专利',
        field: 'AI',
        applicant: '测试公司',
        inventors: ['张三'],
        technicalDisclosure: '测试内容',
        drawings: [],
      })

      const result = await agent.exportToFormat('cn')

      expect(result.metadata).toBeDefined()
      expect(result.metadata.exportDate).toBeInstanceOf(Date)
      expect(result.metadata.claimsCount).toBeGreaterThan(0)
      expect(result.metadata.wordCount).toBeGreaterThan(0)
    })
  })
})
