/**
 * 记忆层增强 (Memory / State)
 *
 * 添加：
 * - Checkpoint 检查点机制
 * - 时间旅行调试
 * - 断点续传
 */
/**
 * 深度克隆工具函数
 *
 * 处理特殊类型：Date, Map, Set, 循环引用
 */
function deepClone(obj, hash = new WeakMap()) {
    // 处理null和基本类型
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // 处理Date
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    // 处理Map
    if (obj instanceof Map) {
        const cloned = new Map();
        obj.forEach((value, key) => {
            cloned.set(key, deepClone(value, hash));
        });
        return cloned;
    }
    // 处理Set
    if (obj instanceof Set) {
        const cloned = new Set();
        obj.forEach((value) => {
            cloned.add(deepClone(value, hash));
        });
        return cloned;
    }
    // 处理Array
    if (Array.isArray(obj)) {
        return obj.map((item) => deepClone(item, hash));
    }
    // 处理循环引用
    if (hash.has(obj)) {
        return obj; // 返回原对象，避免循环
    }
    hash.set(obj, obj);
    // 处理普通对象
    const cloned = {};
    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            ;
            cloned[key] = deepClone(obj[key], hash);
        }
    }
    return cloned;
}
/**
 * 检查点管理器
 */
export class CheckpointManager {
    checkpoints = new Map();
    autoSaveEnabled;
    autoSaveInterval;
    maxCheckpoints;
    store;
    sequenceNumbers = new Map(); // 每个执行的序列号
    constructor(config) {
        this.autoSaveEnabled = config?.autoSave ?? true;
        this.autoSaveInterval = config?.autoSaveInterval ?? 1; // 每次迭代保存
        this.maxCheckpoints = config?.maxCheckpoints ?? 100;
        this.store = config?.store;
    }
    /**
     * 保存检查点
     */
    async saveCheckpoint(agentName, executionId, iteration, memory, context, state, tags, notes) {
        // 获取并递增序列号
        const currentSeq = this.sequenceNumbers.get(executionId) ?? 0;
        this.sequenceNumbers.set(executionId, currentSeq + 1);
        const checkpoint = {
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
        };
        // 保存到内存
        this.checkpoints.set(checkpoint.id, checkpoint);
        // 如果配置了外部存储，也保存到外部存储
        if (this.store) {
            try {
                await this.store.save(checkpoint);
            }
            catch (error) {
                console.error({
                    message: '[检查点管理器] 保存到外部存储失败',
                    checkpointId: checkpoint.id,
                    executionId: checkpoint.executionId,
                    agentName: checkpoint.agentName,
                    iteration: checkpoint.iteration,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                });
                // 不抛出错误，继续使用内存存储
            }
        }
        // 检查是否超过最大数量
        if (this.checkpoints.size > this.maxCheckpoints) {
            this.cleanupOldCheckpoints();
        }
        return checkpoint;
    }
    /**
     * 加载检查点
     */
    async loadCheckpoint(checkpointId, executionId) {
        // 先尝试从内存加载
        let checkpoint = this.checkpoints.get(checkpointId);
        // 如果内存中没有，且配置了外部存储，尝试从外部存储加载
        if (!checkpoint && this.store) {
            try {
                checkpoint = await this.store.load(checkpointId, executionId);
                // 加载到内存
                if (checkpoint) {
                    this.checkpoints.set(checkpoint.id, checkpoint);
                }
            }
            catch (error) {
                console.error({
                    message: '[检查点管理器] 从外部存储加载失败',
                    checkpointId,
                    executionId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                });
            }
        }
        if (!checkpoint) {
            throw new Error(`检查点不存在: ${checkpointId}`);
        }
        return checkpoint;
    }
    /**
     * 列出所有检查点
     */
    async listCheckpoints(filter) {
        let checkpoints;
        // 如果配置了外部存储，且指定了executionId，从外部存储加载
        if (this.store && filter?.executionId) {
            try {
                checkpoints = await this.store.listCheckpoints(filter.executionId);
            }
            catch (error) {
                console.error({
                    message: '[检查点管理器] 从外部存储列出检查点失败',
                    executionId: filter.executionId,
                    agentName: filter.agentName,
                    tags: filter.tags,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                });
                // 降级到内存存储
                checkpoints = Array.from(this.checkpoints.values());
            }
        }
        else {
            // 从内存列出
            checkpoints = Array.from(this.checkpoints.values());
        }
        // 应用过滤条件
        if (filter?.agentName) {
            checkpoints = checkpoints.filter((c) => c.agentName === filter.agentName);
        }
        if (filter?.executionId) {
            checkpoints = checkpoints.filter((c) => c.executionId === filter.executionId);
        }
        if (filter?.tags && filter.tags.length > 0) {
            checkpoints = checkpoints.filter((c) => filter.tags.some((tag) => c.tags?.includes(tag)));
        }
        return checkpoints.sort((a, b) => a.iteration - b.iteration);
    }
    /**
     * 删除检查点
     */
    async deleteCheckpoint(checkpointId) {
        this.checkpoints.delete(checkpointId);
        // 如果配置了外部存储，也从外部存储删除
        if (this.store) {
            try {
                await this.store.delete(checkpointId);
            }
            catch (error) {
                console.error({
                    message: '[检查点管理器] 从外部存储删除失败',
                    checkpointId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }
    /**
     * 清空所有检查点
     */
    async clearCheckpoints() {
        this.checkpoints.clear();
    }
    /**
     * 列出所有可恢复的执行
     */
    async listResumableExecutions() {
        // 如果配置了外部存储，使用外部存储的方法
        if (this.store && 'listResumableExecutions' in this.store) {
            try {
                return await this.store.listResumableExecutions();
            }
            catch (error) {
                console.error(`[检查点管理器] 从外部存储列出执行失败: ${error}`);
            }
        }
        // 降级到内存存储
        const executions = new Map();
        for (const checkpoint of this.checkpoints.values()) {
            if (!executions.has(checkpoint.executionId)) {
                executions.set(checkpoint.executionId, {
                    executionId: checkpoint.executionId,
                    agentName: checkpoint.agentName,
                    iteration: checkpoint.iteration,
                    timestamp: checkpoint.timestamp,
                });
            }
            else {
                // 更新为最新的迭代
                const existing = executions.get(checkpoint.executionId);
                if (checkpoint.iteration > existing.iteration) {
                    executions.set(checkpoint.executionId, {
                        executionId: checkpoint.executionId,
                        agentName: checkpoint.agentName,
                        iteration: checkpoint.iteration,
                        timestamp: checkpoint.timestamp,
                    });
                }
            }
        }
        // 按时间戳排序（最新的在前）
        return Array.from(executions.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * 获取时间机器
     */
    getTimeMachine() {
        return new TimeMachineImpl(this.checkpoints);
    }
    /**
     * 生成检查点 ID
     */
    generateCheckpointId(executionId, iteration, sequence) {
        return `${executionId}-iter${iteration}-seq${sequence}-${Date.now()}`;
    }
    /**
     * 清理旧检查点
     */
    cleanupOldCheckpoints() {
        const sorted = Array.from(this.checkpoints.entries()).sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
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
class TimeMachineImpl {
    checkpoints;
    constructor(checkpoints) {
        this.checkpoints = checkpoints;
    }
    async travelBack(checkpointId) {
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) {
            throw new Error(`检查点不存在: ${checkpointId}`);
        }
        console.log(`[时间旅行] 回到 ${checkpoint.timestamp.toISOString()} (迭代 ${checkpoint.iteration})`);
        return checkpoint;
    }
    async replayForward(fromCheckpointId, toCheckpointId) {
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
    async createBranch(checkpointId, branchName) {
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) {
            throw new Error(`检查点不存在: ${checkpointId}`);
        }
        // 创建分支：复制检查点并标记为分支
        const branchCheckpoint = {
            ...checkpoint,
            id: `${branchName}-${checkpoint.iteration}-${Date.now()}`,
            tags: [...(checkpoint.tags || []), `branch:${branchName}`],
            notes: `从 ${checkpointId} 创建的分支`,
        };
        this.checkpoints.set(branchCheckpoint.id, branchCheckpoint);
        console.log(`[时间旅行] 创建分支 "${branchName}" 从迭代 ${checkpoint.iteration}`);
    }
    async mergeBranch(branchName) {
        // 简化实现：只是记录日志
        console.log(`[时间旅行] 合并分支 "${branchName}"`);
    }
    async listTimeline(executionId) {
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
export class EnhancedMemoryStore {
    shortTerm = new Map();
    history = [];
    checkpointManager;
    constructor(checkpointManager) {
        this.checkpointManager = checkpointManager ?? new CheckpointManager();
    }
    /**
     * 读取记忆
     */
    async get(key) {
        return this.shortTerm.get(key);
    }
    /**
     * 写入记忆
     */
    async set(key, value) {
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
    async delete(key) {
        this.shortTerm.delete(key);
    }
    /**
     * 检查记忆是否存在
     */
    async has(key) {
        return this.shortTerm.has(key);
    }
    async getAll() {
        return Object.fromEntries(this.shortTerm.entries());
    }
    async setAll(entries) {
        for (const [key, value] of Object.entries(entries)) {
            this.shortTerm.set(key, value);
            this.history.push({
                key,
                value,
                timestamp: new Date(),
            });
        }
    }
    async clear() {
        this.shortTerm.clear();
        this.history = [];
    }
    /**
     * 搜索长期记忆
     */
    async search(_query, _topK = 10) {
        // TODO: 集成长期记忆（向量数据库）
        return [];
    }
    /**
     * 创建检查点
     */
    async createCheckpoint(agentName, executionId, iteration, tags, notes) {
        const memorySnapshot = Object.fromEntries(this.shortTerm.entries());
        return this.checkpointManager.saveCheckpoint(agentName, executionId, iteration, memorySnapshot, {}, // context snapshot
        {}, // state snapshot
        tags, notes);
    }
    /**
     * 恢复检查点
     */
    async restoreCheckpoint(checkpointId) {
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
    async listCheckpoints(filter) {
        return this.checkpointManager.listCheckpoints(filter);
    }
    /**
     * 获取时间机器
     */
    getTimeMachine() {
        return this.checkpointManager.getTimeMachine();
    }
    /**
     * 获取记忆历史
     */
    getHistory() {
        return this.history;
    }
    /**
     * 记忆压缩
     *
     * 当记忆过多时，压缩为摘要
     */
    async compress(targetSize = 100) {
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
    getStats() {
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
    checkpointManager;
    constructor(checkpointManager) {
        this.checkpointManager = checkpointManager;
    }
    /**
     * 保存断点
     */
    async saveBreakpoint(agentName, executionId, iteration, context) {
        return this.checkpointManager.saveCheckpoint(agentName, executionId, iteration, {}, // memory snapshot
        context, // context snapshot
        {}, // state snapshot
        ['breakpoint'], // 标记为断点
        '用户手动断点');
    }
    /**
     * 从断点恢复
     */
    async resumeFromBreakpoint(executionId) {
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
    async listResumableExecutions() {
        const checkpoints = await this.checkpointManager.listCheckpoints({
            tags: ['breakpoint'],
        });
        const executions = new Map();
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
