/**
 * 通用文档解析工具
 *
 * 自动检测文件类型并调用相应的解析器
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';
import {
  DocumentParseResult,
  DocumentType,
  ElementType,
  OutputFormat,
  ParseOptions,
} from '../types/document.js';
import { detectFileType } from '../utils/converters.js';

// 导入各类工具
import { PdfParseTool } from './PdfTools.js';
import { DocxParseTool } from './DocxTools.js';
import { ExcelParseTool } from './ExcelTools.js';
import { ImageOcrTool } from './OcrTools.js';

/**
 * 通用文档解析工具
 *
 * 自动检测文件类型并解析
 */
export class UniversalDocumentParserTool extends EnhancedBaseTool<
  {
    filePath: string;
    outputFormat?: OutputFormat;
    options?: ParseOptions;
  },
  DocumentParseResult
> {
  readonly metadata = {
    name: 'universal_document_parser',
    description: '通用文档解析工具 - 自动检测文件类型并解析（支持PDF、DOCX、Excel、图片等）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('文件路径'),
      outputFormat: z
        .enum([OutputFormat.JSON, OutputFormat.MARKDOWN, OutputFormat.TEXT])
        .optional()
        .default(OutputFormat.TEXT)
        .describe('输出格式'),
      options: z
        .object({
          ocrLanguages: z.array(z.string()).optional(),
          extractImages: z.boolean().optional(),
          extractTables: z.boolean().optional(),
        })
        .optional()
        .describe('解析选项'),
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
  };

  async execute(
    input: { filePath: string; outputFormat?: OutputFormat; options?: ParseOptions },
    context: ToolContext
  ): Promise<DocumentParseResult> {
    // 检查文件是否存在
    if (!fs.existsSync(input.filePath)) {
      throw new Error(`文件不存在: ${input.filePath}`);
    }

    // 检测文件类型
    const ext = path.extname(input.filePath).toLowerCase();
    const documentType = this.getDocumentType(ext);

    // 根据文件类型选择解析器
    switch (documentType) {
      case DocumentType.PDF:
        const pdfTool = new PdfParseTool();
        return await pdfTool.execute(
          {
            filePath: input.filePath,
            outputFormat: input.outputFormat,
          },
          context
        );

      case DocumentType.DOCX:
        const docxTool = new DocxParseTool();
        return await docxTool.execute(
          {
            filePath: input.filePath,
            outputFormat: input.outputFormat,
          },
          context
        );

      case DocumentType.XLSX:
      case DocumentType.XLS:
        const excelTool = new ExcelParseTool();
        return await excelTool.execute(
          {
            filePath: input.filePath,
            outputFormat: input.outputFormat,
          },
          context
        );

      case DocumentType.IMAGE:
        const ocrTool = new ImageOcrTool();
        const ocrResult = await ocrTool.execute(
          {
            imagePath: input.filePath,
            languages: input.options?.ocrLanguages || ['eng', 'chi_sim'],
            outputFormat: 'text',
          },
          context
        );

        return {
          documentType: DocumentType.IMAGE,
          filename: path.basename(input.filePath),
          text: ocrResult.text,
          elements: [
            {
              type: ElementType.PARAGRAPH,
              content: ocrResult.text,
            },
          ],
          metadata: {
            confidence: ocrResult.confidence,
            language: ocrResult.language,
          },
          parseTime: 0,
        };

      case DocumentType.TXT:
      case DocumentType.MD:
        const text = fs.readFileSync(input.filePath, 'utf-8');
        return {
          documentType,
          filename: path.basename(input.filePath),
          text,
          elements: [
            {
              type: ElementType.PARAGRAPH,
              content: text,
            },
          ],
          metadata: {},
          parseTime: 0,
        };

      default:
        throw new Error(`不支持的文件类型: ${ext}`);
    }
  }

  /**
   * 根据文件扩展名获取文档类型
   */
  private getDocumentType(ext: string): DocumentType {
    const typeMap: Record<string, DocumentType> = {
      '.pdf': DocumentType.PDF,
      '.docx': DocumentType.DOCX,
      '.doc': DocumentType.DOC,
      '.xlsx': DocumentType.XLSX,
      '.xls': DocumentType.XLS,
      '.png': DocumentType.IMAGE,
      '.jpg': DocumentType.IMAGE,
      '.jpeg': DocumentType.IMAGE,
      '.gif': DocumentType.IMAGE,
      '.bmp': DocumentType.IMAGE,
      '.txt': DocumentType.TXT,
      '.md': DocumentType.MD,
    };

    return typeMap[ext] || DocumentType.TXT;
  }
}

/**
 * 批量文档解析工具
 */
