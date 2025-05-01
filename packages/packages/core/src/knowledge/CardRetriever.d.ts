/**
 * 知识卡片检索器
 *
 * 多维度检索：关键词、语义（向量）、概念导航、关联探索
 */
import type { KnowledgeCard, CardSearchOptions, CardSearchResult } from './KnowledgeCard.js'
import type { EmbeddingAdapter } from '../llm/EmbeddingAdapter.js'
export declare class CardRetriever {
  private cards
  private conceptIndex
  private domainIndex
  private tagIndex
  private embedder?
  constructor(embedder?: EmbeddingAdapter)
  loadCards(cards: KnowledgeCard[]): void
  addCard(card: KnowledgeCard): void
  removeCard(cardId: string): void
  getCard(cardId: string): KnowledgeCard | undefined
  search(query: string, options?: CardSearchOptions): Promise<CardSearchResult[]>
  getByConcept(concept: string): KnowledgeCard[]
  getByDomain(domain: string): KnowledgeCard[]
  explore(cardId: string, depth?: number): KnowledgeCard[]
  injectContext(
    prompt: string,
    maxCards?: number
  ): Promise<{
    enhancedPrompt: string
    injectedCards: KnowledgeCard[]
  }>
  getStats(): {
    totalCards: number
    byDomain: Record<string, number>
    byConcept: Record<string, number>
    withEmbedding: number
    avgQuality: number
  }
  private scoreCard
  private getCandidates
  private updateIndex
  private removeFromIndex
  private extractKeywords
  private cosineSimilarity
  private textSimilarity
}
//# sourceMappingURL=CardRetriever.d.ts.map
