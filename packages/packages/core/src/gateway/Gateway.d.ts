/**
 * 交互层 (Gateway / Interface)
 *
 * 负责 Agent 与外部世界的接口
 * - 多模态输入：文本、语音、图像、视频、文件
 * - 人机协同 (HITL)：审批节点、反馈回路、人工接管
 * - 安全网关：身份认证、权限控制、审计日志
 */
import {
  ApiKeyManager,
  JwtManager,
  OAuthManager,
  SessionManager,
  type AuthorizationUrlResult,
  type OAuthCallbackResult,
} from './auth/index.js'
import { ContentModerationService } from './ContentModerationService.js'
/**
 * 输入源类型
 */
export declare enum InputSourceType {
  /** 文本 */
  TEXT = 'text',
  /** 语音 */
  VOICE = 'voice',
  /** 图像 */
  IMAGE = 'image',
  /** 视频 */
  VIDEO = 'video',
  /** 文件 */
  FILE = 'file',
  /** API 调用 */
  API = 'api',
  /** 命令行 */
  CLI = 'cli',
  /** WebSocket */
  WEBSOCKET = 'websocket',
}
/**
 * 多模态输入
 */
export interface MultimodalInput {
  /** 输入源类型 */
  sourceType: InputSourceType
  /** 主内容（文本） */
  text?: string
  /** 语音数据 */
  audio?: {
    data: ArrayBuffer
    format: 'mp3' | 'wav' | 'ogg'
    duration?: number
  }
  /** 图像数据 */
  image?: {
    data: ArrayBuffer
    format: 'png' | 'jpg' | 'webp'
    width?: number
    height?: number
  }
  /** 视频数据 */
  video?: {
    data: ArrayBuffer
    format: 'mp4' | 'webm'
    duration?: number
  }
  /** 文件数据 */
  file?: {
    name: string
    data: ArrayBuffer
    mimeType: string
    size: number
  }
  /** 元数据 */
  metadata?: {
    timestamp: Date
    userId?: string
    sessionId?: string
    tags?: string[]
  }
}
/**
 * 输出目标类型 */
export declare enum OutputTargetType {
  /** 终端输出 */
  TERMINAL = 'terminal',
  /** HTTP 响应 */
  HTTP = 'http',
  /** WebSocket */
  WEBSOCKET = 'websocket',
  /** 文件 */
  FILE = 'file',
  /** 数据库 */
  DATABASE = 'database',
}
/**
 * 多模态输出
 */
export interface MultimodalOutput {
  /** 输出目标类型 */
  targetType: OutputTargetType
  /** 文本内容 */
  text?: string
  /** 是否流式输出 */
  stream?: boolean
  /** 附加数据 */
  attachments?: Array<{
    type: 'image' | 'file' | 'audio'
    data: ArrayBuffer
    metadata?: Record<string, unknown>
  }>
  /** 元数据 */
  metadata?: {
    timestamp: Date
    contentType: string
    tokens?: number
    cost?: number
  }
}
/**
 * 人机协同审批结果
 */
export interface HumanApproval {
  /** 是否批准 */
  approved: boolean
  /** 审批意见 */
  feedback?: string
  /** 修改建议 */
  suggestions?: string[]
  /** 审批时间 */
  timestamp: Date
  /** 审批人 */
  userId: string
}
/**
 * 审批请求
 */
export interface ApprovalRequest {
  /** 请求 ID */
  requestId: string
  /** 智能体名称 */
  agentName: string
  /** 需要审批的内容 */
  content: {
    type: 'action' | 'output' | 'plan'
    data: unknown
  }
  /** 上下文信息 */
  context: {
    goal: string
    reasoning: string
    alternatives?: string[]
  }
  /** 超时时间（毫秒） */
  timeout?: number
  /** 审批级别 */
  level: 'info' | 'warning' | 'critical'
}
/**
 * 身份认证结果
 */
