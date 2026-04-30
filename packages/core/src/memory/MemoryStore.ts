import { MemoryStore as IMemoryStore, MemoryEntry } from '../lifecycle/Lifecycle.js';

/**
 * 短期记忆实现
 *
 * 提供基于内存的键值存储，用于存储：
 * - 对话历史
 * - 当前上下文
 * - 临时数据
 */
export class ShortTermMemory implements IMemoryStore {
  /** 存储后端 */
  private storage = new Map<string, any>();

  /**
   * 读取记忆
   */
  async get(key: string): Promise<unknown> {
    return this.storage.get(key);
  }

  /**
   * 写入记忆
   */
  async set(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
  }

  /**
   * 删除记忆
   */
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * 检查记忆是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  /**
   * 获取所有记忆
   */
  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.storage.entries());
  }

  /**
   * 清空记忆
   */
  async clear(): Promise<void> {
    this.storage.clear();
  }

  /**
   * 搜索长期记忆
   *
   * 短期记忆不支持向量搜索，返回空数组
   */
  async search(_query: string, _topK = 10): Promise<MemoryEntry[]> {
    // TODO: 集成长期记忆（向量数据库）
    return [];
  }

  /**
   * 获取记忆数量
   */
  size(): number {
    return this.storage.size;
  }
}

/**
 * 记忆管理器
 *
 * 提供记忆的高级操作：
 * - 分层存储（短期/长期）
 * - 记忆压缩
 * - 重要性评分
 */
export class MemoryManager {
  /** 短期记忆 */
  private shortTerm: ShortTermMemory;

  /** 记忆历史（用于压缩） */
  private history: MemoryEntry[] = [];

  constructor() {
    this.shortTerm = new ShortTermMemory();
  }

  /**
   * 获取短期记忆存储
   */
  getShortTerm(): ShortTermMemory {
    return this.shortTerm;
  }

  /**
   * 添加记忆
   */
  async add(key: string, value: unknown): Promise<void> {
    await this.shortTerm.set(key, value);

    // 记录历史
    this.history.push({
      key,
      value,
      timestamp: new Date(),
    });
  }

  /**
   * 获取记忆
   */
  async get(key: string): Promise<unknown> {
    return this.shortTerm.get(key);
  }

  /**
   * 压缩记忆（LRU 算法）
   *
   * 当记忆过多时，删除最旧的记忆
   *
   * @param maxMemories 最大记忆数（默认 100）
   * @returns 删除的记忆数量
   */
  async compress(maxMemories: number = 100): Promise<number> {
    const currentSize = this.history.length;
    if (currentSize <= maxMemories) {
      return 0; // 无需压缩
    }

    // 删除最旧的记忆
    const toDelete = currentSize - maxMemories;
    const deleted = this.history.splice(0, toDelete);

    // 从短期记忆中删除
    for (const entry of deleted) {
      this.shortTerm.delete(entry.key);
    }

    console.log(`[MemoryManager] 压缩记忆：删除 ${toDelete} 条，保留 ${maxMemories} 条`);

    return toDelete;
  }

  /**
   * 获取记忆历史
   */
  getHistory(): MemoryEntry[] {
    return this.history;
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<void> {
    await this.shortTerm.clear();
    this.history = [];
  }
}
