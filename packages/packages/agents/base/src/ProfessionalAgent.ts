/**
 * 专业层Agent基类（Phase 0 + Phase 1 重构版）
 *
 * 改进点：
 * 1. 集成 PromptAssemblyPipeline — 支持 Frontmatter 化 Agent 定义
 * 2. 集成 TokenBudgetManager — 上下文窗口预算管理
 * 3. 集成 DocumentSegmentLoader — 专利文档分段加载
 * 4. 知识上下文自动注入 — 检索结果通过 Prompt 管道动态注入
 * 5. 支持 SystemPrompt 品牌类型和缓存分块
 *
 * @package @yunpat/agents/base
 */

import {
  KnowledgeEnhancedAgent,
  type LLMAdapter,
  type ExecutionContext,
  type MemoryStore,
  type IEventBus,
  type IToolRegistry,
  // Phase 0: Prompt 工程重构
  type PromptConfig,
  PromptAssemblyPipeline,
  type AgentDefinition,
  agentDefinitionLoader,
  sectionRegistry,
  registerSection,
  PERSONA_LIBRARY,
  registerDefaultPromptSections as registerCoreDefaultPromptSections,
  // Phase 1: Token 预算与压缩
  TokenBudgetManager,
  type TokenBudgetConfig,
  DocumentSegmentLoader,
  microCompact,
} from '@yunpat/core'

/**
 * Agent执行结果
 */
export interface AgentResult {
  /** 是否成功 */
  success: boolean
  /** 数据 */
  data: unknown
  /** 错误信息（失败时） */
  error?: Error
  /** 执行时间（毫秒） */
  executionTime: number
  /** 是否需要HITL */
  requiresHITL?: boolean
  /** HITL检查点（requiresHITL=true时） */
  hitlCheckpoint?: string
}

/**
 * 执行上下文（扩展版）
 */
export interface ExtendedExecutionContext extends ExecutionContext {
  /** 日志记录器 */
  logger?: {
    info: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
  }
}

/**
 * 专业层Agent配置（Phase 0/1 扩展）
 */
export interface ProfessionalAgentConfig {
  /** Agent名称 */
  name: string
  /** Agent描述 */
  description: string
  /** LLM适配器 */
  llm: LLMAdapter
  /** 事件总线 */
  eventBus: IEventBus
  /** 内存存储 */
  memory: MemoryStore
  /** 工具注册表 */
  tools: IToolRegistry
  /** 最大迭代次数（可选） */
  maxIterations?: number
  /** 超时时间（毫秒，可选） */
  timeout?: number
  /** 是否启用知识图谱（可选，默认 true） */
  enableKnowledgeGraph?: boolean

  // Phase 0: 新增 — Agent 定义（Frontmatter）
  /** Agent 定义（Frontmatter 解析结果），优先级高于代码内配置 */
  agentDefinition?: AgentDefinition
  /** 自定义系统提示词 */
  customSystemPrompt?: string
  /** 是否使用 Prompt 组装管道 */
  usePromptPipeline?: boolean

  // Phase 1: 新增 — Token 预算
  /** Token 预算配置 */
  tokenBudgetConfig?: TokenBudgetConfig
  /** 是否启用自动压缩 */
  enableAutoCompact?: boolean
  /** 专利文档分段（如果 Agent 处理专利文档） */
  documentSegments?: Array<{ id: string; type: string; title: string; content: string }>
}

/**
 * LLM调用参数
 */
export interface LLMCallParams {
  /** 消息列表 */
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>
  /** 最大token数 */
  maxTokens?: number
  /** 温度参数 */
  temperature?: number
}

/**
 * LLM响应
 */
export interface LLMResponse {
  /** 响应内容 */
  content: string
  /** 其他元数据 */
  [key: string]: unknown
}

/**
 * 专业层Agent基类
 *
 * 所有专业层Agent都应该继承此类，并实现plan和act方法
 *
 * @template TInput 输入类型
 * @template TOutput 输出类型
 */
