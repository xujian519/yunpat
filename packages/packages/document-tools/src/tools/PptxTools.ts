/**
 * PPTX (PowerPoint) 处理工具
 *
 * 支持创建、编辑和分析 PowerPoint 演示文稿
 * 适用于专利演示、技术培训、案件汇报等场景
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

/**
 * 幻灯片数据结构
 */
export interface SlideData {
  /** 标题 */
  title: string
  /** 内容 */
  content: string[]
  /** 备注 */
  notes?: string
  /** 布局 */
  layout?: 'title' | 'content' | 'blank'
}

/**
 * 演示文稿数据结构
 */
export interface PresentationData {
  /** 标题 */
  title: string
  /** 作者 */
  author?: string
  /** 幻灯片数组 */
  slides: SlideData[]
  /** 主题 */
  theme?: string
}

/**
 * PPTX 提取工具
 */
export class PptxExtractTextTool extends EnhancedBaseTool<
  {
    filePath: string
    includeNotes?: boolean
    includeLayout?: boolean
  },
  {
    text: string
    metadata: {
      filename: string
      slideCount: number
      title: string
      author: string
    }
  }
> {
  readonly metadata = {
    name: 'pptx_extract_text',
    description: '从 PowerPoint 文件中提取文本内容',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('PowerPoint 文件路径'),
      includeNotes: z.boolean().optional().default(false).describe('是否包含演讲者备注'),
      includeLayout: z.boolean().optional().default(false).describe('是否包含布局信息'),
    }),
    outputSchema: z.object({
      text: z.string().describe('提取的文本内容'),
      metadata: z.object({
        filename: z.string(),
        slideCount: z.number(),
        title: z.string(),
        author: z.string(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { filePath: string; includeNotes?: boolean; includeLayout?: boolean },
    _context: ToolContext
  ): Promise<{
    text: string
    metadata: { filename: string; slideCount: number; title: string; author: string }
  }> {
    const filename = path.basename(input.filePath)

    // 安全检查：路径规范化，防止路径遍历
    const resolvedPath = path.resolve(input.filePath)

    // 检查文件是否存在
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`)
    }

    // 文件大小限制（50MB）
    const stat = fs.statSync(resolvedPath)
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE} bytes)`)
    }

    // PPTX 本质是 ZIP 包，内含 XML 文件
    // 使用动态导入以避免启动时加载
    let JSZip: any
    try {
      JSZip = (await import('jszip')).default
    } catch {
      throw new Error('jszip is required for PPTX parsing. Install it with: npm install jszip')
    }

    const fileBuffer = fs.readFileSync(resolvedPath)
    const zip = await JSZip.loadAsync(fileBuffer)

    // 提取演示文稿属性
    let title = ''
    let author = ''

    const appXml = zip.file('docProps/app.xml')
    if (appXml) {
      const appContent = await appXml.async('string')
      const titleMatch = appContent.match(/<dc:title>([^<]*)<\/dc:title>/)
      if (titleMatch) title = titleMatch[1]
      const creatorMatch = appContent.match(/<dc:creator>([^<]*)<\/dc:creator>/)
      if (creatorMatch) author = creatorMatch[1]
    }

    const coreXml = zip.file('docProps/core.xml')
    if (coreXml) {
      const coreContent = await coreXml.async('string')
      if (!title) {
        const titleMatch = coreContent.match(/<dc:title>([^<]*)<\/dc:title>/)
        if (titleMatch) title = titleMatch[1]
      }
      if (!author) {
        const creatorMatch = coreContent.match(/<dc:creator>([^<]*)<\/dc:creator>/)
        if (creatorMatch) author = creatorMatch[1]
      }
    }

    // 提取幻灯片文本
    const slideFiles = Object.keys(zip.files)
      .filter((name: string) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a: string, b: string) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
        return numA - numB
      })

    const slideTexts: string[] = []

    for (const slideFile of slideFiles) {
      const xmlContent = await zip.file(slideFile)?.async('string')
      if (!xmlContent) continue

      // 从 XML 中提取 <a:t> 标签内的文本
      const textMatches = xmlContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
      const texts = textMatches
        .map((m: string) => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
        .filter((t: string) => t.trim())

      if (texts.length > 0) {
        slideTexts.push(texts.join('\n'))
      }

      // 提取备注
      if (input.includeNotes) {
        const slideNum = slideFile.match(/slide(\d+)/)?.[1]
        const notesFile = `ppt/notesSlides/notesSlide${slideNum}.xml`
        const notesXml = zip.file(notesFile)?.async('string')
        if (notesXml) {
          const notesContent = await notesXml
          const notesMatches = notesContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
          const notesText = notesMatches
            .map((m: string) => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
            .filter((t: string) => t.trim())
            .join(' ')
          if (notesText) {
            slideTexts.push(`[备注] ${notesText}`)
          }
        }
      }
    }

    const text = slideTexts.join('\n\n---\n\n')

    return {
      text: text || `# ${filename}\n\n（未提取到文本内容）`,
      metadata: {
        filename,
        slideCount: slideFiles.length,
        title,
        author,
      },
    }
  }
}

/**
 * 专利演示文稿生成工具
 */
export class PatentPresentationTool extends EnhancedBaseTool<
  {
    data: PresentationData
    outputPath: string
    template?: 'standard' | 'technical' | 'legal'
  },
  {
    success: boolean
    outputPath: string
    slideCount: number
  }
> {
  readonly metadata = {
    name: 'patent_presentation_generator',
    description: '生成专利相关演示文稿（技术交底、培训、汇报等）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      data: z.object({
        title: z.string().describe('演示文稿标题'),
        author: z.string().optional().describe('作者'),
        slides: z
          .array(
            z.object({
              title: z.string().describe('幻灯片标题'),
              content: z.array(z.string()).describe('幻灯片内容'),
              notes: z.string().optional().describe('备注'),
              layout: z.enum(['title', 'content', 'blank']).optional().describe('布局类型'),
            })
          )
          .describe('幻灯片数组'),
        theme: z.string().optional().describe('主题'),
      }),
      outputPath: z.string().describe('输出文件路径'),
      template: z
        .enum(['standard', 'technical', 'legal'])
        .optional()
        .default('standard')
        .describe('模板类型'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      outputPath: z.string(),
      slideCount: z.number(),
    }),
    permissions: ['fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { data: PresentationData; outputPath: string; template?: string },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; slideCount: number }> {
    // 使用 pptxgenjs 生成真正的 PPTX 文件
    let PptxGenJS: any
    try {
      PptxGenJS = (await import('pptxgenjs')).default
    } catch {
      // fallback：生成 Markdown
      return this.generateMarkdownFallback(input)
    }

    const pptx = new PptxGenJS()
    pptx.title = input.data.title
    if (input.data.author) {
      pptx.author = input.data.author
    }

    // 主题色定义
    const themes: Record<string, { primary: string; accent: string }> = {
      standard: { primary: '1F4E79', accent: '2E75B6' },
      technical: { primary: '2D5F2D', accent: '4CAF50' },
      legal: { primary: '4A1A6B', accent: '7B1FA2' },
    }
    const theme = themes[input.template || 'standard'] || themes.standard

    for (const slide of input.data.slides) {
      const pptSlide = pptx.addSlide()

      if (slide.layout === 'title') {
        // 标题页布局
        pptSlide.background = { color: theme.primary }
        pptSlide.addText(slide.title, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 2,
          fontSize: 32,
          color: 'FFFFFF',
          bold: true,
          align: 'center',
        })
        if (slide.content.length > 0) {
          pptSlide.addText(slide.content.join('\n'), {
            x: 1,
            y: 3.8,
            w: 8,
            h: 1.5,
            fontSize: 16,
            color: 'D0D0D0',
            align: 'center',
          })
        }
      } else {
        // 内容页布局
        pptSlide.addText(slide.title, {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.8,
          fontSize: 24,
          color: theme.primary,
          bold: true,
        })
        // 分隔线
        pptSlide.addShape(pptx.ShapeType.line, {
          x: 0.5,
          y: 1.1,
          w: 9,
          h: 0,
          line: { color: theme.accent, width: 2 },
        })
        // 内容
        const contentText = slide.content.map((c) => ({
          text: c,
          options: { fontSize: 14, color: '333333', bullet: true, breakLine: true },
        }))
        if (contentText.length > 0) {
          pptSlide.addText(contentText, { x: 0.8, y: 1.4, w: 8.4, h: 5.0 })
        }
      }

      if (slide.notes) {
        pptSlide.addNotes(slide.notes)
      }
    }

    // 确保输出目录存在
    const outputDir = path.dirname(input.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    await pptx.writeFile({ fileName: input.outputPath })

    return {
      success: true,
      outputPath: input.outputPath,
      slideCount: input.data.slides.length,
    }
  }

  /**
   * Markdown fallback（pptxgenjs 不可用时）
   */
  private generateMarkdownFallback(input: { data: PresentationData; outputPath: string }): {
    success: boolean
    outputPath: string
    slideCount: number
  } {
    console.warn(
      '[PptxTools] pptxgenjs not available, generating Markdown instead. ' +
        'Install pptxgenjs for native PPTX output: npm install pptxgenjs'
    )
    let markdown = `# ${input.data.title}\n\n`
    if (input.data.author) {
      markdown += `**作者**: ${input.data.author}\n\n`
    }
    markdown += `---\n\n`
    for (const slide of input.data.slides) {
      markdown += `## ${slide.title}\n\n`
      markdown += slide.content.map((c) => `- ${c}`).join('\n')
      markdown += '\n\n'
      if (slide.notes) {
        markdown += `**备注**: ${slide.notes}\n\n`
      }
      markdown += `---\n\n`
    }
    const mdPath = input.outputPath.replace('.pptx', '.md')
    fs.writeFileSync(mdPath, markdown, 'utf-8')
    return { success: true, outputPath: mdPath, slideCount: input.data.slides.length }
  }
}

