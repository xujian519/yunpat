/**
 * @file Orchestrator 适配器主入口
 * @description 连接 Rust 网关和 Node.js Orchestrator
 */

import express from 'express'
import { OrchestratorAgent } from '@yunpat/orchestrator'
import type {
  OrchestratorAgentConfig,
  IntentType,
  FileSignal,
  FileSignalType,
} from '@yunpat/orchestrator'

export interface AdapterConfig {
  port: number
  gatewayUrl: string
  orchestrator: OrchestratorAgentConfig
}

export interface OrchestrateRequest {
  session_id: string
  message: string
  user_id?: string
  /** Gateway 层预设的意图，跳过 Call 1 */
  intent_override?: string
  /** 工作区文件信号 */
  file_signals?: Array<{
    path: string
    filename: string
    extension: string
    mime_type: string
    signal_type: string
    confidence: number
  }>
}

export interface GatewayEvent {
  event_id: string
  session_id: string
  event_type:
    | 'intent'
    | 'plan'
    | 'hitl'
    | 'progress'
    | 'result'
    | 'error'
    | 'step_start'
    | 'step_complete'
    | 'step_error'
    | 'workflow_start'
    | 'workflow_done'
  timestamp: number
  payload: unknown
}

const VALID_INTENT_TYPES: IntentType[] = [
  'DRAFT_FULL',
  'DRAFT_CLAIMS',
  'DRAFT_SPEC',
  'RESPOND_OA',
  'SEARCH',
  'ANALYZE_PORTFOLIO',
  'CODING',
  'CHITCHAT',
  'MULTI_INTENT',
  'CLARIFY',
  'INIT_WORKSPACE',
]

function parseIntentType(str: string): IntentType | undefined {
  return VALID_INTENT_TYPES.find((t) => t === str)
}

function convertFileSignals(
  signals: Array<{
    path: string
    filename: string
    extension: string
    mime_type: string
    signal_type: string
    confidence: number
  }>
): FileSignal[] {
  return signals.map((s) => ({
    path: s.path,
    filename: s.filename,
    extension: s.extension,
    mimeType: s.mime_type,
    signalType: s.signal_type as FileSignalType,
    confidence: s.confidence,
  }))
}

export class OrchestratorAdapter {
  private app: express.Application
  private agent: OrchestratorAgent
  private gatewayUrl: string
  private port: number

  // sessionId → { sessionId, checkpointIds } 映射，用于 HITL 恢复
  private sessionHitlMap = new Map<string, { sessionId: string; checkpointIds: string[] }>()

  constructor(config: AdapterConfig) {
    this.port = config.port
    this.gatewayUrl = config.gatewayUrl
    this.agent = new OrchestratorAgent(config.orchestrator)

    this.app = express()
    this.app.use(express.json({ limit: '10mb' }))

    this.setupRoutes()
  }

  private setupRoutes(): void {
    // 健康检查
    this.app.get('/internal/health', (_req, res) => {
      res.json({ status: 'healthy', timestamp: Date.now() })
    })

    // 编排请求
    this.app.post('/internal/orchestrate', async (req, res) => {
      const { session_id, message, user_id, intent_override, file_signals } =
        req.body as OrchestrateRequest

      try {
        // 如果有 intent_override，发送意图事件
        if (intent_override) {
          await this.emitEvent(session_id, 'intent', {
            intent: intent_override,
            source: 'gateway',
            confidence: 1.0,
            skip_call1: true,
          })
        }

        // 发送开始事件
        await this.emitEvent(session_id, 'progress', {
          stage: intent_override ? 'planning' : 'intent',
          progress: 0,
        })

        // 执行编排
        const result = await this.agent.execute({
          sessionId: session_id,
          userId: user_id || 'cli-user',
          message,
          ...(intent_override ? { intentOverride: parseIntentType(intent_override) } : {}),
          ...(file_signals?.length ? { fileSignals: convertFileSignals(file_signals) } : {}),
          onProgress: (stage, detail) => {
            this.emitEvent(session_id, 'progress', {
              stage,
              progress: 0.5,
              currentAgent: detail,
            })
          },
        })

        // 发送结果事件
        if (result.requiresHITL && result.hitlRequests) {
          // 保存 session → checkpoint 映射，用于 HITL 响应时恢复
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const checkpointIds = result.hitlRequests.map((r: any) => r.checkpointId)
          this.sessionHitlMap.set(session_id, { sessionId: session_id, checkpointIds })

          await this.emitEvent(session_id, 'hitl', {
            requests: result.hitlRequests,
            session_id,
          })
        } else {
          await this.emitEvent(session_id, 'result', {
            result: result.response,
            attachments: result.attachments,
            suggestedActions: result.suggestedActions,
            metadata: result.metadata,
          })
        }

        res.json({ success: true, result })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await this.emitEvent(session_id, 'error', { error: errorMessage })
        res.status(500).json({ error: errorMessage })
      }
    })

    // HITL 响应
    this.app.post('/internal/hitl/:checkpointId', async (req, res) => {
      const { checkpointId } = req.params
      const response = req.body

      try {
        const result = await this.agent.submitHITLResponse(checkpointId, response)

        // 检查是否所有 HITL 都已处理
        if (this.agent.isAllHITLResolved()) {
          // 查找对应的 session
          for (const [sessionId, state] of this.sessionHitlMap) {
            if (state.checkpointIds.includes(checkpointId)) {
              try {
                // 执行结果聚合
                const aggregated = await this.agent.aggregateAfterHITL(sessionId)

                // 广播最终 result 事件
                await this.emitEvent(sessionId, 'result', {
                  result: aggregated.response,
                  attachments: aggregated.attachments,
                  suggestedActions: aggregated.suggestedActions,
                  metadata: aggregated.metadata,
                })

                this.sessionHitlMap.delete(sessionId)
              } catch (aggError) {
                console.error('Failed to aggregate after HITL:', aggError)
              }
              break
            }
          }
        }

        res.json({ success: true, result })
      } catch (error) {
        res.status(500).json({ error: String(error) })
      }
    })

    // 获取活跃的 HITL 检查点
    this.app.get('/internal/hitl', async (_req, res) => {
      try {
        const checkpoints = this.agent.getActiveHITLCheckpoints()
        res.json({ checkpoints })
      } catch (error) {
        res.status(500).json({ error: String(error) })
      }
    })
  }

  async emitEvent(
    sessionId: string,
    eventType: GatewayEvent['event_type'],
    payload: unknown
  ): Promise<void> {
    try {
      const response = await fetch(`${this.gatewayUrl}/internal/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          payload,
        }),
      })

      if (!response.ok) {
        console.error(`Failed to emit event: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to emit event:', error)
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`Orchestrator adapter listening on port ${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    // 清理资源
  }
}

export function createAdapter(config: AdapterConfig): OrchestratorAdapter {
  return new OrchestratorAdapter(config)
}
