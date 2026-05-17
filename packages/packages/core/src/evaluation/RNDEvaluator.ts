/**
 * RNDEvaluator - 相对邻居密度创新性评估器
 *
 * 通过分析目标 idea 在语义空间中的邻居分布密度来评估新颖性。
 * 核心原理：邻居密度越低，说明在现有文献中越少见，因此越新颖。
 *
 * 优势：跨领域泛化能力强，不依赖 LLM 的训练数据覆盖范围。
 *
 * 参考：RND (arXiv:2503.01508)
 * AUROC 达 0.78（跨领域场景下远超 LLM-as-Judge 的 0.6）
 */

import type { PostgresVectorStore, SimilarityResult } from '../memory/long-term/PostgresVectorStore.js'
import type { BGEM3Client } from '../memory/integration/BGEIntegration.js'

/**
 * RND 评估选项
 */
export interface RNDOptions {
  /** kNN 参数 k 值（邻居数量），默认 10 */
  k?: number
  /** 密度阈值（低于此值视为新颖），默认自动计算 */
  densityThreshold?: number
  /** 向量搜索的 topK 候选数量，默认 100 */
  searchTopK?: number
}

/**
 * 邻居信息
 */
export interface NeighborInfo {
  content: string
  distance: number
  source: string
  type: string
}

/**
 * RND 评估结果
 */
export interface RNDResult {
  /** 创新性评分 0-1（越高越新颖） */
  noveltyScore: number
  /** 邻居密度（越低越新颖） */
  neighborDensity: number
  /** 最近邻居列表 */
  nearestNeighbors: NeighborInfo[]
  /** 检测到的技术领域 */
  detectedDomain: string
  /** 是否为跨领域创新 */
  isCrossDomain: boolean
  /** 领域分布（邻居中各领域的占比） */
  domainDistribution: Record<string, number>
  /** 评估元信息 */
  meta: {
    k: number
    totalNeighborsChecked: number
    avgDistance: number
    minDistance: number
    maxDistance: number
  }
}

/**
 * RND 评估器类
 */
export class RNDEvaluator {
  private vectorStore: PostgresVectorStore
  private embeddingClient: BGEM3Client
  private defaultK: number = 10
  private defaultSearchTopK: number = 100

  constructor(
    vectorStore: PostgresVectorStore,
    embeddingClient: BGEM3Client
  ) {
    this.vectorStore = vectorStore
    this.embeddingClient = embeddingClient
  }

  /**
   * 评估单个 idea 的创新性
   */
  async evaluate(idea: string, options: RNDOptions = {}): Promise<RNDResult> {
    const k = options.k ?? this.defaultK
    const searchTopK = options.searchTopK ?? this.defaultSearchTopK

    // 1. Embed the idea using BGE-M3
    const ideaEmbedding = await this.embeddingClient.embed(idea)

    // 2. Search vectorStore for top-K nearest neighbors
    const neighbors = await this.vectorStore.search(ideaEmbedding, searchTopK)

    // 3. Compute kNN density
    const density = this.computeDensity(neighbors, k)

    // 4. Novelty score = 1 - density (higher density = less novel)
    const noveltyScore = 1 - density

    // 5. Domain detection
    const detectedDomain = this.detectDomain(neighbors)
    const isCrossDomain = this.isCrossDomainNovelty(neighbors)

    // 6. Compute domain distribution
    const domainDistribution = this.computeDomainDistribution(neighbors)

    // 7. Compute meta statistics
    const similarities = neighbors.map((n) => n.similarity)
    const meta = {
      k,
      totalNeighborsChecked: neighbors.length,
      avgDistance: similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0,
      minDistance: similarities.length > 0 ? Math.min(...similarities) : 0,
      maxDistance: similarities.length > 0 ? Math.max(...similarities) : 0,
    }

    // 8. Extract nearest neighbors info
    const nearestNeighbors: NeighborInfo[] = neighbors.slice(0, k).map((n) => ({
      content: n.content,
      distance: 1 - n.similarity, // 转换为距离
      source: n.metadata?.source ?? 'unknown',
      type: n.type,
    }))

    return {
      noveltyScore,
      neighborDensity: density,
      nearestNeighbors,
      detectedDomain,
      isCrossDomain,
      domainDistribution,
      meta,
    }
  }

