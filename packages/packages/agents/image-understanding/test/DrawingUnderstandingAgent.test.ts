/**
 * DrawingUnderstandingAgent 单元测试
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import { DrawingUnderstandingAgent } from '../src/DrawingUnderstandingAgent.js'
import { EventBus } from '@yunpat/core'
import { writeFile, mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * 创建测试用的简单图像（1x1 像素的 PNG）
 */
async function createTestImage(outputPath: string): Promise<void> {
  // 最小的 PNG 文件（1x1 透明像素）
  const minimalPng = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk start
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1 image
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x15,
    0xc4, // 8-bit, color type 6 (RGBA)
    0x89,
    0x00,
    0x00,
    0x00,
    0x0a,
    0x49,
    0x44,
    0x41, // IDAT chunk start
    0x54,
    0x78,
    0x9c,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00, // Compressed data
    0x05,
    0x00,
    0x01,
    0x0d,
    0x0a,
    0x2d,
    0xb4,
    0x00, // IDAT chunk end
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44, // IEND chunk
    0xae,
    0x42,
    0x60,
    0x82, // IEND CRC
  ])

  // 确保目录存在
  const dir = join(outputPath, '..')
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  await writeFile(outputPath, minimalPng)
}

// 测试图像路径 — 必须在 cwd 内，路径安全检查会拒绝外部路径
const TEST_IMAGE_PATH = join(process.cwd(), '.tmp-test-drawing-agent.png')

// Mock LLM
const createMockLLM = () => ({
  chat: vi.fn().mockResolvedValue({
    message: {
      content: JSON.stringify({
        figureType: 'exploded_view',
        overview: '陶瓷阀片组件的爆炸图',
        components: [
          {
            type: 'component',
            description: '陶瓷阀片',
            boundingBox: { x: 30, y: 20, width: 40, height: 60 },
            confidence: 0.95,
          },
          {
            type: 'component',
            description: '阀座',
            boundingBox: { x: 25, y: 70, width: 50, height: 25 },
            confidence: 0.9,
          },
        ],
        connections: [],
        labels: [
          {
            type: 'label',
            description: '1-陶瓷阀片',
            boundingBox: { x: 35, y: 25, width: 30, height: 15 },
            confidence: 0.92,
          },
        ],
        annotations: [],
        structureAnalysis: {
          mainStructure: '阀片组件',
          subStructures: ['阀片部分', '阀座部分'],
          hierarchy: ['组件级', '零件级'],
        },
        correspondence: {
          technicalFeatures: ['陶瓷材料制造'],
          suggestedDescription: '图1为陶瓷阀片组件的结构爆炸图。',
        },
        confidence: 0.9,
      }),
    },
  }),
})

