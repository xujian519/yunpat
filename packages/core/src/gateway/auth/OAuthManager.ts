/**
 * OAuth 2.0 管理器
 *
 * 统一管理多个 OAuth 提供商
 * 支持授权流程、Token 刷新、用户信息获取
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto'
import { BaseOAuthProvider } from './providers/BaseOAuthProvider.js'
import { GoogleOAuth } from './providers/GoogleOAuth.js'
import { GitHubOAuth } from './providers/GitHubOAuth.js'
import { OAuthToken, OAuthUserInfo, PkcePair } from './providers/BaseOAuthProvider.js'

/**
 * OAuth 提供商类型
 */
export type OAuthProviderType = 'google' | 'github'

/**
 * OAuth 提供商配置
 */
export interface OAuthProviderConfigs {
  google?: {
    clientId: string
    clientSecret: string
    usePkce?: boolean
  }
  github?: {
    clientId: string
    clientSecret: string
    usePkce?: boolean
  }
}

/**
 * OAuth 管理器配置
 */
export interface OAuthManagerConfig {
  /** 提供商配置 */
  providers: OAuthProviderConfigs

  /** Token 加密密钥（32 字节） */
  tokenEncryptionKey?: string

  /** State 过期时间（秒，默认 600 = 10 分钟） */
  stateExpiration?: number
}

/**
 * 授权 URL 结果
 */
export interface AuthorizationUrlResult {
  /** 授权 URL */
  url: string

  /** State 参数 */
  state: string

  /** PKCE 验证器（如果启用） */
  pkce?: PkcePair
}

/**
 * OAuth 回调结果
 */
export interface OAuthCallbackResult {
  /** 用户信息 */
  userInfo: OAuthUserInfo

  /** OAuth Token */
  token: OAuthToken

  /** 提供商类型 */
  provider: OAuthProviderType
}

/**
 * 存储 State 和 PKCE 验证器
 */
interface StoredState {
  state: string
  pkce?: PkcePair
  provider: OAuthProviderType
  expiresAt: number
}

/**
 * Token 加密存储格式
 */
interface EncryptedTokenData {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

/**
 * OAuth 管理器
 */
export class OAuthManager {
  private providers: Map<OAuthProviderType, BaseOAuthProvider>
  private states: Map<string, StoredState>
  private config: Required<OAuthManagerConfig>

  // 加密算法配置
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly IV_LENGTH = 16
  private static readonly SALT_LENGTH = 32
  private static readonly AUTH_TAG_LENGTH = 16

  constructor(config: OAuthManagerConfig) {
    this.providers = new Map()
    this.states = new Map()

    // 初始化配置
    this.config = {
      providers: config.providers,
      tokenEncryptionKey: config.tokenEncryptionKey || process.env.OAUTH_ENCRYPTION_KEY || '',
      stateExpiration: config.stateExpiration || 600,
    }

    // 安全检查：生产环境必须提供加密密钥
    if (!this.config.tokenEncryptionKey || this.config.tokenEncryptionKey.length < 32) {
      throw new Error(
        'OAuth 加密密钥必须提供且至少 32 字节。' +
          '通过 config.tokenEncryptionKey 或环境变量 OAUTH_ENCRYPTION_KEY 设置。'
      )
    }

    // 初始化提供商
    this.initializeProviders()
  }

  /**
   * 初始化 OAuth 提供商
   */
  private initializeProviders(): void {
    if (this.config.providers.google) {
      const provider = new GoogleOAuth(this.config.providers.google)
      this.providers.set('google', provider)
    }

    if (this.config.providers.github) {
      const provider = new GitHubOAuth(this.config.providers.github)
      this.providers.set('github', provider)
    }
  }

  /**
   * 生成授权 URL
   *
   * @param provider 提供商类型
   * @param redirectUri 重定向 URI
   * @param scope 授权范围（可选）
   * @returns 授权 URL 和 State
   */
  async generateAuthorizationUrl(
    provider: OAuthProviderType,
    redirectUri: string,
    scope?: string[]
  ): Promise<AuthorizationUrlResult> {
    const providerInstance = this.getProvider(provider)

    // 生成 State 参数
    const state = this.generateSecureRandom(32)

    // 生成授权 URL
    const { url, pkce } = await providerInstance.generateAuthorizationUrl({
      redirectUri,
      scope,
      state,
      usePkce: true,
    })

    // 存储 State 和 PKCE 验证器
    this.states.set(state, {
      state,
      pkce,
      provider,
      expiresAt: Date.now() + this.config.stateExpiration * 1000,
    })

    return { url, state, pkce }
  }