  /**
   * 批量评估多个 ideas 的创新性（并行处理）
   */
  async evaluateBatch(ideas: string[], options: RNDOptions = {}): Promise<RNDResult[]> {
    // 批量 embed 所有 ideas
    const embeddings = await this.embeddingClient.embedBatch(ideas)

    // 并行评估每个 idea
    const results = await Promise.all(
      embeddings.map(async (embedding) => {
        const neighbors = await this.vectorStore.search(
          embedding,
          options.searchTopK ?? this.defaultSearchTopK
        )
        const density = this.computeDensity(neighbors, options.k ?? this.defaultK)
        const noveltyScore = 1 - density

        const detectedDomain = this.detectDomain(neighbors)
        const isCrossDomain = this.isCrossDomainNovelty(neighbors)
        const domainDistribution = this.computeDomainDistribution(neighbors)

        const k = options.k ?? this.defaultK
        const similarities = neighbors.map((n) => n.similarity)
        const meta = {
          k,
          totalNeighborsChecked: neighbors.length,
          avgDistance: similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0,
          minDistance: similarities.length > 0 ? Math.min(...similarities) : 0,
          maxDistance: similarities.length > 0 ? Math.max(...similarities) : 0,
        }

        const nearestNeighbors: NeighborInfo[] = neighbors.slice(0, k).map((n) => ({
          content: n.content,
          distance: 1 - n.similarity,
          source: n.metadata?.source ?? 'unknown',
          type: n.type,
        }))

        return {
          noveltyScore,
          neighborDensity: density,
          nearestNeighbors,
          detectedDomain,
          isCrossDomain,
          domainDistribution,
          meta,
        }
      })
    )

    return results
  }

  /**
   * 获取参考数据库的统计信息
   */
  async getReferenceStats(): Promise<{
    totalReferences: number
    domainDistribution: Record<string, number>
  }> {
    const stats = await this.vectorStore.getStats()
    return {
      totalReferences: stats.totalMemories,
      domainDistribution: stats.typeDistribution,
    }
  }

  /**
   * 计算邻居密度（kNN 密度）
   */
  private computeDensity(neighbors: SimilarityResult[], k: number): number {
    if (neighbors.length === 0) return 0

    // 取前 k 个邻居的平均相似度
    const topK = neighbors.slice(0, Math.min(k, neighbors.length))
    const avgSimilarity = topK.reduce((sum, n) => sum + n.similarity, 0) / topK.length

    return avgSimilarity
  }

  /**
   * 检测技术领域（基于邻居元数据）
   */
  private detectDomain(neighbors: SimilarityResult[]): string {
    if (neighbors.length === 0) return 'unknown'

    // 统计各类型/领域的出现频率
    const domainCounts = new Map<string, number>()
    for (const neighbor of neighbors) {
      const domain = neighbor.metadata?.domain as string | undefined
      const type = neighbor.type
      const key = domain ?? type
      domainCounts.set(key, (domainCounts.get(key) ?? 0) + 1)
    }

    // 返回最频繁的领域
    let maxCount = 0
    let detectedDomain = 'unknown'
    for (const [domain, count] of domainCounts) {
      if (count > maxCount) {
        maxCount = count
        detectedDomain = domain
      }
    }

    return detectedDomain
  }

  /**
   * 判断是否为跨领域创新
   */
  private isCrossDomainNovelty(neighbors: SimilarityResult[]): boolean {
    if (neighbors.length === 0) return false

    // 计算邻居之间的距离方差
    // 如果方差很大，说明邻居分散在多个领域，可能属于跨领域创新

    // 简化方法：如果 top-k 邻居的平均相似度较低，且邻居来自不同领域，则判定为跨领域

    const k = Math.min(this.defaultK, neighbors.length)
    const topKNeighbors = neighbors.slice(0, k)

    // 检查领域多样性
    const domains = new Set<string>()
    for (const neighbor of topKNeighbors) {
      const domain = neighbor.metadata?.domain as string | undefined
      if (domain) domains.add(domain)
    }

    // 如果领域数 > 1 且平均相似度 < 0.7，则判定为跨领域创新
    const avgSimilarity = topKNeighbors.reduce((sum, n) => sum + n.similarity, 0) / topKNeighbors.length

    return domains.size > 1 && avgSimilarity < 0.7
  }

  /**
   * 计算领域分布
   */
  private computeDomainDistribution(neighbors: SimilarityResult[]): Record<string, number> {
    if (neighbors.length === 0) return {}

    const domainCounts = new Map<string, number>()
    for (const neighbor of neighbors) {
      const domain = neighbor.metadata?.domain as string | undefined
      const type = neighbor.type
      const key = domain ?? type
      domainCounts.set(key, (domainCounts.get(key) ?? 0) + 1)
    }

    // 转换为百分比
    const distribution: Record<string, number> = {}
    for (const [domain, count] of domainCounts) {
      distribution[domain] = count / neighbors.length
    }

    return distribution
  }
}

/**
 * 创建 RND 评估器实例
 */
export function createRNDEvaluator(
  vectorStore: PostgresVectorStore,
  embeddingClient: BGEM3Client
): RNDEvaluator {
  return new RNDEvaluator(vectorStore, embeddingClient)
}