/**
 * 知识检索器
 *
 * 从知识库中检索相关内容
 *
 * @package @yunpat/skills
 */

import type { KnowledgeEntry, KnowledgeQuery, KnowledgeResult } from './types.js'
import { KnowledgeEntryType } from './types.js'

/**
 * 知识检索器
 */
export class KnowledgeRetriever {
  private entries: Map<string, KnowledgeEntry>

  constructor(entries: KnowledgeEntry[] = []) {
    this.entries = new Map()
    this.indexEntries(entries)
  }

  /**
   * 检索知识
   *
   * @param query - 知识查询
   * @returns 检索结果
   */
  retrieve(query: KnowledgeQuery): KnowledgeResult {
    const startTime = Date.now()

    let matchedEntries = Array.from(this.entries.values())

    // 按概念过滤
    if (query.concepts && query.concepts.length > 0) {
      matchedEntries = matchedEntries.filter((entry) => {
        if (entry.type !== KnowledgeEntryType.CONCEPT) return false
        return query.concepts!.some((concept) =>
          entry.title.toLowerCase().includes(concept.toLowerCase())
        )
      })
    }

    // 按 Wiki 页面过滤
    if (query.wikiPages && query.wikiPages.length > 0) {
      matchedEntries = matchedEntries.filter((entry) => {
        if (entry.type !== KnowledgeEntryType.WIKI) return false
        return query.wikiPages!.some((page) =>
          entry.path.toLowerCase().includes(page.toLowerCase())
        )
      })
    }

    // 按关键词过滤
    if (query.keywords && query.keywords.length > 0) {
      matchedEntries = matchedEntries.filter((entry) => {
        const content = entry.content.toLowerCase()
        return query.keywords!.some((keyword) => content.includes(keyword.toLowerCase()))
      })
    }

    // 按标签过滤
    if (query.tags && query.tags.length > 0) {
      matchedEntries = matchedEntries.filter((entry) => {
        const entryTags = entry.metadata?.tags || []
        return query.tags!.some((tag) => entryTags.includes(tag))
      })
    }

    // 限制返回数量
    const maxItems = query.maxItems || matchedEntries.length
    const limitedEntries = matchedEntries.slice(0, maxItems)

    const queryTime = Date.now() - startTime

    return {
      entries: limitedEntries,
      totalCount: matchedEntries.length,
      queryTime,
      matchedQuery: query,
    }
  }

  /**
   * 添加或更新条目
   *
   * @param entry - 知识条目
   */
  upsertEntry(entry: KnowledgeEntry): void {
    const key = this.getEntryKey(entry)
    this.entries.set(key, entry)
  }

  /**
   * 批量索引条目
   *
   * @param entries - 知识条目数组
   */
  indexEntries(entries: KnowledgeEntry[]): void {
    for (const entry of entries) {
      this.upsertEntry(entry)
    }
  }

  /**
   * 生成条目键
   *
   * @param entry - 知识条目
   * @returns 条目键
   */
  private getEntryKey(entry: KnowledgeEntry): string {
    return `${entry.type}:${entry.path}`
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalEntries: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}

    for (const entry of this.entries.values()) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
    }

    return {
      totalEntries: this.entries.size,
      byType,
    }
  }
}
