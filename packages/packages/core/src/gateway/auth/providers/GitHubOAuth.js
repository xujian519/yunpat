/**
 * GitHub OAuth 2.0 提供商
 *
 * 实现标准的 GitHub OAuth 2.0
 * 文档: https://docs.github.com/en/developers/apps/building-oauth-apps
 */
import { BaseOAuthProvider, OAuthProviderError } from './BaseOAuthProvider.js'
/**
 * GitHub OAuth 2.0 提供商
 */
export class GitHubOAuth extends BaseOAuthProvider {
  constructor(config) {
    const fullConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      userInfoEndpoint: 'https://api.github.com/user',
      defaultScope: ['read:user', 'user:email'],
      usePkce: config.usePkce,
    }
    super(fullConfig)
  }
  /**
   * 获取提供商名称
   */
  getName() {
    return 'github'
  }
  /**
   * 获取 GitHub 用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  async fetchUserInfo(accessToken) {
    // 获取基本用户信息
    const userResponse = await fetch(this.config.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    if (!userResponse.ok) {
      const error = await userResponse.text()
      throw new OAuthProviderError(
        `获取用户信息失败: ${error}`,
        'user_info_failed',
        userResponse.status
      )
    }
    const userData = await userResponse.json()
    // 获取邮箱信息（GitHub 默认不返回公开邮箱）
    let primaryEmail
    let emailVerified = false
    try {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json()
        const primaryEmailData = emails.find((e) => e.primary)
        if (primaryEmailData) {
          primaryEmail = primaryEmailData.email
          emailVerified = primaryEmailData.verified
        }
      }
    } catch {
      // 邮箱获取失败，使用用户数据中的邮箱
    }
    return {
      id: userData.id.toString(),
      username: userData.login,
      displayName: userData.name || userData.login,
      email: primaryEmail || userData.email || undefined,
      emailVerified,
      avatarUrl: userData.avatar_url,
      profileUrl: userData.html_url,
      raw: {
        ...userData,
        bio: userData.bio,
        blog: userData.blog,
        location: userData.location,
        company: userData.company,
        publicRepos: userData.public_repos,
        followers: userData.followers,
        following: userData.following,
        type: userData.type,
        siteAdmin: userData.site_admin,
      },
    }
  }
}
//# sourceMappingURL=GitHubOAuth.js.map
