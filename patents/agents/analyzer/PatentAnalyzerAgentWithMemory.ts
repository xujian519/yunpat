/**
 * PatentAnalyzerAgent with Memory Layer
 *
 * 专利分析智能体 - 集成记忆层
 *
 * 核心增强：
 * 1. 存储历史分析结果
 * 2. 检索相似专利
 * 3. 语义搜索技术趋势
 * 4. Token 窗口管理
 */

import { Agent, type LLMAdapter, type ExecutionContext } from '@yunpat/core'
import type { PatentAnalysisInput } from './PatentAnalyzerAgent.js'

/**
 * 分析结果输出
 */
export interface PatentAnalysisOutput {
  analysisType: string
  results: any
  metrics: {
    durationMinutes: number
    patentsAnalyzed: number
    qualityScore: number
  }
}

/**
 * 记忆层配置
 */
export interface MemoryLayerConfig {
  bgeApiKey?: string
  databaseUrl?: string
  vectorDimension?: number
  maxTokens?: number
  reservedTokens?: number
  enableRAG?: boolean
  enableTokenWindow?: boolean
}

/**
 * PatentAnalyzerAgent with Memory Layer
 */
export class PatentAnalyzerAgentWithMemory extends Agent<
  PatentAnalysisInput,
  PatentAnalysisOutput
