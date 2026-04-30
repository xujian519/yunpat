/**
 * OCR图片识别工具
 *
 * 支持从图片中提取文字（使用Tesseract.js）
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';
import { DocumentType, ElementType } from '../types/document.js';

// 动态导入
let Tesseract: any;

async function loadTesseract() {
  if (!Tesseract) {
    const module = await import('tesseract.js');
    Tesseract = module.default || module;
  }
}

/**
 * OCR图片识别工具
 */
export class ImageOcrTool extends EnhancedBaseTool<
  {
    imagePath: string;
    languages?: string[];
    outputFormat?: 'text' | 'json';
  },
  {
    text: string;
    confidence: number;
    words?: Array<{
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>;
    language: string;
    metadata: {
      filename: string;
      size: number;
      dimensions?: { width: number; height: number };
    };
  }
> {
  readonly metadata = {
    name: 'image_ocr',
    description: '从图片中识别文字（支持PNG、JPG、BMP等格式）',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      imagePath: z.string().describe('图片文件路径'),
      languages: z.array(z.string()).optional().default(['eng', 'chi_sim']).describe('OCR语言列表'),
      outputFormat: z.enum(['text', 'json']).optional().default('text').describe('输出格式'),
    }),
    outputSchema: z.object({
      text: z.string().describe('识别的文本'),
      confidence: z.number().describe('整体置信度'),
      words: z
        .array(
          z.object({
            text: z.string(),
            confidence: z.number(),
            bbox: z.object({
              x0: z.number(),
              y0: z.number(),
              x1: z.number(),
              y1: z.number(),
            }),
          })
        )
        .optional(),
      language: z.string(),
      metadata: z.object({
        filename: z.string(),
        size: z.number(),
        dimensions: z
          .object({
            width: z.number(),
            height: z.number(),
          })
          .optional(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      imagePath: string;
      languages?: string[];
      outputFormat?: 'text' | 'json';
    },
    _context: ToolContext
  ): Promise<{
    text: string;
    confidence: number;
    words?: any[];
    language: string;
    metadata: any;
  }> {
    await loadTesseract();

    // 检查文件是否存在
    if (!fs.existsSync(input.imagePath)) {
      throw new Error(`图片文件不存在: ${input.imagePath}`);
    }

    const stats = fs.statSync(input.imagePath);
    const filename = path.basename(input.imagePath);

    // 执行OCR
    const result = await Tesseract.recognize(
      input.imagePath,
      input.languages?.join('+') || 'eng+chi_sim',
      {
        logger: (m: any) => {
          // 可以在这里记录进度
          if (m.status === 'recognizing text') {
            // console.log(`进度: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    // 提取文字和置信度
    const { data } = result;
    const text = data.text;
    const confidence = data.confidence;

    // 构建返回结果
    const response: any = {
      text,
      confidence,
      language: input.languages?.join('+') || 'eng+chi_sim',
      metadata: {
        filename,
        size: stats.size,
      },
    };

    // 如果需要JSON格式，包含单词级别的详细信息
    if (input.outputFormat === 'json' && data.words) {
      response.words = data.words.map((word: any) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1,
        },
      }));
    }

    return response;
  }
}

/**
 * 批量OCR工具
 */
export class BatchImageOcrTool extends EnhancedBaseTool<
  {
    imagePaths: string[];
    languages?: string[];
    outputFormat?: 'text' | 'json';
  },
  {
    results: Array<{
      imagePath: string;
      text: string;
      confidence: number;
    }>;
    summary: {
      totalImages: number;
      successful: number;
      failed: number;
      averageConfidence: number;
    };
  }
> {
  readonly metadata = {
    name: 'batch_image_ocr',
    description: '批量识别多张图片中的文字',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      imagePaths: z.array(z.string()).describe('图片文件路径列表'),
      languages: z.array(z.string()).optional().default(['eng', 'chi_sim']).describe('OCR语言列表'),
      outputFormat: z.enum(['text', 'json']).optional().default('text').describe('输出格式'),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          imagePath: z.string(),
          text: z.string(),
          confidence: z.number(),
        })
      ),
      summary: z.object({
        totalImages: z.number(),
        successful: z.number(),
        failed: z.number(),
        averageConfidence: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      imagePaths: string[];
      languages?: string[];
      outputFormat?: 'text' | 'json';
    },
    context: ToolContext
  ): Promise<{
    results: any[];
    summary: any;
  }> {
    const ocrTool = new ImageOcrTool();
    const results: any[] = [];
    let successful = 0;
    let failed = 0;
    let totalConfidence = 0;

    for (const imagePath of input.imagePaths) {
      try {
        const result = await ocrTool.execute(
          {
            imagePath,
            languages: input.languages,
            outputFormat: input.outputFormat,
          },
          context
        );

        results.push({
          imagePath,
          text: result.text,
          confidence: result.confidence,
        });

        successful++;
        totalConfidence += result.confidence;
      } catch (error) {
        failed++;
        results.push({
          imagePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      results,
      summary: {
        totalImages: input.imagePaths.length,
        successful,
        failed,
        averageConfidence: successful > 0 ? totalConfidence / successful : 0,
      },
    };
  }
}

/**
 * 图片转Markdown工具
 */
export class ImageToMarkdownTool extends EnhancedBaseTool<
  {
    imagePath: string;
    languages?: string[];
    includeAlt?: boolean;
  },
  {
    markdown: string;
    metadata: {
      filename: string;
      confidence: number;
    };
  }
> {
  readonly metadata = {
    name: 'image_to_markdown',
    description: '将图片中的文字转换为Markdown格式',
    category: ToolCategory.DOCUMENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      imagePath: z.string().describe('图片文件路径'),
      languages: z.array(z.string()).optional().default(['eng', 'chi_sim']).describe('OCR语言列表'),
      includeAlt: z.boolean().optional().default(true).describe('是否包含图片alt描述'),
    }),
    outputSchema: z.object({
      markdown: z.string().describe('Markdown内容'),
      metadata: z.object({
        filename: z.string(),
        confidence: z.number(),
      }),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { imagePath: string; languages?: string[]; includeAlt?: boolean },
    context: ToolContext
  ): Promise<{ markdown: string; metadata: any }> {
    const ocrTool = new ImageOcrTool();
    const result = await ocrTool.execute(
      {
        imagePath: input.imagePath,
        languages: input.languages,
        outputFormat: 'text',
      },
      context
    );

    const filename = path.basename(input.imagePath);

    let markdown = '';

    if (input.includeAlt) {
      markdown += `![${filename}](${input.imagePath})\n\n`;
    }

    markdown += result.text;

    return {
      markdown,
      metadata: {
        filename,
        confidence: result.confidence,
      },
    };
  }
}
