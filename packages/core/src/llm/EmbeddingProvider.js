/**
 * 嵌入向量提供者统一接口
 *
 * 定义所有嵌入模型必须实现的标准接口
 */
/**
 * 基础嵌入提供者抽象类
 *
 * 提供通用的工具方法实现
 */
export class BaseEmbeddingProvider {
    /**
     * 计算余弦相似度
     */
    cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('向量维度不匹配');
        }
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
        if (denominator === 0) {
            return 0;
        }
        return dotProduct / denominator;
    }
    /**
     * L2 归一化向量
     */
    normalize(vec) {
        let norm = 0;
        for (const val of vec) {
            norm += val * val;
        }
        norm = Math.sqrt(norm);
        if (norm === 0) {
            return vec; // 零向量无法归一化，返回原向量
        }
        return vec.map((val) => val / norm);
    }
    /**
     * 验证嵌入向量维度
     */
    validateDimension(embedding, expectedDim) {
        if (embedding.length !== expectedDim) {
            throw new Error(`嵌入向量维度不匹配: 期望 ${expectedDim}, 实际 ${embedding.length}`);
        }
    }
    /**
     * 验证输入文本
     */
    validateInput(texts) {
        if (!Array.isArray(texts)) {
            throw new Error('输入必须是字符串数组');
        }
        for (let i = 0; i < texts.length; i++) {
            if (typeof texts[i] !== 'string') {
                throw new Error(`输入[${i}] 不是字符串: ${typeof texts[i]}`);
            }
        }
    }
    /**
     * 批量处理辅助方法
     */
    async processBatch(items, batchSize, processor) {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await processor(batch);
            results.push(...batchResults);
        }
        return results;
    }
}
/**
 * 嵌入缓存键生成器
 */
export class EmbeddingCacheKeyGenerator {
    /**
     * 生成缓存键
     *
     * @param model 模型名称
     * @param text 文本内容
     * @param normalize 是否归一化
     * @returns 缓存键
     */
    static generate(model, text, normalize) {
        // 使用简单的哈希算法生成缓存键
        const normalized = normalize ? '1' : '0';
        const textHash = this.simpleHash(text);
        return `${model}:${normalized}:${textHash}`;
    }
    /**
     * 简单哈希函数（用于缓存键）
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // 转换为 32 位整数
        }
        return Math.abs(hash).toString(36);
    }
}
/**
 * 嵌入错误类型
 */
export class EmbeddingError extends Error {
    code;
    provider;
    constructor(message, code, provider) {
        super(message);
        this.code = code;
        this.provider = provider;
        this.name = 'EmbeddingError';
    }
}
/**
 * 常见错误代码
 */
export var EmbeddingErrorCode;
(function (EmbeddingErrorCode) {
    /** API 请求失败 */
    EmbeddingErrorCode["API_ERROR"] = "API_ERROR";
    /** 输入验证失败 */
    EmbeddingErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    /** 向量维度不匹配 */
    EmbeddingErrorCode["DIMENSION_MISMATCH"] = "DIMENSION_MISMATCH";
    /** 批次大小超限 */
    EmbeddingErrorCode["BATCH_SIZE_EXCEEDED"] = "BATCH_SIZE_EXCEEDED";
    /** 文本长度超限 */
    EmbeddingErrorCode["TEXT_TOO_LONG"] = "TEXT_TOO_LONG";
    /** 模型不可用 */
    EmbeddingErrorCode["MODEL_UNAVAILABLE"] = "MODEL_UNAVAILABLE";
    /** 认证失败 */
    EmbeddingErrorCode["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    /** 速率限制 */
    EmbeddingErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
})(EmbeddingErrorCode || (EmbeddingErrorCode = {}));
