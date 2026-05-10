import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchResult } from '@yunpat/agent-prior-art-search'
import type { ClaimsSet } from '@yunpat/agent-claim-generator'

/**
 * 说明书章节
 */
export type SpecificationChapter =
  | 'technical_field'
  | 'background_art'
  | 'invention_content'
  | 'embodiments'
  | 'drawings_description'

/**
 * 说明书章节内容
 */
export interface SpecificationSection {
  chapter: string
  title: string
  content: string
  wordCount: number
  quality?: {
    clarity: number
    completeness: number
    consistency: number
  }
}

/**
 * 实施例
 */
export interface Embodiment {
  number: number
  title: string
  content: string
  relatedDrawings: string[]
  keyFeatures: string[]
  type: 'preferred' | 'alternative' | 'comparative'
}

/**
 * 附图说明
 */
export interface DrawingDescription {
  figureNumber: string
  title: string
  description: string
  keyElements: Array<{
    elementNumber: string
    description: string
  }>
}

/**
 * 说明书完整内容
 */
export interface SpecificationContent {
  technical_field: SpecificationSection
  background_art: SpecificationSection
  invention_content: SpecificationSection & {
    technical_problem: string
    technical_solution: string
    beneficial_effects: string
    beneficial_effects_list: Array<{
      effect: string
      metric?: string
      improvement?: string
    }>
  }
  embodiments: SpecificationSection & {
    embodiment_list: Embodiment[]
    completeness_score: number
  }
  drawings_description: SpecificationSection & {
    drawings: DrawingDescription[]
  }
}

/**
 * 说明书撰写输入
 */
export interface SpecificationDrafterInput {
  inventionUnderstanding: InventionUnderstandingOutput
  priorArtSearch?: PriorArtSearchResult
  claimsSet?: ClaimsSet
  drawings?: string[]
  chapters?: SpecificationChapter[]
  enableChapterConfirmation?: boolean
  draftMode?: 'standard' | 'detailed' | 'concise'
  patentType?: 'invention' | 'utilityModel' | 'design'
  targetWordCount?: {
    technical_field?: number
    background_art?: number
    invention_content?: number
    embodiments?: number
    drawings_description?: number
  }
}

/**
 * 说明书撰写输出
 */
export interface SpecificationDrafterOutput {
  specification: SpecificationContent
  metrics: {
    totalWordCount: number
    chapterCount: number
    terminologyConsistency: boolean
    coherenceCheck: boolean
    enablementCheck: boolean
    supportCheck: boolean
  }
  qualityScore: {
    overall: number
    clarity: number
    completeness: number
    consistency: number
  }
  confidence: number
  metadata: {
    draftMode: string
    timestamp: number
    chaptersDrafted: SpecificationChapter[]
  }
}

/**
 * 说明书撰写计划
 */
export interface SpecificationPlan {
  input: SpecificationDrafterInput
  templateContent: string
  chapters: SpecificationChapter[]
  targetWordCounts: Required<NonNullable<SpecificationDrafterInput['targetWordCount']>>
}
