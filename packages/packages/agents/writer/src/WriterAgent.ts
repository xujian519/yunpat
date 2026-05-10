import {
  KnowledgeEnhancedAgent,
  ExecutionContext,
  IncrementalGenerator,
  SemanticCache,
} from '@yunpat/core'
import type { EnhancedTool } from '@yunpat/core'
import type { WritingTask, WritingPlan, WritingResult, WriterAgentConfig } from './WriterTypes.js'
import { CACHE_CONFIG, GENERATION_CONFIG, createWritingTaskSignature } from './WriterTypes.js'
import {
  buildOutlinePrompt,
  parseOutline,
  buildSectionPrompt,
  formatContent,
  determineTone,
  estimateLength,
  extractOutlineFromContent,
  extractSectionsFromContent,
  extractSimilarity,
  validateAndCastTone,
} from './WriterPromptBuilder.js'

// Re-export types for backward compatibility
export type { WritingTask, WritingPlan, WritingResult, WriterAgentConfig } from './WriterTypes.js'

/**
 * 技术写作助手智能体（统一版）
 *
 * 基础功能：文档生成、格式转换、内容优化、语义缓存、增量生成
 * 增强功能（可选）：智能工具选择、工具使用统计
 */
export class WriterAgent extends KnowledgeEnhancedAgent<WritingTask, WritingResult> {
  private semanticCache: SemanticCache<WritingTask, WritingResult>
  private cachedResult: WritingResult | null = null
  private currentTask: WritingTask | null = null
  private enableTools: boolean
  private availableTools: EnhancedTool[] = []
  private toolUsageStats = {
    totalSelections: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
  }

  constructor(config: WriterAgentConfig) {
    super({
      name: 'writer',
      description: config.enableTools
        ? '技术写作助手（增强版）- 文档生成、格式转换、内容优化、智能工具调用'
        : '技术写作助手 - 文档生成、格式转换、内容优化',
      eventBus: config.eventBus,
      memory: config.memory,
      tools: config.tools,
      llm: config.llm,
      maxIterations: config.maxIterations,
      timeout: config.timeout,
    })

    this.enableTools = config.enableTools ?? false
    if (config.enhancedTools) {
      this.availableTools = config.enhancedTools
    }

    if (this.enableTools) {
      console.log('🚀 写作助手已启用工具增强功能')
    }

    this.semanticCache = new SemanticCache({
      similarityThreshold: CACHE_CONFIG.SIMILARITY_THRESHOLD,
      maxCacheSize: CACHE_CONFIG.MAX_CACHE_SIZE,
      cacheExpiration: CACHE_CONFIG.CACHE_EXPIRATION_MS,
      generateSignature: createWritingTaskSignature,
    })
  }

  private cleanup() {
    this.cachedResult = null
    this.currentTask = null
  }

  registerTools(tools: EnhancedTool[]) {
    this.availableTools = tools
    this.enableTools = true
    console.log(`🔧 已注册 ${tools.length} 个工具`)
    tools.forEach((tool) => {
      console.log(`   - ${tool.metadata.name}: ${tool.metadata.description}`)
    })
  }

  getToolUsageStats() {
    return {
      ...this.toolUsageStats,
      successRate:
        this.toolUsageStats.totalSelections > 0
          ? this.toolUsageStats.successfulExecutions / this.toolUsageStats.totalSelections
          : 0,
    }
  }

  resetToolUsageStats() {
    this.toolUsageStats = { totalSelections: 0, successfulExecutions: 0, failedExecutions: 0 }
  }

