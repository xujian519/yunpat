import * as fs from 'fs'
import { z } from 'zod'
import {
  EnhancedBaseTool,
  ToolCategory,
  ToolContext,
  ToolResultBlockParam,
  InterruptBehavior,
} from '@yunpat/core'
import { loadDocx, type ResponseStatementData } from './shared.js'

export class ResponseStatementGeneratorTool extends EnhancedBaseTool<
  {
    data: ResponseStatementData
    outputPath: string
  },
  {
    success: boolean
    outputPath: string
    pages: number
  }
> {
  readonly metadata = {
    name: 'response_statement_generator',
    description: '生成审查意见陈述书',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      data: z.object({
        applicationNumber: z.string().describe('申请号'),
        inventionTitle: z.string().describe('发明名称'),
        reviewOpinionSummary: z.string().describe('审查意见摘要'),
        responsePoints: z
          .array(
            z.object({
              examinerView: z.string(),
              applicantResponse: z.string(),
              legalBasis: z.string().optional(),
            })
          )
          .describe('答复要点'),
        amendments: z
          .array(
            z.object({
              location: z.string(),
              originalContent: z.string(),
              newContent: z.string(),
              reason: z.string(),
            })
          )
          .optional()
          .describe('修改说明'),
        applicant: z
          .object({
            name: z.string(),
            address: z.string(),
          })
          .optional()
          .describe('申请人信息'),
        date: z.string().optional().describe('日期'),
      }),
      outputPath: z.string().describe('输出文件路径'),
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
    timeout: 30000,
    retryable: false,
    cleanup: async () => {
      console.log('[ResponseStatementGeneratorTool] 中断清理')
    },
  }

  async renderToolResultMessage(result: {
    success: boolean
    outputPath: string
    pages: number
  }): Promise<ToolResultBlockParam[]> {
    if (!result.success) {
      return [{ type: 'text', text: `[审查意见陈述书生成] 失败` }]
    }
    return [
      {
        type: 'text',
        text: `[审查意见陈述书生成] 成功\n- 输出路径: ${result.outputPath}\n- 页数: ${result.pages}`,
      },
    ]
  }

  async renderToolUseMessage(input: {
    data: ResponseStatementData
    outputPath: string
  }): Promise<string> {
    return `生成审查意见陈述书: ${input.data.inventionTitle} → ${input.outputPath}`
  }

  async execute(
    input: {
      data: ResponseStatementData
      outputPath: string
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; pages: number }> {
    const { docx: docxModule, docxPacker } = await loadDocx()

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxModule
    const { data, outputPath } = input

    const children: any[] = []

    children.push(
      new Paragraph({
        text: '意见陈述书',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    )

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `申请号：${data.applicationNumber}`,
            font: '宋体',
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `发明名称：${data.inventionTitle}`,
            font: '宋体',
            size: 24,
          }),
        ],
      })
    )

    children.push(
      new Paragraph({
        text: '审查意见摘要',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.reviewOpinionSummary,
            font: '宋体',
            size: 24,
          }),
        ],
      })
    )

    children.push(
      new Paragraph({
        text: '答复要点',
        heading: HeadingLevel.HEADING_2,
      })
    )

    for (let i = 0; i < data.responsePoints.length; i++) {
      const point = data.responsePoints[i]
      children.push(
        new Paragraph({
          text: `${i + 1}. ${point.examinerView}`,
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `申请人答复：${point.applicantResponse}`,
              font: '宋体',
              size: 24,
            }),
          ],
        })
      )

      if (point.legalBasis) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `法律依据：${point.legalBasis}`,
                font: '宋体',
                size: 24,
                italics: true,
              }),
            ],
          })
        )
      }
    }

    if (data.amendments && data.amendments.length > 0) {
      children.push(
        new Paragraph({
          text: '修改说明',
          heading: HeadingLevel.HEADING_2,
        })
      )

      for (let i = 0; i < data.amendments.length; i++) {
        const amendment = data.amendments[i]
        children.push(
          new Paragraph({
            text: `修改 ${i + 1}`,
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `修改位置：${amendment.location}`,
                font: '宋体',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `原内容：${amendment.originalContent}`,
                font: '宋体',
                size: 24,
                strike: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `新内容：${amendment.newContent}`,
                font: '宋体',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `修改理由：${amendment.reason}`,
                font: '宋体',
                size: 24,
              }),
            ],
          })
        )
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
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

  private estimatePages(data: ResponseStatementData): number {
    let wordCount = data.reviewOpinionSummary.length
    for (const point of data.responsePoints) {
      wordCount += point.examinerView.length + point.applicantResponse.length
    }
    if (data.amendments) {
      for (const amendment of data.amendments) {
        wordCount +=
          amendment.location.length +
          amendment.originalContent.length +
          amendment.newContent.length +
          amendment.reason.length
      }
    }
    return Math.ceil(wordCount / 500)
  }
}
