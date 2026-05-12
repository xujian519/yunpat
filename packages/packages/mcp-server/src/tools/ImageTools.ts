/**
 * 图像类工具 — 包装 image-understanding 和 technical-drawing Agent
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

// ============================================================
// ImageUnderstandingTool
// ============================================================

const imageUnderstandingSchema = z.object({
  imagePath: z.string().describe('图片文件路径'),
  figureNumber: z.string().describe('附图编号，如 "图1"'),
  figureTitle: z.string().optional().describe('附图标题'),
  description: z.string().optional().describe('附图说明文字'),
  imageFormat: z.enum(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']).optional().describe('图片格式'),
  technicalField: z.string().optional().describe('技术领域（辅助理解）'),
  technicalSolution: z.string().optional().describe('技术方案（辅助理解）'),
})

export class ImageUnderstandingTool extends BaseMcpTool<
  z.infer<typeof imageUnderstandingSchema>,
  any
> {
  readonly metadata = {
    name: 'image_understanding',
    description:
      '附图理解分析：使用多模态模型理解专利附图，识别图中的组件、连接关系和标注，生成附图说明建议。用于专利说明书附图部分的撰写辅助。',
    version: '1.0.0',
    inputSchema: imageUnderstandingSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof imageUnderstandingSchema>,
    context: McpToolContext
  ) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { DrawingUnderstandingAgent } = await import('@yunpat/agent-image-understanding')
        const agent = new DrawingUnderstandingAgent({
          name: 'image-understanding',
          description: '附图理解智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[ImageUnderstandingTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      figureNumber: input.figureNumber,
      figureType: 'other',
      overview: `附图 ${input.figureNumber} — 需要多模态模型进行图像理解`,
      components: [],
      connections: [],
      labels: [],
      confidence: 0.1,
    }
  }
}

// ============================================================
// TechnicalDrawingTool
// ============================================================

const technicalDrawingSchema = z.object({
  imageData: z.string().describe('图片路径或 Base64 编码数据'),
  imageFormat: z.enum(['png', 'jpg', 'jpeg']).optional().default('png').describe('图片格式'),
  drawingType: z
    .enum(['general', 'chemical', 'math', 'electrical'])
    .optional()
    .describe('图纸类型（可选，自动检测）'),
  autoDetect: z.boolean().optional().default(true).describe('是否自动检测图纸类型'),
})

export class TechnicalDrawingTool extends BaseMcpTool<z.infer<typeof technicalDrawingSchema>, any> {
  readonly metadata = {
    name: 'technical_drawing',
    description:
      '技术图纸识别：识别化学结构式、数学公式、电路图等技术图纸，提取 SMILES、LaTeX 等结构化表示。用于专利附图的自动化识别。',
    version: '1.0.0',
    inputSchema: technicalDrawingSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof technicalDrawingSchema>,
    context: McpToolContext
  ) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { TechnicalDrawingAgent } = await import('@yunpat/technical-drawing')
        const agent = new TechnicalDrawingAgent({
          name: 'technical-drawing',
          description: '技术图纸识别智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[TechnicalDrawingTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      success: false,
      detectedType: input.drawingType || 'general',
      elements: [],
      recognitionTimeMs: 0,
    }
  }
}
