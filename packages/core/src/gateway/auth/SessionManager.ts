/**
 * 会话管理器
 *
 * 管理用户会话、状态和权限
 */

import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'

/**
 * 会话信息
 */
export interface Session {
  /** 会话 ID */
  sessionId: string

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

  /** 最后活跃时间 */
  lastActiveAt: Date

  /** 过期时间 */
  expiresAt: Date

  /** 会话数据 */
  data: Map<string, unknown>
}

/**
 * 会话创建选项
 */
export interface SessionOptions {
  /** 用户 ID */
  userId: string

  /** 用户名 */
  username?: string

  /** 用户角色 */
  roles?: string[]

  /** 权限列表 */
  permissions?: string[]

  /** 会话时长（秒） */
  ttl?: number

  /** 初始会话数据 */
  data?: Record<string, unknown>
}

/**
 * 会话管理器配置
 */
export interface SessionManagerConfig {
  /** 每用户最大会话数（可选，默认 10） */
  maxSessionsPerUser?: number

  /** 会话清理间隔（毫秒，默认 5 分钟） */
  cleanupInterval?: number
}

/**
 * 会话存储接口
 */
export interface SessionStore {
  /** 保存会话 */
  save(session: Session): Promise<void>

  /** 查找会话 */
  find(sessionId: string): Promise<Session | null>

  /** 删除会话 */
  delete(sessionId: string): Promise<void>

  /** 更新会话最后活跃时间 */
  updateLastActive(sessionId: string, lastActiveAt: Date): Promise<void>

  /** 清理过期会话 */
  cleanupExpired(): Promise<number>

  /** 获取用户的所有会话 */
  findByUser(userId: string): Promise<Session[]>
}

/**
 * 内存会话存储（用于开发/测试）
 */
export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, Session>()

  async save(session: Session): Promise<void> {
    this.store.set(session.sessionId, session)
  }

  async find(sessionId: string): Promise<Session | null> {
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

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }

  async updateLastActive(sessionId: string, lastActiveAt: Date): Promise<void> {
    const session = this.store.get(sessionId)

    if (session) {
      session.lastActiveAt = lastActiveAt
      this.store.set(sessionId, session)
    }
  }

  async cleanupExpired(): Promise<number> {
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

  async findByUser(userId: string): Promise<Session[]> {
    const sessions: Session[] = []

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
  private store: SessionStore
  private cleanupTimer?: NodeJS.Timeout
  private config: SessionManagerConfig

  constructor(store?: SessionStore, config?: SessionManagerConfig) {
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
  async createSession(options: SessionOptions): Promise<Session> {
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

    const session: Session = {
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
  async getSession(sessionId: string): Promise<Session | null> {
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
  async updateLastActive(sessionId: string): Promise<void> {
    await this.store.updateLastActive(sessionId, new Date())
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.store.delete(sessionId)

    this.emit('session:deleted', { sessionId })
  }

  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return await this.store.findByUser(userId)
  }

  /**
   * 删除用户的所有会话
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId)

    for (const session of sessions) {
      await this.deleteSession(session.sessionId)
    }
  }

  /**
   * 检查权限
   */
  async checkPermission(sessionId: string, requiredPermission: string): Promise<boolean> {
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
  async hasRole(sessionId: string, requiredRole: string): Promise<boolean> {
    const session = await this.getSession(sessionId)

    if (!session) {
      return false
    }

    return session.roles.includes(requiredRole)
  }

  /**
   * 设置会话数据
   */
  async setSessionData(sessionId: string, key: string, value: unknown): Promise<void> {
    const session = await this.getSession(sessionId)

    if (session) {
      session.data.set(key, value)
      await this.store.save(session)
    }
  }

  /**
   * 获取会话数据
   */
  async getSessionData(sessionId: string, key: string): Promise<unknown | undefined> {
    const session = await this.getSession(sessionId)

    return session?.data.get(key)
  }

  /**
   * 清理过期会话
   */
  async cleanupExpired(): Promise<number> {
    const cleaned = await this.store.cleanupExpired()

    if (cleaned > 0) {
      this.emit('session:cleanup', { cleaned })
    }

    return cleaned
  }

  /**
   * 停止清理定时器
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  /**
   * 生成安全的会话 ID
   */
  private generateSessionId(): string {
    // 使用时间戳 + 安全随机数，确保唯一性和不可预测性
    const timestamp = Date.now().toString(36)
    const random = randomBytes(16).toString('base64url')
    return `${timestamp}-${random}`
  }

  /**
   * 启动清理定时器
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpired()
    }, this.config.cleanupInterval)
  }
}
