/**
 * 遥测收集器 - 可观测性核心实现
 *
 * 功能：
 * 1. 事件记录 - 记录所有智能体和系统事件
 * 2. 实时告警 - 监控慢执行、失败率、错误激增
 * 3. 指标聚合 - 计算成功率、平均延迟等
 * 4. 错误追踪 - 追踪 Top N 错误
 */
import { TelemetryEvent, TelemetryReport, TelemetryEventType, TelemetryConfig } from './types.js'
export declare class TelemetryCollector {
  private events
  private errors
  private alerts
  private agentMetrics
  private stageMetrics
  private readonly config
  private alertIdCounter
  private eventIdCounter
  constructor(config?: TelemetryConfig)
  /**
   * 记录遥测事件
   */
  record(event: TelemetryEvent): void
  /**
   * 获取遥测报告
   */
  getReport(): TelemetryReport
  /**
   * 打印可读报告
   */
  printReport(): void
  /**
   * 触发告警
   */
  alert(type: string, event: TelemetryEvent): void
  /**
   * 清除所有数据
   */
  clear(): void
  /**
   * 获取特定智能体的事件
   */
  getEventsByAgent(agentName: string): TelemetryEvent[]
  /**
   * 获取特定类型的事件
   */
  getEventsByType(type: TelemetryEventType): TelemetryEvent[]
  /**
   * 获取最近的失败事件
   */
  getRecentFailures(limit?: number): TelemetryEvent[]
  /**
   * 清理过期事件
   */
  private cleanup
  /**
   * 更新指标
   */
  private updateMetrics
  /**
   * 创建智能体指标
   */
  private createAgentMetrics
  /**
   * 更新智能体指标
   */
  private updateAgentMetrics
  /**
   * 创建阶段指标
   */
  private createStageMetrics
  /**
   * 更新阶段指标
   */
  private updateStageMetrics
  /**
   * 追踪错误
   */
  private trackError
  /**
   * 获取 Top N 错误
   */
  private getTopErrors
  /**
   * 检查告警条件
   */
  private checkAlerts
  /**
   * 获取告警严重级别
   */
  private getAlertSeverity
  /**
   * 获取告警消息
   */
  private getAlertMessage
}
//# sourceMappingURL=TelemetryCollector.d.ts.map
