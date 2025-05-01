/**
 * LLM Mock 工具集
 *
 * 为所有 LLM 相关测试提供统一的 Mock 工具
 * 支持自定义响应、错误注入、流式输出模拟
 */

import { vi } from 'vitest'
import type {
  LLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../../src/lifecycle/Lifecycle.js'

/**
 * 创建 Mock LLM 适配器
 *
 * @param overrides - 覆盖默认行为
 * @returns Mock 的 LLMAdapter
 */
export function createMockLLMAdapter(overrides?: Partial<LLMAdapter>): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({
      message: {
        role: 'assistant',
        content: 'mock response',
      },
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    }),
    chatStream: vi.fn().mockImplementation(async function* (_params: ChatParams) {
      yield { delta: 'mock', done: false }
      yield { delta: '', done: true }
    }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
    ...overrides,
  }
}

/**
 * 创建 Mock 向量嵌入适配器
 *
 * @param dimension - 向量维度，默认 1536（OpenAI 标准）
 * @returns Mock 的 EmbeddingAdapter
 */
export function createMockEmbeddingAdapter(dimension: number = 1536): {
  embed: ReturnType<typeof vi.fn>
  embedBatch: ReturnType<typeof vi.fn>
} {
  return {
    embed: vi.fn().mockResolvedValue(new Array(dimension).fill(0.1)),
    embedBatch: vi.fn().mockResolvedValue(
      Array(5)
        .fill(null)
        .map(() => new Array(dimension).fill(0.1))
    ),
  }
}

/**
 * 创建带有自定义响应序列的 Mock LLM
 *
 * 适用于测试对话历史、多轮交互等场景
 *
 * @param responses - 响应序列
 * @returns Mock 的 LLMAdapter
 */
export function createMockLLMWithResponses(responses: ChatResponse[]): LLMAdapter {
  let callCount = 0

  return {
    chat: vi.fn().mockImplementation(async () => {
      const response = responses[callCount % responses.length]
      callCount++
      return response
    }),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield { delta: 'mock', done: false }
      yield { delta: '', done: true }
    }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }
}

/**
 * 创建会抛出错误的 Mock LLM
 *
 * 适用于测试错误处理、重试逻辑等场景
 *
 * @param error - 要抛出的错误
 * @returns Mock 的 LLMAdapter
 */
export function createMockLLMWithError(error: Error): LLMAdapter {
  return {
    chat: vi.fn().mockRejectedValue(error),
    chatStream: vi.fn().mockImplementation(async function* () {
      throw error
    }),
    embed: vi.fn().mockRejectedValue(error),
  }
}

/**
 * 创建支持工具调用的 Mock LLM
 *
 * @param toolCalls - 工具调用序列
 * @returns Mock 的 LLMAdapter
 */
export function createMockLLMWithToolCalls(toolCalls: unknown[]): LLMAdapter {
  let callCount = 0

  return {
    chat: vi.fn().mockImplementation(async () => ({
      message: {
        role: 'assistant',
        content: '',
        toolCalls: [toolCalls[callCount % toolCalls.length]],
      },
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    })),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield { delta: 'mock', done: false }
      yield { delta: '', done: true }
    }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }
}

/**
 * 创建流式输出的 Mock LLM
 *
 * @param chunks - 流式输出块序列
 * @returns Mock 的 LLMAdapter
 */
export function createMockLLMWithStream(chunks: ChatChunk[]): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({
      message: {
        role: 'assistant',
        content: chunks.map((c) => c.delta).join(''),
      },
      usage: {
        promptTokens: 10,
        completionTokens: chunks.length,
        totalTokens: 10 + chunks.length,
      },
    }),
    chatStream: vi.fn().mockImplementation(async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }
}

/**
 * 预设的常见响应场景
 */
export const mockLLMResponses = {
  /** 成功响应 */
  success: {
    message: {
      role: 'assistant' as const,
      content: 'This is a successful response',
    },
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
  },

  /** 空响应 */
  empty: {
    message: {
      role: 'assistant' as const,
      content: '',
    },
    usage: {
      promptTokens: 10,
      completionTokens: 0,
      totalTokens: 10,
    },
  },

  /** 长响应 */
  long: {
    message: {
      role: 'assistant' as const,
      content: 'A'.repeat(1000),
    },
    usage: {
      promptTokens: 10,
      completionTokens: 500,
      totalTokens: 510,
    },
  },

  /** JSON 响应 */
  json: {
    message: {
      role: 'assistant' as const,
      content: '{"result": "success", "data": [1, 2, 3]}',
    },
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  },
} as const

/**
 * 预设的错误场景
 */
export const mockLLMErrors = {
  /** API 错误 */
  apiError: new Error('API Error: Invalid request'),

  /** 认证错误 */
  authError: new Error('Authentication failed: Invalid API key'),

  /** 网络错误 */
  networkError: new Error('Network error: Connection timeout'),

  /** 速率限制 */
  rateLimitError: new Error('Rate limit exceeded: Too many requests'),
} as const
