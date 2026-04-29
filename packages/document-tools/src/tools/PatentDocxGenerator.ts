/**
 * 专利文档生成工具
 *
 * 基于 docx.js 生成专利申请文件、意见陈述书等
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

// 动态导入 docx
let docx: any;
let docxPacker: any;

async function loadDocx() {
  if (!docx) {
    const module = await import('docx');
    docx = module;
    docxPacker = module.Packer;
  }
}

/**
 * 专利申请文件数据结构
 */
export interface PatentApplicationData {
  /** 发明名称 */
  inventionTitle: string;
  /** 技术领域 */
  technicalField: string;
  /** 背景技术 */
  backgroundArt: string;
  /** 发明内容 */
  inventionContent: string;
  /** 附图说明 */
  drawingsDescription?: string;
  /** 具体实施方式 */
  embodiment?: string;
  /** 权利要求书 */
  claims: Array<{
    /** 权利要求类型（独立/从属） */
    type: 'independent' | 'dependent';
    /** 权利要求编号 */
    number: number;
    /** 权利要求内容 */
    content: string;
    /** 从属关系（仅从属权利要求） */
    dependsOn?: number;
  }>;
  /** 摘要 */
  abstract: string;
  /** 申请人信息 */
  applicant?: {
    name: string;
    address: string;
  };
  /** 发明人信息 */
  inventors?: Array<{
    name: string;
    address: string;
  }>;
}

/**
 * 意见陈述书数据结构
 */
export interface ResponseStatementData {
  /** 申请号 */
  applicationNumber: string;
  /** 发明名称 */
  inventionTitle: string;
  /** 审查意见摘要 */
  reviewOpinionSummary: string;
  /** 答复要点 */
  responsePoints: Array<{
    /** 审查员观点 */
    examinerView: string;
    /** 申请人答复 */
    applicantResponse: string;
    /** 法律依据 */
    legalBasis?: string;
  }>;
  /** 修改说明 */
  amendments?: Array<{
    /** 修改位置 */
    location: string;
    /** 原内容 */
    originalContent: string;
    /** 新内容 */
    newContent: string;
    /** 修改理由 */
    reason: string;
  }>;
  /** 申请人信息 */
  applicant?: {
    name: string;
    address: string;
  };
  /** 日期 */
  date?: string;
}

/**
 * 专利申请文件生成工具
 */
export class PatentApplicationGeneratorTool extends EnhancedBaseTool<
  {
    data: PatentApplicationData;
    outputPath: string;
    template?: 'standard' | 'pct' | 'utility';
  },
  {
    success: boolean;
    outputPath: string;
    pages: number;
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
  };

  async execute(
    input: {
      data: PatentApplicationData;
      outputPath: string;
      template?: 'standard' | 'pct' | 'utility';
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; pages: number }> {
    await loadDocx();

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    const { data, outputPath } = input;

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: this.generateDocumentChildren(data, Document, Paragraph, TextRun, HeadingLevel, AlignmentType),
        },
      ],
    });

    // 保存文档
    await docxPacker.toBuffer(doc).then((buffer: Buffer) => {
      fs.writeFileSync(outputPath, buffer);
    });

    return {
      success: true,
      outputPath,
      pages: this.estimatePages(data),
    };
  }

  /**
   * 生成文档内容
   */
  private generateDocumentChildren(
    data: PatentApplicationData,
    Document: any,
    Paragraph: any,
    TextRun: any,
    HeadingLevel: any,
    AlignmentType: any
  ): any[] {
    const children: any[] = [];

    // 标题
    children.push(
      new Paragraph({
        text: '说明书',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );

    // 发明名称
    children.push(
      new Paragraph({
        text: `发明名称：${data.inventionTitle}`,
        heading: HeadingLevel.HEADING_2,
      })
    );

    // 技术领域
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
    );

    // 背景技术
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
    );

    // 发明内容
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
    );

    // 附图说明（如果有）
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
      );
    }

    // 具体实施方式（如果有）
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
      );
    }

    // 摘要
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
    );

    return children;
  }

  /**
   * 估算页数
   */
  private estimatePages(data: PatentApplicationData): number {
    const wordCount =
      data.technicalField.length +
      data.backgroundArt.length +
      data.inventionContent.length +
      (data.drawingsDescription?.length || 0) +
      (data.embodiment?.length || 0) +
      data.abstract.length;

    return Math.ceil(wordCount / 500); // 假设每页 500 字
  }
}

