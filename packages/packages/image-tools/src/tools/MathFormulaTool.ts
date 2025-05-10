import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext, ToolResultBlockParam } from '@yunpat/core'

/**
 * 数学公式识别工具
 *
 * 通过HTTP API调用数学公式识别服务（基于Pix2Text）
 */
export class MathFormulaTool extends EnhancedBaseTool<
  {
    imageData: string
    imageFormat?: string
  },
  {
    success: boolean
    message: string
    latex?: string
    confidence?: number
  }
> {
  private readonly serviceUrl: string

  constructor(serviceUrl: string = 'http://127.0.0.1:8767') {
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
    name: 'math_formula_recognition',
    description: '识别图片中的数学公式（LaTeX输出）',
    category: ToolCategory.UTILITY,
    isConcurrencySafe: true,
    inputSchema: z.object({
      imageData: z.string().describe('Base64编码的图片数据'),
      imageFormat: z.string().optional().default('png').describe('图片格式（png, jpg等）'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      latex: z.string().optional(),
      confidence: z.number().optional(),
    }),
    permissions: ['network:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  /**
   * 渲染数学公式识别结果为 LLM message blocks
   */
  async renderToolResultMessage(result: {
    success: boolean
    message: string
    latex?: string
    confidence?: number
  }): Promise<ToolResultBlockParam[]> {
    if (!result.success || !result.latex) {
      return [{ type: 'text', text: `[数学公式识别] 失败: ${result.message}` }]
    }

    const lines: string[] = []
    lines.push(`## 数学公式识别结果`)
    lines.push('')
    lines.push(`- 置信度: ${((result.confidence ?? 0) * 100).toFixed(1)}%`)
    lines.push('')
    lines.push('```latex')
    lines.push(result.latex)
    lines.push('```')

    return [{ type: 'text', text: lines.join('\n') }]
  }

  /**
   * 渲染工具调用请求
   */
  async renderToolUseMessage(input: { imageData: string; imageFormat?: string }): Promise<string> {
    return `数学公式识别: ${input.imageFormat ?? 'png'} → LaTeX`
  }

  async execute(
    input: {
      imageData: string
      imageFormat?: string
    },
    _context: ToolContext
  ): Promise<{
    success: boolean
    message: string
    latex?: string
    confidence?: number
  }> {
    const { imageData, imageFormat = 'png' } = input

    try {
      const response = await fetch(`${this.serviceUrl}/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageData,
          image_format: imageFormat,
        }),
        signal: AbortSignal.timeout(30000), // 30秒超时
      })

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ detail: response.statusText }))) as {
          detail?: string
        }
        throw new Error(`数学公式识别服务返回错误: ${errorData.detail || response.statusText}`)
      }

      const data = (await response.json()) as {
        success: boolean
        message: string
        latex?: string
        confidence?: number
      }

      return {
        success: data.success,
        message: data.message,
        latex: data.latex,
        confidence: data.confidence,
      }
    } catch (error) {
      // 检查是否是连接错误（服务未启动）
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        throw new Error(
          '无法连接到数学公式识别服务。请确保服务已启动：\n' +
            '  cd services/math-formula-service && python main.py'
        )
      }

      throw new Error(`数学公式识别失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
