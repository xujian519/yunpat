/**
 * LLM 类型定义
 *
 * 为所有LLM相关的接口定义严格的类型，提高类型安全性
 */

/**
 * LLM 消息角色
 */
export type LLMMessageRole = 'system' | 'user' | 'assistant'

/**
 * LLM 消息
 */
export interface LLMMessage {
  /** 角色 */
  role: LLMMessageRole

  /** 内容 */
  content: string

  /** 额外的元数据（可选） */
  metadata?: Record<string, any>
}

/**
 * LLM Token 使用统计
 */
export interface LLMUsage {
  /** 输入 token 数量 */
  promptTokens: number

  /** 输出 token 数量 */
  completionTokens: number

  /** 总 token 数量 */
  totalTokens: number
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  /** 消息内容 */
  message: {
    /** 角色 */
    role: LLMMessageRole

    /** 内容 */
    content: string
  }

  /** Token 使用统计（可选） */
  usage?: LLMUsage

  /** 模型名称（可选） */
  model?: string

  /** 完成原因（可选） */
  finishReason?: string
}

/**
 * LLM 聊天参数
 */
export interface LLMChatParams {
  /** 消息列表 */
  messages: LLMMessage[]

  /** 温度（0-1，控制随机性） */
  temperature?: number

  /** 最大 token 数 */
  maxTokens?: number

  /** Top-P 采样 */
  topP?: number

  /** 频率惩罚 */
  frequencyPenalty?: number

  /** 存在惩罚 */
  presencePenalty?: number

  /** 停止序列 */
  stop?: string[]

  /** 流式输出 */
  stream?: boolean
}

/**
 * 结构化输出 Schema
 */
export interface StructuredOutputSchema {
  [key: string]: {
    /** 类型 */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'

    /** 描述 */
    description: string

    /** 是否必需 */
    required?: boolean

    /** 属性定义（用于 object 类型） */
    properties?: Record<string, any>

    /** 项目类型（用于 array 类型） */
    items?: any
  }
}

/**
 * 结构化输出参数
 */
export interface StructuredOutputParams<T> extends Omit<LLMChatParams, 'messages'> {
  /** 系统提示词 */
  systemPrompt?: string

  /** 用户提示词 */
  userPrompt: string

  /** 输出 Schema */
  schema: StructuredOutputSchema

  /** 重试次数 */
  maxAttempts?: number

  /** 初始延迟（毫秒） */
  initialDelay?: number

  /** 最大延迟（毫秒） */
  maxDelay?: number

  /** 退避倍数 */
  backoffMultiplier?: number
}

/**
 * LLM 适配器接口
 */
export interface LLMAdapter {
  /**
   * 聊天接口
   */
  chat(params: LLMChatParams): Promise<LLMResponse>

  /**
   * 流式聊天接口（可选）
   */
  streamChat?(params: LLMChatParams): AsyncIterable<LLMResponse>
}

/**
 * LLM 错误类型
 */
export enum LLMErrorCode {
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** API 错误 */
  API_ERROR = 'API_ERROR',

  /** 超时 */
  TIMEOUT = 'TIMEOUT',

  /** 速率限制 */
  RATE_LIMIT = 'RATE_LIMIT',

  /** Token 限制 */
  TOKEN_LIMIT = 'TOKEN_LIMIT',

  /** 解析错误 */
  PARSE_ERROR = 'PARSE_ERROR',

  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * LLM 错误类
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

/**
 * 类型守卫：检查是否为 LLMResponse
 */
export function isLLMResponse(obj: any): obj is LLMResponse {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.message === 'object' &&
    obj.message !== null &&
    typeof obj.message.content === 'string' &&
    typeof obj.message.role === 'string'
  )
}

/**
 * 类型守卫：检查是否为有效的 LLMMessage
 */
export function isValidLLMMessage(obj: any): obj is LLMMessage {
  const validRoles: LLMMessageRole[] = ['system', 'user', 'assistant']
  return (
    obj !== null &&
    typeof obj === 'object' &&
    validRoles.includes(obj.role) &&
    typeof obj.content === 'string'
  )
}

/**
 * 从任意值创建 LLMMessage（带验证）
 */
export function createLLMMessage(
  role: LLMMessageRole,
  content: string,
  metadata?: Record<string, any>
): LLMMessage {
  if (typeof content !== 'string') {
    throw new LLMError(
      'content 必须是字符串',
      LLMErrorCode.PARSE_ERROR,
      { receivedType: typeof content }
    )
  }

  if (content.length === 0) {
    throw new LLMError(
      'content 不能为空',
      LLMErrorCode.PARSE_ERROR
    )
  }

  return {
    role,
    content,
    metadata,
  }
}

/**
 * 验证 LLM 响应
 */
export function validateLLMResponse(response: any): LLMResponse {
  if (!isLLMResponse(response)) {
    throw new LLMError(
      '无效的 LLM 响应格式',
      LLMErrorCode.PARSE_ERROR,
      { response }
    )
  }

  return response
}

/**
 * 提取响应内容（带类型安全）
 */
export function extractResponseContent(response: LLMResponse): string {
  return response.message.content
}

/**
 * 提取响应内容并解析 JSON（带错误处理）
 */
export function extractJSONFromResponse<T = any>(
  response: LLMResponse,
  fallback?: T
): T | null {
  const content = extractResponseContent(response)

  try {
    // 尝试找到 JSON 对象
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      if (fallback !== undefined) {
        console.warn('[LLM] 未找到 JSON，使用 fallback 值')
        return fallback
      }
      throw new Error('响应中未找到 JSON 对象')
    }

    return JSON.parse(jsonMatch[0]) as T
  } catch (error) {
    if (fallback !== undefined) {
      console.warn('[LLM] JSON 解析失败，使用 fallback 值:', error)
      return fallback
    }
    throw new LLMError(
      'JSON 解析失败',
      LLMErrorCode.PARSE_ERROR,
      { cause: error, content: content.substring(0, 200) }
    )
  }
}

/**
 * 计算估计的 Token 数量（粗略估计）
 * 中文约 1.5 字符 = 1 token，英文约 4 字符 = 1 token
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-龥]/g) || []).length
  const otherChars = text.length - chineseChars

  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

/**
 * 检查是否超过 Token 限制
 */
export function checkTokenLimit(
  messages: LLMMessage[],
  maxTokens: number = 8000
): {
  exceeds: boolean
  estimated: number
  remaining: number
} {
  const total = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
  return {
    exceeds: total > maxTokens,
    estimated: total,
    remaining: maxTokens - total,
  }
}
