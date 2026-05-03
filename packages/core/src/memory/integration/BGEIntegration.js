/**
 * BGE-M3 嵌入模型集成
 *
 * 核心功能：
 * 1. 连接 BGE-M3 服务（localhost:8009）
 * 2. 批量文本向量化
 * 3. 向量缓存优化
 * 4. 错误处理与重试
 */
import { EmbeddingAdapter } from '../../llm/EmbeddingAdapter.js';
/**
 * 默认最大缓存条目数
 */
const DEFAULT_CACHE_MAX_SIZE = 1000;
/**
 * BGE-M3 嵌入客户端
 *
 * 封装 EmbeddingAdapter，提供简化接口
 */
export class BGEM3Client {
    adapter;
    cache = new Map();
    cacheHits = 0;
    cacheMisses = 0;
    cacheMaxSize;
    constructor(config = {}) {
        this.cacheMaxSize = config.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
        this.adapter = new EmbeddingAdapter({
            baseURL: config.baseURL ?? 'http://localhost:8009/v1',
            model: config.model ?? 'bge-m3-mlx-8bit',
            apiKey: config.apiKey,
            timeout: config.timeout ?? 30000,
            batchSize: config.batchSize ?? 32,
        });
    }
    /**
     * 生成单个文本的向量
     */
    async embed(text) {
        // 检查缓存
        if (this.cache.has(text)) {
            this.cacheHits++;
            return this.cache.get(text);
        }
        this.cacheMisses++;
        // 生成向量
        const embedding = await this.adapter.embedSingle(text);
        // 缓存结果（LRU 淘汰）
        if (this.cache.size >= this.cacheMaxSize) {
            // 删除最早的条目（Map 保持插入顺序）
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(text, embedding.embedding);
        return embedding.embedding;
    }
    /**
     * 批量生成向量
     */
    async embedBatch(texts) {
        const results = [];
        const uncached = [];
        const indices = [];
        // 检查缓存
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            if (this.cache.has(text)) {
                this.cacheHits++;
                // LRU: 重新插入以更新顺序
                const cached = this.cache.get(text);
                this.cache.delete(text);
                this.cache.set(text, cached);
                results[i] = cached;
            }
            else {
                this.cacheMisses++;
                uncached.push(text);
                indices.push(i);
            }
        }
        // 批量生成未缓存的向量
        if (uncached.length > 0) {
            const embeddingResult = await this.adapter.embed({ texts: uncached, normalize: true });
            for (let i = 0; i < embeddingResult.embeddings.length; i++) {
                const embedding = embeddingResult.embeddings[i];
                const text = uncached[i];
                const index = indices[i];
                // 缓存结果（LRU 淘汰）
                if (this.cache.size >= this.cacheMaxSize) {
                    const firstKey = this.cache.keys().next().value;
                    if (firstKey !== undefined) {
                        this.cache.delete(firstKey);
                    }
                }
                this.cache.set(text, embedding);
                results[index] = embedding;
            }
        }
        return results;
    }
    /**
     * 获取向量维度
     */
    getDimension() {
        return 1024; // BGE-M3 默认维度
    }
    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
    /**
     * 获取缓存统计
     */
    getCacheStats() {
        const total = this.cacheHits + this.cacheMisses;
        return {
            size: this.cache.size,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: total > 0 ? this.cacheHits / total : 0,
        };
    }
    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const result = await this.embed('测试');
            return result.length === 1024;
        }
        catch (error) {
            console.error('BGE-M3 健康检查失败:', error);
            return false;
        }
    }
}
/**
 * 创建 BGE-M3 客户端
 */
export function createBGEM3Client(config) {
    return new BGEM3Client(config);
}
/**
 * 默认客户端（单例）
 */
let defaultClient = null;
export function getDefaultBGEM3Client() {
    if (!defaultClient) {
        const apiKey = process.env.BGE_M3_API_KEY;
        if (!apiKey) {
            throw new Error('BGE-M3 API Key 未配置。请设置环境变量 BGE_M3_API_KEY');
        }
        defaultClient = new BGEM3Client({ apiKey });
    }
    return defaultClient;
}
