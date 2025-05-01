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
  BasicAuthProvider,
  type AuthorizationUrlResult,
  type OAuthCallbackResult,
} from './auth/index.js'
import {
  ContentModerationService,
  RuleBasedModerationService,
  type ModerationResult,
} from './ContentModerationService.js'

/**
 * 输入源类型
 */
export enum InputSourceType {
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
export enum OutputTargetType {
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

  /** Basic 认证提供者（可选） */
  basicAuthProvider?: BasicAuthProvider
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
  ): Promise<{ authorized: boolean; reason?: string }>

  /**
   * 内容过滤
   */
  filterContent(content: string): Promise<{ filtered: boolean; reason?: string }>

  /**
   * 写入审计日志
   */
  writeAuditLog(log: AuditLog): Promise<void>
}

/**
 * 基础 Gateway 实现
 */
export class BaseGateway implements Gateway {
  private config: SecurityGatewayConfig
  private auditStore?: AuditLogStore
  private apiKeyManager?: ApiKeyManager
  private jwtManager?: JwtManager
  private sessionManager?: SessionManager
  private oauthManager?: OAuthManager
  private mlModerationService?: ContentModerationService
  private basicAuthProvider?: BasicAuthProvider

  constructor(config: SecurityGatewayConfig) {
    this.config = config
    this.auditStore = config.auditLogStore
    this.apiKeyManager = config.apiKeyManager
    this.jwtManager = config.jwtManager
    this.sessionManager = config.sessionManager
    this.oauthManager = config.oauthManager
    this.mlModerationService = config.mlModerationService
    this.basicAuthProvider = config.basicAuthProvider
  }

  async receiveInput(source: InputSourceType): Promise<MultimodalInput> {
    // 默认实现：返回文本输入
    return {
      sourceType: source,
      text: '',
      metadata: {
        timestamp: new Date(),
      },
    }
  }

  async sendOutput(output: MultimodalOutput, target: OutputTargetType): Promise<void> {
    if (target === OutputTargetType.TERMINAL && output.text) {
      console.log(output.text)
    }

    // 写入审计日志
    if (this.config.enableAudit && this.auditStore) {
      await this.writeAuditLog({
        timestamp: new Date(),
        action: 'send_output',
        result: 'success',
        details: {
          targetType: target,
          contentLength: output.text?.length || 0,
        },
      })
    }
  }

  async requestHumanApproval(request: ApprovalRequest): Promise<HumanApproval> {
    // 默认实现：自动批准
    // 实际应用中应该实现审批流程（WebSocket、邮件、Slack 等）
    console.log(`[审批请求] ${request.agentName}: ${request.content.type}`)
    console.log(`[上下文] ${request.context.goal}`)

    return {
      approved: true,
      timestamp: new Date(),
      userId: 'system',
    }
  }

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    if (!this.config.enableAuth) {
      return {
        success: true,
        userId: 'anonymous',
        roles: ['guest'],
        permissions: ['read'],
      }
    }

