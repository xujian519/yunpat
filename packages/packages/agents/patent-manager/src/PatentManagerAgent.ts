/**
 * 专利管理智能体
 *
 * 专利全生命周期管理智能体，提供：
 * 1. 专利申请管理
 * 2. 期限管理与提醒
 * 3. 费用管理与监控
 * 4. 状态跟踪与报告
 * 5. 工作流程协调
 */

import { Agent, type ExecutionContext, type AgentConfig } from '@yunpat/core'
import { PatentDatabase } from './database/PatentDatabase.js'
import { PatentStateMachine } from './state/PatentStateMachine.js'
import { NotificationService } from './notifications/NotificationService.js'
import type {
  PatentApplication,
  PatentStatus,
  PatentDeadline,
  PatentFee,
  PatentPortfolio,
  PatentQuery,
  ManagerOperation,
  PatentManagerInput,
  PatentManagerOutput,
  PortfolioStatistics,
  NotificationEvent,
} from './types/PatentTypes.js'

/**
 * 管理计划接口
 */
interface ManagementPlan {
  input: PatentManagerInput
  operation: ManagerOperation
}

/**
 * 专利管理智能体配置
 */
export interface PatentManagerConfig {
  /** 数据库实例（可选，不提供则创建默认实例） */
  database?: PatentDatabase
  /** 状态机实例（可选，不提供则创建默认实例） */
  stateMachine?: PatentStateMachine
  /** 通知服务实例（可选，不提供则创建默认实例） */
  notificationService?: NotificationService
  /** 是否启用自动通知 */
  enableNotifications?: boolean
}

/**
 * 专利管理智能体
 *
 * 整合数据库、状态机和通知服务，提供完整的专利管理功能
 */
export class PatentManagerAgent extends Agent<PatentManagerInput, PatentManagerOutput> {
  /** 数据库实例 */
  private database: PatentDatabase
  /** 状态机实例 */
  private stateMachine: PatentStateMachine
  /** 通知服务实例 */
  private notificationService: NotificationService
  /** 是否启用通知 */
  private enableNotifications: boolean

  /**
   * 构造函数
   */
  constructor(config: PatentManagerConfig & AgentConfig) {
    super({
      name: config.name ?? 'PatentManagerAgent',
      description: config.description ?? '专利全生命周期管理智能体',
      eventBus: config.eventBus,
      memory: config.memory,
      tools: config.tools,
      llm: config.llm,
      maxIterations: config.maxIterations,
      timeout: config.timeout,
    })

    this.database = config.database ?? new PatentDatabase()
    this.stateMachine = config.stateMachine ?? new PatentStateMachine()
    this.notificationService = config.notificationService ?? new NotificationService()
    this.enableNotifications = config.enableNotifications ?? true
  }

  /**
   * 获取数据库实例
   */
  getDatabase(): PatentDatabase {
    return this.database
  }

  /**
   * 获取状态机实例
   */
  getStateMachine(): PatentStateMachine {
    return this.stateMachine
  }

  /**
   * 获取通知服务实例
   */
  getNotificationService(): NotificationService {
    return this.notificationService
  }

  /**
   * 步骤1: 规划阶段
   *
   * 验证输入并制定执行计划
   */
  protected async plan(
    input: PatentManagerInput,
    _context: ExecutionContext
  ): Promise<ManagementPlan> {
    console.log('[PatentManager] 步骤1: 规划阶段')
    console.log(`   操作类型: ${input.operation}`)

    // 验证输入
    this.validateInput(input)

    return { input, operation: input.operation }
  }

