/**
 * 语义缓存系统
 *
 * 核心功能：
 * 1. 生成任务签名（语义指纹）
 * 2. 查找相似任务
 * 3. 存储和检索响应
 * 4. 缓存统计
 *
 * 预期效果：
 * - 重复任务成本降低 90%+
 * - 相似任务成本降低 50%+
 * - 响应速度提升 10倍
 */

/**
 * 任务签名（语义指纹）
 */
export interface TaskSignature {
  /** 嵌入向量 */
  embedding: number[];
  /** 任务类型的哈希值 */
  typeHash: number;
  /** 关键特征哈希 */
  featureHash: number;
}

/**
 * 缓存的响应
 */
export interface CachedResponse<TTask, TResult> {
  /** 任务 */
  task: TTask;
  /** 任务签名 */
  signature: TaskSignature;
  /** 响应结果 */
  response: TResult;
  /** 存储时间戳 */
  timestamp: Date;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessed: Date;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 命中率（百分比） */
  hitRate: string;
  /** 总请求数 */
  totalRequests: number;
  /** 缓存命中数 */
  cacheHits: number;
  /** 缓存未命中数 */
  cacheMisses: number;
  /** 当前缓存条目数 */
  size: number;
  /** 平均相似度分数 */
  averageSimilarity: number;
}

/**
 * 语义缓存配置
 */
export interface SemanticCacheConfig<TTask, TResult> {
  /** 相似度阈值（默认 0.85） */
  similarityThreshold?: number;
  /** 最大缓存条目数（默认 1000） */
  maxCacheSize?: number;
  /** 缓存过期时间（毫秒，默认 7 天） */
  cacheExpiration?: number;
  /** 生成任务签名的函数 */
  generateSignature: (task: TTask) => Promise<TaskSignature>;
  /** 可选：轻量级改写函数 */
  lightweightRewrite?: (cachedResponse: TResult, newTask: TTask) => Promise<TResult>;
}

/**
 * 语义缓存类
 *
 * 泛型参数：
 * - TTask: 任务类型
 * - TResult: 响应结果类型
 */
