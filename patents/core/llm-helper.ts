/**
 * LLM 辅助工具类
 *
 * 提供结构化输出、重试机制、缓存等高级功能
 */

import type {
  LLMAdapter,
  LLMMessage,
  LLMResponse,
  LLMChatParams,
  StructuredOutputSchema,
} from './llm-types.js'
import {
  LLMError,
  LLMErrorCode,
  extractJSONFromResponse,
  extractResponseContent,
  estimateTokens,
  checkTokenLimit,
} from './llm-types.js'
import { OAResponderError, LLMInvokeError } from './errors.js'
import { LLM_CONSTANTS } from './constants.js'

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxAttempts?: number

  /** 初始延迟（毫秒） */
  initialDelay?: number

  /** 最大延迟（毫秒） */
  maxDelay?: number

  /** 退避倍数 */
  backoffMultiplier?: number

  /** 可重试的错误码 */
  retryableErrors?: string[]

  /** 重试前的回调 */
  onRetry?: (attempt: number, error: Error) => void
}

/**
 * LLM 缓存配置
 */
export interface LLMCacheConfig {
  /** 是否启用缓存 */
  enabled?: boolean

  /** 缓存大小限制 */
  maxSize?: number

  /** 缓存过期时间（毫秒） */
  expiryTime?: number

  /** 缓存键生成函数 */
  keyGenerator?: (params: LLMChatParams) => string
}

/**
 * 缓存条目
 */
interface CacheEntry {
  response: LLMResponse
  timestamp: number
  hits: number
}

/**
 * LLM 辅助类
 */
export class LLMHelper {
  private static cache = new Map<string, CacheEntry>()
  private static cacheConfig: Required<LLMCacheConfig> = {
    enabled: true,
    maxSize: 1000,
    expiryTime: 3600000, // 1小时
    keyGenerator: (params) => JSON.stringify(params),
  }

  /**
   * 配置缓存
   */
  static configureCache(config: LLMCacheConfig): void {
    this.cacheConfig = { ...this.cacheConfig, ...config }
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): {
    size: number
    hits: number
    oldest: number | null
    newest: number | null
  } {
    let hits = 0
    let oldest: number | null = null
    let newest: number | null = null

    for (const entry of this.cache.values()) {
      hits += entry.hits
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp
      }
      if (newest === null || entry.timestamp > newest) {
        newest = entry.timestamp
      }
    }

