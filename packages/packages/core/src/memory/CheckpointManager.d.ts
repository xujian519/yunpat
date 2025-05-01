/**
 * 记忆层增强 (Memory / State)
 *
 * 添加：
 * - Checkpoint 检查点机制
 * - 时间旅行调试
 * - 断点续传
 */
import { MemoryStore as IMemoryStore, MemoryEntry } from '../lifecycle/Lifecycle.js'
/**
 * 检查点
 */
export interface Checkpoint {
  /** 检查点 ID */
  id: string
  /** 智能体名称 */
  agentName: string
  /** 执行 ID */
  executionId: string
  /** 时间戳 */
  timestamp: Date
  /** 迭代次数 */
  iteration: number
  /** 记忆快照 */
  memorySnapshot: Record<string, unknown>
  /** 上下文快照 */
  contextSnapshot: Record<string, unknown>
  /** 状态快照 */
  stateSnapshot: Record<string, unknown>
  /** 标签 */
  tags?: string[]
  /** 备注 */
  notes?: string
}
/**
 * 时间机器接口
 *
 * 用于时间旅行调试
 */
export interface TimeMachine {
  /** 回到过去 */
  travelBack(checkpointId: string): Promise<Checkpoint>
  /** 前往未来（重放） */
  replayForward(fromCheckpointId: string, toCheckpointId: string): Promise<Checkpoint[]>
  /** 创建分支 */
  createBranch(checkpointId: string, branchName: string): Promise<void>
  /** 合并分支 */
  mergeBranch(branchName: string): Promise<void>
  /** 列出时间线 */
  listTimeline(executionId: string): Promise<Checkpoint[]>
}
/**
 * 检查点存储接口
 */
export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void>
  load(checkpointId: string, executionId?: string): Promise<Checkpoint>
  listCheckpoints(executionId: string): Promise<Checkpoint[]>
  delete(checkpointId: string, executionId?: string): Promise<void>
}
/**
 * 检查点管理器配置
 */
export interface CheckpointManagerConfig {
  /** 是否自动保存，默认为 true */
  autoSave?: boolean
  /** 自动保存间隔（迭代次数），默认为 1 */
  autoSaveInterval?: number
  /** 最大检查点数量，默认为 100 */
  maxCheckpoints?: number
  /** 外部存储（可选） */
  store?: CheckpointStore
}
/**
 * 检查点管理器
 */
export declare class CheckpointManager {
  private checkpoints
  private autoSaveEnabled
  private autoSaveInterval
  private maxCheckpoints
  private store?
  private sequenceNumbers
  constructor(config?: CheckpointManagerConfig)
  /**
   * 保存检查点
   */
  saveCheckpoint(
    agentName: string,
    executionId: string,
    iteration: number,
    memory: Record<string, unknown>,
    context: Record<string, unknown>,
    state: Record<string, unknown>,
    tags?: string[],
    notes?: string
  ): Promise<Checkpoint>
  /**
   * 加载检查点
   */
  loadCheckpoint(checkpointId: string, executionId?: string): Promise<Checkpoint>
  /**
   * 列出所有检查点
   */
  listCheckpoints(filter?: {
    agentName?: string
    executionId?: string
    tags?: string[]
  }): Promise<Checkpoint[]>
  /**
   * 删除检查点
   */
  deleteCheckpoint(checkpointId: string): Promise<void>
  /**
   * 清空所有检查点
   */
  clearCheckpoints(): Promise<void>
  /**
   * 列出所有可恢复的执行
   */
  listResumableExecutions(): Promise<
    Array<{
      executionId: string
      agentName: string
      iteration: number
      timestamp: Date
    }>
  >
  /**
   * 获取时间机器
   */
  getTimeMachine(): TimeMachine
  /**
   * 生成检查点 ID
   */
  private generateCheckpointId
  /**
   * 清理旧检查点
   */
  private cleanupOldCheckpoints
}
/**
 * 增强的记忆存储
 *
 * 在原有基础上添加检查点功能
 */
export declare class EnhancedMemoryStore implements IMemoryStore {
  private shortTerm
  private history
  private checkpointManager
  constructor(checkpointManager?: CheckpointManager)
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
  getAll(): Promise<Record<string, unknown>>
  setAll(entries: Record<string, unknown>): Promise<void>
  clear(): Promise<void>
  /**
   * 搜索长期记忆
   */
  search(_query: string, _topK?: number): Promise<MemoryEntry[]>
  /**
   * 创建检查点
   */
  createCheckpoint(
    agentName: string,
    executionId: string,
    iteration: number,
    tags?: string[],
    notes?: string
  ): Promise<Checkpoint>
  /**
   * 恢复检查点
   */
  restoreCheckpoint(checkpointId: string): Promise<void>
  /**
   * 列出检查点
   */
  listCheckpoints(filter?: {
    agentName?: string
    executionId?: string
    tags?: string[]
  }): Promise<Checkpoint[]>
  /**
   * 获取时间机器
   */
  getTimeMachine(): TimeMachine
  /**
   * 获取记忆历史
   */
  getHistory(): MemoryEntry[]
  /**
   * 记忆压缩
   *
   * 当记忆过多时，压缩为摘要
   */
  compress(targetSize?: number): Promise<void>
  /**
   * 记忆统计
   */
  getStats(): {
    shortTermSize: number
    historySize: number
    checkpointCount: number
  }
}
/**
 * 断点续传管理器
 */
export declare class ResumeManager {
  private checkpointManager
  constructor(checkpointManager: CheckpointManager)
  /**
   * 保存断点
   */
  saveBreakpoint(
    agentName: string,
    executionId: string,
    iteration: number,
    context: Record<string, unknown>
  ): Promise<Checkpoint>
  /**
   * 从断点恢复
   */
  resumeFromBreakpoint(executionId: string): Promise<Checkpoint | null>
  /**
   * 列出可恢复的断点
   */
  listResumableExecutions(): Promise<
    Array<{
      executionId: string
      agentName: string
      iteration: number
      timestamp: Date
    }>
  >
}
//# sourceMappingURL=CheckpointManager.d.ts.map
