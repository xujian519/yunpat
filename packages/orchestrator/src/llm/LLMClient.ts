/**
 * LLMClient - LLM调用客户端
 *
 * 支持多种LLM提供商：
 * - Anthropic Claude
 * - OpenAI GPT
 * - 本地模型（Ollama等）
 */

import { Anthropic } from '@anthropic-ai/sdk'
import type { OrchestratorLLMConfig, IntentRecognitionResult } from '../types/index.js'

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
   * 调用OpenAI GPT
   */
  private async chatOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    // TODO: 实现OpenAI调用
    throw new Error('OpenAI provider not yet implemented')
  }

  /**
   * 调用本地模型
   */
  private async chatLocal(messages: LLMMessage[]): Promise<LLMResponse> {
    // TODO: 实现本地模型调用（Ollama等）
    throw new Error('Local provider not yet implemented')
  }

  /**
   * 结构化输出（JSON模式）
   */
  async chatWithSchema<T>(messages: LLMMessage[], schema: object): Promise<T> {
    const response = await this.chat(messages)

    try {
      return JSON.parse(response.content) as T
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error}`)
    }
  }

  /**
   * 获取配置
   */
  getConfig(): OrchestratorLLMConfig {
    return this.config
  }
}
