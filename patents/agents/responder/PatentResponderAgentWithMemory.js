/**
 * PatentResponderAgent with Memory Layer
 *
 * 审查意见答复智能体 - 集成记忆层
 *
 * 核心增强：
 * 1. 检索历史答复案例（RAG）
 * 2. 学习成功的答复策略
 * 3. 语义搜索对比文件
 * 4. Token 窗口管理
 */
import { Agent } from '@yunpat/core';
/**
 * PatentResponderAgent with Memory Layer
 */
export class PatentResponderAgentWithMemory extends Agent {
    bgeClient;
    vectorStore;
    tokenWindow;
    memoryConfig;
    isInitialized = false;
    conversationHistory = [];
    constructor(config) {
        super({
            llm: config.llm,
            name: config.name || 'patent-responder-with-memory',
            description: config.description || '审查意见答复智能体 - 集成记忆层（RAG + Token窗口）',
        });
        this.memoryConfig = {
            bgeApiKey: config.memoryConfig?.bgeApiKey ?? 'xj781102@',
            databaseUrl: config.memoryConfig?.databaseUrl ?? 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
            vectorDimension: config.memoryConfig?.vectorDimension ?? 1024,
            maxTokens: config.memoryConfig?.maxTokens ?? 4000,
            reservedTokens: config.memoryConfig?.reservedTokens ?? 500,
            enableRAG: config.memoryConfig?.enableRAG ?? true,
            enableTokenWindow: config.memoryConfig?.enableTokenWindow ?? true,
        };
        this.bgeClient = null;
        this.vectorStore = null;
        this.tokenWindow = null;
    }
    /**
     * 初始化记忆层
     */
    async init(context) {
        if (this.isInitialized)
            return;
        console.log('🔧 初始化 PatentResponderAgent 记忆层...');
        this.bgeClient = createBGEM3Client({
            apiKey: this.memoryConfig.bgeApiKey,
        });
        console.log('✅ BGE-M3 客户端已初始化');
        this.vectorStore = new PostgresVectorStore({
            databaseUrl: this.memoryConfig.databaseUrl,
            vectorDimension: this.memoryConfig.vectorDimension,
        });
        await this.vectorStore.initialize();
        console.log('✅ PostgreSQL 向量存储已初始化');
        if (this.memoryConfig.enableTokenWindow) {
            this.tokenWindow = createTokenWindowManager({
                maxTokens: this.memoryConfig.maxTokens,
                reservedTokens: this.memoryConfig.reservedTokens,
                enableSummary: true,
            });
            console.log('✅ Token 窗口管理器已初始化');
        }
        this.isInitialized = true;
        console.log('🎉 记忆层初始化完成！\n');
    }
    /**
     * 规划阶段（带 RAG 增强）
     */
    async plan(input, context) {
        console.log('\n📝 [审查答复] 步骤1: 规划阶段（带记忆层增强）');
        console.log(`   申请号: ${input.applicationNumber}`);
        console.log(`   专利名称: ${input.patentTitle}`);
        if (!this.isInitialized) {
            await this.init?.(context);
        }
        // 1. RAG 增强检索历史答复案例
        let ragContext = '';
        let retrievedCases = [];
        if (this.memoryConfig.enableRAG) {
            console.log('🔍 执行 RAG 检索（历史答复案例）...');
            // 构建查询
            const query = `
        审查意见：${input.officeAction.slice(0, 200)}...
        专利名称：${input.patentTitle}
        申请号：${input.applicationNumber}
      `.trim();
            // 向量化查询
            const queryEmbedding = await this.bgeClient.embed(query);
            // 检索相关答复案例
            retrievedCases = await this.vectorStore.search(queryEmbedding, 5, {
                types: ['oa-response'],
            });
            console.log(`   找到 ${retrievedCases.length} 条历史答复案例`);
            // 构建 RAG 上下文
            if (retrievedCases.length > 0) {
                const contextParts = retrievedCases.map((case_, i) => {
                    return `[历史案例 ${i + 1}] (相似度: ${(case_.similarity * 100).toFixed(2)}%)
申请号: ${case_.metadata?.applicationNumber || '未知'}
答复策略: ${case_.metadata?.responseStrategy || '未知'}
核心论点: ${case_.content.slice(0, 200)}...`;
                });
                ragContext = `
## 历史答复案例参考

${contextParts.join('\n\n')}

请参考上述案例的答复策略和论点构建方式。
`;
            }
        }
        // 2. 管理 Token 窗口
        let compressedHistory = [];
        if (this.memoryConfig.enableTokenWindow && this.conversationHistory.length > 0) {
            console.log('🗜️ 应用 Token 窗口压缩...');
            const { messages, stats } = await this.tokenWindow.slideWindow(this.conversationHistory);
            compressedHistory = messages;
            console.log(`   Token 压缩: ${(stats.compressionRatio * 100).toFixed(2)}%`);
        }
        // 3. 构建完整提示词
        const systemPrompt = `你是一位资深的专利代理人，擅长处理专利审查意见答复。

你的任务是：
1. 深入分析审查意见中的驳回理由
2. 制定有效的答复策略（修改/争辩/合并）
3. 构建有力的论点
4. 提出合理的权利要求修改建议

${ragContext}

请分析以下审查意见，并给出答复计划。`;
        const userPrompt = `申请号：${input.applicationNumber}

专利名称：${input.patentTitle}

审查意见：
${input.officeAction}

对比文件：
${input.priorArt.join('\n')}

权利要求书：
${input.claims.join('\n')}

说明书：
${input.description.slice(0, 500)}...`;
        // 4. 调用 LLM
        const analysis = await context.llm.chat({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
        });
        // 5. 保存到对话历史
        this.conversationHistory.push({ role: 'user', content: userPrompt }, { role: 'assistant', content: analysis.message.content });
        return {
            plan: analysis.message.content,
            retrievedCases,
            ragContextUsed: retrievedCases.length > 0,
        };
    }
    /**
     * 执行阶段（生成答复 + 自动保存到记忆库）
     */
    async act(plan, context) {
        console.log('\n✍️ [审查答复] 步骤2: 执行阶段（记忆层增强）');
        const startTime = Date.now();
        // 1. 生成答复内容（简化版，实际应该调用 LLM）
        const responseContent = `
# 审查意见答复

申请号：${plan.input?.applicationNumber || ''}
专利名称：${plan.input?.patentTitle || ''}

## 答复策略
根据审查意见的具体情况，我们建议采用修改权利要求的策略。

## 核心论点
1. 权利要求具备新颖性
2. 权利要求具备创造性
3. 修改后的权利要求克服了审查意见指出的缺陷

## 建议修改的权利要求
1. 将原权利要求1的特征X修改为特征Y...
    `.trim();
        // 2. 自动保存到记忆库
        console.log('💾 保存答复案例到记忆库...');
        const responseEmbedding = await this.bgeClient.embed(responseContent);
        await this.vectorStore.upsert({
            type: 'oa-response',
            content: responseContent,
            embedding: responseEmbedding,
            metadata: {
                applicationNumber: plan.input?.applicationNumber || '未知',
                patentTitle: plan.input?.patentTitle || '未知',
                responseStrategy: 'amendment',
                createdAt: new Date().toISOString(),
                agent: 'PatentResponderAgentWithMemory',
            },
        });
        console.log('✅ 答复案例已保存到记忆库');
        // 3. 计算统计信息
        const durationMinutes = (Date.now() - startTime) / 1000 / 60;
        return {
            responseStrategy: {
                type: 'amendment',
                arguments: [
                    '权利要求具备新颖性',
                    '权利要求具备创造性',
                    '修改后的权利要求克服了审查意见指出的缺陷',
                ],
                suggestedClaims: ['修改后的权利要求1...'],
            },
            responseDocument: responseContent,
            metrics: {
                durationMinutes,
                argumentsCount: 3,
                documentWordCount: responseContent.length,
                qualityScore: 0.85,
            },
        };
    }
    /**
     * 语义搜索历史答复案例
     */
    async searchResponseCases(query, topK = 5) {
        if (!this.isInitialized) {
            throw new Error('记忆层未初始化');
        }
        console.log(`🔍 搜索答复案例：${query}`);
        const queryEmbedding = await this.bgeClient.embed(query);
        const results = await this.vectorStore.search(queryEmbedding, topK, {
            types: ['oa-response'],
        });
        return results.map((result) => ({
            content: result.content,
            similarity: result.similarity,
            metadata: result.metadata,
        }));
    }
    /**
     * 获取记忆层统计信息
     */
    async getStats() {
        if (!this.isInitialized) {
            throw new Error('记忆层未初始化');
        }
        const memoryStats = await this.vectorStore.getStats();
        const bgeStats = this.bgeClient.getCacheStats();
        return {
            vector: {
                totalResponses: memoryStats.totalMemories,
                typeDistribution: memoryStats.typeDistribution,
            },
            bge: {
                cacheSize: bgeStats.size,
                cacheHits: bgeStats.hits,
                cacheMisses: bgeStats.misses,
                cacheHitRate: bgeStats.hitRate,
            },
        };
    }
    /**
     * 清理资源
     */
    async cleanup() {
        if (this.vectorStore) {
            await this.vectorStore.close();
        }
        if (this.bgeClient) {
            this.bgeClient.clearCache();
        }
        console.log('✅ 记忆层资源已清理');
    }
}
/**
 * 创建带记忆的审查答复智能体（工厂函数）
 */
export async function createPatentResponderAgentWithMemory(config) {
    const agent = new PatentResponderAgentWithMemory(config);
    return agent;
}
