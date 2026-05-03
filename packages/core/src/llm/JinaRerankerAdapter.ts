/**
 * Jina Reranker V3 适配器
 *
 * 本地 Jina Reranker 模型，用于文档重排序
 * 用途: RAG 检索后重排序，提升准确率
 */

/**
 * 重排序结果
 */
export interface RerankResult {
  /** 原始索引 */
  index: number

  /** 文档内容 */
  document: string

  /** 相关性分数 */
  relevanceScore: number

  /** 排名 */
  rank: number
}

/**
 * 重排序配置
 */
export interface RerankConfig {
  /** API 基础 URL */
  baseURL: string

  /** API 密钥 */
  apiKey: string

  /** 模型名称 */
  modelName?: string

  /** 超时时间（毫秒） */
  timeout?: number

  /** Top K（返回前 K 个结果） */
  topK?: number
}

/**
 * Jina Reranker 适配器
 */
export class JinaRerankerAdapter {
  private config: Required<RerankConfig>

  constructor(config: RerankConfig) {
    this.config = {
      ...config,
      modelName: config.modelName || 'jina-reranker-v3-mlx',
      topK: config.topK || 10,
      timeout: config.timeout || 60000,
    }
  }

  /**
   * 重排序文档
   *
   * @param query 查询文本
   * @param documents 文档列表
   * @param topK 返回前 K 个结果（可选，覆盖配置）
   * @returns 重排序后的文档列表
   */
  async rerank(query: string, documents: string[], topK?: number): Promise<RerankResult[]> {
    const url = `${this.config.baseURL}/rerank`
    const k = topK ?? this.config.topK

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.modelName,
          query,
          documents,
          top_n: k,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      })

      if (!response.ok) {
        throw new Error(`Jina Reranker API 请求失败: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as {
        results: Array<{
          index: number
          relevance_score: number
          document: { text: string }
        }>
      }

      // 转换结果格式
      const results: RerankResult[] = data.results.map((item, rank) => ({
        index: item.index,
        document: item.document.text,
        relevanceScore: item.relevance_score,
        rank: rank + 1,
      }))

      return results
    } catch (error) {
      throw new Error(
        `Jina Reranker 重排序失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 重排序并返回文档内容
   *
   * @param query 查询文本
   * @param documents 文档列表
   * @param topK 返回前 K 个结果
   * @returns 重排序后的文档内容列表
   */
  async rerankAndExtract(query: string, documents: string[], topK?: number): Promise<string[]> {
    const results = await this.rerank(query, documents, topK)
    return results.map((r) => r.document)
  }

  /**
   * RAG 管道：检索后重排序
   *
   * @param query 查询文本
   * @param candidates 候选文档（从向量检索获得）
   * @param topK 最终返回的文档数量
   * @returns 重排序后的 Top K 文档
   */
  async ragPipeline(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ document: string; score: number; rank: number }>> {
    console.log(`\n🔍 RAG 重排序管道`)
    console.log(`📝 查询: ${query}`)
    console.log(`📦 候选文档: ${candidates.length} 个`)
    console.log(`🎯 返回 Top: ${topK} 个\n`)

    const results = await this.rerank(query, candidates, topK)

    console.log(`✅ 重排序完成:`)
    results.forEach((r) => {
      console.log(
        `   ${r.rank}. [分数: ${r.relevanceScore.toFixed(4)}] ${r.document.substring(0, 50)}...`
      )
    })

    return results.map((r) => ({
      document: r.document,
      score: r.relevanceScore,
      rank: r.rank,
    }))
  }

  /**
   * 批量重排序
   *
   * @param queries 查询列表
   * @param documentsList 对应的文档列表
   * @param topK 每个查询返回的文档数量
   * @returns 重排序结果列表
   */
  async rerankBatch(
    queries: string[],
    documentsList: string[][],
    topK?: number
  ): Promise<RerankResult[][]> {
    if (queries.length !== documentsList.length) {
      throw new Error('查询列表和文档列表长度不匹配')
    }

    const results: RerankResult[][] = []

    for (let i = 0; i < queries.length; i++) {
      const result = await this.rerank(queries[i], documentsList[i], topK)
      results.push(result)
      console.log(`✅ 已处理 ${i + 1}/${queries.length} 个查询`)
    }

    return results
  }

  /**
   * 计算重排序提升
   *
   * 对比重排序前后的相关性分数
   */
  calculateImprovement(
    beforeScores: number[],
    afterResults: RerankResult[]
  ): {
    beforeAvg: number
    afterAvg: number
    improvement: number
    improvementPercent: number
  } {
    const beforeAvg = beforeScores.reduce((a, b) => a + b, 0) / beforeScores.length
    const afterAvg =
      afterResults.slice(0, beforeScores.length).reduce((a, b) => a + b.relevanceScore, 0) /
      afterResults.length
    const improvement = afterAvg - beforeAvg
    const improvementPercent = (improvement / beforeAvg) * 100

    return {
      beforeAvg,
      afterAvg,
      improvement,
      improvementPercent,
    }
  }
}

/**
 * 快速创建 Jina Reranker 适配器
 */
export function createJinaReranker(apiKey?: string, topK?: number): JinaRerankerAdapter {
  return new JinaRerankerAdapter({
    baseURL: 'http://localhost:8009/v1',
    apiKey: apiKey || process.env.OMXL_API_KEY || '',
    modelName: 'jina-reranker-v3-mlx',
    topK: topK || 10,
    timeout: 60000,
  })
}

/**
 * 便捷的 RAG 管道函数
 *
 * @param query 查询文本
 * @param candidates 候选文档
 * @param topK 返回数量
 * @param apiKey API 密钥
 * @returns 重排序后的文档
 */
export async function rerankRAG(
  query: string,
  candidates: string[],
  topK: number = 5,
  apiKey?: string
): Promise<string[]> {
  const reranker = createJinaReranker(apiKey, topK)
  return reranker.rerankAndExtract(query, candidates, topK)
}
