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
 * 深度克隆工具函数
 *
 * 处理特殊类型：Date, Map, Set, 循环引用
 */
function deepClone<T>(obj: T, hash = new WeakMap()): T {
  // 处理null和基本类型
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // 处理Date
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }

  // 处理Map
  if (obj instanceof Map) {
    const cloned = new Map()
    obj.forEach((value, key) => {
      cloned.set(key, deepClone(value, hash))
    })
    return cloned as T
  }

  // 处理Set
  if (obj instanceof Set) {
    const cloned = new Set()
    obj.forEach((value) => {
      cloned.add(deepClone(value, hash))
    })
    return cloned as T
  }

  // 处理Array
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item, hash)) as T
  }

  // 处理循环引用
  if (hash.has(obj)) {
    return obj // 返回原对象，避免循环
  }
  hash.set(obj, obj)

  // 处理普通对象
  const cloned = {} as T
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      ;(cloned as Record<string, unknown>)[key] = deepClone(
        (obj as Record<string, unknown>)[key],
        hash
      )
    }
  }

  return cloned
}
import { FileSystemCheckpointStore } from './FileSystemCheckpointStore.js'

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
export class CheckpointManager {
  private checkpoints = new Map<string, Checkpoint>()
  private autoSaveEnabled: boolean
  private autoSaveInterval: number
  private maxCheckpoints: number
  private store?: CheckpointStore
  private sequenceNumbers = new Map<string, number>() // 每个执行的序列号

  constructor(config?: CheckpointManagerConfig) {
    this.autoSaveEnabled = config?.autoSave ?? true
    this.autoSaveInterval = config?.autoSaveInterval ?? 1 // 每次迭代保存
    this.maxCheckpoints = config?.maxCheckpoints ?? 100
    this.store = config?.store
  }

