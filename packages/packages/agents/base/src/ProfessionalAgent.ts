/**
 * 专业层Agent基类
 *
 * 提供统一的接口，适配OrchestratorAgent调用
 *
 * 特性：
 * - 继承Agent基类，实现plan和act方法
 * - 提供run方法，适配OrchestratorAgent调用
 * - 统一的错误处理和日志记录
 * - 支持性能监控
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
 * 专业层Agent配置
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
  }

  /**
   * run方法：适配OrchestratorAgent调用
   *
   * OrchestratorAgent期望Agent有run方法，该方法：
   * 1. 接收输入和上下文
   * 2. 调用Agent基类的execute方法
   * 3. 返回AgentResult格式
   *
   * @param input 输入数据
   * @param context 执行上下文
   * @returns AgentResult
   */
  async run(input: TInput, context: ExtendedExecutionContext): Promise<AgentResult> {
    const startTime = Date.now()

    try {
      // 记录开始日志
      context.logger?.info(`[${this.name}] 开始执行`, {
        input: JSON.stringify(input).substring(0, 200),
      })

      // 调用Agent基类的execute方法
      // execute会内部调用plan和act
      const output = await this.execute(input)

      // 记录成功日志
      context.logger?.info(`[${this.name}] 执行成功`, {
        duration: Date.now() - startTime,
      })

      return {
        success: true,
        data: output,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      // 记录错误日志
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
   *
   * @param plan 计划（由plan方法生成）
   * @param context 执行上下文
   * @returns 输出结果
   */
  protected abstract act(plan: unknown, context: ExtendedExecutionContext): Promise<TOutput>

  /**
   * 辅助方法：调用LLM
   *
   * @param params LLM调用参数
   * @returns LLM响应内容
   */
  protected async callLLM(params: LLMCallParams): Promise<string> {
    try {
      const response = await this.llm.chat({
        messages: params.messages,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      })

      return response.message?.content || ''
    } catch (error) {
      throw new Error(`LLM调用失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 辅助方法：验证输入
   *
   * @param input 输入数据
   * @param requiredFields 必填字段列表
   * @throws Error 如果验证失败
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
   *
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 格式化的错误消息
   */
  protected formatErrorMessage(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : String(error)
    return `[${this.name}] ${context}: ${message}`
  }
}
