/**
 * JWT Token 管理器
 *
 * 负责 JWT Token 的生成、验证和刷新
 */

import { sign, verify, Algorithm, TokenExpiredError } from 'jsonwebtoken';
import { randomBytes } from 'crypto';

/**
 * Token 负载
 */
export interface TokenPayload {
  /** 用户 ID */
  sub: string;

  /** 用户名 */
  username?: string;

  /** 用户角色 */
  roles: string[];

  /** 权限列表 */
  permissions: string[];

  /** 签发时间 */
  iat: number;

  /** 过期时间 */
  exp: number;

  /** Token ID（用于撤销） */
  jti: string;
}

/**
 * Token 配置
 */
export interface TokenConfig {
  /** 密钥（生产环境应从环境变量读取） */
  secret: string;

  /** 访问 Token 过期时间（秒） */
  accessTokenExpiresIn: number;

  /** 刷新 Token 过期时间（秒） */
  refreshTokenExpiresIn: number;

  /** 签名算法 */
  algorithm: Algorithm;

  /** 颁发者 */
  issuer: string;

  /** 用户数据提供者（用于刷新 Token 时获取最新用户信息） */
  userDataProvider?: UserDataProvider;
}

/**
 * Token 对
 */
export interface TokenPair {
  /** 访问 Token */
  accessToken: string;

  /** 刷新 Token */
  refreshToken: string;

  /** 过期时间（Unix 时间戳） */
  expiresAt: number;
}

/**
 * Token 验证结果
 */
export interface TokenVerifyResult {
  success: boolean;
  payload?: TokenPayload;
  error?: 'invalid' | 'expired' | 'revoked';
}

/**
 * 用户数据信息
 */
export interface UserData {
  /** 用户 ID */
  userId: string;

  /** 用户角色 */
  roles: string[];

  /** 权限列表 */
  permissions: string[];
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
  getUserData(userId: string): Promise<UserData | null>;
}

/**
 * Token 存储接口（用于撤销和刷新 Token）
 */
export interface TokenStore {
  /** 保存 Token */
  save(
    tokenId: string,
    payload: TokenPayload,
    expiresIn: number
  ): Promise<void>;

  /** 查找 Token */
  find(tokenId: string): Promise<TokenPayload | null>;

  /** 删除 Token（撤销） */
  delete(tokenId: string): Promise<void>;

  /** 清理过期的 Token */
  cleanupExpired(): Promise<number>;
}

/**
 * 内存 Token 存储（用于开发/测试）
 */
export class InMemoryTokenStore implements TokenStore {
  private store = new Map<string, { payload: TokenPayload; expiresAt: number }>();

  async save(
    tokenId: string,
    payload: TokenPayload,
    expiresIn: number
  ): Promise<void> {
    this.store.set(tokenId, {
      payload,
      expiresAt: Date.now() + expiresIn * 1000,
    });
  }

  async find(tokenId: string): Promise<TokenPayload | null> {
    const data = this.store.get(tokenId);

    if (!data) {
      return null;
    }

    // 检查是否过期
    if (data.expiresAt < Date.now()) {
      this.store.delete(tokenId);
      return null;
    }

    return data.payload;
  }

