/**
 * 专利管理相关类型定义
 */

/**
 * 专利类型
 */
export type PatentType = 'invention' | 'utility' | 'design'

/**
 * 专利状态
 */
export type PatentStatus =
  | 'draft'
  | 'filed'
  | 'under_exam'
  | 'oa_issued'
  | 'amended'
  | 'allowed'
  | 'granted'
  | 'rejected'
  | 'abandoned'
  | 'expired'
  | 'withdrawn'

/**
 * 优先权声明
 */
export interface PriorityClaim {
  country: string
  applicationNumber: string
  filingDate: Date
}

/**
 * 专利申请信息
 */
export interface PatentApplication {
  /** 数据库ID */
  id?: number
  /** 申请号 */
  applicationNumber: string
  /** 专利标题 */
  title: string
  /** 申请人 */
  applicant: string
  /** 发明人列表 */
  inventors: string[]
  /** 专利类型 */
  patentType: PatentType
  /** 申请日 */
  filingDate: Date
  /** 当前状态 */
  status: PatentStatus
  /** 优先权信息 */
  priorityClaims?: PriorityClaim[]
  /** 代理机构 */
  attorney?: string
  /** 分类号 */
  classification?: string
  /** 摘要 */
  abstract?: string
  /** 描述 */
  description?: string
  /** 权利要求 */
  claims?: string[]
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt?: Date
  /** 更新时间 */
  updatedAt?: Date
}

/**
 * 截止日期类型
 */
export type DeadlineType =
  | 'oa_response'
  | 'renewal_fee'
  | 'publication_fee'
  | 'examination_fee'
  | 'appeal_deadline'
  | 'priority_claim'
  | 'other'

/**
 * 截止日期优先级
 */
export type DeadlinePriority = 'high' | 'medium' | 'low'

/**
 * 专利截止日期
 */
export interface PatentDeadline {
  /** 数据库ID */
  id?: number
  /** 申请号 */
  applicationNumber: string
  /** 截止日期类型 */
  type: DeadlineType
  /** 截止日期 */
  deadlineDate: Date
  /** 描述 */
  description: string
  /** 优先级 */
  priority: DeadlinePriority
  /** 是否已完成 */
  completed: boolean
  /** 完成时间 */
  completedAt?: Date
  /** 提醒日期 */
  reminderDate?: Date
  /** 提醒是否已发送 */
  reminderSent?: boolean
  /** 备注 */
  notes?: string
  /** 创建时间 */
  createdAt?: Date
  /** 更新时间 */
  updatedAt?: Date
}

/**
 * 费用状态
 */
export type FeeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

/**
 * 专利费用
 */
export interface PatentFee {
  /** 数据库ID */
  id?: number
  /** 申请号 */
  applicationNumber: string
  /** 费用类型 */
  feeType: string
  /** 金额 */
  amount: number
  /** 货币 */
  currency: string
  /** 到期日 */
  dueDate: Date
  /** 支付状态 */
  status: FeeStatus
  /** 支付日期 */
  paymentDate?: Date
  /** 支付参考号 */
  paymentReference?: string
  /** 备注 */
  notes?: string
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt?: Date
  /** 更新时间 */
  updatedAt?: Date
}

/**
 * 专利历史事件类型
 */
export type HistoryEventType =
  | 'status_change'
  | 'deadline_added'
  | 'deadline_updated'
  | 'deadline_completed'
  | 'fee_added'
  | 'fee_updated'
  | 'fee_paid'
  | 'patent_created'
  | 'patent_updated'
  | 'patent_deleted'

/**
 * 专利历史记录
 */
export interface PatentHistory {
  /** 数据库ID */
  id?: number
  /** 申请号 */
  applicationNumber: string
  /** 事件类型 */
  eventType: HistoryEventType
  /** 之前的值 */
  previousValue?: unknown
  /** 新的值 */
  newValue?: unknown
  /** 描述 */
  description: string
  /** 操作人ID */
  userId?: string
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt?: Date
}

/**
 * 通知类型
 */
export type NotificationType = 'email' | 'webhook' | 'sms' | 'system'

/**
 * 通知状态
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

/**
 * 通知事件
 */
export type NotificationEvent =
  | 'deadline_approaching'
  | 'deadline_overdue'
  | 'fee_due'
  | 'fee_overdue'
  | 'status_changed'
  | 'oa_issued'
  | 'patent_granted'
  | 'patent_rejected'

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 数据库ID */
  id?: number
  /** 配置名称 */
  name: string
  /** 通知类型 */
  type: NotificationType
  /** 配置内容（JSON） */
  config: Record<string, unknown>
  /** 是否启用 */
  enabled: boolean
  /** 监听的事件列表 */
  events: NotificationEvent[]
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt?: Date
  /** 更新时间 */
  updatedAt?: Date
}

/**
 * 通知日志
 */
