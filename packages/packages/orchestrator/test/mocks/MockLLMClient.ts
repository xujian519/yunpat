/**
 * MockLLMClient - 用于测试的Mock LLM客户端
 *
 * 提供可配置的响应，避免在测试中调用真实的LLM API
 */

import type { LLMMessage, LLMResponse } from '../../src/llm/LLMClient.js'

export interface MockResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export class MockLLMClient {
  private responseQueue: MockResponse[]
  private defaultResponse: MockResponse
  private callCount: number

  constructor() {
    this.responseQueue = []
    this.defaultResponse = {
      content:
        '{"intent": "CHITCHAT", "confidence": 0.95, "complexity": "simple", "extracted": {"title": "问候", "field": "通用", "hasAttachment": false, "urgency": "normal", "keywords": ["你好"]}}',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    }
    this.callCount = 0
  }

  /**
   * 设置响应队列（按顺序返回）
   */
  setResponseQueue(responses: MockResponse[]): void {
    this.responseQueue = [...responses]
  }

  /**
   * 添加单个响应到队列
   */
  enqueueResponse(response: MockResponse): void {
    this.responseQueue.push(response)
  }

  /**
   * 设置默认响应
   */
  setDefaultResponse(response: MockResponse): void {
    this.defaultResponse = response
  }

  /**
   * 清除所有响应
   */
  clearResponses(): void {
    this.responseQueue = []
  }

  /**
   * 获取调用次数
   */
  getCallCount(): number {
    return this.callCount
  }

  /**
   * 重置调用次数
   */
  resetCallCount(): void {
    this.callCount = 0
  }

  /**
   * 模拟LLM调用
   */
  async chat(_messages: LLMMessage[]): Promise<LLMResponse> {
    this.callCount++

    if (this.responseQueue.length > 0) {
      const response = this.responseQueue.shift()
      if (response) {
        return response
      }
    }

    return this.defaultResponse
  }

  /**
   * 模拟结构化输出
   */
  async chatWithSchema<T>(_messages: LLMMessage[], _schema: object): Promise<T> {
    const response = await this.chat(_messages)

    try {
      return JSON.parse(response.content) as T
    } catch (error) {
      throw new Error(`Failed to parse Mock LLM response as JSON: ${error}`)
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      provider: 'mock',
      model: 'mock-model',
      temperature: 0.7,
      maxTokens: 4096,
    }
  }
}

/**
 * 创建预设的Mock响应
 */
export function createIntentRecognitionMockResponse(
  intent: string,
  confidence: number
): MockResponse {
  return {
    content: JSON.stringify({
      intent,
      confidence,
      complexity: confidence > 0.8 ? 'complex' : 'simple',
      extracted: {
        title: '测试专利',
        field: '人工智能',
        hasAttachment: false,
        urgency: 'normal',
        keywords: ['测试', '专利'],
      },
    }),
    usage: {
      inputTokens: 200,
      outputTokens: 100,
      totalTokens: 300,
    },
  }
}

export function createTaskPlanningMockResponse(): MockResponse {
  return {
    content: JSON.stringify({
      planId: 'plan-test-1',
      intent: 'DRAFT_FULL',
      estimatedMinutes: 30,
      steps: [
        {
          stepId: 'step-1',
          agentId: 'specification-drafter',
          layer: 'domain',
          parallel: false,
          dependsOn: [],
          timeout: 30000,
          input: {},
          hitl: false,
          retryOnFailure: false,
          maxRetries: 1,
        },
      ],
      hitlCheckpoints: [],
      metadata: {
        createdAt: new Date(),
        parallelizable: false,
      },
    }),
    usage: {
      inputTokens: 300,
      outputTokens: 200,
      totalTokens: 500,
    },
  }
}

export function createResultAggregationMockResponse(): MockResponse {
  return {
    content: JSON.stringify({
      reply: '# 测试响应\n\n这是一个Mock响应。',
      artifacts: [],
      suggestedNextActions: ['查看详细内容'],
    }),
    usage: {
      inputTokens: 400,
      outputTokens: 150,
      totalTokens: 550,
    },
  }
}

/**
 * 创建完整的端到端测试响应序列
 */
export function createE2ETestResponseSequence(intent: string = 'DRAFT_FULL'): MockResponse[] {
  return [
    createIntentRecognitionMockResponse(intent, 0.9), // Call 1: 意图识别
    createTaskPlanningMockResponse(), // Call 2: 任务规划
    createResultAggregationMockResponse(), // Call 4: 结果聚合
  ]
}

/**
 * 创建CHITCHAT响应
 */
export function createChitchatResponse(): MockResponse {
  return createIntentRecognitionMockResponse('CHITCHAT', 0.95)
}

/**
 * 创建CLARIFY响应
 */
export function createClarifyResponse(): MockResponse {
  return createIntentRecognitionMockResponse('CLARIFY', 0.6)
}