  async delete(tokenId: string): Promise<void> {
    this.store.delete(tokenId);
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [tokenId, data] of this.store.entries()) {
      if (data.expiresAt < now) {
        this.store.delete(tokenId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * JWT Token 管理器
 */
export class JwtManager {
  private config: TokenConfig;
  private store: TokenStore;

  constructor(config: Partial<TokenConfig> = {}, store?: TokenStore) {
    // 安全检查：强制要求提供密钥
    const secret = config.secret || process.env.JWT_SECRET;
    if (!secret || secret === 'yunpat-secret-key') {
      throw new Error(
        'JWT_SECRET must be provided in production environment. ' +
        'Set it via config.secret or environment variable JWT_SECRET.'
      );
    }

    this.config = {
      secret,
      accessTokenExpiresIn: config.accessTokenExpiresIn || 3600, // 1 小时
      refreshTokenExpiresIn: config.refreshTokenExpiresIn || 86400 * 7, // 7 天
      algorithm: config.algorithm || 'HS256',
      issuer: config.issuer || 'yunpat',
      userDataProvider: config.userDataProvider, // 用户数据提供者
    };

    this.store = store || new InMemoryTokenStore();
  }

  /**
   * 生成 Token 对
   *
   * @param userId 用户 ID
   * @param roles 用户角色
   * @param permissions 用户权限
   * @returns Token 对
   */
  async generateTokenPair(
    userId: string,
    roles: string[],
    permissions: string[]
  ): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);

    // 生成访问 Token
    const accessTokenPayload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'> = {
      sub: userId,
      roles,
      permissions,
    };

    const accessToken = sign(
      accessTokenPayload,
      this.config.secret,
      {
        expiresIn: this.config.accessTokenExpiresIn,
        issuer: this.config.issuer,
        jwtid: this.generateTokenId(),
      }
    );

    // 解析 Token 以获取 jti
    const decoded = verify(accessToken, this.config.secret, {
      complete: true,
    }) as unknown as { payload: TokenPayload };

    // 保存到存储
    await this.store.save(
      decoded.payload.jti,
      decoded.payload,
      this.config.accessTokenExpiresIn
    );

    // 生成刷新 Token
    const refreshTokenPayload = {
      sub: userId,
      type: 'refresh',
    };

    const refreshToken = sign(refreshTokenPayload, this.config.secret, {
      expiresIn: this.config.refreshTokenExpiresIn,
      issuer: this.config.issuer,
      jwtid: this.generateTokenId(),
    });

    // 计算过期时间
    const expiresAt = now + this.config.accessTokenExpiresIn;

    return {
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * 验证访问 Token
   *
   * @param token 访问 Token
   * @returns 验证结果（包含详细错误信息）
   */
  async verifyAccessToken(token: string): Promise<TokenVerifyResult> {
    try {
      const decoded = verify(token, this.config.secret, {
        issuer: this.config.issuer,
      }) as TokenPayload;

      // 检查 Token 是否被撤销
      const stored = await this.store.find(decoded.jti);

      if (!stored) {
        return { success: false, error: 'revoked' };
      }

      return { success: true, payload: decoded };
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        return { success: false, error: 'expired' };
      }
      return { success: false, error: 'invalid' };
    }
  }

  /**
   * 验证访问 Token（兼容旧接口）
   *
   * @deprecated 使用 verifyAccessToken 获取详细错误信息
   */
  async verifyAccessTokenCompat(token: string): Promise<TokenPayload | null> {
    const result = await this.verifyAccessToken(token);
    return result.payload || null;
  }

  /**
   * 刷新 Token
   *
   * @param refreshToken 刷新 Token
   * @returns 新的 Token 对（如果刷新成功）
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
    try {
      const decoded = verify(refreshToken, this.config.secret, {
        issuer: this.config.issuer,
      }) as { sub: string; type?: string };

      // 检查是否为刷新 Token
      if (decoded.type !== 'refresh') {
        return null;
      }

      // 获取用户数据
      let roles: string[];
      let permissions: string[];

      if (this.config.userDataProvider) {
        // 从提供者获取最新的用户数据
        const userData = await this.config.userDataProvider.getUserData(decoded.sub);
        if (!userData) {
          // 用户不存在，刷新失败
          return null;
        }
        roles = userData.roles;
        permissions = userData.permissions;
      } else {
        // 向后兼容：如果没有提供用户数据提供者，使用默认值
        // 生产环境应该提供 userDataProvider
        console.warn(
          '[JwtManager] No userDataProvider configured, using default roles/permissions. ' +
          'This is not recommended for production.'
        );
        roles = ['user'];
        permissions = ['read', 'write'];
      }

      // 生成新的 Token 对
      return await this.generateTokenPair(decoded.sub, roles, permissions);
    } catch {
      return null;
    }
  }

  /**
   * 撤销 Token
   *
   * @param token 要撤销的 Token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = verify(token, this.config.secret, {
        issuer: this.config.issuer,
      }) as TokenPayload;

      await this.store.delete(decoded.jti);
    } catch {
      // Token 无效，忽略
    }
  }

  /**
   * 清理过期的 Token
   */
  async cleanupExpired(): Promise<number> {
    return await this.store.cleanupExpired();
  }

  /**
   * 生成安全的 Token ID
   */
  private generateTokenId(): string {
    // 使用 crypto.randomBytes 生成安全的随机 ID
    return randomBytes(16).toString('base64url');
  }
}
