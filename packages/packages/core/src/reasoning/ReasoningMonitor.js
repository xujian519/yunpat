/**
 * 推理性能监控
 *
 * 追踪推理引擎的性能指标
 *
 * @module reasoning/ReasoningMonitor
 */
/**
 * 推理性能监控类
 */
export class ReasoningMonitor {
  records
  inferenceCounts
  constructor() {
    this.records = new Map()
    this.inferenceCounts = new Map()
  }
  /**
   * 开始记录推理
   */
  startInference(type, metadata) {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const record = {
      id,
      type,
      startTime: new Date(),
      endTime: undefined, // 临时值，将在完成时更新
      duration: 0,
      tokensUsed: 0,
      success: false,
      metadata,
    }
    this.records.set(id, record)
    return id
  }
  /**
   * 完成推理记录
   */
  endInference(id, tokensUsed, success, error) {
    const record = this.records.get(id)
    if (!record) {
      return
    }
    record.endTime = new Date()
    record.duration = record.endTime.getTime() - record.startTime.getTime()
    record.tokensUsed = tokensUsed
    record.success = success
    record.error = error
    // 更新计数
    const count = this.inferenceCounts.get(record.type) || 0
    this.inferenceCounts.set(record.type, count + 1)
  }
  /**
   * 获取性能指标
   */
  getMetrics(type) {
    const records = type
      ? Array.from(this.records.values()).filter((r) => r.type === type)
      : Array.from(this.records.values())
    if (records.length === 0) {
      return {
        totalInferences: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalTokens: 0,
        avgTokens: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
      }
    }
    const durations = records.map((r) => r.duration).sort((a, b) => a - b)
    const tokens = records.map((r) => r.tokensUsed)
    return {
      totalInferences: records.length,
      totalDuration: durations.reduce((a, b) => a + b, 0),
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      totalTokens: tokens.reduce((a, b) => a + b, 0),
      avgTokens: tokens.reduce((a, b) => a + b, 0) / tokens.length,
      p50Duration: durations[Math.floor(durations.length * 0.5)],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
    }
  }
  /**
   * 获取推理计数
   */
  getInferenceCounts() {
    return new Map(this.inferenceCounts)
  }
  /**
   * 清空记录
   */
  clear() {
    this.records.clear()
    this.inferenceCounts.clear()
  }
  /**
   * 获取所有记录
   */
  getRecords() {
    return Array.from(this.records.values())
  }
  /**
   * 导出性能报告
   */
  exportReport() {
    const metrics = this.getMetrics()
    const counts = this.getInferenceCounts()
    let report = '=== 推理性能报告 ===\n\n'
    report += `总推理次数: ${metrics.totalInferences}\n`
    report += `总耗时: ${(metrics.totalDuration / 1000).toFixed(2)}s\n`
    report += `平均耗时: ${metrics.avgDuration.toFixed(2)}ms\n`
    report += `最小耗时: ${metrics.minDuration}ms\n`
    report += `最大耗时: ${metrics.maxDuration}ms\n`
    report += `P50/P95/P99: ${metrics.p50Duration}ms / ${metrics.p95Duration}ms / ${metrics.p99Duration}ms\n\n`
    report += `Token 消耗:\n`
    report += `  总计: ${metrics.totalTokens}\n`
    report += `  平均: ${metrics.avgTokens.toFixed(0)}\n\n`
    report += '推理类型分布:\n'
    for (const [type, count] of counts.entries()) {
      report += `  ${type}: ${count}\n`
    }
    return report
  }
}
/**
 * 单例监控实例
 */
export const reasoningMonitor = new ReasoningMonitor()
//# sourceMappingURL=ReasoningMonitor.js.map
