/**
 * OrchestratorAgent - 中枢层智能调度Agent（完整版）
 *
 * 这是YunPat系统的中枢层，负责：
 * 1. 意图识别（Call 1）
 * 2. 任务规划（Call 2）
 * 3. HITL生成（Call 3）
 * 4. 结果聚合（Call 4）
 * 5. 异常降级（Call 5）
 *
 * 特性：
 * - 完整的5次LLM调用
 * - 集成专业层Agent
 * - 性能监控
 * - 智能路由决策
 */

import {
  OrchestratorAgentConfig,
  OrchestratorInput,
  OrchestratorOutput,
  IntentType,
  IntentRecognitionResult,
  TaskPlan,
  TaskStep,
  HITLRequest,
  HITLResult,
  AgentResult,
  AggregatedResult,
  Attachment,
  FileSignal,
} from './types/index.js'

import { errorToAgentError } from '@yunpat/agent-base'

import { ContextManager } from './context/ContextManager.js'
import { PatentIntentConfig } from './intent/PatentIntentConfig.js'
import { TaskExecutor } from './executor/TaskExecutor.js'
import { HITLManager } from './hitl/HITLManager.js'
import { HITLResponseParser } from './hitl/HITLResponseParser.js'
import { Router } from './router/Router.js'
import { LLMClient } from './llm/LLMClient.js'

// Agent 注册表（替代硬编码 import）
import { AgentRegistry } from './registry/AgentRegistry.js'
import { AgentFactory } from './registry/AgentFactory.js'

// HITL 跨语言持久化桥
import { RustCheckpointBridge, type HITLCheckpointData } from '@yunpat/core'

/**
 * 性能指标
 */
interface PerformanceMetrics {
  /** 总执行时间（毫秒） */
  totalDuration: number
  /** 意图识别时间（毫秒） */
  intentRecognitionDuration: number
  /** 任务规划时间（毫秒） */
  taskPlanningDuration: number
  /** 任务执行时间（毫秒） */
  taskExecutionDuration: number
  /** HITL生成时间（毫秒） */
  hitlGenerationDuration: number
  /** 结果聚合时间（毫秒） */
  resultAggregationDuration: number
  /** LLM调用次数 */
  llmCallsCount: number
}

/**
 * 执行统计
 */
interface ExecutionStats {
  /** 执行的步骤数 */
  stepsExecuted: number
  /** 成功的步骤数 */
  successfulSteps: number
  /** 失败的步骤数 */
  failedSteps: number
  /** HITL检查点数 */
  hitlCheckpoints: number
}

/**
 * OrchestratorAgent实现（完整版）
 */
export class OrchestratorAgent {
  private config: OrchestratorAgentConfig
  private contextManager: ContextManager
  private taskExecutor: TaskExecutor
  private hitlManager: HITLManager
  private hitlResponseParser: HITLResponseParser
  private router: Router
  private llmClient: LLMClient

  // Agent 注册表（替代硬编码的 4 个 Agent 字段）
  private agentRegistry: AgentRegistry

  // 初始化 Promise（确保 execute() 等待 Agent 注册完成）
  private initPromise: Promise<void>

  // HITL 执行状态保持（sessionId → 暂存的执行上下文）
  private pendingHITLState = new Map<
    string,
    {
      taskPlan: TaskPlan
      results: Map<string, AgentResult>
      input: OrchestratorInput
      hitlRequests: HITLRequest[]
      metrics: PerformanceMetrics
      stats: ExecutionStats
    }
  >()

  // HITL 跨语言持久化桥（懒初始化）
  private _hitlBridge: RustCheckpointBridge | null

  private get hitlBridge(): RustCheckpointBridge {
    if (!this._hitlBridge) {
      this._hitlBridge = new RustCheckpointBridge()
    }
    return this._hitlBridge
  }