  /**
   * 保存检查点
   */
  async saveCheckpoint(
    agentName: string,
    executionId: string,
    iteration: number,
    memory: Record<string, unknown>,
    context: Record<string, unknown>,
    state: Record<string, unknown>,
    tags?: string[],
    notes?: string
  ): Promise<Checkpoint> {
    // 获取并递增序列号
    const currentSeq = this.sequenceNumbers.get(executionId) ?? 0
    this.sequenceNumbers.set(executionId, currentSeq + 1)

    const checkpoint: Checkpoint = {
      id: this.generateCheckpointId(executionId, iteration, currentSeq),
      agentName,
      executionId,
      timestamp: new Date(),
      iteration,
      memorySnapshot: deepClone(memory), // 使用proper的深拷贝
      contextSnapshot: deepClone(context),
      stateSnapshot: deepClone(state),
      tags,
      notes,
    }

    // 保存到内存
    this.checkpoints.set(checkpoint.id, checkpoint)

    // 如果配置了外部存储，也保存到外部存储
    if (this.store) {
      try {
        await this.store.save(checkpoint)
      } catch (error) {
        console.error({
          message: '[检查点管理器] 保存到外部存储失败',
          checkpointId: checkpoint.id,
          executionId: checkpoint.executionId,
          agentName: checkpoint.agentName,
          iteration: checkpoint.iteration,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        // 不抛出错误，继续使用内存存储
      }
    }

    // 检查是否超过最大数量
    if (this.checkpoints.size > this.maxCheckpoints) {
      this.cleanupOldCheckpoints()
    }

    return checkpoint
  }

  /**
   * 加载检查点
   */
  async loadCheckpoint(checkpointId: string, executionId?: string): Promise<Checkpoint> {
    // 先尝试从内存加载
    let checkpoint = this.checkpoints.get(checkpointId)

    // 如果内存中没有，且配置了外部存储，尝试从外部存储加载
    if (!checkpoint && this.store) {
      try {
        checkpoint = await this.store.load(checkpointId, executionId)

        // 加载到内存
        if (checkpoint) {
          this.checkpoints.set(checkpoint.id, checkpoint)
        }
      } catch (error) {
        console.error({
          message: '[检查点管理器] 从外部存储加载失败',
          checkpointId,
          executionId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    }

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`)
    }

    return checkpoint
  }

  /**
   * 列出所有检查点
   */
  async listCheckpoints(filter?: {
    agentName?: string
    executionId?: string
    tags?: string[]
  }): Promise<Checkpoint[]> {
    let checkpoints: Checkpoint[]

    // 如果配置了外部存储，且指定了executionId，从外部存储加载
    if (this.store && filter?.executionId) {
      try {
        checkpoints = await this.store.listCheckpoints(filter.executionId)
      } catch (error) {
        console.error({
          message: '[检查点管理器] 从外部存储列出检查点失败',
          executionId: filter.executionId,
          agentName: filter.agentName,
          tags: filter.tags,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        // 降级到内存存储
        checkpoints = Array.from(this.checkpoints.values())
      }
    } else {
      // 从内存列出
      checkpoints = Array.from(this.checkpoints.values())
    }

    // 应用过滤条件
    if (filter?.agentName) {
      checkpoints = checkpoints.filter((c) => c.agentName === filter.agentName)
    }

    if (filter?.executionId) {
      checkpoints = checkpoints.filter((c) => c.executionId === filter.executionId)
    }

    if (filter?.tags && filter.tags.length > 0) {
      checkpoints = checkpoints.filter((c) => filter.tags!.some((tag) => c.tags?.includes(tag)))
    }

    return checkpoints.sort((a, b) => a.iteration - b.iteration)
  }

  /**
   * 删除检查点
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    this.checkpoints.delete(checkpointId)

    // 如果配置了外部存储，也从外部存储删除
    if (this.store) {
      try {
        await this.store.delete(checkpointId)
      } catch (error) {
        console.error({
          message: '[检查点管理器] 从外部存储删除失败',
          checkpointId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  /**
   * 清空所有检查点
   */
  async clearCheckpoints(): Promise<void> {
    this.checkpoints.clear()
  }

  /**
   * 列出所有可恢复的执行
   */
  async listResumableExecutions(): Promise<
    Array<{ executionId: string; agentName: string; iteration: number; timestamp: Date }>
  > {
    // 如果配置了外部存储，使用外部存储的方法
    if (
      this.store &&
      'listResumableExecutions' in this.store &&
      typeof (this.store as Record<string, unknown>).listResumableExecutions === 'function'
    ) {
      try {
        return await (
          this.store as {
            listResumableExecutions(): Promise<
              Array<{ executionId: string; agentName: string; iteration: number; timestamp: Date }>
            >
          }
        ).listResumableExecutions()
      } catch (error) {
        console.error(`[检查点管理器] 从外部存储列出执行失败: ${error}`)
      }
    }

    // 降级到内存存储
    const executions = new Map<
      string,
      { executionId: string; agentName: string; iteration: number; timestamp: Date }
    >()

    for (const checkpoint of this.checkpoints.values()) {
      if (!executions.has(checkpoint.executionId)) {
        executions.set(checkpoint.executionId, {
          executionId: checkpoint.executionId,
          agentName: checkpoint.agentName,
          iteration: checkpoint.iteration,
          timestamp: checkpoint.timestamp,
        })
      } else {
        // 更新为最新的迭代
        const existing = executions.get(checkpoint.executionId)!
        if (checkpoint.iteration > existing.iteration) {
          executions.set(checkpoint.executionId, {
            executionId: checkpoint.executionId,
            agentName: checkpoint.agentName,
            iteration: checkpoint.iteration,
            timestamp: checkpoint.timestamp,
          })
        }
      }
    }

    // 按时间戳排序（最新的在前）
    return Array.from(executions.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    )
  }

  /**
   * 获取时间机器
   */
  getTimeMachine(): TimeMachine {
    return new TimeMachineImpl(this.checkpoints)
  }

  /**
   * 生成检查点 ID
   */
  private generateCheckpointId(executionId: string, iteration: number, sequence: number): string {
    return `${executionId}-iter${iteration}-seq${sequence}-${Date.now()}`
  }

  /**
   * 清理旧检查点
   */
  private cleanupOldCheckpoints(): void {
    const sorted = Array.from(this.checkpoints.entries()).sort(
      (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
    )

    // 删除最旧的 10%
    const toDelete = Math.floor(sorted.length * 0.1)
    for (let i = 0; i < toDelete; i++) {
      this.checkpoints.delete(sorted[i][0])
    }
  }
}

/**
 * 时间机器实现
 */
class TimeMachineImpl implements TimeMachine {
  private checkpoints: Map<string, Checkpoint>

  constructor(checkpoints: Map<string, Checkpoint>) {
    this.checkpoints = checkpoints
  }

  async travelBack(checkpointId: string): Promise<Checkpoint> {
    const checkpoint = this.checkpoints.get(checkpointId)

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`)
    }

    console.log(
      `[时间旅行] 回到 ${checkpoint.timestamp.toISOString()} (迭代 ${checkpoint.iteration})`
    )

    return checkpoint
  }

  async replayForward(fromCheckpointId: string, toCheckpointId: string): Promise<Checkpoint[]> {
    const from = this.checkpoints.get(fromCheckpointId)
    const to = this.checkpoints.get(toCheckpointId)

    if (!from || !to) {
      throw new Error('检查点不存在')
    }

    const allCheckpoints = Array.from(this.checkpoints.values())
      .filter((c) => c.executionId === from.executionId)
      .filter((c) => c.iteration >= from.iteration && c.iteration <= to.iteration)
      .sort((a, b) => a.iteration - b.iteration)

    console.log(`[时间旅行] 重放从迭代 ${from.iteration} 到 ${to.iteration}`)

    return allCheckpoints
  }

  async createBranch(checkpointId: string, branchName: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId)

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`)
    }

    // 创建分支：复制检查点并标记为分支
    const branchCheckpoint: Checkpoint = {
      ...checkpoint,
      id: `${branchName}-${checkpoint.iteration}-${Date.now()}`,
      tags: [...(checkpoint.tags || []), `branch:${branchName}`],
      notes: `从 ${checkpointId} 创建的分支`,
    }

    this.checkpoints.set(branchCheckpoint.id, branchCheckpoint)

    console.log(`[时间旅行] 创建分支 "${branchName}" 从迭代 ${checkpoint.iteration}`)
  }

  async mergeBranch(branchName: string): Promise<void> {
    // 简化实现：只是记录日志
    console.log(`[时间旅行] 合并分支 "${branchName}"`)
  }

  async listTimeline(executionId: string): Promise<Checkpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter((c) => c.executionId === executionId)
      .sort((a, b) => a.iteration - b.iteration)
  }
}

/**
 * 增强的记忆存储
 *
 * 在原有基础上添加检查点功能
 */
export class EnhancedMemoryStore implements IMemoryStore {
  private shortTerm = new Map<string, any>()
  private history: MemoryEntry[] = []
  private checkpointManager: CheckpointManager
  private longTermIndex = new Map<string, Set<string>>()

  constructor(checkpointManager?: CheckpointManager) {
    this.checkpointManager = checkpointManager ?? new CheckpointManager()
  }

  /**
   * 读取记忆
   */
  async get(key: string): Promise<unknown> {
    return this.shortTerm.get(key)
  }

  /**
   * 写入记忆
   */
  async set(key: string, value: unknown): Promise<void> {
    this.shortTerm.set(key, value)

    this.history.push({
      key,
      value,
      timestamp: new Date(),
    })

    const textContent = typeof value === 'string' ? value : JSON.stringify(value)
    const tokens = textContent
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}'"\/\\]+/)
      .filter((t) => t.length > 1)
    for (const token of tokens) {
      if (!this.longTermIndex.has(token)) {
        this.longTermIndex.set(token, new Set())
      }
      this.longTermIndex.get(token)!.add(key)
    }
  }

  /**
   * 删除记忆
   */
  async delete(key: string): Promise<void> {
    this.shortTerm.delete(key)
  }

  /**
   * 检查记忆是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.shortTerm.has(key)
  }

  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.shortTerm.entries())
  }

  async setAll(entries: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      this.shortTerm.set(key, value)
      this.history.push({
        key,
        value,
        timestamp: new Date(),
      })
    }
  }

  async clear(): Promise<void> {
    this.shortTerm.clear()
    this.history = []
    this.longTermIndex.clear()
  }

  /**
   * 搜索长期记忆
   */
  async search(query: string, topK = 10): Promise<MemoryEntry[]> {
    const queryTokens = query
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}'"\/\\]+/)
      .filter((t) => t.length > 1)

    const scoreMap = new Map<string, number>()
    for (const token of queryTokens) {
      const matchingKeys = this.longTermIndex.get(token)
      if (matchingKeys) {
        for (const key of matchingKeys) {
          scoreMap.set(key, (scoreMap.get(key) || 0) + 1)
        }
      }

      for (const [indexToken, keys] of this.longTermIndex) {
        if (indexToken !== token && (indexToken.includes(token) || token.includes(indexToken))) {
          for (const key of keys) {
            scoreMap.set(key, (scoreMap.get(key) || 0) + 0.5)
          }
        }
      }
    }

    const rankedKeys = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([key]) => key)

    const results: MemoryEntry[] = []
    for (const key of rankedKeys) {
      const value = this.shortTerm.get(key)
      if (value !== undefined) {
        const historyEntry = this.history
          .filter((h) => h.key === key)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        results.push(historyEntry || { key, value, timestamp: new Date() })
      }
    }

    if (results.length < topK) {
      const existingKeys = new Set(results.map((r) => r.key))
      for (const entry of this.history.slice(-topK).reverse()) {
        if (!existingKeys.has(entry.key) && results.length < topK) {
          results.push(entry)
          existingKeys.add(entry.key)
        }
      }
    }

    return results
  }

  /**
   * 创建检查点
   */
  async createCheckpoint(
    agentName: string,
    executionId: string,
    iteration: number,
    tags?: string[],
    notes?: string
  ): Promise<Checkpoint> {
    const memorySnapshot = Object.fromEntries(this.shortTerm.entries())

    return this.checkpointManager.saveCheckpoint(
      agentName,
      executionId,
      iteration,
      memorySnapshot,
      {}, // context snapshot
      {}, // state snapshot
      tags,
      notes
    )
  }

  /**
   * 恢复检查点
   */
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await this.checkpointManager.loadCheckpoint(checkpointId)

    // 恢复记忆
    this.shortTerm.clear()
    Object.entries(checkpoint.memorySnapshot).forEach(([key, value]) => {
      this.shortTerm.set(key, value)
    })

    console.log(`[检查点] 已恢复到迭代 ${checkpoint.iteration}`)
  }

  /**
   * 列出检查点
   */
  async listCheckpoints(filter?: {
    agentName?: string
    executionId?: string
    tags?: string[]
  }): Promise<Checkpoint[]> {
    return this.checkpointManager.listCheckpoints(filter)
  }

  /**
   * 获取时间机器
   */
  getTimeMachine(): TimeMachine {
    return this.checkpointManager.getTimeMachine()
  }

  /**
   * 获取记忆历史
   */
  getHistory(): MemoryEntry[] {
    return this.history
  }

  /**
   * 记忆压缩
   *
   * 当记忆过多时，压缩为摘要
   */
  async compress(targetSize: number = 100): Promise<void> {
    if (this.history.length <= targetSize) {
      return
    }

    // 简化实现：保留最近的 N 条记录
    this.history = this.history.slice(-targetSize)

    console.log(`[记忆压缩] 已压缩至 ${this.history.length} 条记录`)
  }

  /**
   * 记忆统计
   */
  getStats(): {
    shortTermSize: number
    historySize: number
    checkpointCount: number
  } {
    return {
      shortTermSize: this.shortTerm.size,
      historySize: this.history.length,
      checkpointCount: this.checkpointManager['checkpoints'].size,
    }
  }
}

/**
 * 断点续传管理器
 */
export class ResumeManager {
  private checkpointManager: CheckpointManager

  constructor(checkpointManager: CheckpointManager) {
    this.checkpointManager = checkpointManager
  }

  /**
   * 保存断点
   */
  async saveBreakpoint(
    agentName: string,
    executionId: string,
    iteration: number,
    context: Record<string, unknown>
  ): Promise<Checkpoint> {
    return this.checkpointManager.saveCheckpoint(
      agentName,
      executionId,
      iteration,
      {}, // memory snapshot
      context, // context snapshot
      {}, // state snapshot
      ['breakpoint'], // 标记为断点
      '用户手动断点'
    )
  }

  /**
   * 从断点恢复
   */
  async resumeFromBreakpoint(executionId: string): Promise<Checkpoint | null> {
    const checkpoints = await this.checkpointManager.listCheckpoints({
      executionId,
      tags: ['breakpoint'],
    })

    if (checkpoints.length === 0) {
      return null
    }

    // 返回最新的断点
    return checkpoints[checkpoints.length - 1]
  }

  /**
   * 列出可恢复的断点
   */
  async listResumableExecutions(): Promise<
    Array<{ executionId: string; agentName: string; iteration: number; timestamp: Date }>
  > {
    const checkpoints = await this.checkpointManager.listCheckpoints({
      tags: ['breakpoint'],
    })

    const executions = new Map<string, any>()

    checkpoints.forEach((c) => {
      if (!executions.has(c.executionId)) {
        executions.set(c.executionId, {
          executionId: c.executionId,
          agentName: c.agentName,
          iteration: c.iteration,
          timestamp: c.timestamp,
        })
      }
    })

    return Array.from(executions.values())
  }
}
