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
export declare class EventBusMetrics {
  /** 事件执行时间记录 */
  private metrics
  /** 慢事件阈值（毫秒） */
  private slowEventThreshold
  constructor(slowEventThreshold?: number)
  /**
   * 记录事件执行时间
   *
   * @param eventType 事件类型
   * @param duration 执行时间（毫秒）
   */
  recordEmit(eventType: string, duration: number): void
  /**
   * 获取事件指标
   *
   * @param eventType 事件类型
   * @returns 事件指标，如果事件不存在则返回 null
   */
  getMetric(eventType: string): EventMetric | null
  /**
   * 获取所有事件指标
   *
   * @returns 所有事件指标
   */
  getAllMetrics(): EventMetric[]
  /**
   * 获取慢事件列表
   *
   * @param threshold 自定义阈值（可选）
   * @returns 慢事件类型列表
   */
  getSlowEvents(threshold?: number): string[]
  /**
   * 获取最频繁的事件
   *
   * @param topN 返回前 N 个
   * @returns 最频繁的事件类型列表
   */
  getMostFrequentEvents(topN?: number): string[]
  /**
   * 生成性能报告
   *
   * @returns 格式化的性能报告
   */
  generateReport(): string
  /**
   * 清除所有指标
   */
  clear(): void
  /**
   * 设置慢事件阈值
   *
   * @param threshold 阈值（毫秒）
   */
  setSlowEventThreshold(threshold: number): void
}
//# sourceMappingURL=EventBusMetrics.d.ts.map
