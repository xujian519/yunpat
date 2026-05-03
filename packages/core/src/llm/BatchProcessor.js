/**
 * 批处理器 - 优化 LLM API 调用成本
 *
 * 核心功能：
 * 1. 批量生成章节 - 将多个章节合并为单个请求
 * 2. 批量接口适配 - 使用结构化输出格式
 * 3. 智能分批 - 根据章节数量和 Token 长度自动分批
 *
 * 成本节省：
 * - 当前：5个章节 = 5次API调用
 * - 优化后：5个章节 = 1次API调用
 * - 节省：60-80% API成本
 */
import { tokenCounter as defaultTokenCounter } from './tokenization/TokenCounter.js';
import { createBatchProcessorOptimizer, } from './tokenization/BatchProcessorOptimizer.js';
/**
 * 默认配置
 */
const DEFAULT_BATCH_CONFIG = {
    maxSectionsPerBatch: 8,
    timeout: 120000, // 2分钟
    enabled: true,
    maxTokens: 4000,
    modelName: 'gpt-3.5-turbo',
    enableSmartBatching: true,
};
/**
 * 批处理器
 *
 * 通过合并多个章节生成请求为单个API调用来降低成本
 */
export class BatchProcessor {
    config;
    llm;
    tokenCounter;
    batchOptimizer;
    constructor(llm, config) {
        this.llm = llm;
        this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
        this.tokenCounter = defaultTokenCounter;
        // 如果启用智能分批，初始化批处理器优化器
        if (this.config.enableSmartBatching && this.config.maxTokens) {
            this.batchOptimizer = createBatchProcessorOptimizer({
                maxTokens: this.config.maxTokens,
                maxBatchSize: this.config.maxSectionsPerBatch,
                enableDynamicAdjustment: true,
            }, this.tokenCounter);
        }
    }
    /**
     * 批量生成章节
     *
     * @param sections - 章节标题列表
     * @param plan - 写作计划
     * @param context - 执行上下文
     * @returns 章节标题到内容的映射
     */
    async batchGenerate(sections, plan, context) {
        // 检查是否启用批处理
        if (!this.config.enabled) {
            return this.fallbackToSequential(sections, plan, context);
        }
        // 智能分批：根据章节数量决定是否分批
        const batches = this.createBatches(sections);
        // 如果只有1批且章节数<=1，回退到顺序处理
        if (batches.length === 1 && batches[0].length <= 1) {
            return this.fallbackToSequential(sections, plan, context);
        }
        console.log(`[BatchProcessor] 批处理模式: ${sections.length}个章节分为${batches.length}批`);
        // 并行处理所有批次
        const batchResults = await Promise.all(batches.map((batch, index) => this.processBatch(batch, plan, context, index + 1, batches.length)));
        // 合并所有批次的结果
        const resultMap = new Map();
        batchResults.forEach((batchMap) => {
            batchMap.forEach((result) => {
                resultMap.set(result.heading, result);
            });
        });
        return resultMap;
    }
    /**
     * 创建批次 - 智能分批策略
     */
    createBatches(sections, plan) {
        // 如果启用智能分批且有 Token 限制
        if (this.config.enableSmartBatching && this.batchOptimizer && plan) {
            return this.createSmartBatches(sections, plan);
        }
        // 否则使用传统分批策略
        return this.createSimpleBatches(sections);
    }
    /**
     * 简单分批策略（基于章节数量）
     */
    createSimpleBatches(sections) {
        const batches = [];
        const maxPerBatch = this.config.maxSectionsPerBatch;
        // 如果章节数量小于等于阈值，不分批
        if (sections.length <= maxPerBatch) {
            return [sections];
        }
        // 否则，按maxSectionsPerBatch分批
        for (let i = 0; i < sections.length; i += maxPerBatch) {
            batches.push(sections.slice(i, i + maxPerBatch));
        }
        return batches;
    }
    /**
     * 智能分批策略（基于 Token 长度）
     */
    createSmartBatches(sections, plan) {
        const modelName = this.config.modelName || 'gpt-3.5-turbo';
        // 估算每个章节的 Token 数（基于标题和目标长度）
        const wordsPerSection = Math.round(plan.targetLength / sections.length);
        const estimatedTokensPerSection = wordsPerSection * 1.5; // 1 词 ≈ 1.5 tokens
        const sectionTokens = sections.map(() => estimatedTokensPerSection);
        // 使用批处理器优化器进行智能分批
        if (this.batchOptimizer) {
            const result = this.batchOptimizer.partitionIntoBatches(sections, modelName, this.config.maxSectionsPerBatch);
            console.log(`[BatchProcessor] 智能分批: ${sections.length}个章节分为${result.totalBatches}批`);
            console.log(`[BatchProcessor] 预估总Token数: ${result.totalTokens}`);
            console.log(`[BatchProcessor] 平均批次大小: ${result.averageBatchSize.toFixed(2)}`);
            return result.batches;
        }
        // 回退到简单分批
        return this.createSimpleBatches(sections);
    }
    /**
     * 估算章节的 Token 数量
     */
    estimateSectionTokens(sectionHeading, plan) {
        const modelName = this.config.modelName || 'gpt-3.5-turbo';
        const wordsPerSection = Math.round(plan.targetLength / plan.structure.sections.length);
        // 标题 Token
        const headingTokens = this.tokenCounter.estimateTokens(sectionHeading, modelName);
        // 内容 Token（估算）
        const contentTokens = wordsPerSection * 1.5;
        return headingTokens + contentTokens;
    }
    /**
     * 处理单个批次
     */
    async processBatch(sections, plan, context, batchIndex, totalBatches) {
        console.log(`[BatchProcessor] 处理第${batchIndex}/${totalBatches}批: ${sections.length}个章节`);
        try {
            // 构建批量提示
            const batchPrompt = this.buildBatchPrompt(sections, plan);
            // 调用 LLM
            const response = await this.llm.chat({
                messages: [
                    {
                        role: 'system',
                        content: `你是技术写作专家。语气：${plan.tone}。你需要批量生成多个章节的内容。`,
                    },
                    {
                        role: 'user',
                        content: batchPrompt,
                    },
                ],
                temperature: 0.7,
                maxTokens: this.config.maxSectionsPerBatch * 1000, // 每章节约1000 tokens
            });
            // 解析批量响应
            const results = this.parseBatchResponse(response.message.content, sections);
            console.log(`[BatchProcessor] 第${batchIndex}批完成，成功生成${results.size}个章节`);
            return results;
        }
        catch (error) {
            console.error(`[BatchProcessor] 第${batchIndex}批处理失败:`, error);
            // 回退到顺序处理
            return this.fallbackToSequential(sections, plan, context);
        }
    }
    /**
     * 构建批量提示
     */
    buildBatchPrompt(sections, plan) {
        const wordsPerSection = Math.round(plan.targetLength / sections.length);
        // 估算提示 Token 数
        const modelName = this.config.modelName || 'gpt-3.5-turbo';
        const promptTokens = this.estimatePromptTokens(sections, plan, wordsPerSection);
        // 如果提示 Token 接近限制，减少每章的目标长度
        let adjustedWordsPerSection = wordsPerSection;
        if (this.config.maxTokens && promptTokens > this.config.maxTokens * 0.7) {
            const ratio = (this.config.maxTokens * 0.7) / promptTokens;
            adjustedWordsPerSection = Math.floor(wordsPerSection * ratio);
            console.log(`[BatchProcessor] 调整目标长度: ${wordsPerSection} -> ${adjustedWordsPerSection} 词`);
        }
        return `请为文档"${plan.structure.title}"批量生成以下${sections.length}个章节的内容：

${sections.map((heading, index) => `${index + 1}. ${heading}`).join('\n')}

**要求**：
1. 语气：${plan.tone}
2. 目标长度：每章节约${adjustedWordsPerSection}词
3. 内容详细、准确

**输出格式**：
请严格按照以下JSON格式输出（不要使用markdown代码块）：
{
  "sections": [
    {
      "heading": "章节标题1",
      "content": "章节内容1..."
    },
    {
      "heading": "章节标题2",
      "content": "章节内容2..."
    }
  ]
}

注意：
- 必须是有效的JSON格式
- "heading"必须与上述章节标题完全一致
- "content"为该章节的完整内容
- 不要添加任何其他说明文字`;
    }
    /**
     * 估算提示 Token 数
     */
    estimatePromptTokens(sections, plan, wordsPerSection) {
        const modelName = this.config.modelName || 'gpt-3.5-turbo';
        // 基础提示 Token
        let promptTokens = this.tokenCounter.estimateTokens(`请为文档"${plan.structure.title}"批量生成以下${sections.length}个章节的内容`, modelName);
        // 章节列表 Token
        for (const section of sections) {
            promptTokens += this.tokenCounter.estimateTokens(section, modelName);
        }
        // 要求和格式说明 Token（粗略估算）
        promptTokens += 200;
        // 预期输出 Token（每章节约 wordsPerSection * 1.5 tokens）
        const estimatedOutputTokens = sections.length * wordsPerSection * 1.5;
        return promptTokens + estimatedOutputTokens;
    }
    /**
     * 解析批量响应
     */
    parseBatchResponse(response, expectedSections) {
        const resultMap = new Map();
        try {
            // 尝试提取JSON（支持代码块和直接JSON）
            let jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (!jsonMatch) {
                // 尝试直接提取JSON对象
                const objectMatch = response.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    jsonMatch = objectMatch;
                }
            }
            if (!jsonMatch) {
                throw new Error('无法从响应中提取JSON');
            }
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (!parsed.sections || !Array.isArray(parsed.sections)) {
                throw new Error('响应格式错误：缺少sections数组');
            }
            // 构建结果映射
            parsed.sections.forEach((section) => {
                if (section.heading && section.content) {
                    resultMap.set(section.heading, {
                        heading: section.heading,
                        content: section.content,
                        wordCount: section.content.split(/\s+/).length,
                    });
                }
            });
            // 验证是否所有章节都已生成
            const missingSections = expectedSections.filter((heading) => !resultMap.has(heading));
            if (missingSections.length > 0) {
                console.warn(`[BatchProcessor] 部分章节生成失败: ${missingSections.join(', ')}`);
            }
            return resultMap;
        }
        catch (error) {
            console.error('[BatchProcessor] 解析批量响应失败:', error);
            throw error;
        }
    }
    /**
     * 回退到顺序处理（兼容模式）
     *
     * @param context - 保留参数，用于未来扩展（如使用 context 中的其他信息）
     */
    async fallbackToSequential(sections, plan, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context) {
        console.log('[BatchProcessor] 回退到顺序处理模式');
        const resultMap = new Map();
        for (const heading of sections) {
            try {
                const sectionPrompt = this.buildSectionPrompt(heading, plan);
                const response = await this.llm.chat({
                    messages: [
                        {
                            role: 'system',
                            content: `你是技术写作专家。语气：${plan.tone}。`,
                        },
                        {
                            role: 'user',
                            content: sectionPrompt,
                        },
                    ],
                    temperature: 0.7,
                });
                resultMap.set(heading, {
                    heading,
                    content: response.message.content,
                    wordCount: response.message.content.split(/\s+/).length,
                });
            }
            catch (error) {
                console.error(`[BatchProcessor] 章节生成失败: ${heading}`, error);
                // 即使失败也添加空结果，保持章节顺序
                resultMap.set(heading, {
                    heading,
                    content: `[生成失败: ${error instanceof Error ? error.message : String(error)}]`,
                    wordCount: 0,
                });
            }
        }
        return resultMap;
    }
    /**
     * 构建单个章节提示（用于回退模式）
     */
    buildSectionPrompt(heading, plan) {
        const wordsPerSection = Math.round(plan.targetLength / plan.structure.sections.length);
        return `请为文档"${plan.structure.title}"撰写以下章节的内容：

**章节标题**：${heading}

**要求**：
1. 语气：${plan.tone}
2. 目标长度：约${wordsPerSection}词
3. 内容详细、准确

请直接输出章节内容，不要包含章节标题。`;
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 启用批处理
     */
    enable() {
        this.config.enabled = true;
    }
    /**
     * 禁用批处理
     */
    disable() {
        this.config.enabled = false;
    }
    /**
     * 估算成本节省
     *
     * @param sectionCount - 章节总数
     * @returns 成本节省信息
     */
    estimateCostSavings(sectionCount) {
        const originalCalls = sectionCount;
        const batches = Math.ceil(sectionCount / this.config.maxSectionsPerBatch);
        const batchCalls = batches;
        const savedCalls = originalCalls - batchCalls;
        const savingsPercentage = Math.round((savedCalls / originalCalls) * 100);
        return {
            originalCalls,
            batchCalls,
            savedCalls,
            savingsPercentage,
        };
    }
}
