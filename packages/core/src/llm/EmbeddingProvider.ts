/**
 * 嵌入向量提供者统一接口
 *
 * 定义所有嵌入模型必须实现的标准接口
 */

/**
 * 嵌入配置
 */
export interface EmbeddingParams {
  /** 要嵌入的文本列表 */
  texts: string[];
  /** 是否归一化向量（默认 true） */
  normalize?: boolean;
  /** 批次大小（可选，用于性能优化） */
  batchSize?: number;
}

/**
 * 嵌入结果
 */
export interface EmbeddingResult {
  /** 嵌入向量列表，与输入文本一一对应 */
  embeddings: number[][];
  /** 使用的 token 数（如果提供） */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
  /** 模型信息 */
  model?: string;
  /** 向量维度 */
  dimension: number;
}

/**
 * 单个文本嵌入结果
 */
export interface SingleEmbeddingResult {
  /** 嵌入向量 */
  embedding: number[];
  /** 使用的 token 数（如果提供） */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
  /** 模型信息 */
  model?: string;
}

/**
 * 嵌入能力元数据
 */
export interface EmbeddingCapabilities {
  /** 支持的向量维度 */
  dimension: number;
  /** 支持的最大文本长度（tokens） */
  maxTokens: number;
  /** 支持的批量大小 */
  maxBatchSize: number;
  /** 是否支持归一化 */
  supportsNormalization: boolean;
}

/**
 * 嵌入提供者接口
 *
 * 所有嵌入模型必须实现此接口
 */
export interface EmbeddingProvider {
  /**
   * 批量嵌入文本
   *
   * @param params 嵌入参数
   * @returns 嵌入结果
   */
  embed(params: EmbeddingParams): Promise<EmbeddingResult>;

  /**
   * 嵌入单个文本
   *
   * @param text 要嵌入的文本
   * @param normalize 是否归一化（默认 true）
   * @returns 嵌入向量
   */
  embedSingle(text: string, normalize?: boolean): Promise<SingleEmbeddingResult>;

  /**
   * 获取嵌入能力元数据
   */
  getCapabilities(): EmbeddingCapabilities;

  /**
   * 获取模型名称
   */
  getModel(): string;

  /**
   * 计算余弦相似度
   *
   * @param vec1 向量1
   * @param vec2 向量2
   * @returns 相似度（0-1，1表示完全相同）
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number;

  /**
   * L2 归一化向量
   *
   * @param vec 要归一化的向量
   * @returns 归一化后的向量
   */
  normalize(vec: number[]): number[];
}

/**
 * 基础嵌入提供者抽象类
 *
 * 提供通用的工具方法实现
 */
export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract embed(params: EmbeddingParams): Promise<EmbeddingResult>;
  abstract embedSingle(text: string, normalize?: boolean): Promise<SingleEmbeddingResult>;
  abstract getCapabilities(): EmbeddingCapabilities;
  abstract getModel(): string;

  /**
   * 计算余弦相似度
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

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * L2 归一化向量
   */
  normalize(vec: number[]): number[] {
    let norm = 0;
    for (const val of vec) {
      norm += val * val;
    }

    norm = Math.sqrt(norm);
    if (norm === 0) {
      return vec; // 零向量无法归一化，返回原向量
    }

    return vec.map((val) => val / norm);
  }

  /**
   * 验证嵌入向量维度
   */
  protected validateDimension(embedding: number[], expectedDim: number): void {
    if (embedding.length !== expectedDim) {
      throw new Error(`嵌入向量维度不匹配: 期望 ${expectedDim}, 实际 ${embedding.length}`);
    }
  }

  /**
   * 验证输入文本
   */
  protected validateInput(texts: string[]): void {
    if (!Array.isArray(texts)) {
      throw new Error('输入必须是字符串数组');
    }

    for (let i = 0; i < texts.length; i++) {
      if (typeof texts[i] !== 'string') {
        throw new Error(`输入[${i}] 不是字符串: ${typeof texts[i]}`);
      }
    }
  }

  /**
   * 批量处理辅助方法
   */
  protected async processBatch<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }

    return results;
  }
}

/**
 * 嵌入缓存键生成器
 */
export class EmbeddingCacheKeyGenerator {
  /**
   * 生成缓存键
   *
   * @param model 模型名称
   * @param text 文本内容
   * @param normalize 是否归一化
   * @returns 缓存键
   */
  static generate(model: string, text: string, normalize: boolean): string {
    // 使用简单的哈希算法生成缓存键
    const normalized = normalize ? '1' : '0';
    const textHash = this.simpleHash(text);
    return `${model}:${normalized}:${textHash}`;
  }

  /**
   * 简单哈希函数（用于缓存键）
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * 嵌入错误类型
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: string
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * 常见错误代码
 */
export enum EmbeddingErrorCode {
  /** API 请求失败 */
  API_ERROR = 'API_ERROR',
  /** 输入验证失败 */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** 向量维度不匹配 */
  DIMENSION_MISMATCH = 'DIMENSION_MISMATCH',
  /** 批次大小超限 */
  BATCH_SIZE_EXCEEDED = 'BATCH_SIZE_EXCEEDED',
  /** 文本长度超限 */
  TEXT_TOO_LONG = 'TEXT_TOO_LONG',
  /** 模型不可用 */
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  /** 认证失败 */
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  /** 速率限制 */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}
