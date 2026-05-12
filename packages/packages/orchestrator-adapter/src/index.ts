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
import {
  PatentCoordinator,
  createPatentCoordinator,
  type CoordinatorInput,
  type AgentConfig,
  type PatentCoordinatorConfig,
  type CaseUnderstanding,
} from '@yunpat/core'

export interface AdapterConfig {
  port: number
  gatewayUrl: string
  orchestrator: OrchestratorAgentConfig
  /** 专利协调器配置（可选，启用 /internal/coordinate 路由） */
  patentCoordinator?: {
    agentConfig: Omit<AgentConfig, 'eventBus' | 'memory' | 'tools' | 'llm'>
    coordinatorConfig?: PatentCoordinatorConfig
  }
}

/**
 * 专利协调请求
 */
export interface CoordinateRequest {
  session_id: string
  user_id?: string
  /** 用户原始输入 */
  message: string
  /** 用户意图（可选） */
  intent?: 'draft_full' | 'draft_claims' | 'draft_spec' | 'respond_oa' | 'search' | 'analyze'
  /** 已有案件理解（可选） */
  existing_case_understanding?: Record<string, unknown>
  /** 额外上下文 */
  context?: Record<string, unknown>
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
  private config: AdapterConfig

  // 专利协调器（懒加载）
  private patentCoordinator?: PatentCoordinator

  // sessionId → { sessionId, checkpointIds } 映射，用于 HITL 恢复
  private sessionHitlMap = new Map<string, { sessionId: string; checkpointIds: string[] }>()

  constructor(config: AdapterConfig) {
    this.port = config.port
    this.gatewayUrl = config.gatewayUrl
    this.config = config
    this.agent = new OrchestratorAgent(config.orchestrator)

    this.app = express()
    this.app.use(express.json({ limit: '10mb' }))

    this.setupRoutes()
  }

  /**
   * 获取或创建专利协调器
   */
  private getPatentCoordinator(): PatentCoordinator {
    if (this.patentCoordinator) {
      return this.patentCoordinator
    }

    if (!this.config.patentCoordinator) {
      throw new Error('PatentCoordinator not configured. Set patentCoordinator in adapter config.')
    }

    const { agentConfig, coordinatorConfig } = this.config.patentCoordinator
    const orchestrator = this.config.orchestrator

    const fullAgentConfig: AgentConfig = {
      ...agentConfig,
      eventBus: orchestrator.eventBus,
      memory: orchestrator.memory,
      tools: orchestrator.tools,
      llm: orchestrator.llm,
    }

    this.patentCoordinator = createPatentCoordinator({
      ...fullAgentConfig,
      coordinatorConfig,
    })

    return this.patentCoordinator
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

    // 专利工作流协调路由
    this.app.post('/internal/coordinate', async (req, res) => {
      const { session_id, user_id, message, intent, existing_case_understanding, context } =
        req.body as CoordinateRequest

      if (!message) {
        res.status(400).json({ error: 'message is required' })
        return
      }

      try {
        const coordinator = this.getPatentCoordinator()

        // 发送开始事件
        await this.emitEvent(session_id, 'workflow_start', {
          type: 'patent_coordinator',
          intent: intent || 'draft_full',
          timestamp: Date.now(),
        })

        const coordinatorInput: CoordinatorInput = {
          userInput: message,
          ...(intent ? { intent } : {}),
          ...(existing_case_understanding
            ? {
                existingCaseUnderstanding:
                  existing_case_understanding as unknown as CaseUnderstanding,
              }
            : {}),
          ...(context ? { context } : {}),
        }

        const result = await coordinator.execute(coordinatorInput)

        // 发送完成事件
        await this.emitEvent(session_id, 'workflow_done', {
          type: 'patent_coordinator',
          executionSummary: result.executionSummary,
          timestamp: Date.now(),
        })

        res.json({
          success: true,
          session_id,
          result: {
            caseUnderstanding: result.caseUnderstanding,
            workflowPlan: result.workflowPlan,
            taskResults: result.taskResults,
            finalOutput: result.finalOutput,
            executionSummary: result.executionSummary,
          },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await this.emitEvent(session_id, 'error', { error: errorMessage })
        res.status(500).json({ error: errorMessage })
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