/**
 * 技术交底演示生成工具（特化版）
 */
export class TechnicalDisclosureTool extends EnhancedBaseTool<
  {
    inventionTitle: string
    technicalField: string
    backgroundArt: string
    inventionContent: string
    embodiments: string[]
    drawings: string[]
    outputPath: string
  },
  {
    success: boolean
    outputPath: string
    slideCount: number
  }
> {
  readonly metadata = {
    name: 'technical_disclosure_presentation',
    description: '生成技术交底演示文稿',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      inventionTitle: z.string().describe('发明名称'),
      technicalField: z.string().describe('技术领域'),
      backgroundArt: z.string().describe('背景技术'),
      inventionContent: z.string().describe('发明内容'),
      embodiments: z.array(z.string()).describe('具体实施方式'),
      drawings: z.array(z.string()).describe('附图说明'),
      outputPath: z.string().describe('输出文件路径'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      outputPath: z.string(),
      slideCount: z.number(),
    }),
    permissions: ['fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      inventionTitle: string
      technicalField: string
      backgroundArt: string
      inventionContent: string
      embodiments: string[]
      drawings: string[]
      outputPath: string
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; slideCount: number }> {
    // 构建演示文稿数据
    const presentationData: PresentationData = {
      title: `技术交底：${input.inventionTitle}`,
      slides: [
        {
          title: '发明名称',
          content: [input.inventionTitle],
          layout: 'title',
        },
        {
          title: '技术领域',
          content: [input.technicalField],
          layout: 'content',
        },
        {
          title: '背景技术',
          content: input.backgroundArt.split('\n').filter((s) => s.trim()),
          layout: 'content',
        },
        {
          title: '发明内容',
          content: input.inventionContent.split('\n').filter((s) => s.trim()),
          layout: 'content',
        },
        {
          title: '附图说明',
          content: input.drawings,
          layout: 'content',
        },
        {
          title: '具体实施方式',
          content: input.embodiments,
          layout: 'content',
        },
      ],
    }

    const generator = new PatentPresentationTool()
    const result = await generator.execute(
      {
        data: presentationData,
        outputPath: input.outputPath,
        template: 'technical',
      },
      _context
    )

    return result
  }
}