export class SemanticCache<TTask, TResult> {
  private cache: Map<string, CachedResponse<TTask, TResult>> = new Map();
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    similaritySum: 0,
  };
  private config: {
    similarityThreshold: number;
    maxCacheSize: number;
    cacheExpiration: number;
    generateSignature: (task: TTask) => Promise<TaskSignature>;
    lightweightRewrite?: (cachedResponse: TResult, newTask: TTask) => Promise<TResult>;
  };

  constructor(config: SemanticCacheConfig<TTask, TResult>) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.85,
      maxCacheSize: config.maxCacheSize ?? 1000,
      cacheExpiration: config.cacheExpiration ?? 7 * 24 * 60 * 60 * 1000, // 7 天
      generateSignature: config.generateSignature,
      lightweightRewrite: config.lightweightRewrite,
    };
  }

  /**
   * 查找相似任务
   * @param task 要查找的任务
   * @param threshold 相似度阈值（可选，默认使用配置值）
   * @returns 缓存的响应或 null
   */
  async findSimilar(
    task: TTask,
    threshold?: number
  ): Promise<CachedResponse<TTask, TResult> | null> {
    this.stats.totalRequests++;

    const similarityThreshold = threshold ?? this.config.similarityThreshold;
    const signature = await this.config.generateSignature(task);

    let bestMatch: CachedResponse<TTask, TResult> | null = null;
    let bestSimilarity = 0;

    // 遍历缓存查找最相似的项
    for (const [key, cached] of this.cache.entries()) {
      // 检查是否过期
      if (this.isExpired(cached)) {
        this.cache.delete(key);
        continue;
      }

      const similarity = this.cosineSimilarity(signature.embedding, cached.signature.embedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = cached;
      }
    }

    // 如果找到相似的任务
    if (bestMatch && bestSimilarity >= similarityThreshold) {
      this.stats.cacheHits++;
      this.stats.similaritySum += bestSimilarity;

      // 更新访问统计
      bestMatch.accessCount++;
      bestMatch.lastAccessed = new Date();

      // 如果配置了轻量级改写函数，使用它来调整缓存的响应
      if (this.config.lightweightRewrite) {
        try {
          bestMatch.response = await this.config.lightweightRewrite(bestMatch.response, task);
        } catch (error) {
          console.warn('轻量级改写失败，使用原始缓存响应:', error);
        }
      }

      return bestMatch;
    }

    // 未找到相似任务
    this.stats.cacheMisses++;
    return null;
  }

  /**
   * 存储响应到缓存
   * @param task 任务
   * @param response 响应结果
   */
  async store(task: TTask, response: TResult): Promise<void> {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest();
    }

    const signature = await this.config.generateSignature(task);
    const cacheKey = this.generateCacheKey(signature);

    const cachedResponse: CachedResponse<TTask, TResult> = {
      task,
      signature,
      response,
      timestamp: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
    };

    this.cache.set(cacheKey, cachedResponse);
  }

  /**
   * 直接获取缓存（精确匹配）
   * @param task 任务
   * @returns 响应结果或 null
   */
  async get(task: TTask): Promise<TResult | null> {
    const signature = await this.config.generateSignature(task);
    const cacheKey = this.generateCacheKey(signature);

    const cached = this.cache.get(cacheKey);

    if (cached) {
      // 检查是否过期
      if (this.isExpired(cached)) {
        this.cache.delete(cacheKey);
        return null;
      }

      // 更新访问统计
      cached.accessCount++;
      cached.lastAccessed = new Date();

      return cached.response;
    }

    return null;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    // 重置统计
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      similaritySum: 0,
    };
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.totalRequests;
    const hits = this.stats.cacheHits;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : '0.00';
    const avgSimilarity = hits > 0 ? this.stats.similaritySum / hits : 0;

    return {
      hitRate,
      totalRequests: total,
      cacheHits: hits,
      cacheMisses: this.stats.cacheMisses,
      size: this.cache.size,
      averageSimilarity: Number(avgSimilarity.toFixed(4)),
    };
  }

  /**
   * 余弦相似度计算
   * @param vecA 向量 A
   * @param vecB 向量 B
   * @returns 相似度分数（0-1）
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('向量长度不匹配');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * 生成缓存键
   * @param signature 任务签名
   * @returns 缓存键
   */
  private generateCacheKey(signature: TaskSignature): string {
    // 使用类型哈希和特征哈希的组合作为键
    return `${signature.typeHash}-${signature.featureHash}`;
  }

  /**
   * 检查缓存条目是否过期
   * @param cached 缓存的响应
   * @returns 是否过期
   */
  private isExpired(cached: CachedResponse<TTask, TResult>): boolean {
    const now = Date.now();
    const age = now - cached.timestamp.getTime();
    return age > this.config.cacheExpiration;
  }

  /**
   * 驱逐最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      if (cached.timestamp.getTime() < oldestTimestamp) {
        oldestTimestamp = cached.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 删除特定缓存条目
   * @param task 要删除的任务
   */
  async delete(task: TTask): Promise<boolean> {
    const signature = await this.config.generateSignature(task);
    const cacheKey = this.generateCacheKey(signature);
    return this.cache.delete(cacheKey);
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期条目
   */
  async cleanup(): Promise<number> {
    let cleaned = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (this.isExpired(cached)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * 创建简单的任务签名生成器
 * 基于任务的关键字段生成嵌入向量
 *
 * 注意：这是一个简化实现，生产环境建议使用真实的嵌入模型
 */
export function createSimpleSignatureGenerator<TTask>(
  extractFeatures: (task: TTask) => string[]
): (task: TTask) => Promise<TaskSignature> {
  return async (task: TTask) => {
    const features = extractFeatures(task);

    // 简单哈希函数
    const simpleHash = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转换为 32 位整数
      }
      return Math.abs(hash);
    };

    // 生成简单的嵌入向量（基于特征）
    const embeddingSize = 64;
    const embedding: number[] = new Array(embeddingSize).fill(0);

    features.forEach((feature) => {
      const hash = simpleHash(feature);
      for (let i = 0; i < embeddingSize; i++) {
        // 使用哈希值的不同位来生成向量
        const bit = (hash >> i) & 1;
        embedding[i] += bit ? 1 : -1;
      }
    });

    // 归一化向量
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embeddingSize; i++) {
        embedding[i] /= norm;
      }
    }

    // 生成类型哈希
    const typeHash = simpleHash(JSON.stringify(features.slice(0, 3)));

    // 生成特征哈希
    const featureHash = simpleHash(features.join('|'));

    return {
      embedding,
      typeHash,
      featureHash,
    };
  };
}

/**
 * 创建基于嵌入模型的签名生成器
 *
 * 使用真实的嵌入模型（如 Jina AI、OpenAI embeddings）生成语义向量
 */
export function createEmbeddingBasedSignatureGenerator<TTask>(
  embedFn: (text: string) => Promise<number[]>,
  extractText: (task: TTask) => string
): (task: TTask) => Promise<TaskSignature> {
  return async (task: TTask) => {
    const text = extractText(task);
    const embedding = await embedFn(text);

    // 简单哈希函数
    const simpleHash = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    return {
      embedding,
      typeHash: simpleHash(text.slice(0, 100)),
      featureHash: simpleHash(text),
    };
  };
}

/**
 * 创建语义缓存实例的便捷函数
 */
export function createSemanticCache<TTask, TResult>(
  config: SemanticCacheConfig<TTask, TResult>
): SemanticCache<TTask, TResult> {
  return new SemanticCache(config);
}
