import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'
import { glob } from 'glob'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

/**
 * 学术论文搜索工具
 *
 * 使用Semantic Scholar API搜索学术论文
 */
export class AcademicSearchTool extends EnhancedBaseTool<
  {
    query: string
    limit?: number
    fields?: string[]
    year?: string
  },
  {
    success: boolean
    query: string
    results: Array<{
      index: number
      title: string
      authors: string
      year: string
      venue: string
      citations: number
      url: string
      abstract: string
      paperId: string
    }>
    totalResults: number
    source: string
    timestamp: string
  }
> {
  readonly metadata = {
    name: 'academic_search',
    description: '使用Semantic Scholar API搜索学术论文',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('搜索查询关键词'),
      limit: z.number().optional().default(10).describe('返回结果数量，默认10'),
      fields: z
        .array(z.string())
        .optional()
        .default(['title', 'authors', 'year', 'venue', 'url', 'abstract', 'citationCount'])
        .describe('返回字段'),
      year: z.string().optional().describe('限定年份，如2023'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      query: z.string(),
      results: z.array(
        z.object({
          index: z.number(),
          title: z.string(),
          authors: z.string(),
          year: z.string(),
          venue: z.string(),
          citations: z.number(),
          url: z.string(),
          abstract: z.string(),
          paperId: z.string(),
        })
      ),
      totalResults: z.number(),
      source: z.string(),
      timestamp: z.string(),
    }),
    permissions: ['network:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      query: string
      limit?: number
      fields?: string[]
      year?: string
    },
    _context: ToolContext
  ): Promise<{
    success: boolean
    query: string
    results: Array<{
      index: number
      title: string
      authors: string
      year: string
      venue: string
      citations: number
      url: string
      abstract: string
      paperId: string
    }>
    totalResults: number
    source: string
    timestamp: string
  }> {
    const {
      query,
      limit = 10,
      fields = ['title', 'authors', 'year', 'venue', 'url', 'abstract', 'citationCount'],
      year,
    } = input

    try {
      // 构建Semantic Scholar API请求
      const apiUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
      apiUrl.searchParams.append('query', query)
      apiUrl.searchParams.append('limit', limit.toString())
      apiUrl.searchParams.append('fields', fields.join(','))

      // 添加年份过滤（如果提供）
      if (year) {
        apiUrl.searchParams.append('year', year)
      }

      // 发送HTTP请求（带重试机制）
      const response = await this.fetchWithRetry(
        apiUrl.toString(),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'YunPat/1.0.0 (https://github.com/yunpat/yunpat)',
          },
          signal: AbortSignal.timeout(30000), // 30秒超时
        },
        3 // 最大重试3次
      )

      if (!response.ok) {
        throw new Error(`Semantic Scholar API请求失败: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as {
        data?: Array<{
          title?: string
          authors?: Array<{ name: string }>
          year?: number
          venue?: string
          citationCount?: number
          url?: string
          abstract?: string
          paperId?: string
        }>
        total?: number
      }

      // 解析结果
      const results = (data.data || []).map((paper, index: number) => ({
        index: index + 1,
        title: paper.title || '',
        authors: paper.authors ? paper.authors.map((a) => a.name).join(', ') : '',
        year: paper.year?.toString() || '',
        venue: paper.venue || '',
        citations: paper.citationCount || 0,
        url: paper.url || '',
        abstract: paper.abstract || '',
        paperId: paper.paperId || '',
      }))

      return {
        success: true,
        query,
        results,
        totalResults: data.total || results.length,
        source: 'Semantic Scholar',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`学术论文搜索失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 带重试机制的fetch请求
   * 使用指数退避策略，只对网络错误进行重试
   * HTTP错误（4xx, 5xx）不重试，直接返回response
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        // 返回响应（无论成功与否）
        return response
      } catch (error) {
        // 保存网络错误
        lastError = error instanceof Error ? error : new Error(String(error))

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries - 1) {
          throw lastError
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error('Max retries exceeded')
  }
}

/**
 * Grep 搜索工具
 *
 * 在文件中搜索匹配的文本
 */
export class GrepTool extends EnhancedBaseTool<
  {
    pattern: string
    filePath?: string
    directory?: string
    filePattern?: string
    caseInsensitive?: boolean
    regex?: boolean
    maxResults?: number
  },
  {
    matches: Array<{
      file: string
      lineNumber: number
      line: string
      match: string
    }>
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
      caseInsensitive: z.boolean().optional().default(true).describe('是否忽略大小写'),
      regex: z.boolean().optional().default(false).describe('是否使用正则表达式'),
      maxResults: z.number().optional().default(100).describe('最大结果数'),
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
  }

  async execute(
    input: {
      pattern: string
      filePath?: string
      directory?: string
      filePattern?: string
      caseInsensitive?: boolean
      regex?: boolean
      maxResults?: number
    },
    _context: ToolContext
  ): Promise<{
    matches: Array<{
      file: string
      lineNumber: number
      line: string
      match: string
    }>
  }> {
    const {
      pattern,
      filePath,
      directory,
      filePattern,
      caseInsensitive = true,
      regex = false,
      maxResults = 100,
    } = input

    // 构建正则表达式
    let regexPattern: RegExp
    try {
      const flags = caseInsensitive ? 'gi' : 'g'
      regexPattern = regex
        ? new RegExp(pattern, flags)
        : new RegExp(
            pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // 转义特殊字符
            flags
          )
    } catch (error) {
      throw new Error(
        `Invalid search pattern: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // 确定要搜索的文件列表
    let files: string[] = []

    if (filePath) {
      files.push(filePath)
    } else if (directory) {
      const searchPattern = filePattern
        ? path.join(directory, '**', filePattern)
        : path.join(directory, '**', '*')

      files = await glob(searchPattern, {
        nodir: true,
        absolute: true,
      })
    } else {
      throw new Error('Either filePath or directory must be specified')
    }

    // 搜索文件
    const matches: Array<{
      file: string
      lineNumber: number
      line: string
      match: string
    }> = []

    for (const file of files) {
      if (matches.length >= maxResults) {
        break
      }

      try {
        const content = await fs.readFile(file, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) {
            break
          }

          const line = lines[i]
          regexPattern.lastIndex = 0 // 重置正则表达式
          const match = regexPattern.exec(line)

          if (match) {
            matches.push({
              file,
              lineNumber: i + 1,
              line: line.trim(),
              match: match[0],
            })
          }
        }
      } catch (error) {
        // 跳过无法读取的文件
        continue
      }
    }

    return { matches }
  }
}

/**
 * Glob 文件查找工具
 *
 * 使用 glob 模式查找文件
 */
export class GlobTool extends EnhancedBaseTool<
  {
    pattern: string
    cwd?: string
    includeHidden?: boolean
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
      includeHidden: z.boolean().optional().default(false).describe('是否包含隐藏文件'),
    }),
    outputSchema: z.object({
      files: z.array(z.string()).describe('匹配的文件路径列表'),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: { pattern: string; cwd?: string; includeHidden?: boolean },
    _context: ToolContext
  ): Promise<{ files: string[] }> {
    const { pattern, cwd, includeHidden = false } = input

    try {
      const files = await glob(pattern, {
        cwd,
        nodir: true,
        absolute: true,
        dot: includeHidden,
      })

      return { files }
    } catch (error) {
      throw new Error(
        `Glob search failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
