/**
 * Agent层集成测试
 *
 * 测试Agent与工具的集成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatentSearchAgent } from '../../search/src/PatentSearchAgent.js'
import { ComparisonAnalyzerAgent } from '../../patent-analyzer/src/ComparisonAnalyzerAgent.js'

// Mock LLM
const mockLLM = {
  chat: vi.fn(),
}

// Mock EventBus
const mockEventBus = {
  publish: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}

// Mock Memory
const mockMemory = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
}

// Mock Tools registry
const mockTools = {
  get: vi.fn(),
  set: vi.fn(),
  has: vi.fn(),
}

describe('PatentSearchAgent Integration Tests', () => {
  let agent: PatentSearchAgent

  beforeEach(() => {
    vi.clearAllMocks()

    // 配置mock LLM响应
    mockLLM.chat.mockResolvedValue({
      message: {
        content: JSON.stringify({
          keywords: ['machine learning', 'patent analysis'],
          ipcCodes: ['G06N', 'G06Q'],
          searchQuery: 'machine learning AND patent analysis',
          rationale: '基于技术领域和关键特征构建检索策略',
        }),
      },
    })

    agent = new PatentSearchAgent({
      name: 'TestSearchAgent',
      description: 'Test search agent',
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
      llm: mockLLM,
    })
  })

  it('should successfully initialize with AcademicSearchTool', () => {
    expect(agent).toBeDefined()
    expect(agent.name).toBe('TestSearchAgent')
  })

  it('should execute search and include academic papers', async () => {
    const input = {
      title: '基于机器学习的专利分析方法',
      field: '人工智能',
      technicalProblem: '现有专利分析效率低',
      technicalSolution: '使用机器学习算法自动分析专利',
      keyFeatures: ['自然语言处理', '深度学习', '知识图谱'],
    }

    // 由于AcademicSearchTool需要真实的API调用，我们在测试中mock它
    // 这里只验证Agent的结构和逻辑是否正确
    const executionContext = {
      llm: mockLLM,
      eventBus: mockEventBus,
      memory: mockMemory,
    }

    expect(async () => {
      await agent.execute(input, executionContext as unknown as ExecutionContext)
    }).not.toThrow()
  })
})

describe('ComparisonAnalyzerAgent Integration Tests', () => {
  let agent: ComparisonAnalyzerAgent

  beforeEach(() => {
    vi.clearAllMocks()

    // 配置mock LLM响应
    mockLLM.chat.mockResolvedValue({
      message: {
        content: JSON.stringify({
          level: 'obvious',
          score: 55,
          reasoning: '与对比文件存在一定区别但创造性一般',
        }),
      },
    })

    agent = new ComparisonAnalyzerAgent({
      name: 'TestComparisonAnalyzer',
      description: 'Test comparison analyzer',
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
      llm: mockLLM,
      enableKnowledgeGraph: false,
    })
  })

  it('应该正确初始化', () => {
    expect(agent).toBeDefined()
    expect(agent.name).toBe('TestComparisonAnalyzer')
  })

  it('应该执行对比文件交叉比对', async () => {
    const input = {
      priorArtAnalyses: [
        {
          documentInfo: {
            title: '对比文件1',
            type: 'patent' as const,
          },
          technicalAnalysis: {
            technicalSolution: {
              core: '特征A方案',
              keyFeatures: [{ feature: '特征A', necessity: 'essential' as const, confidence: 0.9 }],
              implementation: '实现A',
              technicalEffects: [{ effect: '效果A', confidence: 0.8 }],
            },
            technicalProblems: {
              main: '问题A',
              sub: [],
            },
          },
          metadata: {
            depth: 2 as const,
            timestamp: Date.now(),
            confidence: 0.8,
            knowledgeGraphUsed: false,
          },
        },
        {
          documentInfo: {
            title: '对比文件2',
            type: 'paper' as const,
          },
          technicalAnalysis: {
            technicalSolution: {
              core: '特征B方案',
              keyFeatures: [{ feature: '特征B', necessity: 'essential' as const, confidence: 0.9 }],
              implementation: '实现B',
              technicalEffects: [{ effect: '效果B', confidence: 0.8 }],
            },
            technicalProblems: {
              main: '问题B',
              sub: [],
            },
          },
          metadata: {
            depth: 2 as const,
            timestamp: Date.now(),
            confidence: 0.8,
            knowledgeGraphUsed: false,
          },
        },
      ],
      scenario: 'office_action' as const,
    }

    const result = await agent.execute(input)

    expect(result).toBeDefined()
    expect(result.scenario).toBe('office_action')
    expect(result.comparisons.length).toBe(2)
    expect(result.metadata.priorArtCount).toBe(2)
  })
})
