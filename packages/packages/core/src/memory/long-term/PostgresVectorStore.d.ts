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
import { type Memory, type NewMemory } from './schema.js'
/**
 * 向量相似度结果
 */
export interface SimilarityResult {
  /** 记忆 ID */
  id: number
  /** 记忆内容 */
  content: string
  /** 相似度分数（0-1） */
  similarity: number
  /** 元数据 */
  metadata: Record<string, any> | null
  /** 记忆类型 */
  type: string
}
/**
 * 搜索过滤条件
 */
export interface SearchFilter {
  /** 记忆类型 */
  types?: string[]
  /** 标签过滤 */
  tags?: string[]
  /** 智能体名称 */
  agent?: string
  /** 用户 ID */
  userId?: string
  /** 排除归档数据 */
  excludeArchived?: boolean
  /** 创建时间范围 */
  createdAtAfter?: Date
  createdAtBefore?: Date
}
/**
 * PostgreSQL 向量存储配置
 */
export interface PostgresVectorStoreConfig {
  /** 数据库连接 URL */
  databaseUrl: string
  /** 向量维度（默认 BGE-M3: 1024） */
  vectorDimension?: number
  /** HNSW 索引参数（M: 连接数，ef_construction: 构建时参数） */
  hnswM?: number
  hnswEfConstruction?: number
  /** 连接池配置 */
  poolMax?: number
  poolIdleTimeout?: number
  poolConnectTimeout?: number
  /** 性能监控 */
  enablePerformanceMonitoring?: boolean
}
/**
 * PostgreSQL 向量存储类
 *
 * 核心功能：
 * 1. 向量相似度搜索（余弦距离）
 * 2. 元数据过滤
 * 3. 批量操作
 * 4. 自动索引优化
 */
export declare class PostgresVectorStore {
  private db
  private vectorDimension
  private client
  private enablePerformanceMonitoring
  private performanceMetrics
  constructor(config: PostgresVectorStoreConfig)
  /**
   * 记录性能指标
   */
  private recordMetric
  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): Record<
    string,
    {
      avg: number
      min: number
      max: number
      count: number
    }
  >
  /**
   * 清空性能指标
   */
  clearPerformanceStats(): void
  /**
   * 初始化数据库（创建表和索引）
   */
  initialize(): Promise<void>
  /**
   * 插入或更新记忆
   */
  upsert(
    memory: NewMemory & {
      id?: number
    }
  ): Promise<number>
  /**
   * 批量插入记忆（真批量，单次 SQL）
   *
   * 性能优化：
   * - 使用 VALUES 批量插入
   * - 分批处理避免内存溢出
   * - 并行处理更新操作
   */
  upsertBatch(
    items: Array<
      NewMemory & {
        id?: number
      }
    >
  ): Promise<number[]>
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
  search(
    queryEmbedding: number[],
    topK?: number,
    filter?: SearchFilter
  ): Promise<SimilarityResult[]>
  /**
   * 获取记忆详情
   */
  get(id: number): Promise<Memory | null>
  /**
   * 删除记忆
   */
  delete(id: number): Promise<boolean>
  /**
   * 归档旧记忆（冷数据分离）
   */
  archiveOldMemories(daysToKeep?: number): Promise<number>
  /**
   * 获取统计信息
   */
  getStats(): Promise<{
    totalMemories: number
    archivedMemories: number
    typeDistribution: Record<string, number>
  }>
  /**
   * 清空所有数据（危险操作！）
   */
  clear(): Promise<void>
  /**
   * 关闭连接
   */
  close(): Promise<void>
}
/**
 * 创建 PostgreSQL 向量存储实例
 */
export declare function createPostgresVectorStore(
  config: PostgresVectorStoreConfig
): Promise<PostgresVectorStore>
//# sourceMappingURL=PostgresVectorStore.d.ts.map
