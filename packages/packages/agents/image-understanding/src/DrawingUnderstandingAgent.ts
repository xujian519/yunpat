/**
 * 附图理解智能体
 *
 * 使用多模态模型理解专利说明书附图
 */

import { ProfessionalAgent, type ProfessionalAgentConfig, type ExtendedExecutionContext } from '@yunpat/agent-base'

// ========== 常量定义 ==========

/** 支持的图像格式 */
const SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] as const
type ImageFormat = (typeof SUPPORTED_FORMATS)[number]

/** 最大图像大小（20MB） */
const MAX_IMAGE_SIZE = 20 * 1024 * 1024

/** 最小置信度阈值 */
const MIN_CONFIDENCE_THRESHOLD = 0.7

/** System Prompt 模板 */
const SYSTEM_PROMPT = `你是一位资深的专利代理师和技术文档专家，擅长理解专利说明书附图。

你的任务是分析提供的附图，提取以下信息：
1. **附图类型**：爆炸图、原理图、流程图、框图、剖视图、透视图等
2. **主要组件**：图中的主要部件、零件、模块等
3. **连接关系**：组件之间的连接、装配关系
4. **文字标签**：图中的标注、编号、说明文字
5. **结构分析**：整体结构和层次关系
6. **技术特征**：体现的技术创新点和关键特征

输出必须是严格的 JSON 格式，包含以下字段：
\`\`\`json
{
  "figureType": "schematic|exploded_view|flow_chart|...",
  "overview": "附图主要内容概述",
  "components": [{"type": "component", "description": "组件描述", "boundingBox": {"x": 10, "y": 20, "width": 30, "height": 40}, "confidence": 0.9}],
  "connections": [],
  "labels": [],
  "annotations": [],
  "structureAnalysis": {"mainStructure": "主要结构", "subStructures": ["子结构1", "子结构2"], "hierarchy": ["层次1", "层次2"]},
  "correspondence": {"technicalFeatures": ["特征1", "特征2"], "suggestedDescription": "附图说明建议"},
  "confidence": 0.85
}
\`\`\`

注意事项：
- boundingBox 使用百分比坐标（0-100），左上角为原点
- confidence 范围 0-1，表示识别置信度
- overview 应简洁明了，50-100字
- suggestedDescription 应符合专利附图说明的撰写规范`

// ========== 类型定义 ==========

export interface DrawingInput {
  figureNumber: string
  figureTitle?: string
  description?: string
  imagePath: string
  imageFormat?: ImageFormat
  imageBase64?: string // 预编码的 base64，跳过文件读取
  technicalField?: string
  technicalSolution?: string
}

export interface ImageElement {
  type: 'component' | 'connection' | 'label' | 'annotation' | 'structure' | 'other'
  description: string
  boundingBox?: { x: number; y: number; width: number; height: number }
  confidence: number
}

export interface DrawingUnderstanding {
  figureNumber: string
  figureType:
    | 'exploded_view'
    | 'schematic'
    | 'flow_chart'
    | 'block_diagram'
    | 'cross_section'
    | 'perspective_view'
    | 'other'
  overview: string
  components: ImageElement[]
  connections: ImageElement[]
  labels: ImageElement[]
  annotations: ImageElement[]
  structureAnalysis: {
    mainStructure: string
    subStructures: string[]
    hierarchy: string[]
  }
  correspondence: {
    technicalFeatures: string[]
    suggestedDescription: string
  }
  confidence: number
  timestamp: number
}

// ========== 智能体实现 ==========

export class DrawingUnderstandingAgent extends ProfessionalAgent<DrawingInput, DrawingUnderstanding> {
  constructor(config: ProfessionalAgentConfig) {
    super(config)
  }
  protected async plan(input: DrawingInput, _context: ExtendedExecutionContext) {
    this.checkDrawingInput(input)

    const imageBase64 = input.imageBase64 || (await this.loadAndEncodeImage(input.imagePath))

    return { input, imageBase64 }
  }

