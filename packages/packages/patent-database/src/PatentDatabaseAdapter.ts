/**
 * 专利数据库适配器
 * Patent Database Adapter - 统一接口访问多个数据源
 */

import type { PatentDataSource, PatentRecord, PatentQuery, PatentStatistics } from './types.js'
import { PatentDBDataSource } from './sources/PatentDBDataSource.js'
import { GooglePatentsDataSource } from './sources/GooglePatentsDataSource.js'

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  /** PatentDB 配置 */
  patent_db?: {
    host: string
    port: number
    database: string
    user: string
    password: string
    poolSize?: number
  }
  /** Google Patents 配置 */
  google_patents?: {
    enabled?: boolean
    rateLimit?: number
    timeout?: number
  }
}

/**
 * 专利数据库适配器
 * 统一接口访问多个数据源（patent_db + Google Patents）
 */
export class PatentDatabaseAdapter {
  private sources: Map<string, PatentDataSource>

  constructor(config: DataSourceConfig) {
    this.sources = new Map()

    // 初始化 PatentDB
    if (config.patent_db) {
      const patentDB = new PatentDBDataSource(config.patent_db)
      this.sources.set('patent_db', patentDB)
      console.log('[PatentDatabaseAdapter] ✓ PatentDB 数据源已初始化')
    }

    // 初始化 Google Patents
    if (config.google_patents?.enabled !== false) {
      const googlePatents = new GooglePatentsDataSource(config.google_patents || {})
      this.sources.set('google_patents', googlePatents)
      console.log('[PatentDatabaseAdapter] ✓ Google Patents 数据源已初始化')
    }

    console.log(`[PatentDatabaseAdapter] 共初始化 ${this.sources.size} 个数据源`)
  }

  /**
   * 查询专利（自动选择最优数据源）
   */
  async queryPatents(query: PatentQuery): Promise<PatentRecord[]> {
    console.log(`[PatentDatabaseAdapter] 查询专利: ${JSON.stringify(query)}`)

    // 精确查询：优先 patent_db
    if (query.publicationNumber) {
      return await this.queryByPublicationNumber(query.publicationNumber)
    }

    // 申请人查询：使用 patent_db
    if (query.applicant) {
      return await this.queryByApplicant(query.applicant, query)
    }

    // 关键词查询：智能选择数据源
    if (query.keywords && query.keywords.length > 0) {
      return await this.queryByKeywords(query.keywords, query)
    }

    // 分类号查询：使用 patent_db
    if (query.classification) {
      return await this.queryByClassification(query.classification, query)
    }

    return []
  }

  /**
   * 根据公开号查询（智能选择数据源）
   */
  async queryByPublicationNumber(number: string): Promise<PatentRecord[]> {
    console.log(`[PatentDatabaseAdapter] 查询公开号: ${number}`)

    // 判断是哪种专利号格式
    const isCN = /^CN\d/.test(number)
    const isUS = /^US\d/.test(number)

    // 中国专利：优先 patent_db
    if (isCN) {
      const patentDB = this.sources.get('patent_db')
      if (patentDB) {
        try {
          const result = await patentDB.getByPublicationNumber(number)
          if (result) {
            console.log(`[PatentDatabaseAdapter] ✓ PatentDB 找到结果`)
            return [result]
          }
        } catch (error) {
          console.warn('[PatentDatabaseAdapter] PatentDB 查询失败:', error)
        }
      }
    }

    // 回退到 Google Patents
    const googlePatents = this.sources.get('google_patents')
    if (googlePatents) {
      try {
        const result = await googlePatents.getByPublicationNumber(number)
        if (result) {
          console.log(`[PatentDatabaseAdapter] ✓ Google Patents 找到结果`)
          return [result]
        }
      } catch (error) {
        console.warn('[PatentDatabaseAdapter] Google Patents 查询失败:', error)
      }
    }

    console.log(`[PatentDatabaseAdapter] ✗ 未找到专利: ${number}`)
    return []
  }