export interface AuthResult {
  /** 是否认证成功 */
  success: boolean
  /** 用户 ID */
  userId?: string
  /** 用户角色 */
  roles?: string[]
  /** 权限列表 */
  permissions?: string[]
  /** Token */
  token?: string
  /** 过期时间 */
  expiresAt?: Date
  /** 错误信息 */
  error?: string
}
/**
 * 凭证
 */
export interface Credentials {
  /** 认证类型 */
  type: 'apikey' | 'jwt' | 'oauth' | 'basic'
  /** 凭证数据 */
  data: {
    apiKey?: string
    token?: string
    username?: string
    password?: string
    /** OAuth 提供商 */
    provider?: 'google' | 'github'
    /** OAuth 授权码 */
    code?: string
    /** OAuth State */
    state?: string
    /** OAuth 重定向 URI */
    redirectUri?: string
  }
}
/**
 * 权限
 */
export interface Permission {
  /** 资源 */
  resource: string
  /** 操作 */
  action: 'read' | 'write' | 'execute' | 'admin' | '*'
  /** 作用域 */
  scope?: string[]
}
/**
 * 动作
 */
export interface Action {
  /** 动作类型 */
  type: string
  /** 目标资源 */
  resource?: string
  /** 操作 */
  action?: 'read' | 'write' | 'execute' | 'admin' | '*'
}
/**
 * 安全网关配置
 */
export interface SecurityGatewayConfig {
  /** 是否启用认证 */
  enableAuth: boolean
  /** 是否启用权限控制 */
  enableAuthorization: boolean
  /** 是否启用内容过滤 */
  enableContentFilter: boolean
  /** 是否启用审计日志 */
  enableAudit: boolean
  /** 内容过滤规则 */
  contentFilterRules?: ContentFilterRule[]
  /** ML 内容审核服务（可选） */
  mlModerationService?: ContentModerationService
  /** 审计日志存储 */
  auditLogStore?: AuditLogStore
  /** API Key 管理器（可选） */
  apiKeyManager?: ApiKeyManager
  /** JWT 管理器（可选） */
  jwtManager?: JwtManager
  /** 会话管理器（可选） */
  sessionManager?: SessionManager
  /** OAuth 管理器（可选） */
  oauthManager?: OAuthManager
}
/**
 * 内容过滤规则
 */
export interface ContentFilterRule {
  /** 规则名称 */
  name: string
  /** 规则类型 */
  type: 'keyword' | 'pattern' | 'ml'
  /** 规则内容
   * - keyword: 字符串
   * - pattern: 正则表达式字符串或 RegExp 对象
   * - ml: 模型名称或配置
   */
  content: string | RegExp
  /** 正则表达式标志（仅当 type 为 'pattern' 且 content 为字符串时使用） */
  flags?: 'i' | 'g' | 'm' | 's' | string
  /** 动作 */
  action: 'block' | 'flag' | 'sanitize'
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high'
}
/**
 * 审计日志
 */
export interface AuditLog {
  /** 时间戳 */
  timestamp: Date
  /** 用户 ID */
  userId?: string
  /** 智能体名称 */
  agentName?: string
  /** 动作 */
  action: string
  /** 资源 */
  resource?: string
  /** 结果 */
  result: 'success' | 'failure' | 'blocked'
  /** 详情 */
  details?: Record<string, unknown>
  /** IP 地址 */
  ipAddress?: string
}
/**
 * 审计日志存储接口
 */
export interface AuditLogStore {
  /** 写入日志 */
  write(log: AuditLog): Promise<void>
  /** 查询日志 */
  query(filter: AuditLogFilter): Promise<AuditLog[]>
  /** 统计 */
  stats(metrics: AuditMetrics): Promise<Record<string, number>>
}
/**
 * 审计日志过滤器
 */
export interface AuditLogFilter {
  /** 时间范围 */
  timeRange?: {
    start: Date
    end: Date
  }
  /** 用户 ID */
  userId?: string
  /** 智能体名称 */
  agentName?: string
  /** 动作 */
  action?: string
  /** 结果 */
  result?: 'success' | 'failure' | 'blocked'
}
/**
 * 审计指标
 */
