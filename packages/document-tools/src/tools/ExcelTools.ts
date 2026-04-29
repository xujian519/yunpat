/**
 * Excel文档解析工具
 *
 * 支持XLSX/XLS文件的读取和转换
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';
import {
  DocumentParseResult,
  DocumentType,
  ElementType,
  OutputFormat,
} from '../types/document.js';

/**
 * Excel工作表数据
 */
interface WorksheetData {
  name: string;
  data: any[][];
  rowCount: number;
  columnCount: number;
}

/**
 * Excel读取工具
 */
export class ExcelReadTool extends EnhancedBaseTool<
  {
    filePath: string;
    sheetName?: string;
    sheetIndex?: number;
    headerRow?: number;
  },
  {
    sheets: WorksheetData[];
    activeSheet: string;
    metadata: {
      filename: string;
      sheetCount: number;
    };
  }
> {
  readonly metadata = {
    name: 'excel_read',
    description: '读取Excel文件内容',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('Excel文件路径'),
      sheetName: z.string().optional().describe('指定工作表名称'),
      sheetIndex: z.number().optional().describe('指定工作表索引（从0开始）'),
      headerRow: z.number().optional().default(0).describe('标题行索引'),
    }),
    outputSchema: z.object({
      sheets: z.array(
        z.object({
          name: z.string(),
          data: z.array(z.array(z.any())),
          rowCount: z.number(),
          columnCount: z.number(),
        })
      ),
      activeSheet: z.string(),
      metadata: z.object({
        filename: z.string(),
        sheetCount: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; sheetName?: string; sheetIndex?: number; headerRow?: number },
    _context: ToolContext
  ): Promise<{
    sheets: WorksheetData[];
    activeSheet: string;
    metadata: any;
  }> {
    const workbook = XLSX.readFile(input.filePath);

    const sheets: WorksheetData[] = [];

    // 确定要读取哪些工作表
    let sheetNamesToRead: string[] = [];

    if (input.sheetName) {
      sheetNamesToRead = [input.sheetName];
    } else if (input.sheetIndex !== undefined) {
      sheetNamesToRead = [workbook.SheetNames[input.sheetIndex]];
    } else {
      sheetNamesToRead = workbook.SheetNames;
    }

    // 读取每个工作表
    for (const sheetName of sheetNamesToRead) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as any[][];

      sheets.push({
        name: sheetName,
        data,
        rowCount: data.length,
        columnCount: data.length > 0 ? data[0].length : 0,
      });
    }

    return {
      sheets,
      activeSheet: workbook.SheetNames[0] || '',
      metadata: {
        filename: path.basename(input.filePath),
        sheetCount: workbook.SheetNames.length,
      },
    };
  }
}

/**
 * Excel转JSON工具
 */
export class ExcelToJsonTool extends EnhancedBaseTool<
  {
    filePath: string;
    sheetName?: string;
    headerRow?: number;
    pretty?: boolean;
  },
  {
    json: string;
    sheets: Record<string, any[]>;
    metadata: {
      filename: string;
      sheetCount: number;
    };
  }
> {
  readonly metadata = {
    name: 'excel_to_json',
    description: '将Excel文件转换为JSON格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('Excel文件路径'),
      sheetName: z.string().optional().describe('指定工作表名称'),
      headerRow: z.number().optional().default(0).describe('标题行索引'),
      pretty: z.boolean().optional().default(true).describe('是否格式化JSON输出'),
    }),
    outputSchema: z.object({
      json: z.string().describe('JSON字符串'),
      sheets: z.record(z.array(z.any())).describe('各工作表的JSON数据'),
      metadata: z.object({
        filename: z.string(),
        sheetCount: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; sheetName?: string; headerRow?: number; pretty?: boolean },
    _context: ToolContext
  ): Promise<{ json: string; sheets: Record<string, any[]>; metadata: any }> {
    const workbook = XLSX.readFile(input.filePath);

    const sheets: Record<string, any[]> = {};

    // 确定要读取哪些工作表
    const sheetNamesToRead = input.sheetName
      ? [input.sheetName]
      : workbook.SheetNames;

    // 读取每个工作表
    for (const sheetName of sheetNamesToRead) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: input.headerRow || 0,
      });

      sheets[sheetName] = jsonData;
    }

    return {
      json: JSON.stringify(sheets, null, input.pretty ? 2 : 0),
      sheets,
      metadata: {
        filename: path.basename(input.filePath),
        sheetCount: workbook.SheetNames.length,
      },
    };
  }
}

