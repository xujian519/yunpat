/**
 * DOCX文档解析工具
 *
 * 支持DOCX转HTML/Markdown/Text
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'
import { DocumentParseResult, DocumentType, ElementType, OutputFormat } from '../types/document.js'
import TurndownService from 'turndown'

// 动态导入
let mammoth: any

async function loadMammoth() {
  if (!mammoth) {
    mammoth = (await import('mammoth')).default || (await import('mammoth'))
  }
}

/**
 * DOCX提取文本工具
 */
export class DocxExtractTextTool extends EnhancedBaseTool<
  {
    filePath: string
  },
  {
    text: string
    metadata: {
      filename: string
      size: number
    }
  }
> {
  readonly metadata = {
    name: 'docx_extract_text',
    description: '从DOCX文件中提取纯文本内容',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('DOCX文件路径'),
    }),
    outputSchema: z.object({
      text: z.string().describe('提取的文本内容'),
      metadata: z.object({
        filename: z.string(),
        size: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { filePath: string },
    _context: ToolContext
  ): Promise<{ text: string; metadata: any }> {
    await loadMammoth()

    const buffer = fs.readFileSync(input.filePath)
    const result = await mammoth.extractRawText({ buffer: buffer })

    const stats = fs.statSync(input.filePath)

    return {
      text: result.value,
      metadata: {
        filename: path.basename(input.filePath),
        size: stats.size,
      },
    }
  }
}

/**
 * DOCX转HTML工具
 */
export class DocxToHtmlTool extends EnhancedBaseTool<
  {
    filePath: string
    styleMap?: string
  },
  {
    html: string
    messages: string[]
  }
> {
  readonly metadata = {
    name: 'docx_to_html',
    description: '将DOCX文件转换为HTML格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('DOCX文件路径'),
      styleMap: z.string().optional().describe('样式映射配置'),
    }),
    outputSchema: z.object({
      html: z.string().describe('HTML内容'),
      messages: z.array(z.string()).describe('转换消息'),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { filePath: string; styleMap?: string },
    _context: ToolContext
  ): Promise<{ html: string; messages: string[] }> {
    await loadMammoth()

    const buffer = fs.readFileSync(input.filePath)
    const options: any = {}

    if (input.styleMap) {
      options.styleMap = input.styleMap
    }

    const result = await mammoth.convertToHtml({ buffer: buffer }, options)

    return {
      html: result.value,
      messages: result.messages,
    }
  }
}

/**
 * DOCX转Markdown工具
 */
export class DocxToMarkdownTool extends EnhancedBaseTool<
  {
    filePath: string
    headingStyle?: 'atx' | 'setext'
    codeBlockStyle?: 'fenced' | 'indented'
  },
  {
    markdown: string
    metadata: {
      filename: string
      size: number
    }
  }
> {
  readonly metadata = {
    name: 'docx_to_markdown',
    description: '将DOCX文件转换为Markdown格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('DOCX文件路径'),
      headingStyle: z.enum(['atx', 'setext']).optional().default('atx').describe('标题样式'),
      codeBlockStyle: z
        .enum(['fenced', 'indented'])
        .optional()
        .default('fenced')
        .describe('代码块样式'),
    }),
    outputSchema: z.object({
      markdown: z.string().describe('Markdown内容'),
      metadata: z.object({
        filename: z.string(),
        size: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { filePath: string; headingStyle?: string; codeBlockStyle?: string },
    context: ToolContext
  ): Promise<{ markdown: string; metadata: any }> {
    // 先转换为HTML
    const htmlTool = new DocxToHtmlTool()
    const { html } = await htmlTool.execute(
      {
        filePath: input.filePath,
      },
      context
    )

    // 使用Turndown将HTML转换为Markdown
    const turndownService = new TurndownService({
      headingStyle: (input.headingStyle as any) || 'atx',
      codeBlockStyle: (input.codeBlockStyle as any) || 'fenced',
    })

    const markdown = turndownService.turndown(html)

    const stats = fs.statSync(input.filePath)

    return {
      markdown,
      metadata: {
        filename: path.basename(input.filePath),
        size: stats.size,
      },
    }
  }
}

/**
 * DOCX解析工具（完整版）
 */
export class DocxParseTool extends EnhancedBaseTool<
  {
    filePath: string
    outputFormat?: OutputFormat
  },
  DocumentParseResult
> {
  readonly metadata = {
    name: 'docx_parse',
    description: '解析DOCX文件并输出结构化数据',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('DOCX文件路径'),
      outputFormat: z
        .enum([OutputFormat.JSON, OutputFormat.MARKDOWN, OutputFormat.TEXT])
        .optional()
        .default(OutputFormat.TEXT)
        .describe('输出格式'),
    }),
    outputSchema: z.object({
      documentType: z.nativeEnum(DocumentType),
      filename: z.string(),
      text: z.string(),
      elements: z.array(z.any()),
      metadata: z.object({}),
      parseTime: z.number(),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { filePath: string; outputFormat?: OutputFormat },
    context: ToolContext
  ): Promise<DocumentParseResult> {
    const startTime = Date.now()

    // 先提取文本
    const textTool = new DocxExtractTextTool()
    const { text } = await textTool.execute({ filePath: input.filePath }, context)

    // 简单的元素提取
    const lines = text.split('\n').filter((line) => line.trim())
    const elements = this.extractElements(lines)

    const stats = fs.statSync(input.filePath)

    return {
      documentType: DocumentType.DOCX,
      filename: path.basename(input.filePath),
      text,
      elements,
      metadata: {
        size: stats.size,
      },
      parseTime: Date.now() - startTime,
    }
  }

  /**
   * 从文本行中提取元素
   */
  private extractElements(lines: string[]): any[] {
    const elements: any[] = []

    for (const line of lines) {
      // 检测标题（全大写或以#开头）
      if (line.match(/^#+\s/) || line.match(/^[A-Z][A-Z\s]{5,}$/)) {
        const levelMatch = line.match(/^(#+)\s/)
        const level = levelMatch ? levelMatch[1].length : 1
        elements.push({
          type: ElementType.TITLE,
          content: line.replace(/^#+\s/, ''),
          metadata: { level },
        })
      }
      // 检测列表项
      else if (line.match(/^\d+\.\s/) || line.match(/^[-*]\s/)) {
        elements.push({
          type: ElementType.LIST,
          content: line.replace(/^[\d\-*]+\.\s/, ''),
        })
      }
      // 普通段落
      else {
        elements.push({
          type: ElementType.PARAGRAPH,
          content: line,
        })
      }
    }

    return elements
  }
}
