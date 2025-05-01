/**
 * HTTP 审批服务器
 *
 * 提供 HTTP API 端点用于审批流程
 */
import type { ExecutionContext } from '../../lifecycle/Lifecycle.js'
export interface ApprovalRequest {
  requestId: string
  agentName: string
  content: {
    type: 'action' | 'output' | 'plan'
    data: unknown
  }
  context: {
    goal: string
    reasoning: string
    alternatives?: string[]
  }
  timeout?: number
  level: 'info' | 'warning' | 'critical'
}
export interface ApprovalResponse {
  approvalId: string
  approved: boolean
  feedback?: {
    type: 'approve' | 'correct' | 'reject' | 'supplement'
    content: string
    corrections?: Record<string, unknown>
    supplements?: Record<string, unknown>
    rejectionReason?: string
    timestamp: Date
  }
  timestamp: Date
}
/**
 * HTTP 审批服务器配置
 */
export interface HttpApprovalServerConfig {
  /** 服务器端口 */
  port: number
  /** 服务器主机 */
  host?: string
  /** API 路径前缀 */
  apiPrefix?: string
  /** CORS 允许的源 */
  corsOrigin?: string | string[]
  /** API 认证密钥（可选） */
  apiKey?: string
}
/**
 * 审批状态
 */
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'corrected' | 'supplemented' | 'timeout'
/**
 * 内部审批请求
 */
interface InternalApprovalRequest {
  /** 请求 ID */
  requestId: string
  /** 原始审批请求 */
  request: ApprovalRequest
  /** 执行上下文 */
  context: ExecutionContext
  /** 状态 */
  status: ApprovalStatus
  /** 创建时间 */
  createdAt: Date
  /** 过期时间 */
  expiresAt: Date
  /** 响应（完成时填充） */
  response?: ApprovalResponse
}
/**
 * HTTP 审批服务器
 */
export declare class HttpApprovalServer {
  private app
  private server
  private config
  private pendingApprovals
  private completedApprovals
  private approvalMutexes
  constructor(config: HttpApprovalServerConfig)
  /**
   * 设置中间件
   */
  private setupMiddleware
  /**
   * 设置路由
   */
  private setupRoutes
  /**
   * 处理审批（使用互斥锁防止竞态条件）
   */
  private processApproval
  /**
   * 请求审批
   */
  requestApproval(
    request: ApprovalRequest,
    context: ExecutionContext,
    timeout?: number
  ): Promise<ApprovalResponse>
  /**
   * 启动服务器
   */
  start(): Promise<void>
  /**
   * 停止服务器
   */
  stop(): Promise<void>
  /**
   * 获取已完成的审批
   *
   * @param requestId 审批请求 ID
   * @returns 已完成的审批请求，如果不存在则返回 null
   */
  getCompletedApproval(requestId: string): InternalApprovalRequest | null
  /**
   * 获取所有已完成的审批
   *
   * @returns 已完成的审批请求列表
   */
  getAllCompletedApprovals(): InternalApprovalRequest[]
  /**
   * 清理过期的审批请求
   */
  cleanupExpired(): number
}
export {}
//# sourceMappingURL=HttpApprovalServer.d.ts.map