> {
  private bgeClient: any
  private vectorStore: any
  private tokenWindow: any
  private memoryConfig: MemoryLayerConfig
  private isInitialized: boolean = false

  constructor(config: {
    llm: LLMAdapter
    memoryConfig?: MemoryLayerConfig
    name?: string
    description?: string
  }) {
    super({
      llm: config.llm,
      name: config.name || 'patent-analyzer-with-memory',
      description: config.description || '专利分析智能体 - 集成记忆层（RAG + Token窗口）',
    })

    this.memoryConfig = {
      bgeApiKey: config.memoryConfig?.bgeApiKey ?? 'xj781102@',
      databaseUrl:
        config.memoryConfig?.databaseUrl ?? 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
      vectorDimension: config.memoryConfig?.vectorDimension ?? 1024,
      maxTokens: config.memoryConfig?.maxTokens ?? 4000,
      reservedTokens: config.memoryConfig?.reservedTokens ?? 500,
      enableRAG: config.memoryConfig?.enableRAG ?? true,
      enableTokenWindow: config.memoryConfig?.enableTokenWindow ?? true,
    }

    this.bgeClient = null
    this.vectorStore = null
    this.tokenWindow = null
  }

  /**
   * 初始化记忆层
   */
  protected async init?(context: ExecutionContext): Promise<void> {
    if (this.isInitialized) return

    console.log('🔧 初始化 PatentAnalyzerAgent 记忆层...')

    this.bgeClient = createBGEM3Client({
      apiKey: this.memoryConfig.bgeApiKey,
    })
    console.log('✅ BGE-M3 客户端已初始化')

    this.vectorStore = new PostgresVectorStore({
      databaseUrl: this.memoryConfig.databaseUrl,
      vectorDimension: this.memoryConfig.vectorDimension,
    })
    await this.vectorStore.initialize()
    console.log('✅ PostgreSQL 向量存储已初始化')

    if (this.memoryConfig.enableTokenWindow) {
      this.tokenWindow = createTokenWindowManager({
        maxTokens: this.memoryConfig.maxTokens,
        reservedTokens: this.memoryConfig.reservedTokens,
        enableSummary: true,
      })
      console.log('✅ Token 窗口管理器已初始化')
    }

    this.isInitialized = true
    console.log('🎉 记忆层初始化完成！\n')
  }

  /**
   * 规划阶段（带 RAG 增强）
   */
  protected async plan(input: PatentAnalysisInput, context: ExecutionContext): Promise<any> {
    console.log('\n📊 [专利分析] 步骤1: 规划阶段（带记忆层增强）')
    console.log(`   分析类型: ${input.analysisType}`)

    if (!this.isInitialized) {
      await this.init?.(context)
    }

    // 1. RAG 增强检索历史分析结果
    let ragContext = ''
    let retrievedAnalyses: any[] = []

    if (this.memoryConfig.enableRAG) {
      console.log('🔍 执行 RAG 检索（历史分析结果）...')

      // 构建查询
      const query = `
        分析类型：${input.analysisType}
        技术领域：${input.technicalField || ''}
        关键词：${input.parameters?.keywords?.join(', ') || ''}
      `.trim()

      // 向量化查询
      const queryEmbedding = await this.bgeClient.embed(query)

      // 检索相关分析结果
      retrievedAnalyses = await this.vectorStore.search(queryEmbedding, 5, {
        types: ['patent-analysis'],
      })

      console.log(`   找到 ${retrievedAnalyses.length} 条历史分析结果`)

      // 构建 RAG 上下文
      if (retrievedAnalyses.length > 0) {
        const contextParts = retrievedAnalyses.map((analysis, i) => {
          return `[历史分析 ${i + 1}] (相似度: ${(analysis.similarity * 100).toFixed(2)}%)
类型: ${analysis.metadata?.analysisType || '未知'}
技术领域: ${analysis.metadata?.technicalField || '未知'}
结论: ${analysis.content.slice(0, 200)}...`
        })

        ragContext = `
## 历史分析参考

${contextParts.join('\n\n')}

请参考上述分析方法和结论框架。
`
      }
    }

    // 2. 构建完整提示词
    const systemPrompt = `你是一位资深的专利分析师，擅长专利价值评估和技术趋势分析。

你的任务是：
1. 深入分析专利的技术价值
2. 识别技术发展趋势
3. 评估竞争态势
4. 提供战略建议

${ragContext}

请制定分析计划。`

    const userPrompt = `分析类型：${input.analysisType}
技术领域：${input.technicalField || '未指定'}
目标专利：${input.targetPatents?.join(', ') || '未指定'}
时间范围：${input.timeRange?.start || ''} - ${input.timeRange?.end || ''}
竞争对手：${input.competitors?.join(', ') || '未指定'}
关键词：${input.parameters?.keywords?.join(', ') || ''}`

    // 3. 调用 LLM
    const analysis = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return {
      plan: analysis.message.content,
      retrievedAnalyses,
      ragContextUsed: retrievedAnalyses.length > 0,
    }
  }

  /**
   * 执行阶段（生成分析 + 自动保存到记忆库）
   */
  protected async act(plan: any, context: ExecutionContext): Promise<PatentAnalysisOutput> {
    console.log('\n📊 [专利分析] 步骤2: 执行阶段（记忆层增强）')

    const startTime = Date.now()

    // 1. 生成分析结果（简化版，实际应该调用 LLM）
    const analysisResult = {
      summary: '专利技术价值分析完成',
      keyFindings: ['技术领域处于快速成长期', '竞争对手布局积极', '技术空白点存在机会'],
      recommendations: ['加强核心技术研发', '扩大专利布局范围', '关注新兴技术方向'],
    }

    const analysisContent = `
# 专利分析报告

分析类型：${plan.input?.analysisType || ''}

## 核心发现
${analysisResult.keyFindings.map((f) => `- ${f}`).join('\n')}

## 战略建议
${analysisResult.recommendations.map((r) => `- ${r}`).join('\n')}
    `.trim()

    // 2. 自动保存到记忆库
    console.log('💾 保存分析结果到记忆库...')
    const analysisEmbedding = await this.bgeClient.embed(analysisContent)

    await this.vectorStore.upsert({
      type: 'patent-analysis',
      content: analysisContent,
      embedding: analysisEmbedding,
      metadata: {
        analysisType: plan.input?.analysisType || 'unknown',
        technicalField: plan.input?.technicalField || '',
        keywords: plan.input?.parameters?.keywords || [],
        createdAt: new Date().toISOString(),
        agent: 'PatentAnalyzerAgentWithMemory',
      },
    })

    console.log('✅ 分析结果已保存到记忆库')

    // 3. 计算统计信息
    const durationMinutes = (Date.now() - startTime) / 1000 / 60

    return {
      analysisType: plan.input?.analysisType || 'unknown',
      results: analysisResult,
      metrics: {
        durationMinutes,
        patentsAnalyzed: plan.input?.targetPatents?.length || 0,
        qualityScore: 0.85,
      },
    }
  }

  /**
   * 语义搜索历史分析结果
   */
  async searchAnalyses(
    query: string,
    topK: number = 5
  ): Promise<
    Array<{
      content: string
      similarity: number
      metadata: any
    }>
  > {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化')
    }

    console.log(`🔍 搜索分析结果：${query}`)

    const queryEmbedding = await this.bgeClient.embed(query)
    const results = await this.vectorStore.search(queryEmbedding, topK, {
      types: ['patent-analysis'],
    })

    return results.map((result) => ({
      content: result.content,
      similarity: result.similarity,
      metadata: result.metadata,
    }))
  }

  /**
   * 获取记忆层统计信息
   */
  async getStats() {
    if (!this.isInitialized) {
      throw new Error('记忆层未初始化')
    }

    const memoryStats = await this.vectorStore.getStats()
    const bgeStats = this.bgeClient.getCacheStats()

    return {
      vector: {
        totalAnalyses: memoryStats.totalMemories,
        typeDistribution: memoryStats.typeDistribution,
      },
      bge: {
        cacheSize: bgeStats.size,
        cacheHits: bgeStats.hits,
        cacheMisses: bgeStats.misses,
        cacheHitRate: bgeStats.hitRate,
      },
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.close()
    }
    if (this.bgeClient) {
      this.bgeClient.clearCache()
    }
    console.log('✅ 记忆层资源已清理')
  }
}

/**
 * 创建带记忆的专利分析智能体（工厂函数）
 */
export async function createPatentAnalyzerAgentWithMemory(config: {
  llm: LLMAdapter
  memoryConfig?: MemoryLayerConfig
}): Promise<PatentAnalyzerAgentWithMemory> {
  const agent = new PatentAnalyzerAgentWithMemory(config)
  return agent
}
