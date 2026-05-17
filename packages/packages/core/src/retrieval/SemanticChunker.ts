/**
 * SemanticChunker - 语义分块器
 *
 * 通过检测相邻句子嵌入之间的余弦相似度断崖来识别主题边界，
 * 替代传统固定长度分块，确保每个文本块内部主题一致性。
 *
 * 算法参考：
 * - Projected Similarity Chunking (PSC)
 * - Metric Fusion Chunking (MFC)
 * - 语义分块相比固定长度分块可提升 24x MRR
 */

import type { BGEM3Client } from '../memory/integration/BGEIntegration.js'

/**
 * 语义分块器配置
 */
export interface SemanticChunkerConfig {
  /** BGE-M3 嵌入客户端 */
  embeddingClient: BGEM3Client

  /** 主题边界相似度阈值（低于此值视为边界） */
  similarityThreshold?: number

  /** 最小块大小（字符数） */
  minChunkSize?: number

  /** 最大块大小（字符数） */
  maxChunkSize?: number
}

/**
 * 分块结果
 */
export interface Chunk {
  /** 块内容 */
  content: string

  /** 块索引 */
  index: number

  /** 起始句子索引 */
  startSentence: number

  /** 结束句子索引 */
  endSentence: number

  /** 块内语义连贯性得分 */
  coherenceScore: number

  /** 元数据 */
  metadata?: Record<string, any>
}

/**
 * 专利文档
 */
export interface PatentDocument {
  /** 权利要求 */
  claims?: string

  /** 说明书 */
  description?: string

  /** 摘要 */
  abstract?: string

  /** 标题 */
  title?: string
}

/**
 * 语义分块器
 */
export class SemanticChunker {
  private embeddingClient: BGEM3Client
  private similarityThreshold: number
  private minChunkSize: number
  private maxChunkSize: number

  constructor(config: SemanticChunkerConfig) {
    this.embeddingClient = config.embeddingClient
    this.similarityThreshold = config.similarityThreshold ?? 0.5
    this.minChunkSize = config.minChunkSize ?? 100
    this.maxChunkSize = config.maxChunkSize ?? 2000
  }

  /**
   * 对普通文本进行语义分块
   *
   * 算法：
   * 1. 按句子分割文本（支持中英文）
   * 2. 每句生成嵌入
   * 3. 计算相邻句子余弦相似度
   * 4. 相似度低于阈值处标记为边界
   * 5. 合并相邻小段落（低于 minChunkSize）
   * 6. 拆分过大段落（超过 maxChunkSize）
   * 7. 计算每个块的连贯性得分
   */
  async chunk(text: string): Promise<Chunk[]> {
    // 1. 按句子分割
    const sentences = this.splitSentences(text)

    if (sentences.length === 0) {
      return []
    }

    // 2. 生成嵌入向量
    const embeddings = await this.embeddingClient.embedBatch(sentences)

    // 3. 计算相邻句子相似度
    const similarities: number[] = []
    for (let i = 0; i < embeddings.length - 1; i++) {
      const sim = this.cosineSimilarity(embeddings[i], embeddings[i + 1])
      similarities.push(sim)
    }

    // 4. 标记边界
    const boundaries: number[] = [0] // 第一句起始
    for (let i = 0; i < similarities.length; i++) {
      if (similarities[i] < this.similarityThreshold) {
        boundaries.push(i + 1)
      }
    }
    boundaries.push(sentences.length) // 最后一句结束

    // 5. 生成初始块
    let chunks: Chunk[] = []
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startIdx = boundaries[i]
      const endIdx = boundaries[i + 1]
      const chunkSentences = sentences.slice(startIdx, endIdx)
      const chunkContent = chunkSentences.join('')

      chunks.push({
        content: chunkContent,
        index: i,
        startSentence: startIdx,
        endSentence: endIdx - 1,
        coherenceScore: this.computeCoherence(chunkSentences, embeddings.slice(startIdx, endIdx)),
      })
    }

    // 6. 合并小段落
    chunks = this.mergeSmallChunks(chunks, this.minChunkSize)

    // 7. 拆分大段落
    chunks = this.splitLargeChunks(chunks, this.maxChunkSize)

    // 8. 重新编号并计算连贯性
    chunks = chunks.map((chunk, i) => ({
      ...chunk,
      index: i,
    }))