  /**
   * 构造函数
   */
  constructor(config: OrchestratorAgentConfig) {
    this.config = config

    // 初始化各个组件
    this.contextManager = new ContextManager(undefined, config.llmConfig.model)

    // 初始化LLM客户端（支持依赖注入）
    this.llmClient = config.llmClient || new LLMClient(config.llmConfig)

    // 初始化 Agent 注册表
    this.agentRegistry = new AgentRegistry()

    // 初始化 HITL 管理器（需在 TaskExecutor 之前创建）
    this.hitlManager = new HITLManager(this.llmClient, config.planningConfig.defaultTimeout)
    this.hitlResponseParser = new HITLResponseParser(this.llmClient)

    // 初始化执行器，注入 HITLManager
    this.taskExecutor = new TaskExecutor(
      this.agentRegistry,
      this.hitlManager,
      this.hitlResponseParser
    )
    // HITL 跨语言持久化桥（懒初始化，首次使用时创建）
    this._hitlBridge = null
    const domainConfig = config.domainConfig ?? PatentIntentConfig
    this.router = new Router(this.agentRegistry, {
      greetingMessage: config.greetingMessage,
      domainConfig: domainConfig,
    })

    // 异步初始化所有 Agent（存储 Promise，execute() 时 await）
    this.initPromise = this.initializeAgents()
  }

  /**
   * 异步初始化所有 Agent
   */
  private async initializeAgents(): Promise<void> {
    const factory = new AgentFactory({
      llm: this.config.llm,
      eventBus: this.config.eventBus,
      memory: this.config.memory,
      tools: this.config.tools,
    })
    await factory.createAll(this.agentRegistry)
  }

