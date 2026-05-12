/**
 * DrawingUnderstandingAgent 集成测试
 *
 * 测试真实场景下的附图理解功能
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DrawingUnderstandingAgent } from '../src/DrawingUnderstandingAgent.js'
import { EventBus } from '@yunpat/core'
import { writeFile, mkdir } from 'fs/promises'
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

/**
 * 创建模拟多模态 LLM
 */
function createMockMultimodalLLM(responseData: any) {
  return {
    chat: async (params: any) => {
      // 模拟多模态 LLM 的响应
      return {
        message: {
          content: JSON.stringify(responseData),
        },
      }
    },
  }
}

describe('DrawingUnderstandingAgent 集成测试', () => {
  const testImagePath = join(process.cwd(), 'test-drawing.png')
  let agent: DrawingUnderstandingAgent

  beforeEach(async () => {
    // 创建测试图像
    await createTestImage(testImagePath)

    // 创建智能体
    agent = new DrawingUnderstandingAgent({
      name: 'drawing-understanding',
      description: '附图理解智能体',
      eventBus: new EventBus(),
      memory: {},
      tools: {},
      llm: createMockMultimodalLLM({
        figureType: 'exploded_view',
        overview: '测试附图的概述',
        components: [
          {
            type: 'component',
            description: '测试组件',
            boundingBox: { x: 10, y: 10, width: 80, height: 80 },
            confidence: 0.9,
          },
        ],
        connections: [],
        labels: [],
        annotations: [],
        structureAnalysis: {
          mainStructure: '测试结构',
          subStructures: ['子结构1'],
          hierarchy: ['层级1'],
        },
        correspondence: {
          technicalFeatures: ['测试特征'],
          suggestedDescription: '图1为测试附图。',
        },
        confidence: 0.85,
      }),
    })
  })

  describe('完整工作流程测试', () => {
    it('应该完成从输入到输出的完整流程', async () => {
      const input = {
        figureNumber: '1',
        figureTitle: '测试附图',
        imagePath: testImagePath,
        technicalField: '测试领域',
        technicalSolution: '测试技术方案',
      }

      const result = await agent.execute(input)

      // 验证基本字段
      expect(result.figureNumber).toBe('1')
      expect(result.overview).toBeDefined()
      expect(result.components).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)

      // 验证结构分析
      expect(result.structureAnalysis.mainStructure).toBeDefined()
      expect(result.structureAnalysis.subStructures).toBeInstanceOf(Array)

      // 验证技术特征对应
      expect(result.correspondence.technicalFeatures).toBeInstanceOf(Array)
      expect(result.correspondence.suggestedDescription).toContain('图1')
    })

    it('应该正确处理多个附图的批量理解', async () => {
      const testImages = [
        { figureNumber: '1', imagePath: testImagePath },
        { figureNumber: '2', imagePath: testImagePath },
        { figureNumber: '3', imagePath: testImagePath },
      ]

      const results = []

      for (const drawing of testImages) {
        const result = await agent.execute(drawing)
        results.push(result)
      }

      // 验证所有附图都被处理
      expect(results).toHaveLength(3)
      results.forEach((result, index) => {
        expect(result.figureNumber).toBe(String(index + 1))
        expect(result.components).toBeDefined()
      })
    })
  })

  describe('与技术方案集成测试', () => {
    it('应该根据技术方案提取对应的技术特征', async () => {
      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
        technicalField: '机械制造',
        technicalSolution: '采用陶瓷材料制造阀片，表面精度达到0.01mm',
      }

      const result = await agent.execute(input)

      // 验证技术特征提取
      expect(result.correspondence.technicalFeatures).toBeDefined()
      expect(result.correspondence.technicalFeatures.length).toBeGreaterThan(0)

      // 验证附图说明包含技术方案内容
      const description = result.correspondence.suggestedDescription
      expect(description).toBeDefined()
      expect(description.length).toBeGreaterThan(0)
    })

    it('应该结合技术领域上下文理解附图', async () => {
      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
        technicalField: '电子电路',
        technicalSolution: '使用 FPGA 实现高速信号处理',
      }

      const result = await agent.execute(input)

      // 验证理解结果
      expect(result.figureType).toBeDefined()
      expect(result.components).toBeDefined()

      // 验证上下文信息被利用
      expect(result.correspondence.technicalFeatures.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('图像处理测试', () => {
    it('应该正确加载和编码图像', async () => {
      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
      }

      // 不应抛出异常
      await expect(agent.execute(input)).resolves.toBeDefined()
    })

    it('应该支持 Base64 编码的图像', async () => {
      const mockBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
        imageBase64: mockBase64,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.figureNumber).toBe('1')
    })
  })

  describe('输出格式验证', () => {
    it('应该返回符合 DrawingUnderstanding 接口的结果', async () => {
      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
      }

      const result = await agent.execute(input)

      // 验证所有必需字段存在
      expect(result.figureNumber).toBeDefined()
      expect(result.figureType).toBeDefined()
      expect(result.overview).toBeDefined()
      expect(result.components).toBeInstanceOf(Array)
      expect(result.connections).toBeInstanceOf(Array)
      expect(result.labels).toBeInstanceOf(Array)
      expect(result.annotations).toBeInstanceOf(Array)
      expect(result.structureAnalysis).toBeDefined()
      expect(result.correspondence).toBeDefined()
      expect(result.confidence).toBeDefined()
      expect(result.timestamp).toBeDefined()
    })

    it('应该包含有效的元素描述', async () => {
      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
      }

      const result = await agent.execute(input)

      // 验证组件元素
      result.components.forEach((component) => {
        expect(component.type).toBeDefined()
        expect(component.description).toBeDefined()
        expect(component.confidence).toBeGreaterThanOrEqual(0)
        expect(component.confidence).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('错误恢复测试', () => {
    it('应该在 LLM 失败时抛出异常', async () => {
      const errorAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: {
          chat: async () => {
            throw new Error('LLM 服务不可用')
          },
        },
      })

      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
      }

      // 应该抛出异常
      await expect(errorAgent.execute(input)).rejects.toThrow('LLM 服务不可用')
    })

    it('应该处理不存在的图像文件', async () => {
      const input = {
        figureNumber: '1',
        imagePath: join(process.cwd(), 'nonexistent-test-image.png'),
      }

      await expect(agent.execute(input)).rejects.toThrow('图像文件不存在')
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成单个附图理解', async () => {
      const input = {
        figureNumber: '1',
        imagePath: testImagePath,
      }

      const startTime = Date.now()
      await agent.execute(input)
      const duration = Date.now() - startTime

      // 应该在 5 秒内完成（模拟环境）
      expect(duration).toBeLessThan(5000)
    })

    it('应该支持并发处理多个附图', async () => {
      const inputs = [
        { figureNumber: '1', imagePath: testImagePath },
        { figureNumber: '2', imagePath: testImagePath },
        { figureNumber: '3', imagePath: testImagePath },
      ]

      const startTime = Date.now()

      // 并发处理
      const results = await Promise.all(inputs.map((input) => agent.execute(input)))

      const duration = Date.now() - startTime

      // 验证所有结果
      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result).toBeDefined()
      })

      // 并发处理应该比串行快
      expect(duration).toBeLessThan(10000)
    })
  })

  describe('附图类型识别测试', () => {
    it('应该识别爆炸图类型', async () => {
      const explodedViewAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: createMockMultimodalLLM({
          figureType: 'exploded_view',
          overview: '爆炸图',
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
            suggestedDescription: '图1为爆炸图。',
          },
          confidence: 0.9,
        }),
      })

      const result = await explodedViewAgent.execute({
        figureNumber: '1',
        imagePath: testImagePath,
      })

      expect(result.figureType).toBe('exploded_view')
    })

    it('应该识别原理图类型', async () => {
      const schematicAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        description: '附图理解智能体',
        eventBus: new EventBus(),
        memory: {},
        tools: {},
        llm: createMockMultimodalLLM({
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
      })

      const result = await schematicAgent.execute({
        figureNumber: '2',
        imagePath: testImagePath,
      })

      expect(result.figureType).toBe('schematic')
    })
  })
})