  protected async act(
    { input, imageBase64 }: { input: DrawingInput; imageBase64?: string },
    context: ExtendedExecutionContext
  ): Promise<DrawingUnderstanding> {
    if (!context.llm) {
      throw new Error('LLM 未配置')
    }

    if (!imageBase64) {
      throw new Error('图像编码失败')
    }

    const systemPrompt =
      SYSTEM_PROMPT + (input.technicalField ? `\n技术领域：${input.technicalField}` : '')
    const userPrompt = this.buildUserPrompt(input, imageBase64)

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parseUnderstanding(response.message.content || '', input)
  }

  // ========== 私有方法 ==========

  private checkDrawingInput(input: DrawingInput): void {
    if (!input.figureNumber?.trim()) {
      throw new Error('附图编号不能为空')
    }
    if (!input.imagePath?.trim()) {
      throw new Error('图像路径不能为空')
    }
  }

  private async loadAndEncodeImage(imagePath: string): Promise<string> {
    const { readFile } = await import('fs/promises')
    const { extname, resolve, normalize, relative, isAbsolute } = await import('path')
    const { existsSync, statSync } = await import('fs')

    const resolvedPath = resolve(normalize(imagePath))

    // 路径遍历防护：确保解析后的路径在 cwd 或其子目录内
    const cwd = resolve(process.cwd())
    const rel = relative(cwd, resolvedPath)
    if (isAbsolute(rel) || rel.startsWith('..')) {
      throw new Error(`图像路径不在允许的目录内: ${imagePath}`)
    }

    if (!existsSync(resolvedPath)) {
      throw new Error(`图像文件不存在: ${imagePath}`)
    }

    const stats = statSync(resolvedPath)
    if (stats.size > MAX_IMAGE_SIZE) {
      throw new Error(`图像文件过大 (${(stats.size / 1024 / 1024).toFixed(2)}MB)，最大支持 20MB`)
    }

    const imageBuffer = await readFile(resolvedPath)
    const ext = extname(resolvedPath).toLowerCase().substring(1) as ImageFormat

    if (!SUPPORTED_FORMATS.includes(ext)) {
      throw new Error(`不支持的图像格式: ${ext}`)
    }

    const base64 = imageBuffer.toString('base64')
    return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
  }

  private buildUserPrompt(input: DrawingInput, imageBase64: string): string {
    let prompt = `## 附图 ${input.figureNumber}`

    if (input.figureTitle) {
      prompt += `\n标题：${input.figureTitle}`
    }
    if (input.description) {
      prompt += `\n原描述：${input.description}`
    }
    if (input.technicalSolution) {
      prompt += `\n\n## 相关技术方案\n${input.technicalSolution}`
    }

    prompt += `\n\n## 附图图像\n[图像] ${imageBase64}`
    prompt += `\n\n请分析以上附图，输出 JSON 格式的理解结果。`

    return prompt
  }

  private parseUnderstanding(response: string, input: DrawingInput): DrawingUnderstanding {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('响应中未找到 JSON 格式')
      }

      const data = JSON.parse(jsonMatch[0])

      return {
        figureNumber: input.figureNumber,
        figureType: data.figureType ?? 'other',
        overview: data.overview ?? '',
        components: data.components ?? [],
        connections: data.connections ?? [],
        labels: data.labels ?? [],
        annotations: data.annotations ?? [],
        structureAnalysis: {
          mainStructure: data.structureAnalysis?.mainStructure ?? '',
          subStructures: data.structureAnalysis?.subStructures ?? [],
          hierarchy: data.structureAnalysis?.hierarchy ?? [],
        },
        correspondence: {
          technicalFeatures: data.correspondence?.technicalFeatures ?? [],
          suggestedDescription: data.correspondence?.suggestedDescription ?? '',
        },
        confidence: data.confidence ?? 0.5,
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error('[DrawingUnderstandingAgent] 解析响应失败:', error)
      return this.getDefaultUnderstanding(input)
    }
  }

  private getDefaultUnderstanding(input: DrawingInput): DrawingUnderstanding {
    return {
      figureNumber: input.figureNumber,
      figureType: 'other',
      overview: '无法分析附图内容',
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
        suggestedDescription: `图${input.figureNumber}为[附图说明]`,
      },
      confidence: 0.0,
      timestamp: Date.now(),
    }
  }
}
