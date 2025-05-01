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
} from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'
import { TokenCounter } from '@yunpat/core/tokenization'

export class ContextManager {
  private histories: Map<string, ConversationHistory>
  private activeTasks: Map<string, ActiveTask>
  private userProfiles: Map<string, UserProfile>
  private readonly maxHistoryLength: number = 100
  private readonly maxTokens: number = 100000
  private readonly maxToolResultsBeforeCompact: number = 15
  private readonly keepRecentToolResults: number = 5
  private llmClient: LLMClient | null = null
  private tokenCounter: TokenCounter
  private model: string

  constructor(llmClient?: LLMClient, model: string = 'gpt-4') {
    this.histories = new Map()
    this.activeTasks = new Map()
    this.userProfiles = new Map()
    this.llmClient = llmClient || null
    this.tokenCounter = new TokenCounter()
    this.model = model
  }

  // ========================================================================
  // 对话历史管理
  // ========================================================================

  /**
   * 添加消息到对话历史
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    let history = this.histories.get(sessionId)

    if (!history) {
      history = {
        sessionId,
        messages: [],
        totalTokens: 0,
        lastUpdated: new Date(),
      }
      this.histories.set(sessionId, history)
    }

    history.messages.push(message)
    history.totalTokens += this.estimateTokens(message.content)
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
   *
   * 先尝试轻量的 microCompact（清理旧工具结果），
   * 如果仍然超限再执行完整的历史摘要压缩
   */
  private async compressHistoryIfNeeded(sessionId: string): Promise<void> {
    const history = this.histories.get(sessionId)
    if (!history) return

    // 第一步：轻量清理旧工具结果
    this.microCompactIfNeeded(sessionId)

    // 第二步：如果仍然超限，执行完整压缩
    if (history.totalTokens > this.maxTokens || history.messages.length > this.maxHistoryLength) {
      await this.compressHistory(sessionId)
    }
  }

  /**
   * MicroCompact - 轻量工具结果清理
   *
   * 当对话中工具结果数量超过阈值时，将最早的工具结果内容
   * 替换为占位符，保留最近 N 条完整结果
   */
  private microCompactIfNeeded(sessionId: string): void {
    const history = this.histories.get(sessionId)
    if (!history) return

    const messages = history.messages

    // 收集所有未清理的工具结果消息及其索引
    const toolResultIndices: number[] = []
    messages.forEach((msg, idx) => {
      if (msg.metadata?.isToolResult === true && !msg.metadata?.compactSafe) {
        toolResultIndices.push(idx)
      }
    })

    if (toolResultIndices.length <= this.maxToolResultsBeforeCompact) {
      return
    }

    // 从最早的开始清理，保留最近 N 条
    const keepCount = this.keepRecentToolResults
    const indicesToCompact = toolResultIndices.slice(0, toolResultIndices.length - keepCount)

    for (const idx of indicesToCompact) {
      const msg = messages[idx]
      const originalLength = msg.content.length
      msg.content = `[工具结果已清理，原始长度: ${originalLength} 字符]`
      if (!msg.metadata) {
        msg.metadata = {}
      }
      msg.metadata.compactSafe = true
    }

    if (indicesToCompact.length > 0) {
      history.totalTokens = this.recalculateTokens(sessionId)
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

    // 从被压缩的消息中提取文件引用，用于恢复上下文
    const fileReferences = this.extractFileReferences(earlyMessages)

    const restoredMessages: ConversationMessage[] = [
      {
        id: `summary-${Date.now()}`,
        role: 'system',
        content: `[历史对话摘要]\n${summary}`,
        timestamp: new Date(),
      },
    ]

    // 注入文件恢复上下文
    if (fileReferences.length > 0) {
      restoredMessages.push({
        id: `files-${Date.now()}`,
        role: 'system',
        content: `[压缩前操作过的文件]\n${fileReferences.map((f) => `- ${f}`).join('\n')}\n如需操作这些文件，请重新读取其内容。`,
        timestamp: new Date(),
      })
    }

    history.messages = [...restoredMessages, ...recentMessages]

    history.totalTokens = this.recalculateTokens(sessionId)
  }

  /**
   * 从消息中提取文件路径引用
   *
   * 匹配常见模式：
   * - 专利文件路径（.pdf, .docx）
   * - 项目文件路径（src/...）
   * - 文件操作关键词附近的路径
   */
  private extractFileReferences(messages: ConversationMessage[]): string[] {
    // eslint-disable-next-line no-control-regex
    const filePattern =
      /(?:读取|打开|编辑|分析|查看|文件|附件)[：:\s]*([^\s，。！？\n《》""''「」\u0000-\u001F]+\.(?:pdf|docx?|txt|ts|js|json|md|csv|xlsx?))/gi // eslint-disable-line no-control-regex
    const pathPattern = /(?:\/[\w.-]+){2,}\.(?:pdf|docx?|txt|ts|js|json|md|csv|xlsx?)/gi

    const files = new Set<string>()

    for (const msg of messages) {
      let match: RegExpExecArray | null
      filePattern.lastIndex = 0
      while ((match = filePattern.exec(msg.content)) !== null) {
        files.add(match[1])
      }
      pathPattern.lastIndex = 0
      while ((match = pathPattern.exec(msg.content)) !== null) {
        files.add(match[0])
      }
    }

    return Array.from(files).slice(0, 5)
  }

  /**
   * 摘要消息（使用LLM）
   */
  private async summarizeMessages(messages: ConversationMessage[]): Promise<string> {
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
          content:
            '你是一个对话摘要专家。请将以下对话历史摘要为关键信息，包括：主要话题、用户需求、已完成任务、待办事项。',
        },
        {
          role: 'user',
          content: this.formatMessagesForSummary(messages),
        },
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
    return messages.map((m) => `[${m.role}] ${m.content}`).join('\n')
  }

