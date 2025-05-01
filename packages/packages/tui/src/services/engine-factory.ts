/**
 * @file 引擎工厂
 * @description 根据配置创建 Gateway 或 Local 执行引擎
 */

import type { Engine, EngineConfig } from './engine.js'
import type { IntentType, HITLResponse } from '../types/index.js'
import { GatewayClient } from './gateway.js'
import { SSEClient } from './sse.js'
import { handleSSEEvent } from './sse-events.js'
import { storeApi } from '../store/index.js'

// ─── Local Engine（延迟加载）──────────────────────────

async function createLocalEngine(): Promise<Engine> {
  const { LocalEngine } = await import('./local-engine.js')
  return new LocalEngine()
}

// ─── Gateway Engine ─────────────────────────────────

class GatewayEngine implements Engine {
  readonly type = 'gateway' as const

  private gatewayClient: GatewayClient | null = null
  private sseClient: SSEClient | null = null

  async initialize(config: EngineConfig): Promise<void> {
    const baseUrl = config.gatewayUrl || `http://localhost:${process.env.GATEWAY_PORT ?? 8081}`
    const timeout = 30000

    this.gatewayClient = new GatewayClient({ baseUrl, timeout })

    // 创建会话
    const sessionData = (await this.gatewayClient.createSession(config.userId || 'tui-user')) as {
      id: string
      userId: string
    }

    const session = {
      id: sessionData.id,
      userId: sessionData.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle' as const,
      messages: [],
    }

    storeApi.getState().setSession(session)
    storeApi.getState().setConnected(true)

    // 设置 SSE — 使用统一的事件处理器
    const sse = new SSEClient({
      url: this.gatewayClient.getEventStreamUrl(),
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
    })
    this.sseClient = sse

    sse.onEvent(handleSSEEvent)

    sse.onError((error: Error) => {
      storeApi.getState().addMessage({
        role: 'system',
        content: `SSE 连接中断: ${error.message}`,
        timestamp: Date.now(),
      })
    })

    sse.connect()

    // HITL 提交处理
    storeApi.setState({
      submitHITLResponse: async (response: HITLResponse) => {
        if (this.gatewayClient) {
          await this.gatewayClient.submitHITLResponse(response)
        }
      },
    })
  }

  async executeWorkflow(intent: IntentType, params: Record<string, unknown>): Promise<void> {
    if (!this.gatewayClient) {
      throw new Error('GatewayEngine 未初始化')
    }

    const messageContent = (params.message as string) || ''

    await this.gatewayClient.sendMessageWithIntent(messageContent, intent)
    storeApi.getState().updateOrchestratorStatus({
      stage: 'processing',
      progress: 0,
      intent,
    })
    storeApi.getState().setError(null)
  }

  async submitHITLResponse(response: unknown): Promise<void> {
    if (this.gatewayClient) {
      await this.gatewayClient.submitHITLResponse(response as HITLResponse)
    }
  }

  disconnect(): void {
    this.sseClient?.disconnect()
    this.sseClient = null
    storeApi.getState().setConnected(false)
  }
}

// ─── 工厂函数 ────────────────────────────────────────

export async function createEngine(
  mode: 'standalone' | 'gateway',
  config?: EngineConfig
): Promise<Engine> {
  if (mode === 'standalone') {
    const engine = await createLocalEngine()
    if (config) await engine.initialize(config)
    return engine
  }

  const engine = new GatewayEngine()
  if (config) await engine.initialize(config)
  return engine
}
