/**
 * 记忆层增强 (Memory / State)
 *
 * 添加：
 * - Checkpoint 检查点机制
 * - 时间旅行调试
 * - 断点续传
 */

import { MemoryStore as IMemoryStore, MemoryEntry } from '../lifecycle/Lifecycle.js';

/**
 * 检查点
 */
export interface Checkpoint {
  /** 检查点 ID */
  id: string;

  /** 智能体名称 */
  agentName: string;

  /** 执行 ID */
  executionId: string;

  /** 时间戳 */
  timestamp: Date;

  /** 迭代次数 */
  iteration: number;

  /** 记忆快照 */
  memorySnapshot: Record<string, unknown>;

  /** 上下文快照 */
  contextSnapshot: Record<string, unknown>;

  /** 状态快照 */
  stateSnapshot: Record<string, unknown>;

  /** 标签 */
  tags?: string[];

  /** 备注 */
  notes?: string;
}

/**
 * 时间机器接口
 *
 * 用于时间旅行调试
 */
export interface TimeMachine {
  /** 回到过去 */
  travelBack(checkpointId: string): Promise<Checkpoint>;

  /** 前往未来（重放） */
  replayForward(fromCheckpointId: string, toCheckpointId: string): Promise<Checkpoint[]>;

  /** 创建分支 */
  createBranch(checkpointId: string, branchName: string): Promise<void>;

  /** 合并分支 */
  mergeBranch(branchName: string): Promise<void>;

  /** 列出时间线 */
  listTimeline(executionId: string): Promise<Checkpoint[]>;
}

/**
 * 检查点管理器
 */
export class CheckpointManager {
  private checkpoints = new Map<string, Checkpoint>();
  private autoSaveEnabled: boolean;
  private autoSaveInterval: number;
  private maxCheckpoints: number;

  constructor(config?: { autoSave?: boolean; autoSaveInterval?: number; maxCheckpoints?: number }) {
    this.autoSaveEnabled = config?.autoSave ?? true;
    this.autoSaveInterval = config?.autoSaveInterval ?? 1; // 每次迭代保存
    this.maxCheckpoints = config?.maxCheckpoints ?? 100;
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
    const checkpoint: Checkpoint = {
      id: this.generateCheckpointId(executionId, iteration),
      agentName,
      executionId,
      timestamp: new Date(),
      iteration,
      memorySnapshot: JSON.parse(JSON.stringify(memory)), // 深拷贝
      contextSnapshot: JSON.parse(JSON.stringify(context)),
      stateSnapshot: JSON.parse(JSON.stringify(state)),
      tags,
      notes,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);

    // 检查是否超过最大数量
    if (this.checkpoints.size > this.maxCheckpoints) {
      this.cleanupOldCheckpoints();
    }

    return checkpoint;
  }