/**
 * Excel转Markdown工具
 */
export class ExcelToMarkdownTool extends EnhancedBaseTool<
  {
    filePath: string;
    sheetName?: string;
    tableFormat?: 'github' | 'pipe';
  },
  {
    markdown: string;
    metadata: {
      filename: string;
      sheetCount: number;
    };
  }
> {
  readonly metadata = {
    name: 'excel_to_markdown',
    description: '将Excel文件转换为Markdown表格格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('Excel文件路径'),
      sheetName: z.string().optional().describe('指定工作表名称'),
      tableFormat: z
        .enum(['github', 'pipe'])
        .optional()
        .default('github')
        .describe('表格格式'),
    }),
    outputSchema: z.object({
      markdown: z.string().describe('Markdown内容'),
      metadata: z.object({
        filename: z.string(),
        sheetCount: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; sheetName?: string; tableFormat?: string },
    _context: ToolContext
  ): Promise<{ markdown: string; metadata: any }> {
    const readTool = new ExcelReadTool();
    const { sheets } = await readTool.execute(
      {
        filePath: input.filePath,
        sheetName: input.sheetName,
      },
      _context
    );

    const markdownParts: string[] = [];

    for (const sheet of sheets) {
      markdownParts.push(`## ${sheet.name}\n`);

      if (sheet.data.length === 0) {
        markdownParts.push('*空工作表*\n');
        continue;
      }

      // 转换为Markdown表格
      const table = this.convertToMarkdownTable(sheet.data, input.tableFormat as any);
      markdownParts.push(table);
    }

    return {
      markdown: markdownParts.join('\n'),
      metadata: {
        filename: path.basename(input.filePath),
        sheetCount: sheets.length,
      },
    };
  }

  /**
   * 将数据转换为Markdown表格
   */
  private convertToMarkdownTable(data: any[][], format: 'github' | 'pipe'): string {
    if (data.length === 0) return '';

    const lines: string[] = [];

    // 表头
    const header = data[0].map((cell) => String(cell ?? ''));
    lines.push(`| ${header.join(' | ')} |`);

    // 分隔行
    const separator = header.map(() => '---');
    lines.push(`| ${separator.join(' | ')} |`);

    // 数据行
    for (let i = 1; i < data.length; i++) {
      const row = data[i].map((cell) => String(cell ?? ''));
      lines.push(`| ${row.join(' | ')} |`);
    }

    return lines.join('\n') + '\n';
  }
}

/**
 * Excel解析工具（完整版）
 */
export class ExcelParseTool extends EnhancedBaseTool<
  {
    filePath: string;
    outputFormat?: OutputFormat;
  },
  DocumentParseResult
> {
  readonly metadata = {
    name: 'excel_parse',
    description: '解析Excel文件并输出结构化数据',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('Excel文件路径'),
      outputFormat: z
        .enum([OutputFormat.JSON, OutputFormat.MARKDOWN, OutputFormat.TEXT])
        .optional()
        .default(OutputFormat.JSON)
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
  };

  async execute(
    input: { filePath: string; outputFormat?: OutputFormat },
    context: ToolContext
  ): Promise<DocumentParseResult> {
    const startTime = Date.now();

    const readTool = new ExcelReadTool();
    const { sheets } = await readTool.execute({ filePath: input.filePath }, context);

    // 将所有工作表数据合并为文本
    const textParts: string[] = [];
    const elements: any[] = [];

    for (const sheet of sheets) {
      textParts.push(`## ${sheet.name}`);

      // 转换为表格元素
      elements.push({
        type: ElementType.TITLE,
        content: sheet.name,
        metadata: { level: 2 },
      });

      elements.push({
        type: ElementType.TABLE,
        content: JSON.stringify(sheet.data),
        metadata: {
          rows: sheet.rowCount,
          columns: sheet.columnCount,
        },
      });

      // 文本表示
      for (const row of sheet.data) {
        textParts.push(row.join('\t'));
      }
      textParts.push('');
    }

    const stats = fs.statSync(input.filePath);

    return {
      documentType: path.extname(input.filePath).toLowerCase() === '.xlsx'
        ? DocumentType.XLSX
        : DocumentType.XLS,
      filename: path.basename(input.filePath),
      text: textParts.join('\n'),
      elements,
      metadata: {
        size: stats.size,
        sheetCount: sheets.length,
      },
      parseTime: Date.now() - startTime,
    };
  }
}
