/**
 * Agent 团队（Agent Team）
 *
 * Phase 3.2 核心组件：
 * - 注册和管理多个 Agent 角色
 * - 支持并行和顺序任务执行
 * - Agent 间工作交接协议
 *
 * 借鉴 Claude Code 的 Agent Swarm 设计：
 * - Coordinator 作为团队领导
 * - Worker Agents 执行具体任务
 * - Handoff 协议确保上下文传递
 */

import type { Agent } from '../agent/Agent.js'
import { EventBus } from '../eventbus/EventBus.js'
import type { ExecutionContext } from '../lifecycle/Lifecycle.js'
import {
  type AgentRole,
  type HandoffContext,
  type HandoffResult,
  CoordinatorTaskStatus,
} from './types.js'

/**
 * 团队任务
 */
export interface TeamTask {
  /** 任务 ID */
  id: string

  /** 任务描述 */
  description: string

  /** 分配给的角色 ID */
  assigneeRoleId: string

  /** 输入数据 */
  input: unknown

  /** 执行选项 */
  options?: {
    timeout?: number
    maxRetries?: number
  }
}

/**
 * 团队任务结果
 */
export interface TeamTaskResult {
  /** 任务 ID */
  taskId: string

  /** 是否成功 */
  success: boolean

  /** 输出结果 */
  output?: unknown

  /** 错误信息 */
  error?: string

  /** 执行耗时（毫秒） */
  duration: number

  /** 执行的角色 ID */
  roleId: string
}

/**
 * Agent 团队
 */
export class AgentTeam {
  private readonly name: string
  private readonly eventBus: EventBus
  private readonly roles: Map<string, AgentRole> = new Map()

  constructor(name: string, eventBus: EventBus) {
    this.name = name
    this.eventBus = eventBus
  }

  /**
   * 注册 Agent 角色
   */
  registerRole(role: AgentRole): void {
    if (this.roles.has(role.id)) {
      throw new Error(`Agent 角色已注册: ${role.id}`)
    }
    this.roles.set(role.id, role)
    console.log(`[AgentTeam:${this.name}] 注册角色: ${role.name} (${role.id})`)
  }

  /**
   * 注销 Agent 角色
   */
  unregisterRole(roleId: string): void {
    if (!this.roles.has(roleId)) {
      throw new Error(`Agent 角色未注册: ${roleId}`)
    }
    this.roles.delete(roleId)
    console.log(`[AgentTeam:${this.name}] 注销角色: ${roleId}`)
  }

  /**
   * 获取角色
   */
  getRole(roleId: string): AgentRole | undefined {
    return this.roles.get(roleId)
  }

  /**
   * 列出所有角色
   */
  listRoles(): AgentRole[] {
    return Array.from(this.roles.values())
  }

  /**
   * 并行执行任务
   *
   * 所有任务同时启动，等待全部完成。
   * 单个任务失败不会阻止其他任务。
   */
  async executeParallel(
    tasks: TeamTask[],
    sharedContext?: ExecutionContext
  ): Promise<TeamTaskResult[]> {
    if (tasks.length === 0) {
      return []
    }

    console.log(`[AgentTeam:${this.name}] 并行执行 ${tasks.length} 个任务`)

    const promises = tasks.map(async (task) => {
      const startTime = Date.now()
      const role = this.roles.get(task.assigneeRoleId)

      if (!role) {
        return {
          taskId: task.id,
          success: false,
          error: `Agent 角色未注册: ${task.assigneeRoleId}`,
          duration: 0,
          roleId: task.assigneeRoleId,
        }
      }

      try {
        const output = await this.executeAgentTask(role.agent, task, sharedContext)
        return {
          taskId: task.id,
          success: true,
          output,
          duration: Date.now() - startTime,
          roleId: task.assigneeRoleId,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AgentTeam:${this.name}] 任务 ${task.id} 失败:`, errorMessage)
        return {
          taskId: task.id,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
          roleId: task.assigneeRoleId,
        }
      }
    })

    const results = await Promise.all(promises)

    const successCount = results.filter((r) => r.success).length
    console.log(`[AgentTeam:${this.name}] 并行执行完成: ${successCount}/${tasks.length} 成功`)

    return results
  }

  /**
   * 顺序执行任务
   *
   * 任务按顺序执行，每个任务的输出可作为后续任务的输入。
   */
  async executeSequential(
    tasks: TeamTask[],
    sharedContext?: ExecutionContext
  ): Promise<TeamTaskResult[]> {
    if (tasks.length === 0) {
      return []
    }

    console.log(`[AgentTeam:${this.name}] 顺序执行 ${tasks.length} 个任务`)

    const results: TeamTaskResult[] = []
    const previousOutputs = new Map<string, unknown>()

    for (const task of tasks) {
      const startTime = Date.now()
      const role = this.roles.get(task.assigneeRoleId)

      if (!role) {
        results.push({
          taskId: task.id,
          success: false,
          error: `Agent 角色未注册: ${task.assigneeRoleId}`,
          duration: 0,
          roleId: task.assigneeRoleId,
        })
        continue
      }

      // 将前序任务的输出注入当前任务输入
      const enrichedInput = this.enrichInputWithPreviousOutputs(task.input, previousOutputs)

      try {
        const output = await this.executeAgentTask(
          role.agent,
          { ...task, input: enrichedInput },
          sharedContext
        )

        results.push({
          taskId: task.id,
          success: true,
          output,
          duration: Date.now() - startTime,
          roleId: task.assigneeRoleId,
        })

        previousOutputs.set(task.id, output)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AgentTeam:${this.name}] 任务 ${task.id} 失败:`, errorMessage)

        results.push({
          taskId: task.id,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
          roleId: task.assigneeRoleId,
        })

        // 顺序执行时，一个任务失败是否继续？默认继续
        // TODO: 可配置 failFast 选项
      }
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`[AgentTeam:${this.name}] 顺序执行完成: ${successCount}/${tasks.length} 成功`)

    return results
  }

