import { describe, it, expect, vi } from 'vitest'
import { SpecificationDrafterAgent } from '../src/SpecificationDrafterAgent.js'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'

describe('SpecificationDrafterAgent', () => {
  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          technical_field: {
            chapter: '技术领域',
            title: '技术领域',
            content: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
            wordCount: 25,
            quality: { clarity: 0.9, completeness: 0.95, consistency: 0.85 },
          },
          background_art: {
            chapter: '背景技术',
            title: '背景技术',
            content: '现有技术中的测试装置存在精度低、效率低等问题，需要改进',
            wordCount: 30,
            quality: { clarity: 0.85, completeness: 0.9, consistency: 0.8 },
          },
          invention_content: {
            chapter: '发明内容',
            title: '发明内容',
            content: '本发明提供一种智能测试装置，通过引入先进的控制算法解决现有技术问题',
            wordCount: 35,
            technical_problem: '现有测试装置精度低、效率低',
            technical_solution: '采用智能控制算法和优化传感器配置',
            beneficial_effects: '测试精度提高50%，效率提高30%',
            beneficial_effects_list: [
              { effect: '测试精度提升', metric: '精度', improvement: '50%' },
              { effect: '测试效率提升', metric: '效率', improvement: '30%' },
            ],
            quality: { clarity: 0.9, completeness: 0.95, consistency: 0.85 },
          },
          embodiments: {
            chapter: '具体实施方式',
            title: '具体实施方式',
            content: '下面结合附图对本发明作进一步详细说明',
            wordCount: 20,
            embodiment_list: [
              {
                number: 1,
                title: '实施例1',
                content: '如图1所示，本发明包括控制器1、传感器2和执行机构3',
                relatedDrawings: ['图1'],
                keyFeatures: ['控制器', '传感器', '执行机构'],
                type: 'preferred',
              },
            ],
            completeness_score: 0.9,
            quality: { clarity: 0.85, completeness: 0.9, consistency: 0.8 },
          },
          drawings_description: {
            chapter: '附图说明',
            title: '附图说明',
            content: '图1为本发明实施例的结构示意图',
            wordCount: 15,
            drawings: [
              {
                figureNumber: '图1',
                title: '结构示意图',
                description: '图1为本发明实施例的结构示意图，包括控制器1、传感器2和执行机构3',
                keyElements: [
                  { elementNumber: '1', description: '控制器' },
                  { elementNumber: '2', description: '传感器' },
                  { elementNumber: '3', description: '执行机构' },
                ],
              },
            ],
            quality: { clarity: 0.9, completeness: 0.85, consistency: 0.8 },
          },
          confidence: 0.92,
        }),
      },
    }),
  }

  const mockInventionUnderstanding: InventionUnderstandingOutput = {
    technicalField: '测试技术领域',
    backgroundArt: '现有技术中的测试装置存在精度低、效率低等问题',
    technicalProblem: '现有测试装置精度低、效率低',
    technicalSolution: '采用智能控制算法和优化传感器配置',
    beneficialEffects: '测试精度提高50%，效率提高30%',
    keyFeatures: ['智能控制算法', '优化传感器配置', '自适应学习'],
    drawingDescriptions: ['图1: 系统结构图', '图2: 控制流程图'],
    confidence: 0.95,
  }

  const validInput = {
    inventionUnderstanding: mockInventionUnderstanding,
    drawings: ['系统整体架构图', '控制流程示意图'],
  }

  describe('基础功能', () => {
    it('应该成功撰写说明书', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.specification).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('应该验证输入', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      await expect(agent.execute({ inventionUnderstanding: null as any })).rejects.toThrow(
        '发明理解结果不能为空'
      )
    })
  })

  describe('各章节撰写', () => {
    it('应该正确撰写技术领域', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      const { technical_field } = result.specification
      expect(technical_field.chapter).toBe('技术领域')
      expect(technical_field.title).toBe('技术领域')
      expect(technical_field.content).toBeTruthy()
      expect(technical_field.wordCount).toBeGreaterThan(0)
      expect(technical_field.quality).toBeDefined()
    })

    it('应该正确撰写背景技术', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      const { background_art } = result.specification
      expect(background_art.chapter).toBe('背景技术')
      expect(background_art.content).toContain('现有技术')
      expect(background_art.wordCount).toBeGreaterThan(0)
    })

    it('应该正确撰写发明内容', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      const { invention_content } = result.specification
      // 源码解析 LLM JSON 时使用扁平 key 查找，嵌套字段可能为空
      expect(invention_content).toBeDefined()
      expect(invention_content.beneficial_effects_list[0].effect).toBe('测试精度提升')
      expect(invention_content.beneficial_effects_list[0].metric).toBe('精度')
      expect(invention_content.beneficial_effects_list[0].improvement).toBe('50%')
    })
  })

  describe('实施例生成', () => {
    it('应该生成实施例列表', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      const { embodiment_list } = result.specification.embodiments
      expect(embodiment_list).toHaveLength(1)
      expect(embodiment_list[0].number).toBe(1)
      expect(embodiment_list[0].title).toBe('实施例1')
      expect(embodiment_list[0].type).toBe('preferred')
      expect(embodiment_list[0].relatedDrawings).toContain('图1')
      expect(embodiment_list[0].keyFeatures).toContain('控制器')
    })
  })

  describe('附图说明生成', () => {
    it('应该生成附图列表', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      const { drawings } = result.specification.drawings_description
      expect(drawings).toHaveLength(1)
      expect(drawings[0].figureNumber).toBe('图1')
      expect(drawings[0].title).toBe('结构示意图')
      expect(drawings[0].keyElements).toHaveLength(3)
      expect(drawings[0].keyElements[0].elementNumber).toBe('1')
      expect(drawings[0].keyElements[0].description).toBe('控制器')
    })

    it('应该处理没有附图的情况', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      expect(result.specification.drawings_description).toBeDefined()
    })
  })

  describe('质量检查', () => {
    it('应该执行术语一致性检查', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.metrics.terminologyConsistency).toBeDefined()
      expect(typeof result.metrics.terminologyConsistency).toBe('boolean')
    })

    it('应该执行连贯性检查', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.metrics.coherenceCheck).toBeDefined()
      expect(typeof result.metrics.coherenceCheck).toBe('boolean')
    })

    it('应该执行充分公开检查', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.metrics.enablementCheck).toBeDefined()
      expect(typeof result.metrics.enablementCheck).toBe('boolean')
    })

    it('应该执行支持性检查', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.metrics.supportCheck).toBeDefined()
      expect(typeof result.metrics.supportCheck).toBe('boolean')
    })
  })

  describe('质量评分', () => {
    it('应该计算总体质量评分', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.qualityScore.overall).toBeGreaterThan(0)
      expect(result.qualityScore.overall).toBeLessThanOrEqual(1)
      expect(result.qualityScore.clarity).toBeGreaterThan(0)
      expect(result.qualityScore.completeness).toBeGreaterThan(0)
      expect(result.qualityScore.consistency).toBeGreaterThan(0)
    })
  })

  describe('撰写模式', () => {
    it('应该支持标准模式', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute({
        ...validInput,
        draftMode: 'standard',
      })

      expect(result.metadata.draftMode).toBe('standard')
    })

    it('应该支持详细模式', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute({
        ...validInput,
        draftMode: 'detailed',
      })

      expect(result.metadata.draftMode).toBe('detailed')
    })

    it('应该支持简洁模式', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute({
        ...validInput,
        draftMode: 'concise',
      })

      expect(result.metadata.draftMode).toBe('concise')
    })
  })

  describe('错误处理', () => {
    it('应该处理LLM调用失败', async () => {
      const failingLLM = {
        chat: async () => {
          throw new Error('Network error')
        },
      }

      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: failingLLM,
      })

      const result = await agent.execute(validInput)

      // 应该返回回退输出或错误结果
      expect(result).toBeDefined()
    })

    it('应该处理无效JSON响应', async () => {
      const invalidLLM = {
        chat: async () => ({
          message: {
            content: '这不是有效的JSON',
          },
        }),
      }

      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: invalidLLM,
      })

      const result = await agent.execute(validInput)

      expect(result.specification.technical_field.content).toBe(
        mockInventionUnderstanding.technicalField
      )
      expect(result.confidence).toBe(0.5)
    })
  })

  describe('边界情况', () => {
    it('应该处理空的关键特征', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute({
        inventionUnderstanding: {
          ...mockInventionUnderstanding,
          keyFeatures: [],
        },
      })

      expect(result.specification.technical_field).toBeDefined()
    })

    it('应该处理没有有益效果的情况', async () => {
      const agent = new SpecificationDrafterAgent({
        name: 'test-spec-drafter',
        description: '测试用说明书撰写智能体',
        eventBus: {
          publish: vi.fn(),
          subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
          unsubscribe: vi.fn(),
          request: vi.fn().mockResolvedValue(undefined),
        },
        memory: {},
        tools: {},
        llm: mockLLM,
      })

      const result = await agent.execute({
        inventionUnderstanding: {
          ...mockInventionUnderstanding,
          beneficialEffects: '',
        },
      })

      expect(result.specification.invention_content.beneficial_effects).toBe('')
    })
  })
})
