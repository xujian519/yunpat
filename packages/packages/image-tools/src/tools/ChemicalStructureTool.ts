import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext, ToolResultBlockParam } from '@yunpat/core'

/**
 * 化学结构识别工具
 *
 * 通过HTTP API调用化学结构识别服务（基于Imago）
 */
export class ChemicalStructureTool extends EnhancedBaseTool<
  {
    imageData: string
    imageFormat?: string
    outputFormat?: string
  },
  {
    success: boolean
    message: string
    structure?: string
    confidence?: number
    format: string
  }
> {
  private readonly serviceUrl: string

  constructor(serviceUrl: string = 'http://127.0.0.1:8766') {
    super()
    this.serviceUrl = serviceUrl
  }

  /**
   * 标记为只读操作（识别服务，不修改数据）
   */
  isReadOnly(): boolean {
    return true
  }

  readonly metadata = {
    name: 'chemical_structure_recognition',
    description: '识别图片中的化学结构（分子式、反应方程式等）',
    category: ToolCategory.UTILITY,
    isConcurrencySafe: true,
    inputSchema: z.object({
      imageData: z.string().describe('Base64编码的图片数据'),
      imageFormat: z.string().optional().default('png').describe('图片格式（png, jpg等）'),
      outputFormat: z
        .string()
        .optional()
        .default('smiles')
        .describe('输出格式（smiles, molfile等）'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      structure: z.string().optional(),
      confidence: z.number().optional(),
      format: z.string(),
    }),
    permissions: ['network:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  /**
   * 渲染化学结构识别结果为 LLM message blocks
   */
  async renderToolResultMessage(result: {
    success: boolean
    message: string
    structure?: string
    confidence?: number
    format: string
  }): Promise<ToolResultBlockParam[]> {
    if (!result.success || !result.structure) {
      return [{ type: 'text', text: `[化学结构识别] 失败: ${result.message}` }]
    }

    const lines: string[] = []
    lines.push(`## 化学结构识别结果`)
    lines.push('')
    lines.push(`- 格式: ${result.format.toUpperCase()}`)
    lines.push(`- 置信度: ${((result.confidence ?? 0) * 100).toFixed(1)}%`)
    lines.push('')
    lines.push('```')
    lines.push(result.structure)
    lines.push('```')

    return [{ type: 'text', text: lines.join('\n') }]
  }

  /**
   * 渲染工具调用请求
   */
  async renderToolUseMessage(input: {
    imageData: string
    imageFormat?: string
    outputFormat?: string
  }): Promise<string> {
    return `化学结构识别: ${input.imageFormat ?? 'png'} → ${input.outputFormat ?? 'smiles'}`
  }

  async execute(
    input: {
      imageData: string
      imageFormat?: string
      outputFormat?: string
    },
    _context: ToolContext
  ): Promise<{
    success: boolean
    message: string
    structure?: string
    confidence?: number
    format: string
  }> {
    const { imageData, imageFormat = 'png', outputFormat = 'smiles' } = input

    try {
      const response = await fetch(`${this.serviceUrl}/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageData,
          image_format: imageFormat,
          output_format: outputFormat,
        }),
        signal: AbortSignal.timeout(30000), // 30秒超时
      })

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ detail: response.statusText }))) as {
          detail?: string
        }
        throw new Error(`化学结构识别服务返回错误: ${errorData.detail || response.statusText}`)
      }

      const data = (await response.json()) as {
        success: boolean
        message: string
        structure?: string
        confidence?: number
        format: string
      }

      return {
        success: data.success,
        message: data.message,
        structure: data.structure,
        confidence: data.confidence,
        format: data.format,
      }
    } catch (error) {
      // 检查是否是连接错误（服务未启动）
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        throw new Error(
          '无法连接到化学结构识别服务。请确保服务已启动：\n' +
            '  cd services/chemical-structure-service && python main.py'
        )
      }

      throw new Error(`化学结构识别失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
