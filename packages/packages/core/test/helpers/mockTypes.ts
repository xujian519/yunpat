/**
 * 类型化的 Mock 工厂
 *
 * 为消除测试文件中的 `as any` 提供类型安全的 mock 实现
 */

import { vi } from 'vitest'
import type {
  LLMAdapter,
  ChatParams,
  ChatResponse,
  KnowledgeBase as KnowledgeBaseType,
} from '../../src/lifecycle/Lifecycle.js'
import type {
  Claim,
  ClaimCategory,
  SourceReference,
  SourceType,
  FactCheckResult,
} from '../../src/validation/hallucination-types.js'

/**
 * 创建类型安全的 Mock LLM 适配器
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
 * 创建 Mock 知识库
 */
export interface MockKnowledgeBaseOptions {
  searchResults?: Array<{ score: number; entry: unknown }>
  shouldError?: boolean
}

export function createMockKnowledgeBase(
  options?: MockKnowledgeBaseOptions
): Partial<KnowledgeBaseType> {
  const searchResults = options?.searchResults ?? []

  return {
    search: vi.fn().mockImplementation(async () => {
      if (options?.shouldError) {
        throw new Error('KnowledgeBase search error')
      }
      return searchResults
    }),
    store: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
  }
}

/**
 * 创建类型安全的 Mock 声明对象
 */
export function createMockClaim(overrides?: Partial<Claim>): Claim {
  return {
    id: 'mock-claim-id',
    content: 'mock claim content',
    category: ClaimCategory.GENERAL_STATEMENT,
    confidence: 0.5,
    ...overrides,
  }
}

/**
 * 创建类型安全的 Mock 来源引用
 */
export function createMockSourceReference(overrides?: Partial<SourceReference>): SourceReference {
  return {
    id: 'mock-source-id',
    type: SourceType.KNOWLEDGE_ENTRY,
    title: 'Mock Source',
    credibility: 0.9,
    ...overrides,
  }
}

/**
 * 创建类型安全的 Mock 事实验证结果
 */
export function createMockFactCheckResult(overrides?: Partial<FactCheckResult>): FactCheckResult {
  const claim = overrides?.claim ?? createMockClaim()
  return {
    claim,
    isVerifiable: true,
    isVerified: false,
    confidence: 0.5,
    sources: [],
    verificationMethod: 'knowledge_base',
    ...overrides,
  }
}

/**
 * 创建带有外部 API 的 Mock LLM
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