export interface NotificationLog {
  /** 数据库ID */
  id?: number
  /** 配置ID */
  configId?: number
  /** 通知类型 */
  type: NotificationType
  /** 事件 */
  event: NotificationEvent
  /** 接收者 */
  recipient: string
  /** 主题 */
  subject?: string
  /** 内容 */
  content: string
  /** 状态 */
  status: NotificationStatus
  /** 错误信息 */
  errorMessage?: string
  /** 重试次数 */
  retryCount: number
  /** 发送时间 */
  sentAt?: Date
  /** 额外元数据 */
  metadata?: Record<string, unknown>
  /** 创建时间 */
  createdAt?: Date
}

/**
 * 专利组合统计
 */
export interface PortfolioStatistics {
  /** 总数 */
  total: number
  /** 按状态分组 */
  byStatus: Record<PatentStatus, number>
  /** 按类型分组 */
  byType: Record<PatentType, number>
  /** 即将到期的截止日期数量 */
  upcomingDeadlines: number
  /** 待支付费用数量 */
  pendingFees: number
  /** 逾期费用数量 */
  overdueFees: number
}

/**
 * 专利组合
 */
export interface PatentPortfolio {
  /** 专利列表 */
  patents: PatentApplication[]
  /** 统计信息 */
  statistics: PortfolioStatistics
  /** 风险提示 */
  riskAlerts: string[]
}

/**
 * 管理操作类型
 */
export type ManagerOperation =
  | 'add_patent'
  | 'update_patent'
  | 'remove_patent'
  | 'get_patent'
  | 'list_patents'
  | 'add_deadline'
  | 'update_deadline'
  | 'get_upcoming_deadlines'
  | 'add_fee'
  | 'update_fee'
  | 'get_pending_fees'
  | 'get_portfolio'
  | 'change_status'
  | 'generate_report'

/**
 * 专利管理输入
 */
export interface PatentManagerInput {
  /** 操作类型 */
  operation: ManagerOperation
  /** 专利信息（添加/更新时使用） */
  patent?: PatentApplication
  /** 申请号（查询/删除时使用） */
  applicationNumber?: string
  /** 截止日期信息（添加截止日期时使用） */
  deadline?: Omit<PatentDeadline, 'applicationNumber' | 'id' | 'createdAt' | 'updatedAt'> & {
    id?: number
  }
  /** 费用信息（添加费用时使用） */
  fee?: Omit<PatentFee, 'applicationNumber' | 'id' | 'createdAt' | 'updatedAt'> & { id?: number }
  /** 查询条件 */
  query?: {
    status?: PatentStatus
    patentType?: PatentApplication['patentType']
    dateRange?: { start: Date; end: Date }
  }
  /** 新状态（状态变更时使用） */
  newStatus?: PatentStatus
  /** 天数（获取即将到期截止日期时使用） */
  days?: number
}

/**
 * 专利管理输出
 */
export interface PatentManagerOutput {
  /** 操作结果 */
  success: boolean
  /** 返回数据 */
  data?: any
  /** 错误信息 */
  error?: string
  /** 元数据 */
  metadata?: {
    operation: ManagerOperation
    timestamp: Date
    processingTime: number
  }
}

/**
 * 专利管理智能体配置
 */
export interface PatentManagerConfig {
  /** 数据库实例（可选，不提供则创建默认实例） */
  database?: any
  /** 状态机实例（可选，不提供则创建默认实例） */
  stateMachine?: any
  /** 通知服务实例（可选，不提供则创建默认实例） */
  notificationService?: any
  /** 是否启用自动通知 */
  enableNotifications?: boolean
}

/**
 * 状态转换结果
 */
export interface StateTransitionResult {
  /** 是否成功 */
  success: boolean
  /** 新状态 */
  newState?: PatentStatus
  /** 错误信息 */
  error?: string
}

/**
 * 状态转换钩子函数类型
 */
export type StateTransitionHook = (
  patent: PatentApplication,
  fromState: PatentStatus,
  toState: PatentStatus
) => Promise<void> | void

/**
 * 状态机配置
 */
export interface StateMachineConfig {
  /** 是否允许自动跳过某些状态 */
  allowSkipStates?: boolean
  /** 是否在状态变更时自动记录历史 */
  autoRecordHistory?: boolean
  /** 转换前钩子 */
  beforeTransition?: StateTransitionHook
  /** 转换后钩子 */
  afterTransition?: StateTransitionHook
}

/**
 * 查询条件
 */
export interface PatentQuery {
  /** 状态过滤 */
  status?: PatentStatus
  /** 专利类型过滤 */
  patentType?: PatentType
  /** 日期范围 */
  dateRange?: { start: Date; end: Date }
  /** 申请人 */
  applicant?: string
  /** 发明人 */
  inventor?: string
  /** 代理机构 */
  attorney?: string
  /** 分类号 */
  classification?: string
  /** 分页参数 */
  pagination?: {
    page: number
    pageSize: number
  }
}

/**
 * 状态转换结果
 */
export interface StateTransitionResult {
  /** 是否成功 */
  success: boolean
  /** 新状态 */
  newState?: PatentStatus
  /** 错误信息 */
  error?: string
}
