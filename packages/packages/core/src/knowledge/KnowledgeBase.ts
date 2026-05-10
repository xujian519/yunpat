/**
 * 知识库系统 — Facade
 *
 * 核心功能：
 * 1. 知识存储 - 文档、示例、最佳实践
 * 2. 语义检索 - 关键词、向量、混合搜索
 * 3. 知识注入 - 动态上下文增强
 * 4. 知识更新 - 增量学习、版本管理
 */

import * as path from 'path'
import { ExecutionContext } from '../lifecycle/Lifecycle.js'
import {
  type KnowledgeEntry,
  type SearchOptions,
  type SearchResult,
  type KnowledgeInjectionResult,
  type KnowledgeStats,
  type KnowledgeBaseConfig,
  KnowledgeEntryType,
} from './KnowledgeTypes.js'
export {
  KnowledgeEntryType,
  type KnowledgeEntry,
  type SearchOptions,
  type SearchResult,
  type KnowledgeInjectionResult,
  type KnowledgeStats,
  type KnowledgeBaseConfig,
  BUILTIN_KNOWLEDGE_BASES,
} from './KnowledgeTypes.js'

import {
  search as searchEntries,
  extractKeywords,
  formatKnowledge,
  updateIndexes,
  removeFromIndexes,
  type KnowledgeIndexes,
} from './KnowledgeSearch.js'

import { saveToDisk, loadFromDisk, generateId } from './KnowledgePersistence.js'

import {
  getWritingBestPractices,
  getCodePatterns,
  getDomainKnowledge,
  getErrorSolutions,
} from './KnowledgeBuiltin.js'

/**
 * 知识库类（Facade）
 */
export class KnowledgeBase {
  private entries: Map<string, KnowledgeEntry> = new Map()
  private tagIndex: Map<string, Set<string>> = new Map()
  private categoryIndex: Map<string, Set<string>> = new Map()
  private typeIndex: Map<KnowledgeEntryType, Set<string>> = new Map()

  private config: Required<
    Pick<KnowledgeBaseConfig, 'name' | 'storagePath' | 'persistent' | 'loadBuiltin'>
  > & {
    description?: string
    embedFn?: (text: string) => Promise<number[]>
    defaultSearchOptions: Partial<SearchOptions>
  }

  constructor(config: KnowledgeBaseConfig) {
    this.config = {
      name: config.name,
      description: config.description,
      storagePath:
        config.storagePath ??
        path.join(process.env.HOME ?? '', '.yunpat', 'knowledge', config.name),
      persistent: config.persistent ?? true,
      loadBuiltin: config.loadBuiltin ?? true,
      embedFn: config.embedFn,
      defaultSearchOptions: config.defaultSearchOptions ?? {
        mode: 'hybrid',
        limit: 5,
        minSimilarity: 0.7,
        keywordWeight: 0.5,
        semanticWeight: 0.5,
      },
    }
  }

  private getIndexes(): KnowledgeIndexes {
    return {
      entries: this.entries,
      tagIndex: this.tagIndex,
      categoryIndex: this.categoryIndex,
      typeIndex: this.typeIndex,
    }
  }

  async initialize(): Promise<void> {
    if (this.config.persistent) {
      const loaded = await loadFromDisk(this.config.storagePath)
      for (const entry of loaded) {
        this.entries.set(entry.id, entry)
        updateIndexes(this.getIndexes(), entry.id, entry)
      }
    }

    if (this.config.loadBuiltin) {
      await this.loadBuiltinKnowledge()
    }
  }

  async store(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'referenceCount'>
  ): Promise<string> {
    const now = new Date()
    const id = generateId(entry.title, entry.category)

    const newEntry: KnowledgeEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1,
      referenceCount: 0,
    }

    if (this.config.embedFn && !newEntry.embedding) {
      newEntry.embedding = await this.config.embedFn(`${newEntry.title}\n${newEntry.content}`)
    }

    this.entries.set(id, newEntry)
    updateIndexes(this.getIndexes(), id, newEntry)

    if (this.config.persistent) {
      await saveToDisk(
        this.config.storagePath,
        this.config.name,
        this.config.description,
        this.entries
      )
    }

