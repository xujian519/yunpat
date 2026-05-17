/**
 * NovAScoreEvaluator - NovAScore 创新性评估器
 *
 * 基于原子内容单元 (ACU) 的文档级创新性评估。
 * 将目标文档的每个 ACU 与历史文档库 (ACUBank) 进行语义对比，
 * 结合显著性权重聚合为文档级创新性评分。
 *
 * 参考：NovAScore (arXiv:2409.09249)
 * Pearson 相关达 0.920（与人类专家判断一致）
 */

import { ACUDecomposer, type ACU } from './ACUDecomposer.js'
import { PostgresVectorStore, type SearchFilter } from '../memory/long-term/PostgresVectorStore.js'

/**
 * NovAScore 评估结果
 */
export interface NovAScoreResult {
  /** 0-1 文档级创新性 */
  documentScore: number
  /** 每个 ACU 的详细分析 */
  acuAnalysis: ACU[]
  /** 新颖 ACU 数 */
  novelACUs: number
  /** 部分新颖 ACU 数 */
  partialNovelACUs: number
  /** 冗余 ACU 数 */
  redundantACUs: number
  /** 总 ACU 数 */
  totalACUs: number
  /** 创新覆盖度 = novelACUs / totalACUs */
  coverageScore: number
}

/**
 * NovAScore 配置
 */
export interface NovAScoreConfig {
  /** 相似度阈值（默认 0.6） */
  similarityThreshold?: number
  /** 高新颖阈值（默认 0.3，低于此=高度新颖） */
  highNovelThreshold?: number
  /** 低新颖阈值（默认 0.6，高于此=冗余） */
  lowNovelThreshold?: number
  /** 检索的 top K 数量（默认 3） */
  topK?: number
  /** ACUBank 存储类型标识（默认 'acu_bank'） */
  acuBankType?: string
}

/**
 * NovAScoreEvaluator - NovAScore 创新性评估器
 */
export class NovAScoreEvaluator {
  private vectorStore: PostgresVectorStore
  private embeddingClient: any // BGEM3Client 接口，避免循环依赖
  private decomposer: ACUDecomposer
  private config: Required<NovAScoreConfig>

  constructor(
    vectorStore: PostgresVectorStore,
    embeddingClient: any, // BGEM3Client
    config: NovAScoreConfig = {}
  ) {
    this.vectorStore = vectorStore
    this.embeddingClient = embeddingClient
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.6,
      highNovelThreshold: config.highNovelThreshold ?? 0.3,
      lowNovelThreshold: config.lowNovelThreshold ?? 0.6,
      topK: config.topK ?? 3,
      acuBankType: config.acuBankType ?? 'acu_bank',
    }
    this.decomposer = new ACUDecomposer(embeddingClient)
  }

  /**
   * 评估文档创新性
   */
  async evaluate(document: string, abstract?: string): Promise<NovAScoreResult> {
    // Step 1: 将文档分解为 ACUs
    const acus = await this.decomposer.decompose(document, abstract)

    // Step 2-4: 对每个 ACU 进行相似度检索、标记新颖性、计算评分
    let novelCount = 0
    let partialNovelCount = 0
    let redundantCount = 0

    for (const acu of acus) {
      if (!acu.embedding) {
        continue
      }

      // Step 2: 搜索最相似的 ACUs
      const filter: SearchFilter = {
        types: [this.config.acuBankType],
      }
      const similarACUs = await this.vectorStore.search(acu.embedding, this.config.topK, filter)

      // Step 3-4: 确定新颖性标签和评分
      if (similarACUs.length > 0) {
        const bestSimilarity = similarACUs[0].similarity

        // 新颖性评分 = 1 - 最佳相似度
        acu.noveltyScore = 1 - bestSimilarity

        // 确定新颖性标签
        if (bestSimilarity < this.config.highNovelThreshold) {
          acu.noveltyLabel = 'novel'
          novelCount++
        } else if (bestSimilarity < this.config.lowNovelThreshold) {
          acu.noveltyLabel = 'partial'
          partialNovelCount++
        } else {
          acu.noveltyLabel = 'redundant'
          redundantCount++
        }
      } else {
        // 没有找到相似 ACU，视为高度新颖
        acu.noveltyScore = 1.0
        acu.noveltyLabel = 'novel'
        novelCount++
      }
    }

    // Step 5: 计算文档级创新性评分（加权平均）
    const documentScore = this.computeDocumentScore(acus)

    // 计算覆盖度
    const totalACUs = acus.length
    const coverageScore = totalACUs > 0 ? novelCount / totalACUs : 0

    return {
      documentScore,
      acuAnalysis: acus,
      novelACUs: novelCount,
      partialNovelACUs: partialNovelCount,
      redundantACUs: redundantCount,
      totalACUs,
      coverageScore,
    }
  }

  /**
   * 添加参考文档到 ACUBank
   */
  async addReference(document: string, abstract?: string): Promise<void> {
    const acus = await this.decomposer.decompose(document, abstract)
    await this.addReferenceACUs(acus)
  }

  /**
   * 添加预分解的 ACUs 到 ACUBank
   */
  async addReferenceACUs(acus: ACU[]): Promise<void> {
    if (acus.length === 0) {
      return
    }

    const now = new Date()
    const items = acus.map((acu) => ({
      type: this.config.acuBankType,
      content: acu.content,
      embedding: acu.embedding || [],
      metadata: {
        acuId: acu.id,
        salienceWeight: acu.salienceWeight,
        source: acu.source || 'document',
        noveltyLabel: acu.noveltyLabel,
        noveltyScore: acu.noveltyScore,
      },
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }))

    await this.vectorStore.upsertBatch(items)
  }

  /**
   * 计算文档级创新性评分（加权平均）
   * 公式: Σ(acu.noveltyScore × acu.salienceWeight) / Σ(acu.salienceWeight)
   */
  private computeDocumentScore(acus: ACU[]): number {
    let weightedSum = 0
    let totalWeight = 0

    for (const acu of acus) {
      if (acu.noveltyScore !== undefined) {
        weightedSum += acu.noveltyScore * acu.salienceWeight
        totalWeight += acu.salienceWeight
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }
}