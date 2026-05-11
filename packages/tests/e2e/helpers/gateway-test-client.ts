/**
 * Gateway HTTP/WS 测试客户端
 *
 * 用于测试 Rust Gateway 和 TS Adapter 的集成
 */

import fetch from 'node-fetch'

export interface GatewayClientConfig {
  gatewayUrl?: string
  adapterUrl?: string
  timeout?: number
}

export interface SessionResponse {
  id: string
  status: string
  [key: string]: unknown
}

export class GatewayTestClient {
  private gatewayUrl: string
  private adapterUrl: string
  private timeout: number

  constructor(config?: GatewayClientConfig) {
    this.gatewayUrl = config?.gatewayUrl || process.env.GATEWAY_URL || 'http://localhost:8080'
    this.adapterUrl = config?.adapterUrl || process.env.ADAPTER_URL || 'http://localhost:3001'
    this.timeout = config?.timeout || 10_000
  }

  async createSession(userId: string = 'test-user'): Promise<SessionResponse> {
    const response = await fetch(`${this.gatewayUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`)
    }

    return (await response.json()) as SessionResponse
  }

  async sendMessage(sessionId: string, content: string): Promise<unknown> {
    const response = await fetch(`${this.gatewayUrl}/api/v1/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`)
    }

    return await response.json()
  }

  async getSession(sessionId: string): Promise<SessionResponse> {
    const response = await fetch(`${this.gatewayUrl}/api/v1/sessions/${sessionId}`, {
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.status}`)
    }

    return (await response.json()) as SessionResponse
  }

  async submitHITLResponse(
    sessionId: string,
    checkpointId: string,
    action: 'approve' | 'reject' | 'modify',
    feedback?: string
  ): Promise<unknown> {
    const response = await fetch(
      `${this.gatewayUrl}/api/v1/sessions/${sessionId}/hitl/${checkpointId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback }),
        signal: AbortSignal.timeout(this.timeout),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to submit HITL response: ${response.status}`)
    }

    return await response.json()
  }

  async checkHealth(): Promise<{ gateway: boolean; adapter: boolean }> {
    let gateway = false
    let adapter = false

    try {
      const response = await fetch(`${this.gatewayUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      gateway = response.ok
    } catch {
      gateway = false
    }

    try {
      const response = await fetch(`${this.adapterUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      adapter = response.ok
    } catch {
      adapter = false
    }

    return { gateway, adapter }
  }

  async waitForReady(timeoutMs: number = 15_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const { gateway, adapter } = await this.checkHealth()
      if (gateway && adapter) return true
      await new Promise((r) => setTimeout(r, 1000))
    }
    return false
  }
}
