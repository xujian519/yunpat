/**
 * 事件总线性能监控
 *
 * 用于识别性能热点：
 * - 记录每个事件的执行时间
 * - 识别慢事件（超过阈值）
 * - 统计事件调用频率
 */

export interface EventMetric {
  /** 事件类型 */
  eventType: string

  /** 执行时间列表（毫秒） */
  durations: number[]

  /** 总调用次数 */
  totalCalls: number

  /** 平均执行时间 */
  avgDuration: number

  /** 最小执行时间 */
  minDuration: number

  /** 最大执行时间 */
  maxDuration: number

  /** P99 执行时间 */
  p99Duration: number
}

/**
 * 事件总线指标收集器
 */
export class EventBusMetrics {
  /** 事件执行时间记录 */
  private metrics = new Map<string, number[]>()

  /** 慢事件阈值（毫秒） */
  private slowEventThreshold: number

  constructor(slowEventThreshold = 100) {
    this.slowEventThreshold = slowEventThreshold
  }

  /**
   * 记录事件执行时间
   *
   * @param eventType 事件类型
   * @param duration 执行时间（毫秒）
   */
  recordEmit(eventType: string, duration: number): void {
    if (!this.metrics.has(eventType)) {
      this.metrics.set(eventType, [])
    }
    this.metrics.get(eventType)!.push(duration)
  }

  /**
   * 获取事件指标
   *
   * @param eventType 事件类型
   * @returns 事件指标，如果事件不存在则返回 null
   */
  getMetric(eventType: string): EventMetric | null {
    const durations = this.metrics.get(eventType)
    if (!durations || durations.length === 0) {
      return null
    }

    const sorted = [...durations].sort((a, b) => a - b)
    const total = durations.reduce((a, b) => a + b, 0)

    return {
      eventType,
      durations,
      totalCalls: durations.length,
      avgDuration: total / durations.length,
      minDuration: sorted[0],
      maxDuration: sorted[sorted.length - 1],
      p99Duration: sorted[Math.floor(sorted.length * 0.99)],
    }
  }

  /**
   * 获取所有事件指标
   *
   * @returns 所有事件指标
   */
  getAllMetrics(): EventMetric[] {
    const result: EventMetric[] = []

    for (const eventType of this.metrics.keys()) {
      const metric = this.getMetric(eventType)
      if (metric) {
        result.push(metric)
      }
    }

    // 按平均执行时间降序排序
    return result.sort((a, b) => b.avgDuration - a.avgDuration)
  }

  /**
   * 获取慢事件列表
   *
   * @param threshold 自定义阈值（可选）
   * @returns 慢事件类型列表
   */
  getSlowEvents(threshold?: number): string[] {
    const actualThreshold = threshold ?? this.slowEventThreshold

    return Array.from(this.metrics.entries())
      .filter(([_, durations]) => {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length
        return avg > actualThreshold
      })
      .map(([eventType]) => eventType)
  }

  /**
   * 获取最频繁的事件
   *
   * @param topN 返回前 N 个
   * @returns 最频繁的事件类型列表
   */
  getMostFrequentEvents(topN = 10): string[] {
    return Array.from(this.metrics.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, topN)
      .map(([eventType]) => eventType)
  }

  /**
   * 生成性能报告
   *
   * @returns 格式化的性能报告
   */
  generateReport(): string {
    const metrics = this.getAllMetrics()
    const slowEvents = this.getSlowEvents()

    let report = '╔════════════════════════════════════════╗\n'
    report += '║  事件总线性能报告                        ║\n'
    report += '╚════════════════════════════════════════╝\n\n'

    // 慢事件警告
    if (slowEvents.length > 0) {
      report += '⚠️  慢事件（超过阈值）：\n'
      for (const eventType of slowEvents) {
        const metric = this.getMetric(eventType)
        if (metric) {
          report += `  - ${eventType}: ${metric.avgDuration.toFixed(2)}ms (P99: ${metric.p99Duration.toFixed(2)}ms)\n`
        }
      }
      report += '\n'
    }

    // Top 10 最慢事件
    report += '📊 Top 10 最慢事件：\n'
    const top10 = metrics.slice(0, 10)
    for (const metric of top10) {
      report += `  ${metric.eventType.padEnd(30)} `
      report += `平均: ${metric.avgDuration.toFixed(2).padStart(8)}ms `
      report += `P99: ${metric.p99Duration.toFixed(2).padStart(8)}ms `
      report += `调用: ${metric.totalCalls}\n`
    }

    // 统计信息
    const totalEvents = metrics.reduce((sum, m) => sum + m.totalCalls, 0)
    const totalDuration = metrics.reduce((sum, m) => sum + m.avgDuration * m.totalCalls, 0)
    report += `\n总计: ${totalEvents} 次事件调用, 总耗时: ${(totalDuration / 1000).toFixed(2)}s\n`

    return report
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics.clear()
  }

  /**
   * 设置慢事件阈值
   *
   * @param threshold 阈值（毫秒）
   */
  setSlowEventThreshold(threshold: number): void {
    this.slowEventThreshold = threshold
  }
}