  /**
   * 简化版摘要
   */
  private simpleSummarize(messages: ConversationMessage[]): string {
    if (messages.length === 0) return ''

    // 提取关键信息
    const userMessages = messages.filter((m) => m.role === 'user')
    const assistantMessages = messages.filter((m) => m.role === 'assistant')

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
  private estimateTokens(text: string): number {
    return this.tokenCounter.estimateTokens(text, this.model)
  }

  /**
   * 重新计算Token数
   */
  private recalculateTokens(sessionId: string): number {
    const history = this.histories.get(sessionId)
    if (!history) return 0

    let total = 0
    for (const message of history.messages) {
      total += this.estimateTokens(message.content)
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
      lastUpdate: new Date(),
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
    return tasks.find((t) => t.sessionId === sessionId) || null
  }

  /**
   * 完成步骤
   */
  async completeStep(taskId: string, stepId: string, result: AgentResult): Promise<void> {
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
      percentage,
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
    profile.statistics.taskTypes[taskType] = (profile.statistics.taskTypes[taskType] || 0) + 1

    // 更新平均时长
    const total = profile.statistics.totalTasks
    const current = profile.statistics.averageTaskDuration
    profile.statistics.averageTaskDuration = (current * (total - 1) + duration) / total

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
        tone: 'professional',
      },
      statistics: {
        totalTasks: 0,
        taskTypes: {},
        averageTaskDuration: 0,
        lastActive: new Date(),
      },
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
    let _cleaned = 0
    // 清理过期对话历史
    for (const [sessionId, history] of this.histories.entries()) {
      if (now - history.lastUpdated.getTime() > maxAge) {
        this.histories.delete(sessionId)
        _cleaned++
      }
    }

    // 清理已完成任务
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.status === 'completed' && now - task.lastUpdate.getTime() > maxAge) {
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
      activeTasks: Array.from(this.activeTasks.values()).filter((t) => t.status === 'running')
        .length,
      totalUsers: this.userProfiles.size,
      totalTokens,
    }
  }
}