  /**
   * 步骤2: 执行阶段
   *
   * 执行计划并返回结果
   */
  protected async act(
    plan: ManagementPlan,
    context: ExecutionContext
  ): Promise<PatentManagerOutput> {
    console.log('[PatentManager] 步骤2: 执行阶段')

    const { input, operation } = plan
    const startTime = Date.now()

    let data: unknown
    let success = true
    let error: string | undefined

    try {
      switch (operation) {
        case 'add_patent':
          data = await this.addPatent(input)
          break
        case 'update_patent':
          data = await this.updatePatent(input)
          break
        case 'remove_patent':
          data = await this.removePatent(input)
          break
        case 'get_patent':
          data = await this.getPatent(input)
          break
        case 'list_patents':
          data = await this.listPatents(input)
          break
        case 'add_deadline':
          data = await this.addDeadline(input)
          break
        case 'update_deadline':
          data = await this.updateDeadline(input)
          break
        case 'get_upcoming_deadlines':
          data = await this.getUpcomingDeadlines(input)
          break
        case 'add_fee':
          data = await this.addFee(input)
          break
        case 'update_fee':
          data = await this.updateFee(input)
          break
        case 'get_pending_fees':
          data = await this.getPendingFees()
          break
        case 'get_portfolio':
          data = await this.getPortfolio()
          break
        case 'change_status':
          data = await this.changeStatus(input)
          break
        case 'generate_report':
          data = await this.generateReport(input, context)
          break
        default:
          throw new Error(`未知的操作类型: ${operation}`)
      }
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : String(err)
      console.error(`[PatentManager] 错误: ${error}`)
    }

    const duration = Date.now() - startTime
    console.log(`[PatentManager] 完成 (耗时 ${duration}ms)`)

    return {
      success,
      data,
      error,
      metadata: {
        operation,
        timestamp: new Date(),
        processingTime: duration,
      },
    }
  }

  // ==================== 输入验证 ====================

  /**
   * 验证输入数据
   */
  private validateInput(input: PatentManagerInput): void {
    switch (input.operation) {
      case 'add_patent':
      case 'update_patent':
        if (!input.patent?.applicationNumber?.trim()) {
          throw new Error('申请号不能为空')
        }
        if (!input.patent?.title?.trim()) {
          throw new Error('专利标题不能为空')
        }
        if (input.operation === 'add_patent' && !input.patent?.applicant?.trim()) {
          throw new Error('申请人不能为空')
        }
        console.log(`   申请号: ${input.patent.applicationNumber}`)
        break

      case 'get_patent':
      case 'remove_patent':
      case 'add_deadline':
      case 'add_fee':
        if (!input.applicationNumber?.trim()) {
          throw new Error('申请号不能为空')
        }
        console.log(`   申请号: ${input.applicationNumber}`)
        break

      case 'update_deadline':
        if (!input.deadline?.id) {
          throw new Error('截止日期ID不能为空')
        }
        break

      case 'update_fee':
        if (!input.fee?.id) {
          throw new Error('费用ID不能为空')
        }
        break

      case 'change_status':
        if (!input.applicationNumber?.trim()) {
          throw new Error('申请号不能为空')
        }
        if (!input.newStatus) {
          throw new Error('新状态不能为空')
        }
        break
    }
  }

  // ==================== 专利操作 ====================

  /**
   * 添加专利
   */
  private async addPatent(input: PatentManagerInput): Promise<PatentApplication> {
    if (!input.patent) {
      throw new Error('专利信息不能为空')
    }

    console.log(`   添加专利: ${input.patent.applicationNumber}`)

    const patent = await this.database.createPatent(input.patent)

    // 发送通知
    if (this.enableNotifications) {
      await this.sendNotification('status_changed', {
        applicationNumber: patent.applicationNumber,
        title: patent.title,
        event: 'status_changed',
        newStatus: patent.status,
      })
    }

    return patent
  }

  /**
   * 更新专利
   */
  private async updatePatent(input: PatentManagerInput): Promise<PatentApplication | null> {
    if (!input.patent?.applicationNumber) {
      throw new Error('申请号不能为空')
    }

    console.log(`   更新专利: ${input.patent.applicationNumber}`)

    // 如果更新状态且状态发生变化，需要通过状态机验证
    if (input.patent.status) {
      const existing = await this.database.getPatent(input.patent.applicationNumber)
      if (!existing) {
        throw new Error('专利不存在')
      }

      if (existing.status !== input.patent.status) {
        const result = await this.stateMachine.transition(existing, input.patent.status)
        if (!result.success) {
          throw new Error(result.error)
        }
      }
    }

    const patent = await this.database.updatePatent(input.patent.applicationNumber, input.patent)

    if (!patent) {
      throw new Error('专利不存在')
    }

    return patent
  }

  /**
   * 删除专利
   */
  private async removePatent(input: PatentManagerInput): Promise<boolean> {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空')
    }

    console.log(`   删除专利: ${input.applicationNumber}`)

    const success = await this.database.deletePatent(input.applicationNumber)

