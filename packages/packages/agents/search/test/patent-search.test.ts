import { describe, it, expect, vi } from 'vitest'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { PatentSearchAgent } from '../src/PatentSearchAgent.js'

describe('PatentSearchAgent', () => {
  const createAgent = () => {
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)

    return new PatentSearchAgent({
      name: 'test-search-agent',
      description: '测试检索智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              keywords: ['深度学习', '图像识别'],
              ipcCodes: ['G06N', 'G06T'],
              searchQuery: '深度学习 AND 图像识别',
              rationale: '基于技术特征构建的检索策略',
            }),
          },
        }),
      },
      searchTool: {
        execute: vi.fn().mockResolvedValue({
          patents: [
            {
              id: 'CN123456789',
              patentName: '一种图像识别方法',
              applicationNumber: 'CN202310000001',
              publicationNumber: 'CN123456789A',
              applicant: '测试公司',
              abstract: '本发明公开一种图像识别方法',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
          elapsedMs: 100,
        }),
      } as any,
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
        technicalProblem: '如何提高图像识别准确率',
        technicalSolution: '使用深度学习模型',
        keyFeatures: ['特征1'],
      })
    ).rejects.toThrow('发明名称不能为空')
  })

  it('should throw error for empty field', async () => {
    const agent = createAgent()
    await expect(
      agent.execute({
        title: '图像识别方法',
        field: '',
        technicalProblem: '如何提高图像识别准确率',
        technicalSolution: '使用深度学习模型',
        keyFeatures: ['特征1'],
      })
    ).rejects.toThrow('技术领域不能为空')
  })

  it('should generate search strategy and return results', async () => {
    const agent = createAgent()
    const result = await agent.execute({
      title: '一种基于深度学习的图像识别方法',
      field: '人工智能',
      technicalProblem: '如何提高复杂场景下的识别准确率',
      technicalSolution: '使用卷积神经网络提取多层次特征',
      keyFeatures: ['多层次特征提取', '注意力机制', '数据增强'],
    })

    expect(result).toBeDefined()
    expect(result.strategy).toBeDefined()
    expect(result.strategy.keywords).toContain('深度学习')
    expect(result.strategy.keywords).toContain('图像识别')
    expect(result.totalFound).toBeGreaterThanOrEqual(0)
    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('should handle LLM failure and use fallback strategy', async () => {
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)

    const agent = new PatentSearchAgent({
      name: 'test-search-agent',
      description: '测试检索智能体',
      eventBus,
      memory,
      tools,
      llm: {
        chat: vi.fn().mockRejectedValue(new Error('LLM 错误')),
      },
      searchTool: {
        execute: vi.fn().mockResolvedValue({
          patents: [],
          total: 0,
          page: 1,
          pageSize: 10,
          elapsedMs: 50,
        }),
      } as any,
    })

    const result = await agent.execute({
      title: '一种基于深度学习的图像识别方法',
      field: '人工智能',
      technicalProblem: '如何提高复杂场景下的识别准确率',
      technicalSolution: '使用卷积神经网络提取多层次特征',
      keyFeatures: ['多层次特征提取', '注意力机制'],
    })

    expect(result).toBeDefined()
    expect(result.strategy).toBeDefined()
    expect(result.strategy.searchQuery).toContain('深度学习')
    expect(result.totalFound).toBeGreaterThanOrEqual(0)
  })
})
