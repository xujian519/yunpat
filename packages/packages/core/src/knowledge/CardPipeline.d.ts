/**
 * 知识卡片批量生成管线
 *
 * 从 Obsidian 知识库批量生成、向量化、存储知识卡片
 * 支持分批处理，控制内存使用
 */
import type { LLMAdapter } from '../lifecycle/Lifecycle.js'
import type { EmbeddingAdapter } from '../llm/EmbeddingAdapter.js'
import type { PipelineConfig, PipelineResult } from './KnowledgeCard.js'
import { CardRetriever } from './CardRetriever.js'
export declare class CardPipeline {
  private generator
  private retriever
  private embedder?
  private knowledgeBasePath
  constructor(config: { llm: LLMAdapter; knowledgeBasePath: string; embedder?: EmbeddingAdapter })
  getRetriever(): CardRetriever
  run(config: PipelineConfig): Promise<PipelineResult>
  private loadConcepts
  private parseConceptIndex
  private parseConceptHierarchy
  /**
   * 扫描知识库目录，查找文件名包含概念关键词的文件
   */
  private scanRelatedFiles
  private scanDir
  private loadPages
  private persistCards
  loadPersistedCards(): Promise<number>
}
//# sourceMappingURL=CardPipeline.d.ts.map