export class BatchDocumentParserTool extends EnhancedBaseTool<
  {
    filePaths: string[];
    outputFormat?: OutputFormat;
    options?: ParseOptions;
  },
  {
    results: Array<{
      filePath: string;
      success: boolean;
      result?: DocumentParseResult;
      error?: string;
    }>;
    summary: {
      totalFiles: number;
      successful: number;
      failed: number;
      totalParseTime: number;
    };
  }
> {
  readonly metadata = {
    name: 'batch_document_parser',
    description: '批量解析多个文档文件',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePaths: z.array(z.string()).describe('文件路径列表'),
      outputFormat: z
        .enum([OutputFormat.JSON, OutputFormat.MARKDOWN, OutputFormat.TEXT])
        .optional()
        .default(OutputFormat.TEXT)
        .describe('输出格式'),
      options: z
        .object({
          ocrLanguages: z.array(z.string()).optional(),
          extractImages: z.boolean().optional(),
          extractTables: z.boolean().optional(),
        })
        .optional()
        .describe('解析选项'),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          filePath: z.string(),
          success: z.boolean(),
          result: z.any().optional(),
          error: z.string().optional(),
        })
      ),
      summary: z.object({
        totalFiles: z.number(),
        successful: z.number(),
        failed: z.number(),
        totalParseTime: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      filePaths: string[];
      outputFormat?: OutputFormat;
      options?: ParseOptions;
    },
    context: ToolContext
  ): Promise<{
    results: any[];
    summary: any;
  }> {
    const parserTool = new UniversalDocumentParserTool();
    const results: any[] = [];
    let successful = 0;
    let failed = 0;
    let totalParseTime = 0;

    for (const filePath of input.filePaths) {
      try {
        const result = await parserTool.execute(
          {
            filePath,
            outputFormat: input.outputFormat,
            options: input.options,
          },
          context
        );

        results.push({
          filePath,
          success: true,
          result,
        });

        successful++;
        totalParseTime += result.parseTime;
      } catch (error) {
        failed++;
        results.push({
          filePath,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      results,
      summary: {
        totalFiles: input.filePaths.length,
        successful,
        failed,
        totalParseTime,
      },
    };
  }
}

/**
 * 文档格式转换工具
 */
export class DocumentConverterTool extends EnhancedBaseTool<
  {
    inputPath: string;
    outputPath: string;
    outputFormat: OutputFormat;
    options?: ParseOptions;
  },
  {
    success: boolean;
    inputPath: string;
    outputPath: string;
    outputFormat: OutputFormat;
    parseTime: number;
  }
> {
  readonly metadata = {
    name: 'document_converter',
    description: '将文档转换为指定格式（JSON/Markdown/Text）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      inputPath: z.string().describe('输入文件路径'),
      outputPath: z.string().describe('输出文件路径'),
      outputFormat: z
        .enum([OutputFormat.JSON, OutputFormat.MARKDOWN, OutputFormat.TEXT])
        .describe('输出格式'),
      options: z
        .object({
          ocrLanguages: z.array(z.string()).optional(),
          extractImages: z.boolean().optional(),
          extractTables: z.boolean().optional(),
        })
        .optional()
        .describe('解析选项'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      inputPath: z.string(),
      outputPath: z.string(),
      outputFormat: z.nativeEnum(OutputFormat),
      parseTime: z.number(),
    }),
    permissions: ['fs:read', 'fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      inputPath: string;
      outputPath: string;
      outputFormat: OutputFormat;
      options?: ParseOptions;
    },
    context: ToolContext
  ): Promise<{
    success: boolean;
    inputPath: string;
    outputPath: string;
    outputFormat: OutputFormat;
    parseTime: number;
  }> {
    const parserTool = new UniversalDocumentParserTool();
    const result = await parserTool.execute(
      {
        filePath: input.inputPath,
        outputFormat: input.outputFormat,
        options: input.options,
      },
      context
    );

    // 根据输出格式生成内容
    let content: string;

    switch (input.outputFormat) {
      case OutputFormat.JSON:
        content = JSON.stringify(result, null, 2);
        break;

      case OutputFormat.MARKDOWN:
        // 简单的Markdown生成（实际应用中应该更复杂）
        content = `# ${result.filename}\n\n${result.text}`;
        break;

      case OutputFormat.TEXT:
        content = result.text;
        break;

      default:
        throw new Error(`不支持的输出格式: ${input.outputFormat}`);
    }

    // 写入文件
    fs.writeFileSync(input.outputPath, content, 'utf-8');

    return {
      success: true,
      inputPath: input.inputPath,
      outputPath: input.outputPath,
      outputFormat: input.outputFormat,
      parseTime: result.parseTime,
    };
  }
}
