/**
 * Token 窗口管理器
 *
 * 核心功能：
 * 1. 滑动窗口算法（保留最近 N 条对话）
 * 2. 重要性评分（关键信息不丢失）
 * 3. 语义摘要（压缩历史对话）
 * 4. Token 估算（中英文混合）
 *
 * 目标：降低 Token 使用 60%+
 */
/**
 * Token 窗口管理器
 *
 * 使用滑动窗口算法管理对话历史
 * 在保留关键信息的同时控制 Token 使用量
 */
export class TokenWindowManager {
    maxTokens;
    reservedTokens;
    compressionRatio;
    importanceThreshold;
    enableSummary;
    constructor(config = {}) {
        this.maxTokens = config.maxTokens ?? 4000;
        this.reservedTokens = config.reservedTokens ?? 500;
        this.compressionRatio = config.compressionRatio ?? 0.6;
        this.importanceThreshold = config.importanceThreshold ?? 0.7;
        this.enableSummary = config.enableSummary ?? true;
    }
    /**
     * 滑动窗口算法（核心功能）
     *
     * 策略：
     * 1. 倒序遍历（优先保留最新消息）
     * 2. 估算 Token 数
     * 3. 如果超出限制，压缩旧消息
     */
    async slideWindow(messages) {
        const availableTokens = this.maxTokens - this.reservedTokens;
        const originalTokens = await this.estimateTotalTokens(messages);
        // 如果未超限，直接返回
        if (originalTokens <= availableTokens) {
            return {
                messages,
                stats: {
                    originalMessages: messages.length,
                    originalTokens,
                    compressedMessages: messages.length,
                    compressedTokens: originalTokens,
                    compressionRatio: 1.0,
                    summaryUsed: false,
                },
            };
        }
        const selectedMessages = [];
        let currentTokens = 0;
        let summaryUsed = false;
        // 倒序遍历（优先保留最新消息）
        for (let i = messages.length - 1; i >= 0; i--) {
            const msgTokens = await this.estimateTokens(messages[i]);
            if (currentTokens + msgTokens <= availableTokens) {
                selectedMessages.unshift(messages[i]);
                currentTokens += msgTokens;
            }
            else {
                // 尝试压缩旧消息
                if (this.enableSummary && i > 0) {
                    const oldMessages = messages.slice(0, i);
                    const summary = await this.summarizeMessages(oldMessages);
                    const summaryTokens = await this.estimateTokens({
                        role: 'system',
                        content: summary,
                    });
                    if (summaryTokens <= availableTokens - currentTokens) {
                        selectedMessages.unshift({
                            role: 'system',
                            content: `[历史对话摘要] ${summary}`,
                            timestamp: new Date(),
                        });
                        summaryUsed = true;
                    }
                }
                break;
            }
        }
        const compressedTokens = await this.estimateTotalTokens(selectedMessages);
        return {
            messages: selectedMessages,
            stats: {
                originalMessages: messages.length,
                originalTokens,
                compressedMessages: selectedMessages.length,
                compressedTokens,
                compressionRatio: compressedTokens / originalTokens,
                summaryUsed,
            },
        };
    }
    /**
     * 估算 Token 数（中英文混合 + 改进算法）
     *
     * 改进的估算规则：
     * - 中文：1.3 字 ≈ 1 token（更精确）
     * - 英文单词：1 词 ≈ 1 token（更精确）
     * - 数字/符号：按字符数计算
     * - 代码：按字符数 × 0.5（代码通常 token 较少）
     *
     * @warning 这是启发式估算，实际误差约 ±15-20%
     * @warning 对于生产环境，建议使用 tiktoken 或 claude-tokenizer
     */
    async estimateTokens(message) {
        const content = message.content;
        // 统计中文字符（包括标点）
        // eslint-disable-next-line no-irregular-whitespace
        const chineseChars = (content.match(/[一-龥　-〿]/g) || []).length;
        // 统计英文单词（按空格和常见标点分割）
        const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
        // 统计数字和符号
        const numbersAndSymbols = (content.match(/[0-9\W]/g) || []).length;
        // 统计代码块（如果有）
        const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
        const codeLength = (content.match(/```[\s\S]*?```/g) || []).join('').length;
        // 计算 Token 数
        const chineseTokens = Math.ceil(chineseChars / 1.3); // 改进：更精确的比例
        const englishTokens = englishWords; // 改进：按单词计算
        const numberTokens = Math.ceil(numbersAndSymbols / 4); // 数字符号效率较高
        const codeTokens = Math.ceil(codeLength * 0.5); // 代码 token 通常较少
        // 添加元数据开销（role、timestamp 等）
        const metadataTokens = 10;
        // 调整代码块重复计算
        const totalContentTokens = chineseTokens + englishTokens + numberTokens;
        const adjustedTokens = codeBlocks > 0 ? totalContentTokens + codeTokens : totalContentTokens;
        return adjustedTokens + metadataTokens;
    }
    /**
     * 估算总 Token 数
     */
    async estimateTotalTokens(messages) {
        let total = 0;
        for (const msg of messages) {
            total += await this.estimateTokens(msg);
        }
        return total;
    }
    /**
     * 语义摘要（压缩历史对话）
     *
     * 策略：
     * 1. 提取关键信息（实体、关系）
     * 2. 生成简洁摘要
     * 3. 保留结构化信息
     */
    async summarizeMessages(messages) {
        if (messages.length === 0) {
            return '';
        }
        // 简化实现：提取关键信息
        const keyPoints = [];
        for (const msg of messages.slice(-5)) {
            // 只看最近 5 条
            if (msg.role === 'user') {
                // 提取用户问题（前 50 字）
                const question = msg.content.slice(0, 50);
                if (question.length < msg.content.length) {
                    keyPoints.push(`用户询问: ${question}...`);
                }
                else {
                    keyPoints.push(`用户询问: ${question}`);
                }
            }
            else if (msg.role === 'assistant') {
                // 提取关键结论（前 50 字）
                const answer = msg.content.slice(0, 50);
                if (answer.length < msg.content.length) {
                    keyPoints.push(`AI 回复: ${answer}...`);
                }
                else {
                    keyPoints.push(`AI 回复: ${answer}`);
                }
            }
        }
        // 生成摘要
        const summary = keyPoints.join('\n');
        const totalMessages = messages.length;
        return `（共 ${totalMessages} 条对话，已压缩）\n${summary}`;
    }
    /**
     * 重要性评分（可选功能）
     *
     * 多维度评分：
     * - 新颖性（是否重复）
     * - 相关性（是否与当前任务相关）
     * - 时效性（是否最新）
     */
    async scoreImportance(message, context) {
        let score = 0.5; // 基础分
        // 1. 新颖性（避免重复）
        if (context?.recentMessages) {
            const isDuplicate = await this.checkDuplicate(message, context.recentMessages);
            if (isDuplicate) {
                score -= 0.3;
            }
        }
        // 2. 相关性（与当前任务的相关性）
        if (context?.currentTask) {
            const relevance = await this.calculateRelevance(message, context.currentTask);
            score += relevance * 0.3;
        }
        // 3. 时效性（最新消息权重更高）
        if (message.timestamp) {
            const age = Date.now() - message.timestamp.getTime();
            const ageInHours = age / (1000 * 60 * 60);
            if (ageInHours < 1) {
                score += 0.2;
            }
            else if (ageInHours < 24) {
                score += 0.1;
            }
        }
        // 4. 角色权重（用户消息更重要）
        if (message.role === 'user') {
            score += 0.1;
        }
        // 归一化到 [0, 1]
        return Math.max(0, Math.min(1, score));
    }
    /**
     * 检查是否重复
     */
    async checkDuplicate(message, recentMessages) {
        const content = message.content.toLowerCase().trim();
        for (const msg of recentMessages.slice(-3)) {
            // 只看最近 3 条
            const recentContent = msg.content.toLowerCase().trim();
            if (content === recentContent) {
                return true;
            }
        }
        return false;
    }
    /**
     * 计算相关性（简单实现）
     */
    async calculateRelevance(message, task) {
        const msgContent = message.content.toLowerCase();
        const taskContent = task.toLowerCase();
        // 简单关键词匹配
        const taskKeywords = taskContent.split(/\s+/).filter((w) => w.length > 2);
        let matchCount = 0;
        for (const keyword of taskKeywords) {
            if (msgContent.includes(keyword)) {
                matchCount++;
            }
        }
        return matchCount / Math.max(1, taskKeywords.length);
    }
    /**
     * 优化窗口（基于重要性评分）
     *
     * 策略：
     * 1. 评分所有消息
     * 2. 保留高分消息
     * 3. 丢弃低分消息
     */
    async optimizeWindow(messages, context) {
        // 评分所有消息
        const scored = await Promise.all(messages.map(async (msg) => ({
            message: msg,
            importance: await this.scoreImportance(msg, context),
        })));
        // 过滤低分消息
        const filtered = scored
            .filter((s) => s.importance >= this.importanceThreshold)
            .sort((a, b) => b.importance - a.importance);
        // 计算平均重要性
        const avgImportance = filtered.reduce((sum, s) => sum + s.importance, 0) / filtered.length;
        return {
            messages: filtered.map((s) => s.message),
            stats: {
                originalCount: messages.length,
                optimizedCount: filtered.length,
                avgImportance,
            },
        };
    }
    /**
     * 获取配置信息
     */
    getConfig() {
        return {
            maxTokens: this.maxTokens,
            reservedTokens: this.reservedTokens,
            availableTokens: this.maxTokens - this.reservedTokens,
            compressionRatio: this.compressionRatio,
            importanceThreshold: this.importanceThreshold,
        };
    }
}
/**
 * 创建 Token 窗口管理器
 */
export function createTokenWindowManager(config) {
    return new TokenWindowManager(config);
}
