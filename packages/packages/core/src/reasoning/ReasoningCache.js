/**
 * 推理缓存系统
 *
 * 基于相似度的智能缓存，避免重复推理相同或相似的问题
 *
 * 核心功能：
 * 1. 相似度计算 - 使用多种算法计算问题相似度
 * 2. 智能缓存 - 自动存储和检索推理结果
 * 3. 缓存策略 - LRU、TTL、相似度阈值
 * 4. 性能监控 - 缓存命中率、节省的 Token 数
 *
 * @module reasoning/ReasoningCache
 */
// ========== 推理缓存实现 ==========
/**
 * 推理缓存类
 */
export class ReasoningCache {
  cache
  config
  embeddingAdapter
  stats
  constructor(config, embeddingAdapter) {
    this.cache = new Map()
    this.config = {
      maxEntries: 1000,
      similarityThreshold: 0.85,
      ttl: 3600000, // 1 小时
      enableEmbedding: !!embeddingAdapter,
      similarityAlgorithm: 'cosine',
      ...config,
    }
    this.embeddingAdapter = embeddingAdapter
    this.stats = {
      hits: 0,
      misses: 0,
      tokensSaved: 0,
      totalTokens: 0,
      similarities: [],
    }
  }
  /**
   * 查询缓存
   *
   * @param problem 问题
   * @param threshold 相似度阈值（可选，覆盖配置）
   * @returns 缓存查询结果
   */
  async query(problem, threshold) {
    const similarityThreshold = threshold ?? this.config.similarityThreshold
    // 清理过期条目
    this.cleanup()
    // 如果启用嵌入向量，使用语义搜索
    if (this.config.enableEmbedding && this.embeddingAdapter) {
      return await this.queryByEmbedding(problem, similarityThreshold)
    }
    // 否则使用精确匹配或 Jaccard 相似度
    return this.queryBySimilarity(problem, similarityThreshold)
  }
  /**
   * 存储到缓存
   *
   * @param problem 问题
   * @param result 结果
   * @param tokensUsed Token 消耗
   */
  async store(problem, result, tokensUsed) {
    const key = this.generateKey(problem)
    // 检查是否已存在
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)
      entry.lastAccessedAt = new Date()
      entry.accessCount++
      return
    }
    // 如果缓存已满，移除最少使用的条目
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU()
    }
    // 生成嵌入向量（如果启用）
    let embedding
    if (this.config.enableEmbedding && this.embeddingAdapter) {
      try {
        const embedResult = await this.embeddingAdapter.embed({ texts: [problem], normalize: true })
        embedding = embedResult.embeddings[0]
      } catch (error) {
        // 嵌入失败，继续但不使用嵌入
        console.warn('Failed to generate embedding:', error)
      }
    }
    // 创建缓存条目
    const entry = {
      key,
      problem,
      result,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 1,
      embedding,
      tokensUsed,
    }
    this.cache.set(key, entry)
    this.stats.totalTokens += tokensUsed
  }
  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses
    const avgSimilarity =
      this.stats.similarities.length > 0
        ? this.stats.similarities.reduce((a, b) => a + b, 0) / this.stats.similarities.length
        : 0
    return {
      totalEntries: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      tokensSaved: this.stats.tokensSaved,
      totalTokens: this.stats.totalTokens,
      avgSimilarity,
    }
  }
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      tokensSaved: 0,
      totalTokens: 0,
      similarities: [],
    }
  }
  /**
   * 删除指定键的缓存
   */
  delete(problem) {
    const key = this.generateKey(problem)
    return this.cache.delete(key)
  }
  /**
   * 基于嵌入向量查询
   */
  async queryByEmbedding(problem, threshold) {
    try {
      // 生成查询的嵌入向量
      const embedResult = await this.embeddingAdapter.embed({ texts: [problem], normalize: true })
      const queryEmbedding = embedResult.embeddings[0]
      let bestMatch
      let bestSimilarity = 0
      // 搜索最相似的条目
      for (const entry of this.cache.values()) {
        if (entry.embedding) {
          const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding)
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity
            bestMatch = entry
          }
        }
      }
      // 检查是否达到阈值
      if (bestMatch && bestSimilarity >= threshold) {
        this.stats.hits++
        this.stats.tokensSaved += bestMatch.tokensUsed
        this.stats.similarities.push(bestSimilarity)
        // 更新访问信息
        bestMatch.lastAccessedAt = new Date()
        bestMatch.accessCount++
        return {
          found: true,
          result: bestMatch.result,
          similarity: bestSimilarity,
          entry: bestMatch,
        }
      }
      this.stats.misses++
      return { found: false }
    } catch (error) {
      console.error('Embedding query failed:', error)
      this.stats.misses++
      return { found: false }
    }
  }
  /**
   * 基于相似度查询（不使用嵌入）
   */
  queryBySimilarity(problem, threshold) {
    let bestMatch
    let bestSimilarity = 0
    let bestKey
    for (const [key, entry] of this.cache.entries()) {
      const similarity = this.calculateSimilarity(problem, entry.problem)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = entry
        bestKey = key
      }
    }
    // 检查是否达到阈值
    if (bestMatch && bestKey && bestSimilarity >= threshold) {
      this.stats.hits++
      this.stats.tokensSaved += bestMatch.tokensUsed
      this.stats.similarities.push(bestSimilarity)
      // 更新访问信息（直接修改缓存中的条目）
      bestMatch.lastAccessedAt = new Date()
      bestMatch.accessCount++
      return {
        found: true,
        result: bestMatch.result,
        similarity: bestSimilarity,
        entry: bestMatch,
      }
    }
    this.stats.misses++
    return { found: false }
  }
  /**
   * 计算两个字符串的相似度
   */
  calculateSimilarity(str1, str2) {
    switch (this.config.similarityAlgorithm) {
      case 'cosine':
        return this.cosineSimilarityText(str1, str2)
      case 'jaccard':
        return this.jaccardSimilarity(str1, str2)
      case 'levenshtein':
        return this.levenshteinSimilarity(str1, str2)
      default:
        return this.jaccardSimilarity(str1, str2)
    }
  }
  /**
   * 余弦相似度（文本版）
   */
  cosineSimilarityText(str1, str2) {
    const words1 = new Set(str1.toLowerCase().split(/\s+/))
    const words2 = new Set(str2.toLowerCase().split(/\s+/))
    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])
    return union.size > 0 ? intersection.size / union.size : 0
  }
  /**
   * 余弦相似度（向量版）
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      return 0
    }
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    return denominator > 0 ? dotProduct / denominator : 0
  }
  /**
   * Jaccard 相似度
   */
  jaccardSimilarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\s+/))
    const set2 = new Set(str2.toLowerCase().split(/\s+/))
    const intersection = new Set([...set1].filter((x) => set2.has(x)))
    const union = new Set([...set1, ...set2])
    return union.size > 0 ? intersection.size / union.size : 0
  }
  /**
   * Levenshtein 相似度
   */
  levenshteinSimilarity(str1, str2) {
    const distance = this.levenshteinDistance(str1, str2)
    const maxLen = Math.max(str1.length, str2.length)
    return maxLen > 0 ? 1 - distance / maxLen : 1
  }
  /**
   * Levenshtein 距离
   */
  levenshteinDistance(str1, str2) {
    const len1 = str1.length
    const len2 = str2.length
    const dp = Array(len1 + 1)
      .fill(0)
      .map(() => Array(len2 + 1).fill(0))
    for (let i = 0; i <= len1; i++) {
      dp[i][0] = i
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j
    }
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
        }
      }
    }
    return dp[len1][len2]
  }
  /**
   * 生成缓存键
   */
  generateKey(problem) {
    // 简单哈希（可以使用更好的哈希算法）
    let hash = 0
    for (let i = 0; i < problem.length; i++) {
      const char = problem.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为 32 位整数
    }
    return hash.toString(36)
  }
  /**
   * 清理过期条目
   */
  cleanup() {
    const now = Date.now()
    const keysToDelete = []
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessedAt.getTime() > this.config.ttl) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key))
  }
  /**
   * 驱逐最少使用的条目
   */
  evictLRU() {
    let oldestKey
    let oldestTime = Infinity
    let oldestAccessCount = Infinity
    for (const [key, entry] of this.cache.entries()) {
      const entryTime = entry.lastAccessedAt.getTime()
      // 优先选择访问时间最旧的，如果时间相同则选择访问次数最少的
      if (
        entryTime < oldestTime ||
        (entryTime === oldestTime && entry.accessCount < oldestAccessCount)
      ) {
        oldestTime = entryTime
        oldestAccessCount = entry.accessCount
        oldestKey = key
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }
  /**
   * 获取所有缓存条目
   */
  getEntries() {
    return Array.from(this.cache.values())
  }
  /**
   * 导出缓存（用于持久化）
   */
  export() {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }))
  }
  /**
   * 导入缓存（用于恢复）
   */
  import(data) {
    for (const { key, entry } of data) {
      if (this.cache.size < this.config.maxEntries) {
        this.cache.set(key, entry)
      }
    }
  }
}
// ========== 辅助函数 ==========
/**
 * 创建推理缓存（便捷函数）
 *
 * @param config 缓存配置
 * @param embeddingAdapter 嵌入适配器（可选）
 * @returns 推理缓存实例
 */
export function createReasoningCache(config, embeddingAdapter) {
  return new ReasoningCache(config, embeddingAdapter)
}
//# sourceMappingURL=ReasoningCache.js.map
