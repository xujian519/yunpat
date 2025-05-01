/**
 * Google OAuth 2.0 提供商
 *
 * 实现标准的 Google OAuth 2.0 和 OpenID Connect
 * 文档: https://developers.google.com/identity/protocols/oauth2
 */
import { BaseOAuthProvider, OAuthProviderError } from './BaseOAuthProvider.js'
/**
 * Google OAuth 2.0 提供商
 */
export class GoogleOAuth extends BaseOAuthProvider {
  constructor(config) {
    const fullConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
      defaultScope: ['openid', 'profile', 'email'],
      usePkce: config.usePkce,
    }
    super(fullConfig)
  }
  /**
   * 获取提供商名称
   */
  getName() {
    return 'google'
  }
  /**
   * 获取 Google 用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  async fetchUserInfo(accessToken) {
    const response = await fetch(this.config.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!response.ok) {
      const error = await response.text()
      throw new OAuthProviderError(
        `获取用户信息失败: ${error}`,
        'user_info_failed',
        response.status
      )
    }
    const data = await response.json()
    return {
      id: data.sub,
      username: data.email?.split('@')[0],
      displayName: data.name,
      email: data.email,
      emailVerified: data.email_verified,
      avatarUrl: data.picture,
      raw: data,
    }
  }
  /**
   * 验证 Google 托管域名
   *
   * 用于限制特定 Google Workspace 组织的用户登录
   *
   * @param userInfo 用户信息
   * @param allowedDomains 允许的域名列表
   * @returns 是否在允许的域名中
   */
  static verifyHostedDomain(userInfo, allowedDomains) {
    const hd = userInfo.raw.hd
    if (!hd) {
      return false
    }
    return allowedDomains.includes(hd)
  }
}
//# sourceMappingURL=GoogleOAuth.js.map
