/**
 * OAuth 2.0 管理器
 *
 * 统一管理多个 OAuth 提供商
 * 支持授权流程、Token 刷新、用户信息获取
 */
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
export declare class OAuthManager {
  private providers
  private states
  private config
  private static readonly ALGORITHM
  private static readonly IV_LENGTH
  private static readonly SALT_LENGTH
  private static readonly AUTH_TAG_LENGTH
  constructor(config: OAuthManagerConfig)
  /**
   * 初始化 OAuth 提供商
   */
  private initializeProviders
  /**
   * 生成授权 URL
   *
   * @param provider 提供商类型
   * @param redirectUri 重定向 URI
   * @param scope 授权范围（可选）
   * @returns 授权 URL 和 State
   */
  generateAuthorizationUrl(
    provider: OAuthProviderType,
    redirectUri: string,
    scope?: string[]
  ): Promise<AuthorizationUrlResult>
  /**
   * 处理 OAuth 回调
   *
   * @param provider 提供商类型
   * @param code 授权码
   * @param state State 参数
   * @param redirectUri 重定向 URI
   * @returns OAuth 回调结果
   */
  handleCallback(
    provider: OAuthProviderType,
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult>
  /**
   * 刷新 Token
   *
   * @param provider 提供商类型
   * @param refreshToken 刷新令牌
   * @returns 新的 Token
   */
  refreshToken(provider: OAuthProviderType, refreshToken: string): Promise<OAuthToken>
  /**
   * 获取用户信息
   *
   * @param provider 提供商类型
   * @param accessToken 访问令牌
   * @returns 用户信息
   */
  getUserInfo(provider: OAuthProviderType, accessToken: string): Promise<OAuthUserInfo>
  /**
   * 验证 Token
   *
   * @param provider 提供商类型
   * @param accessToken 访问令牌
   * @returns Token 是否有效
   */
  verifyToken(provider: OAuthProviderType, accessToken: string): Promise<boolean>
  /**
   * 加密 Token 数据
   *
   * @param tokenData Token 数据
   * @returns 加密的 Token 字符串
   */
  encryptToken(tokenData: EncryptedTokenData): string
  /**
   * 解密 Token 数据
   *
   * @param encryptedToken 加密的 Token 字符串
   * @returns Token 数据
   */
  decryptToken(encryptedToken: string): EncryptedTokenData
  /**
   * 清理过期的 State
   *
   * @returns 清理的数量
   */
  cleanupExpiredStates(): number
  /**
   * 获取提供商实例
   *
   * @param provider 提供商类型
   * @returns 提供商实例
   */
  private getProvider
  /**
   * 验证 State 参数
   *
   * @param state State 参数
   * @param provider 提供商类型
   * @returns 存储的 State 数据
   */
  private validateState
  /**
   * 生成安全的随机字符串
   *
   * @param bytes 字节数
   * @returns base64url 编码的随机字符串
   */
  private generateSecureRandom
  /**
   * 从密码和盐派生密钥
   *
   * 使用简单的 SHA-256 派生（生产环境建议使用 PBKDF2）
   *
   * @param password 密码
   * @param salt 盐
   * @returns 派生的密钥
   */
  private deriveKey
}
export {}
//# sourceMappingURL=OAuthManager.d.ts.map
