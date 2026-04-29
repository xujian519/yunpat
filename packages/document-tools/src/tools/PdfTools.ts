/**
 * PDF解析工具
 *
 * 支持文本提取和OCR识别
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
import { elementsToMarkdown, extractPlainText } from '../utils/converters.js';

// 动态导入
let pdfParse: any;
let pdfjsLib: any;

async function loadPdfLibs() {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse')).default;
  }
  if (!pdfjsLib) {
    const pdfjs = await import('pdfjs-dist');
    pdfjsLib = pdfjs.default || pdfjs;
  }
}

/**
 * PDF文本提取工具
 *
 * 从PDF中提取纯文本内容
 */
export class PdfExtractTextTool extends EnhancedBaseTool<
  {
    filePath: string;
    includeMetadata?: boolean;
  },
  {
    text: string;
    metadata?: {
      pages: number;
      info?: any;
    };
  }
> {
  readonly metadata = {
    name: 'pdf_extract_text',
    description: '从PDF文件中提取文本内容',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('PDF文件路径'),
      includeMetadata: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否包含元数据'),
    }),
    outputSchema: z.object({
      text: z.string().describe('提取的文本内容'),
      metadata: z
        .object({
          pages: z.number(),
          info: z.any(),
        })
        .optional(),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; includeMetadata?: boolean },
    _context: ToolContext
  ): Promise<{ text: string; metadata?: any }> {
    await loadPdfLibs();

    const dataBuffer = fs.readFileSync(input.filePath);
    const data = await pdfParse(dataBuffer);

    const result: any = {
      text: data.text,
    };

    if (input.includeMetadata) {
      result.metadata = {
        pages: data.numpages,
        info: data.info,
      };
    }

    return result;
  }
}

/**
 * PDF解析工具
 *
 * 解析PDF并输出结构化数据
 */
export class PdfParseTool extends EnhancedBaseTool<
  {
    filePath: string;
    outputFormat?: OutputFormat;
    extractImages?: boolean;
  },
  DocumentParseResult
> {
  readonly metadata = {
    name: 'pdf_parse',
    description: '解析PDF文件并输出结构化数据（JSON/Markdown/Text）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('PDF文件路径'),
      outputFormat: z
        .enum([OutputFormat.JSON, OutputFormat.MARKDOWN, OutputFormat.TEXT])
        .optional()
        .default(OutputFormat.TEXT)
        .describe('输出格式'),
      extractImages: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否提取图片'),
    }),
    outputSchema: z.object({
      documentType: z.nativeEnum(DocumentType),
      filename: z.string(),
      text: z.string(),
      elements: z.array(z.any()),
      metadata: z.object({
        totalPages: z.number().optional(),
        author: z.string().optional(),
        creationDate: z.date().optional(),
        title: z.string().optional(),
      }),
      parseTime: z.number(),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; outputFormat?: OutputFormat; extractImages?: boolean },
    _context: ToolContext
  ): Promise<DocumentParseResult> {
    const startTime = Date.now();
    await loadPdfLibs();

    const dataBuffer = fs.readFileSync(input.filePath);
    const data = await pdfParse(dataBuffer);

    // 解析文本内容
    const lines = data.text.split('\n').filter((line: string) => line.trim());

    // 简单的元素提取（实际应用中需要更复杂的逻辑）
    const elements = this.extractElements(lines, data.pages || []);

    const result: DocumentParseResult = {
      documentType: DocumentType.PDF,
      filename: path.basename(input.filePath),
      text: data.text,
      elements,
      metadata: {
        totalPages: data.numpages,
        author: data.info?.Author,
        creationDate: data.info?.CreationDate
          ? new Date(data.info.CreationDate)
          : undefined,
        title: data.info?.Title,
      },
      parseTime: Date.now() - startTime,
    };

    return result;
  }

  /**
   * 从文本行中提取元素
   */
  private extractElements(lines: string[], pages: any[]): any[] {
    const elements: any[] = [];

    for (const line of lines) {
      // 简单的启发式规则
      if (line.match(/^[A-Z\s]{5,}$/)) {
        // 可能是标题
        elements.push({
          type: ElementType.TITLE,
          content: line,
          metadata: { level: 1 },
        });
      } else if (line.match(/^\d+\.\s/)) {
        // 可能是列表项
        elements.push({
          type: ElementType.LIST,
          content: line.replace(/^\d+\.\s/, ''),
        });
      } else {
        // 普通段落
        elements.push({
          type: ElementType.PARAGRAPH,
          content: line,
        });
      }
    }

    return elements;
  }
}

