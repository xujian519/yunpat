/**
 * PostgreSQL 向量存储实现
 *
 * 基于 pgvector 扩展的向量搜索
 * 支持：
 * - HNSW 索引加速（m=16, ef_construction=64）
 * - 元数据过滤（JSONB）
 * - 混合检索（向量 + 关键词）
 * - 批量操作（连接池优化）
 * - 性能监控（查询计时）
 */
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { memories } from './schema.js'
/**
 * PostgreSQL 向量存储类
 *
 * 核心功能：
 * 1. 向量相似度搜索（余弦距离）
 * 2. 元数据过滤
 * 3. 批量操作
 * 4. 自动索引优化
 */
export class PostgresVectorStore {
  db
  vectorDimension
  client
  enablePerformanceMonitoring
  performanceMetrics = new Map()
  constructor(config) {
    this.vectorDimension = config.vectorDimension ?? 1024 // BGE-M3 默认维度（必须匹配）
    this.enablePerformanceMonitoring = config.enablePerformanceMonitoring ?? false
    // 创建 PostgreSQL 连接（优化的连接池配置）
    this.client = postgres(config.databaseUrl, {
      max: config.poolMax ?? 20, // 增加连接池大小以支持并发
      idle_timeout: config.poolIdleTimeout ?? 20,
      connect_timeout: config.poolConnectTimeout ?? 10,
      max_lifetime: 60 * 30, // 连接最大生命周期 30 分钟
    })
    this.db = drizzle(this.client)
  }
  /**
   * 记录性能指标
   */
  recordMetric(operation, duration) {
    if (!this.enablePerformanceMonitoring) return
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, [])
    }
    const metrics = this.performanceMetrics.get(operation)
    metrics.push(duration)
    // 只保留最近 100 条记录
    if (metrics.length > 100) {
      metrics.shift()
    }
  }
  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    const stats = {}
    for (const [operation, durations] of this.performanceMetrics.entries()) {
      if (durations.length === 0) continue
      const sum = durations.reduce((a, b) => a + b, 0)
      stats[operation] = {
        avg: sum / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        count: durations.length,
      }
    }
    return stats
  }
  /**
   * 清空性能指标
   */
  clearPerformanceStats() {
    this.performanceMetrics.clear()
  }
  /**
   * 初始化数据库（创建表和索引）
   */
  async initialize() {
    try {
      // 1. 启用 pgvector 扩展
      await this.client`
        CREATE EXTENSION IF NOT EXISTS vector;
      `
      // 2. 创建 embedding 列（如果不存在）
      const columnExists = await this.client`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'memories'
        AND column_name = 'embedding'
      `
      if (columnExists.length === 0) {
        // 直接创建 vector(1024) 类型的列
        const dimension = this.vectorDimension
        const zeroVector = Array(dimension).fill(0)
        const sql = `ALTER TABLE memories ADD COLUMN embedding vector(${dimension}) NOT NULL DEFAULT '${JSON.stringify(zeroVector)}'::vector(${dimension})`
        await this.client.unsafe(sql)
        console.log('✅ embedding 列创建成功（vector 类型）')
      } else if (columnExists[0]?.data_type !== 'user-defined') {
        // 如果列存在但不是 vector 类型，需要转换
        console.warn('⚠️  embedding 列类型不正确，正在转换...')
        // 先删除旧的列（如果有数据，会丢失）
        await this.client`ALTER TABLE memories DROP COLUMN IF EXISTS embedding`
        // 重新创建为 vector 类型
        const dimension = this.vectorDimension
        const zeroVector = Array(dimension).fill(0)
        const sql = `ALTER TABLE memories ADD COLUMN embedding vector(${dimension}) NOT NULL DEFAULT '${JSON.stringify(zeroVector)}'::vector(${dimension})`
        await this.client.unsafe(sql)
        console.log('✅ embedding 列类型已转换')
      }
      // 3. 创建 HNSW 索引（如果不存在）
      const indexExists = await this.client`
        SELECT indexname
        FROM pg_indexes
        WHERE indexname = 'memories_embedding_hnsw_idx'
      `
      if (indexExists.length === 0) {
        const sql = `CREATE INDEX memories_embedding_hnsw_idx ON memories USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`
        await this.client.unsafe(sql)
        console.log('✅ HNSW 索引创建成功')
      }
      console.log('✅ PostgreSQL 向量存储初始化完成')
    } catch (error) {
      console.error('❌ 初始化失败:', error)
      throw error
    }
  }
  /**
   * 插入或更新记忆
   */
  async upsert(memory) {
    const now = new Date()
    // 将数组转换为 vector 类型格式的字符串
    const embeddingString =
      typeof memory.embedding === 'string' ? memory.embedding : JSON.stringify(memory.embedding)
    if (memory.id) {
      // 更新
      await this.db
        .update(memories)
        .set({
          type: memory.type,
          content: memory.content,
          embedding: sql`${embeddingString}::vector(1024)`,
          metadata: memory.metadata,
          isArchived: memory.isArchived ?? false,
          updatedAt: now,
        })
        .where(eq(memories.id, memory.id))
      return memory.id
    } else {
      // 插入
      const result = await this.db
        .insert(memories)
        .values({
          type: memory.type,
          content: memory.content,
          embedding: sql`${embeddingString}::vector(1024)`,
          metadata: memory.metadata ?? null,
          isArchived: memory.isArchived ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: memories.id })
      return result[0].id
    }
  }
  /**
   * 批量插入记忆（真批量，单次 SQL）
   *
   * 性能优化：
   * - 使用 VALUES 批量插入
   * - 分批处理避免内存溢出
   * - 并行处理更新操作
   */
  async upsertBatch(items) {
    const startTime = Date.now()
    const now = new Date()
    const ids = []
    try {
      // 分离新增和更新
      const toInsert = items.filter((item) => !item.id)
      const toUpdate = items.filter((item) => item.id)
      // 批量插入（分批处理，每批 1000 条）
      const batchSize = 1000
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize)
        const values = batch.map((item) => ({
          type: item.type,
          content: item.content,
          embedding: sql`${typeof item.embedding === 'string' ? item.embedding : JSON.stringify(item.embedding)}::vector(1024)`,
          metadata: item.metadata ?? null,
          isArchived: item.isArchived ?? false,
          createdAt: now,
          updatedAt: now,
        }))
        const results = await this.db.insert(memories).values(values).returning({ id: memories.id })
        ids.push(...results.map((r) => r.id))
      }
      // 并行处理更新操作（限制并发数）
      const updateConcurrency = 10
      for (let i = 0; i < toUpdate.length; i += updateConcurrency) {
        const batch = toUpdate.slice(i, i + updateConcurrency)
        await Promise.all(
          batch.map(async (item) => {
            if (item.id) {
              await this.db
                .update(memories)
                .set({
                  type: item.type,
                  content: item.content,
                  embedding: sql`${JSON.stringify(item.embedding)}::vector(1024)`,
                  metadata: item.metadata,
                  isArchived: item.isArchived ?? false,
                  updatedAt: now,
                })
                .where(eq(memories.id, item.id))
              ids.push(item.id)
            }
          })
        )
      }
      // 记录性能指标
      const duration = Date.now() - startTime
      this.recordMetric('upsert_batch', duration)
      this.recordMetric('upsert_batch_count', items.length)
      return ids
    } catch (error) {
      const duration = Date.now() - startTime
      this.recordMetric('upsert_batch_error', duration)
      throw error
    }
  }
  /**
   * 向量相似度搜索（核心功能）
   *
   * 使用余弦距离计算相似度
   * 返回 Top-K 最相似的记录
   *
   * 性能优化：
   * - HNSW 索引加速
   * - 参数化查询防止 SQL 注入
   * - 性能监控
   */
  async search(queryEmbedding, topK = 10, filter) {
    const startTime = Date.now()
    try {
      // 验证向量维度
      if (queryEmbedding.length !== this.vectorDimension) {
        throw new Error(
          `向量维度不匹配：期望 ${this.vectorDimension}，实际 ${queryEmbedding.length}`
        )
      }
      // 构建查询条件
      const conditions = []
      if (filter?.types && filter.types.length > 0) {
        conditions.push(inArray(memories.type, filter.types))
      }
      if (filter?.tags && filter.tags.length > 0) {
        // JSONB 数组包含查询（使用参数化查询）
        for (const tag of filter.tags) {
          conditions.push(sql`${memories.metadata}->'tags' @> ${JSON.stringify([tag])}::jsonb`)
        }
      }
      if (filter?.agent) {
        conditions.push(sql`${memories.metadata}->>'agent' = ${filter.agent}`)
      }
      if (filter?.userId) {
        conditions.push(sql`${memories.metadata}->>'userId' = ${filter.userId}`)
      }
      if (filter?.excludeArchived) {
        conditions.push(eq(memories.isArchived, false))
      }
      if (filter?.createdAtAfter) {
        conditions.push(sql`${memories.createdAt} >= ${filter.createdAtAfter}`)
      }
      if (filter?.createdAtBefore) {
        conditions.push(sql`${memories.createdAt} <= ${filter.createdAtBefore}`)
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined
      // 执行向量搜索（使用余弦距离）
      const embeddingStr = JSON.stringify(queryEmbedding)
      const results = await this.db
        .select({
          id: memories.id,
          content: memories.content,
          metadata: memories.metadata,
          type: memories.type,
          similarity: sql`1 - (${memories.embedding} <=> ${embeddingStr}::vector)`,
        })
        .from(memories)
        .where(whereClause)
        .orderBy(desc(sql`1 - (${memories.embedding} <=> ${embeddingStr}::vector)`))
        .limit(topK)
      // 记录性能指标
      const duration = Date.now() - startTime
      this.recordMetric('search', duration)
      return results
    } catch (error) {
      // 记录错误性能指标
      const duration = Date.now() - startTime
      this.recordMetric('search_error', duration)
      throw error
    }
  }
  /**
   * 获取记忆详情
   */
  async get(id) {
    const result = await this.db.select().from(memories).where(eq(memories.id, id)).limit(1)
    return result[0] || null
  }
  /**
   * 删除记忆
   */
  async delete(id) {
    // 先检查是否存在
    const existing = await this.get(id)
    if (!existing) return false
    await this.db.delete(memories).where(eq(memories.id, id))
    return true
  }
  /**
   * 归档旧记忆（冷数据分离）
   */
  async archiveOldMemories(daysToKeep = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    // 先统计符合条件的记录数
    const countResult = await this.db
      .select({ count: sql`count(*)::int` })
      .from(memories)
      .where(and(eq(memories.isArchived, false), sql`${memories.createdAt} < ${cutoffDate}`))
    const affectedRows = countResult[0]?.count ?? 0
    // 执行归档
    await this.db
      .update(memories)
      .set({ isArchived: true })
      .where(and(eq(memories.isArchived, false), sql`${memories.createdAt} < ${cutoffDate}`))
    return affectedRows
  }
  /**
   * 获取统计信息
   */
  async getStats() {
    const total = await this.db.select({ count: sql`count(*)::int` }).from(memories)
    const archived = await this.db
      .select({ count: sql`count(*)::int` })
      .from(memories)
      .where(eq(memories.isArchived, true))
    const types = await this.db
      .select({
        type: memories.type,
        count: sql`count(*)::int`,
      })
      .from(memories)
      .groupBy(memories.type)
    const typeDistribution = {}
    for (const row of types) {
      typeDistribution[row.type] = row.count
    }
    return {
      totalMemories: total[0].count,
      archivedMemories: archived[0].count,
      typeDistribution,
    }
  }
  /**
   * 清空所有数据（危险操作！）
   */
  async clear() {
    await this.db.delete(memories)
  }
  /**
   * 关闭连接
   */
  async close() {
    await this.client.end()
  }
}
/**
 * 创建 PostgreSQL 向量存储实例
 */
export async function createPostgresVectorStore(config) {
  const store = new PostgresVectorStore(config)
  await store.initialize()
  return store
}
//# sourceMappingURL=PostgresVectorStore.js.map