    try {
      switch (credentials.type) {
        case 'apikey': {
          // API Key 认证
          if (!this.apiKeyManager) {
            return {
              success: false,
              error: 'API Key 管理器未配置',
            }
          }

          const apiKey = credentials.data.apiKey

          if (!apiKey) {
            return {
              success: false,
              error: '缺少 API Key',
            }
          }

          const keyInfo = await this.apiKeyManager.verifyApiKey(apiKey)

          if (!keyInfo) {
            return {
              success: false,
              error: '无效的 API Key',
            }
          }

          // 创建会话
          if (this.sessionManager) {
            await this.sessionManager.createSession({
              userId: keyInfo.userId,
              roles: keyInfo.roles,
              permissions: keyInfo.permissions,
              ttl: 3600, // 1 小时
            })
          }

          // 生成 JWT Token（如果配置了）
          let token: string | undefined
          let expiresAt: Date | undefined

          if (this.jwtManager) {
            const tokenPair = await this.jwtManager.generateTokenPair(
              keyInfo.userId,
              keyInfo.roles,
              keyInfo.permissions
            )
            token = tokenPair.accessToken
            expiresAt = new Date(tokenPair.expiresAt * 1000)
          }

          return {
            success: true,
            userId: keyInfo.userId,
            roles: keyInfo.roles,
            permissions: keyInfo.permissions,
            token,
            expiresAt,
          }
        }

        case 'jwt': {
          // JWT Token 认证
          if (!this.jwtManager) {
            return {
              success: false,
              error: 'JWT 管理器未配置',
            }
          }

          const token = credentials.data.token

          if (!token) {
            return {
              success: false,
              error: '缺少 Token',
            }
          }

          const result = await this.jwtManager.verifyAccessToken(token)

          if (!result.success || !result.payload) {
            return {
              success: false,
              error: `无效的 Token: ${result.error || 'unknown'}`,
            }
          }

          return {
            success: true,
            userId: result.payload.sub,
            roles: result.payload.roles,
            permissions: result.payload.permissions,
            token,
            expiresAt: new Date(result.payload.exp * 1000),
          }
        }

        case 'oauth': {
          // OAuth 认证
          if (!this.oauthManager) {
            return {
              success: false,
              error: 'OAuth 管理器未配置',
            }
          }

          const provider = credentials.data.provider
          const code = credentials.data.code
          const state = credentials.data.state
          const redirectUri = credentials.data.redirectUri

          if (!provider || !code || !state || !redirectUri) {
            return {
              success: false,
              error: '缺少 OAuth 参数',
            }
          }

          try {
            const result = await this.oauthManager.handleCallback(
              provider,
              code,
              state,
              redirectUri
            )

            // 创建会话
            if (this.sessionManager) {
              await this.sessionManager.createSession({
                userId: result.userInfo.id,
                roles: ['user'],
                permissions: ['read', 'write'],
                ttl: 3600, // 1 小时
              })
            }

            // 生成 JWT Token（如果配置了）
            let token: string | undefined
            let expiresAt: Date | undefined

            if (this.jwtManager) {
              const tokenPair = await this.jwtManager.generateTokenPair(
                result.userInfo.id,
                ['user'],
                ['read', 'write']
              )
              token = tokenPair.accessToken
              expiresAt = new Date(tokenPair.expiresAt * 1000)
            }

            return {
              success: true,
              userId: result.userInfo.id,
              roles: ['user'],
              permissions: ['read', 'write'],
              token,
              expiresAt,
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }
          }
        }

        case 'basic': {
          if (!credentials.data.username || !credentials.data.password) {
            return {
              success: false,
              error: '缺少用户名或密码',
            }
          }

          if (!this.basicAuthProvider) {
            return {
              success: false,
              error: 'Basic 认证提供者未配置',
            }
          }

          const userData = await this.basicAuthProvider.verifyCredentials(
            credentials.data.username,
            credentials.data.password
          )

          if (!userData) {
            return {
              success: false,
              error: '用户名或密码错误',
            }
          }

          if (this.sessionManager) {
            await this.sessionManager.createSession({
              userId: userData.userId,
              roles: userData.roles,
              permissions: userData.permissions,
              ttl: 3600,
            })
          }

          let token: string | undefined
          let expiresAt: Date | undefined

          if (this.jwtManager) {
            const tokenPair = await this.jwtManager.generateTokenPair(
              userData.userId,
              userData.roles,
              userData.permissions
            )
            token = tokenPair.accessToken
            expiresAt = new Date(tokenPair.expiresAt * 1000)
          }

          return {
            success: true,
            userId: userData.userId,
            roles: userData.roles,
            permissions: userData.permissions,
            token,
            expiresAt,
          }
        }

        default:
          return {
            success: false,
            error: '不支持的认证类型',
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async authorize(
    action: Action,
    permissions: Permission[]
  ): Promise<{ authorized: boolean; reason?: string }> {
    if (!this.config.enableAuthorization) {
      return { authorized: true }
    }

    // 检查通配符权限
    const hasWildcardPermission = permissions.some((p) => p.resource === '*' && p.action === '*')
    if (hasWildcardPermission) {
      return { authorized: true }
    }

    // 检查资源级权限
    // 1. 先找完全匹配的权限（resource 和 action 都匹配）
    const exactPermission = permissions.find(
      (p) => p.resource === action.resource && (p.action === action.type || p.action === '*')
    )

    if (exactPermission) {
      return { authorized: true }
    }

    // 2. 找通配符资源权限
    const wildcardResourcePermission = permissions.find(
      (p) => p.resource === '*' && (p.action === action.type || p.action === '*')
    )

    if (wildcardResourcePermission) {
      return { authorized: true }
    }

    // 3. 没有找到匹配的权限
    return {
      authorized: false,
      reason: `Missing permission: ${action.resource}:${action.type}`,
    }
  }

  async filterContent(content: string): Promise<{
    filtered: boolean
    reason?: string
    matchedRule?: string
  }> {
    if (!this.config.enableContentFilter || !this.config.contentFilterRules) {
      return { filtered: false }
    }

    for (const rule of this.config.contentFilterRules) {
      let matched = false

      switch (rule.type) {
        case 'keyword':
          matched =
            typeof rule.content === 'string' &&
            content.toLowerCase().includes(rule.content.toLowerCase())
          break

        case 'pattern':
          // 支持字符串形式的正则表达式和 RegExp 对象
          if (rule.content instanceof RegExp) {
            matched = rule.content.test(content)
          } else if (typeof rule.content === 'string') {
            try {
              // 从字符串创建正则表达式，支持可选的标志
              const pattern = new RegExp(rule.content, rule.flags || '')
              matched = pattern.test(content)
            } catch (error) {
              console.error(`[Gateway] 无效的正则表达式: ${rule.content}`, error)
              matched = false
            }
          }
          break

        case 'ml':
          // 使用 ML 内容审核服务进行内容检测
          if (this.mlModerationService) {
            try {
              const result: ModerationResult = await this.mlModerationService.moderate(content)
              matched = result.isUnsafe

              // 记录审核结果
              if (matched && result.reason) {
                console.warn(
                  `[Gateway] ML 内容审核触发: ${result.reason} (分数: ${result.score.toFixed(2)})`
                )
              }
            } catch (error) {
              console.error('[Gateway] ML 内容审核失败:', error)
              matched = false // 失败时不阻止
            }
          } else {
            // 未配置 ML 服务，使用默认规则引擎
            const defaultService = new RuleBasedModerationService()
            try {
              const result: ModerationResult = await defaultService.moderate(content)
              matched = result.isUnsafe

              if (matched && result.reason) {
                console.warn(`[Gateway] 默认规则引擎触发: ${result.reason}`)
              }
            } catch (error) {
              console.error('[Gateway] 规则引擎失败:', error)
              matched = false
            }
          }
          break
      }

      if (matched) {
        return {
          filtered: rule.action === 'block',
          reason: `触发规则: ${rule.name}`,
          matchedRule: rule.name,
        }
      }
    }

    return { filtered: false }
  }

  async writeAuditLog(log: AuditLog): Promise<void> {
    if (this.auditStore) {
      await this.auditStore.write(log)
    } else {
      // 默认实现：输出到控制台
      console.log('[审计日志]', JSON.stringify(log))
    }
  }

  /**
   * 生成 OAuth 授权 URL
   *
   * @param provider OAuth 提供商
   * @param redirectUri 重定向 URI
   * @param scope 授权范围（可选）
   * @returns 授权 URL 和 State
   */
  async generateOAuthAuthorizationUrl(
    provider: 'google' | 'github',
    redirectUri: string,
    scope?: string[]
  ): Promise<AuthorizationUrlResult> {
    if (!this.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.oauthManager.generateAuthorizationUrl(provider, redirectUri, scope)
  }

  /**
   * 处理 OAuth 回调
   *
   * @param provider OAuth 提供商
   * @param code 授权码
   * @param state State 参数
   * @param redirectUri 重定向 URI
   * @returns OAuth 回调结果
   */
  async handleOAuthCallback(
    provider: 'google' | 'github',
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult> {
    if (!this.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.oauthManager.handleCallback(provider, code, state, redirectUri)
  }

  /**
   * 刷新 OAuth Token
   *
   * @param provider OAuth 提供商
   * @param refreshToken 刷新令牌
   * @returns 新的 Token
   */
  async refreshOAuthToken(provider: 'google' | 'github', refreshToken: string) {
    if (!this.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.oauthManager.refreshToken(provider, refreshToken)
  }

  /**
   * 验证 OAuth Token
   *
   * @param provider OAuth 提供商
   * @param accessToken 访问令牌
   * @returns Token 是否有效
   */
  async verifyOAuthToken(provider: 'google' | 'github', accessToken: string): Promise<boolean> {
    if (!this.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.oauthManager.verifyToken(provider, accessToken)
  }

  /**
   * 获取 OAuth 用户信息
   *
   * @param provider OAuth 提供商
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  async getOAuthUserInfo(provider: 'google' | 'github', accessToken: string) {
    if (!this.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.oauthManager.getUserInfo(provider, accessToken)
  }
}
