/**
 * 专利数据库操作层
 *
 * 提供专利、截止日期、费用等数据的 CRUD 操作
 * 使用 Drizzle ORM 与 PostgreSQL 交互
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm'
import * as schema from './schema.js'
import type {
  PatentApplication,
  PatentDeadline,
  PatentFee,
  PatentHistory,
  NotificationConfig,
  NotificationLog,
  PatentQuery,
  HistoryEventType,
  DeadlinePriority,
  NotificationEvent,
} from '../types/PatentTypes.js'

// Schema 类型别名
const patents = schema.patents
const patentDeadlines = schema.patentDeadlines
const patentFees = schema.patentFees
const patentHistory = schema.patentHistory
const notificationConfigs = schema.notificationConfigs
const notificationLogs = schema.notificationLogs

type PatentSchema = typeof schema.patents.$inferSelect
type PatentDeadlineSchema = typeof schema.patentDeadlines.$inferSelect
type PatentFeeSchema = typeof schema.patentFees.$inferSelect
type PatentHistorySchema = typeof schema.patentHistory.$inferSelect
type NotificationConfigSchema = typeof schema.notificationConfigs.$inferSelect
type NotificationLogSchema = typeof schema.notificationLogs.$inferSelect

/**
 * 数据库连接配置
 */
export interface DatabaseConfig {
  /** 数据库连接字符串 */
  connectionString?: string
  /** 是否使用连接池 */
  pool?: boolean
  /** 连接池最大连接数 */
  maxConnections?: number
}

/**
 * 统计数据
 */
export interface Statistics {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
}

/**
 * 专利数据库类
 */
export class PatentDatabase {
  private db: ReturnType<typeof drizzle>
  private client: ReturnType<typeof postgres>
  private connectionString: string

