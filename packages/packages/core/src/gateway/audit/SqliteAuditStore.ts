/**
 * SQLite 审计日志存储实现
 *
 * 提供审计日志的持久化存储和查询功能
 */

import Database from 'better-sqlite3'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import type { AuditLog, AuditLogFilter, AuditLogStore, AuditMetrics } from '../Gateway.js'

/**
 * SQLite 审计日志存储配置
 */
export interface SqliteAuditStoreConfig {
  /** 数据库文件路径 */
  dbPath: string

  /** 是否创建数据库目录 */
  createDir?: boolean

  /** 日志保留天数（0 表示永久保留） */
  retentionDays?: number
}

/**
 * SQLite 审计日志存储实现
 */
export class SqliteAuditStore implements AuditLogStore {
  private db: Database.Database
  private retentionDays: number
  private cleanupScheduler?: NodeJS.Timeout

  constructor(config: SqliteAuditStoreConfig) {
    this.retentionDays = config.retentionDays || 0

    // 创建数据库目录
    if (config.createDir !== false) {
      mkdir(dirname(config.dbPath), { recursive: true }).catch(() => {
        // 忽略目录已存在的错误
      })
    }

    // 打开数据库
    this.db = new Database(config.dbPath)

    // 启用 WAL 模式，提高并发性能
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')

    // 初始化表结构
    this.initSchema()

    // 启动定期清理任务
    this.startPeriodicCleanup()
  }