export abstract class ProfessionalAgent<TInput = any, TOutput = any> extends KnowledgeEnhancedAgent<
  TInput,
  TOutput
> {
  /** Agent配置 */
  protected readonly config: ProfessionalAgentConfig

  // Phase 0: Prompt 组装管道
  protected readonly promptPipeline: PromptAssemblyPipeline

  // Phase 1: Token 预算管理器
  protected readonly tokenBudgetManager: TokenBudgetManager

  // Phase 1: 文档分段加载器（可选）
  protected documentLoader?: DocumentSegmentLoader

  constructor(config: ProfessionalAgentConfig) {
    super({
      name: config.name,
      description: config.description,
      llm: config.llm,
      eventBus: config.eventBus,
      memory: config.memory,
      tools: config.tools,
      maxIterations: config.maxIterations,
      timeout: config.timeout,
      enableKnowledgeGraph: config.enableKnowledgeGraph,
    })
    this.config = config

    // Phase 0: 初始化 Prompt 组装管道
    this.promptPipeline = new PromptAssemblyPipeline()

    // Phase 1: 初始化 Token 预算管理器
    this.tokenBudgetManager = new TokenBudgetManager(config.tokenBudgetConfig)

    // Phase 1: 初始化文档分段加载器（如果有文档段落）
    if (config.documentSegments && config.documentSegments.length > 0) {
      this.documentLoader = new DocumentSegmentLoader()
      this.documentLoader.registerSegments(
        config.documentSegments.map((seg) => ({
          ...seg,
          tokenCount: 0, // 会由 loader 自动计算
          isResident: false,
          priority: 5,
        }))
      )
    }
  }

  /**
   * run方法：适配OrchestratorAgent调用
   */
  async run(input: TInput, context: ExtendedExecutionContext): Promise<AgentResult> {
    const startTime = Date.now()

    try {
      context.logger?.info(`[${this.name}] 开始执行`, {
        input: JSON.stringify(input).substring(0, 200),
      })

      // Phase 1: 检查 token 预算
      const budget = this.tokenBudgetManager.calculateBudget()
      context.logger?.info(`[${this.name}] Token 预算`, {
        availableForHistory: budget.availableForHistory,
        warningThreshold: budget.warningThreshold,
      })

      const output = await this.execute(input)

      context.logger?.info(`[${this.name}] 执行成功`, {
        duration: Date.now() - startTime,
      })

      return {
        success: true,
        data: output,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      context.logger?.error(`[${this.name}] 执行失败`, {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime: Date.now() - startTime,
        data: undefined,
      }
    }
  }

  /**
   * act方法：执行计划
   *
   * 子类必须实现此方法，根据plan执行具体任务
   */
  protected abstract act(plan: unknown, context: ExtendedExecutionContext): Promise<TOutput>

  /**
   * Phase 0: 组装 System Prompt
   *
   * 支持知识上下文自动注入（如果启用了知识图谱）。
   * 子类可覆盖此方法以自定义 Prompt 组装逻辑。
   */
  protected async assembleSystemPrompt(knowledgeQuery?: string): Promise<string> {
    const promptConfig: PromptConfig = {
      agentType: this.config.agentDefinition?.name || this.name,
      agentDefinitionPrompt: this.config.agentDefinition?.systemPrompt,
      customPrompt: this.config.customSystemPrompt,
    }

    // Phase 0b: 如果启用了知识图谱且有查询文本，自动注入知识上下文
    if (this.enableKnowledgeGraph && knowledgeQuery && this.knowledgeGraph) {
      try {
        // 预留 4000 tokens 给知识上下文（在 token budget 中已预留）
        const knowledgeResults = await this.queryKnowledge(knowledgeQuery, 5, 4000)
        if (knowledgeResults.length > 0) {
          const knowledgeSections = this.buildKnowledgeContextSections(knowledgeResults)
          // 注册为临时 dynamic sections（本次组装有效）
          for (const section of knowledgeSections) {
            this.promptPipeline.registerSection(section)
          }
          console.log(`[${this.name}] 知识上下文已注入: ${knowledgeResults.length} 条结果`)
        }
      } catch (err) {
        console.warn(`[${this.name}] 知识上下文注入失败:`, err)
      }
    }

    // 组装 System Prompt
    const systemPrompt = await this.promptPipeline.assemble(promptConfig)
    return systemPrompt.join('\n\n')
  }

  /**
   * 向后兼容：旧的 buildSystemPrompt 钩子
   * 子类可保留此方法，但推荐使用 Agent 定义 Frontmatter。
   */
  protected buildLegacySystemPrompt?(): string

  /**
   * Phase 1: 检查并执行自动压缩
   */
  protected async autoCompactIfNeeded(
    messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>
  ): Promise<Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>> {
    if (!this.config.enableAutoCompact) {
      return messages
    }

    const { estimateMessagesTokens } = await import('@yunpat/core')
    const currentTokens = estimateMessagesTokens(messages)

    if (this.tokenBudgetManager.shouldAutoCompact(currentTokens)) {
      console.log(`[${this.name}] Token 使用量 ${currentTokens} 触发自动压缩`)
      const result = await microCompact(messages)
      if (result.executed) {
        console.log(`[${this.name}] 自动压缩完成，节省 ${result.tokensSaved} tokens`)
      }
      return result.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content,
      }))
    }

    if (this.tokenBudgetManager.shouldWarn(currentTokens)) {
      console.warn(`[${this.name}] Token 使用量 ${currentTokens} 接近警告阈值`)
    }

    return messages
  }

  /**
   * 辅助方法：调用LLM（Phase 0/1 增强版）
   *
   * 自动：
   * 1. 组装 System Prompt（如果使用 Prompt 管道）
   * 2. 检查 token 预算
   * 3. 执行自动压缩（如果启用）
   */
  protected async callLLM(params: LLMCallParams): Promise<string> {
    try {
      // Phase 0: 如果第一条消息是 system 且启用了管道，替换为组装后的 System Prompt
      const messages = [...params.messages]
      const firstMessage = messages[0]

      if (
        firstMessage?.role === 'system' &&
        (this.config.usePromptPipeline || this.config.agentDefinition)
      ) {
        // 尝试从 user message 中提取知识查询文本
        const userMessage = messages.find((m) => m.role === 'user')
        const knowledgeQuery = userMessage?.content.substring(0, 500)
        const assembledPrompt = await this.assembleSystemPrompt(knowledgeQuery)
        messages[0] = { ...firstMessage, content: assembledPrompt }
      }

      // Phase 1: 自动压缩检查
      const compactedMessages = await this.autoCompactIfNeeded(messages)

      const response = await this.llm.chat({
        messages: compactedMessages as Array<{
          role: 'system' | 'user' | 'assistant' | 'tool'
          content: string
        }>,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      })

      return response.message?.content || ''
    } catch (error) {
      throw new Error(`LLM调用失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Phase 0: 加载 Agent 定义（Frontmatter）
   *
   * 静态方法，用于在实例化前加载 Agent 定义。
   */
  static async loadDefinition(name: string): Promise<AgentDefinition | undefined> {
    await agentDefinitionLoader.loadAll()
    return agentDefinitionLoader.get(name)
  }

  /**
   * 辅助方法：验证输入
   */
  protected validateInput(input: Record<string, unknown>, requiredFields: string[]): void {
    for (const field of requiredFields) {
      const value = input[field]
      if (value === null || value === undefined || value === '') {
        throw new Error(`${field}不能为空`)
      }
    }
  }

  /**
   * 辅助方法：格式化错误消息
   */
  protected formatErrorMessage(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : String(error)
    return `[${this.name}] ${context}: ${message}`
  }
}

/**
 * 初始化默认 Prompt Sections
 *
 * 在应用启动时调用一次，注册所有 Agent 共享的默认 Section。
 * @deprecated 请使用 `@yunpat/core` 中的 `registerDefaultPromptSections()`
 */
export function registerDefaultPromptSections(): void {
  registerCoreDefaultPromptSections()
}
