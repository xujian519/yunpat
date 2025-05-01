/**
 * API Key 管理器
 *
 * 负责 API Key 的生成、验证和存储
 */
/**
 * API Key 管理器配置
 */
export interface ApiKeyManagerConfig {
  /** 速率限制配置（可选） */
  rateLimit?: {
    maxAttempts: number
    windowMs: number
  }
}
/**
 * API Key 信息
 */
export interface ApiKeyInfo {
  /** Key ID（用于日志和追踪） */
  keyId: string
  /** 用户 ID */
  userId: string
  /** 用户名 */
  username?: string
  /** 用户角色 */
  roles: string[]
  /** 权限列表 */
  permissions: string[]
  /** 创建时间 */
  createdAt: Date
  /** 过期时间（可选） */
  expiresAt?: Date
  /** 是否启用 */
  enabled: boolean
  /** 速率限制（每分钟请求数） */
  rateLimit?: number
  /** 备注 */
  note?: string
}
/**
 * API Key 存储接口
 */
export interface ApiKeyStore {
  /** 保存 API Key */
  save(keyId: string, apiKeyHash: string, info: ApiKeyInfo): Promise<void>
  /** 查找 API Key */
  find(keyId: string): Promise<{
    apiKeyHash: string
    info: ApiKeyInfo
  } | null>
  /** 删除 API Key */
  delete(keyId: string): Promise<void>
  /** 列出用户的所有 Key */
  listByUser(userId: string): Promise<
    Array<{
      keyId: string
      info: ApiKeyInfo
    }>
  >
  /** 清理过期的 Key */
  cleanupExpired(): Promise<number>
}
/**
 * 内存存储实现（用于开发/测试）
 */
export declare class InMemoryApiKeyStore implements ApiKeyStore {
  private store
  save(keyId: string, apiKeyHash: string, info: ApiKeyInfo): Promise<void>
  find(keyId: string): Promise<{
    apiKeyHash: string
    info: ApiKeyInfo
  } | null>
  delete(keyId: string): Promise<void>
  listByUser(userId: string): Promise<
    Array<{
      keyId: string
      info: ApiKeyInfo
    }>
  >
  cleanupExpired(): Promise<number>
}
/**
 * API Key 管理器
 */
export declare class ApiKeyManager {
  private store
  private config
  private rateLimitMap
  constructor(store?: ApiKeyStore, config?: ApiKeyManagerConfig)
  /**
   * 检查速率限制
   */
  private checkRateLimit
  /**
   * 生成新的 API Key
   *
   * @param info API Key 信息
   * @returns 生成的 API Key（格式: yunpat_<keyId>_<secret>）
   */
  generateApiKey(
    info: Omit<ApiKeyInfo, 'keyId' | 'createdAt'> & {
      userId: string
      roles: string[]
      permissions: string[]
      enabled: boolean
    }
  ): Promise<string>
  /**
   * 验证 API Key
   *
   * @param apiKey API Key 字符串
   * @returns API Key 信息（如果验证成功）
   */
  verifyApiKey(apiKey: string): Promise<ApiKeyInfo | null>
  /**
   * 删除 API Key
   */
  deleteApiKey(keyId: string): Promise<void>
  /**
   * 列出用户的所有 API Key
   */
  listUserApiKeys(userId: string): Promise<
    Array<{
      keyId: string
      info: ApiKeyInfo
    }>
  >
  /**
   * 清理过期的 API Key
   */
  cleanupExpired(): Promise<number>
  /**
   * 生成 Key ID
   */
  private generateKeyId
  /**
   * 哈希 API Key
   */
  private hashApiKey
}
//# sourceMappingURL=ApiKeyManager.d.ts.map
