/**
 * GitHub OAuth 2.0 提供商
 *
 * 实现标准的 GitHub OAuth 2.0
 * 文档: https://docs.github.com/en/developers/apps/building-oauth-apps
 */
import { BaseOAuthProvider, OAuthUserInfo } from './BaseOAuthProvider.js'
/**
 * GitHub OAuth 配置
 */
export interface GitHubOAuthConfig {
  /** 客户端 ID */
  clientId: string
  /** 客户端密钥 */
  clientSecret: string
  /** 是否使用 PKCE（默认 true） */
  usePkce?: boolean
}
/**
 * GitHub OAuth 2.0 提供商
 */
export declare class GitHubOAuth extends BaseOAuthProvider {
  constructor(config: GitHubOAuthConfig)
  /**
   * 获取提供商名称
   */
  getName(): string
  /**
   * 获取 GitHub 用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  protected fetchUserInfo(accessToken: string): Promise<OAuthUserInfo>
}
//# sourceMappingURL=GitHubOAuth.d.ts.map
