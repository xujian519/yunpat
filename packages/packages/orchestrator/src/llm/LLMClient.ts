/**
 * LLMClient - LLM调用客户端
 *
 * 支持多种LLM提供商：
 * - Anthropic Claude
 * - OpenAI GPT
 * - 本地模型（Ollama等）
 */

import { Anthropic } from '@anthropic-ai/sdk'
import type { OrchestratorLLMConfig } from '../types/index.js'
import { attemptJsonRepair } from './JsonRepair.js'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export class LLMClient {
  private config: OrchestratorLLMConfig
  private anthropic?: Anthropic

  constructor(config: OrchestratorLLMConfig) {
    this.config = config

    // 初始化Anthropic客户端
    if (config.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      })
    }
    // OpenAI 兼容模式无需额外初始化，使用 fetch 直接调用
  }

  /**
   * 调用LLM
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'anthropic':
        return await this.chatAnthropic(messages)
      case 'openai':
        return await this.chatOpenAI(messages)
      case 'local':
        return await this.chatLocal(messages)
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`)
    }
  }

  /**
   * 调用Anthropic Claude
   */
  private async chatAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized')
    }

    // 分离system消息和user/assistant消息
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const response = await this.anthropic.messages.create({
      model: this.config.model,
      system: systemMessage?.content,
      messages: conversationMessages,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 4096,
    })

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    }
  }

  /**
   * 调用OpenAI兼容API（支持DeepSeek、Moonshot等）
   * 使用 fetch 直接调用，避免 openai SDK 依赖问题
   */
  private async chatOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const baseURL = this.config.baseURL || 'https://api.openai.com/v1'
    const formattedMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: formattedMessages,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  }

  /**
   * 调用本地模型
   */
  private async chatLocal(_messages: LLMMessage[]): Promise<LLMResponse> {
    // TODO: 实现本地模型调用（Ollama等）
    throw new Error('Local provider not yet implemented')
  }

  /**
   * 结构化输出（JSON模式），带自动修复和重试
   */
  async chatWithSchema<T>(
    messages: LLMMessage[],
    schema: object,
    maxRetries: number = 2
  ): Promise<T> {
    const response = await this.chat(messages)
    const raw = response.content

    // 尝试 1: 直接解析
    try {
      return JSON.parse(raw) as T
    } catch {
      /* intentional */
    }

    // 尝试 2: 自动修复
    const repaired = attemptJsonRepair(raw)
    if (repaired !== null) {
      return repaired as T
    }

    // 尝试 3: 请求 LLM 修正输出（最多 maxRetries 次）
    for (let i = 0; i < maxRetries; i++) {
      const retryMessages: LLMMessage[] = [
        ...messages,
        { role: 'assistant' as const, content: raw },
        {
          role: 'user' as const,
          content:
            '你的上一次输出不是合法 JSON。请只输出符合 Schema 的 JSON 对象，不要包含 markdown 代码围栏、注释或任何解释文字。',
        },
      ]

      const retryResponse = await this.chat(retryMessages)
      const retryRaw = retryResponse.content

      try {
        return JSON.parse(retryRaw) as T
      } catch {
        /* intentional */
      }

      const retryRepaired = attemptJsonRepair(retryRaw)
      if (retryRepaired !== null) {
        return retryRepaired as T
      }
    }

    throw new Error(
      `Failed to get valid JSON after ${maxRetries} retries. Last response: ${raw.substring(0, 200)}`
    )
  }

  /**
   * 获取配置
   */
  getConfig(): OrchestratorLLMConfig {
    return this.config
  }
}