    return chunks
  }

  /**
   * 专利文档专用分块
   * 按结构（权利要求/说明书/摘要）先分割，再语义分块
   */
  async chunkPatentDocument(doc: PatentDocument): Promise<Chunk[]> {
    const allChunks: Chunk[] = []
    let globalIndex = 0

    // 1. 处理标题（单块）
    if (doc.title && doc.title.trim()) {
      allChunks.push({
        content: doc.title.trim(),
        index: globalIndex++,
        startSentence: 0,
        endSentence: 0,
        coherenceScore: 1.0, // 标题单独一块，连贯性为满分
        metadata: { section: 'title' },
      })
    }

    // 2. 处理摘要（单块）
    if (doc.abstract && doc.abstract.trim()) {
      const abstractChunks = await this.chunk(doc.abstract.trim())
      abstractChunks.forEach((chunk) => {
        allChunks.push({
          ...chunk,
          index: globalIndex++,
          metadata: { ...chunk.metadata, section: 'abstract' },
        })
      })
    }

    // 3. 处理权利要求（每项权利要求单独一块）
    if (doc.claims && doc.claims.trim()) {
      const claims = this.splitClaims(doc.claims.trim())
      for (let i = 0; i < claims.length; i++) {
        allChunks.push({
          content: claims[i].trim(),
          index: globalIndex++,
          startSentence: i,
          endSentence: i,
          coherenceScore: 1.0, // 每项权利要求独立，连贯性为满分
          metadata: {
            section: 'claims',
            claimNumber: i + 1,
            claimType: claims[i].trim().startsWith('1.') ? 'independent' : 'dependent',
          },
        })
      }
    }

    // 4. 处理说明书（语义分块）
    if (doc.description && doc.description.trim()) {
      const descriptionChunks = await this.chunk(doc.description.trim())
      descriptionChunks.forEach((chunk) => {
        allChunks.push({
          ...chunk,
          index: globalIndex++,
          metadata: { ...chunk.metadata, section: 'description' },
        })
      })
    }

    return allChunks
  }

  /**
   * 句子分割（中英文）
   */
  private splitSentences(text: string): string[] {
    // 移除多余空格和换行
    const normalized = text.replace(/\s+/g, ' ').trim()

    if (!normalized) {
      return []
    }

    // 使用正则分割（中文和英文标点）
    const sentences: string[] = []
    let current = ''
    let start = 0

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i]
      const nextChar = normalized[i + 1]

      // 检查是否为句子结束符
      if (
        char === '。' ||
        char === '！' ||
        char === '？' ||
        char === '；' ||
        char === '.' ||
        char === '!' ||
        char === '?' ||
        char === ';'
      ) {
        // 如果下一个字符是引号，继续读取
        if (nextChar === '"') {
          current += char
          continue
        }

        // 提取句子
        let sentence = normalized.substring(start, i + 1).trim()
        if (sentence) {
          sentences.push(sentence)
        }

        // 更新起始位置
        start = i + 1
        current = ''
      }
    }

    // 处理最后一部分（可能没有结束符）
    if (start < normalized.length) {
      const lastSentence = normalized.substring(start).trim()
      if (lastSentence) {
        sentences.push(lastSentence)
      }
    }

    // 过滤空句子
    return sentences.filter((s) => s.length > 0)
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('向量维度不一致')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 合并小段落
   */
  private mergeSmallChunks(chunks: Chunk[], minSize: number): Chunk[] {
    if (chunks.length === 0) {
      return []
    }

    const merged: Chunk[] = []
    let current = chunks[0]

    for (let i = 1; i < chunks.length; i++) {
      const next = chunks[i]

      // 如果当前块太小，与下一块合并
      if (current.content.length < minSize) {
        current = {
          content: current.content + next.content,
          index: current.index,
          startSentence: current.startSentence,
          endSentence: next.endSentence,
          coherenceScore: (current.coherenceScore + next.coherenceScore) / 2,
          metadata: current.metadata,
        }
      } else {
        merged.push(current)
        current = next
      }
    }

    // 添加最后一个块
    merged.push(current)

    return merged
  }

  /**
   * 拆分大段落
   */
  private splitLargeChunks(chunks: Chunk[], maxSize: number): Chunk[] {
    const result: Chunk[] = []

    for (const chunk of chunks) {
      if (chunk.content.length <= maxSize) {
        result.push(chunk)
        continue
      }

      // 需要拆分大段落
      const sentences = this.splitSentences(chunk.content)
      const numParts = Math.ceil(chunk.content.length / maxSize)
      const sentencesPerPart = Math.ceil(sentences.length / numParts)

      for (let i = 0; i < numParts; i++) {
        const startIdx = i * sentencesPerPart
        const endIdx = Math.min(startIdx + sentencesPerPart, sentences.length)
        const partSentences = sentences.slice(startIdx, endIdx)
        const partContent = partSentences.join('')

        if (partContent.length > 0) {
          result.push({
            content: partContent,
            index: chunk.index,
            startSentence: chunk.startSentence + startIdx,
            endSentence: chunk.startSentence + endIdx - 1,
            coherenceScore: chunk.coherenceScore, // 继承原连贯性
            metadata: chunk.metadata,
          })
        }
      }
    }

    return result
  }

  /**
   * 计算块连贯性（块内句子平均相似度）
   */
  private computeCoherence(sentences: string[], embeddings: number[][]): number {
    if (sentences.length <= 1) {
      return 1.0 // 单句连贯性为满分
    }

    let totalSimilarity = 0
    let count = 0

    for (let i = 0; i < embeddings.length - 1; i++) {
      const sim = this.cosineSimilarity(embeddings[i], embeddings[i + 1])
      totalSimilarity += sim
      count++
    }

    return count > 0 ? totalSimilarity / count : 0
  }

  /**
   * 分割权利要求（每项独立）
   */
  private splitClaims(claims: string): string[] {
    // 权利要求通常以数字开头，如 "1. xxx" 或 "2. xxx"
    const claimPattern = /(\d+\.\s)/g
    const parts = claims.split(claimPattern)

    const result: string[] = []
    for (let i = 1; i < parts.length; i += 2) {
      const number = parts[i]
      const content = parts[i + 1] || ''
      if (number && content.trim()) {
        result.push(number + content.trim())
      }
    }

    return result
  }
}

/**
 * 创建语义分块器
 */
export function createSemanticChunker(config: SemanticChunkerConfig): SemanticChunker {
  return new SemanticChunker(config)
}
