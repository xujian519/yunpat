/**
 * 性能监控系统
 *
 * 为审查答复智能体系统提供性能监控和分析功能
 */

import { Logger, createModuleLogger } from './logger.js'

const logger = createModuleLogger('PerformanceMonitor')

/**
 * 性能指标
 */
export interface PerformanceMetric {
  /** 操作名称 */
  operation: string

  /** 开始时间 */
  startTime: number

  /** 结束时间 */
  endTime?: number

  /** 持续时间（毫秒） */
  duration?: number

  /** 成功/失败 */
  success?: boolean

  /** 元数据 */
  metadata?: Record<string, any>
}

/**
 * 性能统计
 */
export interface PerformanceStats {
  /** 总次数 */
  count: number

  /** 平均持续时间 */
  avg: number

  /** 最小持续时间 */
  min: number

  /** 最大持续时间 */
  max: number

  /** 总持续时间 */
  total: number

  /** 成功次数 */
  successCount: number

  /** 失败次数 */
  failureCount: number

  /** 成功率 */
  successRate: number
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  /** 报告生成时间 */
  reportTime: string

  /** 操作统计 */
  operations: Record<string, PerformanceStats>

  /** 总体统计 */
  summary: {
    totalOperations: number
    totalDuration: number
    avgDuration: number
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>()
  private logger: Logger

  constructor() {
    this.logger = Logger.getInstance()
  }

  /**
   * 开始监控操作
   */
  start(operation: string, metadata?: Record<string, any>): () => void {
    const metric: PerformanceMetric = {
      operation,
      startTime: Date.now(),
      metadata,
    }

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    this.metrics.get(operation)!.push(metric)

    // 返回结束函数
    return () => this.end(operation, metric, true)
  }

  /**
   * 结束监控操作
   */
  private end(
    operation: string,
    metric: PerformanceMetric,
    success: boolean
  ): void {
    metric.endTime = Date.now()
    metric.duration = metric.endTime - metric.startTime
    metric.success = success

    if (success) {
      this.logger.debug(`操作完成: ${operation}`, {
        duration: metric.duration,
        ...metric.metadata,
      })
    }
  }

  /**
   * 测量异步操作
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const stop = this.start(operation, metadata)

    try {
      const result = await fn()
      return result
    } catch (error) {
      // 标记为失败但仍然结束计时
      const metrics = this.metrics.get(operation)
      if (metrics && metrics.length > 0) {
        const lastMetric = metrics[metrics.length - 1]
        this.end(operation, lastMetric, false)
      }
      throw error
    } finally {
      stop()
    }
  }

  /**
   * 测量同步操作
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const stop = this.start(operation, metadata)

    try {
      return fn()
    } catch (error) {
      const metrics = this.metrics.get(operation)
      if (metrics && metrics.length > 0) {
        const lastMetric = metrics[metrics.length - 1]
        this.end(operation, lastMetric, false)
      }
      throw error
    } finally {
      stop()
    }
  }

  /**
   * 获取操作统计
   */
  getStats(operation: string): PerformanceStats | undefined {
    const metrics = this.metrics.get(operation)
    if (!metrics || metrics.length === 0) {
      return undefined
    }

    const completedMetrics = metrics.filter((m) => m.duration !== undefined)
    if (completedMetrics.length === 0) {
      return undefined
    }

    const durations = completedMetrics.map((m) => m.duration!)
    const successCount = metrics.filter((m) => m.success === true).length
    const failureCount = metrics.filter((m) => m.success === false).length

    return {
      count: metrics.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      total: durations.reduce((a, b) => a + b, 0),
      successCount,
      failureCount,
      successRate: (successCount / metrics.length) * 100,
    }
  }

  /**
   * 获取所有操作统计
   */
  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {}

    for (const operation of this.metrics.keys()) {
      const operationStats = this.getStats(operation)
      if (operationStats) {
        stats[operation] = operationStats
      }
    }

    return stats
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const stats = this.getAllStats()
    const allDurations: number[] = []

    for (const stat of Object.values(stats)) {
      allDurations.push(stat.avg)
    }

    const summary = {
      totalOperations: Object.values(stats).reduce((sum, stat) => sum + stat.count, 0),
      totalDuration: Object.values(stats).reduce((sum, stat) => sum + stat.total, 0),
      avgDuration: allDurations.length > 0
        ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
        : 0,
    }

    return {
      reportTime: new Date().toISOString(),
      operations: stats,
      summary,
    }
  }

