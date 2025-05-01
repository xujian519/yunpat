/**
 * @file 网关客户端
 * @description 与 Rust 网关通信的 HTTP 客户端
 */

import type { Session, SessionStatus, HITLResponse, IntentType } from '../types/index.js'

export interface GatewayClientConfig {
  baseUrl: string
  timeout?: number
}

export class GatewayClient {
  private baseUrl: string
  private timeout: number
  private sessionId: string | null = null

  constructor(config: GatewayClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.timeout = config.timeout ?? 30000
  }

  /**
   * 创建新会话
   */
  async createSession(userId: string): Promise<Session> {
    const response = await this.fetch('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to create session: ${response.statusText} - ${errorText}`)
    }

    const data = (await response.json()) as {
      session_id: string
      user_id: string
      status: string
    }

    const session: Session = {
      id: data.session_id,
      userId: data.user_id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: data.status.toLowerCase() as SessionStatus,
      messages: [],
    }

    this.sessionId = session.id
    return session
  }

  /**
   * 获取会话信息
   */
  async getSession(sessionId: string): Promise<Session> {
    const response = await this.fetch(`/api/v1/sessions/${sessionId}`)

    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`)
    }

    return (await response.json()) as Session
  }

  /**
   * 发送消息（普通）
   */
  async sendMessage(message: string): Promise<void> {
    return this.sendMessageWithIntent(message)
  }

  /**
   * 发送消息（带预设意图）
   * 当 TUI 已知意图时（如 /draft 命令），跳过 Gateway 的意图识别
   */
  async sendMessageWithIntent(message: string, intent?: IntentType): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session')
    }

    const body: { content: string; intent?: string } = {
      content: message,
    }

    if (intent) {
      body.intent = intent
    }

    const response = await this.fetch(`/api/v1/sessions/${this.sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`)
    }
  }

  /**
   * 提交 HITL 响应
   */
  async submitHITLResponse(response: HITLResponse): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session')
    }

    const resp = await this.fetch(`/api/v1/sessions/${this.sessionId}/hitl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    })

    if (!resp.ok) {
      throw new Error(`Failed to submit HITL response: ${resp.statusText}`)
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId?: string): Promise<void> {
    const id = sessionId ?? this.sessionId
    if (!id) {
      return
    }

    const response = await this.fetch(`/api/v1/sessions/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`)
    }

    if (id === this.sessionId) {
      this.sessionId = null
    }
  }

  /**
   * 获取事件流 URL
   */
  getEventStreamUrl(sessionId?: string): string {
    const id = sessionId ?? this.sessionId
    if (!id) {
      throw new Error('No active session')
    }
    return `${this.baseUrl}/api/v1/sessions/${id}/events`
  }

  /**
   * 通用 fetch 方法
   */
  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }
}
