/**
 * ContextManager - 上下文管理器
 *
 * 负责管理：
 * 1. 对话历史（自动压缩）
 * 2. 活跃任务状态
 * 3. 用户画像
 */

import {
  ConversationHistory,
  ConversationMessage,
  ActiveTask,
  UserProfile,
  TaskPlan,
  AgentResult,
  IntentType,
  OrchestratorLLMConfig
} from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'

export class ContextManager {
  private histories: Map<string, ConversationHistory>
  private activeTasks: Map<string, ActiveTask>
  private userProfiles: Map<string, UserProfile>
  private readonly maxHistoryLength: number = 100
  private readonly maxTokens: number = 100000
  private llmClient: LLMClient | null = null

  constructor(llmClient?: LLMClient) {
    this.histories = new Map()
    this.activeTasks = new Map()
    this.userProfiles = new Map()
    this.llmClient = llmClient || null
  }

  // ========================================================================
  // 对话历史管理
  // ========================================================================

  /**
   * 添加消息到对话历史
   */
  async addMessage(
    sessionId: string,
    message: ConversationMessage
  ): Promise<void> {
    let history = this.histories.get(sessionId)

    if (!history) {
      history = {
        sessionId,
        messages: [],
        totalTokens: 0,
        lastUpdated: new Date()
      }
      this.histories.set(sessionId, history)
    }

    history.messages.push(message)
    history.totalTokens += await this.estimateTokens(message.content)
    history.lastUpdated = new Date()

    // 压缩历史
    await this.compressHistoryIfNeeded(sessionId)
  }

  /**
   * 获取对话历史
   */
  async getHistory(sessionId: string): Promise<ConversationMessage[]> {
    const history = this.histories.get(sessionId)
    return history?.messages || []
  }

  /**
   * 清空对话历史
   */
  clearHistory(sessionId: string): void {
    this.histories.delete(sessionId)
  }

  /**
   * 压缩对话历史（如需要）
   */
  private async compressHistoryIfNeeded(sessionId: string): Promise<void> {
    const history = this.histories.get(sessionId)
    if (!history) return

    // Token超限或消息过多，压缩
    if (
      history.totalTokens > this.maxTokens ||
      history.messages.length > this.maxHistoryLength
    ) {
      await this.compressHistory(sessionId)
    }
  }

  /**
   * 压缩对话历史
   */
  private async compressHistory(sessionId: string): Promise<void> {
    const history = this.histories.get(sessionId)
    if (!history) return

    // 保留最近20条消息
    const recentMessages = history.messages.slice(-20)

    // 早期消息摘要
    const earlyMessages = history.messages.slice(0, -20)
    const summary = await this.summarizeMessages(earlyMessages)

    history.messages = [
      {
        id: `summary-${Date.now()}`,
        role: 'system',
        content: `[历史对话摘要]\n${summary}`,
        timestamp: new Date()
      },
      ...recentMessages
    ]

    history.totalTokens = await this.recalculateTokens(sessionId)
  }

  /**
   * 摘要消息（使用LLM）
   */
  private async summarizeMessages(
    messages: ConversationMessage[]
  ): Promise<string> {
    if (messages.length === 0) return ''

    // 如果没有LLM客户端，使用简化版本
    if (!this.llmClient) {
      return this.simpleSummarize(messages)
    }

    try {
      // 使用LLM生成摘要
      const llmMessages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是一个对话摘要专家。请将以下对话历史摘要为关键信息，包括：主要话题、用户需求、已完成任务、待办事项。'
        },
        {
          role: 'user',
          content: this.formatMessagesForSummary(messages)
        }
      ]

