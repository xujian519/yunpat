/**
 * 记忆存储模块
 *
 * 提供基础的记忆存储功能
 * 为了向后兼容，保留原有接口
 */
import { MemoryStore as IMemoryStore, MemoryEntry } from '../lifecycle/Lifecycle.js'
import { PostgresVectorStore } from './long-term/PostgresVectorStore.js'
/**
 * 短期记忆实现
 *
 * 提供基于内存的键值存储，用于存储：
 * - 对话历史
 * - 当前上下文
 * - 临时数据
 *
 * 可选集成长期记忆向量存储进行语义搜索
 */
export declare class ShortTermMemory implements IMemoryStore {
  /** 存储后端 */
  protected storage: Map<string, unknown>
  /** 长期记忆向量存储（可选） */
  protected vectorStore?: PostgresVectorStore
  /** 查询向量生成器（可选） */
  protected embeddingGenerator?: (query: string) => Promise<number[]>
  constructor(
    vectorStore?: PostgresVectorStore,
    embeddingGenerator?: (query: string) => Promise<number[]>
  )
  /**
   * 设置长期记忆存储
   */
  setVectorStore(
    vectorStore: PostgresVectorStore,
    embeddingGenerator: (query: string) => Promise<number[]>
  ): void
  /**
   * 读取记忆
   */
  get(key: string): Promise<unknown>
  /**
   * 写入记忆
   */
  set(key: string, value: unknown): Promise<void>
  /**
   * 删除记忆
   */
  delete(key: string): Promise<void>
  /**
   * 检查记忆是否存在
   */
  has(key: string): Promise<boolean>
  /**
   * 获取所有记忆
   */
  getAll(): Promise<Record<string, unknown>>
  /**
   * 批量写入记忆
   */
  setAll(entries: Record<string, unknown>): Promise<void>
  /**
   * 清空记忆
   */
  clear(): Promise<void>
  /**
   * 搜索长期记忆（向量语义搜索）
   *
   * 如果配置了向量存储，则进行语义搜索；否则返回空数组
   *
   * @param query 搜索查询文本
   * @param topK 返回前 K 个结果
   * @param filter 可选的过滤条件
   * @returns 相关记忆列表
   */
  search(
    query: string,
    topK?: number,
    filter?: {
      types?: string[]
      tags?: string[]
      agent?: string
      userId?: string
      excludeArchived?: boolean
    }
  ): Promise<MemoryEntry[]>
  /**
   * 获取记忆数量
   */
  size(): number
}
/**
 * 记忆管理器
 *
 * 提供记忆的高级操作：
 * - 分层存储（短期/长期）
 * - 记忆压缩
 * - 重要性评分
 */
export declare class MemoryManager {
  /** 短期记忆 */
  private shortTerm
  /** 记忆历史（用于压缩） */
  private history
  constructor()
  /**
   * 获取短期记忆存储
   */
  getShortTerm(): ShortTermMemory
  /**
   * 添加记忆
   */
  add(key: string, value: unknown): Promise<void>
  /**
   * 获取记忆
   */
  get(key: string): Promise<unknown>
  /**
   * 压缩记忆（LRU 算法）
   *
   * 当记忆过多时，删除最旧的记忆
   *
   * @param maxMemories 最大记忆数（默认 100）
   * @returns 删除的记忆数量
   */
  compress(maxMemories?: number): Promise<number>
  /**
   * 获取记忆历史
   */
  getHistory(): MemoryEntry[]
  /**
   * 清空所有记忆
   */
  clear(): Promise<void>
}
//# sourceMappingURL=MemoryStore.d.ts.map
