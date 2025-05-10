/**
 * OpenClaw 知识图谱适配器（PostgreSQL 版）
 *
 * 从 legal_world_model 数据库的 openclaw_kg_nodes / openclaw_kg_edges 表读取数据
 * 支持语义检索、图遍历、路径查找
 */

import { Pool } from 'pg'

export interface OpenClawNode {
  id: string
  nodeType: string
  name: string
  title: string
  content: string
  metadata?: Record<string, any>
  embedding?: number[]
}

export interface OpenClawEdge {
  from: string
  to: string
  relationType: string
  weight: number
  similarity: number
}

export interface OpenClawGraph {
  nodes: Map<string, OpenClawNode>
  edges: OpenClawEdge[]
  embeddings: Map<string, number[]>
}

export interface OpenClawAdapterConfig {
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  embeddingApiUrl?: string
  embeddingApiKey?: string
  embeddingModel?: string
  rerankApiUrl?: string
  rerankModel?: string
}

export class OpenClawAdapter {
  private pool: Pool
  private initialized = false
  private edgeCache: OpenClawEdge[] | null = null
  private adjacencyCache: Map<string, string[]> | null = null

  private embeddingApiUrl: string
  private embeddingApiKey: string
  private embeddingModel: string
  private rerankApiUrl: string
  private rerankModel: string