  /**
   * 处理 OAuth 回调
   *
   * @param provider 提供商类型
   * @param code 授权码
   * @param state State 参数
   * @param redirectUri 重定向 URI
   * @returns OAuth 回调结果
   */
  async handleCallback(
    provider: OAuthProviderType,
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult> {
    const providerInstance = this.getProvider(provider)

    // 验证 State 参数
    const storedState = this.validateState(state, provider)

    // 交换授权码获取 Token
    const token = await providerInstance.exchangeCodeForToken({
      code,
      redirectUri,
      codeVerifier: storedState.pkce?.codeVerifier,
      state,
    })

    // 获取用户信息
    const userInfo = await providerInstance.getUserInfo(token.accessToken)

    // 清理 State
    this.states.delete(state)

    return {
      userInfo,
      token,
      provider,
    }
  }

  /**
   * 刷新 Token
   *
   * @param provider 提供商类型
   * @param refreshToken 刷新令牌
   * @returns 新的 Token
   */
  async refreshToken(provider: OAuthProviderType, refreshToken: string): Promise<OAuthToken> {
    const providerInstance = this.getProvider(provider)
    return await providerInstance.refreshAccessToken(refreshToken)
  }

  /**
   * 获取用户信息
   *
   * @param provider 提供商类型
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  async getUserInfo(provider: OAuthProviderType, accessToken: string): Promise<OAuthUserInfo> {
    const providerInstance = this.getProvider(provider)
    return await providerInstance.getUserInfo(accessToken)
  }

  /**
   * 验证 Token
   *
   * @param provider 提供商类型
   * @param accessToken 访问令牌
   * @returns Token 是否有效
   */
  async verifyToken(provider: OAuthProviderType, accessToken: string): Promise<boolean> {
    const providerInstance = this.getProvider(provider)
    return await providerInstance.verifyToken(accessToken)
  }

  /**
   * 加密 Token 数据
   *
   * @param tokenData Token 数据
   * @returns 加密的 Token 字符串
   */
  encryptToken(tokenData: EncryptedTokenData): string {
    const iv = randomBytes(OAuthManager.IV_LENGTH)
    const salt = randomBytes(OAuthManager.SALT_LENGTH)

    // 从密钥和盐派生加密密钥
    const key = this.deriveKey(this.config.tokenEncryptionKey, salt)

    const cipher = createCipheriv(OAuthManager.ALGORITHM, key, iv)

    const data = JSON.stringify(tokenData)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 获取认证标签
    const authTag = cipher.getAuthTag()

    // 组合: salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')])

    return combined.toString('base64')
  }

  /**
   * 解密 Token 数据
   *
   * @param encryptedToken 加密的 Token 字符串
   * @returns Token 数据
   */
  decryptToken(encryptedToken: string): EncryptedTokenData {
    const combined = Buffer.from(encryptedToken, 'base64')

    // 提取各部分
    const salt = combined.subarray(0, OAuthManager.SALT_LENGTH)
    const iv = combined.subarray(
      OAuthManager.SALT_LENGTH,
      OAuthManager.SALT_LENGTH + OAuthManager.IV_LENGTH
    )
    const authTag = combined.subarray(
      OAuthManager.SALT_LENGTH + OAuthManager.IV_LENGTH,
      OAuthManager.SALT_LENGTH + OAuthManager.IV_LENGTH + OAuthManager.AUTH_TAG_LENGTH
    )
    const encrypted = combined.subarray(
      OAuthManager.SALT_LENGTH + OAuthManager.IV_LENGTH + OAuthManager.AUTH_TAG_LENGTH
    )

    // 从密钥和盐派生解密密钥
    const key = this.deriveKey(this.config.tokenEncryptionKey, salt)

    const decipher = createDecipheriv(OAuthManager.ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return JSON.parse(decrypted) as EncryptedTokenData
  }

  /**
   * 清理过期的 State
   *
   * @returns 清理的数量
   */
  cleanupExpiredStates(): number {
    const now = Date.now()
    let cleaned = 0

    const entries = Array.from(this.states.entries())
    for (const [state, data] of entries) {
      if (data.expiresAt < now) {
        this.states.delete(state)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * 获取提供商实例
   *
   * @param provider 提供商类型
   * @returns 提供商实例
   */
  private getProvider(provider: OAuthProviderType): BaseOAuthProvider {
    const providerInstance = this.providers.get(provider)

    if (!providerInstance) {
      throw new Error(`未配置的 OAuth 提供商: ${provider}`)
    }

    return providerInstance
  }

  /**
   * 验证 State 参数
   *
   * @param state State 参数
   * @param provider 提供商类型
   * @returns 存储的 State 数据
   */
  private validateState(state: string, provider: OAuthProviderType): StoredState {
    const storedState = this.states.get(state)

    if (!storedState) {
      throw new Error('无效的 State 参数')
    }

    if (storedState.provider !== provider) {
      throw new Error('提供商不匹配')
    }

    if (storedState.expiresAt < Date.now()) {
      this.states.delete(state)
      throw new Error('State 已过期')
    }

    return storedState
  }

  /**
   * 生成安全的随机字符串
   *
   * @param bytes 字节数
   * @returns base64url 编码的随机字符串
   */
  private generateSecureRandom(bytes: number): string {
    return randomBytes(bytes).toString('base64url')
  }

  /**
   * 从密码和盐派生密钥
   *
   * 使用简单的 SHA-256 派生（生产环境建议使用 PBKDF2）
   *
   * @param password 密码
   * @param salt 盐
   * @returns 派生的密钥
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    const hash = createHash('sha256')
    hash.update(password + salt.toString('hex'))
    return Buffer.from(hash.digest()).subarray(0, 32)
  }
}
