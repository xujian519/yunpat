/**
 * PatentSearchAgent.v2 测试
 *
 * 测试Phase 5统一架构的PatentSearchAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatentSearchAgent } from './PatentSearchAgent.v2.js'
import type { LLMAdapter } from '@yunpat/core'

// Mock LLM
const mockLLM: LLMAdapter = {
  chat: vi.fn(async ({ messages }) => {
    const content = messages[messages.length - 1].content

    if (content.includes('请为以下专利申请制定检索策略')) {
      return {
        message: {
          content: JSON.stringify({
            keywords: ['深度学习', '图像识别', 'CNN', '特征提取', '分类'],
            ipcCodes: ['G06F', 'G06N'],
            searchQuery:
              '(深度学习 OR 深度神经网络) AND (图像识别 OR 图像处理) AND (CNN OR 卷积神经网络)',
            rationale: '基于发明名称和技术领域，采用关键词和IPC分类号相结合的检索策略',
          }),
        },
      }
    }

    return {
      message: { content: '' },
    }
  }),
} as LLMAdapter

// Mock 事件总线
const mockEventBus = {
  publish: vi.fn(),
  subscribe: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
}

// Mock 内存
const mockMemory = {
  get: vi.fn(),
  set: vi.fn(),
}

// Mock 工具
const mockTools = {}

describe('PatentSearchAgent.v2', () => {
  let agent: PatentSearchAgent

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new PatentSearchAgent({
      llm: mockLLM,
      eventBus: mockEventBus,
      memory: mockMemory,
      tools: mockTools,
      enableKnowledgeGraph: false,
    })
  })

  describe('run方法 - 完整检索流程', () => {
    it('应该执行默认检索策略', async () => {
      const input = {
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalProblem: '传统图像识别准确率低',
        technicalSolution: '使用深度学习技术提高图像识别准确率',
        keyFeatures: ['CNN', '特征提取', '分类'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.strategy.keywords).toBeDefined()
      expect(result.data.strategy.searchQuery).toBeDefined()
      expect(result.data.patentResults).toBeDefined()
      expect(result.data.statistics).toBeDefined()
      expect(result.data.recommendations).toBeDefined()
      expect(result.data.metrics.duration).toBeGreaterThanOrEqual(0)
      expect(result.data.metrics.strategyScore).toBeGreaterThanOrEqual(0)
    })

    it('应该支持keyword检索模式', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1', '特征2'],
        searchMode: 'keyword' as const,
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy).toBeDefined()
    })

    it('应该支持semantic检索模式', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1'],
        searchMode: 'semantic' as const,
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy).toBeDefined()
    })

    it('应该支持combined检索模式', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1', '特征2'],
        searchMode: 'combined' as const,
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy).toBeDefined()
    })
  })

  describe('检索策略生成', () => {
    it('应该生成有效的关键词', async () => {
      const input = {
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalProblem: '传统图像识别准确率低',
        technicalSolution: '使用深度学习技术提高图像识别准确率',
        keyFeatures: ['CNN', '特征提取'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.keywords.length).toBeGreaterThan(0)
      expect(result.data.strategy.keywords).toContain('深度学习')
    })

    it('应该生成IPC分类号', async () => {
      const input = {
        title: '测试专利',
        field: '计算机科学',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['算法'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.ipcCodes).toBeDefined()
    })

    it('应该生成检索查询语句', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.searchQuery).toBeDefined()
      expect(result.data.strategy.searchQuery.length).toBeGreaterThan(0)
    })

    it('应该提供策略说明', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.strategy.rationale).toBeDefined()
      expect(result.data.strategy.rationale.length).toBeGreaterThan(0)
    })
  })

  describe('专利检索', () => {
    it('应该返回专利检索结果', async () => {
      const input = {
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['深度学习', '图像识别'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.patentResults).toBeDefined()
      expect(result.data.patentResults.length).toBeGreaterThan(0)
      expect(result.data.patentResults[0].publicationNumber).toBeDefined()
      expect(result.data.patentResults[0].title).toBeDefined()
      expect(result.data.patentResults[0].abstract).toBeDefined()
    })

    it('应该包含专利详细信息', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['测试特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      const firstPatent = result.data.patentResults[0]
      expect(firstPatent.applicant).toBeDefined()
      expect(firstPatent.inventors).toBeDefined()
      expect(firstPatent.publicationDate).toBeDefined()
      expect(firstPatent.ipcCodes).toBeDefined()
      expect(firstPatent.similarity).toBeDefined()
      expect(firstPatent.similarity).toBeGreaterThan(0)
      expect(firstPatent.similarity).toBeLessThanOrEqual(1)
    })

    it('应该根据关键词过滤结果', async () => {
      const input = {
        title: '一种图像识别方法',
        field: '图像处理',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['图像识别', '深度学习'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      // 检查返回的专利是否包含相关关键词
      result.data.patentResults.forEach((patent) => {
        const hasKeyword = result.data.strategy.keywords.some(
          (keyword) => patent.title.includes(keyword) || patent.abstract?.includes(keyword)
        )
        expect(hasKeyword).toBe(true)
      })
    })
  })

  describe('学术论文检索', () => {
    it('应该检索学术论文', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['深度学习', '图像识别'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.academicPapers).toBeDefined()
      expect(result.data.academicPapers?.length).toBeGreaterThan(0)
    })

    it('应该包含论文详细信息', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      if (result.data.academicPapers && result.data.academicPapers.length > 0) {
        const firstPaper = result.data.academicPapers[0]
        expect(firstPaper.title).toBeDefined()
        expect(firstPaper.authors).toBeDefined()
        expect(firstPaper.year).toBeDefined()
        expect(firstPaper.venue).toBeDefined()
        expect(firstPaper.citations).toBeDefined()
        expect(firstPaper.url).toBeDefined()
        expect(firstPaper.abstract).toBeDefined()
      }
    })

    it('应该在没有关键特征时跳过论文检索', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: [],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.academicPapers).toBeUndefined()
    })
  })

  describe('统计信息', () => {
    it('应该记录检索耗时', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.statistics.searchTime).toBeGreaterThanOrEqual(0)
    })

    it('应该统计结果数量', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.statistics.patentCount).toBe(result.data.patentResults.length)
      expect(result.data.statistics.paperCount).toBe(result.data.academicPapers?.length || 0)
    })
  })

  describe('检索建议', () => {
    it('应该生成检索建议', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.recommendations).toBeDefined()
      expect(result.data.recommendations.length).toBeGreaterThan(0)
    })

    it('应该根据结果数量给出建议', async () => {
      const input = {
        title: '不存在的专利',
        field: '不存在的领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: [],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      // 当结果很少时应该给出相关建议
      if (result.data.statistics.patentCount < 5) {
        const hasRelevantRecommendation = result.data.recommendations.some(
          (rec) => rec.includes('扩大检索范围') || rec.includes('补充检索')
        )
        expect(hasRelevantRecommendation).toBe(true)
      }
    })
  })

  describe('策略评分', () => {
    it('应该计算策略质量评分', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1', '特征2', '特征3'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.data.metrics.strategyScore).toBeGreaterThanOrEqual(0)
      expect(result.data.metrics.strategyScore).toBeLessThanOrEqual(100)
    })

    it('应该考虑关键词数量', async () => {
      const input1 = {
        title: '测试专利1',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1', '特征2', '特征3', '特征4', '特征5'],
      }

      const input2 = {
        title: '测试专利2',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征1'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result1 = await agent.run(input1, context)
      const result2 = await agent.run(input2, context)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      // 关键词更多的策略评分应该更高
      expect(result1.data.metrics.strategyScore).toBeGreaterThanOrEqual(
        result2.data.metrics.strategyScore
      )
    })
  })

  describe('错误处理', () => {
    it('应该处理LLM调用失败', async () => {
      vi.mocked(mockLLM.chat).mockRejectedValueOnce(new Error('LLM调用失败'))

      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('LLM调用失败')
    })

    it('应该验证必填字段', async () => {
      const input = {
        title: '',
        field: '',
        technicalProblem: '',
        technicalSolution: '',
        keyFeatures: [],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('性能指标', () => {
    it('应该记录执行时间', async () => {
      const input = {
        title: '测试专利',
        field: '测试领域',
        technicalProblem: '测试问题',
        technicalSolution: '测试方案',
        keyFeatures: ['特征'],
      }

      const context = {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      }

      const result = await agent.run(input, context)

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
      expect(result.data.metrics.duration).toBeGreaterThanOrEqual(0)
    })
  })
})