  constructor(config?: OpenClawAdapterConfig) {
    this.pool = new Pool({
      host: config?.host || process.env.PG_HOST || 'localhost',
      port: config?.port || parseInt(process.env.PG_PORT || '5432'),
      database: config?.database || process.env.PG_DATABASE || 'legal_world_model',
      user: config?.user || process.env.PG_USER || 'postgres',
      password: config?.password || process.env.PG_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    this.embeddingApiUrl =
      config?.embeddingApiUrl ||
      process.env.EMBEDDING_API_URL ||
      'http://localhost:8009/v1/embeddings'
    this.embeddingApiKey =
      config?.embeddingApiKey || process.env.EMBEDDING_API_KEY || process.env.OMLX_API_KEY || ''
    this.embeddingModel = config?.embeddingModel || process.env.EMBEDDING_MODEL || 'bge-m3-mlx-8bit'
    this.rerankApiUrl =
      config?.rerankApiUrl || process.env.RERANK_API_URL || 'http://localhost:8009/v1/rerank'
    this.rerankModel = config?.rerankModel || process.env.RERANK_MODEL || 'jina-reranker-v3-mlx'
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()

      const stats = await this.getStats()
      console.log(
        `[OpenClaw] ✅ 连接成功: ${stats.nodeCount} 节点, ${stats.edgeCount} 边, ` +
          `${stats.embeddingCount} 嵌入 (${stats.embeddingCoverage})`
      )
      this.initialized = true
    } catch (err) {
      console.warn('[OpenClaw] 初始化失败:', (err as Error).message)
      throw err
    }
  }

  /**
   * 语义检索（向量相似度）
   */
  async semanticSearch(
    queryText: string,
    topK: number = 10
  ): Promise<Array<{ node: OpenClawNode; score: number }>> {
    if (!this.initialized) await this.initialize()

    try {
      // 先尝试向量检索
      const vectorResults = await this.vectorSearch(queryText, topK)
      if (vectorResults.length > 0) return vectorResults

      // 降级到全文检索
      return await this.textSearch(queryText, topK)
    } catch (err) {
      console.warn('[OpenClaw] 语义检索失败:', (err as Error).message)
      return []
    }
  }

  /**
   * 获取节点详情
   */
  async getNode(nodeId: string): Promise<OpenClawNode | null> {
    if (!this.initialized) await this.initialize()

    const result = await this.pool.query(
      `SELECT node_id, node_type, name, title, content, metadata
       FROM openclaw_kg_nodes WHERE node_id = $1`,
      [nodeId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      id: row.node_id,
      nodeType: row.node_type,
      name: row.name,
      title: row.title,
      content: row.content,
      metadata: row.metadata,
    }
  }

  /**
   * 获取节点的邻居
   */
  async getNeighbors(nodeId: string, depth: number = 1): Promise<OpenClawNode[]> {
    if (!this.initialized) await this.initialize()

    if (depth === 1) {
      // 单层邻居：单次查询
      const result = await this.pool.query(
        `SELECT DISTINCT n.node_id, n.node_type, n.name, n.title, n.content, n.metadata
         FROM openclaw_kg_edges e
         JOIN openclaw_kg_nodes n ON (n.node_id = e.from_node_id OR n.node_id = e.to_node_id)
         WHERE (e.from_node_id = $1 OR e.to_node_id = $1) AND n.node_id != $1
         LIMIT 100`,
        [nodeId]
      )
      return result.rows.map(this.rowToNode)
    }

    // 多层邻居：使用递归 CTE
    const result = await this.pool.query(
      `WITH RECURSIVE neighbors AS (
         SELECT to_node_id AS neighbor_id, from_node_id AS via_id, 1 AS d
         FROM openclaw_kg_edges WHERE from_node_id = $1
         UNION ALL
         SELECT from_node_id AS neighbor_id, to_node_id AS via_id, 1 AS d
         FROM openclaw_kg_edges WHERE to_node_id = $1
         UNION
         SELECT e.to_node_id AS neighbor_id, e.from_node_id AS via_id, n.d + 1
         FROM openclaw_kg_edges e
         JOIN neighbors n ON e.from_node_id = n.neighbor_id
         WHERE n.d < $2 AND e.to_node_id != $1
       )
       SELECT DISTINCT ON (neighbor_id) neighbor_id
       FROM neighbors WHERE neighbor_id != $1
       LIMIT 500`,
      [nodeId, depth]
    )

    if (result.rows.length === 0) return []

    const ids = result.rows.map((r: any) => r.neighbor_id)
    const nodesResult = await this.pool.query(
      `SELECT node_id, node_type, name, title, content, metadata
       FROM openclaw_kg_nodes WHERE node_id = ANY($1)`,
      [ids]
    )
    return nodesResult.rows.map(this.rowToNode)
  }

  /**
   * 获取节点之间的关系
   */
  async getEdges(nodeId: string): Promise<OpenClawEdge[]> {
    if (!this.initialized) await this.initialize()

    const result = await this.pool.query(
      `SELECT from_node_id, to_node_id, relation_type, weight, similarity
       FROM openclaw_kg_edges
       WHERE from_node_id = $1 OR to_node_id = $1`,
      [nodeId]
    )

    return result.rows.map((row: any) => ({
      from: row.from_node_id,
      to: row.to_node_id,
      relationType: row.relation_type,
      weight: row.weight,
      similarity: row.similarity,
    }))
  }

  /**
   * BFS 最短路径查找
   */
  async findPath(fromId: string, toId: string, maxDepth: number = 4): Promise<string[]> {
    if (!this.initialized) await this.initialize()

    try {
      const result = await this.pool.query(
        `WITH RECURSIVE search AS (
           SELECT $1::text AS node_id, ARRAY[$1::text] AS path, 0 AS depth
           UNION ALL
           SELECT
             CASE WHEN e.from_node_id = s.node_id THEN e.to_node_id ELSE e.from_node_id END,
             s.path || CASE WHEN e.from_node_id = s.node_id THEN e.to_node_id ELSE e.from_node_id END,
             s.depth + 1
           FROM search s
           JOIN openclaw_kg_edges e ON (e.from_node_id = s.node_id OR e.to_node_id = s.node_id)
           WHERE s.depth < $3
             AND CASE WHEN e.from_node_id = s.node_id THEN e.to_node_id ELSE e.from_node_id END != ALL(s.path)
         )
         SELECT path FROM search WHERE node_id = $2 LIMIT 1`,
        [fromId, toId, maxDepth]
      )

      if (result.rows.length > 0) {
        return result.rows[0].path
      }
    } catch (err) {
      // 递归 CTE 在大数据量时可能超时，降级到内存 BFS
      return this.inMemoryFindPath(fromId, toId, maxDepth)
    }

    return []
  }

  /**
   * 按类型查询节点
   */
  async getNodesByType(
    nodeType: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<OpenClawNode[]> {
    if (!this.initialized) await this.initialize()

    const result = await this.pool.query(
      `SELECT node_id, node_type, name, title, content, metadata
       FROM openclaw_kg_nodes
       WHERE node_type = $1
       ORDER BY node_id
       LIMIT $2 OFFSET $3`,
      [nodeType, limit, offset]
    )

    return result.rows.map(this.rowToNode)
  }

  /**
   * 统计信息
   */
  async getStats() {
    if (!this.initialized) {
      try {
        const client = await this.pool.connect()
        client.release()
      } catch {
        return {
          nodeCount: 0,
          edgeCount: 0,
          embeddingCount: 0,
          embeddingCoverage: '0%',
          nodeTypes: {},
          relationTypes: {},
        }
      }
    }

    try {
      const [nodeRes, edgeRes, embRes, typeRes, relRes] = await Promise.all([
        this.pool.query('SELECT COUNT(*) AS c FROM openclaw_kg_nodes'),
        this.pool.query('SELECT COUNT(*) AS c FROM openclaw_kg_edges'),
        this.pool.query('SELECT COUNT(*) AS c FROM openclaw_kg_nodes WHERE embedding IS NOT NULL'),
        this.pool.query(
          'SELECT node_type, COUNT(*) AS c FROM openclaw_kg_nodes GROUP BY node_type ORDER BY c DESC'
        ),
        this.pool.query(
          'SELECT relation_type, COUNT(*) AS c FROM openclaw_kg_edges GROUP BY relation_type ORDER BY c DESC LIMIT 20'
        ),
      ])

      const nodeCount = parseInt(nodeRes.rows[0]?.c || '0')
      const edgeCount = parseInt(edgeRes.rows[0]?.c || '0')
      const embeddingCount = parseInt(embRes.rows[0]?.c || '0')

      const nodeTypes: Record<string, number> = {}
      for (const row of typeRes.rows) {
        nodeTypes[row.node_type] = parseInt(row.c)
      }

      const relationTypes: Record<string, number> = {}
      for (const row of relRes.rows) {
        relationTypes[row.relation_type] = parseInt(row.c)
      }

      return {
        nodeCount,
        edgeCount,
        embeddingCount,
        embeddingCoverage:
          nodeCount > 0 ? `${((embeddingCount / nodeCount) * 100).toFixed(1)}%` : '0%',
        nodeTypes,
        relationTypes,
      }
    } catch {
      return {
        nodeCount: 0,
        edgeCount: 0,
        embeddingCount: 0,
        embeddingCoverage: '0%',
        nodeTypes: {},
        relationTypes: {},
      }
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.pool.end()
    this.initialized = false
    this.edgeCache = null
    this.adjacencyCache = null
  }

  // ==================== 私有方法 ====================

  private async vectorSearch(
    queryText: string,
    topK: number
  ): Promise<Array<{ node: OpenClawNode; score: number }>> {
    // 1. 将查询文本转为向量
    const queryEmbedding = await this.getQueryEmbedding(queryText)
    if (!queryEmbedding) {
      return this.textSearch(queryText, topK)
    }

    // 2. 用向量在 PostgreSQL 中做近似最近邻检索（取 3x 候选集）
    const candidateCount = Math.min(topK * 3, 50)
    const result = await this.pool.query(
      `SELECT node_id, node_type, name, title, content, metadata,
              1 - (embedding <=> $1::vector) AS similarity
       FROM openclaw_kg_nodes
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryEmbedding), candidateCount]
    )

    if (result.rows.length === 0) {
      return this.textSearch(queryText, topK)
    }

    const candidates = result.rows.map((row: any) => ({
      node: this.rowToNode(row),
      score: parseFloat(row.similarity),
    }))

    // 3. 用 rerank 模型精排（候选集 > topK 时才 rerank）
    if (candidates.length > topK) {
      const reranked = await this.rerank(queryText, candidates)
      if (reranked.length > 0) {
        return reranked.slice(0, topK)
      }
    }

    return candidates.slice(0, topK)
  }

  private async textSearch(
    queryText: string,
    topK: number
  ): Promise<Array<{ node: OpenClawNode; score: number }>> {
    const result = await this.pool.query(
      `SELECT node_id, node_type, name, title, content, metadata
       FROM openclaw_kg_nodes
       WHERE title LIKE $1 OR content LIKE $1 OR name LIKE $1
       ORDER BY
         CASE WHEN title LIKE $1 THEN 1.0
              WHEN content LIKE $1 THEN 0.7
              ELSE 0.4 END DESC
       LIMIT $2`,
      [`%${queryText}%`, topK]
    )

    return result.rows.map((row: any, i: number) => ({
      node: this.rowToNode(row),
      score: 1.0 - i * 0.05,
    }))
  }

  private async inMemoryFindPath(
    fromId: string,
    toId: string,
    maxDepth: number
  ): Promise<string[]> {
    // 加载边到内存（懒加载，仅图遍历时使用）
    if (!this.edgeCache) {
      const result = await this.pool.query(`SELECT from_node_id, to_node_id FROM openclaw_kg_edges`)
      this.edgeCache = result.rows.map((r: any) => ({
        from: r.from_node_id,
        to: r.to_node_id,
        relationType: '',
        weight: 1,
        similarity: 0,
      }))

      this.adjacencyCache = new Map()
      for (const edge of this.edgeCache) {
        const forward = this.adjacencyCache.get(edge.from) || []
        forward.push(edge.to)
        this.adjacencyCache.set(edge.from, forward)

        const backward = this.adjacencyCache.get(edge.to) || []
        backward.push(edge.from)
        this.adjacencyCache.set(edge.to, backward)
      }
    }

    const visited = new Set<string>([fromId])
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]

    while (queue.length > 0) {
      const { id, path } = queue.shift()!
      if (path.length > maxDepth) continue
      if (id === toId) return path

      const neighbors = this.adjacencyCache?.get(id) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({ id: neighbor, path: [...path, neighbor] })
        }
      }
    }

    return []
  }

  private rowToNode(row: any): OpenClawNode {
    return {
      id: row.node_id,
      nodeType: row.node_type,
      name: row.name || '',
      title: row.title || '',
      content: row.content || '',
      metadata: row.metadata || {},
    }
  }

  private async getQueryEmbedding(text: string): Promise<number[] | null> {
    try {
      const resp = await fetch(this.embeddingApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.embeddingApiKey ? { Authorization: `Bearer ${this.embeddingApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: [text.slice(0, 2000)],
          encoding_format: 'float',
        }),
      })

      if (!resp.ok) return null

      const data = (await resp.json()) as any
      const embeddings = data?.data?.[0]?.embedding
      if (Array.isArray(embeddings) && embeddings.length > 0) {
        return embeddings
      }
      return null
    } catch {
      return null
    }
  }

  private async rerank(
    queryText: string,
    candidates: Array<{ node: OpenClawNode; score: number }>
  ): Promise<Array<{ node: OpenClawNode; score: number }>> {
    try {
      const documents = candidates.map((c) => `${c.node.title}\n${c.node.content}`.slice(0, 500))

      const resp = await fetch(this.rerankApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.embeddingApiKey ? { Authorization: `Bearer ${this.embeddingApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.rerankModel,
          query: queryText,
          documents,
        }),
      })

      if (!resp.ok) return []

      const data = (await resp.json()) as any
      const results = data?.results
      if (!Array.isArray(results)) return []

      return results
        .sort((a: any, b: any) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
        .map((r: any) => {
          const original = candidates[r.index]
          return {
            node: original.node,
            score: Math.max(0, r.relevance_score ?? original.score),
          }
        })
    } catch {
      return []
    }
  }
}

/**
 * Python 转换脚本（保留向后兼容）
 * @deprecated 不再需要，数据直接导入 PostgreSQL
 */
export const PYTHON_CONVERT_SCRIPT = `
# 已废弃 - 请使用 scripts/migrate_openclaw_kg.py 直接迁移到 PostgreSQL
`
