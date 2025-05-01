/**
 * TaskPlanner - 任务规划器（Call 2）
 *
 * 职责：
 * 1. 生成多步骤执行计划
 * 2. 构建DAG（有向无环图）
 * 3. 识别并行步骤
 * 4. 设置HITL检查点
 *
 * 设计原则：TaskPlanner 不包含任何领域知识。
 * Agent 能力来自 AgentRegistry.getCapabilitySummary()，
 * 默认计划和路由来自 IntentDomainConfig。
 */

import {
  TaskPlan,
  IntentRecognitionResult,
  TaskStep,
  IntentType,
  IntentDomainConfig,
} from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'
import type { AgentRegistry } from '../registry/AgentRegistry.js'
import type { ContextBuilder } from '../context/ContextBuilder.js'

export class TaskPlanner {
  private llmClient: LLMClient
  private maxSteps: number
  private defaultTimeout: number
  private enableParallel: boolean
  private agentRegistry?: AgentRegistry
  private domainConfig?: IntentDomainConfig
  private contextBuilder?: ContextBuilder

  constructor(
    llmClient: LLMClient,
    maxSteps: number = 20,
    defaultTimeout: number = 30000,
    enableParallel: boolean = true,
    agentRegistry?: AgentRegistry,
    domainConfig?: IntentDomainConfig,
    contextBuilder?: ContextBuilder
  ) {
    this.llmClient = llmClient
    this.maxSteps = maxSteps
    this.defaultTimeout = defaultTimeout
    this.enableParallel = enableParallel
    this.agentRegistry = agentRegistry
    this.domainConfig = domainConfig
    this.contextBuilder = contextBuilder
  }

  /**
   * 生成任务计划
   */
  async generatePlan(intent: IntentRecognitionResult, sessionId?: string): Promise<TaskPlan> {
    if (intent.complexity === 'simple') {
      return this.generateSimplePlan(intent)
    }

    try {
      return await this.generateComplexPlanWithLLM(intent, sessionId)
    } catch {
      return this.generateDefaultPlan(intent)
    }
  }

  /**
   * 生成简单计划（从配置的 directRoutes 获取目标 Agent）
   */
  private generateSimplePlan(intent: IntentRecognitionResult): TaskPlan {
    const agentId = this.getDirectAgent(intent.intent)
    const step: TaskStep = {
      stepId: 'step-1',
      agentId,
      layer: this.getAgentLayer(agentId),
      parallel: false,
      dependsOn: [],
      timeout: this.defaultTimeout,
      input: this.buildStepInput(intent),
      hitl: false,
      retryOnFailure: true,
      maxRetries: 2,
    }

    return {
      planId: `plan-${Date.now()}`,
      intent: intent.intent,
      estimatedMinutes: 10,
      steps: [step],
      hitlCheckpoints: [],
      metadata: {
        createdAt: new Date(),
        parallelizable: false,
      },
    }
  }

  /**
   * 使用LLM生成复杂计划
   */
  private async generateComplexPlanWithLLM(
    intent: IntentRecognitionResult,
    sessionId?: string
  ): Promise<TaskPlan> {
    let messages: LLMMessage[]

    const fewShots = this.getFewShotExamples().map((ex) => ({
      input: ex.input,
      output: JSON.stringify(ex.output),
    }))

    if (this.contextBuilder && sessionId) {
      messages = await this.contextBuilder.buildThreeLayerMessages(
        this.getSystemPrompt(),
        {
          sessionId,
          includeAgentRegistry: true,
          extraContext: { intent_result: JSON.stringify(intent) },
        },
        this.buildUserPrompt(intent),
        fewShots
      )
    } else {
      messages = [{ role: 'system', content: this.getSystemPrompt() }]
      for (const example of fewShots) {
        messages.push({ role: 'user', content: example.input })
        messages.push({ role: 'assistant', content: example.output })
      }
      messages.push({ role: 'user', content: this.buildUserPrompt(intent) })
    }

    const response = await this.llmClient.chatWithSchema<TaskPlanResponse>(
      messages,
      this.getResponseSchema()
    )

    return this.parseTaskPlanResponse(response, intent)
  }

  /**
   * 生成默认计划（从 domainConfig.defaultPlans 读取，无配置时回退到简单计划）
   */
  private generateDefaultPlan(intent: IntentRecognitionResult): TaskPlan {
    const planFactory = this.domainConfig?.defaultPlans?.[intent.intent]
    if (planFactory) {
      return planFactory(intent)
    }
    return this.generateSimplePlan(intent)
  }

  /**
   * 获取System Prompt（从 AgentRegistry 获取能力摘要，领域无关）
   */
  private getSystemPrompt(): string {
    const agentSummary = this.agentRegistry?.getCapabilitySummary() ?? '（未注册任何 Agent）'

    return `你是一个AI任务规划专家。

## 你的角色
基于识别出的用户意图，生成可执行的多步骤任务计划。

## 可用Agent资源
${agentSummary}

## 任务规划原则

1. **依赖关系明确**
   - 必须明确标注步骤之间的依赖关系
   - 并行步骤之间不能有依赖

2. **超时合理设置**
   - 简单操作：10-30s
   - 复杂操作：30-60s
   - 重度操作：60-120s

3. **HITL检查点**
   - 关键决策点必须设置HITL
   - 重要修改确认

4. **错误处理**
   - 关键步骤设置重试
   - 非关键步骤可降级
   - 明确失败影响

5. **并行优化**
   - 无依赖的步骤必须并行
   - 估算时间节省

## 输出格式
严格按照JSON Schema输出。`
  }

