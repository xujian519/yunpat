/**
 * 外部事实验证器 (ExternalFactChecker)
 *
 * 集成外部事实验证 API（如 Google Fact Check Tools）进行声明验证
 */

/**
 * Google Fact Check Tools API 响应类型
 */
export interface GoogleFactCheckResponse {
  claims?: Array<{
    text: string;
    claimant?: string[];
    claimDate?: string;
    claimReview?: Array<{
      publisher?: {
        name: string;
        site: string;
      };
      textualRating?: string;
      url: string;
      title?: string;
      reviewDate?: string;
      languageCode?: string;
    }>;
  }>;
  nextPageToken?: string;
}

/**
 * 声明评审 (Claim Review)
 */
export interface ClaimReview {
  publisher?: {
    name: string;
    site: string;
  };
  textualRating?: string;
  url: string;
  title?: string;
  reviewDate?: string;
  languageCode?: string;
}

/**
 * 外部事实验证选项
 */
export interface ExternalFactCheckOptions {
  /** 语言代码 */
  language?: string;
  /** 最大时间范围（天） */
  maxAgeDays?: number;
  /** 页面大小 */
  pageSize?: number;
  /** 请求超时（毫秒） */
  timeout?: number;
}

/**
 * 聚合事实验证结果
 */
export interface AggregatedFactCheck {
  /** 原始声明 */
  claim: string;
  /** 加权置信度 */
  confidence: number;
  /** 验证来源列表 */
  sources: string[];
  /** 共识状态 */
  consensus: 'CONSENSUS_TRUE' | 'CONSENSUS_FALSE' | 'CONSENSUS_MIXED' | 'NO_CONSENSUS';
  /** 各来源结果 */
  results: ExternalFactCheckResult[];
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 外部事实验证结果
 */
export interface ExternalFactCheckResult {
  /** 原始声明 */
  claim: string;
  /** 验证状态 */
  isValid: 'TRUE' | 'FALSE' | 'MIXED' | 'UNKNOWN';
  /** 置信度 */
  confidence: number;
  /** 来源列表 */
  sources: ExternalSource[];
  /** 验证源 */
  source: 'google_factcheck' | 'snopes' | 'knowledge_base' | 'llm';
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 外部来源
 */
export interface ExternalSource {
  name: string;
  url: string;
  rating: string;
  date?: string;
}

/**
 * 事实验证错误
 */
export class FactCheckError extends Error {
  constructor(
    message: string,
    public code?: number,
    public source?: string
  ) {
    super(message);
    this.name = 'FactCheckError';
  }
}

/**
 * 外部事实验证器配置
 */
export interface ExternalFactCheckerConfig {
  /** API 密钥 */
  apiKey?: string;
  /** 基础 URL */
  baseURL?: string;
  /** 默认超时（毫秒） */
  defaultTimeout?: number;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存 TTL（毫秒） */
  cacheTTL?: number;
  /** 速率限制（请求/秒） */
  rateLimit?: number;
}

/**
 * 缓存条目
 */
interface CacheEntry {
  result: ExternalFactCheckResult;
  timestamp: number;
}

/**
 * 外部事实验证器
 *
 * 提供与外部事实验证 API 的集成能力
 */
export class ExternalFactChecker {
  private apiKey: string;
  private baseURL: string;
  private defaultTimeout: number;
  private enableCache: boolean;
  private cacheTTL: number;
  private rateLimit: number;
  private cache: Map<string, CacheEntry>;
  private lastRequestTime: number = 0;

  constructor(config?: ExternalFactCheckerConfig) {
    this.apiKey = config?.apiKey || process.env.GOOGLE_FACT_CHECK_API_KEY || '';
    this.baseURL = config?.baseURL || 'https://factchecktools.googleapis.com/v1alpha1';
    this.defaultTimeout = config?.defaultTimeout || 10000;
    this.enableCache = config?.enableCache ?? true;
    this.cacheTTL = config?.cacheTTL || 86400000; // 24小时
    this.rateLimit = config?.rateLimit || 1; // 每秒1个请求
    this.cache = new Map();

    if (!this.apiKey) {
      console.warn('Google Fact Check API Key 未设置，外部验证功能将不可用');
    }
  }

