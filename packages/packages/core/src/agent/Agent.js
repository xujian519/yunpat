import { v4 as uuidv4 } from 'uuid'
import { LifecycleStage } from '../lifecycle/Lifecycle.js'
import { CheckpointManager } from '../memory/CheckpointManager.js'
/**
 * 智能体抽象基类
 *
 * 核心设计：
 * - 框架只提供生命周期管理
 * - 业务逻辑由子类实现
 * - 通过事件总线通信
 */
export class Agent {
  name
  description
  eventBus
  memory
  tools
  llm
  maxIterations
  timeout
  initialized = false
  approvalFlow
  approvalStages
  checkpointManager
  enableCheckpoints
  constructor(config) {
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
  async execute(input) {
    return this.executeInternal(input)
  }
  async executeInternal(input) {
    const executionId = uuidv4()
    const startTime = new Date()
    let iteration = 0
    const context = {
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
          plan = approval.feedback.corrections.plan
        }
      }
      context.currentStage = LifecycleStage.ACT
      let result
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
            shouldContinue = reflection.shouldContinue ?? false
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
            result = approval.feedback.corrections.result
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
      const output = result
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
  on(pattern, handler) {
    return this.eventBus.subscribe(pattern, handler)
  }
  async send(target, message) {
    return this.eventBus.request(target, message)
  }
  publishEvent(type, data) {
    const event = {
      type,
      source: this.name,
      data,
      timestamp: new Date(),
    }
    this.eventBus.publish(event)
  }
  reset() {
    this.initialized = false
  }
  shouldRequestApproval(stage) {
    return this.approvalFlow !== undefined && this.approvalStages?.includes(stage) === true
  }
  async requestApprovalIfNeeded(result, context) {
    if (!this.approvalFlow) {
      return {
        approvalId: uuidv4(),
        approved: true,
        timestamp: new Date(),
      }
    }
    return this.approvalFlow.requestApproval(result, context)
  }
  async saveCheckpointIfEnabled(executionId, iteration, context, stageName, additionalData) {
    if (!this.enableCheckpoints || !this.checkpointManager) {
      return
    }
    try {
      const memorySnapshot = await this.memory.getAll()
      const contextSnapshot = {
        executionId: context.executionId,
        agentName: context.agentName,
        currentStage: context.currentStage,
        metadata: context.metadata,
      }
      const stateSnapshot = {
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
  async resumeFromCheckpoint(checkpointId, executionId) {
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
      const state = checkpoint.stateSnapshot
      this.initialized = typeof state.initialized === 'boolean' ? state.initialized : false
    }
    console.log(`[Agent] 已从检查点恢复: ${checkpointId} (迭代 ${checkpoint.iteration})`)
    return {
      checkpoint,
      context: checkpoint.contextSnapshot ?? {},
    }
  }
  getTools() {
    return this.tools
  }
  getLlm() {
    return this.llm
  }
  safeParseJSON(content) {
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
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}
//# sourceMappingURL=Agent.js.map
