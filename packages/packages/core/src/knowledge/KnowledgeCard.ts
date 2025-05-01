/**
 * Wiki 知识卡片模型
 *
 * 统一的知识卡片数据结构，用于：
 * 1. 从 Obsidian 知识库中提取和生成结构化知识
 * 2. 支持多维度检索（关键词、语义、概念、领域）
 * 3. 与 KnowledgeBase 无缝集成
 * 4. 支持增量更新和版本管理
 */

import { z } from 'zod'
import { createHash } from 'crypto'

// Zod schema 用于验证
export const KnowledgeCardSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  content: z.string().min(10),
  sourcePages: z.array(z.string()),
  relatedCards: z.array(z.string()).default([]),
  concept: z.string(),
  domain: z.string(),
  quality: z.number().min(0).max(1),
  tags: z.array(z.string()).default([]),
  embedding: z.array(z.number()).nullable().optional(),
  version: z.number().int().min(1).default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.object({
    generator: z.string().default('unknown'),
    llmModel: z.string().default('unknown'),
    tokenCount: z.number().int().default(0),
    referenceCount: z.number().int().default(0),
  }),
})

export type KnowledgeCard = z.infer<typeof KnowledgeCardSchema>

export interface CardSearchOptions {
  mode?: 'keyword' | 'semantic' | 'hybrid'
  limit?: number
  minQuality?: number
  domain?: string
  concept?: string
  tags?: string[]
  minSimilarity?: number
  includeRelated?: boolean
  maxDepth?: number
}

export interface CardSearchResult {
  card: KnowledgeCard
  score: number
  matchReason: {
    keywordScore: number
    semanticScore: number
    tagMatches: string[]
  }
}

export interface PipelineConfig {
  concepts: string[]
  maxCardsPerConcept: number
  qualityThreshold: number
  concurrency: number
  batchSize: number
  onProgress?: (progress: PipelineProgress) => void
}

export interface PipelineProgress {
  phase: 'generating' | 'embedding' | 'storing'
  current: number
  total: number
  concept?: string
}

export interface PipelineResult {
  totalGenerated: number
  totalStored: number
  avgQuality: number
  byDomain: Record<string, number>
  errors: string[]
  duration: number
}

export function generateCardId(question: string, concept: string): string {
  const sanitize = (s: string) => s.replace(/[:/\\*?"<>|（）()]/g, '').replace(/\s+/g, '-')
  const normalized = `${concept}-${sanitize(question)}`.toLowerCase().slice(0, 80)
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 11)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${date}-${normalized.slice(0, 40)}-${hash}`
}

export function cardToMarkdown(card: KnowledgeCard): string {
  const lines: string[] = [
    `# ${card.question}`,
    '',
    `- 来源问题: ${card.question}`,
    `- 质量分: ${card.quality.toFixed(4)}`,
    `- 生成时间: ${card.createdAt}`,
    `- 概念: ${card.concept}`,
    `- 领域: ${card.domain}`,
    `- 版本: ${card.version}`,
    '',
    '## 卡片内容',
    '',
    card.content,
    '',
    '## 相关页面',
    '',
    ...card.sourcePages.map((p) => `- [[${p}]]`),
  ]

  if (card.relatedCards.length > 0) {
    lines.push('', '## 关联卡片', '', ...card.relatedCards.map((id) => `- ${id}`))
  }

  return lines.join('\n')
}

export function markdownToCard(content: string, id: string): KnowledgeCard {
  const lines = content.split('\n')

  // 查找元数据行（更健壮的解析）
  let question = ''
  let quality = 0.5
  let timestamp = new Date().toISOString()
  let concept = ''
  let domain = ''
  let version = 1

  for (const line of lines) {
    if (line.startsWith('- 来源问题:')) question = line.replace(/^- 来源问题:\s*/, '')
    else if (line.startsWith('- 质量分:'))
      quality = parseFloat(line.replace(/^- 质量分:\s*/, '')) || 0.5
    else if (line.startsWith('- 生成时间:')) timestamp = line.replace(/^- 生成时间:\s*/, '')
    else if (line.startsWith('- 概念:')) concept = line.replace(/^- 概念:\s*/, '')
    else if (line.startsWith('- 领域:')) domain = line.replace(/^- 领域:\s*/, '')
    else if (line.startsWith('- 版本:'))
      version = parseInt(line.replace(/^- 版本:\s*/, ''), 10) || 1
  }

  const cardContentStart = lines.findIndex((l) => l === '## 卡片内容')
  const relatedPagesStart = lines.findIndex((l) => l === '## 相关页面')
  const relatedCardsStart = lines.findIndex((l) => l === '## 关联卡片')

  const contentEnd = relatedPagesStart > 0 ? relatedPagesStart : lines.length
  const cardContent = lines
    .slice(cardContentStart + 2, contentEnd)
    .join('\n')
    .trim()

  const sourcePages: string[] = []
  const relatedCards: string[] = []
  const wikilinkRegex = /\[\[([^\]]+)\]\]/

  if (relatedPagesStart > 0) {
    const pagesEnd = relatedCardsStart > 0 ? relatedCardsStart : lines.length
    for (let i = relatedPagesStart + 2; i < pagesEnd; i++) {
      const match = lines[i]?.match(wikilinkRegex)
      if (match) sourcePages.push(match[1])
    }
  }

  if (relatedCardsStart > 0) {
    for (let i = relatedCardsStart + 2; i < lines.length; i++) {
      const trimmed = lines[i]?.replace(/^- /, '').trim()
      if (trimmed) relatedCards.push(trimmed)
    }
  }

  const tags = (content.match(/\[\[([^\]]+)\]\]/g) ?? [])
    .map((l) => l.replace(/[\[\]]/g, ''))
    .filter((t) => !sourcePages.includes(t))

  return {
    id,
    question,
    content: cardContent,
    sourcePages,
    relatedCards,
    concept,
    domain,
    quality,
    tags: [...new Set(tags)],
    version,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      generator: 'card-parser',
      llmModel: 'unknown',
      tokenCount: cardContent.length,
      referenceCount: 0,
    },
  }
}
