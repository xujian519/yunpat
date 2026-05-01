/**
 * GitHub OAuth 2.0 提供商
 *
 * 实现标准的 GitHub OAuth 2.0
 * 文档: https://docs.github.com/en/developers/apps/building-oauth-apps
 */

import {
  BaseOAuthProvider,
  OAuthProviderConfig,
  OAuthUserInfo,
  OAuthProviderError,
} from './BaseOAuthProvider.js';

/**
 * GitHub OAuth 配置
 */
export interface GitHubOAuthConfig {
  /** 客户端 ID */
  clientId: string;

  /** 客户端密钥 */
  clientSecret: string;

  /** 是否使用 PKCE（默认 true） */
  usePkce?: boolean;
}

/**
 * GitHub 用户信息响应
 */
interface GitHubUserInfoResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  blog: string | null;
  location: string | null;
  company: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  type: string;
  site_admin: boolean;
}

/**
 * GitHub 邮箱信息响应
 */
interface GitHubEmailResponse {
  email: string;
  verified: boolean;
  primary: boolean;
  visibility: string | null;
}

/**
 * GitHub OAuth 2.0 提供商
 */
export class GitHubOAuth extends BaseOAuthProvider {
  constructor(config: GitHubOAuthConfig) {
    const fullConfig: OAuthProviderConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      userInfoEndpoint: 'https://api.github.com/user',
      defaultScope: ['read:user', 'user:email'],
      usePkce: config.usePkce,
    };

    super(fullConfig);
  }

  /**
   * 获取提供商名称
   */
  getName(): string {
    return 'github';
  }

  /**
   * 获取 GitHub 用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  protected async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // 获取基本用户信息
    const userResponse = await fetch(this.config.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      throw new OAuthProviderError(
        `获取用户信息失败: ${error}`,
        'user_info_failed',
        userResponse.status
      );
    }

    const userData = (await userResponse.json()) as GitHubUserInfoResponse;

    // 获取邮箱信息（GitHub 默认不返回公开邮箱）
    let primaryEmail: string | undefined;
    let emailVerified = false;

    try {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as GitHubEmailResponse[];
        const primaryEmailData = emails.find((e) => e.primary);

        if (primaryEmailData) {
          primaryEmail = primaryEmailData.email;
          emailVerified = primaryEmailData.verified;
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
    };
  }
}
