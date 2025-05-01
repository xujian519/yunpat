/**
 * 内存审计日志存储（用于测试）
 *
 * ⚠️ 警告：这个实现使用内存存储，数据不持久化
 * 仅适用于开发和测试环境
 * 生产环境应该使用 SqliteAuditStore
 */

import type { AuditLog, AuditLogStore, AuditLogFilter } from '../Gateway.js'

/**
 * 内存审计存储配置
 */
export interface InMemoryAuditStoreConfig {
  /** 最大日志条数（默认 10000） */
  maxLogs?: number
}

/**
 * 内存审计日志存储
 */
export class InMemoryAuditStore implements AuditLogStore {
  private logs: AuditLog[] = []
  private config: InMemoryAuditStoreConfig

  constructor(config: InMemoryAuditStoreConfig = {}) {
    this.config = {
      maxLogs: 10000,
      ...config,
    }
  }

  /**
   * 写入审计日志
   */
  async write(log: AuditLog): Promise<void> {
    this.logs.push({ ...log })

    // 限制日志数量
    if (this.logs.length > this.config.maxLogs!) {
      this.logs.shift() // 删除最旧的日志
    }
  }

  /**
   * 查询审计日志
   */
  async query(filter: AuditLogFilter = {}): Promise<AuditLog[]> {
    let result = [...this.logs]

    // 时间范围过滤
    if (filter.timeRange) {
      const { start, end } = filter.timeRange
      result = result.filter((log) => {
        const timestamp = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)
        return timestamp >= start && timestamp <= end
      })
    }

    // 用户 ID 过滤
    if (filter.userId) {
      result = result.filter((log) => log.userId === filter.userId)
    }

    // 智能体名称过滤
    if (filter.agentName) {
      result = result.filter((log) => log.agentName === filter.agentName)
    }

    // 动作过滤
    if (filter.action) {
      result = result.filter((log) => log.action === filter.action)
    }

    // 结果过滤
    if (filter.result !== undefined) {
      result = result.filter((log) => log.result === filter.result)
    }

    // 按时间倒序排序
    result.sort((a, b) => {
      const timeA =
        a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
      const timeB =
        b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
      return timeB - timeA
    })

    return result
  }

  /**
   * 统计审计日志
   */
  async stats(
    metrics: { byAction?: boolean; byUser?: boolean; byAgent?: boolean; byResult?: boolean } = {}
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {}

    if (metrics.byAction) {
      for (const log of this.logs) {
        const key = `action:${log.action}`
        result[key] = (result[key] || 0) + 1
      }
    }

    if (metrics.byUser) {
      for (const log of this.logs) {
        const key = `user:${log.userId}`
        result[key] = (result[key] || 0) + 1
      }
    }

    if (metrics.byAgent) {
      for (const log of this.logs) {
        const key = `agent:${log.agentName}`
        result[key] = (result[key] || 0) + 1
      }
    }

    if (metrics.byResult) {
      for (const log of this.logs) {
        const key = `result:${log.result}`
        result[key] = (result[key] || 0) + 1
      }
    }

    return result
  }

  /**
   * 清空所有日志（测试辅助方法）
   */

  async clear(): Promise<void> {
    this.logs = []
  }

  /**
   * 关闭存储（无操作，内存存储不需要关闭）
   */
  async close(): Promise<void> {
    // 内存存储不需要关闭
  }
}
