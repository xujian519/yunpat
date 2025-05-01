/**
 * Google Patents 数据源
 * Google Patents Data Source - 在线API
 */

import fetch from 'node-fetch'
import type { PatentDataSource, PatentRecord, PatentQuery, GooglePatentsConfig } from '../types.js'

/**
 * Google Patents API 响应
 */
interface GooglePatentsResponse {
  results?: Array<{
    patent: string
    id: string
    title: string
    assignee?: string
    inventors?: Array<{
      name: string
    }>
    publicationDate?: string
    filingDate?: string
    priorityDate?: string
    abstract?: string
    classification?: string
    type?: string
  }>
  count?: number
  [key: string]: any // 允许其他字段
}

/**
 * Google Patents 数据源实现
 */
export class GooglePatentsDataSource implements PatentDataSource {
  name = 'google_patents'
  type = 'remote' as const
  private baseUrl = 'https://patents.google.com'
  private searchUrl = 'https://patents.google.com/xhr/query'
  private config: GooglePatentsConfig

  // 简单的速率限制器
  private lastRequestTime = 0
  private requestCount = 0
  private rateLimitWindow = 1000 // 1秒窗口

  constructor(config: GooglePatentsConfig = { enabled: true }) {
    this.config = config
    console.log('[GooglePatentsDataSource] 初始化在线数据源')
  }

  /**
   * 查询专利
   */
  async query(query: PatentQuery): Promise<PatentRecord[]> {
    // 速率限制
    await this.rateLimit()

    // 优先使用精确查询
    if (query.publicationNumber) {
      const result = await this.getByPublicationNumber(query.publicationNumber)
      return result ? [result] : []
    }

    // 关键词搜索
    if (query.keywords && query.keywords.length > 0) {
      return await this.search(query.keywords.join(' '), query)
    }

    return []
  }

