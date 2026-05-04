import { z } from 'zod'
import { promises as fs } from 'fs'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

/**
 * 专利下载工具
 *
 * 通过HTTP API调用专利下载服务（基于GooglePatentsPdfDownloader）
 */
export class PatentDownloadTool extends EnhancedBaseTool<
  {
    patent: string
    outputPath?: string
    waitingTime?: number
  },
  {
    success: boolean
    message: string
    patent: string
    outputPath?: string
  }
> {
  private readonly serviceUrl: string

  constructor(serviceUrl: string = 'http://127.0.0.1:8765') {
    super()
    this.serviceUrl = serviceUrl
  }

  readonly metadata = {
    name: 'patent_download',
    description: '从Google Patents下载专利PDF文档',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: false, // 下载服务可能不支持并发
    inputSchema: z.object({
      patent: z.string().describe('专利号（如US4405829A1）'),
      outputPath: z.string().optional().default('./downloads').describe('输出路径'),
      waitingTime: z.number().optional().default(6).describe('等待时间（秒），默认6'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      patent: z.string(),
      outputPath: z.string().optional(),
    }),
    permissions: ['network:read', 'fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      patent: string
      outputPath?: string
      waitingTime?: number
    },
    _context: ToolContext
  ): Promise<{
    success: boolean
    message: string
    patent: string
    outputPath?: string
  }> {
    const { patent, outputPath = './downloads', waitingTime = 6 } = input

    try {
      // 确保输出目录存在
      const absoluteOutputPath = `${process.cwd()}/${outputPath}`
      try {
        await fs.mkdir(absoluteOutputPath, { recursive: true })
      } catch (error) {
        // 目录可能已存在，忽略错误
      }

      // 调用专利下载服务（带重试机制）
      const response = await this.fetchWithRetry(
        `${this.serviceUrl}/download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patent,
            output_path: absoluteOutputPath,
            waiting_time: waitingTime,
          }),
          signal: AbortSignal.timeout(120000), // 2分钟超时（下载可能较慢）
        },
        3 // 最大重试3次
      )

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ detail: response.statusText }))) as {
          detail?: string
        }
        throw new Error(`专利下载服务返回错误: ${errorData.detail || response.statusText}`)
      }

      const data = (await response.json()) as {
        success: boolean
        message: string
        patent: string
        output_path?: string
      }

      return {
        success: data.success,
        message: data.message,
        patent: data.patent,
        outputPath: data.output_path,
      }
    } catch (error) {
      // 检查是否是连接错误（服务未启动）
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        throw new Error(
          '无法连接到专利下载服务。请确保服务已启动：\n' +
            '  cd services/patent-download-service && python main.py'
        )
      }

      throw new Error(`专利下载失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 带重试机制的fetch请求
   * 使用指数退避策略，对服务器错误（5xx）进行重试
   * 客户端错误（4xx）不重试
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)

        // 如果请求成功，返回响应
        if (response.ok) {
          return response
        }

        // 如果是客户端错误（4xx），不重试
        if (response.status >= 400 && response.status < 500) {
          return response
        }

        // 如果是最后一次尝试，返回响应
        if (attempt === maxRetries - 1) {
          return response
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // 最多等待10秒
        await new Promise((resolve) => setTimeout(resolve, delay))
      } catch (error) {
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries - 1) {
          throw error
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
 * 批量专利下载工具
 *
 * 通过HTTP API批量下载专利PDF
 */
export class BatchPatentDownloadTool extends EnhancedBaseTool<
  {
    patents: string[]
    outputPath?: string
    waitingTime?: number
  },
  {
    success: boolean
    message: string
    total: number
    downloaded: number
    failed: number
    outputPath: string
  }
> {
  private readonly serviceUrl: string

  constructor(serviceUrl: string = 'http://127.0.0.1:8765') {
    super()
    this.serviceUrl = serviceUrl
  }

  readonly metadata = {
    name: 'batch_patent_download',
    description: '批量下载专利PDF文档',
    category: ToolCategory.SEARCH,
    isConcurrencySafe: false,
    inputSchema: z.object({
      patents: z.array(z.string()).describe('专利号列表'),
      outputPath: z.string().optional().default('./downloads').describe('输出路径'),
      waitingTime: z.number().optional().default(6).describe('等待时间（秒），默认6'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      total: z.number(),
      downloaded: z.number(),
      failed: z.number(),
      outputPath: z.string(),
    }),
    permissions: ['network:read', 'fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  async execute(
    input: {
      patents: string[]
      outputPath?: string
      waitingTime?: number
    },
    _context: ToolContext
  ): Promise<{
    success: boolean
    message: string
    total: number
    downloaded: number
    failed: number
    outputPath: string
  }> {
    const { patents, outputPath = './downloads', waitingTime = 6 } = input

    if (patents.length === 0) {
      throw new Error('专利号列表不能为空')
    }

    try {
      // 确保输出目录存在
      const absoluteOutputPath = `${process.cwd()}/${outputPath}`
      try {
        await fs.mkdir(absoluteOutputPath, { recursive: true })
      } catch (error) {
        // 目录可能已存在，忽略错误
      }

      // 调用专利下载服务（带重试机制）
      const response = await this.fetchWithRetry(
        `${this.serviceUrl}/download/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patents,
            output_path: absoluteOutputPath,
            waiting_time: waitingTime,
          }),
          signal: AbortSignal.timeout(600000), // 10分钟超时（批量下载可能很慢）
        },
        3 // 最大重试3次
      )

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ detail: response.statusText }))) as {
          detail?: string
        }
        throw new Error(`批量下载服务返回错误: ${errorData.detail || response.statusText}`)
      }

      const data = (await response.json()) as {
        success: boolean
        message: string
        total: number
        downloaded: number
        failed: number
        output_path: string
      }

      return {
        success: data.success,
        message: data.message,
        total: data.total,
        downloaded: data.downloaded,
        failed: data.failed,
        outputPath: data.output_path,
      }
    } catch (error) {
      // 检查是否是连接错误（服务未启动）
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        throw new Error(
          '无法连接到专利下载服务。请确保服务已启动：\n' +
            '  cd services/patent-download-service && python main.py'
        )
      }

      throw new Error(`批量专利下载失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 带重试机制的fetch请求
   * 使用指数退避策略，对服务器错误（5xx）进行重试
   * 客户端错误（4xx）不重试
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)

        // 如果请求成功，返回响应
        if (response.ok) {
          return response
        }

        // 如果是客户端错误（4xx），不重试
        if (response.status >= 400 && response.status < 500) {
          return response
        }

        // 如果是最后一次尝试，返回响应
        if (attempt === maxRetries - 1) {
          return response
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // 最多等待10秒
        await new Promise((resolve) => setTimeout(resolve, delay))
      } catch (error) {
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries - 1) {
          throw error
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error('Max retries exceeded')
  }
}
