import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * Grep 搜索工具
 *
 * 在文件中搜索匹配的文本
 */
export class GrepTool extends EnhancedBaseTool<
  {
    pattern: string;
    filePath?: string;
    directory?: string;
    filePattern?: string;
    caseInsensitive?: boolean;
    regex?: boolean;
    maxResults?: number;
  },
  {
    matches: Array<{
      file: string;
      lineNumber: number;
      line: string;
      match: string;
    }>;
  }
> {
  readonly metadata = {
    name: 'grep',
    description: '在文件中搜索匹配的文本模式',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: true,
    inputSchema: z.object({
      pattern: z.string().describe('搜索模式（文本或正则表达式）'),
      filePath: z.string().optional().describe('要搜索的文件路径'),
      directory: z.string().optional().describe('要搜索的目录路径'),
      filePattern: z.string().optional().describe('文件匹配模式（如 *.ts）'),
      caseInsensitive: z
        .boolean()
        .optional()
        .default(true)
        .describe('是否忽略大小写'),
      regex: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否使用正则表达式'),
      maxResults: z
        .number()
        .optional()
        .default(100)
        .describe('最大结果数'),
    }),
    outputSchema: z.object({
      matches: z.array(
        z.object({
          file: z.string(),
          lineNumber: z.number(),
          line: z.string(),
          match: z.string(),
        })
      ),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      pattern: string;
      filePath?: string;
      directory?: string;
      filePattern?: string;
      caseInsensitive?: boolean;
      regex?: boolean;
      maxResults?: number;
    },
    _context: ToolContext
  ): Promise<{
    matches: Array<{
      file: string;
      lineNumber: number;
      line: string;
      match: string;
    }>;
  }> {
    const {
      pattern,
      filePath,
      directory,
      filePattern,
      caseInsensitive = true,
      regex = false,
      maxResults = 100,
    } = input;

    // 构建正则表达式
    let regexPattern: RegExp;
    try {
      const flags = caseInsensitive ? 'gi' : 'g';
      regexPattern = regex
        ? new RegExp(pattern, flags)
        : new RegExp(
            pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // 转义特殊字符
            flags
          );
    } catch (error) {
      throw new Error(
        `Invalid search pattern: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // 确定要搜索的文件列表
    let files: string[] = [];

    if (filePath) {
      files.push(filePath);
    } else if (directory) {
      const searchPattern = filePattern
        ? path.join(directory, '**', filePattern)
        : path.join(directory, '**', '*');

      files = await glob(searchPattern, {
        nodir: true,
        absolute: true,
      });
    } else {
      throw new Error('Either filePath or directory must be specified');
    }

    // 搜索文件
    const matches: Array<{
      file: string;
      lineNumber: number;
      line: string;
      match: string;
    }> = [];

    for (const file of files) {
      if (matches.length >= maxResults) {
        break;
      }

      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) {
            break;
          }

          const line = lines[i];
          regexPattern.lastIndex = 0; // 重置正则表达式
          const match = regexPattern.exec(line);

          if (match) {
            matches.push({
              file,
              lineNumber: i + 1,
              line: line.trim(),
              match: match[0],
            });
          }
        }
      } catch (error) {
        // 跳过无法读取的文件
        continue;
      }
    }

    return { matches };
  }
}

/**
 * Glob 文件查找工具
 *
 * 使用 glob 模式查找文件
 */
export class GlobTool extends EnhancedBaseTool<
  {
    pattern: string;
    cwd?: string;
    includeHidden?: boolean;
  },
  { files: string[] }
> {
  readonly metadata = {
    name: 'glob',
    description: '使用 glob 模式查找文件',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: true,
    inputSchema: z.object({
      pattern: z.string().describe('glob 模式（如 **/*.ts）'),
      cwd: z.string().optional().describe('当前工作目录'),
      includeHidden: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否包含隐藏文件'),
    }),
    outputSchema: z.object({
      files: z.array(z.string()).describe('匹配的文件路径列表'),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { pattern: string; cwd?: string; includeHidden?: boolean },
    _context: ToolContext
  ): Promise<{ files: string[] }> {
    const { pattern, cwd, includeHidden = false } = input;

    try {
      const files = await glob(pattern, {
        cwd,
        nodir: true,
        absolute: true,
        dot: includeHidden,
      });

      return { files };
    } catch (error) {
      throw new Error(
        `Glob search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
