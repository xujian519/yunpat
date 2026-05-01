/**
 * API Key 管理器
 *
 * 负责 API Key 的生成、验证和存储
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * API Key 管理器配置
 */
export interface ApiKeyManagerConfig {
  /** 速率限制配置（可选） */
  rateLimit?: {
    maxAttempts: number;
    windowMs: number;
  };
}

/**
 * API Key 信息
 */
export interface ApiKeyInfo {
  /** Key ID（用于日志和追踪） */
  keyId: string;

  /** 用户 ID */
  userId: string;

  /** 用户名 */
  username?: string;

  /** 用户角色 */
  roles: string[];

  /** 权限列表 */
  permissions: string[];

  /** 创建时间 */
  createdAt: Date;

  /** 过期时间（可选） */
  expiresAt?: Date;

  /** 是否启用 */
  enabled: boolean;

  /** 速率限制（每分钟请求数） */
  rateLimit?: number;

  /** 备注 */
  note?: string;
}

/**
 * API Key 存储接口
 */
export interface ApiKeyStore {
  /** 保存 API Key */
  save(keyId: string, apiKeyHash: string, info: ApiKeyInfo): Promise<void>;

  /** 查找 API Key */
  find(keyId: string): Promise<{ apiKeyHash: string; info: ApiKeyInfo } | null>;

  /** 删除 API Key */
  delete(keyId: string): Promise<void>;

  /** 列出用户的所有 Key */
  listByUser(userId: string): Promise<Array<{ keyId: string; info: ApiKeyInfo }>>;

  /** 清理过期的 Key */
  cleanupExpired(): Promise<number>;
}

/**
 * 内存存储实现（用于开发/测试）
 */
export class InMemoryApiKeyStore implements ApiKeyStore {
  private store = new Map<
    string,
    { apiKeyHash: string; info: ApiKeyInfo }
  >();

  async save(
    keyId: string,
    apiKeyHash: string,
    info: ApiKeyInfo
  ): Promise<void> {
    this.store.set(keyId, { apiKeyHash, info });
  }

  async find(
    keyId: string
  ): Promise<{ apiKeyHash: string; info: ApiKeyInfo } | null> {
    return this.store.get(keyId) || null;
  }

  async delete(keyId: string): Promise<void> {
    this.store.delete(keyId);
  }

