/**
 * 会话管理器
 *
 * 管理用户会话、状态和权限
 */
import { EventEmitter } from 'events'
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
export declare class InMemorySessionStore implements SessionStore {
  private store
  save(session: Session): Promise<void>
  find(sessionId: string): Promise<Session | null>
  delete(sessionId: string): Promise<void>
  updateLastActive(sessionId: string, lastActiveAt: Date): Promise<void>
  cleanupExpired(): Promise<number>
  findByUser(userId: string): Promise<Session[]>
}
/**
 * 会话管理器
 */
export declare class SessionManager extends EventEmitter {
  private store
  private cleanupTimer?
  private config
  constructor(store?: SessionStore, config?: SessionManagerConfig)
  /**
   * 创建新会话
   */
  createSession(options: SessionOptions): Promise<Session>
  /**
   * 获取会话
   */
  getSession(sessionId: string): Promise<Session | null>
  /**
   * 更新会话最后活跃时间
   */
  updateLastActive(sessionId: string): Promise<void>
  /**
   * 删除会话
   */
  deleteSession(sessionId: string): Promise<void>
  /**
   * 获取用户的所有会话
   */
  getUserSessions(userId: string): Promise<Session[]>
  /**
   * 删除用户的所有会话
   */
  deleteUserSessions(userId: string): Promise<void>
  /**
   * 检查权限
   */
  checkPermission(sessionId: string, requiredPermission: string): Promise<boolean>
  /**
   * 检查角色
   */
  hasRole(sessionId: string, requiredRole: string): Promise<boolean>
  /**
   * 设置会话数据
   */
  setSessionData(sessionId: string, key: string, value: unknown): Promise<void>
  /**
   * 获取会话数据
   */
  getSessionData(sessionId: string, key: string): Promise<unknown | undefined>
  /**
   * 清理过期会话
   */
  cleanupExpired(): Promise<number>
  /**
   * 停止清理定时器
   */
  stopCleanup(): void
  /**
   * 生成安全的会话 ID
   */
  private generateSessionId
  /**
   * 启动清理定时器
   */
  private startCleanup
}
//# sourceMappingURL=SessionManager.d.ts.map