describe('DrawingUnderstandingAgent', () => {
  let agent: DrawingUnderstandingAgent
  let mockLLM: any

  beforeAll(async () => {
    // 创建测试图像
    await createTestImage(TEST_IMAGE_PATH)
  })

  afterAll(async () => {
    // 清理测试图像
    if (existsSync(TEST_IMAGE_PATH)) {
      await rm(TEST_IMAGE_PATH).catch(() => {})
    }
  })

  beforeEach(() => {
    mockLLM = createMockLLM()
    agent = new DrawingUnderstandingAgent({
      name: 'drawing-understanding',
      description: '附图理解智能体',
      eventBus: new EventBus(),
      memory: {},
      tools: {},
      llm: mockLLM,
    })
  })

  describe('输入验证', () => {
    it('应该接受有效的输入', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
      }

      // 不会抛出异常
      await expect(agent.execute(input)).resolves.not.toThrow()
    })

    it('应该拒绝空的附图编号', async () => {
      const input = {
        figureNumber: '',
        imagePath: TEST_IMAGE_PATH,
      }

      await expect(agent.execute(input)).rejects.toThrow('附图编号不能为空')
    })

    it('应该拒绝空的图像路径', async () => {
      const input = {
        figureNumber: '1',
        imagePath: '',
      }

      await expect(agent.execute(input)).rejects.toThrow('图像路径不能为空')
    })
  })

  describe('附图理解', () => {
    it('应该理解爆炸图', async () => {
      const input = {
        figureNumber: '1',
        figureTitle: '陶瓷阀片组件爆炸图',
        imagePath: TEST_IMAGE_PATH,
        technicalField: '机械工程',
        technicalSolution: '采用陶瓷材料制造阀片',
      }

      const result = await agent.execute(input)

      expect(result.figureNumber).toBe('1')
      expect(result.figureType).toBe('exploded_view')
      expect(result.overview).toContain('爆炸图')
      expect(result.components.length).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('应该识别组件和标签', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalField: '机械工程',
      }

      const result = await agent.execute(input)

      expect(result.components).toBeDefined()
      expect(result.labels).toBeDefined()
      expect(result.components.length).toBeGreaterThan(0)
    })

    it('应该生成附图说明', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalField: '机械工程',
      }

      const result = await agent.execute(input)

      expect(result.correspondence).toBeDefined()
      expect(result.correspondence.suggestedDescription).toContain('图1')
      expect(result.correspondence.technicalFeatures).toBeInstanceOf(Array)
    })
  })

  describe('技术特征提取', () => {
    it('应该提取技术特征', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalSolution: '采用陶瓷材料，表面精度达到0.01mm',
      }

      const result = await agent.execute(input)

      expect(result.correspondence.technicalFeatures).toBeDefined()
      expect(result.correspondence.technicalFeatures.length).toBeGreaterThan(0)
    })

    it('应该与技术方案建立对应', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalSolution: '包括控制器和传感器模块',
      }

      const result = await agent.execute(input)

      expect(result.correspondence).toBeDefined()
      expect(result.correspondence.suggestedDescription).toBeDefined()
    })
  })

  describe('错误处理', () => {
    it('应该抛出 LLM 错误', async () => {
      const errorLLM = {
        chat: vi.fn().mockRejectedValue(new Error('LLM 服务不可用')),
      }

      const errorAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: errorLLM,
      })

      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
      }

      // 应该抛出异常
      await expect(errorAgent.execute(input)).rejects.toThrow('LLM 服务不可用')
    })

    it('应该处理 JSON 解析错误', async () => {
      const invalidLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: '无效的响应，不是 JSON 格式',
          },
        }),
      }

      const invalidAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: invalidLLM,
      })

      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
      }

      const result = await invalidAgent.execute(input)

      // JSON 解析失败时返回默认结果
      expect(result).toBeDefined()
      expect(result.confidence).toBe(0.0)
    })
  })

  describe('置信度评估', () => {
    it('应该返回合理的置信度', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalField: '机械工程',
      }

      const result = await agent.execute(input)

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('低置信度时应该警告', async () => {
      const lowConfidenceLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              figureType: 'other',
              overview: '不清晰的图像',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图1为[附图说明]',
              },
              confidence: 0.3,
            }),
          },
        }),
      }

      const lowConfidenceAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: lowConfidenceLLM,
      })

      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
      }

      const result = await lowConfidenceAgent.execute(input)

      expect(result.confidence).toBeLessThan(0.7)
    })
  })

  describe('结构分析', () => {
    it('应该分析主要结构', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalField: '机械工程',
      }

      const result = await agent.execute(input)

      expect(result.structureAnalysis).toBeDefined()
      expect(result.structureAnalysis.mainStructure).toBeDefined()
      expect(result.structureAnalysis.subStructures).toBeInstanceOf(Array)
      expect(result.structureAnalysis.hierarchy).toBeInstanceOf(Array)
    })

    it('应该识别层次关系', async () => {
      const input = {
        figureNumber: '1',
        imagePath: TEST_IMAGE_PATH,
        technicalField: '机械工程',
      }

      const result = await agent.execute(input)

      expect(result.structureAnalysis.hierarchy).toBeDefined()
    })
  })

  describe('附图类型识别', () => {
    it('应该识别爆炸图', async () => {
      const input = {
        figureNumber: '1',
        figureTitle: '爆炸图',
        imagePath: TEST_IMAGE_PATH,
      }

      const result = await agent.execute(input)

      expect(result.figureType).toBeDefined()
    })

    it('应该识别原理图', async () => {
      const schematicLLM = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              figureType: 'schematic',
              overview: '原理图',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图2为原理图。',
              },
              confidence: 0.88,
            }),
          },
        }),
      }

      const schematicAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: schematicLLM,
      })

      const input = {
        figureNumber: '2',
        imagePath: TEST_IMAGE_PATH,
      }

      const result = await schematicAgent.execute(input)

      expect(result.figureType).toBe('schematic')
    })
  })
})
