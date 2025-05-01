/**
 * 专利管理智能体 - 主入口
 *
 * 导出专利管理相关的所有类型和类
 */

// ==================== 主智能体 ====================
export { PatentManagerAgent } from './PatentManagerAgent.js'

// ==================== 数据库层 ====================
export { PatentDatabase, getDefaultDatabase } from './database/PatentDatabase.js'

// ==================== 状态机 ====================
export { PatentStateMachine, defaultStateMachine } from './state/PatentStateMachine.js'
export type {
  StateTransitionResult,
  StateMachineConfig,
  StateTransitionHook,
} from './types/PatentTypes.js'

// ==================== 通知服务 ====================
export {
  NotificationService,
  defaultNotificationService,
} from './notifications/NotificationService.js'
export type {
  NotificationResult,
  NotificationServiceConfig,
  EmailSender,
  WebhookSender,
  SmsSender,
  SystemNotifier,
  NotificationTemplateData,
} from './notifications/NotificationService.js'

// ==================== 类型定义 ====================
export type {
  // 专利相关
  PatentType,
  PatentStatus,
  PriorityClaim,
  PatentApplication,

  // 截止日期相关
  DeadlineType,
  DeadlinePriority,
  PatentDeadline,

  // 费用相关
  FeeStatus,
  PatentFee,

  // 历史记录相关
  HistoryEventType,
  PatentHistory,

  // 通知相关
  NotificationType,
  NotificationStatus,
  NotificationEvent,
  NotificationConfig,
  NotificationLog,

  // 组合相关
  PortfolioStatistics,
  PatentPortfolio,

  // 查询相关
  PatentQuery,

  // 智能体相关
  ManagerOperation,
  PatentManagerInput,
  PatentManagerOutput,
  PatentManagerConfig,
} from './types/PatentTypes.js'

// ==================== 兼容旧版本类型 ====================
// 保留旧的类型名称以保持向后兼容
export type {
  PatentStatus as PatentStatusType,
  PatentDeadline as Deadline,
} from './types/PatentTypes.js'