  /**
   * Agent 工作交接
   *
   * 标准交接协议：
   * 1. 发起方生成交接上下文摘要
   * 2. 接收方确认接收并提问澄清
   * 3. 双方确认交接完成
   */
  async handoff(
    fromRoleId: string,
    toRoleId: string,
    context: HandoffContext
  ): Promise<HandoffResult> {
    const fromRole = this.roles.get(fromRoleId)
    const toRole = this.roles.get(toRoleId)

    if (!fromRole) {
      throw new Error(`交接发起方未注册: ${fromRoleId}`)
    }
    if (!toRole) {
      throw new Error(`交接接收方未注册: ${toRoleId}`)
    }

    console.log(`[AgentTeam:${this.name}] 交接: ${fromRole.name} → ${toRole.name}`)

    // 发布交接事件
    this.eventBus.publish({
      type: 'coordinator:handoff_initiated',
      source: fromRoleId,
      target: toRoleId,
      data: { from: fromRoleId, to: toRoleId, context },
      timestamp: new Date(),
    })

    // 生成交接上下文摘要（使用 LLM 精简）
    const summary = this.generateHandoffSummary(context)

    // 模拟接收方确认（实际可调用接收 Agent 的确认方法）
    const acknowledged = true
    const clarifications: string[] = []

    // 发布交接完成事件
    this.eventBus.publish({
      type: 'coordinator:handoff_completed',
      source: fromRoleId,
      target: toRoleId,
      data: { from: fromRoleId, to: toRoleId, acknowledged },
      timestamp: new Date(),
    })

    return {
      success: true,
      recipient: toRoleId,
      context,
      acknowledged,
      clarifications,
    }
  }

  // ========== 私有方法 ==========

  /**
   * 执行单个 Agent 任务
   */
  private async executeAgentTask(
    agent: Agent,
    task: TeamTask,
    sharedContext?: ExecutionContext
  ): Promise<unknown> {
    // 如果 Agent 有 run 方法（ProfessionalAgent），使用 run
    // 否则使用 execute
    const agentWithRun = agent as Agent & {
      run?: (input: unknown, context: unknown) => Promise<unknown>
    }

    if (agentWithRun.run && sharedContext) {
      return await agentWithRun.run(task.input, sharedContext)
    }

    return await agent.execute(task.input)
  }

  /**
   * 将前序任务输出注入当前任务输入
   */
  private enrichInputWithPreviousOutputs(
    input: unknown,
    previousOutputs: Map<string, unknown>
  ): unknown {
    if (typeof input !== 'object' || input === null) {
      return input
    }

    const enriched = { ...(input as Record<string, unknown>) }

    // 如果输入中有 `previousOutputs` 字段，自动填充
    if ('previousOutputs' in enriched) {
      enriched.previousOutputs = Object.fromEntries(previousOutputs)
    }

    return enriched
  }

  /**
   * 生成交接摘要
   */
  private generateHandoffSummary(context: HandoffContext): string {
    const parts: string[] = []

    parts.push(`## 案件理解`)
    parts.push(`技术领域: ${context.caseUnderstanding.technicalField}`)
    parts.push(`技术问题: ${context.caseUnderstanding.technicalProblem}`)

    if (context.completedTasks.length > 0) {
      parts.push(`\n## 已完成任务`)
      context.completedTasks.forEach((t) => {
        parts.push(`- ${t.agentName}: ${t.outputSummary}`)
      })
    }

    if (context.keyDecisions.length > 0) {
      parts.push(`\n## 关键决策`)
      context.keyDecisions.forEach((d) => parts.push(`- ${d}`))
    }

    if (context.openIssues.length > 0) {
      parts.push(`\n## 待解决问题`)
      context.openIssues.forEach((i) => parts.push(`- ${i}`))
    }

    return parts.join('\n')
  }
}

/**
 * 预定义团队模板
 */
export const PATENT_DRAFTING_TEAM = 'patent_drafting'
export const PATENT_SEARCH_TEAM = 'patent_search'
export const OA_RESPONSE_TEAM = 'oa_response'

/**
 * 创建团队（工厂函数）
 */
export function createAgentTeam(name: string, eventBus: EventBus): AgentTeam {
  return new AgentTeam(name, eventBus)
}