  /**
   * 打印性能报告
   */
  printReport(): void {
    const report = this.generateReport()

    console.log('\n📊 性能监控报告')
    console.log('=' .repeat(60))
    console.log(`报告时间: ${report.reportTime}`)
    console.log('\n📈 总体统计:')
    console.log(`  总操作数: ${report.summary.totalOperations}`)
    console.log(`  总耗时: ${report.summary.totalDuration.toFixed(2)}ms`)
    console.log(`  平均耗时: ${report.summary.avgDuration.toFixed(2)}ms`)

    console.log('\n📋 操作详情:')
    for (const [operation, stats] of Object.entries(report.operations)) {
      console.log(`\n  ${operation}:`)
      console.log(`    次数: ${stats.count}`)
      console.log(`    平均: ${stats.avg.toFixed(2)}ms`)
      console.log(`    最小: ${stats.min}ms`)
      console.log(`    最大: ${stats.max}ms`)
      console.log(`    成功率: ${stats.successRate.toFixed(1)}%`)
    }

    console.log('\n' + '='.repeat(60))
  }

  /**
   * 清除指标
   */
  clear(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation)
    } else {
      this.metrics.clear()
    }
  }

  /**
   * 获取慢操作（超过阈值）
   */
  getSlowOperations(thresholdMs: number): Array<{
    operation: string
    avg: number
    count: number
  }> {
    const slowOps: Array<{ operation: string; avg: number; count: number }> = []

    for (const [operation, stats] of Object.entries(this.getAllStats())) {
      if (stats.avg > thresholdMs) {
        slowOps.push({
          operation,
          avg: stats.avg,
          count: stats.count,
        })
      }
    }

    // 按平均耗时排序
    slowOps.sort((a, b) => b.avg - a.avg)

    return slowOps
  }

  /**
   * 导出为 JSON
   */
  exportAsJSON(): string {
    const report = this.generateReport()
    return JSON.stringify(report, null, 2)
  }

  /**
   * 保存到文件
   */
  async saveToFile(filePath: string): Promise<void> {
    try {
      const { writeFileSync } = await import('fs')
      writeFileSync(filePath, this.exportAsJSON(), 'utf-8')
      this.logger.info(`性能报告已保存到: ${filePath}`)
    } catch (error) {
      this.logger.error('保存性能报告失败', error as Error)
    }
  }
}

/**
 * 性能监控装饰器
 */
