/**
 * 嵌入向量适配器
 *
 * 支持通过 OpenAI 兼容的 /embeddings 端点生成向量
 * 默认使用 BGE-M3 模型 (localhost:8009)
 */

export interface EmbeddingConfig {
  /** API 基础 URL */
  baseURL: string;
  /** 模型名称 */
  model?: string;
  /** API 密钥（可选） */
  apiKey?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 单次请求最大文本数 */
  batchSize?: number;
}

export interface EmbeddingResponse {
  /** 嵌入向量 */
  embeddings: number[][];
  /** 使用的 token 数 */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_CONFIG = {
  model: 'bge-m3-mlx-8bit',
  timeout: 30000,
  batchSize: 32,
};

export class EmbeddingAdapter {
  private config: Required<Pick<EmbeddingConfig, 'baseURL' | 'model' | 'timeout' | 'batchSize'>> & {
    apiKey?: string;
  };

  constructor(config: EmbeddingConfig) {
    this.config = {
      baseURL: config.baseURL,
      model: config.model ?? DEFAULT_CONFIG.model,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      batchSize: config.batchSize ?? DEFAULT_CONFIG.batchSize,
      apiKey: config.apiKey,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // 分批处理，避免内存过高
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchResult = await this.embedBatch(batch);
      results.push(...batchResult);
    }
    return results;
  }

  async embedSingle(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseURL}/embeddings`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Embedding API 请求失败: ${response.status} ${text}`);
    }

    const data: any = await response.json();

    // OpenAI 兼容格式: data.data[].embedding
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Embedding API 返回格式异常');
    }

    // 按 index 排序确保顺序正确
    const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
    return sorted.map((item: any) => item.embedding);
  }
}

export function createBGEEmbedding(baseURL?: string, apiKey?: string): EmbeddingAdapter {
  return new EmbeddingAdapter({
    baseURL: baseURL ?? 'http://localhost:8009/v1',
    model: 'bge-m3-mlx-8bit',
    apiKey,
  });
}
