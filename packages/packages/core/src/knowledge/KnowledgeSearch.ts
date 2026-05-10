/**
 * 知识库搜索模块
 *
 * 提供关键词、语义、混合搜索能力
 */

import {
  type KnowledgeEntry,
  type SearchOptions,
  type SearchResult,
  KnowledgeEntryType,
} from './KnowledgeTypes.js'

/**
 * 知识库索引数据（搜索函数的参数）
 */
export interface KnowledgeIndexes {
  entries: Map<string, KnowledgeEntry>
  tagIndex: Map<string, Set<string>>
  categoryIndex: Map<string, Set<string>>
  typeIndex: Map<KnowledgeEntryType, Set<string>>
}

/**
 * 搜索知识条目
 */
export async function search(
  indexes: KnowledgeIndexes,
  query: string,
  options: SearchOptions,
  embedFn?: (text: string) => Promise<number[]>
): Promise<SearchResult[]> {
  const candidates = getCandidates(indexes, options)

  const results: SearchResult[] = []
  for (const entry of candidates) {
    const result = await scoreEntry(entry, query, options, embedFn)
    if (result.score >= (options.minSimilarity ?? 0.7)) {
      results.push(result)
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, options.limit ?? 5)
}

/**
 * 获取候选条目（通过索引过滤）
 */
export function getCandidates(indexes: KnowledgeIndexes, options: SearchOptions): KnowledgeEntry[] {
  let candidateIds: Set<string> | undefined

  if (options.categories && options.categories.length > 0) {
    const categoryIds = options.categories.flatMap((cat) =>
      Array.from(indexes.categoryIndex.get(cat) ?? [])
    )
    candidateIds = candidateIds ? new Set([...candidateIds, ...categoryIds]) : new Set(categoryIds)
  }

  if (options.types && options.types.length > 0) {
    const typeIds = options.types.flatMap((type) => Array.from(indexes.typeIndex.get(type) ?? []))
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter((id) => typeIds.includes(id)))
      : new Set(typeIds)
  }

  if (options.tags && options.tags.length > 0) {
    const tagIds = options.tags.flatMap((tag) => Array.from(indexes.tagIndex.get(tag) ?? []))
    candidateIds = candidateIds
      ? new Set([...candidateIds].filter((id) => tagIds.includes(id)))
      : new Set(tagIds)
  }

  if (candidateIds) {
    return Array.from(candidateIds)
      .map((id) => indexes.entries.get(id))
      .filter((entry): entry is KnowledgeEntry => entry !== undefined)
  }

  return Array.from(indexes.entries.values())
}

/**
 * 为条目打分
 */
export async function scoreEntry(
  entry: KnowledgeEntry,
  query: string,
  options: SearchOptions,
  embedFn?: (text: string) => Promise<number[]>
): Promise<SearchResult> {
  const queryLower = query.toLowerCase()
  const keywords = queryLower.split(/\s+/)

  let keywordScore = 0
  const titleLower = entry.title.toLowerCase()
  const contentLower = entry.content.toLowerCase()
  const tagMatches: string[] = []

  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      keywordScore += 0.3
    }
    if (contentLower.includes(keyword)) {
      keywordScore += 0.1
    }
  }

  for (const tag of entry.tags) {
    if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
      keywordScore += 0.2
      tagMatches.push(tag)
    }
  }

  keywordScore *= 1 + entry.priority * 0.1

  let semanticScore = 0
  if (options.mode === 'semantic' || options.mode === 'hybrid') {
    if (embedFn && entry.embedding) {
      const queryEmbedding = await embedFn(query)
      semanticScore = cosineSimilarity(queryEmbedding, entry.embedding)
    } else {
      semanticScore = textSimilarity(query, entry.title + ' ' + entry.content)
    }
  }

  let finalScore: number
  if (options.mode === 'keyword') {
    finalScore = Math.min(keywordScore, 1)
  } else if (options.mode === 'semantic') {
    finalScore = semanticScore
  } else {
    const kw = options.keywordWeight ?? 0.5
    const sw = options.semanticWeight ?? 0.5
    finalScore = (keywordScore * kw + semanticScore * sw) / (kw + sw)
  }

  return {
    entry,
    score: finalScore,
    matchReason: { keywordScore, semanticScore, tagMatches },
  }
}

/**
 * 余弦相似度
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * 文本相似度（Jaccard）
 */
export function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return union.size === 0 ? 0 : intersection.size / union.size
}

/**
 * 提取关键词
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    '的',
    '是',
    '在',
    '和',
    '与',
    '或',
    '但',
    '而',
    '对',
    '把',
    '被',
    '让',
    '使',
    '为了',
    '如果',
    '那么',
    '这',
    '那',
    '这个',
    '那个',
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'and',
    'or',
    'but',
    'if',
    'then',
    'this',
    'that',
  ])

  const words = text
    .toLowerCase()
    .split(/[\s,;.!?，；。！？]+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))

  const frequency = new Map<string, number>()
  for (const word of words) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1)
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

/**
 * 格式化知识内容
 */
export function formatKnowledge(entries: KnowledgeEntry[]): string {
  const sections: string[] = ['## 相关知识\n']

  for (const entry of entries) {
    sections.push(`### ${entry.title}`)
    sections.push('')
    sections.push(entry.content)
    sections.push('')
    sections.push(`*类别: ${entry.category} | 标签: ${entry.tags.join(', ')}*`)
    sections.push('')
  }

  return sections.join('\n')
}

/**
 * 更新索引
 */
export function updateIndexes(indexes: KnowledgeIndexes, id: string, entry: KnowledgeEntry): void {
  const tags = entry.tags || []
  for (const tag of tags) {
    if (!indexes.tagIndex.has(tag)) {
      indexes.tagIndex.set(tag, new Set())
    }
    indexes.tagIndex.get(tag)!.add(id)
  }

  if (!indexes.categoryIndex.has(entry.category)) {
    indexes.categoryIndex.set(entry.category, new Set())
  }
  indexes.categoryIndex.get(entry.category)!.add(id)

  if (!indexes.typeIndex.has(entry.type)) {
    indexes.typeIndex.set(entry.type, new Set())
  }
  indexes.typeIndex.get(entry.type)!.add(id)
}

/**
 * 从索引中移除
 */
export function removeFromIndexes(
  indexes: KnowledgeIndexes,
  id: string,
  entry: KnowledgeEntry
): void {
  for (const tag of entry.tags) {
    indexes.tagIndex.get(tag)?.delete(id)
  }
  indexes.categoryIndex.get(entry.category)?.delete(id)
  indexes.typeIndex.get(entry.type)?.delete(id)
}