  async listByUser(
    userId: string
  ): Promise<Array<{ keyId: string; info: ApiKeyInfo }>> {
    const results: Array<{ keyId: string; info: ApiKeyInfo }> = [];

    for (const [keyId, data] of this.store.entries()) {
      if (data.info.userId === userId) {
        results.push({ keyId, info: data.info });
      }
    }

    return results;
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [keyId, data] of this.store.entries()) {
      if (data.info.expiresAt && data.info.expiresAt < now) {
        this.store.delete(keyId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * API Key 管理器
 */
export class ApiKeyManager {
  private store: ApiKeyStore;
  private config: ApiKeyManagerConfig;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  constructor(store?: ApiKeyStore, config?: ApiKeyManagerConfig) {
    this.store = store || new InMemoryApiKeyStore();
    this.config = config || {
      rateLimit: {
        maxAttempts: 10,
        windowMs: 60000, // 1 分钟
      },
    };
  }

  /**
   * 检查速率限制
   */
  private async checkRateLimit(keyId: string): Promise<boolean> {
    if (!this.config.rateLimit) {
      return true;
    }

    const now = Date.now();
    const record = this.rateLimitMap.get(keyId);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(keyId, {
        count: 1,
        resetTime: now + this.config.rateLimit.windowMs,
      });
      return true;
    }

    if (record.count >= this.config.rateLimit.maxAttempts) {
      return false; // 超过限制
    }

    record.count++;
    return true;
  }

  /**
   * 生成新的 API Key
   *
   * @param info API Key 信息
   * @returns 生成的 API Key（格式: yunpat_<keyId>_<secret>）
   */
  async generateApiKey(
    info: Omit<ApiKeyInfo, 'keyId' | 'createdAt'> & {
      userId: string;
      roles: string[];
      permissions: string[];
      enabled: boolean;
    }
  ): Promise<string> {
    const keyId = this.generateKeyId();
    const secret = randomBytes(32).toString('base64url');

    // 组合完整的 API Key
    const apiKey = `yunpat_${keyId}_${secret}`;

    // 哈希存储（只存储哈希值，不存储原始 Key）
    const apiKeyHash = this.hashApiKey(secret);

    // 保存完整信息（包括 keyId、createdAt 和所有其他字段）
    const fullInfo: ApiKeyInfo = {
      keyId,
      createdAt: new Date(),
      userId: info.userId,
      roles: info.roles,
      permissions: info.permissions,
      enabled: info.enabled,
      username: info.username,
      expiresAt: info.expiresAt,
      rateLimit: info.rateLimit,
      note: info.note,
    };

    await this.store.save(keyId, apiKeyHash, fullInfo);

    return apiKey;
  }

  /**
   * 验证 API Key
   *
   * @param apiKey API Key 字符串
   * @returns API Key 信息（如果验证成功）
   */
  async verifyApiKey(apiKey: string): Promise<ApiKeyInfo | null> {
    try {
      // 解析 API Key 格式：yunpat_<keyId>_<secret>
      // 注意：secret 部分可能包含下划线，所以限制分割次数为 3
      if (!apiKey.startsWith('yunpat_')) {
        return null;
      }

      // 移除前缀后，分割第一个下划线获取 keyId，剩余部分为 secret
      const remaining = apiKey.slice('yunpat_'.length);
      const firstUnderscoreIndex = remaining.indexOf('_');

      if (firstUnderscoreIndex === -1) {
        return null;
      }

      const keyId = remaining.slice(0, firstUnderscoreIndex);
      const secret = remaining.slice(firstUnderscoreIndex + 1);

      if (!keyId || !secret) {
        return null;
      }

      // 检查速率限制
      const rateLimitOk = await this.checkRateLimit(keyId);
      if (!rateLimitOk) {
        return null;
      }

      // 从存储中查找
      const stored = await this.store.find(keyId);

      if (!stored) {
        return null;
      }

      const { apiKeyHash, info } = stored;

      // 检查是否启用
      if (!info.enabled) {
        return null;
      }

      // 检查是否过期
      if (info.expiresAt && info.expiresAt < new Date()) {
        return null;
      }

      // 验证哈希（使用 timing-safe 比较防止时序攻击）
      const secretHash = this.hashApiKey(secret);

      if (
        !timingSafeEqual(
          Buffer.from(apiKeyHash),
          Buffer.from(secretHash)
        )
      ) {
        return null;
      }

      // 返回完整的 info 对象
      return {
        keyId: info.keyId,
        userId: info.userId,
        username: info.username,
        roles: info.roles,
        permissions: info.permissions,
        createdAt: info.createdAt,
        expiresAt: info.expiresAt,
        enabled: info.enabled,
        rateLimit: info.rateLimit,
        note: info.note,
      };
    } catch {
      return null;
    }
  }

  /**
   * 删除 API Key
   */
  async deleteApiKey(keyId: string): Promise<void> {
    await this.store.delete(keyId);
  }

  /**
   * 列出用户的所有 API Key
   */
  async listUserApiKeys(userId: string): Promise<
    Array<{ keyId: string; info: ApiKeyInfo }>
  > {
    return await this.store.listByUser(userId);
  }

  /**
   * 清理过期的 API Key
   */
  async cleanupExpired(): Promise<number> {
    return await this.store.cleanupExpired();
  }

  /**
   * 生成 Key ID
   */
  private generateKeyId(): string {
    return randomBytes(8).toString('base64url');
  }

  /**
   * 哈希 API Key
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