  /**
   * 根据公开号查询专利
   */
  async getByPublicationNumber(number: string): Promise<PatentRecord | null> {
    const url = `${this.baseUrl}/patent/${number}`

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YunPat/1.0)',
        },
        signal: AbortSignal.timeout(this.config.timeout || 10000),
      })

      if (!response.ok) {
        console.warn(`[GooglePatentsDataSource] HTTP ${response.status}: ${number}`)
        return null
      }

      const html = await response.text()
      return this.extractPatentFromHTML(html, number)
    } catch (error) {
      console.error('[GooglePatentsDataSource] 查询失败:', error)
      return null
    }
  }

  /**
   * 搜索专利
   */
  async search(searchQuery: string, options: PatentQuery = {}): Promise<PatentRecord[]> {
    const limit = options.limit || 20
    const offset = options.offset || 0

    const params = new URLSearchParams({
      q: searchQuery,
      o: JSON.stringify({
        num: limit,
        include: true,
        page: Math.floor(offset / limit) + 1,
      }),
    })

    const url = `${this.searchUrl}?${params}`

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YunPat/1.0)',
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      })

      if (!response.ok) {
        console.warn(`[GooglePatentsDataSource] 搜索失败: HTTP ${response.status}`)
        return []
      }

      // 尝试解析 JSON
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const data = (await response.json()) as GooglePatentsResponse
        return this.parseJSONResults(data)
      }

      // 回退到 HTML 解析
      const html = await response.text()
      return this.extractPatentsFromHTML(html, searchQuery, limit)
    } catch (error) {
      console.error('[GooglePatentsDataSource] 搜索失败:', error)
      return []
    }
  }

  /**
   * 解析 JSON 结果
   */
  private parseJSONResults(data: GooglePatentsResponse): PatentRecord[] {
    const patents: PatentRecord[] = []

    if (!data.results || !Array.isArray(data.results)) {
      return patents
    }

    for (const result of data.results) {
      const patent: PatentRecord = {
        publicationNumber: result.patent || result.id,
        title: result.title || '',
        abstract: result.abstract || '',
        applicant: result.assignee || '未知',
        inventors: result.inventors ? result.inventors.map((i) => i.name) : [],
        publicationDate: result.publicationDate,
        applicationDate: result.filingDate,
        priorityDate: result.priorityDate,
        ipcCodes: result.classification ? [result.classification] : [],
        cpcCodes: result.classification ? [result.classification] : [],
        status: result.type || 'unknown',
        source: 'google_patents',
        url: `${this.baseUrl}/patent/${result.patent || result.id}`,
        relevanceScore: 0.8,
      }

      patents.push(patent)
    }

    console.log(`[GooglePatentsDataSource] 解析 JSON 结果: ${patents.length} 条`)

    return patents
  }

  /**
   * 从 HTML 提取专利信息
   */
  private extractPatentsFromHTML(html: string, query: string, limit: number): PatentRecord[] {
    const patents: PatentRecord[] = []

    // 简化的 HTML 解析（实际应该使用专业的 HTML 解析库）
    const lines = html.split('\n')
    let patentCount = 0

    for (const line of lines) {
      if (line.includes('patent/') && patentCount < limit) {
        // 提取专利号
        const patentMatch = line.match(/patent\/([^"'\s\/]+)/)
        if (patentMatch) {
          const patentId = patentMatch[1]

          // 提取标题
          const titleMatch = line.match(/>([^<]{20,100})<\/a>/)
          const title = titleMatch ? this.cleanText(titleMatch[1]) : `${query}相关专利`

          patents.push({
            publicationNumber: patentId,
            title: title,
            abstract: `基于"${query}"技术的专利，通过 Google Patents 检索获得。`,
            applicant: '待查询',
            inventors: [],
            ipcCodes: [],
            source: 'google_patents',
            url: `${this.baseUrl}/patent/${patentId}`,
            relevanceScore: 0.8 - patentCount * 0.02,
          })

          patentCount++
        }
      }
    }

    console.log(`[GooglePatentsDataSource] HTML 解析: ${patents.length} 条`)

    return patents
  }

  /**
   * 从单个专利 HTML 提取信息
   */
  private extractPatentFromHTML(html: string, patentId: string): PatentRecord | null {
    // 提取标题
    const titleMatch = html.match(/<title>([^<]+) - Google Patents<\/title>/)
    const title = titleMatch ? titleMatch[1].trim() : patentId

    // 提取摘要
    const abstractMatch = html.match(/<meta name="description" content="([^"]+)"/)
    const abstract = abstractMatch ? abstractMatch[1] : '请查看 Google Patents 获取完整摘要'

    // 提取申请人
    const assigneeMatch = html.match(/Assignee[^<]*<span[^>]*>([^<]+)<\/span>/)
    const applicant = assigneeMatch ? assigneeMatch[1] : '未知'

    // 提取发明人
    const inventors: string[] = []
    const inventorMatches = html.match(/Inventor[^<]*<span[^>]*>([^<]+)<\/span>/g)
    if (inventorMatches) {
      for (const match of inventorMatches) {
        const nameMatch = match.match(/<span[^>]*>([^<]+)<\/span>/)
        if (nameMatch) {
          inventors.push(nameMatch[1])
        }
      }
    }

    return {
      publicationNumber: patentId,
      title: title,
      abstract: abstract,
      applicant: applicant,
      inventors: inventors,
      ipcCodes: [],
      source: 'google_patents',
      url: `${this.baseUrl}/patent/${patentId}`,
      relevanceScore: 0.8,
    }
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * 速率限制
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.rateLimitWindow) {
      const sleepTime = this.rateLimitWindow - timeSinceLastRequest
      console.log(`[GooglePatentsDataSource] 速率限制: 等待 ${sleepTime}ms`)
      await new Promise((resolve) => setTimeout(resolve, sleepTime))
    }

    this.lastRequestTime = Date.now()
    this.requestCount++
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })

      const isHealthy = response.ok

      if (isHealthy) {
        console.log('[GooglePatentsDataSource] 健康检查: ✓ 正常')
      } else {
        console.warn('[GooglePatentsDataSource] 健康检查: ✗ 异常')
      }

      return isHealthy
    } catch (error) {
      console.error('[GooglePatentsDataSource] 健康检查失败:', error)
      return false
    }
  }
}
