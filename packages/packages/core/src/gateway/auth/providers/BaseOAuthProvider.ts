/**
 * OAuth 2.0 提供商基类
 *
 * 实现标准的 OAuth 2.0 Authorization Code Flow
 * 支持 PKCE (Proof Key for Code Exchange)
 */

import { randomBytes, createHash } from 'crypto'
import { URLSearchParams } from 'url'

/**
 * OAuth Token 响应
 */
export interface OAuthToken {
  /** 访问令牌 */
  accessToken: string

  /** 刷新令牌 */
  refreshToken?: string

  /** Token 类型（通常是 Bearer） */
  tokenType: string

  /** 过期时间（秒） */
  expiresIn?: number

  /** 授权范围 */
  scope?: string

  /** ID Token（OpenID Connect） */
  idToken?: string
}

/**
 * OAuth 用户信息
 */
export interface OAuthUserInfo {
  /** 用户 ID（提供商特定） */
  id: string

  /** 用户名 */
  username?: string

  /** 显示名称 */
  displayName?: string

  /** 邮箱 */
  email?: string

  /** 邮箱是否验证 */
  emailVerified?: boolean

  /** 头像 URL */
  avatarUrl?: string

  /** 个人资料 URL */
  profileUrl?: string

  /** 原始数据 */
  raw: Record<string, unknown>
}

/**
 * 授权 URL 选项
 */
export interface AuthUrlOptions {
  /** 重定向 URI */
  redirectUri: string

  /** 授权范围 */
  scope?: string[]

  /** State 参数（防 CSRF） */
  state?: string

  /** 是否使用 PKCE */
  usePkce?: boolean

  /** 额外参数 */
  extras?: Record<string, string>
}

/**
 * PKCE 验证器对
 */
export interface PkcePair {
  /** Code Challenge（用于授权请求） */
  codeChallenge: string

  /** Code Verifier（用于 Token 请求） */
  codeVerifier: string

  /** Challenge 方法（S256 或 plain） */
  challengeMethod: 'S256' | 'plain'
}

/**
 * Token 请求选项
 */
export interface TokenRequestOptions {
  /** 授权码 */
  code: string

  /** 重定向 URI */
  redirectUri: string

  /** Code Verifier（PKCE） */
  codeVerifier?: string

  /** State 参数（验证） */
  state?: string
}

/**
 * OAuth 提供商配置
 */
export interface OAuthProviderConfig {
  /** 客户端 ID */
  clientId: string

  /** 客户端密钥 */
  clientSecret: string

  /** 授权端点 */
  authorizationEndpoint: string

  /** Token 端点 */
  tokenEndpoint: string

  /** 用户信息端点 */
  userInfoEndpoint: string

  /** 默认授权范围 */
  defaultScope: string[]

  /** 是否使用 PKCE（默认 true） */
  usePkce?: boolean
}

/**
 * OAuth 提供商错误
 */
export class OAuthProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'OAuthProviderError'
  }
}

/**
 * OAuth 2.0 提供商基类
 *
 * 实现标准的 OAuth 2.0 Authorization Code Flow
 * 子类需要实现用户信息获取逻辑
 */
export abstract class BaseOAuthProvider {
  protected config: OAuthProviderConfig

  constructor(config: OAuthProviderConfig) {
    this.config = {
      usePkce: true,
      ...config,
    }
  }

  /**
   * 获取提供商名称
   */
  abstract getName(): string

  /**
   * 获取用户信息
   * 子类需要实现此方法来解析特定提供商的用户信息格式
   */
  protected abstract fetchUserInfo(accessToken: string): Promise<OAuthUserInfo>

  /**
   * 获取授权端点
   */
  getAuthorizationEndpoint(): string {
    return this.config.authorizationEndpoint
  }

  /**
   * 获取 Token 端点
   */
  getTokenEndpoint(): string {
    return this.config.tokenEndpoint
  }

  /**
   * 获取用户信息端点
   */
  getUserInfoEndpoint(): string {
    return this.config.userInfoEndpoint
  }

  /**
   * 生成授权 URL
   *
   * @param options 授权 URL 选项
   * @returns 授权 URL 和 PKCE 验证器（如果启用）
   */
  async generateAuthorizationUrl(
    options: AuthUrlOptions
  ): Promise<{ url: string; pkce?: PkcePair }> {
    const scope = options.scope || this.config.defaultScope
    const state = options.state || this.generateSecureRandom(32)

    // 构建 URL 参数
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: options.redirectUri,
      response_type: 'code',
      scope: Array.isArray(scope) ? scope.join(' ') : scope,
      state,
    })

    // 添加额外参数
    if (options.extras) {
      Object.entries(options.extras).forEach(([key, value]) => {
        params.append(key, value)
      })
    }

    // PKCE 支持
    let pkce: PkcePair | undefined
    // 显式启用 PKCE（选项或配置启用）
    const enablePkce = options.usePkce !== false && this.config.usePkce !== false

    if (enablePkce) {
      pkce = this.generatePkcePair()
      params.append('code_challenge', pkce.codeChallenge)
      params.append('code_challenge_method', pkce.challengeMethod)
    }

    const url = `${this.config.authorizationEndpoint}?${params.toString()}`

    return { url, pkce }
  }

  /**
   * 交换授权码获取 Token
   *
   * @param options Token 请求选项
   * @returns OAuth Token
   */
  async exchangeCodeForToken(options: TokenRequestOptions): Promise<OAuthToken> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    // 添加 PKCE Code Verifier
    if (options.codeVerifier) {
      params.append('code_verifier', options.codeVerifier)
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new OAuthProviderError(
        `Token 请求失败: ${error}`,
        'token_request_failed',
        response.status
      )
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
      scope?: string
      id_token?: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      scope: data.scope,
      idToken: data.id_token,
    }
  }

  /**
   * 刷新访问 Token
   *
   * @param refreshToken 刷新令牌
   * @returns 新的 OAuth Token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthToken> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new OAuthProviderError(
        `Token 刷新失败: ${error}`,
        'token_refresh_failed',
        response.status
      )
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
      scope?: string
      id_token?: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      scope: data.scope,
      idToken: data.id_token,
    }
  }

  /**
   * 获取用户信息
   *
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    return await this.fetchUserInfo(accessToken)
  }

  /**
   * 验证 Token
   *
   * 通过获取用户信息来验证 Token 是否有效
   *
   * @param accessToken 访问令牌
   * @returns Token 是否有效
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken)
      return true
    } catch {
      return false
    }
  }

  /**
   * 生成 PKCE 验证器对
   *
   * 使用 SHA-256 方法（推荐）
   */
  protected generatePkcePair(): PkcePair {
    // 生成随机的 Code Verifier（43-128 个字符）
    const codeVerifier = this.generateSecureRandom(64)

    // 计算 Code Challenge（base64url 编码的 SHA-256 哈希）
    const hash = createHash('sha256').update(codeVerifier).digest()
    const codeChallenge = hash.toString('base64url')

    return {
      codeChallenge,
      codeVerifier,
      challengeMethod: 'S256',
    }
  }

  /**
   * 生成安全的随机字符串
   *
   * @param bytes 字节数
   * @returns base64url 编码的随机字符串
   */
  protected generateSecureRandom(bytes: number): string {
    return randomBytes(bytes).toString('base64url')
  }
}
