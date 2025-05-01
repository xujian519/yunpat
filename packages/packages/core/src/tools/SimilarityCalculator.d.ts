/**
 * 文本相似度计算器
 *
 * 提供多种相似度计算算法，支持缓存优化
 */
export declare class SimilarityCalculator {
  private cache
  private cacheHits
  private cacheMisses
  /**
   * 计算两个文本的相似度
   */
  calculateSimilarity(
    text1: string,
    text2: string,
    algorithm?: 'jaccard' | 'cosine' | 'levenshtein'
  ): number
  /**
   * Jaccard相似度（词级别）
   */
  private jaccardSimilarity
  /**
   * 余弦相似度（TF-IDF）
   */
  private cosineSimilarity
  /**
   * Levenshtein距离相似度
   */
  private levenshteinSimilarity
  /**
   * 分词
   * 支持英文按空格分词，中文按 2-gram 分词
   */
  private tokenize
  /**
   * 计算词频(TF)向量
   */
  private getTFVector
  /**
   * 计算余弦值
   */
  private cosine
  /**
   * 计算Levenshtein距离
   */
  private levenshteinDistance
  /**
   * 生成缓存键
   */
  private getCacheKey
  /**
   * 清除缓存
   */
  clearCache(): void
  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number
    hits: number
    misses: number
    hitRate: number
  }
  /**
   * 批量计算相似度
   * 优化：对目标文本只做一次预处理，避免重复 tokenize 和缓存查找开销
   */
  calculateBatchSimilarities(
    targetText: string,
    candidates: string[],
    algorithm?: 'jaccard' | 'cosine' | 'levenshtein'
  ): Array<{
    text: string
    similarity: number
  }>
  /**
   * 找出最相似的文本
   */
  findMostSimilar(
    targetText: string,
    candidates: string[],
    algorithm?: 'jaccard' | 'cosine' | 'levenshtein',
    threshold?: number
  ): {
    text: string
    similarity: number
  } | null
}
export declare const similarityCalculator: SimilarityCalculator
//# sourceMappingURL=SimilarityCalculator.d.ts.map
