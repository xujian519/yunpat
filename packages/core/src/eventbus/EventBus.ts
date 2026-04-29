import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  EventBus as IEventBus,
  AgentEvent,
  EventHandler,
  Subscription,
} from '../lifecycle/Lifecycle.js';
import { EventBusMetrics } from './EventBusMetrics.js';

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
export class EventBus implements IEventBus {
  /** 事件发射器 */
  private emitter = new EventEmitter();

  /** 订阅存储 */
  private subscriptions = new Map<string, Set<EventHandler>>();

  /** 请求响应存储 */
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  /** 性能监控 */
  private metrics = new EventBusMetrics(100); // 100ms 阈值

  /** 是否启用性能监控 */
  private enableMetrics = true;

  /**
   * 发布事件
   *
   * @param event 事件
   */
  publish(event: AgentEvent): void {
    const start = performance.now();

    // 发送完整事件类型
    this.emitter.emit(event.type, event);

    // 如果有目标，发送目标特定事件
    if (event.target) {
      const targetEvent = `${event.type}:${event.target}`;
      this.emitter.emit(targetEvent, event);
    }

    // 发送源事件
    const sourceEvent = `${event.type}:${event.source}`;
    this.emitter.emit(sourceEvent, event);

    // 记录性能
    if (this.enableMetrics) {
      const duration = performance.now() - start;
      this.metrics.recordEmit(event.type, duration);
    }
  }

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
  subscribe(pattern: string, handler: EventHandler): Subscription {
    const id = uuidv4();

    // 存储订阅
    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, new Set());
    }
    this.subscriptions.get(pattern)!.add(handler);

    // 绑定事件监听
    this.emitter.on(pattern, handler);

    // 创建订阅对象
    const subscription: Subscription = {
      id,
      pattern,
      handler,
      unsubscribe: () => this.unsubscribe(subscription),
    };

    return subscription;
  }

  /**
   * 取消订阅
   *
   * @param subscription 订阅
   */
  unsubscribe(subscription: Subscription): void {
    const { pattern, handler } = subscription;

    // 从存储中移除
    const handlers = this.subscriptions.get(pattern);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(pattern);
      }
    }

    // 移除事件监听
    this.emitter.off(pattern, handler);
  }

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
  async request(target: string, message: any, timeout = 30000): Promise<any> {
    const requestId = uuidv4();

    return new Promise((resolve, reject) => {
      // 设置超时
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${requestId}`));
      }, timeout);

      // 存储请求
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timer,
      });

      // 发布请求事件
      this.publish({
        type: 'message:request',
        source: 'system', // 请求来自系统
        target,
        data: {
          requestId,
          message,
        },
        timestamp: new Date(),
      });
    });
  }

  /**
   * 响应请求
   *
   * @param requestId 请求 ID
   * @param response 响应数据
   */
  respond(requestId: string, response: any): void {
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
    }
  }

  /**
   * 获取所有订阅
   *
   * @returns 订阅列表
   */
  getSubscriptions(): Array<{ pattern: string; handlers: number }> {
    return Array.from(this.subscriptions.entries()).map(([pattern, handlers]) => ({
      pattern,
      handlers: handlers.size,
    }));
  }

  /**
   * 获取性能指标
   *
   * @returns 性能指标收集器
   */
  getMetrics(): EventBusMetrics {
    return this.metrics;
  }

  /**
   * 启用/禁用性能监控
   *
   * @param enable 是否启用
   */
  setMetricsEnabled(enable: boolean): void {
    this.enableMetrics = enable;
  }

  /**
   * 生成性能报告
   *
   * @returns 格式化的性能报告
   */
  generatePerformanceReport(): string {
    return this.metrics.generateReport();
  }

  /**
   * 清空所有订阅
   */
  clear(): void {
    this.subscriptions.clear();
    this.emitter.removeAllListeners();
    this.metrics.clear(); // 同时清除性能指标
  }
}