  /**
   * 主入口：执行编排
   */
  async execute(input: OrchestratorInput): Promise<OrchestratorOutput> {
    // 确保 Agent 初始化完成
    await this.initPromise

    const startTime = Date.now()
    const metrics: PerformanceMetrics = {
      totalDuration: 0,
      intentRecognitionDuration: 0,
      taskPlanningDuration: 0,
      taskExecutionDuration: 0,
      hitlGenerationDuration: 0,
      resultAggregationDuration: 0,
      llmCallsCount: 0,
    }

    const stats: ExecutionStats = {
      stepsExecuted: 0,
      successfulSteps: 0,
      failedSteps: 0,
      hitlCheckpoints: 0,
    }

    try {
      // 保存用户消息到对话历史
      await this.contextManager.addMessage(input.sessionId, {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: input.message,
        timestamp: new Date(),
      })

      // Call 1: 意图识别
      let intentResult: IntentRecognitionResult

      if (input.intentOverride) {
        // Gateway 预设意图，跳过 Call 1
        const domainConfig = this.config.domainConfig ?? PatentIntentConfig
        const category = domainConfig.categories.find((c) => c.intentId === input.intentOverride)
        intentResult = {
          intent: input.intentOverride as IntentType,
          confidence: 1.0,
          complexity: category?.complexity ?? 'complex',
          extracted: {
            hasAttachment: !!(input.attachments && input.attachments.length > 0),
            urgency: 'normal',
            keywords: [],
          },
        }
        metrics.intentRecognitionDuration = 0
      } else if (input.fileSignals && input.fileSignals.length > 0) {
        // 文件信号存在，尝试直接解析
        const fileIntent = this.resolveFromFileSignals(input.fileSignals)
        if (fileIntent && fileIntent.confidence >= 0.85) {
          intentResult = fileIntent
          metrics.intentRecognitionDuration = 0
        } else {
          input.onProgress?.('intent', 'Recognizing intent with file context...')
          const intentStartTime = Date.now()
          intentResult = await this.call1_IntentRecognition(input)
          metrics.intentRecognitionDuration = Date.now() - intentStartTime
          metrics.llmCallsCount++
        }
      } else {
        input.onProgress?.('intent', 'Recognizing intent...')
        const intentStartTime = Date.now()
        intentResult = await this.call1_IntentRecognition(input)
        metrics.intentRecognitionDuration = Date.now() - intentStartTime
        metrics.llmCallsCount++
      }

      // CODING 意图防御性拦截（不应到达此处，Gateway 层应已拦截）
      if (intentResult.intent === 'CODING') {
        metrics.totalDuration = Date.now() - startTime
        return {
          response:
            'YunPat 是专利智能助手，专注于专利撰写、审查答复和检索分析，暂不支持直接执行编程任务。\n\n' +
            '如果您需要的是：\n' +
            '• 专利相关功能开发 → 请详细描述需求，我们可以讨论技术方案\n' +
            '• 自动化流程集成 → 请使用 YunPat CLI 或 SDK\n' +
            '• 其他编程帮助 → 建议使用通用编程 AI 工具\n\n' +
            '您也可以尝试以下专利相关命令：\n' +
            '/draft 撰写专利  /oa 答复审查意见  /search 专利检索  /analyze 专利分析',
          requiresHITL: false,
          metadata: {
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            executionTime: metrics.totalDuration,
            stepsExecuted: 0,
            metrics,
            stats,
          },
        }
      }

      // Call 2: 任务规划（仅复杂意图）
      let taskPlan: TaskPlan | undefined
      if (intentResult.complexity === 'complex') {
        input.onProgress?.('planning', 'Generating task plan...')
        const planningStartTime = Date.now()
        taskPlan = await this.call2_TaskPlanning(intentResult, input.sessionId)
        metrics.taskPlanningDuration = Date.now() - planningStartTime
        metrics.llmCallsCount++
      }

      // 路由决策
      const routingDecision = this.router.route(intentResult)

      if (routingDecision.type === 'orchestrated' && taskPlan) {
        // 执行任务计划
        input.onProgress?.('execution', 'Executing task plan...')
        const executionStartTime = Date.now()
        const executionResult = await this.executeTaskPlan(taskPlan, input)
        metrics.taskExecutionDuration = Date.now() - executionStartTime

        if (!executionResult.success) {
          throw executionResult.error || new Error('Task execution failed')
        }

        stats.stepsExecuted = executionResult.results.size
        stats.successfulSteps = Array.from(executionResult.results.values()).filter(
          (r) => r.success
        ).length
        stats.failedSteps = stats.stepsExecuted - stats.successfulSteps

        // Call 3: HITL生成（如有检查点）
        let hitlRequests: HITLRequest[] = []
        if (taskPlan.hitlCheckpoints.length > 0) {
          const hitlStartTime = Date.now()
          hitlRequests = await this.call3_HITLGeneration(taskPlan, executionResult.results)
          metrics.hitlGenerationDuration = Date.now() - hitlStartTime
          stats.hitlCheckpoints = hitlRequests.length
          metrics.llmCallsCount++
        }

        // 如果有HITL请求，保存执行状态后返回
        if (hitlRequests.length > 0) {
          // 保存执行状态，用于 HITL 响应后恢复
          this.pendingHITLState.set(input.sessionId, {
            taskPlan,
            results: executionResult.results,
            input,
            hitlRequests,
            metrics,
            stats,
          })

          // 跨语言持久化：写入 Rust StateStore SQLite
          try {
            const checkpointId = `hitl-${input.sessionId}-${Date.now()}`
            const hitlData: HITLCheckpointData = {
              sessionId: input.sessionId,
              taskPlan,
              results: Object.fromEntries(executionResult.results),
              hitlRequests,
              metrics,
              stats,
            }
            this.hitlBridge.saveHITLCheckpoint(input.sessionId, checkpointId, hitlData)
          } catch (bridgeErr) {
            // 持久化失败不应阻塞主流程，仅记录
            console.error('[OrchestratorAgent] HITL bridge persist failed:', bridgeErr)
          }

          return {
            response: '请确认以下内容',
            hitlRequests,
            requiresHITL: true,
            metadata: {
              intent: intentResult.intent,
              confidence: intentResult.confidence,
              executionTime: Date.now() - startTime,
              stepsExecuted: stats.stepsExecuted,
              metrics,
              stats,
            },
          }
        }

        // Call 4: 结果聚合
        input.onProgress?.('aggregation', 'Aggregating results...')
        const aggregationStartTime = Date.now()
        const aggregated = await this.call4_ResultAggregation(
          executionResult.results,
          input.sessionId
        )
        metrics.resultAggregationDuration = Date.now() - aggregationStartTime
        metrics.llmCallsCount++

        // 保存助手响应到对话历史
        await this.contextManager.addMessage(input.sessionId, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: aggregated.markdown || this.generateDefaultResponse(),
          timestamp: new Date(),
        })

        metrics.totalDuration = Date.now() - startTime

        // 记录任务完成到用户画像
        if (input.userId) {
          await this.contextManager.recordTaskCompletion(
            input.userId,
            intentResult.intent,
            metrics.totalDuration
          )
        }

        return {
          response: aggregated.markdown,
          attachments: aggregated.attachments,
          suggestedActions: aggregated.suggestedActions,
          requiresHITL: false,
          metadata: {
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            executionTime: metrics.totalDuration,
            stepsExecuted: stats.stepsExecuted,
            metrics,
            stats,
          },
        }
      }

      // 简单意图处理
      metrics.totalDuration = Date.now() - startTime

      // 记录任务完成到用户画像（所有情况都记录）
      if (input.userId) {
        await this.contextManager.recordTaskCompletion(
          input.userId,
          intentResult.intent,
          metrics.totalDuration
        )
      }

      if (routingDecision.type === 'clarify') {
        return {
          response: routingDecision.clarifyQuestion || '请问您能详细说明一下需求吗？',
          requiresHITL: false,
          metadata: {
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            executionTime: metrics.totalDuration,
            stepsExecuted: 0,
            metrics,
            stats,
          },
        }
      }

      // 默认响应
      return {
        response: this.generateDefaultResponse(),
        requiresHITL: false,
        metadata: {
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          executionTime: metrics.totalDuration,
          stepsExecuted: 0,
          metrics,
          stats,
        },
      }
    } catch (error) {
      // Call 5: 异常降级
      metrics.totalDuration = Date.now() - startTime
      const recovery = await this.call5_ExceptionHandling(error as Error, input)

      if (recovery.success && recovery.result) {
        return recovery.result
      }

      // 无法恢复，返回错误消息
      return {
        response: recovery.errorMessage || '系统出现错误，请稍后重试',
        requiresHITL: false,
        metadata: {
          intent: 'CLARIFY',
          confidence: 0,
          executionTime: metrics.totalDuration,
          stepsExecuted: 0,
          metrics,
          stats,
        },
      }
    }
  }

  /**
   * 执行任务计划（集成专业层Agent）
   */
  private async executeTaskPlan(
    taskPlan: TaskPlan,
    input: OrchestratorInput
  ): Promise<{ success: boolean; results: Map<string, AgentResult>; error?: Error }> {
    const results = new Map<string, AgentResult>()

    for (const step of taskPlan.steps) {
      try {
        const result = await this.executeStep(step, input)
        results.set(step.stepId, result)
      } catch (error) {
        results.set(step.stepId, {
          success: false,
          error: errorToAgentError(error as Error),
          executionTime: 0,
          data: {},
        })
      }
    }

    const allSuccess = Array.from(results.values()).every((r) => r.success)

    if (!allSuccess) {
      const errorMessages = Array.from(results.values())
        .filter((r) => !r.success && r.error)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .map((r) => r.error!.message)
      return {
        success: false,
        results,
        error: new Error(
          errorMessages.length > 0 ? errorMessages.join('; ') : 'Task execution failed'
        ),
      }
    }

    return {
      success: true,
      results,
    }
  }

  /**
   * 执行单个步骤（通过 AgentRegistry 路由到专业层 Agent）
   */
  private async executeStep(step: TaskStep, input: OrchestratorInput): Promise<AgentResult> {
    const startTime = Date.now()
    const agent = this.agentRegistry.get(step.agentId)

    if (!agent) {
      return {
        success: false,
        error: errorToAgentError(new Error(`Agent not found: ${step.agentId}`)),
        executionTime: Date.now() - startTime,
        data: {},
      }
    }

    try {
      // 使用 step.input 如果存在，否则使用原始 input
      const agentInput = step.input ? { ...input, ...step.input } : input
      const result = await agent.execute(agentInput)
      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        error: errorToAgentError(error as Error),
        executionTime: Date.now() - startTime,
        data: {},
      }
    }
  }

  /**
   * Call 1: 意图识别（简化版 —— 规则匹配 + 轻量 LLM 兜底）
   */
  protected async call1_IntentRecognition(
    input: OrchestratorInput
  ): Promise<IntentRecognitionResult> {
    const message = input.message?.trim() || ''
    if (!message) {
      return {
        intent: 'CLARIFY',
        confidence: 0.3,
        complexity: 'simple',
        extracted: { hasAttachment: false, urgency: 'normal', keywords: [] },
        clarifyQuestion: '请描述您的需求，我将为您匹配合适的服务。',
      }
    }

    const domainConfig = this.config.domainConfig ?? PatentIntentConfig
    const lowerMsg = message.toLowerCase()
    const confidenceThreshold = this.config.intentConfig?.confidenceThreshold ?? 0.7

    // 1. 规则匹配：用 PatentIntentConfig 的 keywords 做简单匹配，取最高分
    let bestMatch: { cat: (typeof domainConfig.categories)[0]; score: number } | null = null
    for (const cat of domainConfig.categories) {
      const score = cat.keywords.filter((kw) => lowerMsg.includes(kw.toLowerCase())).length
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { cat, score }
      }
    }
    if (bestMatch && bestMatch.score >= 1) {
      const confidence = Math.min(0.5 + bestMatch.score * 0.15, 0.95)
      const ruleResult: IntentRecognitionResult = {
        intent: bestMatch.cat.intentId as IntentType,
        confidence,
        complexity: bestMatch.cat.complexity as 'simple' | 'complex',
        extracted: {
          hasAttachment: !!(input.attachments && input.attachments.length > 0),
          urgency: 'normal',
          keywords: bestMatch.cat.keywords.filter((kw) => lowerMsg.includes(kw.toLowerCase())),
        },
      }
      if (ruleResult.confidence >= confidenceThreshold) {
        return ruleResult
      }
      try {
        const schema = {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            confidence: { type: 'number' },
            complexity: { type: 'string' },
            extracted: { type: 'object' },
            clarifyQuestion: { type: 'string' },
          },
          required: ['intent', 'confidence', 'complexity'],
        }
        const messages = [
          {
            role: 'system' as const,
            content:
              '你是专利代理AI助手。请识别用户意图并输出严格的 JSON，不要输出 markdown 代码块。',
          },
          {
            role: 'user' as const,
            content: `用户输入：${message}\n\n只输出 JSON：{"intent":"...","confidence":0-1,"complexity":"simple|complex","extracted":{...}}`,
          },
        ]
        const parsed = await this.llmClient.chatWithSchema<IntentRecognitionResult>(
          messages,
          schema
        )
        return {
          intent: parsed.intent as IntentType,
          confidence:
            typeof parsed.confidence === 'number' ? parsed.confidence : ruleResult.confidence,
          complexity: parsed.complexity ?? ruleResult.complexity,
          extracted: parsed.extracted ?? {
            hasAttachment: !!(input.attachments && input.attachments.length > 0),
            urgency: 'normal',
            keywords: [],
          },
          clarifyQuestion: parsed.clarifyQuestion,
        }
      } catch {
        return ruleResult
      }
    }

    // 2. 规则未命中，轻量 LLM 识别（无 few-shot，单层 prompt）
    try {
      const schema = {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          confidence: { type: 'number' },
          complexity: { type: 'string' },
          extracted: { type: 'object' },
          clarifyQuestion: { type: 'string' },
        },
        required: ['intent', 'confidence', 'complexity'],
      }
      const messages = [
        {
          role: 'system' as const,
          content:
            '你是专利代理AI助手。请识别用户意图并输出严格的 JSON，不要输出 markdown 代码块。',
        },
        {
          role: 'user' as const,
          content: `用户输入：${message}\n\n只输出 JSON：{"intent":"...","confidence":0-1,"complexity":"simple|complex","extracted":{...}}`,
        },
      ]
      const parsed = await this.llmClient.chatWithSchema<IntentRecognitionResult>(messages, schema)
      return {
        intent: parsed.intent as IntentType,
        confidence: parsed.confidence ?? 0.5,
        complexity: parsed.complexity ?? 'simple',
        extracted: parsed.extracted ?? {
          hasAttachment: !!(input.attachments && input.attachments.length > 0),
          urgency: 'normal',
          keywords: [],
        },
        clarifyQuestion: parsed.clarifyQuestion,
      }
    } catch {
      // LLM 识别失败时回退到简单 clarify 结果
      return {
        intent: 'CLARIFY',
        confidence: 0.5,
        complexity: 'simple',
        extracted: { hasAttachment: false, urgency: 'normal', keywords: [] },
      }
    }
  }

  /**
   * 从文件信号解析意图（零 LLM 调用）
   */
  private resolveFromFileSignals(signals: FileSignal[]): IntentRecognitionResult | null {
    const intentMap: Record<string, IntentType> = {
      office_action: 'RESPOND_OA',
      technical_disclosure: 'DRAFT_FULL',
      patent_draft: 'DRAFT_FULL',
      search_report: 'SEARCH',
      reference_document: 'DRAFT_FULL',
    }

    const bestSignal = signals
      .filter((s) => intentMap[s.signalType])
      .sort((a, b) => b.confidence - a.confidence)[0]

    if (!bestSignal) return null

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const intent = intentMap[bestSignal.signalType]!
    return {
      intent,
      confidence: bestSignal.confidence,
      complexity: ['RESPOND_OA', 'DRAFT_FULL'].includes(intent) ? 'complex' : 'simple',
      extracted: {
        title: bestSignal.filename.replace(/\.[^.]+$/, ''),
        hasAttachment: true,
        urgency: 'normal',
        keywords: [bestSignal.filename, bestSignal.signalType],
      },
    }
  }

  /**
   * Call 2: 任务规划（LLM 优先，失败回退到预定义计划）
   */
  protected async call2_TaskPlanning(
    intent: IntentRecognitionResult,
    _sessionId?: string
  ): Promise<TaskPlan> {
    const domainConfig = this.config.domainConfig ?? PatentIntentConfig
    try {
      const schema = {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          intent: { type: 'string' },
          estimatedMinutes: { type: 'number' },
          steps: { type: 'array', items: { type: 'object' } },
          hitlCheckpoints: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
        required: ['planId', 'intent', 'steps', 'hitlCheckpoints'],
      }
      const messages = [
        {
          role: 'system' as const,
          content:
            '你是任务规划器。请为用户意图生成可执行的 TaskPlan JSON（不要 markdown）。确保 stepId 唯一，dependsOn 引用存在的 stepId。',
        },
        {
          role: 'user' as const,
          content: `用户意图：${intent.intent}\n复杂度：${intent.complexity}\n已抽取信息：${JSON.stringify(intent.extracted ?? {})}\n\n请输出 TaskPlan JSON。`,
        },
      ]
      const planned = await this.llmClient.chatWithSchema<TaskPlan>(messages, schema)
      if (planned && planned.steps && Array.isArray(planned.steps)) {
        return planned
      }
    } catch {
      // 规划失败时回退到简单意图处理
    }

    // 简单意图：单步直达
    if (intent.complexity === 'simple') {
      const agentId = domainConfig.directRoutes?.[intent.intent] || 'specification-drafter'
      return {
        planId: `plan-${Date.now()}`,
        intent: intent.intent,
        estimatedMinutes: 5,
        steps: [
          {
            stepId: 'step-1',
            agentId,
            layer: 'domain',
            parallel: false,
            dependsOn: [],
            timeout: 30000,
            input: { message: intent.extracted },
            hitl: false,
            retryOnFailure: true,
            maxRetries: 2,
          },
        ],
        hitlCheckpoints: [],
        metadata: { createdAt: new Date(), parallelizable: false },
      }
    }

    // 复杂意图：从 defaultPlans 读取预定义计划
    const planFactory = domainConfig.defaultPlans?.[intent.intent]
    if (planFactory) {
      return planFactory(intent)
    }

    // 兜底：单步计划
    return {
      planId: `plan-${Date.now()}`,
      intent: intent.intent,
      estimatedMinutes: 10,
      steps: [
        {
          stepId: 'step-1',
          agentId: domainConfig.directRoutes?.[intent.intent] || 'specification-drafter',
          layer: 'domain',
          parallel: false,
          dependsOn: [],
          timeout: 60000,
          input: { message: intent.extracted },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2,
        },
      ],
      hitlCheckpoints: [],
      metadata: { createdAt: new Date(), parallelizable: false },
    }
  }

  /**
   * Call 3: HITL生成
   */
  protected async call3_HITLGeneration(
    taskPlan: TaskPlan,
    results: Map<string, AgentResult>
  ): Promise<HITLRequest[]> {
    const hitlRequests: HITLRequest[] = []

    for (const checkpointId of taskPlan.hitlCheckpoints) {
      const step = taskPlan.steps.find((s) => s.stepId === checkpointId)
      const result = results.get(checkpointId)

      if (step && result) {
        const request = await this.hitlManager.generateHITLRequest(step, result)
        if (request) {
          hitlRequests.push(request)
          await this.hitlManager.createCheckpoint(`task-${Date.now()}`, checkpointId, step, result)
        }
      }
    }

    return hitlRequests
  }

  /**
   * Call 4: 结果聚合（简化版 —— 规则聚合替代 LLM 聚合）
   */
  protected async call4_ResultAggregation(
    results: Map<string, AgentResult>,
    _sessionId?: string
  ): Promise<AggregatedResult> {
    if (results.size === 0) {
      return {
        markdown: '任务已完成，但没有生成结果。',
        attachments: [],
        suggestedActions: [],
        metadata: { resultsCount: 0, successfulResults: 0 },
      }
    }

    const parts: string[] = []
    const attachments: Attachment[] = []
    for (const [stepId, result] of results) {
      if (result.success) {
        const data = result.data || {}
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        parts.push(`## ${stepId}\n\n${content}`)
        if (data.attachments) {
          attachments.push(...(Array.isArray(data.attachments) ? data.attachments : []))
        }
      } else {
        parts.push(`## ${stepId}\n\n⚠️ 执行失败: ${result.error?.message || '未知错误'}`)
      }
    }

    return {
      markdown: parts.join('\n\n---\n\n'),
      attachments,
      suggestedActions: [],
      metadata: { resultsCount: results.size, successfulResults: results.size },
    }
  }

  /**
   * Call 5: 异常降级（简化版 —— 直接返回错误信息）
   */
  protected async call5_ExceptionHandling(
    error: Error,
    _input: OrchestratorInput
  ): Promise<{ success: boolean; result?: OrchestratorOutput; errorMessage?: string }> {
    console.error('[OrchestratorAgent] 执行异常:', error)
    return {
      success: false,
      errorMessage: `系统出现错误: ${error.message}`,
    }
  }

  /**
   * 生成默认响应（使用可配置问候语）
   */
  private generateDefaultResponse(): string {
    if (this.config.greetingMessage) {
      return this.config.greetingMessage
    }
    return '您好！我是您的任务助手，很高兴为您服务。请告诉我您需要什么帮助？'
  }

  /**
   * 获取上下文管理器（用于测试）
   */
  getContextManager(): ContextManager {
    return this.contextManager
  }

  /**
   * 获取配置（用于测试）
   */
  getConfig(): OrchestratorAgentConfig {
    return this.config
  }

  /**
   * 提交HITL响应
   */
  async submitHITLResponse(
    checkpointId: string,
    response: {
      action: 'confirm' | 'reject' | 'modify'
      feedback?: string
      modifications?: any // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  ): Promise<{
    success: boolean
    status: HITLResult['status']
    data?: any // eslint-disable-line @typescript-eslint/no-explicit-any
    feedback?: string
  }> {
    try {
      const result = await this.hitlManager.processResponse(checkpointId, response)

      // 完成检查点
      await this.hitlManager.completeCheckpoint(checkpointId)

      return {
        success: true,
        status: result.status,
        data: result.data,
        feedback: result.feedback,
      }
    } catch (error) {
      return {
        success: false,
        status: 'timeout',
        feedback: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 获取活跃的HITL检查点
   */
  getActiveHITLCheckpoints() {
    return this.hitlManager.getActiveCheckpoints()
  }

  /**
   * 获取HITL检查点
   */
  getHITLCheckpoint(checkpointId: string) {
    return this.hitlManager.getCheckpoint(checkpointId)
  }

  /**
   * 检查是否所有 HITL 检查点都已处理
   */
  isAllHITLResolved(): boolean {
    const activeCheckpoints = this.hitlManager.getActiveCheckpoints()
    return activeCheckpoints.length === 0
  }

  /**
   * HITL 响应后恢复执行状态并聚合结果
   *
   * 当所有 HITL checkpoint 确认后，从 pendingHITLState 恢复上下文，
   * 执行 Call 4（结果聚合）返回最终响应。
   */
  async aggregateAfterHITL(sessionId: string): Promise<OrchestratorOutput> {
    const state = this.pendingHITLState.get(sessionId)
    if (!state) {
      throw new Error(`No pending HITL state for session: ${sessionId}`)
    }

    // 执行 Call 4: 结果聚合
    const aggStartTime = Date.now()
    const aggregated = await this.call4_ResultAggregation(state.results, sessionId)
    state.metrics.llmCallsCount++
    state.metrics.resultAggregationDuration = Date.now() - aggStartTime
    state.metrics.totalDuration += Date.now() - aggStartTime

    // 清理暂存状态
    this.pendingHITLState.delete(sessionId)

    // 清理跨语言持久化检查点
    try {
      const checkpoints = this.hitlBridge.listHITLCheckpoints(sessionId)
      for (const cp of checkpoints) {
        this.hitlBridge.deleteCheckpoint(sessionId, cp.checkpoint_id)
      }
    } catch {
      // 清理失败不影响结果返回
    }

    return {
      response: aggregated.markdown,
      attachments: aggregated.attachments,
      suggestedActions: aggregated.suggestedActions,
      requiresHITL: false,
      metadata: {
        intent: state.taskPlan.intent || 'CLARIFY',
        confidence: 1,
        executionTime: state.metrics.totalDuration,
        stepsExecuted: state.stats.stepsExecuted,
        metrics: state.metrics,
        stats: state.stats,
      },
    }
  }

  /**
   * 获取 Agent 注册表（用于测试和外部访问）
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry
  }
}
