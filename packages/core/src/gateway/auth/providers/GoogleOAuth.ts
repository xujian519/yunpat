/**
 * Google OAuth 2.0 提供商
 *
 * 实现标准的 Google OAuth 2.0 和 OpenID Connect
 * 文档: https://developers.google.com/identity/protocols/oauth2
 */

import {
  BaseOAuthProvider,
  OAuthProviderConfig,
  OAuthUserInfo,
  OAuthProviderError,
} from './BaseOAuthProvider.js';

/**
 * Google OAuth 配置
 */
export interface GoogleOAuthConfig {
  /** 客户端 ID */
  clientId: string;

  /** 客户端密钥 */
  clientSecret: string;

  /** 是否使用 PKCE（默认 true） */
  usePkce?: boolean;
}

/**
 * Google 用户信息响应
 */
interface GoogleUserInfoResponse {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: string;
  hd?: string; // 托管域名（Google Workspace）
}

/**
 * Google OAuth 2.0 提供商
 */
export class GoogleOAuth extends BaseOAuthProvider {
  constructor(config: GoogleOAuthConfig) {
    const fullConfig: OAuthProviderConfig = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
      defaultScope: ['openid', 'profile', 'email'],
      usePkce: config.usePkce,
    };

    super(fullConfig);
  }

  /**
   * 获取提供商名称
   */
  getName(): string {
    return 'google';
  }

  /**
   * 获取 Google 用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  protected async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(this.config.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OAuthProviderError(
        `获取用户信息失败: ${error}`,
        'user_info_failed',
        response.status
      );
    }

    const data = (await response.json()) as GoogleUserInfoResponse;

    return {
      id: data.sub,
      username: data.email?.split('@')[0],
      displayName: data.name,
      email: data.email,
      emailVerified: data.email_verified,
      avatarUrl: data.picture,
      raw: data as unknown as Record<string, unknown>,
    };
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
  static verifyHostedDomain(userInfo: OAuthUserInfo, allowedDomains: string[]): boolean {
    const hd = userInfo.raw.hd as string | undefined;

    if (!hd) {
      return false;
    }

    return allowedDomains.includes(hd);
  }
}
