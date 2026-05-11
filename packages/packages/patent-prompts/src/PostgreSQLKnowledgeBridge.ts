/**
 * PostgreSQLKnowledgeBridge — 将法律世界模型数据库接入 PromptTemplateManager 的 KnowledgeBridge 接口
 *
 * 组合 PostgreSQLClient（向量/结构化搜索），
 * 使 prompt 模板能通过 KnowledgeBridge 接口动态检索法律知识。
 */

import type { KnowledgeBridge } from './PromptTemplateManager.js'

type PgRecord = Record<string, unknown>

export interface PostgreSQLKnowledgeBridgeConfig {
  pgClient: {
    vectorSearch(
      queryText: string,
      topK: number,
      table?: string
    ): Promise<PgRecord[]>
    queryInvalidDecisions(query: string, topK: number): Promise<PgRecord[]>
    searchPatentRules(params: {
      query?: string
      articleType?: string
      hierarchyLevel?: number
      topK?: number
    }): Promise<PgRecord[]>
    structuredSearch(
      query: string,
      topK: number,
      includeInvalidDecisions?: boolean
    ): Promise<PgRecord[]>
  }
}

function getStr(r: PgRecord, key: string): string {
  const v = r[key]
  return typeof v === 'string' ? v : ''
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.substring(0, maxLen) : s
}

export class PostgreSQLKnowledgeBridge implements KnowledgeBridge {
  private pgClient: PostgreSQLKnowledgeBridgeConfig['pgClient']

  constructor(config: PostgreSQLKnowledgeBridgeConfig) {
    this.pgClient = config.pgClient
  }

  async queryByConcept(concept: string): Promise<string[]> {
    try {
      const results = await this.pgClient.vectorSearch(concept, 5)
      return results.map((r) => getStr(r, 'title')).filter(Boolean)
    } catch {
      return []
    }
  }

  async readWikiPage(page: string): Promise<string> {
    try {
      const results = await this.pgClient.vectorSearch(page, 1)
      if (results.length > 0) {
        return getStr(results[0], 'content')
      }
      return ''
    } catch {
      return ''
    }
  }

  async vectorSearchLaw(query: string, topK: number = 5): Promise<string[]> {
    try {
      const results = await this.pgClient.vectorSearch(query, topK)
      return results.map((r) => {
        const title = getStr(r, 'title')
        const content = truncate(getStr(r, 'content'), 500)
        return `## ${title}\n${content}`
      })
    } catch {
      return []
    }
  }

  async searchInvalidDecisions(query: string, topK: number = 5): Promise<string[]> {
    try {
      const results = await this.pgClient.queryInvalidDecisions(query, topK)
      return results.map((r) => {
        const number = getStr(r, 'document_number') || getStr(r, 'id')
        const content = truncate(getStr(r, 'content'), 500)
        return `决定号: ${number}\n${content}`
      })
    } catch {
      return []
    }
  }

  async searchPatentRules(query: string, topK: number = 5): Promise<string[]> {
    try {
      const results = await this.pgClient.searchPatentRules({ query, topK })
      if (!Array.isArray(results)) return []
      return results.map((r) => {
        const title = getStr(r, 'title')
        const content = truncate(getStr(r, 'content'), 500)
        return `## ${title}\n${content}`
      })
    } catch {
      return []
    }
  }

  async queryKnowledgeGraph(
    query: string,
    _options?: Record<string, unknown>
  ): Promise<string[]> {
    try {
      const results = await this.pgClient.structuredSearch(query, 5, true)
      return results.map((r) => {
        const title = getStr(r, 'title') || getStr(r, 'document_number')
        const content = truncate(getStr(r, 'content'), 300)
        return `${title}: ${content}`
      })
    } catch {
      return []
    }
  }
}
