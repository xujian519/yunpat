/**
 * Google Fact Check Tools API 提供者
 *
 * 专门处理与 Google Fact Check Tools API 的交互
 */

import type {
  GoogleFactCheckResponse,
  ClaimReview,
  ExternalFactCheckOptions,
  ExternalFactCheckResult,
  ExternalSource,
} from '../ExternalFactChecker.js';
import { FactCheckError } from '../ExternalFactChecker.js';

/**
 * Google Fact Check API 配置
 */
export interface GoogleFactCheckAPIConfig {
  /** API 密钥 */
  apiKey?: string;
  /** API 基础 URL */
  baseURL?: string;
  /** 默认语言代码 */
  defaultLanguage?: string;
  /** 默认页面大小 */
  defaultPageSize?: number;
  /** 请求超时（毫秒） */
  timeout?: number;
}

/**
 * Google Fact Check API 响应元数据
 */
export interface GoogleFactCheckMetadata {
  /** 下一页令牌 */
  nextPageToken?: string;
  /** 总结果数 */
  totalResults?: number;
  /** 搜索查询 */
  query?: string;
  /** 语言代码 */
  languageCode?: string;
}

/**
 * 声明详情
 */
export interface ClaimDetail {
  /** 声明文本 */
  text: string;
  /** 声明者 */
  claimant?: string[];
  /** 声明日期 */
  claimDate?: string;
  /** 评审列表 */
  reviews: ClaimReview[];
}

/**
 * Google Fact Check Tools API 客户端
 *
 * 提供与 Google Fact Check Tools API 的完整集成
 */
export class GoogleFactCheckAPI {
  private apiKey: string;
  private baseURL: string;
  private defaultLanguage: string;
  private defaultPageSize: number;
  private timeout: number;

  constructor(config?: GoogleFactCheckAPIConfig) {
    this.apiKey = config?.apiKey || process.env.GOOGLE_FACT_CHECK_API_KEY || '';
    this.baseURL = config?.baseURL || 'https://factchecktools.googleapis.com/v1alpha1';
    this.defaultLanguage = config?.defaultLanguage || 'zh-CN';
    this.defaultPageSize = config?.defaultPageSize || 10;
    this.timeout = config?.timeout || 10000;

    if (!this.apiKey) {
      console.warn('Google Fact Check API Key 未配置');
    }
  }

  /**
   * 搜索声明
   *
   * @param query 搜索查询
   * @param options 搜索选项
   * @returns API 响应和元数据
   */
  async searchClaims(
    query: string,
    options?: ExternalFactCheckOptions & {
      /** 页面令牌（用于分页） */
      pageToken?: string;
    }
  ): Promise<{
    claims: ClaimDetail[];
    metadata: GoogleFactCheckMetadata;
  }> {
    if (!this.apiKey) {
      throw new FactCheckError('API Key 未配置', undefined, 'GoogleFactCheckAPI');
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        query: query.trim(),
        languageCodes: options?.language || this.defaultLanguage,
        pageSize: String(options?.pageSize || this.defaultPageSize),
      });

      if (options?.maxAgeDays) {
        params.append('maxAgeDays', String(options.maxAgeDays));
      }

      if (options?.pageToken) {
        params.append('pageToken', options.pageToken);
      }