    return {
      size: this.cache.size,
      hits,
      oldest,
      newest,
    }
  }

  /**
   * 使用结构化输出调用 LLM
   */
  static async structuredChat<T>(
    llm: LLMAdapter,
    prompt: string,
    schema: StructuredOutputSchema,
    options?: {
      systemPrompt?: string
      temperature?: number
      maxTokens?: number
      retryConfig?: RetryConfig
      useCache?: boolean
    }
  ): Promise<T> {
    const systemPrompt = options?.systemPrompt || this.generateSystemPrompt(schema)

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]

    const chatParams: LLMChatParams = {
      messages,
      temperature: options?.temperature ?? LLM_CONSTANTS.DEFAULT_TEMPERATURE,
      maxTokens: options?.maxTokens,
    }

    // 检查缓存
    if (options?.useCache !== false && this.cacheConfig.enabled) {
      const cached = this.getFromCache(chatParams)
      if (cached) {
        const result = extractJSONFromResponse<T>(cached)
        if (result) {
          console.log('[LLMHelper] 缓存命中')
          return result
        }
      }
    }

    // 调用 LLM
    const response = options?.retryConfig
      ? await this.chatWithRetry(llm, chatParams, options.retryConfig)
      : await llm.chat(chatParams)

    // 保存到缓存
    if (options?.useCache !== false && this.cacheConfig.enabled) {
      this.saveToCache(chatParams, response)
    }

    // 解析 JSON
    try {
      const result = extractJSONFromResponse<T>(response)
      if (!result) {
        throw new LLMError(
          'LLM 未返回有效的 JSON',
          LLMErrorCode.PARSE_ERROR,
          { content: extractResponseContent(response).substring(0, 200) }
        )
      }
      return result
    } catch (error) {
      throw new LLMInvokeError(
        'JSON 解析失败',
        'unknown',
        prompt.substring(0, 100),
        { cause: error }
      )
    }
  }

  /**
   * 带重试的 LLM 调用
   */
  static async chatWithRetry(
    llm: LLMAdapter,
    params: LLMChatParams,
    retryConfig: RetryConfig = {}
  ): Promise<LLMResponse> {
    const config: Required<RetryConfig> = {
      maxAttempts: retryConfig.maxAttempts ?? LLM_CONSTANTS.MAX_RETRY_ATTEMPTS,
      initialDelay: retryConfig.initialDelay ?? LLM_CONSTANTS.INITIAL_RETRY_DELAY,
      maxDelay: retryConfig.maxDelay ?? LLM_CONSTANTS.MAX_RETRY_DELAY,
      backoffMultiplier: retryConfig.backoffMultiplier ?? LLM_CONSTANTS.RETRY_BACKOFF_MULTIPLIER,
      retryableErrors: retryConfig.retryableErrors ?? [
        LLMErrorCode.NETWORK_ERROR,
        LLMErrorCode.TIMEOUT,
        LLMErrorCode.RATE_LIMIT,
      ],
      onRetry: retryConfig.onRetry ?? (() => {}),
    }

    let lastError: Error
    let delay = config.initialDelay

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const response = await llm.chat(params)
        return response
      } catch (error) {
        lastError = error as Error

        // 检查是否可重试
        const isRetryable = this.isRetryable(error, config.retryableErrors)

        // 最后一次尝试失败，不再重试
        if (attempt === config.maxAttempts || !isRetryable) {
          break
        }

        console.warn(
          `[LLMHelper] 尝试 ${attempt}/${config.maxAttempts} 失败，${delay}ms 后重试...`,
          { error: lastError.message }
        )

        // 调用重试回调
        config.onRetry(attempt, lastError)

        // 等待后重试
        await this.sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
      }
    }

    // 所有尝试都失败
    throw new LLMInvokeError(
      `LLM 调用失败（已重试 ${config.maxAttempts} 次）`,
      'unknown',
      JSON.stringify(params).substring(0, 100),
      { cause: lastError }
    )
  }

  /**
   * 批量调用 LLM（带并发控制）
   */
  static async batchChat(
    llm: LLMAdapter,
    paramsArray: LLMChatParams[],
    options?: {
      maxConcurrent?: number
      retryConfig?: RetryConfig
      onProgress?: (completed: number, total: number) => void
    }
  ): Promise<LLMResponse[]> {
    const maxConcurrent = options?.maxConcurrent ?? 5
    const retryConfig = options?.retryConfig
    const onProgress = options?.onProgress

    const results: LLMResponse[] = new Array(paramsArray.length)
    let completed = 0

    // 分批处理
    for (let i = 0; i < paramsArray.length; i += maxConcurrent) {
      const batch = paramsArray.slice(i, i + maxConcurrent)
      const batchResults = await Promise.all(
        batch.map((params, batchIndex) =>
          this.executeWithRetryOrNot(llm, params, retryConfig).then(
            (response) => {
              results[i + batchIndex] = response
              completed++
              onProgress?.(completed, paramsArray.length)
              return response
            }
          )
        )
      )
    }

    return results
  }

  /**
   * 执行单个请求（根据配置决定是否重试）
   */
  private static async executeWithRetryOrNot(
    llm: LLMAdapter,
    params: LLMChatParams,
    retryConfig?: RetryConfig
  ): Promise<LLMResponse> {
    if (retryConfig) {
      return this.chatWithRetry(llm, params, retryConfig)
    } else {
      return llm.chat(params)
    }
  }

  /**
   * 从缓存获取
   */
  private static getFromCache(params: LLMChatParams): LLMResponse | null {
    const key = this.cacheConfig.keyGenerator(params)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // 检查是否过期
    const now = Date.now()
    if (now - entry.timestamp > this.cacheConfig.expiryTime) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    return entry.response
  }

  /**
   * 保存到缓存
   */
  private static saveToCache(params: LLMChatParams, response: LLMResponse): void {
    // 检查缓存大小限制
    if (this.cache.size >= this.cacheConfig.maxSize) {
      // 删除最旧的条目（简单实现：删除第一个）
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const key = this.cacheConfig.keyGenerator(params)
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hits: 0,
    })
  }

  /**
   * 生成系统提示词
   */
  private static generateSystemPrompt(schema: StructuredOutputSchema): string {
    const schemaDescription = Object.entries(schema)
      .map(([key, val]) => `- ${key}: ${val.description} (${val.type})`)
      .join('\n')

    return `请以 JSON 格式返回结果。

必须包含以下字段：
${schemaDescription}

要求：
1. 只返回 JSON 对象，不要包含其他内容
2. 确保所有字段都存在
3. 数据类型必须正确
4. 不要使用 Markdown 代码块标记

示例格式：
${Object.entries(schema)
  .map(([key, val]) => {
    const example = val.type === 'number' ? '42' : val.type === 'boolean' ? 'true' : '"示例"'
    return `"${key}": ${example}`
  })
  .join(',\n')}`
  }

  /**
   * 判断错误是否可重试
   */
  private static isRetryable(error: any, retryableErrors: string[]): boolean {
    if (error instanceof LLMError) {
      return retryableErrors.includes(error.code)
    }

    // 网络错误通常可重试
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true
    }

    return false
  }

  /**
   * 异步等待
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 验证并截断提示词
   */
  static validateAndTruncatePrompt(
    messages: LLMMessage[],
    maxTokens: number = LLM_CONSTANTS.MAX_PROMPT_LENGTH
  ): LLMMessage[] {
    const check = checkTokenLimit(messages, maxTokens)

    if (!check.exceeds) {
      return messages
    }

    console.warn(
      `[LLMHelper] 提示词超过限制 (${check.estimated}/${maxTokens} tokens)，将截断`
    )

    // 简单截断策略：从最旧的消息开始截断
    const truncatedMessages: LLMMessage[] = []
    let currentTokens = 0

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const msgTokens = estimateTokens(msg.content)

      if (currentTokens + msgTokens <= maxTokens) {
        truncatedMessages.unshift(msg)
        currentTokens += msgTokens
      } else {
        // 截断当前消息
        const remainingTokens = maxTokens - currentTokens
        const estimatedChars = remainingTokens * 3 // 粗略估计
        const truncatedContent = msg.content.substring(0, estimatedChars)
        truncatedMessages.unshift({
          ...msg,
          content: truncatedContent + '...[截断]',
        })
        break
      }
    }

    return truncatedMessages
  }

  /**
   * 流式调用 LLM
   */
  static async *streamChat(
    llm: LLMAdapter,
    params: LLMChatParams
  ): AsyncGenerator<string, LLMResponse, unknown> {
    if (!llm.streamChat) {
      // 不支持流式，回退到普通调用
      const response = await llm.chat(params)
      yield extractResponseContent(response)
      return response
    }

    const stream = llm.streamChat(params)
    let fullContent = ''

    for await (const chunk of stream) {
      const content = extractResponseContent(chunk)
      fullContent += content
      yield content
    }

    // 返回完整响应
    return {
      message: {
        role: 'assistant',
        content: fullContent,
      },
    }
  }

  /**
   * 多轮对话
   */
  static async multiTurnChat(
    llm: LLMAdapter,
    turns: Array<{ user: string; system?: string }>,
    options?: {
      temperature?: number
      context?: string[] // 之前的对话历史
    }
  ): Promise<string[]> {
    const messages: LLMMessage[] = []
    const responses: string[] = []

    // 添加初始上下文
    if (options?.context) {
      options.context.forEach((ctx, index) => {
        messages.push({
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: ctx,
        })
      })
    }

    // 逐轮对话
    for (const turn of turns) {
      if (turn.system) {
        messages.push({ role: 'system', content: turn.system })
      }

      messages.push({ role: 'user', content: turn.user })

      const response = await llm.chat({
        messages,
        temperature: options?.temperature ?? LLM_CONSTANTS.DEFAULT_TEMPERATURE,
      })

      const content = extractResponseContent(response)
      responses.push(content)
      messages.push({ role: 'assistant', content })
    }

    return responses
  }

  /**
   * 并行调用多个 LLM 并选择最佳结果
   */
  static async parallelChatWithBestSelection(
    llms: LLMAdapter[],
    params: LLMChatParams,
    selector: (responses: LLMResponse[]) => LLMResponse
  ): Promise<LLMResponse> {
    if (llms.length === 0) {
      throw new Error('至少需要一个 LLM 实例')
    }

    const responses = await Promise.all(
      llms.map((llm) => llm.chat(params))
    )

    return selector(responses)
  }

  /**
   * 带超时的 LLM 调用
   */
  static async chatWithTimeout(
    llm: LLMAdapter,
    params: LLMChatParams,
    timeout: number = LLM_CONSTANTS.DEFAULT_TIMEOUT
  ): Promise<LLMResponse> {
    return Promise.race([
      llm.chat(params),
      new Promise<LLMResponse>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new LLMError(
                `LLM 调用超时 (${timeout}ms)`,
                LLMErrorCode.TIMEOUT
              )
            ),
          timeout
        )
      ),
    ])
  }

  /**
   * 计算调用成本（基于 token 数量）
   */
  static calculateCost(
    response: LLMResponse,
    pricing: {
      inputPricePer1kTokens: number
      outputPricePer1kTokens: number
    }
  ): number {
    const inputTokens = response.usage?.promptTokens || 0
    const outputTokens = response.usage?.completionTokens || 0

    const inputCost = (inputTokens / 1000) * pricing.inputPricePer1kTokens
    const outputCost = (outputTokens / 1000) * pricing.outputPricePer1kTokens

    return inputCost + outputCost
  }

  /**
   * 批量计算成本
   */
  static calculateBatchCost(
    responses: LLMResponse[],
    pricing: {
      inputPricePer1kTokens: number
      outputPricePer1kTokens: number
    }
  ): {
    totalCost: number
    breakdown: Array<{ index: number; cost: number }>
  } {
    let totalCost = 0
    const breakdown = responses.map((response, index) => {
      const cost = this.calculateCost(response, pricing)
      totalCost += cost
      return { index, cost }
    })

    return { totalCost, breakdown }
  }
}