  /**
   * 构建用户提示
   */
  private buildUserPrompt(intent: IntentRecognitionResult): string {
    return `用户意图：${intent.intent}\n置信度：${intent.confidence}\n提取信息：${JSON.stringify(intent.extracted)}\n\n请为该意图生成详细的任务执行计划。`
  }

  /**
   * 获取Few-shot示例（从 domainConfig 读取）
   */
  private getFewShotExamples(): Array<{ input: string; output: TaskPlanResponse }> {
    // 领域配置不提供 planner 专用的 few-shot，
    // 这里提供通用的规划示例
    return [
      {
        input: '帮我撰写一个关于智能控制器的完整专利申请',
        output: {
          planId: 'plan-draft-full-001',
          intent: 'DRAFT_FULL',
          estimatedMinutes: 45,
          steps: [
            {
              stepId: 'search-prior-art',
              agentId: 'search',
              layer: 'execution',
              parallel: true,
              dependsOn: [],
              timeout: 60000,
              input: { mode: 'iterative', query: '智能控制器' },
              hitl: false,
              retryOnFailure: true,
              maxRetries: 3,
            },
            {
              stepId: 'query-knowledge-base',
              agentId: 'researcher',
              layer: 'execution',
              parallel: true,
              dependsOn: [],
              timeout: 30000,
              input: { query: '智能控制器' },
              hitl: false,
              retryOnFailure: true,
              maxRetries: 2,
            },
            {
              stepId: 'draft-claims',
              agentId: 'claim-generator',
              layer: 'domain',
              parallel: false,
              dependsOn: ['search-prior-art', 'query-knowledge-base'],
              timeout: 90000,
              input: { task: 'draft-claims' },
              hitl: true,
              hitlDescription: '请审阅生成的权利要求',
              retryOnFailure: true,
              maxRetries: 2,
            },
          ],
          hitlCheckpoints: ['draft-claims'],
          metadata: {
            createdAt: new Date().toISOString(),
            parallelizable: true,
            estimatedCost: 0.15,
          },
        },
      },
    ]
  }

  /**
   * 获取响应Schema
   */
  private getResponseSchema(): object {
    return {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        intent: { type: 'string' },
        estimatedMinutes: { type: 'number' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepId: { type: 'string' },
              agentId: { type: 'string' },
              layer: { type: 'string', enum: ['domain', 'execution'] },
              parallel: { type: 'boolean' },
              dependsOn: { type: 'array', items: { type: 'string' } },
              timeout: { type: 'number' },
              input: { type: 'object' },
              hitl: { type: 'boolean' },
              hitlDescription: { type: 'string' },
              retryOnFailure: { type: 'boolean' },
              maxRetries: { type: 'number' },
            },
            required: [
              'stepId',
              'agentId',
              'layer',
              'parallel',
              'dependsOn',
              'timeout',
              'input',
              'hitl',
              'retryOnFailure',
              'maxRetries',
            ],
          },
        },
        hitlCheckpoints: { type: 'array', items: { type: 'string' } },
        metadata: {
          type: 'object',
          properties: {
            createdAt: { type: 'string' },
            parallelizable: { type: 'boolean' },
            estimatedCost: { type: 'number' },
          },
          required: ['createdAt', 'parallelizable'],
        },
      },
      required: ['planId', 'intent', 'estimatedMinutes', 'steps', 'hitlCheckpoints', 'metadata'],
    }
  }

  /**
   * 解析TaskPlan响应
   */
  private parseTaskPlanResponse(
    response: TaskPlanResponse,
    _intent: IntentRecognitionResult
  ): TaskPlan {
    return {
      ...response,
      intent: response.intent as IntentType,
      metadata: {
        ...response.metadata,
        createdAt: new Date(response.metadata.createdAt),
      },
    }
  }

  /**
   * 获取直接路由的Agent（从 domainConfig.directRoutes 读取）
   */
  private getDirectAgent(intent: IntentType): string {
    const routes = this.domainConfig?.directRoutes
    if (routes && routes[intent]) {
      return routes[intent]
    }
    // 兜底：返回第一个注册的 domain 层 Agent
    if (this.agentRegistry) {
      const domainEntry = this.agentRegistry.getManifestEntries().find((e) => e.layer === 'domain')
      if (domainEntry) return domainEntry.agentId
    }
    return 'specification-drafter'
  }

  /**
   * 获取Agent层级（从 agentManifest 读取）
   */
  private getAgentLayer(agentId: string): 'domain' | 'execution' {
    if (this.agentRegistry) {
      const entry = this.agentRegistry.getManifestEntries().find((e) => e.agentId === agentId)
      if (entry?.layer) return entry.layer
    }
    return 'execution'
  }

  /**
   * 构建步骤输入
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildStepInput(intent: IntentRecognitionResult): Record<string, any> {
    return {
      intent: intent.intent,
      extracted: intent.extracted,
    }
  }
}

/**
 * TaskPlan响应（内部使用）
 */
interface TaskPlanResponse {
  planId: string
  intent: string
  estimatedMinutes: number
  steps: Array<{
    stepId: string
    agentId: string
    layer: 'domain' | 'execution'
    parallel: boolean
    dependsOn: string[]
    timeout: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: Record<string, any>
    hitl: boolean
    hitlDescription?: string
    retryOnFailure: boolean
    maxRetries: number
  }>
  hitlCheckpoints: string[]
  metadata: {
    createdAt: string
    parallelizable: boolean
    estimatedCost?: number
  }
}
