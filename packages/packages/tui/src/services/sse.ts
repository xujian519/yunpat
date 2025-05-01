/**
 * @file SSE 客户端
 * @description 处理服务器推送事件
 */

import { EventSource } from 'eventsource'
import type { GatewayEvent } from '../types/index.js'

export type EventCallback = (event: GatewayEvent) => void
export type ErrorCallback = (error: Error) => void
export type OpenCallback = () => void

export interface SSEClientConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export class SSEClient {
  private url: string
  private eventSource: EventSource | null = null
  private eventCallbacks: EventCallback[] = []
  private errorCallbacks: ErrorCallback[] = []
  private openCallbacks: OpenCallback[] = []
  private reconnectInterval: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private intentionalClose = false

  constructor(config: SSEClientConfig) {
    this.url = config.url
    this.reconnectInterval = config.reconnectInterval ?? 3000
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10
  }

  /**
   * 连接到 SSE 端点
   */
  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return
    }

    this.intentionalClose = false
    // EventSource 不支持自定义 headers，使用默认 Accept
    this.eventSource = new EventSource(this.url)

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0
      this.openCallbacks.forEach((cb) => cb())
    }

    this.eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data) as Record<string, unknown>
        // Rust 网关发送 snake_case，TUI 使用 camelCase
        const data: GatewayEvent = {
          eventId: (raw.event_id ?? raw.eventId) as string,
          sessionId: (raw.session_id ?? raw.sessionId) as string,
          eventType: (raw.event_type ?? raw.eventType) as GatewayEvent['eventType'],
          timestamp: raw.timestamp as number,
          payload: raw.payload as GatewayEvent['payload'],
        }
        this.eventCallbacks.forEach((cb) => cb(data))
      } catch (error) {
        console.error('Failed to parse SSE event:', error)
      }
    }

    this.eventSource.onerror = () => {
      this.errorCallbacks.forEach((cb) => cb(new Error('SSE connection error')))

      // 指数退避重连
      if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1)
        setTimeout(() => {
          if (!this.intentionalClose) {
            this.connect()
          }
        }, delay)
      }
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.intentionalClose = true
    this.eventSource?.close()
    this.eventSource = null
  }

  /**
   * 注册事件回调
   */
  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * 注册错误回调
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback)
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * 注册连接打开回调
   */
  onOpen(callback: OpenCallback): () => void {
    this.openCallbacks.push(callback)
    return () => {
      this.openCallbacks = this.openCallbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * 获取连接状态
   */
  getReadyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}
