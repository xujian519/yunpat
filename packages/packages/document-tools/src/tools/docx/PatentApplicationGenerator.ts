import * as fs from 'fs'
import { z } from 'zod'
import {
  EnhancedBaseTool,
  ToolCategory,
  ToolContext,
  ToolResultBlockParam,
  InterruptBehavior,
} from '@yunpat/core'
import { loadDocx, type PatentApplicationData } from './shared.js'

export class PatentApplicationGeneratorTool extends EnhancedBaseTool<
  {
    data: PatentApplicationData
    outputPath: string
    template?: 'standard' | 'pct' | 'utility'
  },
  {
    success: boolean
    outputPath: string
    pages: number
  }
> {
  readonly metadata = {
    name: 'patent_application_generator',
    description: '生成专利申请文件（权利要求书、说明书等）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      data: z.object({
        inventionTitle: z.string().describe('发明名称'),
        technicalField: z.string().describe('技术领域'),
        backgroundArt: z.string().describe('背景技术'),
        inventionContent: z.string().describe('发明内容'),
        drawingsDescription: z.string().optional().describe('附图说明'),
        embodiment: z.string().optional().describe('具体实施方式'),
        claims: z
          .array(
            z.object({
              type: z.enum(['independent', 'dependent']),
              number: z.number(),
              content: z.string(),
              dependsOn: z.number().optional(),
            })
          )
          .describe('权利要求书'),
        abstract: z.string().describe('摘要'),
        applicant: z
          .object({
            name: z.string(),
            address: z.string(),
          })
          .optional()
          .describe('申请人信息'),
        inventors: z
          .array(
            z.object({
              name: z.string(),
              address: z.string(),
            })
          )
          .optional()
          .describe('发明人信息'),
      }),
      outputPath: z.string().describe('输出文件路径'),
      template: z
        .enum(['standard', 'pct', 'utility'])
        .optional()
        .default('standard')
        .describe('文档模板类型'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      outputPath: z.string(),
      pages: z.number(),
    }),
    permissions: ['fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  isDestructive(_input: unknown): boolean {
    return true
  }

  interruptBehavior: InterruptBehavior = {
    timeout: 60000,
    retryable: false,
    cleanup: async () => {
      console.log('[PatentApplicationGeneratorTool] 中断清理')
    },
  }

  async renderToolResultMessage(result: {
    success: boolean
    outputPath: string
    pages: number
  }): Promise<ToolResultBlockParam[]> {
    if (!result.success) {
      return [{ type: 'text', text: `[专利申请文件生成] 失败` }]
    }

    return [
      {
        type: 'text',
        text: `[专利申请文件生成] 成功\n- 输出路径: ${result.outputPath}\n- 页数: ${result.pages}`,
      },
    ]
  }

  async renderToolUseMessage(input: {
    data: PatentApplicationData
    outputPath: string
    template?: 'standard' | 'pct' | 'utility'
  }): Promise<string> {
    return `生成专利申请文件: "${input.data.inventionTitle}" → ${input.outputPath} (模板: ${input.template ?? 'standard'})`
  }

  async execute(
    input: {
      data: PatentApplicationData
      outputPath: string
      template?: 'standard' | 'pct' | 'utility'
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; pages: number }> {
    const { docx, docxPacker } = await loadDocx()

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx
    const { data, outputPath } = input

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: this.generateDocumentChildren(
            data,
            Document,
            Paragraph,
            TextRun,
            HeadingLevel,
            AlignmentType
          ),
        },
      ],
    })

    await docxPacker.toBuffer(doc).then((buffer: Buffer) => {
      fs.writeFileSync(outputPath, buffer)
    })

    return {
      success: true,
      outputPath,
      pages: this.estimatePages(data),
    }
  }

  private generateDocumentChildren(
    data: PatentApplicationData,
    Document: any,
    Paragraph: any,
    TextRun: any,
    HeadingLevel: any,
    AlignmentType: any
  ): any[] {
    const children: any[] = []

    children.push(
      new Paragraph({
        text: '说明书',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    )

    children.push(
      new Paragraph({
        text: `发明名称：${data.inventionTitle}`,
        heading: HeadingLevel.HEADING_2,
      })
    )

    children.push(
      new Paragraph({
        text: '技术领域',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.technicalField,
            font: '宋体',
            size: 24,
          }),
        ],
      })
    )

    children.push(
      new Paragraph({
        text: '背景技术',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.backgroundArt,
            font: '宋体',
            size: 24,
          }),
        ],
      })
    )

    children.push(
      new Paragraph({
        text: '发明内容',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.inventionContent,
            font: '宋体',
            size: 24,
          }),
        ],
      })
    )

    if (data.drawingsDescription) {
      children.push(
        new Paragraph({
          text: '附图说明',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: data.drawingsDescription,
              font: '宋体',
              size: 24,
            }),
          ],
        })
      )
    }

    if (data.embodiment) {
      children.push(
        new Paragraph({
          text: '具体实施方式',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: data.embodiment,
              font: '宋体',
              size: 24,
            }),
          ],
        })
      )
    }

    children.push(
      new Paragraph({
        text: '摘要',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.abstract,
            font: '宋体',
            size: 24,
          }),
        ],
      })
    )

    return children
  }

  private estimatePages(data: PatentApplicationData): number {
    const wordCount =
      data.technicalField.length +
      data.backgroundArt.length +
      data.inventionContent.length +
      (data.drawingsDescription?.length || 0) +
      (data.embodiment?.length || 0) +
      data.abstract.length

    return Math.ceil(wordCount / 500)
  }
}
