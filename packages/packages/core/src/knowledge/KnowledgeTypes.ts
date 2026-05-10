/**
 * 知识库类型定义
 */

/**
 * 知识条目类型
 */
export enum KnowledgeEntryType {
  DOCUMENT = 'document',
  EXAMPLE = 'example',
  BEST_PRACTICE = 'best_practice',
  ERROR_SOLUTION = 'error_solution',
  DOMAIN_KNOWLEDGE = 'domain_knowledge',
  PATTERN = 'pattern',
}

/**
 * 知识条目
 */
export interface KnowledgeEntry {
  id: string
  type: KnowledgeEntryType
  title: string
  content: string
  tags: string[]
  category: string
  priority: number
  createdAt: Date
  updatedAt: Date
  version: number
  metadata?: Record<string, unknown>
  embedding?: number[]
  referenceCount: number
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  mode: 'keyword' | 'semantic' | 'hybrid'
  limit?: number
  minSimilarity?: number
  categories?: string[]
  types?: KnowledgeEntryType[]
  tags?: string[]
  keywordWeight?: number
  semanticWeight?: number
}

/**
 * 搜索结果
 */
export interface SearchResult {
  entry: KnowledgeEntry
  score: number
  matchReason: {
    keywordScore: number
    semanticScore: number
    tagMatches: string[]
  }
}

/**
 * 知识注入结果
 */
export interface KnowledgeInjectionResult {
  enhancedPrompt: string
  injectedEntries: KnowledgeEntry[]
  injectedCategories: string[]
}

/**
 * 知识库统计
 */
export interface KnowledgeStats {
  totalEntries: number
  byType: Record<KnowledgeEntryType, number>
  byCategory: Record<string, number>
  totalReferences: number
  averageReferences: number
}

/**
 * 知识库配置
 */
export interface KnowledgeBaseConfig {
  name: string
  description?: string
  storagePath?: string
  persistent?: boolean
  loadBuiltin?: boolean
  embedFn?: (text: string) => Promise<number[]>
  defaultSearchOptions?: Partial<SearchOptions>
}

/**
 * 预定义的知识库名称
 */
export const BUILTIN_KNOWLEDGE_BASES = {
  WRITING_BEST_PRACTICES: 'writing-best-practices',
  CODE_PATTERNS: 'code-patterns',
  DOMAIN_KNOWLEDGE: 'domain-knowledge',
  ERROR_SOLUTIONS: 'error-solutions',
} as const
