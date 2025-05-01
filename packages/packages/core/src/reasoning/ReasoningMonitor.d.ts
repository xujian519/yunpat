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
export declare class ReasoningMonitor {
  private records
  private inferenceCounts
  constructor()
  /**
   * 开始记录推理
   */
  startInference(type: string, metadata?: Record<string, unknown>): string
  /**
   * 完成推理记录
   */
  endInference(id: string, tokensUsed: number, success: boolean, error?: string): void
  /**
   * 获取性能指标
   */
  getMetrics(type?: string): PerformanceMetrics
  /**
   * 获取推理计数
   */
  getInferenceCounts(): Map<string, number>
  /**
   * 清空记录
   */
  clear(): void
  /**
   * 获取所有记录
   */
  getRecords(): InferenceRecord[]
  /**
   * 导出性能报告
   */
  exportReport(): string
}
/**
 * 单例监控实例
 */
export declare const reasoningMonitor: ReasoningMonitor
//# sourceMappingURL=ReasoningMonitor.d.ts.map
