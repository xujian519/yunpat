/**
 * TaskExecutor - 任务执行器
 *
 * 职责：
 * 1. 构建DAG（有向无环图）
 * 2. 按层执行任务
 * 3. 并行执行优化
 * 4. 超时处理
 * 5. HITL检查点处理
 */

import {
  TaskPlan,
  TaskStep,
  TaskExecutionResult,
  AgentResult,
  HITLResult,
  ExecutionContext,
} from '../types/index.js'

import type { AgentRegistry } from '../registry/AgentRegistry.js'

interface DAGLayer {
  layerIndex: number
  steps: TaskStep[]
}

interface DAG {
  layers: DAGLayer[]
  totalSteps: number
}

export class TaskExecutor {
  constructor(private agentRegistry?: AgentRegistry) {}
  /**
   * 执行任务计划
   */
  async execute(plan: TaskPlan, context: ExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now()

    try {
      // 构建DAG
      const dag = this.buildDAG(plan.steps)

      // 执行
      const results = await this.executeDAG(dag, plan, context)

      // 检查HITL
      if (this.hasHITLCheckpoints(plan)) {
        // HITL处理将在主流程中处理
        return {
          plan,
          results,
          success: true,
          executionTime: Date.now() - startTime,
        }
      }

      return {
        plan,
        results,
        success: true,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        plan,
        results: new Map(),
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
      }
    }
  }

  /**
   * 构建DAG
   */
  private buildDAG(steps: TaskStep[]): DAG {
    // 构建依赖关系图
    const stepMap = new Map<string, TaskStep>()
    const inDegree = new Map<string, number>() // 入度（依赖数）

    // 初始化
    for (const step of steps) {
      stepMap.set(step.stepId, step)
      inDegree.set(step.stepId, step.dependsOn.length)
    }

    // 拓扑排序，识别层
    const layers: DAGLayer[] = []
    const executed = new Set<string>()
    let currentLayer: TaskStep[] = []

    // 找出所有入度为0的节点（第一层）
    for (const step of steps) {
      if (step.dependsOn.length === 0) {
        currentLayer.push(step)
        executed.add(step.stepId)
      }
    }

    // 按层处理
    let layerIndex = 0
    while (currentLayer.length > 0) {
      layers.push({
        layerIndex,
        steps: currentLayer,
      })

      // 找出下一层（依赖当前层的节点）
      const nextLayer: TaskStep[] = []
      for (const step of steps) {
        if (executed.has(step.stepId)) continue

        // 检查所有依赖是否都已执行
        const allDepsExecuted = step.dependsOn.every((depId) => executed.has(depId))

        if (allDepsExecuted) {
          nextLayer.push(step)
          executed.add(step.stepId)
        }
      }

      currentLayer = nextLayer
      layerIndex++
    }

    return {
      layers,
      totalSteps: steps.length,
    }
  }

  /**
   * 执行DAG
   */
  private async executeDAG(
    dag: DAG,
    plan: TaskPlan,
    context: ExecutionContext
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>()

    // 按层执行
    for (const layer of dag.layers) {
      if (layer.steps.length === 1) {
        // 串行
        const result = await this.executeStep(layer.steps[0], context)
        results.set(layer.steps[0].stepId, result)
      } else {
        // 并行
        const layerResults = await Promise.all(
          layer.steps.map((step) => this.executeStep(step, context))
        )
        layerResults.forEach((result, i) => {
          results.set(layer.steps[i].stepId, result)
        })
      }
    }

    return results
  }

  /**
   * 执行单个步骤（通过 AgentRegistry 调用真实 Agent）
   */
  private async executeStep(step: TaskStep, context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now()

    try {
      // 通过 AgentRegistry 调用真实 Agent
      if (!this.agentRegistry) {
        return {
          success: false,
          data: {},
          error: new Error('AgentRegistry not configured'),
          executionTime: Date.now() - startTime,
        }
      }

      const agent = this.agentRegistry.get(step.agentId)
      if (!agent) {
        return {
          success: false,
          data: {},
          error: new Error(`Agent not found: ${step.agentId}`),
          executionTime: Date.now() - startTime,
        }
      }

      const result = await agent.execute(step.input)

      const agentResult: AgentResult = {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      }

      // 如果需要重试
      if (!agentResult.success && step.retryOnFailure && step.maxRetries > 0) {
        return await this.retryStep(step, context, 0)
      }

      return agentResult
    } catch (error) {
      // 错误处理
      if (step.retryOnFailure && step.maxRetries > 0) {
        return await this.retryStep(step, context, 0)
      }

      return {
        success: false,
        data: {},
        error: error as Error,
        executionTime: Date.now() - startTime,
      }
    }
  }

  /**
   * 重试步骤
   */
  private async retryStep(
    step: TaskStep,
    context: ExecutionContext,
    retryCount: number
  ): Promise<AgentResult> {
    if (retryCount >= step.maxRetries) {
      return {
        success: false,
        data: {},
        error: new Error(`Max retries exceeded for step ${step.stepId}`),
        executionTime: 0,
      }
    }

    // 等待一段时间后重试
    await this.sleep(1000 * (retryCount + 1))

    try {
      const result = await this.executeStep(step, context)
      if (result.success) {
        return result
      }

      // 继续重试
      return await this.retryStep(step, context, retryCount + 1)
    } catch (error) {
      return await this.retryStep(step, context, retryCount + 1)
    }
  }

  /**
   * 检查是否有HITL检查点
   */
  private hasHITLCheckpoints(plan: TaskPlan): boolean {
    return plan.hitlCheckpoints.length > 0
  }

  /**
   * 处理HITL检查点
   */
  async handleHITL(plan: TaskPlan, results: Map<string, AgentResult>): Promise<HITLResult[]> {
    const hitlResults: HITLResult[] = []

    for (const checkpointId of plan.hitlCheckpoints) {
      const step = plan.steps.find((s) => s.stepId === checkpointId)
      if (!step) continue

      const result = results.get(checkpointId)
      if (!result) continue

      // TODO: 实际HITL处理
      // 目前返回自动确认
      hitlResults.push({
        status: 'confirmed',
        data: result.data,
      })
    }

    return hitlResults
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 计算DAG统计信息
   */
  getDAGStats(dag: DAG): {
    totalLayers: number
    totalSteps: number
    maxParallelSteps: number
    parallelizable: boolean
  } {
    const maxParallelSteps = Math.max(...dag.layers.map((layer) => layer.steps.length))

    const parallelizable = dag.layers.some((layer) => layer.steps.length > 1)

    return {
      totalLayers: dag.layers.length,
      totalSteps: dag.totalSteps,
      maxParallelSteps,
      parallelizable,
    }
  }
}