      const response = await this.llmClient.chat(llmMessages)
      return response.content
    } catch (error) {
      // LLM调用失败，使用简化版本
      return this.simpleSummarize(messages)
    }
  }

  /**
   * 格式化消息用于摘要
   */
  private formatMessagesForSummary(messages: ConversationMessage[]): string {
    return messages.map(m => `[${m.role}] ${m.content}`).join('\n')
  }

  /**
   * 简化版摘要
   */
  private simpleSummarize(messages: ConversationMessage[]): string {
    if (messages.length === 0) return ''

    // 提取关键信息
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')

    // 统计意图类型
    const intentCounts: Record<string, number> = {}
    for (const msg of userMessages) {
      // 简单的关键词匹配
      if (msg.content.includes('撰写') || msg.content.includes('写')) {
        intentCounts['DRAFT'] = (intentCounts['DRAFT'] || 0) + 1
      }
      if (msg.content.includes('检索') || msg.content.includes('搜索')) {
        intentCounts['SEARCH'] = (intentCounts['SEARCH'] || 0) + 1
      }
      if (msg.content.includes('答复') || msg.content.includes('审查意见')) {
        intentCounts['RESPOND'] = (intentCounts['RESPOND'] || 0) + 1
      }
    }

    const intentSummary = Object.entries(intentCounts)
      .map(([intent, count]) => `${intent}x${count}`)
      .join(', ')

    return `对话包含${userMessages.length}条用户消息和${assistantMessages.length}条助手回复。主要意图：${intentSummary || '未识别'}`
  }

  /**
   * 估算Token数（简化版）
   */
  private async estimateTokens(text: string): Promise<number> {
    // 简单估算：中文≈0.7 token/字符，英文≈0.25 token/字符
    const chineseChars = (text.match(/[一-龥]/g) || []).length
    const englishChars = text.length - chineseChars

    return Math.ceil(chineseChars * 0.7 + englishChars * 0.25)
  }

  /**
   * 重新计算Token数
   */
  private async recalculateTokens(sessionId: string): Promise<number> {
    const history = this.histories.get(sessionId)
    if (!history) return 0

    let total = 0
    for (const message of history.messages) {
      total += await this.estimateTokens(message.content)
    }

    history.totalTokens = total
    return total
  }

  // ========================================================================
  // 活跃任务管理
  // ========================================================================

  /**
   * 创建活跃任务
   */
  async createActiveTask(plan: TaskPlan, sessionId: string): Promise<string> {
    const task: ActiveTask = {
      taskId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      plan,
      status: 'running',
      completedSteps: [],
      results: new Map(),
      startTime: new Date(),
      lastUpdate: new Date()
    }

    this.activeTasks.set(task.taskId, task)
    return task.taskId
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: string,
    status: ActiveTask['status'],
    currentStepId?: string
  ): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.status = status
    task.currentStepId = currentStepId
    task.lastUpdate = new Date()
  }

  /**
   * 获取活跃任务
   */
  async getActiveTask(sessionId: string): Promise<ActiveTask | null> {
    const tasks = Array.from(this.activeTasks.values())
    // 返回该会话的任何任务（不仅仅是running状态的）
    return (
      tasks.find(t => t.sessionId === sessionId) || null
    )
  }

  /**
   * 完成步骤
   */
  async completeStep(
    taskId: string,
    stepId: string,
    result: AgentResult
  ): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.completedSteps.push(stepId)
    task.results.set(stepId, result)
    task.lastUpdate = new Date()
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.status = 'completed'
    task.lastUpdate = new Date()
  }

  /**
   * 获取所有活跃任务
   */
  getAllActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * 检查任务超时
   */
  async checkTaskTimeout(taskId: string, timeout: number): Promise<boolean> {
    const task = this.activeTasks.get(taskId)
    if (!task) {
      return false
    }

    const elapsed = Date.now() - task.lastUpdate.getTime()
    if (elapsed > timeout) {
      task.status = 'paused'
      return true
    }

    return false
  }

  /**
   * 获取任务进度
   */
  getTaskProgress(taskId: string): {
    totalSteps: number
    completedSteps: number
    percentage: number
  } | null {
    const task = this.activeTasks.get(taskId)
    if (!task) {
      return null
    }

    const totalSteps = task.plan.steps.length
    const completedSteps = task.completedSteps.length
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

    return {
      totalSteps,
      completedSteps,
      percentage
    }
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    this.activeTasks.delete(taskId)
  }

  // ========================================================================
  // 用户画像管理
  // ========================================================================

  /**
   * 获取用户画像
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.userProfiles.get(userId)

    if (!profile) {
      profile = await this.createDefaultProfile(userId)
      this.userProfiles.set(userId, profile)
    }

    return profile
  }

  /**
   * 更新用户偏好
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
  ): Promise<void> {
    const profile = await this.getUserProfile(userId)
    profile.preferences = { ...profile.preferences, ...preferences }
  }

  /**
   * 记录任务完成
   */
  async recordTaskCompletion(
    userId: string,
    taskType: IntentType,
    duration: number
  ): Promise<void> {
    const profile = await this.getUserProfile(userId)
    profile.statistics.totalTasks++
    profile.statistics.taskTypes[taskType] =
      (profile.statistics.taskTypes[taskType] || 0) + 1

    // 更新平均时长
    const total = profile.statistics.totalTasks
    const current = profile.statistics.averageTaskDuration
    profile.statistics.averageTaskDuration =
      (current * (total - 1) + duration) / total

    profile.statistics.lastActive = new Date()
  }

  /**
   * 创建默认用户画像
   */
  private async createDefaultProfile(userId: string): Promise<UserProfile> {
    return {
      userId,
      role: 'individual',
      outputFormat: 'detailed',
      domains: [],
      preferences: {
        language: 'zh',
        includeLegalBasis: true,
        includeExamples: true,
        tone: 'professional'
      },
      statistics: {
        totalTasks: 0,
        taskTypes: {},
        averageTaskDuration: 0,
        lastActive: new Date()
      }
    }
  }

  // ========================================================================
  // 工具方法
  // ========================================================================

  /**
   * 清理过期数据
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now()
    let cleaned = 0

    // 清理过期对话历史
    for (const [sessionId, history] of this.histories.entries()) {
      if (now - history.lastUpdated.getTime() > maxAge) {
        this.histories.delete(sessionId)
        cleaned++
      }
    }

    // 清理已完成任务
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (
        task.status === 'completed' &&
        now - task.lastUpdate.getTime() > maxAge
      ) {
        this.activeTasks.delete(taskId)
      }
    }

    // 如果maxAge为0，强制清理所有
    if (maxAge === 0) {
      this.histories.clear()
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSessions: number
    activeTasks: number
    totalUsers: number
    totalTokens: number
  } {
    let totalTokens = 0
    for (const history of this.histories.values()) {
      totalTokens += history.totalTokens
    }

    return {
      totalSessions: this.histories.size,
      activeTasks: Array.from(this.activeTasks.values()).filter(
        t => t.status === 'running'
      ).length,
      totalUsers: this.userProfiles.size,
      totalTokens
    }
  }
}
