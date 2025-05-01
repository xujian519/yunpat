/**
 * ExceptionHandler - 异常处理器（Call 5）
 *
 * 职责：
 * 1. 处理执行层超时/失败
 * 2. 处理意图识别置信度低
 * 3. 处理 LLM 输出格式错误
 * 4. 处理业务异常
 */

import { RecoveryResult, ExecutionContext } from '../types/index.js'
import type { LLMClient, LLMMessage } from '../llm/LLMClient.js'
import type { ContextBuilder } from '../context/ContextBuilder.js'

/**
 * 错误分类类型
 */
type ErrorType = 'timeout' | 'low_confidence' | 'format_error' | 'agent_error' | 'unknown'

export class ExceptionHandler {
  private llmClient?: LLMClient
  private contextBuilder?: ContextBuilder

  constructor(llmClient?: LLMClient, contextBuilder?: ContextBuilder) {
    this.llmClient = llmClient
    this.contextBuilder = contextBuilder
  }

  /**
   * 处理异常
   */
  async handleException(error: Error, context: ExecutionContext): Promise<RecoveryResult> {
    const errorType = this.classifyError(error)

    switch (errorType) {
      case 'timeout':
        return await this.handleTimeout(error, context)
      case 'low_confidence':
        return await this.handleLowConfidence(error, context)
      case 'format_error':
        return await this.handleFormatError(error, context)
      case 'agent_error':
        return await this.handleBusinessError(error, context)
      default:
        return await this.handleUnknownError(error, context)
    }
  }

  /**
   * 基于错误消息模式进行分类
   */
  private classifyError(error: Error): ErrorType {
    const msg = error.message.toLowerCase()
    const name = error.constructor.name.toLowerCase()

    // 超时
    if (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('etimedout') ||
      name.includes('timeout')
    ) {
      return 'timeout'
    }

    // JSON 格式错误
    if (
      msg.includes('json') ||
      msg.includes('parse') ||
      msg.includes('schema') ||
      msg.includes('unexpected token') ||
      msg.includes('llm_format_failure')
    ) {
      return 'format_error'
    }

    // 低置信度
    if (msg.includes('confidence') || msg.includes('clarify')) {
      return 'low_confidence'
    }

    // Agent 执行错误
    if (
      msg.includes('agent') ||
      msg.includes('execute') ||
      msg.includes('not found') ||
      msg.includes('not registered')
    ) {
      return 'agent_error'
    }

    return 'unknown'
  }

  /**
   * 处理超时
   */
  private async handleTimeout(_error: Error, _context: ExecutionContext): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: 'retry',
      recoveryMessage: '部分操作耗时较长，正在为您重试。如果问题持续，请稍后再试。',
    }
  }

  /**
   * 处理置信度低
   */
  private async handleLowConfidence(
    _error: Error,
    _context: ExecutionContext
  ): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: 'error_message',
      errorMessage: '抱歉，我不太理解您的需求，能否详细说明您想要做什么？',
    }
  }

  /**
   * 处理格式错误
   */
  private async handleFormatError(
    _error: Error,
    _context: ExecutionContext
  ): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: 'retry',
      errorMessage: '数据处理出错，正在重试...',
    }
  }

  /**
   * 处理 Agent 执行错误
   */
  private async handleBusinessError(
    error: Error,
    _context: ExecutionContext
  ): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: 'graceful_degradation',
      recoveryMessage: `处理过程中遇到问题：${error.message}。您可以尝试重新发起请求，或联系技术支持。`,
    }
  }

  /**
   * 处理未知错误 — 尝试使用 LLM 生成降级回复
   */
  private async handleUnknownError(
    error: Error,
    context: ExecutionContext
  ): Promise<RecoveryResult> {
    // 尝试 LLM 辅助降级
    if (this.llmClient) {
      try {
        return await this.llmFallback(error, context)
      } catch {
        // LLM 也失败了，走最简单的兜底
      }
    }

    return {
      success: false,
      strategy: 'error_message',
      errorMessage: '系统出现未知错误，请稍后重试或联系管理员。',
    }
  }

  /**
   * 使用 LLM 生成用户友好的降级回复
   */
  private async llmFallback(error: Error, context: ExecutionContext): Promise<RecoveryResult> {
    const systemPrompt = `你是错误恢复专家。
某个任务步骤执行失败，需要向用户说明情况并提供替代方案。

规则：
- 用简洁语言说明失败的是哪个步骤
- 说明已完成的部分是否仍然可用
- 提供 1-2 个替代操作选项
- 不要暴露技术细节（堆栈、超时时间等）
- 语气：坦诚，不回避，不过度道歉

只输出 JSON。`

    const userInput = `错误信息：${error.message}

用户原始请求：${context.message ?? '（未知）'}

请生成用户友好的降级回复。`

    let messages: LLMMessage[]
    if (this.contextBuilder && context.sessionId) {
      messages = await this.contextBuilder.buildThreeLayerMessages(
        systemPrompt,
        { sessionId: context.sessionId, extraContext: { error_type: this.classifyError(error) } },
        userInput
      )
    } else {
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ]
    }

    const response = await this.llmClient!.chatWithSchema<{
      userMessage: string
      fallbackActions: Array<{ label: string; action: string }>
    }>(messages, {
      type: 'object',
      properties: {
        userMessage: { type: 'string' },
        fallbackActions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              action: { type: 'string' },
            },
          },
        },
      },
      required: ['userMessage'],
    })

    return {
      success: false,
      strategy: 'graceful_degradation',
      recoveryMessage: response.userMessage,
    }
  }
}
