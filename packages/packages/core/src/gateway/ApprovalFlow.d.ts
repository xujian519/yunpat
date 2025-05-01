/**
 * 人机协同审批流程 (Human-in-the-Loop Approval Flow)
 *
 * 实现用户反馈循环机制，核心功能：
 * 1. 审批请求生成（清晰展示结果、标注疑点）
 * 2. 多模式审批（CLI交互、HTTP API、WebSocket）
 * 3. 反馈收集（修正、补充、拒绝）
 * 4. 反馈学习（更新模板、调整策略）
 */
import type { ExecutionContext } from '../lifecycle/Lifecycle.js'
import type { EventBus } from '../eventbus/EventBus.js'
/**
 * 审批响应
 */
export interface ApprovalResponse {
  /** 审批ID */
  approvalId: string
  /** 是否批准 */
  approved: boolean
  /** 用户反馈 */
  feedback?: UserFeedback
  /** 审批时间 */
  timestamp: Date
}
/**
 * 用户反馈
 */
export interface UserFeedback {
  /** 反馈类型 */
  type: 'approve' | 'correct' | 'reject' | 'supplement'
  /** 反馈内容 */
  content: string
  /** 修正数据（当type=correct时） */
  corrections?: Record<string, unknown>
  /** 补充信息（当type=supplement时） */
  supplements?: Record<string, unknown>
  /** 拒绝原因（当type=reject时） */
  rejectionReason?: string
  /** 反馈时间 */
  timestamp: Date
  /** 用户ID */
  userId?: string
}
/**
 * 展示选项
 */
export interface PresentationOptions {
  /** 展示格式 */
  format: 'json' | 'table' | 'summary'
  /** 是否标注疑点 */
  highlightConcerns: boolean
  /** 疑点列表 */
  concerns?: string[]
  /** 自定义消息 */
  message?: string
}
/**
 * 审批模式
 */
export declare enum ApprovalMode {
  /** CLI交互模式 */
  CLI = 'cli',
  /** HTTP API模式 */
  HTTP = 'http',
  /** WebSocket模式 */
  WEBSOCKET = 'websocket',
}
/**
 * 审批配置
 */
export interface ApprovalFlowConfig {
  /** 审批模式 */
  mode: ApprovalMode
  /** 默认超时时间（毫秒） */
  defaultTimeout: number
  /** 是否启用反馈学习 */
  enableLearning: boolean
  /** 反馈存储路径（可选） */
  feedbackStorePath?: string
  /** HTTP 服务器配置（HTTP 模式时需要） */
  httpServerConfig?: {
    port: number
    host?: string
    apiPrefix?: string
    corsOrigin?: string | string[]
    apiKey?: string
  }
}
/**
 * 反馈统计
 */
export interface FeedbackStats {
  /** 总审批次数 */
  totalApprovals: number
  /** 批准次数 */
  approvedCount: number
  /** 拒绝次数 */
  rejectedCount: number
  /** 修正次数 */
  correctedCount: number
  /** 补充次数 */
  supplementedCount: number
  /** 准确率 */
  accuracy: number
}
/**
 * 审批流程实现
 */
export declare class ApprovalFlow {
  private config
  private eventBus?
  private feedbackHistory
  private stats
  private httpServer?
  constructor(config: ApprovalFlowConfig, eventBus?: EventBus)
  /**
   * 启动审批流程（启动必要的服务）
   */
  start(): Promise<void>
  /**
   * 停止审批流程（清理资源）
   */
  stop(): Promise<void>
  /**
   * 请求审批
   *
   * @param result 结果数据
   * @param context 执行上下文
   * @param timeout 超时时间
   * @returns 审批响应
   */
  requestApproval(
    result: unknown,
    context: ExecutionContext,
    timeout?: number
  ): Promise<ApprovalResponse>
  /**
   * 展示结果供审批
   *
   * @param result 结果数据
   * @param options 展示选项
   */
  presentForApproval(result: unknown, options: PresentationOptions): Promise<void>
  /**
   * 收集反馈
   *
   * @param approvalId 审批ID
   * @returns 用户反馈
   */
  collectFeedback(approvalId: string): Promise<UserFeedback>
  /**
   * 从反馈中学习
   *
   * @param feedback 用户反馈
   */
  learnFromFeedback(feedback: UserFeedback): Promise<void>
  /**
   * 获取统计信息
   *
   * @returns 反馈统计
   */
  getStats(): FeedbackStats
  /**
   * CLI审批模式
   */
  private cliApproval
  /**
   * HTTP审批模式
   */
  private httpApproval
  /**
   * WebSocket审批模式（预留接口）
   */
  private websocketApproval
  /**
   * 收集CLI反馈
   */
  private collectCliFeedback
  /**
   * 收集HTTP反馈
   */
  private collectHttpFeedback
  /**
   * 收集WebSocket反馈（预留）
   */
  private collectWebSocketFeedback
  /**
   * 以表格形式展示结果
   */
  private presentAsTable
  /**
   * 以摘要形式展示结果
   */
  private presentAsSummary
  /**
   * 分析疑点
   */
  private analyzeConcerns
  /**
   * 更新统计信息
   */
  private updateStats
}
//# sourceMappingURL=ApprovalFlow.d.ts.map
