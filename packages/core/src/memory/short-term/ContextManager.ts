/**
 * 上下文管理器
 *
 * 核心功能：
 * 1. 拼接多轮对话
 * 2. 注入系统提示
 * 3. 管理 Token 窗口
 * 4. 格式化输出
 */

import { TokenWindowManager, type Message, type TokenWindowConfig } from './TokenWindow.js'

export interface ContextConfig extends TokenWindowConfig {
  /** 系统提示（可选） */
  systemPrompt?: string
  /** 是否包含时间戳（默认 false） */
  includeTimestamp?: boolean
  /** 消息格式化函数（可选） */
  formatMessage?: (message: Message) => string
}

export interface FormatOptions {
  /** 是否格式化为 Markdown */
  asMarkdown?: boolean
  /** 是否包含角色标签 */
  includeRole?: boolean
  /** 自定义分隔符 */
  separator?: string
}

/**
 * 上下文管理器
 *
 * 负责管理对话上下文和格式化输出
 */
export class ContextManager {
  private tokenWindow: TokenWindowManager
  private systemPrompt?: string
  private includeTimestamp: boolean
  private formatMessage?: (message: Message) => string

  constructor(config: ContextConfig = {}) {
    this.tokenWindow = new TokenWindowManager(config)
    this.systemPrompt = config.systemPrompt
    this.includeTimestamp = config.includeTimestamp ?? false
    this.formatMessage = config.formatMessage
  }

  /**
   * 构建完整上下文（核心功能）
   *
   * 流程：
   * 1. 添加系统提示
   * 2. 应用 Token 窗口
   * 3. 格式化输出
   */
  async buildContext(
    messages: Message[],
    options?: FormatOptions
  ): Promise<{
    context: string
    stats: {
      totalMessages: number
      totalTokens: number
      compressionRatio: number
    }
  }> {
    // 1. 应用 Token 窗口
    const { messages: compressed, stats } = await this.tokenWindow.slideWindow(messages)

    // 2. 添加系统提示
    let finalMessages: Message[] = []
    if (this.systemPrompt) {
      finalMessages.push({
        role: 'system',
        content: this.systemPrompt,
        timestamp: new Date(),
      })
    }
    finalMessages = finalMessages.concat(compressed)

    // 3. 格式化输出
    const context = this.formatMessages(finalMessages, options)

    return {
      context,
      stats: {
        totalMessages: finalMessages.length,
        totalTokens: stats.compressedTokens,
        compressionRatio: stats.compressionRatio,
      },
    }
  }

  /**
   * 格式化消息列表
   */
  private formatMessages(messages: Message[], options?: FormatOptions): string {
    if (this.formatMessage) {
      return messages.map(this.formatMessage).join('\n\n')
    }

    // 默认格式化
    const parts: string[] = []

    for (const msg of messages) {
      const part = this.formatSingleMessage(msg, options)
      parts.push(part)
    }

    return parts.join(options?.separator ?? '\n\n')
  }

  /**
   * 格式化单条消息
   */
  private formatSingleMessage(message: Message, options?: FormatOptions): string {
    const roleLabel = this.getRoleLabel(message.role)
    const timestamp =
      this.includeTimestamp && message.timestamp
        ? ` [${message.timestamp.toLocaleTimeString('zh-CN')}]`
        : ''

    if (options?.asMarkdown) {
      return `**${roleLabel}**${timestamp}:\n${message.content}`
    }

    if (options?.includeRole) {
      return `${roleLabel}${timestamp}: ${message.content}`
    }

    return message.content
  }

  /**
   * 获取角色标签（中文）
   */
  private getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      system: '系统',
      user: '用户',
      assistant: '助手',
    }

    return labels[role] ?? role
  }

  /**
   * 添加消息到上下文
   */
  async addMessage(messages: Message[], newMessage: Message): Promise<Message[]> {
    return [...messages, newMessage]
  }

  /**
   * 清理上下文（移除旧消息）
   */
  async cleanupContext(
    messages: Message[],
    maxAge?: number // 最大年龄（毫秒）
  ): Promise<Message[]> {
    if (!maxAge) {
      return messages
    }

    const now = Date.now()
    return messages.filter((msg) => !msg.timestamp || now - msg.timestamp.getTime() <= maxAge)
  }

  /**
   * 获取 Token 使用统计
   */
  async getTokenStats(messages: Message[]): Promise<{
    totalTokens: number
    userTokens: number
    assistantTokens: number
    systemTokens: number
  }> {
    let totalTokens = 0
    let userTokens = 0
    let assistantTokens = 0
    let systemTokens = 0

    for (const msg of messages) {
      const tokens = await this.tokenWindow.estimateTokens(msg)
      totalTokens += tokens

      if (msg.role === 'user') {
        userTokens += tokens
      } else if (msg.role === 'assistant') {
        assistantTokens += tokens
      } else if (msg.role === 'system') {
        systemTokens += tokens
      }
    }

    return {
      totalTokens,
      userTokens,
      assistantTokens,
      systemTokens,
    }
  }

  /**
   * 预测下一轮的 Token 使用
   */
  async predictNextTokens(
    messages: Message[],
    estimatedResponseLength: number
  ): Promise<{
    currentTokens: number
    estimatedResponseTokens: number
    totalEstimatedTokens: number
    willExceedLimit: boolean
    recommendedActions: string[]
  }> {
    const currentTokens = await this.tokenWindow.estimateTotalTokens(messages)
    const estimatedResponseTokens = Math.ceil(estimatedResponseLength / 1.5) // 粗略估算
    const totalEstimatedTokens = currentTokens + estimatedResponseTokens
    const { maxTokens } = this.tokenWindow.getConfig()

    const willExceedLimit = totalEstimatedTokens > maxTokens
    const recommendedActions: string[] = []

    if (willExceedLimit) {
      recommendedActions.push('建议压缩历史对话')
      recommendedActions.push('建议启用语义摘要')
      recommendedActions.push('建议增加 maxTokens 配置')
    }

    return {
      currentTokens,
      estimatedResponseTokens,
      totalEstimatedTokens,
      willExceedLimit,
      recommendedActions,
    }
  }

  /**
   * 设置系统提示
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return {
      ...this.tokenWindow.getConfig(),
      systemPrompt: this.systemPrompt,
      includeTimestamp: this.includeTimestamp,
    }
  }
}

/**
 * 创建上下文管理器
 */
export function createContextManager(config?: ContextConfig): ContextManager {
  return new ContextManager(config)
}