  /**
   * 初始化数据库表结构
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        user_id TEXT,
        agent_name TEXT,
        action TEXT NOT NULL,
        resource TEXT,
        result TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_agent_name ON audit_logs(agent_name);
      CREATE INDEX IF NOT EXISTS idx_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_result ON audit_logs(result);
    `)
  }

  /**
   * 写入审计日志
   */
  async write(log: AuditLog): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        timestamp, user_id, agent_name, action, resource, result, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      log.timestamp.getTime(),
      log.userId || null,
      log.agentName || null,
      log.action,
      log.resource || null,
      log.result,
      log.details ? JSON.stringify(log.details) : null,
      log.ipAddress || null
    )
  }

  /**
   * 批量写入审计日志（使用事务）
   */
  async writeBatch(logs: AuditLog[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT INTO audit_logs (
        timestamp, user_id, agent_name, action, resource, result, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = this.db.transaction((logs: AuditLog[]) => {
      for (const log of logs) {
        insert.run(
          log.timestamp.getTime(),
          log.userId || null,
          log.agentName || null,
          log.action,
          log.resource || null,
          log.result,
          log.details ? JSON.stringify(log.details) : null,
          log.ipAddress || null
        )
      }
    })

    transaction(logs)
  }

  /**
   * 查询审计日志
   */
  async query(filter: AuditLogFilter): Promise<AuditLog[]> {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1'
    const params: unknown[] = []

    // 时间范围过滤
    if (filter.timeRange) {
      sql += ' AND timestamp >= ? AND timestamp <= ?'
      params.push(filter.timeRange.start.getTime(), filter.timeRange.end.getTime())
    }

    // 用户 ID 过滤
    if (filter.userId) {
      sql += ' AND user_id = ?'
      params.push(filter.userId)
    }

    // 智能体名称过滤
    if (filter.agentName) {
      sql += ' AND agent_name = ?'
      params.push(filter.agentName)
    }

    // 动作过滤
    if (filter.action) {
      sql += ' AND action = ?'
      params.push(filter.action)
    }

    // 结果过滤
    if (filter.result) {
      sql += ' AND result = ?'
      params.push(filter.result)
    }

    // 按时间倒序排序
    sql += ' ORDER BY timestamp DESC'

    // 限制结果数量（最多 1000 条）
    sql += ' LIMIT 1000'

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as Array<Record<string, unknown>>

    return rows.map((row) => ({
      timestamp: new Date(row.timestamp as string),
      userId: row.user_id as string,
      agentName: row.agent_name as string,
      action: row.action as string,
      resource: row.resource as string,
      result: row.result as string,
      details: row.details ? JSON.parse(row.details as string) : undefined,
      ipAddress: row.ip_address as string,
    }))
  }

  /**
   * 统计审计指标
   */
  async stats(metrics: AuditMetrics): Promise<Record<string, number>> {
    const result: Record<string, number> = {}

    if (metrics.byAction) {
      const stmt = this.db.prepare(`
        SELECT action, COUNT(*) as count
        FROM audit_logs
        GROUP BY action
      `)

      const rows = stmt.all() as { action: string; count: number }[]

      for (const row of rows) {
        result[`action:${row.action}`] = row.count
      }
    }

    if (metrics.byUser) {
      const stmt = this.db.prepare(`
        SELECT user_id, COUNT(*) as count
        FROM audit_logs
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      `)

      const rows = stmt.all() as { user_id: string; count: number }[]

      for (const row of rows) {
        result[`user:${row.user_id}`] = row.count
      }
    }

    if (metrics.byAgent) {
      const stmt = this.db.prepare(`
        SELECT agent_name, COUNT(*) as count
        FROM audit_logs
        WHERE agent_name IS NOT NULL
        GROUP BY agent_name
      `)

      const rows = stmt.all() as { agent_name: string; count: number }[]

      for (const row of rows) {
        result[`agent:${row.agent_name}`] = row.count
      }
    }

    if (metrics.byResult) {
      const stmt = this.db.prepare(`
        SELECT result, COUNT(*) as count
        FROM audit_logs
        GROUP BY result
      `)

      const rows = stmt.all() as { result: string; count: number }[]

      for (const row of rows) {
        result[`result:${row.result}`] = row.count
      }
    }

    return result
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(): Promise<number> {
    if (this.retentionDays <= 0) {
      return 0
    }

    const cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000

    const stmt = this.db.prepare(`
      DELETE FROM audit_logs
      WHERE timestamp < ?
    `)

    const result = stmt.run(cutoffTime)

    return result.changes
  }

  /**
   * 获取日志总数
   */
  async getCount(): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM audit_logs')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * 获取最近的日志
   */
  async getRecentLogs(limit: number = 100): Promise<AuditLog[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `)

     const rows = stmt.all(limit) as Array<Record<string, unknown>>
 
     return rows.map((row) => ({
       timestamp: new Date(row.timestamp as string),
       userId: row.user_id as string,
       agentName: row.agent_name as string,
       action: row.action as string,
       resource: row.resource as string,
       result: row.result as string,
       details: row.details ? JSON.parse(row.details as string) : undefined,
       ipAddress: row.ip_address as string,
     }))
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.stopPeriodicCleanup()
    this.db.close()
  }

  /**
   * 启动定期清理任务
   */
  private startPeriodicCleanup(intervalMs: number = 3600000): void {
    this.cleanupScheduler = setInterval(async () => {
      try {
        const cleaned = await this.cleanupOldLogs()
        if (cleaned > 0) {
          console.log(`[AuditStore] Cleaned ${cleaned} old logs`)
        }
      } catch (err) {
        console.error('[AuditStore] Cleanup error:', err)
      }
    }, intervalMs)
  }

  /**
   * 停止定期清理任务
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupScheduler) {
      clearInterval(this.cleanupScheduler)
      this.cleanupScheduler = undefined
    }
  }

  /**
   * 执行 VACUUM 优化数据库
   */
  vacuum(): void {
    this.db.exec('VACUUM')
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): {
    logCount: Promise<number>
    dbSize: number
    retentionDays: number
  } {
    const logCount = this.getCount()
    const dbSize =
      (this.db.pragma('page_count', { simple: true }) as number) *
      (this.db.pragma('page_size', { simple: true }) as number)

    return {
      logCount,
      dbSize,
      retentionDays: this.retentionDays,
    }
  }
}
