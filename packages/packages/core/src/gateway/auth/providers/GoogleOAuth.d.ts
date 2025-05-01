/**
 * Google OAuth 2.0 提供商
 *
 * 实现标准的 Google OAuth 2.0 和 OpenID Connect
 * 文档: https://developers.google.com/identity/protocols/oauth2
 */
import { BaseOAuthProvider, OAuthUserInfo } from './BaseOAuthProvider.js'
/**
 * Google OAuth 配置
 */
export interface GoogleOAuthConfig {
  /** 客户端 ID */
  clientId: string
  /** 客户端密钥 */
  clientSecret: string
  /** 是否使用 PKCE（默认 true） */
  usePkce?: boolean
}
/**
 * Google OAuth 2.0 提供商
 */
export declare class GoogleOAuth extends BaseOAuthProvider {
  constructor(config: GoogleOAuthConfig)
  /**
   * 获取提供商名称
   */
  getName(): string
  /**
   * 获取 Google 用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  protected fetchUserInfo(accessToken: string): Promise<OAuthUserInfo>
  /**
   * 验证 Google 托管域名
   *
   * 用于限制特定 Google Workspace 组织的用户登录
   *
   * @param userInfo 用户信息
   * @param allowedDomains 允许的域名列表
   * @returns 是否在允许的域名中
   */
  static verifyHostedDomain(userInfo: OAuthUserInfo, allowedDomains: string[]): boolean
}
//# sourceMappingURL=GoogleOAuth.d.ts.map