  /**
   * 加载检查点
   */
  async loadCheckpoint(checkpointId: string): Promise<Checkpoint> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`);
    }

    return checkpoint;
  }

  /**
   * 列出所有检查点
   */
  async listCheckpoints(filter?: {
    agentName?: string;
    executionId?: string;
    tags?: string[];
  }): Promise<Checkpoint[]> {
    let checkpoints = Array.from(this.checkpoints.values());

    if (filter?.agentName) {
      checkpoints = checkpoints.filter((c) => c.agentName === filter.agentName);
    }

    if (filter?.executionId) {
      checkpoints = checkpoints.filter((c) => c.executionId === filter.executionId);
    }

    if (filter?.tags && filter.tags.length > 0) {
      checkpoints = checkpoints.filter((c) => filter.tags!.some((tag) => c.tags?.includes(tag)));
    }

    return checkpoints.sort((a, b) => a.iteration - b.iteration);
  }

  /**
   * 删除检查点
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    this.checkpoints.delete(checkpointId);
  }

  /**
   * 清空所有检查点
   */
  async clearCheckpoints(): Promise<void> {
    this.checkpoints.clear();
  }

  /**
   * 获取时间机器
   */
  getTimeMachine(): TimeMachine {
    return new TimeMachineImpl(this.checkpoints);
  }

  /**
   * 生成检查点 ID
   */
  private generateCheckpointId(executionId: string, iteration: number): string {
    return `${executionId}-iter${iteration}-${Date.now()}`;
  }

  /**
   * 清理旧检查点
   */
  private cleanupOldCheckpoints(): void {
    const sorted = Array.from(this.checkpoints.entries()).sort(
      (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
    );

    // 删除最旧的 10%
    const toDelete = Math.floor(sorted.length * 0.1);
    for (let i = 0; i < toDelete; i++) {
      this.checkpoints.delete(sorted[i][0]);
    }
  }
}

/**
 * 时间机器实现
 */
class TimeMachineImpl implements TimeMachine {
  private checkpoints: Map<string, Checkpoint>;

  constructor(checkpoints: Map<string, Checkpoint>) {
    this.checkpoints = checkpoints;
  }

  async travelBack(checkpointId: string): Promise<Checkpoint> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`);
    }

    console.log(
      `[时间旅行] 回到 ${checkpoint.timestamp.toISOString()} (迭代 ${checkpoint.iteration})`
    );

    return checkpoint;
  }

  async replayForward(fromCheckpointId: string, toCheckpointId: string): Promise<Checkpoint[]> {
    const from = this.checkpoints.get(fromCheckpointId);
    const to = this.checkpoints.get(toCheckpointId);

    if (!from || !to) {
      throw new Error('检查点不存在');
    }

    const allCheckpoints = Array.from(this.checkpoints.values())
      .filter((c) => c.executionId === from.executionId)
      .filter((c) => c.iteration >= from.iteration && c.iteration <= to.iteration)
      .sort((a, b) => a.iteration - b.iteration);

    console.log(`[时间旅行] 重放从迭代 ${from.iteration} 到 ${to.iteration}`);

    return allCheckpoints;
  }

  async createBranch(checkpointId: string, branchName: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`);
    }

    // 创建分支：复制检查点并标记为分支
    const branchCheckpoint: Checkpoint = {
      ...checkpoint,
      id: `${branchName}-${checkpoint.iteration}-${Date.now()}`,
      tags: [...(checkpoint.tags || []), `branch:${branchName}`],
      notes: `从 ${checkpointId} 创建的分支`,
    };

    this.checkpoints.set(branchCheckpoint.id, branchCheckpoint);

    console.log(`[时间旅行] 创建分支 "${branchName}" 从迭代 ${checkpoint.iteration}`);
  }

  async mergeBranch(branchName: string): Promise<void> {
    // 简化实现：只是记录日志
    console.log(`[时间旅行] 合并分支 "${branchName}"`);
  }

  async listTimeline(executionId: string): Promise<Checkpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter((c) => c.executionId === executionId)
      .sort((a, b) => a.iteration - b.iteration);
  }
}

/**
 * 增强的记忆存储
 *
 * 在原有基础上添加检查点功能
 */
export class EnhancedMemoryStore implements IMemoryStore {
  private shortTerm = new Map<string, any>();
  private history: MemoryEntry[] = [];
  private checkpointManager: CheckpointManager;

  constructor(checkpointManager?: CheckpointManager) {
    this.checkpointManager = checkpointManager ?? new CheckpointManager();
  }

  /**
   * 读取记忆
   */
  async get(key: string): Promise<unknown> {
    return this.shortTerm.get(key);
  }

  /**
   * 写入记忆
   */
  async set(key: string, value: unknown): Promise<void> {
    this.shortTerm.set(key, value);

    // 记录历史
    this.history.push({
      key,
      value,
      timestamp: new Date(),
    });
  }

  /**
   * 删除记忆
   */
  async delete(key: string): Promise<void> {
    this.shortTerm.delete(key);
  }

  /**
   * 检查记忆是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.shortTerm.has(key);
  }

  /**
   * 获取所有记忆
   */
  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.shortTerm.entries());
  }

  /**
   * 清空记忆
   */
  async clear(): Promise<void> {
    this.shortTerm.clear();
    this.history = [];
  }

  /**
   * 搜索长期记忆
   */
  async search(_query: string, _topK = 10): Promise<MemoryEntry[]> {
    // TODO: 集成长期记忆（向量数据库）
    return [];
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
    const memorySnapshot = Object.fromEntries(this.shortTerm.entries());

    return this.checkpointManager.saveCheckpoint(
      agentName,
      executionId,
      iteration,
      memorySnapshot,
      {}, // context snapshot
      {}, // state snapshot
      tags,
      notes
    );
  }

  /**
   * 恢复检查点
   */
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await this.checkpointManager.loadCheckpoint(checkpointId);

    // 恢复记忆
    this.shortTerm.clear();
    Object.entries(checkpoint.memorySnapshot).forEach(([key, value]) => {
      this.shortTerm.set(key, value);
    });

    console.log(`[检查点] 已恢复到迭代 ${checkpoint.iteration}`);
  }

  /**
   * 列出检查点
   */
  async listCheckpoints(filter?: {
    agentName?: string;
    executionId?: string;
    tags?: string[];
  }): Promise<Checkpoint[]> {
    return this.checkpointManager.listCheckpoints(filter);
  }

  /**
   * 获取时间机器
   */
  getTimeMachine(): TimeMachine {
    return this.checkpointManager.getTimeMachine();
  }

  /**
   * 获取记忆历史
   */
  getHistory(): MemoryEntry[] {
    return this.history;
  }

  /**
   * 记忆压缩
   *
   * 当记忆过多时，压缩为摘要
   */
  async compress(targetSize: number = 100): Promise<void> {
    if (this.history.length <= targetSize) {
      return;
    }

    // 简化实现：保留最近的 N 条记录
    this.history = this.history.slice(-targetSize);

    console.log(`[记忆压缩] 已压缩至 ${this.history.length} 条记录`);
  }

  /**
   * 记忆统计
   */
  getStats(): {
    shortTermSize: number;
    historySize: number;
    checkpointCount: number;
  } {
    return {
      shortTermSize: this.shortTerm.size,
      historySize: this.history.length,
      checkpointCount: this.checkpointManager['checkpoints'].size,
    };
  }
}

/**
 * 断点续传管理器
 */
export class ResumeManager {
  private checkpointManager: CheckpointManager;

  constructor(checkpointManager: CheckpointManager) {
    this.checkpointManager = checkpointManager;
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
    );
  }

  /**
   * 从断点恢复
   */
  async resumeFromBreakpoint(executionId: string): Promise<Checkpoint | null> {
    const checkpoints = await this.checkpointManager.listCheckpoints({
      executionId,
      tags: ['breakpoint'],
    });

    if (checkpoints.length === 0) {
      return null;
    }

    // 返回最新的断点
    return checkpoints[checkpoints.length - 1];
  }

  /**
   * 列出可恢复的断点
   */
  async listResumableExecutions(): Promise<
    Array<{ executionId: string; agentName: string; iteration: number; timestamp: Date }>
  > {
    const checkpoints = await this.checkpointManager.listCheckpoints({
      tags: ['breakpoint'],
    });

    const executions = new Map<string, any>();

    checkpoints.forEach((c) => {
      if (!executions.has(c.executionId)) {
        executions.set(c.executionId, {
          executionId: c.executionId,
          agentName: c.agentName,
          iteration: c.iteration,
          timestamp: c.timestamp,
        });
      }
    });

    return Array.from(executions.values());
  }
}
