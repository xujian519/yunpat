/**
 * Token 计数器
 *
 * 提供基于不同模型的精确 Token 估算
 *
 * @module llm/tokenization/TokenCounter
 */
/**
 * 模型类型枚举
 */
export var ModelType;
(function (ModelType) {
    /** GPT 模型（OpenAI） */
    ModelType["GPT"] = "gpt";
    /** Claude 模型（Anthropic） */
    ModelType["CLAUDE"] = "claude";
    /** DeepSeek 模型 */
    ModelType["DEEPSEEK"] = "deepseek";
    /** 通义千问模型 */
    ModelType["QWEN"] = "qwen";
    /** 未知模型 */
    ModelType["UNKNOWN"] = "unknown";
})(ModelType || (ModelType = {}));
/**
 * Token 计数器实现
 */
export class TokenCounter {
    /**
     * 估算文本的 Token 数量
     *
     * @param text 输入文本
     * @param model 模型名称
     * @returns Token 数量
     */
    estimateTokens(text, model) {
        if (!text || text.length === 0) {
            return 0;
        }
        const modelType = this.detectModelType(model);
        switch (modelType) {
            case ModelType.GPT:
                return this.countGPTTokens(text);
            case ModelType.CLAUDE:
                return this.countClaudeTokens(text);
            case ModelType.DEEPSEEK:
                return this.countDeepSeekTokens(text);
            case ModelType.QWEN:
                return this.countQwenTokens(text);
            default:
                // 默认：字符数 / 4（粗略估算）
                return this.defaultTokenCount(text);
        }
    }
    /**
     * 批量估算 Token
     *
     * @param texts 输入文本数组
     * @param model 模型名称
     * @returns Token 数量数组
     */
    estimateTokensBatch(texts, model) {
        return texts.map((text) => this.estimateTokens(text, model));
    }
    /**
     * 计算总 Token 数
     *
     * @param texts 输入文本数组
     * @param model 模型名称
     * @returns 总 Token 数量
     */
    calculateTotalTokens(texts, model) {
        const tokenCounts = this.estimateTokensBatch(texts, model);
        return tokenCounts.reduce((sum, count) => sum + count, 0);
    }
    /**
     * 检测模型类型
     *
     * @param model 模型名称
     * @returns 模型类型
     */
    detectModelType(model) {
        const lowerModel = model.toLowerCase();
        if (lowerModel.includes('gpt')) {
            return ModelType.GPT;
        }
        if (lowerModel.includes('claude')) {
            return ModelType.CLAUDE;
        }
        if (lowerModel.includes('deepseek')) {
            return ModelType.DEEPSEEK;
        }
        if (lowerModel.includes('qwen') || lowerModel.includes('dashscope')) {
            return ModelType.QWEN;
        }
        return ModelType.UNKNOWN;
    }
    /**
     * GPT 模型 Token 计数（使用 tiktoken）
     *
     * GPT-3.5/GPT-4 使用 cl100k_base 编码
     * 粗略估算：英文 ~4 字符/token，中文 ~2.5 字符/token
     *
     * @param text 输入文本
     * @returns Token 数量
     */
    countGPTTokens(text) {
        // 统计中文字符
        const chineseChars = (text.match(/[一-龥]/g) || []).length;
        const otherChars = text.length - chineseChars;
        // GPT Token 估算：中文 2.5 字符/token，其他 4 字符/token
        return Math.ceil(chineseChars / 2.5 + otherChars / 4);
    }
    /**
     * Claude Token 计数
     *
     * Claude 使用自己的 tokenizer
     * 粗略估算：与 GPT 类似
     *
     * @param text 输入文本
     * @returns Token 数量
     */
    countClaudeTokens(text) {
        // Claude Token 估算与 GPT 类似
        return this.countGPTTokens(text);
    }
    /**
     * DeepSeek Token 计数
     *
     * DeepSeek 使用类似 GPT 的编码
     * 但对中文优化更好（实际上是更高效，即更少的 tokens）
     *
     * @param text 输入文本
     * @returns Token 数量
     */
    countDeepSeekTokens(text) {
        // 统计中文字符
        const chineseChars = (text.match(/[一-龥]/g) || []).length;
        const otherChars = text.length - chineseChars;
        // DeepSeek 对中文优化更好：中文 3 字符/token（比 GPT 的 2.5 更高效）
        // 其他保持 4 字符/token
        return Math.ceil(chineseChars / 3 + otherChars / 4);
    }
    /**
     * 通义千问 Token 计数
     *
     * Qwen 对中文支持很好
     *
     * @param text 输入文本
     * @returns Token 数量
     */
    countQwenTokens(text) {
        // 统计中文字符
        const chineseChars = (text.match(/[一-龥]/g) || []).length;
        const otherChars = text.length - chineseChars;
        // Qwen 对中文支持很好：中文 3 字符/token（比 GPT 的 2.5 更高效）
        // 其他保持 4 字符/token
        return Math.ceil(chineseChars / 3 + otherChars / 4);
    }
    /**
     * 默认 Token 计数
     *
     * 用于未知模型的粗略估算
     *
     * @param text 输入文本
     * @returns Token 数量
     */
    defaultTokenCount(text) {
        // 默认：字符数 / 4（粗略估算）
        return Math.ceil(text.length / 4);
    }
    /**
     * 计算文本的 Token 使用率
     *
     * @param text 输入文本
     * @param model 模型名称
     * @param maxTokens 最大 Token 限制
     * @returns 使用率（0-1）
     */
    calculateTokenUsageRate(text, model, maxTokens) {
        const tokens = this.estimateTokens(text, model);
        return Math.min(tokens / maxTokens, 1);
    }
    /**
     * 检查文本是否超过 Token 限制
     *
     * @param text 输入文本
     * @param model 模型名称
     * @param maxTokens 最大 Token 限制
     * @returns 是否超过限制
     */
    exceedsTokenLimit(text, model, maxTokens) {
        const tokens = this.estimateTokens(text, model);
        return tokens > maxTokens;
    }
    /**
     * 截断文本以适应 Token 限制
     *
     * @param text 输入文本
     * @param model 模型名称
     * @param maxTokens 最大 Token 限制
     * @param safetyMargin 安全边际（默认 10%）
     * @returns 截断后的文本
     */
    truncateToTokenLimit(text, model, maxTokens, safetyMargin = 0.1) {
        const targetTokens = maxTokens * (1 - safetyMargin);
        const currentTokens = this.estimateTokens(text, model);
        if (currentTokens <= targetTokens) {
            return text;
        }
        // 按比例截断
        const ratio = targetTokens / currentTokens;
        const targetLength = Math.floor(text.length * ratio);
        return text.substring(0, targetLength);
    }
}
/**
 * 创建 Token 计数器（便捷函数）
 *
 * @param config 可选配置
 * @returns Token 计数器实例
 */
export function createTokenCounter() {
    return new TokenCounter();
}
/**
 * 默认 Token 计数器实例
 */
export const tokenCounter = createTokenCounter();
