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
  HITLRequest,
  AgentResult,
  AggregatedResult,
  FileSignal,
} from './types/index.js'

import { ContextManager } from './context/ContextManager.js'
import { ContextBuilder } from './context/ContextBuilder.js'
import { IntentRecognizer } from './intent/IntentRecognizer.js'
import { PatentIntentConfig } from './intent/PatentIntentConfig.js'
import { TaskPlanner } from './planning/TaskPlanner.js'
import { TaskExecutor } from './executor/TaskExecutor.js'
import { HITLManager } from './hitl/HITLManager.js'
import { HITLResponseParser } from './hitl/HITLResponseParser.js'
import { ResultAggregator } from './aggregation/ResultAggregator.js'
import { ExceptionHandler } from './exception/ExceptionHandler.js'
import { Router } from './router/Router.js'
import { LLMClient } from './llm/LLMClient.js'

// Agent 注册表（替代硬编码 import）
import { AgentRegistry } from './registry/AgentRegistry.js'
import { AgentFactory } from './registry/AgentFactory.js'

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
  private contextBuilder: ContextBuilder
  private intentRecognizer: IntentRecognizer
  private taskPlanner: TaskPlanner
  private taskExecutor: TaskExecutor
  private hitlManager: HITLManager
  private hitlResponseParser: HITLResponseParser
  private resultAggregator: ResultAggregator
  private exceptionHandler: ExceptionHandler
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

    // 初始化 ContextBuilder（三层 Prompt 的 Context 层）
    this.contextBuilder = new ContextBuilder(this.contextManager, this.agentRegistry)

    // 初始化识别器和规划器（支持配置化领域意图）
    const domainConfig = config.domainConfig ?? PatentIntentConfig
    this.intentRecognizer = new IntentRecognizer(
      this.llmClient,
      config.intentConfig.confidenceThreshold,
      domainConfig,
      this.contextBuilder
    )
    this.taskPlanner = new TaskPlanner(
      this.llmClient,
      config.planningConfig.maxSteps,
      config.planningConfig.defaultTimeout,
      config.planningConfig.enableParallel,
      this.agentRegistry,
      domainConfig,
      this.contextBuilder
    )

    // 初始化执行器和管理器
    this.taskExecutor = new TaskExecutor(this.agentRegistry)
    this.hitlManager = new HITLManager(this.llmClient, config.planningConfig.defaultTimeout)
    this.hitlResponseParser = new HITLResponseParser(this.llmClient, this.contextBuilder)
    this.resultAggregator = new ResultAggregator(this.llmClient, this.contextBuilder)
    this.exceptionHandler = new ExceptionHandler(this.llmClient, this.contextBuilder)
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

      if (routingDecision.type === 'chitchat') {
        return {
          response: routingDecision.chitchatResponse || this.generateDefaultResponse(),
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
          intent: 'CHITCHAT',
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
          error: error as Error,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeStep(step: any, input: OrchestratorInput): Promise<AgentResult> {
    const startTime = Date.now()
    const agent = this.agentRegistry.get(step.agentId)

    if (!agent) {
      return {
        success: false,
        error: new Error(`Agent not found: ${step.agentId}`),
        executionTime: Date.now() - startTime,
        data: {},
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await agent.execute((step.input || input) as any)
      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
        data: {},
      }
    }
  }

  /**
   * Call 1: 意图识别
   */
  protected async call1_IntentRecognition(
    input: OrchestratorInput
  ): Promise<IntentRecognitionResult> {
    return await this.intentRecognizer.recognize(input)
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
   * Call 2: 任务规划
   */
  protected async call2_TaskPlanning(
    intent: IntentRecognitionResult,
    sessionId?: string
  ): Promise<TaskPlan> {
    return await this.taskPlanner.generatePlan(intent, sessionId)
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
   * Call 4: 结果聚合
   */
  protected async call4_ResultAggregation(
    results: Map<string, AgentResult>,
    sessionId?: string
  ): Promise<AggregatedResult> {
    return await this.resultAggregator.aggregate(results, sessionId)
  }

  /**
   * Call 5: 异常降级
   */
  protected async call5_ExceptionHandling(
    error: Error,
    input: OrchestratorInput
  ): Promise<{ success: boolean; result?: OrchestratorOutput; errorMessage?: string }> {
    const recovery = await this.exceptionHandler.handleException(error, {
      sessionId: input.sessionId,
      userId: input.userId,
      message: input.message,
    })

    if (recovery.success) {
      return {
        success: true,
        result: {
          response: recovery.recoveryMessage || '已恢复正常',
          requiresHITL: false,
          metadata: {
            intent: 'CHITCHAT',
            confidence: 1,
            executionTime: 0,
            stepsExecuted: 0,
          },
        },
      }
    }

    return {
      success: false,
      errorMessage: recovery.errorMessage || '系统出现错误',
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
    status: 'confirmed' | 'rejected' | 'modified' | 'timeout'
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

    return {
      response: aggregated.markdown,
      attachments: aggregated.attachments,
      suggestedActions: aggregated.suggestedActions,
      requiresHITL: false,
      metadata: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        intent: (state.taskPlan as any).intent || 'CHITCHAT',
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
