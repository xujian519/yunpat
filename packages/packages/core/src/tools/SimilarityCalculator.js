/**
 * 文本相似度计算器
 *
 * 提供多种相似度计算算法，支持缓存优化
 */
export class SimilarityCalculator {
  cache = new Map()
  cacheHits = 0
  cacheMisses = 0
  /**
   * 计算两个文本的相似度
   */
  calculateSimilarity(text1, text2, algorithm = 'jaccard') {
    // 生成缓存键
    const cacheKey = this.getCacheKey(text1, text2, algorithm)
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      this.cacheHits++
      return this.cache.get(cacheKey)
    }
    this.cacheMisses++
    // 计算相似度
    let similarity
    switch (algorithm) {
      case 'jaccard':
        similarity = this.jaccardSimilarity(text1, text2)
        break
      case 'cosine':
        similarity = this.cosineSimilarity(text1, text2)
        break
      case 'levenshtein':
        similarity = this.levenshteinSimilarity(text1, text2)
        break
      default:
        similarity = this.jaccardSimilarity(text1, text2)
    }
    // 缓存结果
    this.cache.set(cacheKey, similarity)
    // 限制缓存大小
    if (this.cache.size > 1000) {
      this.clearCache()
    }
    return similarity
  }
  /**
   * Jaccard相似度（词级别）
   */
  jaccardSimilarity(text1, text2) {
    const words1 = new Set(this.tokenize(text1.toLowerCase()))
    const words2 = new Set(this.tokenize(text2.toLowerCase()))
    if (words1.size === 0 && words2.size === 0) {
      return 1.0
    }
    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])
    return union.size > 0 ? intersection.size / union.size : 0
  }
  /**
   * 余弦相似度（TF-IDF）
   */
  cosineSimilarity(text1, text2) {
    const tokens1 = this.tokenize(text1.toLowerCase())
    const tokens2 = this.tokenize(text2.toLowerCase())
    // 构建词汇表
    const vocabulary = new Set([...tokens1, ...tokens2])
    // 计算TF向量
    const vec1 = this.getTFVector(tokens1, vocabulary)
    const vec2 = this.getTFVector(tokens2, vocabulary)
    // 计算余弦相似度
    return this.cosine(vec1, vec2)
  }
  /**
   * Levenshtein距离相似度
   */
  levenshteinSimilarity(text1, text2) {
    const distance = this.levenshteinDistance(text1, text2)
    const maxLen = Math.max(text1.length, text2.length)
    return maxLen > 0 ? 1 - distance / maxLen : 1
  }
  /**
   * 分词
   * 支持英文按空格分词，中文按 2-gram 分词
   */
  tokenize(text) {
    // 移除标点符号，保留中文、英文、数字
    const cleaned = text.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    const tokens = []
    for (const segment of cleaned.split(/\s+/).filter((s) => s.length > 0)) {
      // 提取中文字符串和英文/数字词
      const matches = segment.match(/[\u4e00-\u9fa5]+|\w+/g)
      if (matches) {
        for (const match of matches) {
          if (/[\u4e00-\u9fa5]/.test(match) && match.length > 1) {
            // 中文字符串：按 2-gram 分词
            for (let i = 0; i < match.length - 1; i++) {
              tokens.push(match.slice(i, i + 2))
            }
          } else {
            tokens.push(match)
          }
        }
      }
    }
    return tokens
  }
  /**
   * 计算词频(TF)向量
   */
  getTFVector(tokens, vocabulary) {
    const tf = new Map()
    const termCount = new Map()
    // 统计词频
    for (const token of tokens) {
      termCount.set(token, (termCount.get(token) || 0) + 1)
    }
    // 计算TF
    const totalTerms = tokens.length
    for (const [term, count] of termCount) {
      tf.set(term, count / totalTerms)
    }
    // 构建完整向量
    const vector = new Map()
    for (const term of vocabulary) {
      vector.set(term, tf.get(term) || 0)
    }
    return vector
  }
  /**
   * 计算余弦值
   */
  cosine(vec1, vec2) {
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    for (const [term, val1] of vec1) {
      const val2 = vec2.get(term) || 0
      dotProduct += val1 * val2
      norm1 += val1 * val1
    }
    for (const val2 of vec2.values()) {
      norm2 += val2 * val2
    }
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    return denominator > 0 ? dotProduct / denominator : 0
  }
  /**
   * 计算Levenshtein距离
   */
  levenshteinDistance(str1, str2) {
    const len1 = str1.length
    const len2 = str2.length
    // 创建距离矩阵
    const matrix = []
    for (let i = 0; i <= len1; i++) {
      matrix[i] = []
      for (let j = 0; j <= len2; j++) {
        if (i === 0) {
          matrix[i][j] = j
        } else if (j === 0) {
          matrix[i][j] = i
        } else {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // 删除
            matrix[i][j - 1] + 1, // 插入
            matrix[i - 1][j - 1] + cost // 替换
          )
        }
      }
    }
    return matrix[len1][len2]
  }
  /**
   * 生成缓存键
   */
  getCacheKey(text1, text2, algorithm) {
    // 使用哈希生成键（简化版）
    const combined = `${text1}|${text2}|${algorithm}`
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为32位整数
    }
    return `${algorithm}_${Math.abs(hash)}`
  }
  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
    this.cacheHits = 0
    this.cacheMisses = 0
  }
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    }
  }
  /**
   * 批量计算相似度
   * 优化：对目标文本只做一次预处理，避免重复 tokenize 和缓存查找开销
   */
  calculateBatchSimilarities(targetText, candidates, algorithm = 'jaccard') {
    const targetLower = targetText.toLowerCase()
    if (algorithm === 'jaccard') {
      const targetWords = new Set(this.tokenize(targetLower))
      return candidates.map((text) => {
        const words = new Set(this.tokenize(text.toLowerCase()))
        if (targetWords.size === 0 && words.size === 0) {
          return { text, similarity: 1.0 }
        }
        const intersection = new Set([...targetWords].filter((x) => words.has(x)))
        const union = new Set([...targetWords, ...words])
        const similarity = union.size > 0 ? intersection.size / union.size : 0
        return { text, similarity }
      })
    }
    if (algorithm === 'cosine') {
      const targetTokens = this.tokenize(targetLower)
      return candidates.map((text) => {
        const tokens = this.tokenize(text.toLowerCase())
        const vocabulary = new Set([...targetTokens, ...tokens])
        const vec1 = this.getTFVector(targetTokens, vocabulary)
        const vec2 = this.getTFVector(tokens, vocabulary)
        const similarity = this.cosine(vec1, vec2)
        return { text, similarity }
      })
    }
    // levenshtein 保持原样
    return candidates.map((text) => ({
      text,
      similarity: this.levenshteinSimilarity(targetText, text),
    }))
  }
  /**
   * 找出最相似的文本
   */
  findMostSimilar(targetText, candidates, algorithm = 'jaccard', threshold = 0.0) {
    const similarities = this.calculateBatchSimilarities(targetText, candidates, algorithm)
    // 过滤低于阈值的
    const filtered = similarities.filter((s) => s.similarity >= threshold)
    if (filtered.length === 0) {
      return null
    }
    // 找出最相似的
    return filtered.reduce((best, current) =>
      current.similarity > best.similarity ? current : best
    )
  }
}
// 导出单例
export const similarityCalculator = new SimilarityCalculator()
//# sourceMappingURL=SimilarityCalculator.js.map