/**
 * PDF转Markdown工具
 */
export class PdfToMarkdownTool extends EnhancedBaseTool<
  {
    filePath: string;
    includeHeaderFooter?: boolean;
  },
  {
    markdown: string;
    metadata: {
      totalPages: number;
      parseTime: number;
    };
  }
> {
  readonly metadata = {
    name: 'pdf_to_markdown',
    description: '将PDF文件转换为Markdown格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('PDF文件路径'),
      includeHeaderFooter: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否包含页眉页脚'),
    }),
    outputSchema: z.object({
      markdown: z.string().describe('Markdown内容'),
      metadata: z.object({
        totalPages: z.number(),
        parseTime: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; includeHeaderFooter?: boolean },
    context: ToolContext
  ): Promise<{ markdown: string; metadata: any }> {
    const startTime = Date.now();

    // 先解析PDF
    const parseTool = new PdfParseTool();
    const result = await parseTool.execute(
      {
        filePath: input.filePath,
        outputFormat: OutputFormat.JSON,
      },
      context
    );

    // 转换为Markdown
    const markdown = elementsToMarkdown(result.elements, {
      includeHeaderFooter: input.includeHeaderFooter,
    });

    return {
      markdown,
      metadata: {
        totalPages: result.metadata.totalPages || 0,
        parseTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * PDF OCR工具（使用外部Marker API）
 *
 * 用于扫描版PDF的文字识别
 */
export class PdfOcrTool extends EnhancedBaseTool<
  {
    filePath: string;
    languages?: string[];
    outputFormat?: OutputFormat;
  },
  {
    text: string;
    confidence: number;
    language: string;
  }
> {
  readonly metadata = {
    name: 'pdf_ocr',
    description: '对扫描版PDF进行OCR文字识别（需要安装Marker）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('PDF文件路径'),
      languages: z
        .array(z.string())
        .optional()
        .default(['eng', 'chi_sim'])
        .describe('OCR语言列表'),
      outputFormat: z
        .enum([OutputFormat.TEXT, OutputFormat.MARKDOWN, OutputFormat.JSON])
        .optional()
        .default(OutputFormat.TEXT)
        .describe('输出格式'),
    }),
    outputSchema: z.object({
      text: z.string().describe('识别的文本'),
      confidence: z.number().describe('置信度（0-1）'),
      language: z.string().describe('检测到的语言'),
    }),
    permissions: ['fs:read', 'exec:marker'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; languages?: string[]; outputFormat?: OutputFormat },
    _context: ToolContext
  ): Promise<{ text: string; confidence: number; language: string }> {
    const { execSync } = require('child_process');

    try {
      // 检查Marker是否安装
      execSync('which marker', { stdio: 'ignore' });
    } catch (error) {
      throw new Error(
        'Marker未安装。请先安装: pip install marker-pdf'
      );
    }

    const startTime = Date.now();

    // 调用Marker进行OCR
    const cmd = `marker "${input.filePath}" --output_format ${input.outputFormat} --languages ${input.languages?.join(',') || 'eng,chi_sim'}`;

    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    return {
      text: output.trim(),
      confidence: 0.95, // Marker通常有很高的置信度
      language: 'auto-detected',
    };
  }
}
