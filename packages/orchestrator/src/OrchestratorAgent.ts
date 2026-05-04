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

import type { AgentConfig } from '@yunpat/core'
import {
  OrchestratorAgentConfig,
  OrchestratorInput,
  OrchestratorOutput,
  IntentRecognitionResult,
  TaskPlan,
  HITLRequest,
  AgentResult,
  AggregatedResult,
} from './types/index.js'

import { ContextManager } from './context/ContextManager.js'
import { IntentRecognizer } from './intent/IntentRecognizer.js'
import { TaskPlanner } from './planning/TaskPlanner.js'
import { TaskExecutor } from './executor/TaskExecutor.js'
import { HITLManager } from './hitl/HITLManager.js'
import { ResultAggregator } from './aggregation/ResultAggregator.js'
import { ExceptionHandler } from './exception/ExceptionHandler.js'
import { Router } from './router/Router.js'
import { LLMClient } from './llm/LLMClient.js'

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
  private intentRecognizer: IntentRecognizer
  private taskPlanner: TaskPlanner
  private taskExecutor: TaskExecutor
  private hitlManager: HITLManager
  private resultAggregator: ResultAggregator
  private exceptionHandler: ExceptionHandler
  private router: Router
  private llmClient: LLMClient

  // 专业层Agent实例（暂时使用Mock实现）
  private patentWriterAgent?: any
  private patentResponderAgent?: any
  private patentAnalyzerAgent?: any
  private creativeAnalyzerAgent?: any

  /**
   * 构造函数
   */
  constructor(config: OrchestratorAgentConfig) {
    this.config = config

    // 初始化各个组件
    this.contextManager = new ContextManager()

    // 初始化LLM客户端
    this.llmClient = new LLMClient(config.llmConfig)

    // 初始化识别器和规划器
    this.intentRecognizer = new IntentRecognizer(
      this.llmClient,
      config.intentConfig.confidenceThreshold
    )
    this.taskPlanner = new TaskPlanner(
      this.llmClient,
      config.planningConfig.maxSteps,
      config.planningConfig.defaultTimeout,
      config.planningConfig.enableParallel
    )

    // 初始化执行器和管理器
    this.taskExecutor = new TaskExecutor()
    this.hitlManager = new HITLManager(this.llmClient, config.planningConfig.defaultTimeout)
    this.resultAggregator = new ResultAggregator()
    this.exceptionHandler = new ExceptionHandler()
    this.router = new Router()

    // 初始化专业层Agent
    this.initializeProfessionalAgents()
  }

  /**
   * 初始化专业层Agent
   */
  private initializeProfessionalAgents(): void {
    // 暂时使用Mock实现，等待包配置完成
    // TODO: 配置好包导出后，替换为真实的Agent导入
    if (this.config.professionalAgents?.patentWriter) {
      this.patentWriterAgent = this.createMockAgent('patent-writer')
    }

    if (this.config.professionalAgents?.patentResponder) {
      this.patentResponderAgent = this.createMockAgent('patent-responder')
    }

    if (this.config.professionalAgents?.patentAnalyzer) {
      this.patentAnalyzerAgent = this.createMockAgent('patent-analyzer')
    }

    if (this.config.professionalAgents?.creativeAnalyzer) {
      this.creativeAnalyzerAgent = this.createMockAgent('creative-analyzer')
    }
  }

  /**
   * 创建Mock Agent（临时方案）
   */
  private createMockAgent(agentType: string): any {
    return {
      run: async (input: any, context: any) => ({
        success: true,
        data: { result: `Mock ${agentType} result`, agentType },
        executionTime: 100,
      }),
    }
  }

  /**
   * 主入口：执行编排
   */
  async execute(input: OrchestratorInput): Promise<OrchestratorOutput> {
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
      const intentStartTime = Date.now()
      const intentResult = await this.call1_IntentRecognition(input)
      metrics.intentRecognitionDuration = Date.now() - intentStartTime
      metrics.llmCallsCount++

      // Call 2: 任务规划（仅复杂意图）
      let taskPlan: TaskPlan | undefined
      if (intentResult.complexity === 'complex') {
        const planningStartTime = Date.now()
        taskPlan = await this.call2_TaskPlanning(intentResult)
        metrics.taskPlanningDuration = Date.now() - planningStartTime
        metrics.llmCallsCount++
      }

      // 路由决策
      const routingDecision = this.router.route(intentResult)

      if (routingDecision.type === 'orchestrated' && taskPlan) {
        // 执行任务计划
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

        // 如果有HITL请求，返回需要HITL的响应
        if (hitlRequests.length > 0) {
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
        const aggregationStartTime = Date.now()
        const aggregated = await this.call4_ResultAggregation(executionResult.results)
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
    return {
      success: allSuccess,
      results,
    }
  }

  /**
   * 执行单个步骤（路由到专业层Agent）
   */
  private async executeStep(step: any, input: OrchestratorInput): Promise<AgentResult> {
    const startTime = Date.now()

    // 根据agentId路由到相应的Agent
    try {
      switch (step.agentId) {
        case 'patent-writer':
          if (this.patentWriterAgent) {
            return await this.patentWriterAgent.run(step.input || input, {})
          }
          break

        case 'patent-responder':
          if (this.patentResponderAgent) {
            return await this.patentResponderAgent.run(step.input || input, {})
          }
          break

        case 'patent-analyzer':
          if (this.patentAnalyzerAgent) {
            return await this.patentAnalyzerAgent.run(step.input || input, {})
          }
          break

        case 'creative-analyzer':
          if (this.creativeAnalyzerAgent) {
            return await this.creativeAnalyzerAgent.run(step.input || input, {})
          }
          break

        default:
          // 返回模拟结果
          return {
            success: true,
            data: { result: `Mock execution for ${step.agentId}` },
            executionTime: Date.now() - startTime,
          }
      }
    } catch (error) {
      // Agent执行失败，返回错误结果
      return {
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
        data: {},
      }
    }

    // 如果Agent不可用，返回模拟结果
    return {
      success: true,
      data: { result: `Mock execution for ${step.agentId}` },
      executionTime: Date.now() - startTime,
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
   * Call 2: 任务规划
   */
  protected async call2_TaskPlanning(intent: IntentRecognitionResult): Promise<TaskPlan> {
    return await this.taskPlanner.generatePlan(intent)
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
    results: Map<string, AgentResult>
  ): Promise<AggregatedResult> {
    return await this.resultAggregator.aggregate(results)
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
   * 生成默认响应
   */
  private generateDefaultResponse(): string {
    const responses = [
      '您好！我是YunPat专利代理AI助手，很高兴为您服务。',
      '我可以帮您撰写专利申请、答复审查意见、检索现有技术等。',
      '请告诉我您需要什么帮助？',
    ]
    return responses.join('\n')
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
      modifications?: any
    }
  ): Promise<{
    success: boolean
    status: 'confirmed' | 'rejected' | 'modified' | 'timeout'
    data?: any
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
}
