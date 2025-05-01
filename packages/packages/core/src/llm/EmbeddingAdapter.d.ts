/**
 * 嵌入向量适配器
 *
 * 支持通过 OpenAI 兼容的 /embeddings 端点生成向量
 * 默认使用 BGE-M3 模型 (localhost:8009)
 */
import {
  BaseEmbeddingProvider,
  EmbeddingParams,
  EmbeddingResult,
  SingleEmbeddingResult,
  EmbeddingCapabilities,
} from './EmbeddingProvider.js'
/**
 * OpenAI 兼容嵌入配置
 */
export interface OpenAIEmbeddingConfig {
  /** API 基础 URL */
  baseURL: string
  /** 模型名称 */
  model?: string
  /** API 密钥（可选） */
  apiKey?: string
  /** 超时时间（毫秒） */
  timeout?: number
  /** 单次请求最大文本数 */
  batchSize?: number
  /** 是否自动归一化 */
  normalize?: boolean
}
/**
 * OpenAI 兼容嵌入适配器
 *
 * 支持 BGE-M3、M3E 等兼容 OpenAI /embeddings 端点的模型
 */
export declare class EmbeddingAdapter extends BaseEmbeddingProvider {
  private config
  private capabilities
  constructor(config: OpenAIEmbeddingConfig)
  /**
   * 批量嵌入
   */
  embed(params: EmbeddingParams): Promise<EmbeddingResult>
  /**
   * 嵌入单个文本
   */
  embedSingle(text: string, normalize?: boolean): Promise<SingleEmbeddingResult>
  /**
   * 获取能力元数据
   */
  getCapabilities(): EmbeddingCapabilities
  /**
   * 获取模型名称
   */
  getModel(): string
  /**
   * 调用 API 嵌入一批文本
   */
  private embedBatch
  /**
   * 更新能力配置
   *
   * 用于不同模型的能力设置
   */
  setCapabilities(capabilities: Partial<EmbeddingCapabilities>): void
}
/**
 * 创建 BGE-M3 嵌入适配器
 *
 * BGE-M3: 1024 维，支持多语言
 */
export declare function createBGEEmbedding(baseURL?: string, apiKey?: string): EmbeddingAdapter
/**
 * 创建 M3E-base 嵌入适配器
 *
 * M3E-base: 768 维，中文优化
 */
export declare function createM3EEmbedding(baseURL?: string, apiKey?: string): EmbeddingAdapter
//# sourceMappingURL=EmbeddingAdapter.d.ts.map
