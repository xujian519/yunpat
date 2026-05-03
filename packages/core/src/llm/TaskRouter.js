/**
 * 智能任务路由 - 成本感知的 LLM 调度器
 *
 * 核心理念:
 * - 简单任务用本地模型(免费)
 * - 复杂任务用云端模型(付费)
 * - 自动评估任务复杂度
 * - 预期节省 50-60% API 成本
 */
import { NativeLLMAdapter } from './NativeLLMAdapter.js';
import { OMLXAdapter } from './OMXLAdapter.js';
/**
 * 任务复杂度
 */
export var TaskComplexity;
(function (TaskComplexity) {
    /** 简单任务 - 本地 OMLX 处理 */
    TaskComplexity["SIMPLE"] = "simple";
    /** 中等任务 - 本地 OMLX 处理 */
    TaskComplexity["MEDIUM"] = "medium";
    /** 复杂任务 - 云端 DeepSeek 处理 */
    TaskComplexity["COMPLEX"] = "complex";
})(TaskComplexity || (TaskComplexity = {}));
/**
 * 定价常量(元/1k tokens)
 */
const PRICING = {
    deepseek: 0.001, // DeepSeek: ¥0.001/1k tokens
    omlx: 0, // OMLX 本地: 免费
};
/**
 * 任务复杂度评估器
 */
export class TaskRouter {
    localAdapter;
    cloudAdapter;
    forceMode;
    constructor(config) {
        // 初始化本地 OMLX 适配器
        this.localAdapter = new OMLXAdapter({
            baseURL: config.omlxBaseURL || 'http://localhost:8009/v1',
            apiKey: config.omlxApiKey,
            modelName: config.omlxModelName || 'gemma-4-e2b-it-4bit',
        });
        // 初始化云端 DeepSeek 适配器
        this.cloudAdapter = new NativeLLMAdapter({
            name: config.deepSeekModelName || 'deepseek-chat',
            apiKey: config.deepSeekApiKey,
            baseURL: 'https://api.deepseek.com/v1',
        });
        this.forceMode = config.forceMode;
    }
    /**
     * 评估任务复杂度
     *
     * 评估维度:
     * 1. 输入文本长度
     * 2. 任务描述关键词
     * 3. 预期输出长度
     * 4. 消息轮数
     */
    evaluateComplexity(task) {
        // 强制模式
        if (this.forceMode === 'local') {
            return TaskComplexity.SIMPLE;
        }
        if (this.forceMode === 'cloud') {
            return TaskComplexity.COMPLEX;
        }
        // 计算输入文本总长度
        const inputLength = task.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
        // 提取任务描述和最后一条用户消息
        const taskDesc = (task.description || '').toLowerCase();
        const lastUserMessage = task.messages
            .filter((m) => m.role === 'user')
            .pop()
            ?.content.toLowerCase() || '';
        // 复杂任务关键词
        const complexKeywords = [
            '分析',
            '深度分析',
            '详细',
            '全面',
            '研究',
            '调研',
            '设计',
            '架构',
            '实现',
            '优化',
            '重构',
            '性能',
            '安全',
            '算法',
            '策略',
            '方案',
            '长文',
            '报告',
            '文档',
            'explain',
            'analyze',
            'design',
            'implement',
            'optimize',
            'refactor',
            'architecture',
            'strategy',
            'detailed',
            'comprehensive',
            'research',
        ];
        // 简单任务关键词
        const simpleKeywords = [
            '摘要',
            '总结',
            '简短',
            '简要',
            '概要',
            '列表',
            '提取',
            '格式',
            '转换',
            '检查',
            '验证',
            '判断',
            '是否',
            'what',
            'which',
            'how to',
            'list',
            'check',
            'verify',
            'summarize',
            'brief',
            'extract',
        ];
        // 检查关键词匹配
        const hasComplexKeyword = complexKeywords.some((kw) => taskDesc.includes(kw) || lastUserMessage.includes(kw));
        const hasSimpleKeyword = simpleKeywords.some((kw) => taskDesc.includes(kw) || lastUserMessage.includes(kw));
        // 评估逻辑
        if (hasComplexKeyword ||
            inputLength > 2000 ||
            (task.expectedOutputLength && task.expectedOutputLength > 1000)) {
            return TaskComplexity.COMPLEX;
        }
        if (hasSimpleKeyword || inputLength < 500) {
            return TaskComplexity.SIMPLE;
        }
        // 默认为中等复杂度
        return TaskComplexity.MEDIUM;
    }
    /**
     * 路由任务到合适的模型
     */
    route(task) {
        const complexity = this.evaluateComplexity(task);
        let adapter;
        let reason;
        let estimatedCost;
        switch (complexity) {
            case TaskComplexity.SIMPLE:
            case TaskComplexity.MEDIUM:
                adapter = this.localAdapter;
                reason = `本地模型处理 ${complexity === TaskComplexity.SIMPLE ? '简单' : '中等'}任务(免费)`;
                estimatedCost = 0;
                break;
            case TaskComplexity.COMPLEX:
                adapter = this.cloudAdapter;
                reason = '云端模型处理复杂任务(高质量)';
                // 估算成本: 输入 + 输出 tokens
                const inputTokens = this.estimateTokens(task.messages);
                const outputTokens = task.expectedOutputLength ?? 500;
                estimatedCost = ((inputTokens + outputTokens) / 1000) * PRICING.deepseek;
                break;
        }
        return {
            complexity,
            adapter,
            reason,
            estimatedCost,
        };
    }
    /**
     * 估算 token 数量
     *
     * 粗略估算: 1 token ≈ 3-4 个字符(中文)或 4-5 个字符(英文)
     */
    estimateTokens(messages) {
        const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
        return Math.ceil(totalChars / 3.5); // 平均值
    }
    /**
     * 获取本地适配器
     */
    getLocalAdapter() {
        return this.localAdapter;
    }
    /**
     * 获取云端适配器
     */
    getCloudAdapter() {
        return this.cloudAdapter;
    }
}
/**
 * 成本感知 LLM 适配器
 *
 * 自动路由任务到合适的模型,对用户透明
 */