    return id
  }

  async update(
    entryId: string,
    updates: Partial<Omit<KnowledgeEntry, 'id' | 'createdAt'>>
  ): Promise<void> {
    const existing = this.entries.get(entryId)
    if (!existing) {
      throw new Error(`知识条目不存在: ${entryId}`)
    }

    const updated: KnowledgeEntry = {
      ...existing,
      ...updates,
      id: entryId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      version: existing.version + 1,
    }

    if (this.config.embedFn && (updates.title || updates.content)) {
      updated.embedding = await this.config.embedFn(`${updated.title}\n${updated.content}`)
    }

    this.entries.set(entryId, updated)

    if (updates.category || updates.tags || updates.type) {
      removeFromIndexes(this.getIndexes(), entryId, existing)
      updateIndexes(this.getIndexes(), entryId, updated)
    }

    if (this.config.persistent) {
      await saveToDisk(
        this.config.storagePath,
        this.config.name,
        this.config.description,
        this.entries
      )
    }
  }

  get(entryId: string): KnowledgeEntry | undefined {
    return this.entries.get(entryId)
  }

  async delete(entryId: string): Promise<boolean> {
    const entry = this.entries.get(entryId)
    if (!entry) {
      return false
    }

    this.entries.delete(entryId)
    removeFromIndexes(this.getIndexes(), entryId, entry)

    if (this.config.persistent) {
      await saveToDisk(
        this.config.storagePath,
        this.config.name,
        this.config.description,
        this.entries
      )
    }

    return true
  }

  async search(query: string, options: Partial<SearchOptions> = {}): Promise<SearchResult[]> {
    const opts: SearchOptions = {
      mode: options.mode ?? this.config.defaultSearchOptions.mode ?? 'hybrid',
      limit: options.limit ?? this.config.defaultSearchOptions.limit ?? 5,
      minSimilarity: options.minSimilarity ?? this.config.defaultSearchOptions.minSimilarity ?? 0.7,
      categories: options.categories,
      types: options.types,
      tags: options.tags,
      keywordWeight: options.keywordWeight ?? this.config.defaultSearchOptions.keywordWeight ?? 0.5,
      semanticWeight:
        options.semanticWeight ?? this.config.defaultSearchOptions.semanticWeight ?? 0.5,
    }

    return searchEntries(this.getIndexes(), query, opts, this.config.embedFn)
  }

  async enhancePrompt(
    prompt: string,
    context?: ExecutionContext
  ): Promise<KnowledgeInjectionResult> {
    const keywords = extractKeywords(prompt)

    const searchResults = await this.search(keywords.join(' '), {
      mode: 'hybrid',
      limit: 10,
      tags: context?.metadata?.knowledgeTags as string[] | undefined,
    })

    const injectedEntries: KnowledgeEntry[] = []
    const injectedCategories = new Set<string>()

    for (const result of searchResults) {
      if (injectedCategories.has(result.entry.category)) {
        continue
      }
      injectedEntries.push(result.entry)
      injectedCategories.add(result.entry.category)
      result.entry.referenceCount++
    }

    let enhancedPrompt = prompt
    if (injectedEntries.length > 0) {
      const knowledgeSection = formatKnowledge(injectedEntries)
      enhancedPrompt = `${knowledgeSection}\n\n## 用户任务\n\n${prompt}`
    }

    if (this.config.persistent && injectedEntries.length > 0) {
      await saveToDisk(
        this.config.storagePath,
        this.config.name,
        this.config.description,
        this.entries
      )
    }

    return {
      enhancedPrompt,
      injectedEntries,
      injectedCategories: Array.from(injectedCategories),
    }
  }

  getStats(): KnowledgeStats {
    const byType: Record<KnowledgeEntryType, number> = {
      [KnowledgeEntryType.DOCUMENT]: 0,
      [KnowledgeEntryType.EXAMPLE]: 0,
      [KnowledgeEntryType.BEST_PRACTICE]: 0,
      [KnowledgeEntryType.ERROR_SOLUTION]: 0,
      [KnowledgeEntryType.DOMAIN_KNOWLEDGE]: 0,
      [KnowledgeEntryType.PATTERN]: 0,
    }

    const byCategory: Record<string, number> = {}
    let totalReferences = 0

    for (const entry of this.entries.values()) {
      byType[entry.type]++
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1
      totalReferences += entry.referenceCount
    }

    return {
      totalEntries: this.entries.size,
      byType,
      byCategory,
      totalReferences,
      averageReferences: this.entries.size > 0 ? totalReferences / this.entries.size : 0,
    }
  }

  listAll(): KnowledgeEntry[] {
    return Array.from(this.entries.values())
  }

  getByCategory(category: string): KnowledgeEntry[] {
    const ids = this.categoryIndex.get(category)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter((entry): entry is KnowledgeEntry => entry !== undefined)
  }

  getByTag(tag: string): KnowledgeEntry[] {
    const ids = this.tagIndex.get(tag)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter((entry): entry is KnowledgeEntry => entry !== undefined)
  }

  async clear(): Promise<void> {
    this.entries.clear()
    this.tagIndex.clear()
    this.categoryIndex.clear()
    this.typeIndex.clear()

    if (this.config.persistent) {
      await saveToDisk(
        this.config.storagePath,
        this.config.name,
        this.config.description,
        this.entries
      )
    }
  }

  private async loadBuiltinKnowledge(): Promise<void> {
    const allData = [
      ...getWritingBestPractices(),
      ...getCodePatterns(),
      ...getDomainKnowledge(),
      ...getErrorSolutions(),
    ]

    for (const data of allData) {
      await this.store(data)
    }
  }
}

export function createKnowledgeBase(config: KnowledgeBaseConfig): KnowledgeBase {
  return new KnowledgeBase(config)
}
