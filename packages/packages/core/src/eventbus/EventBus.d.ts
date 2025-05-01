import {
  EventBus as IEventBus,
  AgentEvent,
  EventHandler,
  Subscription,
} from '../lifecycle/Lifecycle.js'
import { EventBusMetrics } from './EventBusMetrics.js'
/**
 * 事件总线实现
 *
 * 基于发布订阅模式，支持：
 * - 广播事件（所有订阅者）
 * - 目标事件（特定订阅者）
 * - 模式匹配（通配符订阅）
 * - 请求响应模式（RPC 风格）
 * - 性能监控（自动记录慢事件）
 */
export declare class EventBus implements IEventBus {
  /** 事件发射器 */
  private emitter
  /** 订阅存储 */
  private subscriptions
  /** 请求响应存储 */
  private pendingRequests
  /** 性能监控 */
  private metrics
  /** 是否启用性能监控 */
  private enableMetrics
  /**
   * 发布事件
   *
   * @param event 事件
   */
  publish(event: AgentEvent): void
  /**
   * 订阅事件
   *
   * 支持模式匹配：
   * - "agent:started" - 只订阅 agent:started 事件
   * - "agent:*" - 订阅所有 agent 开头的事件
   * - "agent:started:writer" - 只订阅 writer 智能体的 started 事件
   *
   * @param pattern 事件模式
   * @param handler 事件处理器
   * @returns 订阅
   */
  subscribe(pattern: string, handler: EventHandler): Subscription
  /**
   * 取消订阅
   *
   * @param subscription 订阅
   */
  unsubscribe(subscription: Subscription): void
  /**
   * 请求响应模式
   *
   * 发送请求并等待响应，类似 RPC 调用。
   * 用于智能体间的同步通信。
   *
   * @param target 目标智能体
   * @param message 请求消息
   * @param timeout 超时时间（毫秒）
   * @returns 响应
   */
  request(target: string, message: unknown, timeout?: number): Promise<unknown>
  /**
   * 响应请求
   *
   * @param requestId 请求 ID
   * @param response 响应数据
   */
  respond(requestId: string, response: unknown): void
  /**
   * 获取所有订阅
   *
   * @returns 订阅列表
   */
  getSubscriptions(): Array<{
    pattern: string
    handlers: number
  }>
  /**
   * 获取性能指标
   *
   * @returns 性能指标收集器
   */
  getMetrics(): EventBusMetrics
  /**
   * 启用/禁用性能监控
   *
   * @param enable 是否启用
   */
  setMetricsEnabled(enable: boolean): void
  /**
   * 生成性能报告
   *
   * @returns 格式化的性能报告
   */
  generatePerformanceReport(): string
  /**
   * 清空所有订阅
   */
  clear(): void
}
//# sourceMappingURL=EventBus.d.ts.map