export interface AuditMetrics {
  /** 按动作统计 */
  byAction?: boolean
  /** 按用户统计 */
  byUser?: boolean
  /** 按智能体统计 */
  byAgent?: boolean
  /** 按结果统计 */
  byResult?: boolean
}
/**
 * Gateway 接口
 */
export interface Gateway {
  /**
   * 接收输入
   */
  receiveInput(source: InputSourceType): Promise<MultimodalInput>
  /**
   * 发送输出
   */
  sendOutput(output: MultimodalOutput, target: OutputTargetType): Promise<void>
  /**
   * 请求人工审批
   */
  requestHumanApproval(request: ApprovalRequest): Promise<HumanApproval>
  /**
   * 身份认证
   */
  authenticate(credentials: Credentials): Promise<AuthResult>
  /**
   * 权限检查
   */
  authorize(
    action: Action,
    permissions: Permission[]
  ): Promise<{
    authorized: boolean
    reason?: string
  }>
  /**
   * 内容过滤
   */
  filterContent(content: string): Promise<{
    filtered: boolean
    reason?: string
  }>
  /**
   * 写入审计日志
   */
  writeAuditLog(log: AuditLog): Promise<void>
}
/**
 * 基础 Gateway 实现
 */
export declare class BaseGateway implements Gateway {
  private config
  private auditStore?
  private apiKeyManager?
  private jwtManager?
  private sessionManager?
  private oauthManager?
  private mlModerationService?
  constructor(config: SecurityGatewayConfig)
  receiveInput(source: InputSourceType): Promise<MultimodalInput>
  sendOutput(output: MultimodalOutput, target: OutputTargetType): Promise<void>
  requestHumanApproval(request: ApprovalRequest): Promise<HumanApproval>
  authenticate(credentials: Credentials): Promise<AuthResult>
  authorize(
    action: Action,
    permissions: Permission[]
  ): Promise<{
    authorized: boolean
    reason?: string
  }>
  filterContent(content: string): Promise<{
    filtered: boolean
    reason?: string
    matchedRule?: string
  }>
  writeAuditLog(log: AuditLog): Promise<void>
  /**
   * 生成 OAuth 授权 URL
   *
   * @param provider OAuth 提供商
   * @param redirectUri 重定向 URI
   * @param scope 授权范围（可选）
   * @returns 授权 URL 和 State
   */
  generateOAuthAuthorizationUrl(
    provider: 'google' | 'github',
    redirectUri: string,
    scope?: string[]
  ): Promise<AuthorizationUrlResult>
  /**
   * 处理 OAuth 回调
   *
   * @param provider OAuth 提供商
   * @param code 授权码
   * @param state State 参数
   * @param redirectUri 重定向 URI
   * @returns OAuth 回调结果
   */
  handleOAuthCallback(
    provider: 'google' | 'github',
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult>
  /**
   * 刷新 OAuth Token
   *
   * @param provider OAuth 提供商
   * @param refreshToken 刷新令牌
   * @returns 新的 Token
   */
  refreshOAuthToken(
    provider: 'google' | 'github',
    refreshToken: string
  ): Promise<import('./auth/index.js').OAuthToken>
  /**
   * 验证 OAuth Token
   *
   * @param provider OAuth 提供商
   * @param accessToken 访问令牌
   * @returns Token 是否有效
   */
  verifyOAuthToken(provider: 'google' | 'github', accessToken: string): Promise<boolean>
  /**
   * 获取 OAuth 用户信息
   *
   * @param provider OAuth 提供商
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  getOAuthUserInfo(
    provider: 'google' | 'github',
    accessToken: string
  ): Promise<import('./auth/index.js').OAuthUserInfo>
}
//# sourceMappingURL=Gateway.d.ts.map
