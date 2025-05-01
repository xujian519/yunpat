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
export declare const KnowledgeCardSchema: z.ZodObject<
  {
    id: z.ZodString
    question: z.ZodString
    content: z.ZodString
    sourcePages: z.ZodArray<z.ZodString, 'many'>
    relatedCards: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>
    concept: z.ZodString
    domain: z.ZodString
    quality: z.ZodNumber
    tags: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>
    embedding: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber, 'many'>>>
    version: z.ZodDefault<z.ZodNumber>
    createdAt: z.ZodString
    updatedAt: z.ZodString
    metadata: z.ZodObject<
      {
        generator: z.ZodDefault<z.ZodString>
        llmModel: z.ZodDefault<z.ZodString>
        tokenCount: z.ZodDefault<z.ZodNumber>
        referenceCount: z.ZodDefault<z.ZodNumber>
      },
      'strip',
      z.ZodTypeAny,
      {
        referenceCount: number
        generator: string
        llmModel: string
        tokenCount: number
      },
      {
        referenceCount?: number | undefined
        generator?: string | undefined
        llmModel?: string | undefined
        tokenCount?: number | undefined
      }
    >
  },
  'strip',
  z.ZodTypeAny,
  {
    metadata: {
      referenceCount: number
      generator: string
      llmModel: string
      tokenCount: number
    }
    createdAt: string
    id: string
    content: string
    quality: number
    tags: string[]
    updatedAt: string
    version: number
    question: string
    sourcePages: string[]
    relatedCards: string[]
    concept: string
    domain: string
    embedding?: number[] | null | undefined
  },
  {
    metadata: {
      referenceCount?: number | undefined
      generator?: string | undefined
      llmModel?: string | undefined
      tokenCount?: number | undefined
    }
    createdAt: string
    id: string
    content: string
    quality: number
    updatedAt: string
    question: string
    sourcePages: string[]
    concept: string
    domain: string
    embedding?: number[] | null | undefined
    tags?: string[] | undefined
    version?: number | undefined
    relatedCards?: string[] | undefined
  }
>
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
export declare function generateCardId(question: string, concept: string): string
export declare function cardToMarkdown(card: KnowledgeCard): string
export declare function markdownToCard(content: string, id: string): KnowledgeCard
//# sourceMappingURL=KnowledgeCard.d.ts.map