  protected async plan(task: WritingTask, context: ExecutionContext): Promise<WritingPlan> {
    this.currentTask = task

    try {
      console.log('[语义缓存] 查找相似任务...')
      const cachedData = await this.semanticCache.findSimilar(task)

      if (cachedData) {
        const similarity = extractSimilarity(cachedData)
        console.log(`[语义缓存] ✅ 命中！相似度 ${(similarity * 100).toFixed(1)}%`)
        console.log(`[语义缓存] 跳过生成，直接返回缓存结果`)

        this.cachedResult = cachedData.response

        return {
          outline: extractOutlineFromContent(cachedData.response.document.content),
          structure: {
            title: cachedData.response.document.title,
            sections: extractSectionsFromContent(cachedData.response.document.content),
          },
          tone: validateAndCastTone(cachedData.response.metadata.tone),
          targetLength: cachedData.response.stats.wordCount,
          incremental: false,
        }
      }

      console.log('[语义缓存] ❌ 未命中，继续生成...')

      let selectedTool: string | undefined

      if (this.enableTools && this.availableTools.length > 0) {
        console.log('\n🧠 [增强模式] 选择合适的工具...')
        selectedTool = await this.selectToolForTask(task, context)
        if (selectedTool) {
          console.log(`✅ 选择的工具: ${selectedTool}`)
          this.toolUsageStats.totalSelections++
        }
      }

      const incrementalPlan = await this.tryIncrementalGeneration(task, context)
      if (incrementalPlan) {
        return { ...incrementalPlan, selectedTool }
      }

      const outline = await this.generateOutline(task, context)
      const tone = determineTone(task)
      const targetLength = estimateLength(task)

      return {
        outline,
        structure: {
          title: task.topic,
          sections: outline.map((heading, index) => ({
            heading,
            content: '',
            order: index,
          })),
        },
        tone,
        targetLength,
        incremental: false,
        selectedTool,
      }
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  protected async act(plan: WritingPlan, context: ExecutionContext): Promise<WritingResult> {
    try {
      if (this.cachedResult) {
        console.log('[语义缓存] 返回缓存结果，跳过生成')
        const result = this.cachedResult
        this.cleanup()
        return result
      }

      if (plan.selectedTool && this.enableTools) {
        const result = await this.generateWithTool(plan, context)
        if (result) return result
      }

      console.log('📝 使用标准写作流程...')
      return await this.generateContent(plan, context)
    } finally {
      this.cleanup()
    }
  }

  protected async reflect(
    result: WritingResult,
    _context: ExecutionContext
  ): Promise<{ shouldContinue: boolean; feedback?: string }> {
    if (this.enableTools) {
      console.log('\n🔍 [增强模式] 工具使用统计:')
      console.log(`  总选择次数: ${this.toolUsageStats.totalSelections}`)
      console.log(`  成功执行次数: ${this.toolUsageStats.successfulExecutions}`)
      console.log(`  失败执行次数: ${this.toolUsageStats.failedExecutions}`)

      if (result.toolUsageStats) {
        result.toolUsageStats = { ...this.toolUsageStats }
      }
    }

    const cacheStats = this.semanticCache.getStats()
    console.log('[语义缓存] 统计信息:')
    console.log(`  - 命中率: ${cacheStats.hitRate}%`)
    console.log(`  - 总请求数: ${cacheStats.totalRequests}`)
    console.log(`  - 缓存大小: ${cacheStats.size}`)

    const qualityChecks = [
      result.stats.wordCount > 100,
      result.stats.sectionCount > 1,
      result.document.content.includes('#'),
    ]

    if (!qualityChecks.every((check) => check)) {
      return { shouldContinue: false, feedback: '文档质量检查未通过，但已生成基本内容' }
    }

    return { shouldContinue: false, feedback: '文档生成成功' }
  }

  private async selectToolForTask(
    task: WritingTask,
    _context: ExecutionContext
  ): Promise<string | undefined> {
    for (const tool of this.availableTools) {
      const category = tool.metadata.category || ''

      if (
        (task.type === 'convert' && category.includes('convert')) ||
        (task.type === 'format' && category.includes('format')) ||
        (task.type === 'optimize' && category.includes('optimize'))
      ) {
        return tool.metadata.name
      }
    }

    return undefined
  }

  private async generateWithTool(
    plan: WritingPlan,
    _context: ExecutionContext
  ): Promise<WritingResult | undefined> {
    if (!plan.selectedTool) return undefined

    const tool = this.availableTools.find((t) => t.metadata.name === plan.selectedTool)
    if (!tool) {
      console.warn(`工具 ${plan.selectedTool} 未找到`)
      return undefined
    }

    console.log(`🔧 执行工具: ${plan.selectedTool}`)

    try {
      const startTime = Date.now()
      const toolResult = await tool.execute(
        { action: 'generate', plan, timestamp: Date.now() } as any,
        {} as any
      )

      this.toolUsageStats.successfulExecutions++
      console.log(`✅ 工具执行成功，耗时: ${Date.now() - startTime}ms`)

      if (toolResult && typeof toolResult === 'object' && 'content' in toolResult) {
        return {
          document: {
            title: plan.structure.title,
            content: toolResult.content as string,
            format: 'markdown',
          },
          stats: {
            wordCount: (toolResult.content as string).split(/\s+/).length,
            paragraphCount: plan.structure.sections.length,
            sectionCount: plan.structure.sections.length,
          },
          metadata: { generatedAt: new Date(), tone: plan.tone, revision: 1 },
          toolUsageStats: { ...this.toolUsageStats },
        }
      }

      return undefined
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.toolUsageStats.failedExecutions++
      console.error(`❌ 工具执行失败: ${errorMsg}`)
      return undefined
    }
  }

  private async tryIncrementalGeneration(
    task: WritingTask,
    context: ExecutionContext
  ): Promise<WritingPlan | null> {
    if (task.type === 'generate') return null

    const taskKey = `writer:${task.type}:${task.topic}`
    const previousContent = await context.memory.get(taskKey)

    if (!previousContent) return null

    console.log('[增量生成] 检测到历史版本，分析差异...')

    try {
      const incrementalGenerator = new IncrementalGenerator(context.llm)
      const diff = await incrementalGenerator.diff(
        previousContent as string,
        `任务类型: ${task.type}\n主题: ${task.topic}`
      )

      console.log(`[增量生成] 差异分析完成`)

      if (diff.changes && diff.changes.length > 0) {
        const outline = extractOutlineFromContent(previousContent as string)

        return {
          outline,
          structure: {
            title: task.topic,
            sections: outline.map((heading, index) => ({
              heading,
              content: '',
              order: index,
            })),
          },
          tone: determineTone(task),
          targetLength: estimateLength(task),
          incremental: true,
          previousContent: previousContent as string,
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn(`[增量生成] 差异分析失败: ${errorMsg}，回退到完整生成`)
    }

    return null
  }

  private async generateContent(
    plan: WritingPlan,
    context: ExecutionContext
  ): Promise<WritingResult> {
    const sectionPromises = plan.structure.sections.map(async (section) => {
      const sectionPrompt = buildSectionPrompt(section.heading, plan)

      const response = await context.llm.chat({
        messages: [
          { role: 'system', content: `你是一个技术写作专家。语气：${plan.tone}。` },
          { role: 'user', content: sectionPrompt },
        ],
        temperature: GENERATION_CONFIG.DEFAULT_TEMPERATURE,
      })

      return {
        section,
        content: response.message.content,
        wordCount: response.message.content.split(/\s+/).length,
      }
    })

    const results = await Promise.all(sectionPromises)

    let fullContent = ''
    let totalWords = 0

    results.forEach(({ section, content, wordCount }) => {
      section.content = content
      fullContent += `## ${section.heading}\n\n${content}\n\n`
      totalWords += wordCount
    })

    const result: WritingResult = {
      document: {
        title: plan.structure.title,
        content: formatContent(fullContent, plan),
        format: 'markdown',
      },
      stats: {
        wordCount: totalWords,
        paragraphCount: plan.structure.sections.length,
        sectionCount: plan.structure.sections.length,
      },
      metadata: {
        generatedAt: new Date(),
        tone: plan.tone,
        revision: plan.incremental ? 2 : 1,
      },
    }

    if (this.enableTools) {
      result.toolUsageStats = { ...this.toolUsageStats }
    }

    if (this.currentTask) {
      await this.semanticCache.store(this.currentTask, result)
      console.log('[语义缓存] ✅ 已存储生成结果')
    }

    return result
  }

  private async generateOutline(task: WritingTask, context: ExecutionContext): Promise<string[]> {
    for (let attempt = 0; attempt <= GENERATION_CONFIG.MAX_OUTLINE_RETRIES; attempt++) {
      try {
        const outlinePrompt = buildOutlinePrompt(task)

        const finalPrompt =
          attempt > 0
            ? outlinePrompt +
              `\n\n**重要：这是第 ${attempt + 1} 次尝试，请确保严格遵循 JSON 格式！**`
            : outlinePrompt

        const outlineResponse = await context.llm.chat({
          messages: [
            { role: 'system', content: '你是一个技术写作专家，擅长创建清晰、结构化的文档大纲。' },
            { role: 'user', content: finalPrompt },
          ],
          temperature: GENERATION_CONFIG.DEFAULT_TEMPERATURE,
        })

        return parseOutline(outlineResponse.message.content)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        if (attempt < GENERATION_CONFIG.MAX_OUTLINE_RETRIES) {
          console.warn(
            `大纲解析失败，正在重试 (${attempt + 1}/${GENERATION_CONFIG.MAX_OUTLINE_RETRIES}): ${errorMsg}`
          )
          continue
        }

        throw new Error(`无法生成大纲: ${errorMsg}`)
      }
    }

    throw new Error('无法生成大纲')
  }
}

export function createWriterAgent(config: WriterAgentConfig) {
  return new WriterAgent(config)
}

export function createEnhancedWriterAgent(config: WriterAgentConfig) {
  return new WriterAgent({ ...config, enableTools: true })
}
