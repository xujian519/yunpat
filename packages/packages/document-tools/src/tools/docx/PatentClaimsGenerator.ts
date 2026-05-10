import * as fs from 'fs'
import { z } from 'zod'
import {
  EnhancedBaseTool,
  ToolCategory,
  ToolContext,
  ToolResultBlockParam,
  InterruptBehavior,
} from '@yunpat/core'
import { loadDocx } from './shared.js'

export class PatentClaimsGeneratorTool extends EnhancedBaseTool<
  {
    claims: Array<{
      type: 'independent' | 'dependent'
      number: number
      content: string
      dependsOn?: number
    }>
    outputPath: string
  },
  {
    success: boolean
    outputPath: string
    claimsCount: number
  }
> {
  readonly metadata = {
    name: 'patent_claims_generator',
    description: '生成权利要求书',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      claims: z
        .array(
          z.object({
            type: z.enum(['independent', 'dependent']),
            number: z.number(),
            content: z.string(),
            dependsOn: z.number().optional(),
          })
        )
        .describe('权利要求数组'),
      outputPath: z.string().describe('输出文件路径'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      outputPath: z.string(),
      claimsCount: z.number(),
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
      console.log('[PatentClaimsGeneratorTool] 中断清理')
    },
  }

  async renderToolResultMessage(result: {
    success: boolean
    outputPath: string
    claimsCount: number
  }): Promise<ToolResultBlockParam[]> {
    if (!result.success) {
      return [{ type: 'text', text: `[权利要求书生成] 失败` }]
    }
    return [
      {
        type: 'text',
        text: `[权利要求书生成] 成功\n- 输出路径: ${result.outputPath}\n- 权利要求数: ${result.claimsCount}`,
      },
    ]
  }

  async renderToolUseMessage(input: {
    claims: Array<{
      type: 'independent' | 'dependent'
      number: number
      content: string
      dependsOn?: number
    }>
    outputPath: string
  }): Promise<string> {
    return `生成权利要求书: ${input.claims.length} 条 → ${input.outputPath}`
  }

  async execute(
    input: {
      claims: Array<{
        type: 'independent' | 'dependent'
        number: number
        content: string
        dependsOn?: number
      }>
      outputPath: string
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; claimsCount: number }> {
    const { docx: docxModule, docxPacker } = await loadDocx()

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxModule
    const { claims, outputPath } = input

    const children: any[] = []

    children.push(
      new Paragraph({
        text: '权利要求书',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    )

    for (const claim of claims) {
      const claimText = `${claim.number}. ${claim.content}`
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: claimText,
              font: '宋体',
              size: 24,
              bold: claim.type === 'independent',
            }),
          ],
        })
      )
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
      claimsCount: claims.length,
    }
  }
}
