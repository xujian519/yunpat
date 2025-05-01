/**
 * ContextBuilder - 上下文构建器
 *
 * 负责构建 Prompt 三层结构中的 Context 层：
 * System（角色+规则）→ Context（动态状态）→ User（当前输入）
 *
 * Context 层在 System Prompt 之后、User Message 之前注入，
 * 每轮对话重新构建，包含当前状态的完整快照。
 */

import type { LLMMessage } from '../llm/LLMClient.js'
import type { ContextManager } from './ContextManager.js'
import type { AgentRegistry } from '../registry/AgentRegistry.js'

/**
 * Context 层构建选项
 */
export interface ContextLayerOptions {
  /** 会话 ID */
  sessionId: string
  /** 是否包含代理能力摘要 */
  includeAgentRegistry?: boolean
  /** 是否包含活跃任务状态 */
  includeActiveTask?: boolean
  /** 是否包含用户画像 */
  includeUserProfile?: boolean
  /** HITL 等待状态描述（如有） */
  pendingHITLDescription?: string
  /** 额外的上下文片段 */
  extraContext?: Record<string, string>
}

export class ContextBuilder {
  private contextManager: ContextManager
  private agentRegistry?: AgentRegistry

  constructor(contextManager: ContextManager, agentRegistry?: AgentRegistry) {
    this.contextManager = contextManager
    this.agentRegistry = agentRegistry
  }

  /**
   * 构建 Context 层内容
   */
  async buildContextLayer(options: ContextLayerOptions): Promise<string> {
    const parts: string[] = []

    // 1. 对话历史摘要
    const messages = await this.contextManager.getHistory(options.sessionId)
    if (messages && messages.length > 0) {
      const summary = this.summarizeHistory(messages)
      parts.push(`<conversation>\n消息数: ${messages.length}\n${summary}\n</conversation>`)
    }

    // 2. 活跃任务状态
    if (options.includeActiveTask) {
      const activeTask = await this.contextManager.getActiveTask(options.sessionId)
      if (activeTask) {
        parts.push(
          `<active_task>\n` +
            `任务类型: ${activeTask.plan.intent}\n` +
            `状态: ${activeTask.status}\n` +
            `当前步骤: ${activeTask.currentStepId ?? '—'} / ${activeTask.plan.steps.length}\n` +
            `已完成: ${activeTask.completedSteps.join(' → ') || '无'}\n` +
            `</active_task>`
        )
      }
    }

    // 3. 用户画像
    if (options.includeUserProfile) {
      const profile = await this.contextManager.getUserProfile(options.sessionId)
      if (profile) {
        parts.push(
          `<user_profile>\n` +
            `角色: ${profile.role}\n` +
            `输出偏好: ${profile.outputFormat}\n` +
            `技术领域: ${profile.domains.join(', ')}\n` +
            `</user_profile>`
        )
      }
    }

    // 4. 可用代理能力摘要
    if (options.includeAgentRegistry && this.agentRegistry) {
      const summary = this.agentRegistry.getCapabilitySummary()
      if (summary) {
        parts.push(`<available_agents>\n${summary}\n</available_agents>`)
      }
    }

    // 5. HITL 等待状态
    if (options.pendingHITLDescription) {
      parts.push(
        `<awaiting_confirmation>\n` +
          `你正在等待用户对以下内容的确认或修改：\n` +
          `${options.pendingHITLDescription}\n` +
          `用户的下一条消息应被解读为对此的回应，而非新任务。\n` +
          `</awaiting_confirmation>`
      )
    }

    // 6. 额外上下文
    if (options.extraContext) {
      for (const [key, value] of Object.entries(options.extraContext)) {
        parts.push(`<${key}>\n${value}\n</${key}>`)
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : ''
  }

  /**
   * 构建完整的三层消息列表
   * @returns [system, context, ...fewShots, user]
   */
  async buildThreeLayerMessages(
    systemPrompt: string,
    contextOptions: ContextLayerOptions,
    userInput: string,
    fewShots?: Array<{ input: string; output: string }>
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = []

    // Layer 1: System Prompt（角色 + 规则）
    messages.push({ role: 'system', content: systemPrompt })

    // Layer 2: Context（动态注入当前状态）
    const contextContent = await this.buildContextLayer(contextOptions)
    if (contextContent) {
      messages.push({ role: 'system', content: contextContent })
    }

    // Few-shot 示例（在 Context 之后、User 之前）
    if (fewShots) {
      for (const example of fewShots) {
        messages.push({ role: 'user', content: example.input })
        messages.push({ role: 'assistant', content: example.output })
      }
    }

    // Layer 3: User（本轮输入）
    messages.push({ role: 'user', content: userInput })

    return messages
  }

  /**
   * 压缩对话历史为摘要文本
   */
  private summarizeHistory(messages: Array<{ role: string; content: string }>): string {
    const maxRecent = 4
    const maxContentLength = 500

    if (messages.length <= maxRecent) {
      return messages
        .map((m) => `[${m.role}]: ${m.content.substring(0, maxContentLength)}`)
        .join('\n')
    }

    // 两级策略：早期消息提取话题摘要 + 最近消息保留完整内容
    const older = messages.slice(0, -maxRecent)
    const recent = messages.slice(-maxRecent)

    const userTopics = older
      .filter((m) => m.role === 'user')
      .map((m) => m.content.substring(0, 100))

    return (
      `[Earlier: ${older.length} messages]\n` +
      `Topics: ${userTopics.join(' | ')}\n\n` +
      `[Recent]\n` +
      recent.map((m) => `[${m.role}]: ${m.content.substring(0, maxContentLength)}`).join('\n')
    )
  }
}