      const url = `${this.baseURL}/claims:search?${params}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(options?.timeout || this.timeout),
      });

      if (!response.ok) {
        let errorMessage = `API 请求失败: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage += ` - ${errorData.error?.message || response.statusText}`;
        } catch {
          errorMessage += ` - ${response.statusText}`;
        }
        throw new FactCheckError(errorMessage, response.status, 'GoogleFactCheckAPI');
      }

      const data: GoogleFactCheckResponse = await response.json();

      const claims: ClaimDetail[] = (data.claims || []).map((claim) => ({
        text: claim.text,
        claimant: claim.claimant,
        claimDate: claim.claimDate,
        reviews: claim.claimReview || [],
      }));

      const metadata: GoogleFactCheckMetadata = {
        nextPageToken: data.nextPageToken,
        totalResults: claims.length,
        query,
        languageCode: options?.language || this.defaultLanguage,
      };

      return { claims, metadata };
    } catch (error) {
      if (error instanceof FactCheckError) {
        throw error;
      }

      throw new FactCheckError(
        `搜索声明失败: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'GoogleFactCheckAPI'
      );
    }
  }

  /**
   * 验证单个声明
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 验证结果
   */
  async verifyClaim(
    claim: string,
    options?: ExternalFactCheckOptions
  ): Promise<ExternalFactCheckResult> {
    const { claims } = await this.searchClaims(claim, options);

    if (claims.length === 0) {
      return {
        claim,
        isValid: 'UNKNOWN',
        confidence: 0,
        sources: [],
        source: 'google_factcheck',
        timestamp: new Date(),
      };
    }

    // 找到最匹配的声明
    const bestMatch = this.findBestMatch(claim, claims);

    if (bestMatch.reviews.length === 0) {
      return {
        claim,
        isValid: 'UNKNOWN',
        confidence: 0.3,
        sources: [],
        source: 'google_factcheck',
        timestamp: new Date(),
      };
    }

    // 聚合评审结果
    return this.aggregateReviews(claim, bestMatch.reviews);
  }

  /**
   * 批量验证声明
   *
   * @param claims 声明列表
   * @param options 验证选项
   * @returns 验证结果列表
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
        results.push({
          claim,
          isValid: 'UNKNOWN',
          confidence: 0,
          sources: [],
          source: 'google_factcheck',
          timestamp: new Date(),
        });
      }

      // 速率限制
      await this.delay(1000);
    }

    return results;
  }

  /**
   * 找到最佳匹配的声明
   *
   * @param query 查询文本
   * @param claims 声明列表
   * @returns 最佳匹配的声明
   */
  private findBestMatch(query: string, claims: ClaimDetail[]): ClaimDetail {
    if (claims.length === 1) {
      return claims[0];
    }

    // 简单的相似度计算
    let bestMatch = claims[0];
    let bestScore = this.calculateSimilarity(query, claims[0].text);

    for (let i = 1; i < claims.length; i++) {
      const score = this.calculateSimilarity(query, claims[i].text);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = claims[i];
      }
    }

    return bestMatch;
  }

  /**
   * 计算文本相似度
   *
   * @param text1 文本1
   * @param text2 文本2
   * @returns 相似度分数 (0-1)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');

    const norm1 = normalize(text1);
    const norm2 = normalize(text2);

    if (norm1 === norm2) return 1;

    // 简单的 Jaccard 相似度
    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 聚合评审结果
   *
   * @param claim 原始声明
   * @param reviews 评审列表
   * @returns 验证结果
   */
  private aggregateReviews(claim: string, reviews: ClaimReview[]): ExternalFactCheckResult {
    // 按评级分组
    const ratingGroups = this.groupByRating(reviews);

    // 找到最多的评级
    const dominantRating = this.findDominantRating(ratingGroups);

    // 计算置信度
    const confidence = this.calculateConfidence(reviews, ratingGroups);

    return {
      claim,
      isValid: this.parseRating(dominantRating),
      confidence,
      sources: reviews.map(
        (r): ExternalSource => ({
          name: r.publisher?.name || 'Unknown',
          url: r.url,
          rating: r.textualRating || 'Unknown',
          date: r.reviewDate,
        })
      ),
      source: 'google_factcheck',
      timestamp: new Date(),
    };
  }

  /**
   * 按评级分组
   *
   * @param reviews 评审列表
   * @returns 评级分组
   */
  private groupByRating(reviews: ClaimReview[]): Map<string, ClaimReview[]> {
    const groups = new Map<string, ClaimReview[]>();

    for (const review of reviews) {
      const rating = this.normalizeRating(review.textualRating || '');
      if (!groups.has(rating)) {
        groups.set(rating, []);
      }
      groups.get(rating)!.push(review);
    }

    return groups;
  }

  /**
   * 归一化评级
   *
   * @param rating 原始评级
   * @returns 归一化后的评级
   */
  private normalizeRating(rating: string): string {
    const lower = rating.toLowerCase();

    if (
      lower.includes('true') ||
      lower.includes('accurate') ||
      lower.includes('correct') ||
      rating.includes('准确') ||
      rating.includes('正确')
    ) {
      return 'TRUE';
    }

    if (
      lower.includes('false') ||
      lower.includes('inaccurate') ||
      lower.includes('incorrect') ||
      rating.includes('错误') ||
      rating.includes('虚假')
    ) {
      return 'FALSE';
    }

    if (
      lower.includes('mixed') ||
      lower.includes('partially') ||
      rating.includes('部分') ||
      rating.includes('混合')
    ) {
      return 'MIXED';
    }

    return 'UNKNOWN';
  }

  /**
   * 找到主导评级
   *
   * @param ratingGroups 评级分组
   * @returns 主导评级
   */
  private findDominantRating(ratingGroups: Map<string, ClaimReview[]>): string {
    let maxCount = 0;
    let dominantRating = 'UNKNOWN';

    for (const [rating, reviews] of ratingGroups.entries()) {
      if (reviews.length > maxCount) {
        maxCount = reviews.length;
        dominantRating = rating;
      }
    }

    return dominantRating;
  }

  /**
   * 计算置信度
   *
   * @param reviews 所有评审
   * @param ratingGroups 评级分组
   * @returns 置信度分数
   */
  private calculateConfidence(
    reviews: ClaimReview[],
    ratingGroups: Map<string, ClaimReview[]>
  ): number {
    if (reviews.length === 0) return 0;

    const maxGroupSize = Math.max(...Array.from(ratingGroups.values()).map((g) => g.length));
    const agreementRatio = maxGroupSize / reviews.length;

    // 基础置信度基于一致性
    const baseConfidence = agreementRatio;

    // 根据评审数量增加置信度
    const sourceBoost = Math.min(reviews.length * 0.05, 0.2);

    return Math.min(baseConfidence + sourceBoost, 1);
  }

  /**
   * 解析评级
   *
   * @param rating 归一化后的评级
   * @returns 验证状态
   */
  private parseRating(rating: string): 'TRUE' | 'FALSE' | 'MIXED' | 'UNKNOWN' {
    switch (rating) {
      case 'TRUE':
        return 'TRUE';
      case 'FALSE':
        return 'FALSE';
      case 'MIXED':
        return 'MIXED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 延迟函数
   *
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取 API 配置
   *
   * @returns 配置信息
   */
  getConfig(): {
    isConfigured: boolean;
    baseURL: string;
    defaultLanguage: string;
    defaultPageSize: number;
    timeout: number;
  } {
    return {
      isConfigured: !!this.apiKey,
      baseURL: this.baseURL,
      defaultLanguage: this.defaultLanguage,
      defaultPageSize: this.defaultPageSize,
      timeout: this.timeout,
    };
  }
}

/**
 * 创建 Google Fact Check API 客户端实例
 *
 * @param config 配置
 * @returns API 客户端实例
 */
export function createGoogleFactCheckAPI(config?: GoogleFactCheckAPIConfig): GoogleFactCheckAPI {
  return new GoogleFactCheckAPI(config);
}
