import { v4 as uuidv4 } from 'uuid'
import {
  LifecycleStage,
  ExecutionContext,
  EventBus,
  MemoryStore,
  ToolRegistry,
  LLMAdapter,
  AgentEvent,
} from '../lifecycle/Lifecycle.js'
import { ApprovalFlow, ApprovalResponse } from '../gateway/ApprovalFlow.js'
import {
  CheckpointManager,
  CheckpointManagerConfig,
  type Checkpoint,
} from '../memory/CheckpointManager.js'

export interface AgentConfig {
  name: string
  description: string
  eventBus: EventBus
  memory: MemoryStore
  tools: ToolRegistry
  llm: LLMAdapter
  maxIterations?: number
  timeout?: number
  approvalFlow?: ApprovalFlow
  approvalStages?: LifecycleStage[]
  checkpointManager?: CheckpointManager
  enableCheckpoints?: boolean
  checkpointConfig?: CheckpointManagerConfig
}

/**
 * 智能体抽象基类
 *
 * 核心设计：
 * - 框架只提供生命周期管理
 * - 业务逻辑由子类实现
 * - 通过事件总线通信
 */
export abstract class Agent<TInput = any, TOutput = any> {
  readonly name: string
  readonly description: string
  protected readonly eventBus: EventBus
  protected readonly memory: MemoryStore
  protected readonly tools: ToolRegistry
  protected readonly llm: LLMAdapter
  protected readonly maxIterations: number
  protected readonly timeout: number

  private initialized = false
  protected approvalFlow?: ApprovalFlow
  protected approvalStages?: LifecycleStage[]
  protected checkpointManager?: CheckpointManager
  protected enableCheckpoints?: boolean

  constructor(config: AgentConfig) {
    this.name = config.name
    this.description = config.description
    this.eventBus = config.eventBus
    this.memory = config.memory
    this.tools = config.tools
    this.llm = config.llm
    this.maxIterations = config.maxIterations ?? 10
    this.timeout = config.timeout ?? 300000

    this.approvalFlow = config.approvalFlow
    this.approvalStages = config.approvalStages
    this.enableCheckpoints = config.enableCheckpoints ?? false

    if (config.checkpointManager) {
      this.checkpointManager = config.checkpointManager
    } else if (this.enableCheckpoints && config.checkpointConfig) {
      this.checkpointManager = new CheckpointManager(config.checkpointConfig)
    }
  }

  protected before?(input: TInput, context: ExecutionContext): Promise<void>
  protected init?(context: ExecutionContext): Promise<void>
  protected abstract plan(input: TInput, context: ExecutionContext): Promise<unknown>
  protected abstract act(plan: unknown, context: ExecutionContext): Promise<unknown>
  protected reflect?(result: unknown, context: ExecutionContext): Promise<unknown>
  protected after?(input: TInput, output: TOutput, context: ExecutionContext): Promise<void>

  async execute(input: TInput): Promise<TOutput> {
    return this.executeInternal(input)
  }

  private async executeInternal(input: TInput): Promise<TOutput> {
    const executionId = uuidv4()
    const startTime = new Date()
    let iteration = 0

    const context: ExecutionContext = {
      executionId,
      agentName: this.name,
      startTime,
      currentStage: LifecycleStage.BEFORE,
      memory: this.memory,
      eventBus: this.eventBus,
      tools: this.tools,
      llm: this.llm,
      metadata: {},
      sharedState: new Map(),
    }

    try {
      if (this.before) {
        context.currentStage = LifecycleStage.BEFORE
        await this.before(input, context)
      }

      if (!this.initialized && this.init) {
        context.currentStage = LifecycleStage.INIT
        await this.init(context)
        this.initialized = true
        await this.saveCheckpointIfEnabled(executionId, iteration, context, 'init')
      }

      this.publishEvent('agent:started', { input, executionId, timestamp: startTime })

      context.currentStage = LifecycleStage.PLAN
      let plan = await this.plan(input, context)

      await this.saveCheckpointIfEnabled(executionId, ++iteration, context, 'plan', { plan })

      if (this.shouldRequestApproval(LifecycleStage.PLAN)) {
        const approval = await this.requestApprovalIfNeeded(plan, context)
        if (!approval.approved) {
          throw new Error('Plan阶段未通过审批')
        }
        if (approval.feedback?.corrections) {
          plan = approval.feedback.corrections.plan as unknown
        }
      }

      context.currentStage = LifecycleStage.ACT
      let result: unknown
      let iterations = 0
      let shouldContinue = true

      while (shouldContinue && iterations < this.maxIterations) {
        result = await this.act(plan, context)
        iterations++

        await this.saveCheckpointIfEnabled(
          executionId,
          ++iteration,
          context,
          `act-iter${iterations}`,
          { result, iteration: iterations }
        )

        if (this.reflect) {
          context.currentStage = LifecycleStage.REFLECT
          const reflection = await this.reflect(result, context)

          await this.saveCheckpointIfEnabled(
            executionId,
            iteration,
            context,
            `reflect-iter${iterations}`,
            { reflection }
          )

          if (reflection && typeof reflection === 'object') {
            shouldContinue =
              ((reflection as Record<string, unknown>).shouldContinue as boolean) ?? false
          } else {
            shouldContinue = false
          }
        } else {
          shouldContinue = false
        }

        if (!shouldContinue && this.shouldRequestApproval(LifecycleStage.ACT)) {
          const approval = await this.requestApprovalIfNeeded(result, context)
          if (!approval.approved) {
            throw new Error('Act阶段未通过审批')
          }
          if (approval.feedback?.corrections) {
            result = approval.feedback.corrections.result as unknown
            shouldContinue = true
          }
        }

        this.publishEvent('agent:progress', {
          iteration: iterations,
          result,
          shouldContinue,
        })
      }

      if (!result) {
        throw new Error('No result produced after act phase')
      }
      const output = result as unknown as TOutput
      if (this.after) {
        context.currentStage = LifecycleStage.AFTER
        await this.after(input, output, context)
      }

      this.publishEvent('agent:completed', {
        output,
        executionId,
        iterations,
        duration: Date.now() - startTime.getTime(),
      })

      await this.saveCheckpointIfEnabled(executionId, ++iteration, context, 'completed', { output })

      return output
    } catch (error) {
      this.publishEvent('agent:error', {
        error: error instanceof Error ? error.message : String(error),
        executionId,
        stack: error instanceof Error ? error.stack : undefined,
      })

      throw error
    }
  }

