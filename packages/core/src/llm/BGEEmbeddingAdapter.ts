/**
 * BGE-M3 嵌入模型适配器
 *
 * 本地 BGE-M3 模型，用于文本向量化
 * 向量维度: 1024
 * 特点: 多语言支持（中英文）
 */

import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js';

/**
 * BGE-M3 配置
 */
export interface BGEConfig {
  /** API 基础 URL */
  baseURL: string;

  /** API 密钥 */
  apiKey: string;

  /** 批处理大小 */
  batchSize?: number;

  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 嵌入结果
 */
export interface EmbeddingResult {
  /** 文本 */
  text: string;

  /** 向量 (1024 维) */
  embedding: number[];

  /** 索引 */
  index: number;
}

/**
 * BGE-M3 嵌入适配器
 */
export class BGEEmbeddingAdapter {
  private config: Required<BGEConfig>;

  constructor(config: BGEConfig) {
    this.config = {
      ...config,
      batchSize: config.batchSize || 32,
      timeout: config.timeout || 60000,
    };
  }

  /**
   * 生成嵌入向量
   *
   * @param texts 文本列表
   * @returns 嵌入向量列表
   */
  async embed(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseURL}/embeddings`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'bge-m3-mlx-8bit',
          input: texts,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`BGE-M3 API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // 提取向量（按索引排序）
      const embeddings = data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);

      return embeddings;
    } catch (error) {
      throw new Error(`BGE-M3 嵌入失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成单个嵌入向量
   *
   * @param text 单个文本
   * @returns 嵌入向量 (1024 维)
   */
  async embedOne(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }

  /**
   * 批量生成嵌入向量（自动分批）
   *
   * @param texts 文本列表
   * @returns 嵌入向量列表
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await this.embed(batch);
      embeddings.push(...batchEmbeddings);

      console.log(`✅ 已处理 ${Math.min(i + batchSize, texts.length)}/${texts.length} 个文本`);
    }

    return embeddings;
  }

  /**
   * 计算余弦相似度
   *
   * @param vec1 向量 1
   * @param vec2 向量 2
   * @returns 相似度 (0-1)
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 查找最相似的文本
   *
   * @param query 查询文本
   * @param candidates 候选文本列表
   * @param topK 返回前 K 个结果
   * @returns 相似文本列表
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    // 生成查询向量
    const queryEmbedding = await this.embedOne(query);

    // 生成候选向量
    const candidateEmbeddings = await this.embedBatch(candidates);

    // 计算相似度
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      text: candidates[index],
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
      index,
    }));

    // 排序并返回 Top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }

  /**
   * 获取向量维度
   */
  getDimension(): number {
    return 1024; // BGE-M3 固定 1024 维
  }
}

/**
 * 快速创建 BGE-M3 适配器
 */
export function createBGEEmbedding(apiKey?: string): BGEEmbeddingAdapter {
  return new BGEEmbeddingAdapter({
    baseURL: 'http://localhost:8009/v1',
    apiKey: apiKey || process.env.OMXL_API_KEY || '',
    batchSize: 32,
    timeout: 60000,
  });
}

/**
 * 兼容 LLMAdapter 接口的包装类
 */
export class BGEEmbeddingLLMWrapper implements ILLMAdapter {
  private bge: BGEEmbeddingAdapter;

  constructor(apiKey?: string) {
    this.bge = createBGEEmbedding(apiKey);
  }

  async chat(): Promise<never> {
    throw new Error('BGE-M3 不支持聊天功能');
  }

  async *chatStream(): AsyncIterable<ChatChunk> {
    // BGE-M3 不支持流式聊天，返回空结果
    return;
    yield { delta: '', done: true };
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.bge.embed(texts);
  }
}
