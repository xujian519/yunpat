/**
 * 会话管理器
 *
 * 管理用户会话、状态和权限
 */
import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'
/**
 * 内存会话存储（用于开发/测试）
 */
export class InMemorySessionStore {
  store = new Map()
  async save(session) {
    this.store.set(session.sessionId, session)
  }
  async find(sessionId) {
    const session = this.store.get(sessionId)
    if (!session) {
      return null
    }
    // 检查是否过期
    if (session.expiresAt < new Date()) {
      this.store.delete(sessionId)
      return null
    }
    return session
  }
  async delete(sessionId) {
    this.store.delete(sessionId)
  }
  async updateLastActive(sessionId, lastActiveAt) {
    const session = this.store.get(sessionId)
    if (session) {
      session.lastActiveAt = lastActiveAt
      this.store.set(sessionId, session)
    }
  }
  async cleanupExpired() {
    const now = new Date()
    let cleaned = 0
    for (const [sessionId, session] of this.store.entries()) {
      if (session.expiresAt < now) {
        this.store.delete(sessionId)
        cleaned++
      }
    }
    return cleaned
  }
  async findByUser(userId) {
    const sessions = []
    for (const session of this.store.values()) {
      if (session.userId === userId && session.expiresAt > new Date()) {
        sessions.push(session)
      }
    }
    return sessions
  }
}
/**
 * 会话管理器
 */
export class SessionManager extends EventEmitter {
  store
  cleanupTimer
  config
  constructor(store, config) {
    super()
    this.store = store || new InMemorySessionStore()
    this.config = {
      maxSessionsPerUser: config?.maxSessionsPerUser || 10,
      cleanupInterval: config?.cleanupInterval || 5 * 60 * 1000, // 5 分钟
    }
    // 定期清理过期会话
    this.startCleanup()
  }
  /**
   * 创建新会话
   */
  async createSession(options) {
    // 检查用户会话数量限制
    if (this.config.maxSessionsPerUser) {
      const existingSessions = await this.store.findByUser(options.userId)
      // 如果超过限制，删除最旧的会话
      if (existingSessions.length >= this.config.maxSessionsPerUser) {
        const oldestSession = existingSessions.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )[0]
        await this.deleteSession(oldestSession.sessionId)
      }
    }
    const now = new Date()
    const ttl = options.ttl || 3600 // 默认 1 小时
    const session = {
      sessionId: this.generateSessionId(),
      userId: options.userId,
      username: options.username,
      roles: options.roles || [],
      permissions: options.permissions || [],
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + ttl * 1000),
      data: new Map(Object.entries(options.data || {})),
    }
    await this.store.save(session)
    this.emit('session:created', session)
    return session
  }
  /**
   * 获取会话
   */
  async getSession(sessionId) {
    const session = await this.store.find(sessionId)
    if (session) {
      // 更新最后活跃时间
      await this.updateLastActive(sessionId)
    }
    return session
  }
  /**
   * 更新会话最后活跃时间
   */
  async updateLastActive(sessionId) {
    await this.store.updateLastActive(sessionId, new Date())
  }
  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    await this.store.delete(sessionId)
    this.emit('session:deleted', { sessionId })
  }
  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId) {
    return await this.store.findByUser(userId)
  }
  /**
   * 删除用户的所有会话
   */
  async deleteUserSessions(userId) {
    const sessions = await this.getUserSessions(userId)
    for (const session of sessions) {
      await this.deleteSession(session.sessionId)
    }
  }
  /**
   * 检查权限
   */
  async checkPermission(sessionId, requiredPermission) {
    const session = await this.getSession(sessionId)
    if (!session) {
      return false
    }
    // 检查通配符权限
    if (session.permissions.includes('*')) {
      return true
    }
    return session.permissions.includes(requiredPermission)
  }
  /**
   * 检查角色
   */
  async hasRole(sessionId, requiredRole) {
    const session = await this.getSession(sessionId)
    if (!session) {
      return false
    }
    return session.roles.includes(requiredRole)
  }
  /**
   * 设置会话数据
   */
  async setSessionData(sessionId, key, value) {
    const session = await this.getSession(sessionId)
    if (session) {
      session.data.set(key, value)
      await this.store.save(session)
    }
  }
  /**
   * 获取会话数据
   */
  async getSessionData(sessionId, key) {
    const session = await this.getSession(sessionId)
    return session?.data.get(key)
  }
  /**
   * 清理过期会话
   */
  async cleanupExpired() {
    const cleaned = await this.store.cleanupExpired()
    if (cleaned > 0) {
      this.emit('session:cleanup', { cleaned })
    }
    return cleaned
  }
  /**
   * 停止清理定时器
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
  /**
   * 生成安全的会话 ID
   */
  generateSessionId() {
    // 使用时间戳 + 安全随机数，确保唯一性和不可预测性
    const timestamp = Date.now().toString(36)
    const random = randomBytes(16).toString('base64url')
    return `${timestamp}-${random}`
  }
  /**
   * 启动清理定时器
   */
  startCleanup() {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpired()
    }, this.config.cleanupInterval)
  }
}
//# sourceMappingURL=SessionManager.js.map