  /**
   * 验证单个声明
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 事实验证结果
   */
  async verifyClaim(
    claim: string,
    options?: ExternalFactCheckOptions
  ): Promise<ExternalFactCheckResult> {
    if (!this.apiKey) {
      throw new FactCheckError(
        'API Key 未配置，无法使用外部验证功能',
        undefined,
        'ExternalFactChecker'
      );
    }

    // 检查缓存
    if (this.enableCache) {
      const cached = this.getFromCache(claim);
      if (cached) {
        return cached;
      }
    }

    // 应用速率限制
    await this.applyRateLimit();

    try {
      const url = `${this.baseURL}/claims:search`;
      const params = new URLSearchParams({
        key: this.apiKey,
        query: claim,
        languageCodes: options?.language || 'zh-CN',
        pageSize: String(options?.pageSize || 10),
      });

      if (options?.maxAgeDays) {
        params.append('maxAgeDays', String(options.maxAgeDays));
      }

      const response = await fetch(`${url}?${params}`, {
        signal: AbortSignal.timeout(options?.timeout || this.defaultTimeout),
      });

      if (!response.ok) {
        throw new FactCheckError(
          `API 请求失败: ${response.status} ${response.statusText}`,
          response.status,
          'Google Fact Check API'
        );
      }

      const data = (await response.json()) as GoogleFactCheckResponse;
      const result = this.parseResponse(data, claim, 'google_factcheck');

      // 写入缓存
      if (this.enableCache) {
        this.setToCache(claim, result);
      }

      return result;
    } catch (error) {
      if (error instanceof FactCheckError) {
        throw error;
      }

      throw new FactCheckError(
        `验证请求失败: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'ExternalFactChecker'
      );
    }
  }

  /**
   * 批量验证声明
   *
   * @param claims 声明列表
   * @param options 验证选项
   * @returns 事实验证结果列表
   */
  async verifyClaims(
    claims: string[],
    options?: ExternalFactCheckOptions
  ): Promise<ExternalFactCheckResult[]> {
    const results: ExternalFactCheckResult[] = [];

    for (const claim of claims) {
      try {
        const result = await this.verifyClaim(claim, options);
        results.push(result);
      } catch (error) {
        console.error(`验证声明失败: "${claim}"`, error);
        // 返回未知结果
        results.push({
          claim,
          isValid: 'UNKNOWN',
          confidence: 0,
          sources: [],
          source: 'google_factcheck',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * 解析 API 响应
   *
   * @param data API 响应数据
   * @param claim 原始声明
   * @param source 验证源
   * @returns 事实验证结果
   */
  private parseResponse(
    data: GoogleFactCheckResponse,
    claim: string,
    source: 'google_factcheck' | 'snopes' | 'knowledge_base' | 'llm'
  ): ExternalFactCheckResult {
    if (!data.claims || data.claims.length === 0) {
      return {
        claim,
        isValid: 'UNKNOWN',
        confidence: 0,
        sources: [],
        source,
        timestamp: new Date(),
      };
    }

    const bestMatch = data.claims[0];
    const reviews = bestMatch.claimReview || [];

    if (reviews.length === 0) {
      return {
        claim,
        isValid: 'UNKNOWN',
        confidence: 0.3, // 低置信度，因为找到了声明但没有评审
        sources: [],
        source,
        timestamp: new Date(),
      };
    }

    const topReview = reviews[0];

    return {
      claim,
      isValid: this.parseRating(topReview.textualRating || ''),
      confidence: this.calculateConfidence(reviews),
      sources: reviews.map(
        (r): ExternalSource => ({
          name: r.publisher?.name || 'Unknown',
          url: r.url,
          rating: r.textualRating || 'Unknown',
          date: r.reviewDate,
        })
      ),
      source,
      timestamp: new Date(),
    };
  }

  /**
   * 解析评级
   *
   * @param rating 文本评级
   * @returns 验证状态
   */
  private parseRating(rating: string): 'TRUE' | 'FALSE' | 'MIXED' | 'UNKNOWN' {
    const lower = rating.toLowerCase();

    // 虚假性相关关键词（先检查，因为有些词包含其他词的子串）
    if (
      lower.includes('false') ||
      lower.includes('inaccurate') ||
      lower.includes('incorrect') ||
      lower.includes('wrong') ||
      rating.includes('错误') ||
      rating.includes('虚假') ||
      rating.includes('不实')
    ) {
      return 'FALSE';
    }

    // 混合/部分真实（先检查，避免"部分真实"被"真实"匹配）
    if (
      lower.includes('mixed') ||
      lower.includes('partially') ||
      lower.includes('some truth') ||
      lower.includes('half true') ||
      rating.includes('部分') ||
      rating.includes('混合') ||
      rating.includes('半真')
    ) {
      return 'MIXED';
    }

    // 真实性相关关键词
    if (
      lower.includes('true') ||
      (lower.includes('accurate') && !lower.includes('inaccurate')) ||
      (lower.includes('correct') && !lower.includes('incorrect')) ||
      rating.includes('准确') ||
      rating.includes('正确') ||
      rating.includes('真实')
    ) {
      return 'TRUE';
    }

    return 'UNKNOWN';
  }

  /**
   * 计算置信度
   *
   * @param reviews 评审列表
   * @returns 置信度分数
   */
  private calculateConfidence(reviews: ClaimReview[]): number {
    if (reviews.length === 0) return 0;

    // 基于评审数量和一致性计算置信度
    const topRating = reviews[0].textualRating || '';
    const agreementCount = reviews.filter((r) => r.textualRating === topRating).length;

    const baseConfidence = agreementCount / reviews.length;
    const sourceBoost = Math.min(reviews.length * 0.1, 0.3); // 最多增加 0.3

    return Math.min(baseConfidence + sourceBoost, 1);
  }

  /**
   * 应用速率限制
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.rateLimit;

    if (timeSinceLastRequest < minInterval) {
      await new Promise((resolve) => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 生成缓存键
   *
   * @param claim 声明
   * @returns 缓存键
   */
  private generateCacheKey(claim: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < claim.length; i++) {
      const char = claim.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return `factcheck:${Math.abs(hash)}`;
  }

  /**
   * 从缓存获取
   *
   * @param claim 声明
   * @returns 缓存结果或 undefined
   */
  private getFromCache(claim: string): ExternalFactCheckResult | undefined {
    const key = this.generateCacheKey(claim);
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  /**
   * 设置缓存
   *
   * @param claim 声明
   * @param result 验证结果
   */
  private setToCache(claim: string, result: ExternalFactCheckResult): void {
    const key = this.generateCacheKey(claim);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   *
   * @returns 缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * 验证源权重配置
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  google_factcheck: 0.9,
  knowledge_base: 0.8,
  llm: 0.6,
  snopes: 0.85,
};

/**
 * 获取验证源权重
 *
 * @param source 验证源
 * @returns 权重值
 */
export function getSourceWeight(source: string): number {
  return SOURCE_WEIGHTS[source] || 0.5;
}

/**
 * 计算共识状态
 *
 * @param results 验证结果列表
 * @returns 共识状态
 */
export function calculateConsensus(
  results: ExternalFactCheckResult[]
): 'CONSENSUS_TRUE' | 'CONSENSUS_FALSE' | 'CONSENSUS_MIXED' | 'NO_CONSENSUS' {
  if (results.length === 0) {
    return 'NO_CONSENSUS';
  }

  const trueCount = results.filter((r) => r.isValid === 'TRUE').length;
  const falseCount = results.filter((r) => r.isValid === 'FALSE').length;
  const mixedCount = results.filter((r) => r.isValid === 'MIXED').length;
  const unknownCount = results.filter((r) => r.isValid === 'UNKNOWN').length;

  const total = results.length;
  const threshold = 0.6; // 60% 以上形成共识

  if (trueCount / total >= threshold) {
    return 'CONSENSUS_TRUE';
  }
  if (falseCount / total >= threshold) {
    return 'CONSENSUS_FALSE';
  }
  if (mixedCount / total >= threshold) {
    return 'CONSENSUS_MIXED';
  }
  if (unknownCount / total >= threshold) {
    return 'NO_CONSENSUS';
  }

  // 没有明显共识
  return 'NO_CONSENSUS';
}

/**
 * 聚合多个验证结果
 *
 * @param results 验证结果列表
 * @returns 聚合结果
 */
export function aggregateResults(results: ExternalFactCheckResult[]): AggregatedFactCheck {
  if (results.length === 0) {
    throw new FactCheckError('无法聚合空的结果列表');
  }

  const claim = results[0].claim;

  // 计算加权置信度
  const weightedScore =
    results.reduce((acc, result) => {
      const weight = getSourceWeight(result.source);
      return acc + result.confidence * weight;
    }, 0) / results.length;

  // 聚合来源
  const sources = results.map((r) => r.source);

  // 计算共识
  const consensus = calculateConsensus(results);

  return {
    claim,
    confidence: Math.min(weightedScore, 1),
    sources,
    consensus,
    results,
    timestamp: new Date(),
  };
}