export function monitorPerformance(
  operation?: string
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    const monitor = new PerformanceMonitor()
    const operationName = operation ?? `${target.constructor.name}.${String(propertyKey)}`

    descriptor.value = async function (...args: any[]) {
      return monitor.measure(operationName, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

/**
 * 全局性能监控器实例
 */
export const globalPerformanceMonitor = new PerformanceMonitor()

/**
 * 性能监控工具函数
 */

/**
 * 测量异步函数
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return globalPerformanceMonitor.measure(operation, fn, metadata)
}

/**
 * 测量同步函数
 */
export function measurePerformanceSync<T>(
  operation: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  return globalPerformanceMonitor.measureSync(operation, fn, metadata)
}

/**
 * 获取性能统计
 */
export function getPerformanceStats(operation: string): PerformanceStats | undefined {
  return globalPerformanceMonitor.getStats(operation)
}

/**
 * 打印性能报告
 */
export function printPerformanceReport(): void {
  globalPerformanceMonitor.printReport()
}

/**
 * 导出性能报告
 */
export function exportPerformanceReport(): string {
  return globalPerformanceMonitor.exportAsJSON()
}

/**
 * 获取慢操作
 */
export function getSlowOperations(thresholdMs: number = 5000): Array<{
  operation: string
  avg: number
  count: number
}> {
  return globalPerformanceMonitor.getSlowOperations(thresholdMs)
}

/**
 * 性能预算
 */
export class PerformanceBudget {
  private budgets = new Map<string, number>()

  /**
   * 设置操作预算
   */
  setBudget(operation: string, maxDurationMs: number): void {
    this.budgets.set(operation, maxDurationMs)
  }

  /**
   * 检查是否超预算
   */
  checkBudget(operation: string, actualDuration: number): boolean {
    const budget = this.budgets.get(operation)
    if (!budget) {
      return true // 没有预算限制
    }

    return actualDuration <= budget
  }

  /**
   * 获取超预算的操作
   */
  getOverBudget(stats: Record<string, PerformanceStats>): Array<{
    operation: string
    budget: number
    actual: number
    over: number
  }> {
    const overBudget: Array<{
      operation: string
      budget: number
      actual: number
      over: number
    }> = []

    for (const [operation, stat] of Object.entries(stats)) {
      const budget = this.budgets.get(operation)
      if (budget && stat.avg > budget) {
        overBudget.push({
          operation,
          budget,
          actual: stat.avg,
          over: stat.avg - budget,
        })
      }
    }

    overBudget.sort((a, b) => b.over - a.over)

    return overBudget
  }
}

/**
 * 性能告警器
 */
export class PerformanceAlertManager {
  private thresholds = new Map<string, number>()

  /**
   * 设置告警阈值
   */
  setThreshold(operation: string, thresholdMs: number): void {
    this.thresholds.set(operation, thresholdMs)
  }

  /**
   * 检查是否需要告警
   */
  checkAlert(operation: string, actualDuration: number): boolean {
    const threshold = this.thresholds.get(operation)
    if (!threshold) {
      return false
    }

    return actualDuration > threshold
  }

  /**
   * 获取所有告警
   */
  getAlerts(stats: Record<string, PerformanceStats>): Array<{
    operation: string
    threshold: number
    actual: number
    severity: 'warning' | 'critical'
  }> {
    const alerts: Array<{
      operation: string
      threshold: number
      actual: number
      severity: 'warning' | 'critical'
    }> = []

    for (const [operation, stat] of Object.entries(stats)) {
      const threshold = this.thresholds.get(operation)
      if (threshold && stat.avg > threshold) {
        alerts.push({
          operation,
          threshold,
          actual: stat.avg,
          severity: stat.avg > threshold * 2 ? 'critical' : 'warning',
        })
      }
    }

    return alerts
  }
}

/**
 * 性能趋势分析
 */
export class PerformanceTrendAnalyzer {
  private history: Array<{
    timestamp: number
    stats: Record<string, PerformanceStats>
  }> = []

  /**
   * 记录当前快照
   */
  recordSnapshot(stats: Record<string, PerformanceStats>): void {
    this.history.push({
      timestamp: Date.now(),
      stats: JSON.parse(JSON.stringify(stats)), // 深拷贝
    })

    // 只保留最近 100 个快照
    if (this.history.length > 100) {
      this.history.shift()
    }
  }

  /**
   * 分析趋势
   */
  analyzeTrend(operation: string, windowSize: number = 10): {
    direction: 'improving' | 'degrading' | 'stable'
    changeRate: number
    confidence: number
  } | null {
    const recent = this.history.slice(-windowSize)
    if (recent.length < 2) {
      return null
    }

    const values = recent
      .map((snapshot) => snapshot.stats[operation]?.avg)
      .filter((v) => v !== undefined) as number[]

    if (values.length < 2) {
      return null
    }

    // 计算线性回归
    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const avg = sumY / n

    // 判断趋势
    let direction: 'improving' | 'degrading' | 'stable'
    const threshold = avg * 0.1 // 10% 变化阈值

    if (slope > threshold) {
      direction = 'degrading' // 上升是坏事（耗时增加）
    } else if (slope < -threshold) {
      direction = 'improving' // 下降是好事（耗时减少）
    } else {
      direction = 'stable'
    }

    // 计算置信度（基于 R²）
    const yMean = sumY / n
    const ssTot = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0)
    const ssRes = values.reduce((sum, y, i) => {
      const predicted = slope * i + (sumY - slope * sumX) / n
      return sum + Math.pow(y - predicted, 2)
    }, 0)
    const rSquared = 1 - ssRes / ssTot

    return {
      direction,
      changeRate: slope,
      confidence: rSquared,
    }
  }
}