  protected on(pattern: string, handler: (event: AgentEvent) => void | Promise<void>) {
    return this.eventBus.subscribe(pattern, handler)
  }

  protected async send(target: string, message: unknown): Promise<unknown> {
    return this.eventBus.request(target, message)
  }

  private publishEvent(type: string, data: unknown) {
    const event: AgentEvent = {
      type,
      source: this.name,
      data,
      timestamp: new Date(),
    }
    this.eventBus.publish(event)
  }

  reset(): void {
    this.initialized = false
  }

  protected shouldRequestApproval(stage: LifecycleStage): boolean {
    return this.approvalFlow !== undefined && this.approvalStages?.includes(stage) === true
  }

  protected async requestApprovalIfNeeded(
    result: unknown,
    context: ExecutionContext
  ): Promise<ApprovalResponse> {
    if (!this.approvalFlow) {
      return {
        approvalId: uuidv4(),
        approved: true,
        timestamp: new Date(),
      }
    }

    return this.approvalFlow.requestApproval(result, context)
  }

  protected async saveCheckpointIfEnabled(
    executionId: string,
    iteration: number,
    context: ExecutionContext,
    stageName: string,
    additionalData?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enableCheckpoints || !this.checkpointManager) {
      return
    }

    try {
      const memorySnapshot = await this.memory.getAll()

      const contextSnapshot: Record<string, unknown> = {
        executionId: context.executionId,
        agentName: context.agentName,
        currentStage: context.currentStage,
        metadata: context.metadata,
      }

      const stateSnapshot: Record<string, unknown> = {
        initialized: this.initialized,
        ...additionalData,
      }

      await this.checkpointManager.saveCheckpoint(
        this.name,
        executionId,
        iteration,
        memorySnapshot,
        contextSnapshot,
        stateSnapshot,
        [stageName],
        `阶段: ${stageName}`
      )

      console.log(`[Agent] 检查点已保存: ${stageName} (迭代 ${iteration})`)
    } catch (error) {
      console.error(`[Agent] 保存检查点失败: ${error}`)
    }
  }

  async resumeFromCheckpoint(
    checkpointId: string,
    executionId?: string
  ): Promise<{
    checkpoint: Checkpoint
    context: Record<string, unknown>
  }> {
    if (!this.checkpointManager) {
      throw new Error('CheckpointManager 未配置，无法恢复检查点')
    }

    const checkpoint = await this.checkpointManager.loadCheckpoint(checkpointId, executionId)

    if (!checkpoint) {
      throw new Error(`检查点不存在: ${checkpointId}`)
    }

    if (checkpoint.memorySnapshot && typeof checkpoint.memorySnapshot === 'object' && this.memory) {
      try {
        await this.memory.setAll(checkpoint.memorySnapshot)
      } catch (err) {
        console.error(`[Agent] 恢复内存快照失败: ${err}`)
      }
    }

    if (
      checkpoint.stateSnapshot &&
      typeof checkpoint.stateSnapshot === 'object' &&
      !Array.isArray(checkpoint.stateSnapshot) &&
      'initialized' in checkpoint.stateSnapshot
    ) {
      const state = checkpoint.stateSnapshot as Record<string, unknown>
      this.initialized = typeof state.initialized === 'boolean' ? state.initialized : false
    }

    console.log(`[Agent] 已从检查点恢复: ${checkpointId} (迭代 ${checkpoint.iteration})`)

    return {
      checkpoint,
      context: checkpoint.contextSnapshot ?? {},
    }
  }

  getTools(): ToolRegistry {
    return this.tools
  }

  getLlm(): LLMAdapter {
    return this.llm
  }

  protected safeParseJSON(content: unknown): Record<string, unknown> | null {
    if (typeof content !== 'string') {
      return null
    }

    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) ||
      content.match(/```\s*([\s\S]*?)\s*```/) ||
      content.match(/{[\s\S]*}/)

    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content

    try {
      const parsed = JSON.parse(jsonStr)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
}