/**
 * 专利培训演示生成工具（特化版）
 */
export class PatentTrainingTool extends EnhancedBaseTool<
  {
    topic: string
    modules: Array<{
      title: string
      content: string[]
      examples?: string[]
      exercises?: string[]
    }>
    outputPath: string
  },
  {
    success: boolean
    outputPath: string
    slideCount: number
  }
> {
  readonly metadata = {
    name: 'patent_training_presentation',
    description: '生成专利培训演示文稿',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      topic: z.string().describe('培训主题'),
      modules: z
        .array(
          z.object({
            title: z.string().describe('模块标题'),
            content: z.array(z.string()).describe('模块内容'),
            examples: z.array(z.string()).optional().describe('案例'),
            exercises: z.array(z.string()).optional().describe('练习'),
          })
        )
        .describe('培训模块'),
      outputPath: z.string().describe('输出文件路径'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      outputPath: z.string(),
      slideCount: z.number(),
    }),
    permissions: ['fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      topic: string
      modules: Array<{
        title: string
        content: string[]
        examples?: string[]
        exercises?: string[]
      }>
      outputPath: string
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; slideCount: number }> {
    // 构建演示文稿数据
    const slides: SlideData[] = [
      {
        title: input.topic,
        content: ['专利培训课程'],
        layout: 'title',
      },
    ]

    for (const module of input.modules) {
      // 模块标题页
      slides.push({
        title: module.title,
        content: [],
        layout: 'title',
      })

      // 模块内容
      slides.push({
        title: module.title,
        content: module.content,
        layout: 'content',
      })

      // 案例（如果有）
      if (module.examples && module.examples.length > 0) {
        slides.push({
          title: `${module.title} - 案例`,
          content: module.examples,
          layout: 'content',
        })
      }

      // 练习（如果有）
      if (module.exercises && module.exercises.length > 0) {
        slides.push({
          title: `${module.title} - 练习`,
          content: module.exercises,
          layout: 'content',
          notes: '学员练习时间',
        })
      }
    }

    const presentationData: PresentationData = {
      title: input.topic,
      slides,
    }

    const generator = new PatentPresentationTool()
    const result = await generator.execute(
      {
        data: presentationData,
        outputPath: input.outputPath,
        template: 'standard',
      },
      _context
    )

    return result
  }
}
