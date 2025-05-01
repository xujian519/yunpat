/**
 * JWT Token 管理器
 *
 * 负责 JWT Token 的生成、验证和刷新
 */
import { sign, verify, TokenExpiredError } from 'jsonwebtoken'
import { randomBytes } from 'crypto'
/**
 * 内存 Token 存储（用于开发/测试）
 */
export class InMemoryTokenStore {
  store = new Map()
  async save(tokenId, payload, expiresIn) {
    this.store.set(tokenId, {
      payload,
      expiresAt: Date.now() + expiresIn * 1000,
    })
  }
  async find(tokenId) {
    const data = this.store.get(tokenId)
    if (!data) {
      return null
    }
    // 检查是否过期
    if (data.expiresAt < Date.now()) {
      this.store.delete(tokenId)
      return null
    }
    return data.payload
  }
  async delete(tokenId) {
    this.store.delete(tokenId)
  }
  async cleanupExpired() {
    const now = Date.now()
    let cleaned = 0
    for (const [tokenId, data] of this.store.entries()) {
      if (data.expiresAt < now) {
        this.store.delete(tokenId)
        cleaned++
      }
    }
    return cleaned
  }
}
/**
 * JWT Token 管理器
 */
export class JwtManager {
  config
  store
  constructor(config = {}, store) {
    // 安全检查：强制要求提供密钥
    const secret = config.secret || process.env.JWT_SECRET
    if (!secret || secret === 'yunpat-secret-key') {
      throw new Error(
        'JWT_SECRET must be provided in production environment. ' +
          'Set it via config.secret or environment variable JWT_SECRET.'
      )
    }
    this.config = {
      secret,
      accessTokenExpiresIn: config.accessTokenExpiresIn || 3600, // 1 小时
      refreshTokenExpiresIn: config.refreshTokenExpiresIn || 86400 * 7, // 7 天
      algorithm: config.algorithm || 'HS256',
      issuer: config.issuer || 'yunpat',
      userDataProvider: config.userDataProvider, // 用户数据提供者
    }
    this.store = store || new InMemoryTokenStore()
  }
  /**
   * 生成 Token 对
   *
   * @param userId 用户 ID
   * @param roles 用户角色
   * @param permissions 用户权限
   * @returns Token 对
   */
  async generateTokenPair(userId, roles, permissions) {
    const now = Math.floor(Date.now() / 1000)
    // 生成访问 Token
    const accessTokenPayload = {
      sub: userId,
      roles,
      permissions,
    }
    const accessToken = sign(accessTokenPayload, this.config.secret, {
      expiresIn: this.config.accessTokenExpiresIn,
      issuer: this.config.issuer,
      jwtid: this.generateTokenId(),
    })
    // 解析 Token 以获取 jti
    const decoded = verify(accessToken, this.config.secret, {
      complete: true,
    })
    // 保存到存储
    await this.store.save(decoded.payload.jti, decoded.payload, this.config.accessTokenExpiresIn)
    // 生成刷新 Token
    const refreshTokenPayload = {
      sub: userId,
      type: 'refresh',
    }
    const refreshToken = sign(refreshTokenPayload, this.config.secret, {
      expiresIn: this.config.refreshTokenExpiresIn,
      issuer: this.config.issuer,
      jwtid: this.generateTokenId(),
    })
    // 计算过期时间
    const expiresAt = now + this.config.accessTokenExpiresIn
    return {
      accessToken,
      refreshToken,
      expiresAt,
    }
  }
  /**
   * 验证访问 Token
   *
   * @param token 访问 Token
   * @returns 验证结果（包含详细错误信息）
   */
  async verifyAccessToken(token) {
    try {
      const decoded = verify(token, this.config.secret, {
        issuer: this.config.issuer,
      })
      // 检查 Token 是否被撤销
      const stored = await this.store.find(decoded.jti)
      if (!stored) {
        return { success: false, error: 'revoked' }
      }
      return { success: true, payload: decoded }
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        return { success: false, error: 'expired' }
      }
      return { success: false, error: 'invalid' }
    }
  }
  /**
   * 验证访问 Token（兼容旧接口）
   *
   * @deprecated 使用 verifyAccessToken 获取详细错误信息
   */
  async verifyAccessTokenCompat(token) {
    const result = await this.verifyAccessToken(token)
    return result.payload || null
  }
  /**
   * 刷新 Token
   *
   * @param refreshToken 刷新 Token
   * @returns 新的 Token 对（如果刷新成功）
   */
  async refreshTokens(refreshToken) {
    try {
      const decoded = verify(refreshToken, this.config.secret, {
        issuer: this.config.issuer,
      })
      // 检查是否为刷新 Token
      if (decoded.type !== 'refresh') {
        return null
      }
      // 获取用户数据
      let roles
      let permissions
      if (this.config.userDataProvider) {
        // 从提供者获取最新的用户数据
        const userData = await this.config.userDataProvider.getUserData(decoded.sub)
        if (!userData) {
          // 用户不存在，刷新失败
          return null
        }
        roles = userData.roles
        permissions = userData.permissions
      } else {
        // 向后兼容：如果没有提供用户数据提供者，使用默认值
        // 生产环境应该提供 userDataProvider
        console.warn(
          '[JwtManager] No userDataProvider configured, using default roles/permissions. ' +
            'This is not recommended for production.'
        )
        roles = ['user']
        permissions = ['read', 'write']
      }
      // 生成新的 Token 对
      return await this.generateTokenPair(decoded.sub, roles, permissions)
    } catch {
      return null
    }
  }
  /**
   * 撤销 Token
   *
   * @param token 要撤销的 Token
   */
  async revokeToken(token) {
    try {
      const decoded = verify(token, this.config.secret, {
        issuer: this.config.issuer,
      })
      await this.store.delete(decoded.jti)
    } catch {
      // Token 无效，忽略
    }
  }
  /**
   * 清理过期的 Token
   */
  async cleanupExpired() {
    return await this.store.cleanupExpired()
  }
  /**
   * 生成安全的 Token ID
   */
  generateTokenId() {
    // 使用 crypto.randomBytes 生成安全的随机 ID
    return randomBytes(16).toString('base64url')
  }
}
//# sourceMappingURL=JwtManager.js.map
