/**
 * 测试工具函数
 */

import type { OfficeAction, ResponseStrategy, CitedReference } from '../PatentCoreBridge.js'

/**
 * 创建模拟审查意见
 */
export function createMockOfficeAction(overrides?: Partial<OfficeAction>): OfficeAction {
  const mockCitations: CitedReference[] = [
    {
      document_number: 'CN123456A',
      relevancy: 'high',
      claims_affected: [1, 2],
    },
  ]

  return {
    oa_type: 'Novelty',
    affected_claims: [1, 2, 3],
    examiner_arguments: '权利要求1-3不具备新颖性...',
    citations: mockCitations,
    ...overrides,
  }
}

/**
 * 创建模拟答复策略
 */
export function createMockResponseStrategy(overrides?: Partial<ResponseStrategy>): ResponseStrategy {
  return {
    strategy_type: 'Hybrid',
    reasoning: '结合修改和争辩策略',
    confidence: 0.8,
    ...overrides,
  }
}

/**
 * 创建模拟答复文档
 */
export function createMockResponseDocument() {
  return {
    writtenArgument: '意见陈述书内容...',
    amendedClaims: ['1. 一种技术方案，其特征在于...'],
    amendmentComparison: '修改前后对照...',
    responseStrategy: 'Hybrid',
  }
}

/**
 * 等待指定时间
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 创建模拟LLM响应
 */
export function createMockLLMResponse(content: string) {
  return {
    message: {
      role: 'assistant',
      content,
    },
    usage: {
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300,
    },
  }
}

/**
 * 创建模拟LLM适配器
 */
export function createMockLLMAdapter() {
  return {
    chat: jest.fn().mockResolvedValue(createMockLLMResponse('Mock response')),
  }
}
