/**
 * 推理性能监控
 *
 * 追踪推理引擎的性能指标
 *
 * @module reasoning/ReasoningMonitor
 */

export interface PerformanceMetrics {
  /** 推理次数 */
  totalInferences: number

  /** 总耗时（毫秒） */
  totalDuration: number

  /** 平均耗时（毫秒） */
  avgDuration: number

  /** 最小耗时（毫秒） */
  minDuration: number

  /** 最大耗时（毫秒） */
  maxDuration: number

  /** 总 Token 消耗 */
  totalTokens: number

  /** 平均 Token 消耗 */
  avgTokens: number

  /** P50 耗时（毫秒） */
  p50Duration: number

  /** P95 耗时（毫秒） */
  p95Duration: number

  /** P99 耗时（毫秒） */
  p99Duration: number
}

export interface InferenceRecord {
  /** 推理 ID */
  id: string

  /** 推理类型 */
  type: string

  /** 开始时间 */
  startTime: Date

  /** 结束时间 */
  endTime: Date

  /** 耗时（毫秒） */
  duration: number

  /** Token 消耗 */
  tokensUsed: number

  /** 是否成功 */
  success: boolean

  /** 错误信息 */
  error?: string

  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 推理性能监控类
 */
export class ReasoningMonitor {
  private records: Map<string, InferenceRecord>
  private inferenceCounts: Map<string, number>

  constructor() {
    this.records = new Map()
    this.inferenceCounts = new Map()
  }

  /**
   * 开始记录推理
   */
  startInference(type: string, metadata?: Record<string, unknown>): string {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const record: InferenceRecord = {
      id,
      type,
      startTime: new Date(),
      endTime: undefined as any, // 临时值，将在完成时更新
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
  endInference(id: string, tokensUsed: number, success: boolean, error?: string): void {
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
  getMetrics(type?: string): PerformanceMetrics {
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
  getInferenceCounts(): Map<string, number> {
    return new Map(this.inferenceCounts)
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.records.clear()
    this.inferenceCounts.clear()
  }

  /**
   * 获取所有记录
   */
  getRecords(): InferenceRecord[] {
    return Array.from(this.records.values())
  }

  /**
   * 导出性能报告
   */
  exportReport(): string {
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
