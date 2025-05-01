/**
 * JWT Token 管理器
 *
 * 负责 JWT Token 的生成、验证和刷新
 */
import { Algorithm } from 'jsonwebtoken'
/**
 * Token 负载
 */
export interface TokenPayload {
  /** 用户 ID */
  sub: string
  /** 用户名 */
  username?: string
  /** 用户角色 */
  roles: string[]
  /** 权限列表 */
  permissions: string[]
  /** 签发时间 */
  iat: number
  /** 过期时间 */
  exp: number
  /** Token ID（用于撤销） */
  jti: string
}
/**
 * Token 配置
 */
export interface TokenConfig {
  /** 密钥（生产环境应从环境变量读取） */
  secret: string
  /** 访问 Token 过期时间（秒） */
  accessTokenExpiresIn: number
  /** 刷新 Token 过期时间（秒） */
  refreshTokenExpiresIn: number
  /** 签名算法 */
  algorithm: Algorithm
  /** 颁发者 */
  issuer: string
  /** 用户数据提供者（用于刷新 Token 时获取最新用户信息） */
  userDataProvider?: UserDataProvider
}
/**
 * Token 对
 */
export interface TokenPair {
  /** 访问 Token */
  accessToken: string
  /** 刷新 Token */
  refreshToken: string
  /** 过期时间（Unix 时间戳） */
  expiresAt: number
}
/**
 * Token 验证结果
 */
export interface TokenVerifyResult {
  success: boolean
  payload?: TokenPayload
  error?: 'invalid' | 'expired' | 'revoked'
}
/**
 * 用户数据信息
 */
export interface UserData {
  /** 用户 ID */
  userId: string
  /** 用户角色 */
  roles: string[]
  /** 权限列表 */
  permissions: string[]
}
/**
 * 用户数据提供者接口
 * 用于在刷新 Token 时获取最新的用户信息
 */
export interface UserDataProvider {
  /**
   * 获取用户数据
   * @param userId 用户 ID
   * @returns 用户数据，如果用户不存在则返回 null
   */
  getUserData(userId: string): Promise<UserData | null>
}
/**
 * Token 存储接口（用于撤销和刷新 Token）
 */
export interface TokenStore {
  /** 保存 Token */
  save(tokenId: string, payload: TokenPayload, expiresIn: number): Promise<void>
  /** 查找 Token */
  find(tokenId: string): Promise<TokenPayload | null>
  /** 删除 Token（撤销） */
  delete(tokenId: string): Promise<void>
  /** 清理过期的 Token */
  cleanupExpired(): Promise<number>
}
/**
 * 内存 Token 存储（用于开发/测试）
 */
export declare class InMemoryTokenStore implements TokenStore {
  private store
  save(tokenId: string, payload: TokenPayload, expiresIn: number): Promise<void>
  find(tokenId: string): Promise<TokenPayload | null>
  delete(tokenId: string): Promise<void>
  cleanupExpired(): Promise<number>
}
/**
 * JWT Token 管理器
 */
export declare class JwtManager {
  private config
  private store
  constructor(config?: Partial<TokenConfig>, store?: TokenStore)
  /**
   * 生成 Token 对
   *
   * @param userId 用户 ID
   * @param roles 用户角色
   * @param permissions 用户权限
   * @returns Token 对
   */
  generateTokenPair(userId: string, roles: string[], permissions: string[]): Promise<TokenPair>
  /**
   * 验证访问 Token
   *
   * @param token 访问 Token
   * @returns 验证结果（包含详细错误信息）
   */
  verifyAccessToken(token: string): Promise<TokenVerifyResult>
  /**
   * 验证访问 Token（兼容旧接口）
   *
   * @deprecated 使用 verifyAccessToken 获取详细错误信息
   */
  verifyAccessTokenCompat(token: string): Promise<TokenPayload | null>
  /**
   * 刷新 Token
   *
   * @param refreshToken 刷新 Token
   * @returns 新的 Token 对（如果刷新成功）
   */
  refreshTokens(refreshToken: string): Promise<TokenPair | null>
  /**
   * 撤销 Token
   *
   * @param token 要撤销的 Token
   */
  revokeToken(token: string): Promise<void>
  /**
   * 清理过期的 Token
   */
  cleanupExpired(): Promise<number>
  /**
   * 生成安全的 Token ID
   */
  private generateTokenId
}
//# sourceMappingURL=JwtManager.d.ts.map
