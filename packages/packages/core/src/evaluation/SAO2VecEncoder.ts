/**
 * SAO2VecEncoder - SAO 向量化编码器
 *
 * 将 SAO 三元组编码为统一的向量表示，
 * 基于 Doc2Vec 框架对功能语义进行嵌入。
 *
 * 编码策略：将 subject + action + object 拼接为结构化文本，
 * 使用 BGE-M3 进行向量化，保留功能性语义。
 *
 * 参考：SAO2Vec (PMC7001927)
 */

import type { SAOTriplet } from './SAOExtractor.js'
import { BGEM3Client } from '../memory/integration/BGEIntegration.js'

/**
 * SAO 嵌入结果
 */
export interface SAOEmbedding {
  /** SAO 三元组 */
  triplet: SAOTriplet
  /** 向量表示 */
  embedding: number[]
}

/**
 * SAO 向量化编码器
 */
export class SAO2VecEncoder {
  private embeddingClient: BGEM3Client

  constructor(embeddingClient: BGEM3Client) {
    this.embeddingClient = embeddingClient
  }

  /**
   * 编码单个 SAO 三元组
   *
   * @param triplet - SAO 三元组
   * @returns 向量表示
   */
  async encode(triplet: SAOTriplet): Promise<number[]> {
    const formattedText = this.formatTripletForEmbedding(triplet)
    return await this.embeddingClient.embed(formattedText)
  }

  /**
   * 批量编码 SAO 三元组
   *
   * @param triplets - SAO 三元组数组
   * @returns SAO 嵌入结果数组
   */
  async encodeBatch(triplets: SAOTriplet[]): Promise<SAOEmbedding[]> {
    const formattedTexts = triplets.map((triplet) => this.formatTripletForEmbedding(triplet))

    const embeddings = await this.embeddingClient.embedBatch(formattedTexts)

    return triplets.map((triplet, index) => ({
      triplet,
      embedding: embeddings[index],
    }))
  }

  /**
   * 计算两个 SAO 嵌入的相似度（余弦相似度）
   *
   * @param a - SAO 嵌入 a
   * @param b - SAO 嵌入 b
   * @returns 余弦相似度 [-1, 1]
   */
  similarity(a: SAOEmbedding, b: SAOEmbedding): number {
    return this.cosineSimilarity(a.embedding, b.embedding)
  }

  /**
   * 查找与目标 SAO 最相似的候选三元组
   *
   * @param target - 目标 SAO 三元组
   * @param candidates - 候选 SAO 三元组数组
   * @param topK - 返回前 K 个最相似的结果
   * @returns 按相似度降序排列的 SAO 三元组数组
   */
  async findSimilar(target: SAOTriplet, candidates: SAOTriplet[], topK: number): Promise<SAOTriplet[]> {
    if (candidates.length === 0) {
      return []
    }

    topK = Math.min(topK, candidates.length)

    // 批量编码候选三元组
    const candidateEmbeddings = await this.encodeBatch(candidates)

    // 编码目标三元组
    const targetEmbedding = await this.encode(target)

    // 计算相似度
    const similarities = candidateEmbeddings.map((candidateEmbedding, index) => ({
      triplet: candidates[index],
      similarity: this.cosineSimilarity(targetEmbedding, candidateEmbedding.embedding),
    }))

    // 按相似度降序排序并返回 topK
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((item) => item.triplet)
  }

  /**
   * 计算两个 SAO 三元组的功能相似度
   *
   * 相似度判断规则：
   * - 相同动作 + 相同主语 → 高相似度
   * - 相同动作但不同主语/宾语 → 中等相似度
   * - 不同动作 → 低相似度
   *
   * @param tripletA - SAO 三元组 a
   * @param tripletB - SAO 三元组 b
   * @returns 功能相似度 [0, 1]
   */
  async functionalSimilarity(tripletA: SAOTriplet, tripletB: SAOTriplet): Promise<number> {
    const embeddingA = await this.encode(tripletA)
    const embeddingB = await this.encode(tripletB)

    const vectorSimilarity = this.cosineSimilarity(embeddingA, embeddingB)

    // 基于功能的相似度调整
    let functionalSimilarity = vectorSimilarity

    // 相同动作 → 提升相似度
    if (tripletA.action === tripletB.action) {
      functionalSimilarity += 0.2

      // 相同主语 → 进一步提升
      if (tripletA.subject === tripletB.subject) {
        functionalSimilarity += 0.2
      }

      // 相同宾语 → 进一步提升
      if (tripletA.object === tripletB.object) {
        functionalSimilarity += 0.1
      }
    } else {
      // 不同动作 → 降低相似度
      functionalSimilarity *= 0.7
    }

    // 归一化到 [0, 1] 区间
    return Math.max(0, Math.min(1, functionalSimilarity))
  }

  /**
   * 计算余弦相似度
   *
   * @param a - 向量 a
   * @param b - 向量 b
   * @returns 余弦相似度 [-1, 1]
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('向量维度不匹配')
    }

    if (a.length === 0) {
      return 0
    }

    // 计算点积
    let dotProduct = 0
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
    }

    // 计算向量范数
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    // 避免除零
    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }

  /**
   * 格式化 SAO 三元组为嵌入文本
   *
   * 使用结构化格式保留功能性语义
   *
   * @param triplet - SAO 三元组
   * @returns 格式化后的文本
   */
  private formatTripletForEmbedding(triplet: SAOTriplet): string {
    return `技术组件: ${triplet.subject} | 功能: ${triplet.action} | 作用对象: ${triplet.object}`
  }
}