export class CostAwareLLMAdapter {
    router;
    stats = {
        totalRequests: 0,
        localRequests: 0,
        cloudRequests: 0,
        totalCost: 0,
        savedCost: 0,
    };
    constructor(config) {
        this.router = new TaskRouter(config);
    }
    /**
     * 聊天 - 自动路由
     */
    async chat(params) {
        const task = {
            messages: params.messages,
        };
        const decision = this.router.route(task);
        // 更新统计
        this.stats.totalRequests++;
        if (decision.complexity === TaskComplexity.COMPLEX) {
            this.stats.cloudRequests++;
            this.stats.totalCost += decision.estimatedCost;
        }
        else {
            this.stats.localRequests++;
            // 假设云端成本为节省的成本
            const cloudCost = ((this.router['estimateTokens'](task.messages) + 500) / 1000) * PRICING.deepseek;
            this.stats.savedCost += cloudCost;
        }
        // 执行调用
        return decision.adapter.chat(params);
    }
    /**
     * 聊天 - 流式调用(自动路由)
     */
    async *chatStream(params) {
        const task = {
            messages: params.messages,
        };
        const decision = this.router.route(task);
        // 更新统计
        this.stats.totalRequests++;
        if (decision.complexity === TaskComplexity.COMPLEX) {
            this.stats.cloudRequests++;
            this.stats.totalCost += decision.estimatedCost;
        }
        else {
            this.stats.localRequests++;
            const cloudCost = ((this.router['estimateTokens'](task.messages) + 500) / 1000) * PRICING.deepseek;
            this.stats.savedCost += cloudCost;
        }
        yield* decision.adapter.chatStream(params);
    }
    /**
     * 嵌入 - 默认使用云端模型
     */
    async embed(texts) {
        return this.router.getCloudAdapter().embed(texts);
    }
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            localRate: this.stats.totalRequests > 0
                ? ((this.stats.localRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
                : '0%',
            cloudRate: this.stats.totalRequests > 0
                ? ((this.stats.cloudRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
                : '0%',
        };
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            localRequests: 0,
            cloudRequests: 0,
            totalCost: 0,
            savedCost: 0,
        };
    }
    /**
     * 获取底层路由器
     */
    getRouter() {
        return this.router;
    }
}
/**
 * 创建成本感知适配器
 *
 * @param deepSeekApiKey - DeepSeek API Key
 * @param omlxBaseURL - OMLX Base URL(默认: http://localhost:8009/v1)
 * @returns 成本感知适配器实例
 */
export function createCostAwareAdapter(deepSeekApiKey, omlxBaseURL) {
    return new CostAwareLLMAdapter({
        deepSeekApiKey,
        omlxBaseURL,
    });
}