    if (!success) {
      throw new Error('专利不存在')
    }

    return true
  }

  /**
   * 获取专利详情
   */
  private async getPatent(input: PatentManagerInput): Promise<PatentApplication> {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空')
    }

    const patent = await this.database.getPatent(input.applicationNumber)
    if (!patent) {
      throw new Error('专利不存在')
    }

    return patent
  }

  /**
   * 列出专利
   */
  private async listPatents(input: PatentManagerInput): Promise<{
    patents: PatentApplication[]
    total: number
  }> {
    const query: PatentQuery = {
      status: input.query?.status,
      patentType: input.query?.patentType,
      dateRange: input.query?.dateRange,
      // input.query 的结构与 PatentQuery.pagination 存在设计偏差，需类型断言
      pagination: input.query as PatentQuery['pagination'],
    }

    console.log(`   列出专利（条件: ${JSON.stringify(query)})`)

    return await this.database.queryPatents(query)
  }

  /**
   * 变更专利状态
   */
  private async changeStatus(input: PatentManagerInput): Promise<{
    success: boolean
    patent?: PatentApplication
    error?: string
  }> {
    if (!input.applicationNumber || !input.newStatus) {
      throw new Error('申请号和新状态不能为空')
    }

    console.log(`   变更状态: ${input.applicationNumber} -> ${input.newStatus}`)

    const existing = await this.database.getPatent(input.applicationNumber)
    if (!existing) {
      return { success: false, error: '专利不存在' }
    }

    const result = await this.stateMachine.transition(existing, input.newStatus)
    if (!result.success) {
      return { success: false, error: result.error }
    }

    const patent = await this.database.updatePatent(input.applicationNumber, {
      status: input.newStatus,
    })

    if (!patent) {
      return { success: false, error: '更新失败' }
    }

    // 发送通知
    if (this.enableNotifications) {
      await this.sendNotification('status_changed', {
        applicationNumber: patent.applicationNumber,
        title: patent.title,
        event: 'status_changed',
        newStatus: patent.status,
      })
    }

    return { success: true, patent }
  }

  // ==================== 截止日期操作 ====================

  /**
   * 添加截止日期
   */
  private async addDeadline(input: PatentManagerInput): Promise<PatentDeadline> {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空')
    }
    if (!input.deadline) {
      throw new Error('截止日期信息不能为空')
    }

    console.log(`   添加截止日期: ${input.applicationNumber}`)

    const deadline = await this.database.addDeadline({
      ...input.deadline,
      applicationNumber: input.applicationNumber,
    })

    // 如果截止日期紧急，发送通知
    if (this.enableNotifications && deadline.priority === 'high') {
      await this.sendNotification('deadline_approaching', {
        applicationNumber: deadline.applicationNumber,
        title: deadline.applicationNumber, // 需要从专利获取标题
        event: 'deadline_approaching',
        deadlineDate: deadline.deadlineDate,
      })
    }

    return deadline
  }

  /**
   * 更新截止日期
   */
  private async updateDeadline(input: PatentManagerInput): Promise<PatentDeadline | null> {
    if (!input.deadline?.id) {
      throw new Error('截止日期ID不能为空')
    }

    console.log(`   更新截止日期: ${input.deadline.id}`)

    return await this.database.updateDeadline(input.deadline.id, input.deadline)
  }

  /**
   * 获取即将到期的截止日期
   */
  private async getUpcomingDeadlines(input: PatentManagerInput): Promise<PatentDeadline[]> {
    const days = input.days ?? 30
    console.log(`   获取即将到期的截止日期 (未来 ${days} 天)`)

    return await this.database.getUpcomingDeadlines(days)
  }

  // ==================== 费用操作 ====================

  /**
   * 添加费用
   */
  private async addFee(input: PatentManagerInput): Promise<PatentFee> {
    if (!input.applicationNumber) {
      throw new Error('申请号不能为空')
    }
    if (!input.fee) {
      throw new Error('费用信息不能为空')
    }

    console.log(`   添加费用: ${input.applicationNumber}`)

    const fee = await this.database.addFee({
      ...input.fee,
      applicationNumber: input.applicationNumber,
    })

    return fee
  }

  /**
   * 更新费用
   */
  private async updateFee(input: PatentManagerInput): Promise<PatentFee | null> {
    if (!input.fee?.id) {
      throw new Error('费用ID不能为空')
    }

    console.log(`   更新费用: ${input.fee.id}`)

    return await this.database.updateFee(input.fee.id, input.fee)
  }

  /**
   * 获取待支付费用
   */
  private async getPendingFees(): Promise<PatentFee[]> {
    console.log('   获取待支付费用')

    return await this.database.getPendingFees()
  }

  // ==================== 组合与报告 ====================

  /**
   * 获取专利组合概览
   */
  private async getPortfolio(): Promise<PatentPortfolio> {
    console.log('   获取专利组合概览')

    // 获取所有专利
    const { patents } = await this.database.queryPatents()

    // 获取统计信息
    const stats = await this.database.getStatistics()

    // 获取即将到期的截止日期
    const upcomingDeadlines = await this.database.getUpcomingDeadlines(30)

    // 获取待支付费用
    const pendingFees = await this.database.getPendingFees()

    // 获取逾期费用
    const overdueFees = await this.database.getOverdueFees()

    // 构建统计对象
    const statistics: PortfolioStatistics = {
      total: stats.total,
      byStatus: stats.byStatus as Record<string, number> as Record<PatentStatus, number>,
      byType: stats.byType as Record<'invention' | 'utility' | 'design', number>,
      upcomingDeadlines: upcomingDeadlines.length,
      pendingFees: pendingFees.length,
      overdueFees: overdueFees.length,
    }

    // 生成风险提示
    const riskAlerts: string[] = []

    // 检查即将到期的重要截止日期
    const urgentDeadlines = upcomingDeadlines.filter((d) => d.priority === 'high')
    if (urgentDeadlines.length > 0) {
      riskAlerts.push(`${urgentDeadlines.length} 个高优先级截止日期将在 30 天内到期`)
    }

    // 检查逾期费用
    if (overdueFees.length > 0) {
      riskAlerts.push(`${overdueFees.length} 个费用已逾期`)
    }

    // 检查审查中的专利
    const underExamCount = statistics.byStatus.under_exam || 0
    const oaIssuedCount = statistics.byStatus.oa_issued || 0
    if (oaIssuedCount > 0) {
      riskAlerts.push(`${oaIssuedCount} 个专利已收到审查意见，需及时答复`)
    }

    return {
      patents,
      statistics,
      riskAlerts,
    }
  }

  /**
   * 生成管理报告
   */
  private async generateReport(
    input: PatentManagerInput,
    context: ExecutionContext
  ): Promise<string> {
    console.log('   生成管理报告')

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成报告')
    }

    const portfolio = await this.getPortfolio()

    const systemPrompt = `你是一位专利管理顾问。

请根据专利组合数据，生成一份管理报告，包括：
1. 总体概况
2. 状态分析
3. 风险提示
4. 建议

报告应简洁明了，突出重点。`

    const userPrompt = `## 专利组合数据

总专利数: ${portfolio.statistics.total}

### 状态分布
${Object.entries(portfolio.statistics.byStatus)
  .filter(([_, count]) => count > 0)
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### 类型分布
${Object.entries(portfolio.statistics.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

### 即将到期的截止日期
${portfolio.statistics.upcomingDeadlines} 个

### 待支付费用
${portfolio.statistics.pendingFees} 个

### 逾期费用
${portfolio.statistics.overdueFees} 个

### 风险提示
${portfolio.riskAlerts.map((alert) => `- ${alert}`).join('\n')}

请生成管理报告。`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    })

    return response.message.content
  }

  // ==================== 通知 ====================

  /**
   * 发送通知
   */
  private async sendNotification(
    event: NotificationEvent,
    data: {
      applicationNumber: string
      title: string
      event: NotificationEvent
      newStatus?: string
      deadlineDate?: Date
      amount?: number
      currency?: string
    }
  ): Promise<void> {
    try {
      await this.notificationService.sendNotification(event, data)
    } catch (error) {
      console.error('[PatentManager] 发送通知失败:', error)
      // 不抛出错误，避免影响主流程
    }
  }
}

// ==================== 重新导出类型 ====================

export type {
  PatentApplication,
  PatentStatus,
  PatentDeadline,
  PatentFee,
  PatentPortfolio,
  PatentQuery,
  ManagerOperation,
  PatentManagerInput,
  PatentManagerOutput,
}
