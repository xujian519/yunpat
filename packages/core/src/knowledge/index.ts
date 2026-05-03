/**
 * 知识库系统导出
 *
 * 提供领域知识库、语义检索和知识注入功能
 */

export {
  KnowledgeBase,
  createKnowledgeBase,
  BUILTIN_KNOWLEDGE_BASES,
  type KnowledgeEntry,
  type SearchOptions,
  type SearchResult,
  type KnowledgeInjectionResult,
  type KnowledgeStats,
  type KnowledgeBaseConfig,
} from './KnowledgeBase.js'

export { KnowledgeEntryType } from './KnowledgeBase.js'

export {
  KnowledgeCardSchema,
  generateCardId,
  cardToMarkdown,
  markdownToCard,
  type KnowledgeCard,
  type CardSearchOptions,
  type CardSearchResult,
  type PipelineConfig,
  type PipelineProgress,
  type PipelineResult,
} from './KnowledgeCard.js'

export { CardGenerator, type CardGeneratorConfig } from './CardGenerator.js'

export { CardRetriever } from './CardRetriever.js'

export { CardPipeline } from './CardPipeline.js'
