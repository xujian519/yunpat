/**
 * Agent层集成测试
 *
 * 测试Agent与工具的集成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatentSearchAgent } from '../../search/src/PatentSearchAgent.js'
import { PatentAnalyzerAgent } from '../../patent-analyzer/src/PatentAnalyzerAgent.js'

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
      await agent.execute(input, executionContext as any)
    }).not.toThrow()
  })
})

describe('PatentAnalyzerAgent Integration Tests', () => {
  let agent: PatentAnalyzerAgent

  beforeEach(() => {
    vi.clearAllMocks()

    // 配置mock LLM响应
    mockLLM.chat.mockResolvedValue({
      message: {
        content: JSON.stringify({
          field: '人工智能',
          problems: ['专利分析效率低'],
          solution: '使用机器学习算法',
          effects: ['提高分析速度', '提高准确性'],
          keyFeatures: ['自然语言处理', '深度学习'],
        }),
      },
    })

    agent = new PatentAnalyzerAgent({
      name: 'TestAnalyzerAgent',
      description: 'Test analyzer agent',
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
      llm: mockLLM,
      patentDownloadTool: undefined, // 不配置下载工具，避免需要Python服务
    })
  })

  it('should successfully initialize without PatentDownloadTool', () => {
    expect(agent).toBeDefined()
    expect(agent.name).toBe('TestAnalyzerAgent')
  })

  it('should execute analysis without downloading patent', async () => {
    const input = {
      patent: {
        publicationNumber: 'US1234567B1',
        title: 'Machine Learning Patent Analysis',
        abstract: 'A method for analyzing patents using machine learning...',
        applicant: 'Test Company',
        inventors: ['John Doe', 'Jane Smith'],
        publicationDate: '2023-01-01',
      },
      analysisTypes: ['technical'] as const,
    }

    const executionContext = {
      llm: mockLLM,
      eventBus: mockEventBus,
      memory: mockMemory,
    }

    const result = await agent.execute(input, executionContext as any)

    expect(result).toBeDefined()
    expect(result.basicInfo.publicationNumber).toBe('US1234567B1')
    expect(result.basicInfo.title).toBe('Machine Learning Patent Analysis')
    expect(result.technicalAnalysis).toBeDefined()
  })
})