/**
 * 权利要求书生成工具
 */
export class PatentClaimsGeneratorTool extends EnhancedBaseTool<
  {
    claims: Array<{
      type: 'independent' | 'dependent';
      number: number;
      content: string;
      dependsOn?: number;
    }>;
    outputPath: string;
  },
  {
    success: boolean;
    outputPath: string;
    claimsCount: number;
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
  };

  async execute(
    input: {
      claims: Array<{
        type: 'independent' | 'dependent';
        number: number;
        content: string;
        dependsOn?: number;
      }>;
      outputPath: string;
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; claimsCount: number }> {
    await loadDocx();

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    const { claims, outputPath } = input;

    const children: any[] = [];

    // 标题
    children.push(
      new Paragraph({
        text: '权利要求书',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );

    // 生成权利要求
    for (const claim of claims) {
      const claimText = `${claim.number}. ${claim.content}`;
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
      );
    }

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    // 保存文档
    await docxPacker.toBuffer(doc).then((buffer: Buffer) => {
      fs.writeFileSync(outputPath, buffer);
    });

    return {
      success: true,
      outputPath,
      claimsCount: claims.length,
    };
  }
}

/**
 * 意见陈述书生成工具
 */
export class ResponseStatementGeneratorTool extends EnhancedBaseTool<
  {
    data: ResponseStatementData;
    outputPath: string;
  },
  {
    success: boolean;
    outputPath: string;
    pages: number;
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
  };

  async execute(
    input: {
      data: ResponseStatementData;
      outputPath: string;
    },
    _context: ToolContext
  ): Promise<{ success: boolean; outputPath: string; pages: number }> {
    await loadDocx();

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    const { data, outputPath } = input;

    const children: any[] = [];

    // 标题
    children.push(
      new Paragraph({
        text: '意见陈述书',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );

    // 申请信息
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
    );

    // 审查意见摘要
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
    );

    // 答复要点
    children.push(
      new Paragraph({
        text: '答复要点',
        heading: HeadingLevel.HEADING_2,
      })
    );

    for (let i = 0; i < data.responsePoints.length; i++) {
      const point = data.responsePoints[i];
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
      );

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
        );
      }
    }

    // 修改说明（如果有）
    if (data.amendments && data.amendments.length > 0) {
      children.push(
        new Paragraph({
          text: '修改说明',
          heading: HeadingLevel.HEADING_2,
        })
      );

      for (let i = 0; i < data.amendments.length; i++) {
        const amendment = data.amendments[i];
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
        );
      }
    }

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    // 保存文档
    await docxPacker.toBuffer(doc).then((buffer: Buffer) => {
      fs.writeFileSync(outputPath, buffer);
    });

    return {
      success: true,
      outputPath,
      pages: this.estimatePages(data),
    };
  }

  /**
   * 估算页数
   */
  private estimatePages(data: ResponseStatementData): number {
    let wordCount = data.reviewOpinionSummary.length;
    for (const point of data.responsePoints) {
      wordCount += point.examinerView.length + point.applicantResponse.length;
    }
    if (data.amendments) {
      for (const amendment of data.amendments) {
        wordCount +=
          amendment.location.length +
          amendment.originalContent.length +
          amendment.newContent.length +
          amendment.reason.length;
      }
    }
    return Math.ceil(wordCount / 500);
  }
}
