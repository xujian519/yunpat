#!/usr/bin/env node
/**
 * @file Orchestrator 适配器启动入口
 * @description 启动 Express 服务器，支持多种 LLM 提供商
 */

import { createAdapter } from './index.js'
import type { OrchestratorAgentConfig } from '@yunpat/orchestrator'
import { EventBus, ToolRegistry, MemoryManager } from '@yunpat/core'
import type { OrchestratorLLMConfig } from '@yunpat/orchestrator'
import { loadConfig, type LLMConfig } from './config.js'

/**
 * GLM API 响应类型
 */
interface GLMChatResponse {
  choices: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

/**
 * OpenAI API 响应类型
 */
interface OpenAIChatResponse {
  choices: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

/**
 * oMLX API 响应类型
 */
interface oMLXChatResponse {
  choices: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

/**
 * 通用 LLM 客户端 - 支持多种提供商
 */
class UniversalLLMClient {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async chat(messages: Array<{ role: string; content: string }>) {
    const { provider, model, apiKey, baseURL, temperature, maxTokens } = this.config

    switch (provider) {
      case 'zhipu':
        return await this.chatZhipu(messages, model, apiKey!, temperature, maxTokens)
      case 'anthropic':
        return await this.chatAnthropic(messages, model, apiKey!, temperature, maxTokens)
      case 'openai':
        return await this.chatOpenAI(messages, model, apiKey!, baseURL, temperature, maxTokens)
      case 'omlx':
        return await this.chatOMLX(messages, model, baseURL!, apiKey, temperature, maxTokens)
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  /**
   * 智谱 GLM 调用
   */
  private async chatZhipu(
    messages: Array<{ role: string; content: string }>,
    model: string,
    apiKey: string,
    temperature = 0.7,
    maxTokens = 8192
  ) {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GLM API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as GLMChatResponse
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    }
  }

  /**
   * Anthropic Claude 调用
   */
  private async chatAnthropic(
    messages: Array<{ role: string; content: string }>,
    model: string,
    apiKey: string,
    temperature = 0.7,
    maxTokens = 8192
  ) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({ apiKey })

    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const response = await anthropic.messages.create({
      model,
      system: systemMessage?.content,
      messages: conversationMessages,
      temperature,
      max_tokens: maxTokens,
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
   * OpenAI 兼容调用
   */
  private async chatOpenAI(
    messages: Array<{ role: string; content: string }>,
    model: string,
    apiKey: string,
    baseURL: string | undefined,
    temperature = 0.7,
    maxTokens = 8192
  ) {
    const url = baseURL || 'https://api.openai.com/v1'
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as OpenAIChatResponse
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    }
  }

  /**
   * oMLX 调用 (本地 8009 端口)
   */
  private async chatOMLX(
    messages: Array<{ role: string; content: string }>,
    model: string,
    baseURL: string,
    apiKey: string | undefined,
    temperature = 0.7,
    maxTokens = 8192
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`oMLX API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as oMLXChatResponse
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    }
  }
}

const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:9090'
const port = parseInt(process.env.PORT || '3001', 10)

// 加载配置
const modelConfigs = loadConfig()
const { llm: llmConfig } = modelConfigs

// 打印配置信息
console.log('=== 模型配置 ===')
console.log(`主 LLM: ${llmConfig.provider} / ${llmConfig.model}`)
if (modelConfigs.multimodal) {
  console.log(
    `多模态: ${modelConfigs.multimodal.provider} / ${modelConfigs.multimodal.model} @ ${modelConfigs.multimodal.baseURL}`
  )
}
if (modelConfigs.embedding) {
  console.log(
    `嵌入: ${modelConfigs.embedding.provider} / ${modelConfigs.embedding.model} @ ${modelConfigs.embedding.baseURL}`
  )
}
if (modelConfigs.rerank) {
  console.log(
    `Rerank: ${modelConfigs.rerank.provider} / ${modelConfigs.rerank.model} @ ${modelConfigs.rerank.baseURL}`
  )
}
console.log('================')

// 创建核心依赖
const eventBus = new EventBus()
const memoryManager = new MemoryManager()
const tools = new ToolRegistry(eventBus)

// 创建 LLMClient
const llmClient = new UniversalLLMClient(llmConfig)

// 创建一个适配器来满足 LLMAdapter 接口
const llmAdapter = {
  async chat(messages: Array<{ role: string; content: string }>) {
    const response = await llmClient.chat(messages)
    return { content: response.content }
  },
} as any

// 转换为 OrchestratorLLMConfig
const orchestratorLLMConfig: OrchestratorLLMConfig = {
  provider:
    llmConfig.provider === 'zhipu' || llmConfig.provider === 'omlx' ? 'local' : llmConfig.provider,
  model: llmConfig.model,
  apiKey: llmConfig.apiKey,
  temperature: llmConfig.temperature,
  maxTokens: llmConfig.maxTokens,
}

// Orchestrator 配置
const orchestratorConfig: OrchestratorAgentConfig = {
  name: 'orchestrator',
  description: 'YunPat 中枢层 Orchestrator',
  eventBus,
  memory: memoryManager as any,
  tools,
  llm: llmAdapter,
  llmConfig: orchestratorLLMConfig,
  llmClient: llmClient as any,
  intentConfig: {
    confidenceThreshold: 0.7,
    maxClarifyRounds: 3,
  },
  planningConfig: {
    maxSteps: 20,
    defaultTimeout: 30000,
    enableParallel: true,
  },
  hitlConfig: {
    autoConfirmThreshold: 0.9,
    timeout: 300000,
  },
  professionalAgents: {
    patentWriter: true,
    patentResponder: true,
    patentAnalyzer: true,
    patentSearch: true,
  },
}

const adapter = createAdapter({
  port,
  gatewayUrl,
  orchestrator: orchestratorConfig,
  patentCoordinator: {
    agentConfig: {
      name: 'patent_coordinator',
      description: 'YunPat 专利工作流协调器 - 理解案件、规划工作流、委派 Agent',
    },
    coordinatorConfig: {
      maxUnderstandingRounds: 3,
      reviewThreshold: 70,
      maxRetries: 2,
      enableParallelExecution: true,
      enableApprovalFlow: false,
    },
  },
})

adapter.start().then(() => {
  console.log(`\nOrchestrator adapter started on port ${port}`)
  console.log(`Gateway URL: ${gatewayUrl}`)
})