  constructor(config: DatabaseConfig = {}) {
    this.connectionString =
      config.connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://yunpat:yunpat123@localhost:5432/yunpat'

    // 创建 PostgreSQL 客户端
    this.client = postgres(this.connectionString, {
      max: config.maxConnections || 10,
    })

    // 创建 Drizzle 实例 - 正确的方式
    this.db = drizzle(this.client, { schema })
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    await this.client.end()
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client`SELECT 1`
      return true
    } catch {
      return false
    }
  }

  // ==================== 专利操作 ====================

  /**
   * 创建专利记录
   */
  async createPatent(
    patent: Omit<PatentApplication, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PatentApplication> {
    const now = new Date()

    const data = {
      applicationNumber: patent.applicationNumber,
      title: patent.title,
      applicant: patent.applicant,
      inventors: JSON.stringify(patent.inventors),
      patentType: patent.patentType,
      filingDate: patent.filingDate,
      status: patent.status,
      priorityClaims: patent.priorityClaims ? JSON.stringify(patent.priorityClaims) : undefined,
      attorney: patent.attorney,
      classification: patent.classification,
      abstract: patent.abstract,
      description: patent.description,
      claims: patent.claims ? JSON.stringify(patent.claims) : undefined,
      metadata: patent.metadata ? JSON.stringify(patent.metadata) : undefined,
      createdAt: now,
      updatedAt: now,
    }

    const result = await this.db.insert(patents).values(data).returning()

    // 记录历史
    await this.recordHistory(
      patent.applicationNumber,
      'patent_created',
      null,
      data,
      '专利创建',
      undefined
    )

    return this.mapToPatentApplication(result[0])
  }

  /**
   * 获取专利详情
   */
  async getPatent(applicationNumber: string): Promise<PatentApplication | null> {
    const result = await this.db
      .select()
      .from(patents)
      .where(eq(patents.applicationNumber, applicationNumber))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    return this.mapToPatentApplication(result[0])
  }

  /**
   * 根据 ID 获取专利
   */
  async getPatentById(id: number): Promise<PatentApplication | null> {
    const result = await this.db.select().from(patents).where(eq(patents.id, id)).limit(1)

    if (result.length === 0) {
      return null
    }

    return this.mapToPatentApplication(result[0])
  }

  /**
   * 更新专利信息
   */
  async updatePatent(
    applicationNumber: string,
    updates: Partial<
      Omit<PatentApplication, 'id' | 'applicationNumber' | 'createdAt' | 'updatedAt'>
    >
  ): Promise<PatentApplication | null> {
    const existing = await this.getPatent(applicationNumber)
    if (!existing) {
      return null
    }

    const data: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.title !== undefined) data.title = updates.title
    if (updates.applicant !== undefined) data.applicant = updates.applicant
    if (updates.inventors !== undefined) data.inventors = JSON.stringify(updates.inventors)
    if (updates.patentType !== undefined) data.patentType = updates.patentType
    if (updates.filingDate !== undefined) data.filingDate = updates.filingDate
    if (updates.status !== undefined) {
      data.status = updates.status
      // 状态变更记录历史
      await this.recordHistory(
        applicationNumber,
        'status_change',
        existing.status,
        updates.status,
        `状态从 ${existing.status} 变更为 ${updates.status}`,
        undefined
      )
    }
    if (updates.priorityClaims !== undefined)
      data.priorityClaims = JSON.stringify(updates.priorityClaims)
    if (updates.attorney !== undefined) data.attorney = updates.attorney
    if (updates.classification !== undefined) data.classification = updates.classification
    if (updates.abstract !== undefined) data.abstract = updates.abstract
    if (updates.description !== undefined) data.description = updates.description
    if (updates.claims !== undefined) data.claims = JSON.stringify(updates.claims)
    if (updates.metadata !== undefined) data.metadata = JSON.stringify(updates.metadata)

    const result = await this.db
      .update(patents)
      .set(data)
      .where(eq(patents.applicationNumber, applicationNumber))
      .returning()

    if (result.length === 0) {
      return null
    }

    return this.mapToPatentApplication(result[0])
  }

  /**
   * 删除专利
   */
  async deletePatent(applicationNumber: string): Promise<boolean> {
    const result = await this.db
      .delete(patents)
      .where(eq(patents.applicationNumber, applicationNumber))
      .returning()

    return result.length > 0
  }

  /**
   * 查询专利列表
   */
  async queryPatents(
    query: PatentQuery = {}
  ): Promise<{ patents: PatentApplication[]; total: number }> {
    const conditions = []

    if (query.status) {
      conditions.push(eq(patents.status, query.status))
    }

    if (query.patentType) {
      conditions.push(eq(patents.patentType, query.patentType))
    }

    if (query.applicant) {
      conditions.push(sql`${patents.applicant} ILIKE ${`%${query.applicant}%`}`)
    }

    if (query.attorney) {
      conditions.push(sql`${patents.attorney} ILIKE ${`%${query.attorney}%`}`)
    }

    if (query.classification) {
      conditions.push(sql`${patents.classification} ILIKE ${`%${query.classification}%`}`)
    }

    if (query.dateRange) {
      conditions.push(
        and(
          gte(patents.filingDate, query.dateRange.start),
          lte(patents.filingDate, query.dateRange.end)
        ) as any
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // 获取总数
    const { count } = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(patents)
      .where(whereClause)
      .then((r) => r[0] ?? { count: 0 })

    const total = count

    // 获取分页数据
    let queryBuilder = this.db
      .select()
      .from(patents)
      .where(whereClause)
      .orderBy(desc(patents.filingDate))

    if (query.pagination) {
      const offset = (query.pagination.page - 1) * query.pagination.pageSize
      queryBuilder = queryBuilder.limit(query.pagination.pageSize).offset(offset) as any
    } else {
      // 如果没有分页参数，添加默认的 limit 以避免返回过多数据
      queryBuilder = queryBuilder.limit(100) as any
    }

    const results = await queryBuilder

    return {
      patents: results.map((r) => this.mapToPatentApplication(r)),
      total,
    }
  }

  /**
   * 获取专利统计数据
   */
  async getStatistics(): Promise<Statistics> {
    // 总数
    const { count } = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(patents)
      .then((r) => r[0] ?? { count: 0 })

    const total = count

    // 按状态统计
    const byStatusResult = await this.db
      .select({
        status: patents.status,
        count: sql<number>`count(*)::int`,
      })
      .from(patents)
      .groupBy(patents.status)

    const byStatus: Record<string, number> = {}
    for (const row of byStatusResult) {
      byStatus[row.status] = row.count
    }

    // 按类型统计
    const byTypeResult = await this.db
      .select({
        type: patents.patentType,
        count: sql<number>`count(*)::int`,
      })
      .from(patents)
      .groupBy(patents.patentType)

    const byType: Record<string, number> = {}
    for (const row of byTypeResult) {
      byType[row.type] = row.count
    }

    return { total, byStatus, byType }
  }

  // ==================== 截止日期操作 ====================

  /**
   * 添加截止日期
   */
  async addDeadline(
    deadline: Omit<PatentDeadline, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PatentDeadline> {
    const now = new Date()

    const data = {
      applicationNumber: deadline.applicationNumber,
      type: deadline.type,
      deadlineDate: deadline.deadlineDate,
      description: deadline.description,
      priority: deadline.priority,
      completed: deadline.completed,
      completedAt: deadline.completedAt,
      reminderDate: deadline.reminderDate,
      reminderSent: deadline.reminderSent ?? false,
      notes: deadline.notes,
      createdAt: now,
      updatedAt: now,
    }

    const result = await this.db.insert(patentDeadlines).values(data).returning()

    // 记录历史
    await this.recordHistory(
      deadline.applicationNumber,
      'deadline_added',
      null,
      data,
      `添加截止日期: ${deadline.description}`,
      undefined
    )

    return this.mapToPatentDeadline(result[0])
  }

  /**
   * 获取专利的所有截止日期
   */
  async getDeadlines(applicationNumber: string): Promise<PatentDeadline[]> {
    const results = await this.db
      .select()
      .from(patentDeadlines)
      .where(eq(patentDeadlines.applicationNumber, applicationNumber))
      .orderBy(asc(patentDeadlines.deadlineDate))

    return results.map((r) => this.mapToPatentDeadline(r))
  }

  /**
   * 获取即将到期的截止日期
   */
  async getUpcomingDeadlines(days: number = 30): Promise<PatentDeadline[]> {
    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const results = await this.db
      .select()
      .from(patentDeadlines)
      .where(
        and(
          eq(patentDeadlines.completed, false),
          gte(patentDeadlines.deadlineDate, now),
          lte(patentDeadlines.deadlineDate, futureDate)
        )
      )
      .orderBy(asc(patentDeadlines.deadlineDate))

    return results.map((r) => this.mapToPatentDeadline(r))
  }

  /**
   * 更新截止日期
   */
  async updateDeadline(
    id: number,
    updates: Partial<Omit<PatentDeadline, 'id' | 'applicationNumber' | 'createdAt' | 'updatedAt'>>
  ): Promise<PatentDeadline | null> {
    const data: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.type !== undefined) data.type = updates.type
    if (updates.deadlineDate !== undefined) data.deadlineDate = updates.deadlineDate
    if (updates.description !== undefined) data.description = updates.description
    if (updates.priority !== undefined) data.priority = updates.priority
    if (updates.completed !== undefined) {
      data.completed = updates.completed
      data.completedAt = updates.completed ? new Date() : undefined
    }
    if (updates.reminderDate !== undefined) data.reminderDate = updates.reminderDate
    if (updates.reminderSent !== undefined) data.reminderSent = updates.reminderSent
    if (updates.notes !== undefined) data.notes = updates.notes

    const result = await this.db
      .update(patentDeadlines)
      .set(data)
      .where(eq(patentDeadlines.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    return this.mapToPatentDeadline(result[0])
  }

  /**
   * 标记截止日期为已完成
   */
  async completeDeadline(id: number): Promise<PatentDeadline | null> {
    const result = await this.db
      .update(patentDeadlines)
      .set({
        completed: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(patentDeadlines.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    const deadline = this.mapToPatentDeadline(result[0])

    // 记录历史
    await this.recordHistory(
      deadline.applicationNumber,
      'deadline_completed',
      null,
      deadline,
      `完成截止日期: ${deadline.description}`,
      undefined
    )

    return deadline
  }

  /**
   * 删除截止日期
   */
  async deleteDeadline(id: number): Promise<boolean> {
    const result = await this.db
      .delete(patentDeadlines)
      .where(eq(patentDeadlines.id, id))
      .returning()

    return result.length > 0
  }

  // ==================== 费用操作 ====================

  /**
   * 添加费用记录
   */
  async addFee(fee: Omit<PatentFee, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatentFee> {
    const now = new Date()

    const data = {
      applicationNumber: fee.applicationNumber,
      feeType: fee.feeType,
      amount: String(fee.amount),
      currency: fee.currency,
      dueDate: fee.dueDate,
      status: fee.status,
      paymentDate: fee.paymentDate,
      paymentReference: fee.paymentReference,
      notes: fee.notes,
      metadata: fee.metadata ? JSON.stringify(fee.metadata) : undefined,
      createdAt: now,
      updatedAt: now,
    }

    const result = await this.db.insert(patentFees).values(data).returning()

    // 记录历史
    await this.recordHistory(
      fee.applicationNumber,
      'fee_added',
      null,
      data,
      `添加费用: ${fee.feeType} - ${fee.amount} ${fee.currency}`,
      undefined
    )

    return this.mapToPatentFee(result[0])
  }

  /**
   * 获取专利的所有费用
   */
  async getFees(applicationNumber: string): Promise<PatentFee[]> {
    const results = await this.db
      .select()
      .from(patentFees)
      .where(eq(patentFees.applicationNumber, applicationNumber))
      .orderBy(asc(patentFees.dueDate))

    return results.map((r) => this.mapToPatentFee(r))
  }

  /**
   * 获取待支付费用
   */
  async getPendingFees(): Promise<PatentFee[]> {
    const now = new Date()

    const results = await this.db
      .select()
      .from(patentFees)
      .where(and(eq(patentFees.status, 'pending'), lte(patentFees.dueDate, now)))
      .orderBy(asc(patentFees.dueDate))

    return results.map((r) => this.mapToPatentFee(r))
  }

  /**
   * 获取逾期费用
   */
  async getOverdueFees(): Promise<PatentFee[]> {
    const now = new Date()

    const results = await this.db
      .select()
      .from(patentFees)
      .where(and(eq(patentFees.status, 'pending'), lte(patentFees.dueDate, now)))
      .orderBy(asc(patentFees.dueDate))

    return results.map((r) => this.mapToPatentFee(r))
  }

  /**
   * 更新费用
   */
  async updateFee(
    id: number,
    updates: Partial<Omit<PatentFee, 'id' | 'applicationNumber' | 'createdAt' | 'updatedAt'>>
  ): Promise<PatentFee | null> {
    const data: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.feeType !== undefined) data.feeType = updates.feeType
    if (updates.amount !== undefined) data.amount = String(updates.amount)
    if (updates.currency !== undefined) data.currency = updates.currency
    if (updates.dueDate !== undefined) data.dueDate = updates.dueDate
    if (updates.status !== undefined) {
      data.status = updates.status
      if (updates.status === 'paid') {
        data.paymentDate = new Date()
      }
    }
    if (updates.paymentReference !== undefined) data.paymentReference = updates.paymentReference
    if (updates.notes !== undefined) data.notes = updates.notes
    if (updates.metadata !== undefined) data.metadata = JSON.stringify(updates.metadata)

    const result = await this.db
      .update(patentFees)
      .set(data)
      .where(eq(patentFees.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    return this.mapToPatentFee(result[0])
  }

  /**
   * 标记费用为已支付
   */
  async markFeePaid(id: number, paymentReference?: string): Promise<PatentFee | null> {
    const result = await this.db
      .update(patentFees)
      .set({
        status: 'paid',
        paymentDate: new Date(),
        paymentReference: paymentReference,
        updatedAt: new Date(),
      })
      .where(eq(patentFees.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    const fee = this.mapToPatentFee(result[0])

    // 记录历史
    await this.recordHistory(
      fee.applicationNumber,
      'fee_paid',
      null,
      fee,
      `费用已支付: ${fee.feeType} - ${fee.amount} ${fee.currency}`,
      undefined
    )

    return fee
  }

  /**
   * 删除费用
   */
  async deleteFee(id: number): Promise<boolean> {
    const result = await this.db.delete(patentFees).where(eq(patentFees.id, id)).returning()

    return result.length > 0
  }

  // ==================== 历史记录操作 ====================

  /**
   * 记录历史
   */
  async recordHistory(
    applicationNumber: string,
    eventType: HistoryEventType,
    previousValue: unknown,
    newValue: unknown,
    description: string,
    userId?: string
  ): Promise<void> {
    await this.db.insert(patentHistory).values({
      applicationNumber,
      eventType,
      previousValue: previousValue ? JSON.stringify(previousValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      description,
      userId: userId ?? null,
    })
  }

  /**
   * 获取专利历史
   */
  async getHistory(applicationNumber: string, limit: number = 100): Promise<PatentHistory[]> {
    const results = await this.db
      .select()
      .from(patentHistory)
      .where(eq(patentHistory.applicationNumber, applicationNumber))
      .orderBy(desc(patentHistory.createdAt))
      .limit(limit)

    return results.map((r) => this.mapToPatentHistory(r))
  }

  // ==================== 通知配置操作 ====================

  /**
   * 添加通知配置
   */
  async addNotificationConfig(
    config: Omit<NotificationConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<NotificationConfig> {
    const now = new Date()

    const data = {
      name: config.name,
      type: config.type,
      config: JSON.stringify(config.config),
      enabled: config.enabled,
      events: JSON.stringify(config.events),
      metadata: config.metadata ? JSON.stringify(config.metadata) : null,
      createdAt: now,
      updatedAt: now,
    }

    const result = await this.db.insert(notificationConfigs).values(data).returning()

    return this.mapToNotificationConfig(result[0])
  }

  /**
   * 获取通知配置
   */
  async getNotificationConfig(id: number): Promise<NotificationConfig | null> {
    const result = await this.db
      .select()
      .from(notificationConfigs)
      .where(eq(notificationConfigs.id, id))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    return this.mapToNotificationConfig(result[0])
  }

  /**
   * 获取所有启用的通知配置
   */
  async getEnabledNotificationConfigs(): Promise<NotificationConfig[]> {
    const results = await this.db
      .select()
      .from(notificationConfigs)
      .where(eq(notificationConfigs.enabled, true))

    return results.map((r) => this.mapToNotificationConfig(r))
  }

  /**
   * 更新通知配置
   */
  async updateNotificationConfig(
    id: number,
    updates: Partial<Omit<NotificationConfig, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<NotificationConfig | null> {
    const data: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.name !== undefined) data.name = updates.name
    if (updates.type !== undefined) data.type = updates.type
    if (updates.config !== undefined) data.config = JSON.stringify(updates.config)
    if (updates.enabled !== undefined) data.enabled = updates.enabled
    if (updates.events !== undefined) data.events = JSON.stringify(updates.events)
    if (updates.metadata !== undefined) data.metadata = JSON.stringify(updates.metadata)

    const result = await this.db
      .update(notificationConfigs)
      .set(data)
      .where(eq(notificationConfigs.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    return this.mapToNotificationConfig(result[0])
  }

  /**
   * 删除通知配置
   */
  async deleteNotificationConfig(id: number): Promise<boolean> {
    const result = await this.db
      .delete(notificationConfigs)
      .where(eq(notificationConfigs.id, id))
      .returning()

    return result.length > 0
  }

  // ==================== 通知日志操作 ====================

  /**
   * 添加通知日志
   */
  async addNotificationLog(
    log: Omit<NotificationLog, 'id' | 'createdAt'>
  ): Promise<NotificationLog> {
    const data = {
      configId: log.configId,
      type: log.type,
      event: log.event,
      recipient: log.recipient,
      subject: log.subject,
      content: log.content,
      status: log.status,
      errorMessage: log.errorMessage,
      retryCount: log.retryCount,
      sentAt: log.sentAt,
      metadata: log.metadata ? JSON.stringify(log.metadata) : undefined,
    }

    const result = await this.db.insert(notificationLogs).values(data).returning()

    return this.mapToNotificationLog(result[0])
  }

  /**
   * 获取通知日志
   */
  async getNotificationLogs(filters?: {
    event?: string
    status?: string
    recipient?: string
    limit?: number
  }): Promise<NotificationLog[]> {
    const conditions = []

    if (filters?.event) {
      conditions.push(eq(notificationLogs.event, filters.event as any))
    }

    if (filters?.status) {
      conditions.push(eq(notificationLogs.status, filters.status as any))
    }

    if (filters?.recipient) {
      conditions.push(sql`${notificationLogs.recipient} ILIKE ${`%${filters.recipient}%`}`)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    let queryBuilder = this.db
      .select()
      .from(notificationLogs)
      .where(whereClause)
      .orderBy(desc(notificationLogs.createdAt))

    if (filters?.limit) {
      queryBuilder = queryBuilder.limit(filters.limit) as any
    } else {
      // 默认限制返回 100 条记录
      queryBuilder = queryBuilder.limit(100) as any
    }

    const results = await queryBuilder

    return results.map((r) => this.mapToNotificationLog(r))
  }

  // ==================== 映射方法 ====================

  private mapToPatentApplication(row: PatentSchema): PatentApplication {
    return {
      id: row.id,
      applicationNumber: row.applicationNumber,
      title: row.title,
      applicant: row.applicant,
      inventors: JSON.parse(row.inventors),
      patentType: row.patentType,
      filingDate: row.filingDate,
      status: row.status,
      priorityClaims: row.priorityClaims ? JSON.parse(row.priorityClaims) : undefined,
      attorney: row.attorney ?? undefined,
      classification: row.classification ?? undefined,
      abstract: row.abstract ?? undefined,
      description: row.description ?? undefined,
      claims: row.claims ? JSON.parse(row.claims) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    }
  }

  private mapToPatentDeadline(row: PatentDeadlineSchema): PatentDeadline {
    return {
      id: row.id,
      applicationNumber: row.applicationNumber,
      type: row.type,
      deadlineDate: row.deadlineDate,
      description: row.description,
      priority: row.priority as DeadlinePriority,
      completed: row.completed,
      completedAt: row.completedAt || undefined,
      reminderDate: row.reminderDate || undefined,
      reminderSent: row.reminderSent,
      notes: row.notes || undefined,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    }
  }

  private mapToPatentFee(row: PatentFeeSchema): PatentFee {
    return {
      id: row.id,
      applicationNumber: row.applicationNumber,
      feeType: row.feeType,
      amount: parseFloat(row.amount),
      currency: row.currency,
      dueDate: row.dueDate,
      status: row.status,
      paymentDate: row.paymentDate || undefined,
      paymentReference: row.paymentReference || undefined,
      notes: row.notes || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    }
  }

  private mapToPatentHistory(row: PatentHistorySchema): PatentHistory {
    return {
      id: row.id,
      applicationNumber: row.applicationNumber,
      eventType: row.eventType as HistoryEventType,
      previousValue: row.previousValue ? JSON.parse(row.previousValue) : undefined,
      newValue: row.newValue ? JSON.parse(row.newValue) : undefined,
      description: row.description,
      userId: row.userId || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.createdAt as Date,
    }
  }

  private mapToNotificationConfig(row: NotificationConfigSchema): NotificationConfig {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      config: JSON.parse(row.config),
      enabled: row.enabled,
      events: JSON.parse(row.events),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    }
  }

  private mapToNotificationLog(row: NotificationLogSchema): NotificationLog {
    return {
      id: row.id,
      configId: row.configId || undefined,
      type: row.type,
      event: row.event as NotificationEvent,
      recipient: row.recipient,
      subject: row.subject || undefined,
      content: row.content,
      status: row.status,
      errorMessage: row.errorMessage || undefined,
      retryCount: row.retryCount,
      sentAt: row.sentAt || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.createdAt as Date,
    }
  }
}

/**
 * 默认数据库实例（单例）
 */
let defaultdDbInstance: PatentDatabase | null = null

export function getDefaultDatabase(): PatentDatabase {
  if (!defaultdDbInstance) {
    defaultdDbInstance = new PatentDatabase()
  }
  return defaultdDbInstance
}
