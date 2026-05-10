/**
 * 交互层 (Gateway / Interface)
 *
 * 负责 Agent 与外部世界的接口
 * - 多模态输入：文本、语音、图像、视频、文件
 * - 人机协同 (HITL)：审批节点、反馈回路、人工接管
 * - 安全网关：身份认证、权限控制、审计日志
 *
 * Facade：re-export 所有类型，保留 BaseGateway 实现。
 */

import type { AuthorizationUrlResult, OAuthCallbackResult } from './auth/index.js'
import {
  ContentModerationService,
  RuleBasedModerationService,
  type ModerationResult,
} from './ContentModerationService.js'
import { OutputTargetType } from './GatewayTypes.js'
import type {
  Gateway,
  MultimodalInput,
  MultimodalOutput,
  HumanApproval,
  ApprovalRequest,
  AuthResult,
  Credentials,
  Permission,
  Action,
  SecurityGatewayConfig,
  AuditLog,
  AuditLogStore,
  InputSourceType,
} from './GatewayTypes.js'
import { authenticateCredentials } from './GatewayAuth.js'

// Re-export 所有类型，保持公开 API 不变
export { InputSourceType, OutputTargetType } from './GatewayTypes.js'

export type {
  MultimodalInput,
  MultimodalOutput,
  HumanApproval,
  ApprovalRequest,
  AuthResult,
  Credentials,
  Permission,
  Action,
  SecurityGatewayConfig,
  ContentFilterRule,
  AuditLog,
  AuditLogStore,
  AuditLogFilter,
  AuditMetrics,
  Gateway,
} from './GatewayTypes.js'

export { authenticateCredentials } from './GatewayAuth.js'

/**
 * 基础 Gateway 实现
 */
export class BaseGateway implements Gateway {
  private config: SecurityGatewayConfig
  private auditStore?: AuditLogStore
  private mlModerationService?: ContentModerationService

  constructor(config: SecurityGatewayConfig) {
    this.config = config
    this.auditStore = config.auditLogStore
    this.mlModerationService = config.mlModerationService
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
    return authenticateCredentials(this.config, credentials)
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
    if (!this.config.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.config.oauthManager.generateAuthorizationUrl(provider, redirectUri, scope)
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
    if (!this.config.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.config.oauthManager.handleCallback(provider, code, state, redirectUri)
  }

  /**
   * 刷新 OAuth Token
   *
   * @param provider OAuth 提供商
   * @param refreshToken 刷新令牌
   * @returns 新的 Token
   */
  async refreshOAuthToken(provider: 'google' | 'github', refreshToken: string) {
    if (!this.config.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.config.oauthManager.refreshToken(provider, refreshToken)
  }

  /**
   * 验证 OAuth Token
   *
   * @param provider OAuth 提供商
   * @param accessToken 访问令牌
   * @returns Token 是否有效
   */
  async verifyOAuthToken(provider: 'google' | 'github', accessToken: string): Promise<boolean> {
    if (!this.config.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.config.oauthManager.verifyToken(provider, accessToken)
  }

  /**
   * 获取 OAuth 用户信息
   *
   * @param provider OAuth 提供商
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  async getOAuthUserInfo(provider: 'google' | 'github', accessToken: string) {
    if (!this.config.oauthManager) {
      throw new Error('OAuth 管理器未配置')
    }

    return await this.config.oauthManager.getUserInfo(provider, accessToken)
  }
}