  /**
   * 根据申请人查询（使用 patent_db）
   */
  async queryByApplicant(applicant: string, options: PatentQuery = {}): Promise<PatentRecord[]> {
    console.log(`[PatentDatabaseAdapter] 查询申请人: ${applicant}`)

    const patentDB = this.sources.get('patent_db')
    if (patentDB && patentDB.getByApplicant) {
      try {
        const results = await patentDB.getByApplicant(applicant, options)
        console.log(`[PatentDatabaseAdapter] ✓ PatentDB 找到 ${results.length} 条结果`)
        return results
      } catch (error) {
        console.error('[PatentDatabaseAdapter] 申请人查询失败:', error)
        return []
      }
    }

    return []
  }

  /**
   * 关键词查询（智能选择数据源）
   */
  async queryByKeywords(keywords: string[], options: PatentQuery = {}): Promise<PatentRecord[]> {
    const query = keywords.join(' ')
    console.log(`[PatentDatabaseAdapter] 关键词查询: ${query}`)

    // 检查是否包含中文
    const hasChinese = /[一-龥]/.test(query)

    // 中文查询：优先 patent_db
    if (hasChinese) {
      const patentDB = this.sources.get('patent_db')
      if (patentDB && patentDB.fullTextSearch) {
        try {
          const results = await patentDB.fullTextSearch(query, options)
          console.log(`[PatentDatabaseAdapter] ✓ PatentDB 找到 ${results.length} 条结果`)
          return results
        } catch (error) {
          console.warn('[PatentDatabaseAdapter] PatentDB 查询失败，尝试 Google Patents:', error)
        }
      }
    }

    // 英文查询或回退：使用 Google Patents
    const googlePatents = this.sources.get('google_patents')
    if (googlePatents && googlePatents.search) {
      try {
        const results = await googlePatents.search(query, options)
        console.log(`[PatentDatabaseAdapter] ✓ Google Patents 找到 ${results.length} 条结果`)
        return results
      } catch (error) {
        console.error('[PatentDatabaseAdapter] Google Patents 查询失败:', error)
        return []
      }
    }

    return []
  }

  /**
   * 根据分类号查询（使用 patent_db）
   */
  async queryByClassification(
    classification: string,
    options: PatentQuery = {}
  ): Promise<PatentRecord[]> {
    console.log(`[PatentDatabaseAdapter] 查询分类号: ${classification}`)

    const patentDB = this.sources.get('patent_db')
    if (patentDB && patentDB.getByClassification) {
      try {
        const results = await patentDB.getByClassification(classification, options)
        console.log(`[PatentDatabaseAdapter] ✓ PatentDB 找到 ${results.length} 条结果`)
        return results
      } catch (error) {
        console.error('[PatentDatabaseAdapter] 分类号查询失败:', error)
        return []
      }
    }

    return []
  }

  /**
   * 获取统计数据
   */
  async getStatistics(): Promise<PatentStatistics | null> {
    const patentDB = this.sources.get('patent_db')
    if (patentDB && 'getStatistics' in patentDB) {
      try {
        return await (patentDB as any).getStatistics()
      } catch (error) {
        console.error('[PatentDatabaseAdapter] 统计查询失败:', error)
      }
    }

    return null
  }

  /**
   * 健康检查（检查所有数据源）
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {}

    console.log('[PatentDatabaseAdapter] 健康检查...')

    for (const [name, source] of this.sources) {
      try {
        results[name] = await source.healthCheck()
      } catch (error) {
        console.warn(`[PatentDatabaseAdapter] ${name} 健康检查失败:`, error)
        results[name] = false
      }
    }

    return results
  }

  /**
   * 关闭所有连接
   */
  async close(): Promise<void> {
    console.log('[PatentDatabaseAdapter] 关闭所有连接...')

    for (const [name, source] of this.sources) {
      try {
        if (source.close) {
          await source.close()
          console.log(`[PatentDatabaseAdapter] ✓ ${name} 连接已关闭`)
        }
      } catch (error) {
        console.warn(`[PatentDatabaseAdapter] ${name} 关闭失败:`, error)
      }
    }
  }

  /**
   * 获取数据源列表
   */
  getDataSources(): string[] {
    return Array.from(this.sources.keys())
  }

  /**
   * 获取特定数据源
   */
  getDataSource(name: string): PatentDataSource | undefined {
    return this.sources.get(name)
  }
}
