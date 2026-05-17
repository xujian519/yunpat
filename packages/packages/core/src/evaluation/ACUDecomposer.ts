/**
 * ACUDecomposer - 原子内容单元分解器
 *
 * 将文档分解为最小独立信息单元 (Atomic Content Unit)，
 * 每个单元包含最少数量的原子事实以传达单一信息。
 *
 * 参考：NovAScore (arXiv:2409.09249)
 */

import { BGEM3Client } from '../memory/integration/BGEIntegration.js'

/**
 * 原子内容单元
 */
export interface ACU {
  /** 唯一标识 */
  id: string
  /** ACU 文本内容 */
  content: string
  /** BGE-M3 嵌入向量 */
  embedding?: number[]
  /** 显著性权重 0-1（摘要中出现=高权重） */
  salienceWeight: number
  /** 新颖性评分 0-1 */
  noveltyScore?: number
  /** 新颖性标签 */
  noveltyLabel?: 'novel' | 'partial' | 'redundant'
  /** 来源（abstract/claim/description） */
  source?: string
}

/**
 * ACUDecomposer 配置
 */
export interface ACUDecomposerConfig {
  /** 最大句子数每 ACU（默认 3） */
  maxSentencesPerACU?: number
  /** 摘要高权重值（默认 0.9） */
  abstractHighWeight?: number
  /** 默认权重值（默认 0.5） */
  defaultWeight?: number
}

/**
 * ACUDecomposer - 原子内容单元分解器
 */
export class ACUDecomposer {
  private embeddingClient: BGEM3Client
  private config: Required<ACUDecomposerConfig>
  private acuCounter: number = 0

  constructor(embeddingClient: BGEM3Client, config: ACUDecomposerConfig = {}) {
    this.embeddingClient = embeddingClient
    this.config = {
      maxSentencesPerACU: config.maxSentencesPerACU ?? 3,
      abstractHighWeight: config.abstractHighWeight ?? 0.9,
      defaultWeight: config.defaultWeight ?? 0.5,
    }
  }

  /**
   * 将文档分解为 ACUs
   */
  async decompose(document: string, abstract?: string): Promise<ACU[]> {
    // 1. 将文档分割为句子
    const sentences = this.splitIntoSentences(document)

    // 2. 将句子分组为 ACUs（基于段落和最大句子数）
    const acuGroups = this.groupSentencesIntoACUs(sentences)

    // 3. 为每个 ACU 生成嵌入向量并计算显著性权重
    const acus: ACU[] = []

    for (const group of acuGroups) {
      const content = group.join(' ')
      const embedding = await this.embeddingClient.embed(content)
      const salienceWeight = this.computeSalience(content, abstract)

      acus.push({
        id: this.generateId(),
        content,
        embedding,
        salienceWeight,
        source: abstract ? 'description' : undefined,
      })
    }

    return acus
  }

  /**
   * 将专利权利要求分解为 ACUs
   * 每个权利要求成为一个 ACU
   */
  async decomposePatentClaims(claims: string[]): Promise<ACU[]> {
    const acus: ACU[] = []

    for (const claim of claims) {
      const embedding = await this.embeddingClient.embed(claim)
      const salienceWeight = this.getClaimSalienceWeight(claim)

      acus.push({
        id: this.generateId(),
        content: claim,
        embedding,
        salienceWeight,
        source: 'claim',
      })
    }

    return acus
  }

  /**
   * 将文本分割为句子
   * 简单实现：基于句号、问号、感叹号分割
   */
  private splitIntoSentences(text: string): string[] {
    // 移除多余空白
    const cleanedText = text.trim().replace(/\s+/g, ' ')

    // 按句子分隔符分割（保留分隔符）
    const sentences = cleanedText.split(/([。？！；])/)

    const result: string[] = []
    for (let i = 0; i < sentences.length; i += 2) {
      if (sentences[i]) {
        const sentence = sentences[i].trim()
        // 加上分隔符（如果有）
        const separator = sentences[i + 1] || ''
        if (sentence || separator) {
          result.push((sentence + separator).trim())
        }
      }
    }

    // 过滤空句子
    return result.filter((s) => s.length > 0)
  }

  /**
   * 将句子分组为 ACUs
   * 基于段落和最大句子数的启发式规则
   */
  private groupSentencesIntoACUs(sentences: string[]): string[][] {
    const groups: string[][] = []
    let currentGroup: string[] = []

    for (const sentence of sentences) {
      // 检测段落换行（通过双空格或换行符判断）
      const isParagraphBreak = sentence.includes('\n\n') || sentence.startsWith('  ')

      if (isParagraphBreak && currentGroup.length > 0) {
        // 段落结束，完成当前 ACU
        groups.push([...currentGroup])
        currentGroup = []
      }

      currentGroup.push(sentence.replace(/\s+/g, ' ').trim())

      // 达到最大句子数，完成当前 ACU
      if (currentGroup.length >= this.config.maxSentencesPerACU) {
        groups.push([...currentGroup])
        currentGroup = []
      }
    }

    // 处理剩余句子
    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * 计算显著性权重
   * 如果 ACU 内容出现在摘要中，权重为高，否则为默认值
   */
  private computeSalience(acuContent: string, abstract?: string): number {
    if (!abstract) {
      return this.config.defaultWeight
    }

    // 检查 ACU 内容是否与摘要有重叠
    const overlap = this.computeOverlap(acuContent, abstract)

    // 如果重叠度超过阈值（30%），使用高权重
    if (overlap > 0.3) {
      return this.config.abstractHighWeight
    }

    return this.config.defaultWeight
  }

  /**
   * 计算文本重叠度
   * 简单实现：基于共同词汇的比例
   */
  private computeOverlap(text1: string, text2: string): number {
    const words1 = this.tokenize(text1)
    const words2 = this.tokenize(text2)

    if (words1.size === 0 || words2.size === 0) {
      return 0
    }

    const intersection = new Set([...words1].filter((x) => words2.has(x)))

    // Jaccard 相似度
    return intersection.size / new Set([...words1, ...words2]).size
  }

  /**
   * 文本分词
   */
  private tokenize(text: string): Set<string> {
    // 简单的分词：基于空格和标点符号
    const tokens = text
      .toLowerCase()
      .split(/[\s，。？！；、：""''（）【】《》]/)
      .filter((t) => t.length > 1) // 过滤单字符

    return new Set(tokens)
  }

  /**
   * 获取权利要求的显著性权重
   * 独立权利要求权重高，从属权利要求权重低
   */
  private getClaimSalienceWeight(claim: string): number {
    // 简单判断：独立权利要求通常以数字开头，从属权利要求通常引用其他权利要求
    const isDependent = /\d+\s*项/.test(claim) || /权利要求\d+/.test(claim)

    return isDependent ? this.config.defaultWeight : this.config.abstractHighWeight
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    const timestamp = Date.now()
    const counter = this.acuCounter++
    return `acu-${timestamp}-${counter}`
  }
}
