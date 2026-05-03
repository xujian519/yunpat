import { describe, it, expect, vi } from 'vitest'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'
import { HumanReadableRenderer } from '@yunpat/agent-invention'

describe('InventionUnderstandingAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)

    return new InventionUnderstandingAgent({
      name: 'test-agent',
      description: '测试智能体',
      llm: {} as any,
      memory,
      tools,
      eventBus,
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
        technicalDisclosure: '一种深度学习图像识别方法',
      })
    ).rejects.toThrow('发明名称不能为空')
  })

  it('should throw error for empty field', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '',
        technicalDisclosure: '一种深度学习图像识别方法',
      })
    ).rejects.toThrow('技术领域不能为空')
  })

  it('should throw error for empty disclosure', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '人工智能',
        technicalDisclosure: '',
      })
    ).rejects.toThrow('技术交底书不能为空')
  })

  it('should throw error for whitespace-only input', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '   ',
        field: '人工智能',
        technicalDisclosure: '一种深度学习图像识别方法',
      })
    ).rejects.toThrow('发明名称不能为空')
  })

  it('should handle LLM failure gracefully', async () => {
    const agent = new InventionUnderstandingAgent({
      name: 'test-agent',
      description: '测试智能体',
      llm: {
        chat: vi.fn().mockRejectedValue(new Error('LLM API 错误')),
      } as any,
      memory: new ShortTermMemory(),
      tools: new ToolRegistry(new EventBus()),
      eventBus: new EventBus(),
    })

    const result = await agent.execute({
      title: '图像识别方法',
      field: '人工智能',
      technicalDisclosure: '一种深度学习图像识别方法，通过卷积神经网络提取特征。',
    })

    expect(result).toBeDefined()
    expect(result.technicalField).toBe('人工智能')
    expect(result.confidence).toBe(0.5)
    expect(result.keyFeatures).toEqual([])
  })

  it('should handle invalid JSON response', async () => {
    const agent = new InventionUnderstandingAgent({
      name: 'test-agent',
      description: '测试智能体',
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: { content: '这不是有效的 JSON' },
        }),
      } as any,
      memory: new ShortTermMemory(),
      tools: new ToolRegistry(new EventBus()),
      eventBus: new EventBus(),
    })

    const result = await agent.execute({
      title: '图像识别方法',
      field: '人工智能',
      technicalDisclosure: '一种深度学习图像识别方法。',
    })

    expect(result).toBeDefined()
    expect(result.confidence).toBe(0.5)
  })

  it('should handle JSON in markdown code block', async () => {
    const agent = new InventionUnderstandingAgent({
      name: 'test-agent',
      description: '测试智能体',
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: '```json\n{"technicalField": "人工智能", "confidence": 0.95}\n```',
          },
        }),
      } as any,
      memory: new ShortTermMemory(),
      tools: new ToolRegistry(new EventBus()),
      eventBus: new EventBus(),
    })

    const result = await agent.execute({
      title: '图像识别方法',
      field: '人工智能',
      technicalDisclosure: '一种深度学习图像识别方法。',
    })

    expect(result.technicalField).toBe('人工智能')
    expect(result.confidence).toBe(0.95)
  })

  it('should validate and normalize output fields', async () => {
    const agent = new InventionUnderstandingAgent({
      name: 'test-agent',
      description: '测试智能体',
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              technicalField: 123,
              backgroundArt: null,
              keyFeatures: ['特征1', 123, '特征2'],
              confidence: '高',
            }),
          },
        }),
      } as any,
      memory: new ShortTermMemory(),
      tools: new ToolRegistry(new EventBus()),
      eventBus: new EventBus(),
    })

    const result = await agent.execute({
      title: '图像识别方法',
      field: '人工智能',
      technicalDisclosure: '一种深度学习图像识别方法。',
    })

    expect(result.technicalField).toBe('人工智能') // 回退到输入字段
    expect(result.backgroundArt).toBe('')
    expect(result.keyFeatures).toEqual(['特征1', '特征2']) // 过滤非字符串
    expect(result.confidence).toBe(0.8) // 回退值
  })
})

describe('HumanReadableRenderer', () => {
  const renderer = new HumanReadableRenderer()

  it('should render readable report', () => {
    const output = {
      technicalField: '人工智能',
      backgroundArt: '现有图像识别方法准确率不足',
      technicalProblem: '如何提高复杂场景下的识别准确率',
      technicalSolution: '使用深度学习模型进行特征提取',
      beneficialEffects: '准确率提升20%',
      keyFeatures: ['特征1', '特征2'],
      drawingDescriptions: ['图1: 系统架构'],
      confidence: 0.95,
    }

    const report = renderer.render(output)

    expect(report).toContain('发明理解报告')
    expect(report).toContain('人工智能')
    expect(report).toContain('特征1')
    expect(report).toContain('95.0%')
  })

  it('should handle empty arrays', () => {
    const output = {
      technicalField: '人工智能',
      backgroundArt: '',
      technicalProblem: '',
      technicalSolution: '',
      beneficialEffects: '',
      keyFeatures: [],
      drawingDescriptions: [],
      confidence: 0.5,
    }

    const report = renderer.render(output)

    expect(report).toContain('发明理解报告')
    expect(report).toContain('暂无')
  })

  it('should format confidence as percentage', () => {
    const output = {
      technicalField: '人工智能',
      backgroundArt: '',
      technicalProblem: '',
      technicalSolution: '',
      beneficialEffects: '',
      keyFeatures: [],
      drawingDescriptions: [],
      confidence: 0.753,
    }

    const report = renderer.render(output)

    expect(report).toContain('75.3%')
  })
})
