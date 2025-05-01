/**
 * @file SSE 事件处理器（统一）
 * @description App.tsx 和 GatewayEngine 共用的 SSE 事件处理逻辑，消除重复
 */

import type { GatewayEvent, OrchestratorStage } from '../types/index.js'
import {
  isProgressPayload,
  isResultPayload,
  isErrorPayload,
  isHITLPayload,
  isIntentPayload,
  isStepStartPayload,
  isStepCompletePayload,
} from '../types/index.js'
import { storeApi } from '../store/index.js'

/**
 * 统一的 SSE 事件处理函数
 *
 * App.tsx 的 setupSSE 和 engine-factory.ts 的 setupSSEHandlers 共用此函数。
 * 所有 SSE 事件都写入 Zustand store，使 UI 自动更新。
 */
export function handleSSEEvent(event: GatewayEvent): void {
  switch (event.eventType) {
    case 'intent':
      if (isIntentPayload(event.payload)) {
        storeApi.getState().updateOrchestratorStatus({
          intent: event.payload.intent,
          stage: event.payload.skip_call1 ? 'planning' : 'intent',
        })
      }
      break

    case 'hitl':
      if (isHITLPayload(event.payload)) {
        storeApi.getState().setPendingHITL(event.payload)
        storeApi.getState().updateOrchestratorStatus({ stage: 'hitl' })
      }
      break

    case 'progress':
      if (isProgressPayload(event.payload)) {
        storeApi.getState().updateOrchestratorStatus({
          progress: event.payload.progress,
          ...(event.payload.stage && {
            stage: event.payload.stage as OrchestratorStage,
          }),
          currentAgent: event.payload.currentAgent,
        })
      }
      break

    case 'step_start':
      if (isStepStartPayload(event.payload)) {
        const p = event.payload
        storeApi.getState().updateWorkflowStep(p.stepId, {
          stepId: p.stepId,
          name: p.stepName,
          status: 'running',
          progress: 0,
        })
        storeApi.getState().updateOrchestratorStatus({
          currentAgent: p.stepName,
          stage: 'execution',
        })
      }
      break

    case 'step_complete':
      if (isStepCompletePayload(event.payload)) {
        const p = event.payload
        storeApi.getState().updateWorkflowStep(p.stepId, {
          status: p.status === 'completed' ? 'completed' : 'failed',
          duration: p.duration,
          details: p.details,
        })
        if (p.status === 'completed') storeApi.getState().advanceWorkflowStep()
      }
      break

    case 'result':
      if (isResultPayload(event.payload)) {
        storeApi.getState().addMessage({
          role: 'assistant',
          content: event.payload.result,
          timestamp: Date.now(),
        })
        storeApi.getState().updateOrchestratorStatus({ stage: 'done', progress: 1 })
      }
      break

    case 'error':
      if (isErrorPayload(event.payload)) {
        storeApi.getState().setError(event.payload.error)
        storeApi.getState().addMessage({
          role: 'system',
          content: `✗ 处理错误: ${event.payload.error}`,
          timestamp: Date.now(),
        })
        storeApi.getState().updateOrchestratorStatus({ stage: 'error' })
      }
      break

    case 'connected':
      storeApi.getState().setConnected(true)
      break

    case 'disconnected':
      storeApi.getState().setConnected(false)
      break
  }
}
