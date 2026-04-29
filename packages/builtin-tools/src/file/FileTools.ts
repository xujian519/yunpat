import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * 文件读取工具
 */
export class FileReadTool extends EnhancedBaseTool<
  { filePath: string; encoding?: BufferEncoding },
  { content: string }
> {
  readonly metadata = {
    name: 'file_read',
    description: '读取文件内容',
    category: ToolCategory.FILE,
    isConcurrencySafe: true,
    inputSchema: z.object({
      filePath: z.string().describe('要读取的文件路径'),
      encoding: z
        .enum(['utf-8', 'utf-16le', 'latin1'] as const)
        .optional()
        .default('utf-8')
        .describe('文件编码'),
    }),
    outputSchema: z.object({
      content: z.string().describe('文件内容'),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; encoding?: BufferEncoding | 'utf-8' | 'utf-16le' | 'latin1' },
    _context: ToolContext
  ): Promise<{ content: string }> {
    const { filePath, encoding = 'utf-8' } = input;

    try {
      const content = await fs.readFile(filePath, encoding);
      return { content };
    } catch (error) {
      throw new Error(
        `Failed to read file '${filePath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 文件写入工具
 */
export class FileWriteTool extends EnhancedBaseTool<
  { filePath: string; content: string; encoding?: BufferEncoding },
  { success: boolean; bytesWritten: number }
> {
  readonly metadata = {
    name: 'file_write',
    description: '写入文件内容，如果文件存在则覆盖',
    category: ToolCategory.FILE,
    isConcurrencySafe: false,
    inputSchema: z.object({
      filePath: z.string().describe('要写入的文件路径'),
      content: z.string().describe('要写入的内容'),
      encoding: z
        .enum(['utf-8', 'utf-16le', 'latin1'] as const)
        .optional()
        .default('utf-8')
        .describe('文件编码'),
    }),
    outputSchema: z.object({
      success: z.boolean().describe('是否成功'),
      bytesWritten: z.number().describe('写入的字节数'),
    }),
    permissions: ['fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async before(
    input: { filePath: string; content: string },
    _context: ToolContext
  ): Promise<void> {
    // 确保目录存在
    const dir = path.dirname(input.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // 忽略目录已存在的错误
      if (
        !(
          error instanceof Error &&
          (error.message.includes('EEXIST') ||
            error.message.includes('already exists'))
        )
      ) {
        throw error;
      }
    }
  }

  async execute(
    input: { filePath: string; content: string; encoding?: BufferEncoding },
    _context: ToolContext
  ): Promise<{ success: boolean; bytesWritten: number }> {
    const { filePath, content, encoding = 'utf-8' } = input;

    try {
      const buffer = Buffer.from(content, encoding);
      await fs.writeFile(filePath, buffer);
      return { success: true, bytesWritten: buffer.length };
    } catch (error) {
      throw new Error(
        `Failed to write file '${filePath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 文件追加工具
 */
export class FileAppendTool extends EnhancedBaseTool<
  { filePath: string; content: string; encoding?: BufferEncoding },
  { success: boolean; bytesWritten: number }
> {
  readonly metadata = {
    name: 'file_append',
    description: '在文件末尾追加内容',
    category: ToolCategory.FILE,
    isConcurrencySafe: false,
    inputSchema: z.object({
      filePath: z.string().describe('要追加的文件路径'),
      content: z.string().describe('要追加的内容'),
      encoding: z
        .enum(['utf-8', 'utf-16le', 'latin1'] as const)
        .optional()
        .default('utf-8')
        .describe('文件编码'),
    }),
    outputSchema: z.object({
      success: z.boolean().describe('是否成功'),
      bytesWritten: z.number().describe('写入的字节数'),
    }),
    permissions: ['fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string; content: string; encoding?: BufferEncoding },
    _context: ToolContext
  ): Promise<{ success: boolean; bytesWritten: number }> {
    const { filePath, content, encoding = 'utf-8' } = input;

    try {
      const buffer = Buffer.from(content, encoding);
      await fs.appendFile(filePath, buffer);
      return { success: true, bytesWritten: buffer.length };
    } catch (error) {
      throw new Error(
        `Failed to append file '${filePath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 文件删除工具
 */
export class FileDeleteTool extends EnhancedBaseTool<
  { filePath: string },
  { success: boolean }
> {
  readonly metadata = {
    name: 'file_delete',
    description: '删除文件',
    category: ToolCategory.FILE,
    isConcurrencySafe: false,
    inputSchema: z.object({
      filePath: z.string().describe('要删除的文件路径'),
    }),
    outputSchema: z.object({
      success: z.boolean().describe('是否成功'),
    }),
    permissions: ['fs:delete'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { filePath: string },
    _context: ToolContext
  ): Promise<{ success: boolean }> {
    const { filePath } = input;

    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      throw new Error(
        `Failed to delete file '${filePath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 目录列表工具
 */
export class DirectoryListTool extends EnhancedBaseTool<
  {
    dirPath: string;
    recursive?: boolean;
    includeHidden?: boolean;
  },
  { entries: Array<{ name: string; path: string; type: 'file' | 'directory' }> }
> {
  readonly metadata = {
    name: 'directory_list',
    description: '列出目录中的文件和子目录',
    category: ToolCategory.FILE,
    isConcurrencySafe: true,
    inputSchema: z.object({
      dirPath: z.string().describe('要列出的目录路径'),
      recursive: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否递归列出子目录'),
      includeHidden: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否包含隐藏文件（以.开头）'),
    }),
    outputSchema: z.object({
      entries: z.array(
        z.object({
          name: z.string(),
          path: z.string(),
          type: z.enum(['file', 'directory']),
        })
      ),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      dirPath: string;
      recursive?: boolean;
      includeHidden?: boolean;
    },
    _context: ToolContext
  ): Promise<{
    entries: Array<{ name: string; path: string; type: 'file' | 'directory' }>;
  }> {
    const { dirPath, recursive = false, includeHidden = false } = input;

    try {
      const entries: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
      }> = [];

      const walkDir = async (currentPath: string) => {
        const items = await fs.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          // 跳过隐藏文件
          if (!includeHidden && item.name.startsWith('.')) {
            continue;
          }

          const fullPath = path.join(currentPath, item.name);
          const type = item.isDirectory() ? 'directory' : 'file';

          entries.push({
            name: item.name,
            path: fullPath,
            type,
          });

          // 递归处理子目录
          if (recursive && item.isDirectory()) {
            await walkDir(fullPath);
          }
        }
      };

      await walkDir(dirPath);
      return { entries };
    } catch (error) {
      throw new Error(
        `Failed to list directory '${dirPath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
