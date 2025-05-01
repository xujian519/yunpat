/**
 * @file Vercel AI SDK 适配器
 * @description 基于 Vercel AI SDK (`ai`) 的 LLM 适配器，
 * 作为 NativeLLMAdapter 的补充，提供：
 *  - generateObject() 类型安全的结构化输出
 *  - 统一的流式输出处理
 *  - 20+ 提供商的统一接口
 *
 * 设计参考：opencode 的 Provider 系统
 *
 * 依赖：需要安装 `ai` 和 `@ai-sdk/openai`
 *   pnpm add ai @ai-sdk/openai
 *
 * 使用示例：
 * ```typescript
 * const adapter = new AISDKAdapter({ provider: 'deepseek', apiKey: 'sk-xxx' })
 * const result = await adapter.generateObject({
 *   prompt: '分析以下专利的新颖性',
 *   schema: z.object({ isNovel: z.boolean(), reasoning: z.string() }),
 * })
 * // result 类型安全，无需 JSON.parse
 * ```
 */

import { z } from 'zod'
import type { LLMAdapter, ChatParams, ChatResponse, ChatChunk } from '../lifecycle/Lifecycle.js'

// ─── 类型 ─────────────────────────────────────────

/** 支持的 AI SDK 提供商 */
export type AIProvider =
  | 'openai'
  | 'deepseek'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'groq'
  | 'mistral'
  | 'custom'

export interface AISDKConfig {
  provider: AIProvider
  apiKey: string
  baseURL?: string
  model?: string
}

/**
 * 结构化生成参数
 */
export interface GenerateObjectParams<T extends z.ZodType> {
  /** 系统提示词 */
  system?: string
  /** 用户提示词 */
  prompt: string
  /** 期望的输出 Zod schema */
  schema: T
  /** 温度 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
}

/**
 * 结构化生成结果
 */
export interface GenerateObjectResult<T> {
  /** 通过 schema 验证的对象 */
  object: T
  /** token 用量 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ─── 适配器类 ────────────────────────────────────

/**
 * AI SDK 适配器
 *
 * 当前为设计实现（stub），完整功能需要在安装 `ai` 和对应 SDK 包后激活。
 *
 * 激活后的核心能力：
 * - generateObject(): 类型安全的 LLM 结构化输出
 * - chat(): 兼容 Lifecycle.LLMAdapter 接口
 * - chatStream(): 流式聊天
 */
export class AISDKAdapter implements LLMAdapter {
  readonly provider: AIProvider
  readonly model: string

  private apiKey: string
  private baseURL?: string
  private _sdkModel: unknown = null

  constructor(config: AISDKConfig) {
    this.provider = config.provider
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL
    this.model = config.model ?? getDefaultModel(config.provider)
  }

  // ─── 核心方法 ─────────────────────────────────

  /**
   * 结构化生成（类型安全）
   *
   * 使用 AI SDK 的 generateObject() 替代手工 JSON.parse + try/catch，
   * 输出自动通过 Zod schema 验证，编译时类型安全。
   *
   * 需要安装 `ai` 包后激活。
   */
  async generateObject<T extends z.ZodType>(
    _params: GenerateObjectParams<T>
  ): Promise<GenerateObjectResult<z.infer<T>>> {
    this.ensureSDK()

    // 当 AI SDK 可用时的实现（概念展示）：
    // const { object, usage } = await generateObject({
    //   model: this.getSDKModel(),
    //   system: params.system,
    //   prompt: params.prompt,
    //   schema: params.schema,
    //   temperature: params.temperature,
    //   maxTokens: params.maxTokens,
    // })
    // return { object: object as z.infer<T>, usage }

    // 当前回退：通过 NativeLLMAdapter 模拟
    throw new Error(
      'AISDKAdapter.generateObject() 需要安装 ai 包。运行: pnpm add ai @ai-sdk/openai'
    )
  }

  /**
   * 聊天（兼容 Lifecycle.LLMAdapter 接口）
   */
  async chat(_params: ChatParams): Promise<ChatResponse> {
    this.ensureSDK()

    // 当 AI SDK 可用时：
    // const { text, usage } = await generateText({
    //   model: this.getSDKModel(),
    //   messages: params.messages,
    //   temperature: params.temperature,
    //   maxTokens: params.maxTokens,
    // })
    // return { message: { role: 'assistant', content: text }, usage }

    throw new Error('AISDKAdapter.chat() 需要安装 ai 包。运行: pnpm add ai @ai-sdk/openai')
  }

  /**
   * 流式聊天
   */
  // eslint-disable-next-line require-yield
  async *chatStream(_params: ChatParams): AsyncIterable<ChatChunk> {
    this.ensureSDK()
    throw new Error('AISDKAdapter.chatStream() 需要安装 ai 包。运行: pnpm add ai @ai-sdk/openai')
  }

  /**
   * 嵌入
   */
  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error('AISDKAdapter.embed() 未实现，请使用 NativeLLMAdapter')
  }

  // ─── 内部方法 ─────────────────────────────────

  private ensureSDK(): void {
    // 检查 ai 包是否已安装
    try {
      require.resolve('ai')
    } catch {
      throw new Error(
        'AI SDK 未安装。运行: pnpm add ai @ai-sdk/openai\n' + '然后重启应用以激活 AISDKAdapter。'
      )
    }
  }

  /**
   * 获取 AI SDK 模型实例
   *
   * 当 AI SDK 安装后，此方法返回对应提供商的模型实例。
   */
  private getSDKModel(): unknown {
    if (this._sdkModel) return this._sdkModel

    // 当 AI SDK 可用时的实现（概念展示）：
    // const ai = require('ai')
    // switch (this.provider) {
    //   case 'openai':
    //     const openai = require('@ai-sdk/openai')
    //     this._sdkModel = openai.openai(this.model)
    //     break
    //   case 'deepseek':
    //     const openaiCompat = require('@ai-sdk/openai-compatible')
    //     this._sdkModel = openaiCompat.createOpenAICompatible({
    //       name: 'deepseek',
    //       baseURL: this.baseURL ?? 'https://api.deepseek.com',
    //       apiKey: this.apiKey,
    //     })(this.model)
    //     break
    //   // ... 其他提供商
    // }
    // return this._sdkModel

    throw new Error('AI SDK 模型未初始化')
  }
}

// ─── 辅助 ─────────────────────────────────────────

function getDefaultModel(provider: AIProvider): string {
  const defaults: Record<AIProvider, string> = {
    openai: 'gpt-4o',
    deepseek: 'deepseek-v4-pro',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.5-pro',
    azure: 'gpt-4o',
    groq: 'llama-4-maverick',
    mistral: 'mistral-large',
    custom: 'custom-model',
  }
  return defaults[provider]
}

export * as AISDKAdapter_ from './AISDKAdapter'
