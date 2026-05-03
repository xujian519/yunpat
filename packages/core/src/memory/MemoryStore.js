/**
 * 记忆存储模块
 *
 * 提供基础的记忆存储功能
 * 为了向后兼容，保留原有接口
 */
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
export class ShortTermMemory {
    /** 存储后端 */
    storage = new Map();
    /** 长期记忆向量存储（可选） */
    vectorStore;
    /** 查询向量生成器（可选） */
    embeddingGenerator;
    constructor(vectorStore, embeddingGenerator) {
        this.vectorStore = vectorStore;
        this.embeddingGenerator = embeddingGenerator;
    }
    /**
     * 设置长期记忆存储
     */
    setVectorStore(vectorStore, embeddingGenerator) {
        this.vectorStore = vectorStore;
        this.embeddingGenerator = embeddingGenerator;
    }
    /**
     * 读取记忆
     */
    async get(key) {
        return this.storage.get(key);
    }
    /**
     * 写入记忆
     */
    async set(key, value) {
        this.storage.set(key, value);
    }
    /**
     * 删除记忆
     */
    async delete(key) {
        this.storage.delete(key);
    }
    /**
     * 检查记忆是否存在
     */
    async has(key) {
        return this.storage.has(key);
    }
    /**
     * 获取所有记忆
     */
    async getAll() {
        return Object.fromEntries(this.storage.entries());
    }
    /**
     * 批量写入记忆
     */
    async setAll(entries) {
        for (const [key, value] of Object.entries(entries)) {
            this.storage.set(key, value);
        }
    }
    /**
     * 清空记忆
     */
    async clear() {
        this.storage.clear();
    }
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
    async search(query, topK = 10, filter) {
        // 如果未配置向量存储，返回空数组
        if (!this.vectorStore || !this.embeddingGenerator) {
            console.warn('[ShortTermMemory] 未配置向量存储，无法进行语义搜索');
            return [];
        }
        try {
            // 生成查询向量
            const queryEmbedding = await this.embeddingGenerator(query);
            // 执行向量搜索
            const results = await this.vectorStore.search(queryEmbedding, topK, filter);
            // 转换为 MemoryEntry 格式
            return results.map((result) => ({
                key: result.id.toString(),
                value: {
                    content: result.content,
                    metadata: result.metadata,
                    type: result.type,
                    similarity: result.similarity,
                },
                timestamp: new Date(), // 向量存储没有时间戳，使用当前时间
            }));
        }
        catch (error) {
            console.error('[ShortTermMemory] 向量搜索失败:', error);
            return [];
        }
    }
    /**
     * 获取记忆数量
     */
    size() {
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
    shortTerm;
    /** 记忆历史（用于压缩） */
    history = [];
    constructor() {
        this.shortTerm = new ShortTermMemory();
    }
    /**
     * 获取短期记忆存储
     */
    getShortTerm() {
        return this.shortTerm;
    }
    /**
     * 添加记忆
     */
    async add(key, value) {
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
    async get(key) {
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
    async compress(maxMemories = 100) {
        const currentSize = this.history.length;
        if (currentSize <= maxMemories) {
            return 0; // 无需压缩
        }
        // 删除最旧的记忆
        const toDelete = currentSize - maxMemories;
        const deleted = this.history.splice(0, toDelete);
        // 从短期记忆中删除
        for (const entry of deleted) {
            await this.shortTerm.delete(entry.key);
        }
        console.log(`[MemoryManager] 压缩记忆：删除 ${toDelete} 条，保留 ${maxMemories} 条`);
        return toDelete;
    }
    /**
     * 获取记忆历史
     */
    getHistory() {
        return this.history;
    }
    /**
     * 清空所有记忆
     */
    async clear() {
        await this.shortTerm.clear();
        this.history = [];
    }
}
