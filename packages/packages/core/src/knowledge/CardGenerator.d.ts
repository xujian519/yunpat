/**
 * 知识卡片生成器
 *
 * 从 Obsidian Wiki 页面生成结构化的知识卡片
 * 使用 LLM 提取核心问题并生成高质量回答
 */
import type { LLMAdapter } from '../lifecycle/Lifecycle.js'
import type { KnowledgeCard } from './KnowledgeCard.js'
export interface CardGeneratorConfig {
  /** LLM 适配器 */
  llm: LLMAdapter
  /** 质量阈值 */
  qualityThreshold?: number
  /** 每个页面最大生成卡片数 */
  maxCardsPerPage?: number
}
export declare class CardGenerator {
  private llm
  private qualityThreshold
  private maxCardsPerPage
  constructor(config: CardGeneratorConfig)
  generateFromPage(
    pagePath: string,
    pageContent: string,
    pageTitle: string,
    concept: string,
    domain: string
  ): Promise<KnowledgeCard[]>
  generateFromConcept(
    concept: string,
    domain: string,
    pages: Array<{
      path: string
      content: string
      title: string
    }>
  ): Promise<KnowledgeCard[]>
  assessQuality(card: KnowledgeCard): Promise<{
    quality: number
    issues: string[]
  }>
  private parseGenerationResponse
  private extractJSON
  private deduplicate
}
//# sourceMappingURL=CardGenerator.d.ts.map
