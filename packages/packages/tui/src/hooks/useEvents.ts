/**
 * @file 事件订阅 Hook
 * @description 订阅和处理网关事件
 */

import { useEffect, useCallback, useRef } from 'react'
import type {
  GatewayEvent,
  OrchestratorStatus,
  SessionMessage,
  HITLRequest,
} from '../types/index.js'
import { SSEClient } from '../services/sse.js'
import { storeApi } from '../store/index.js'
import {
  isIntentPayload,
  isPlanPayload,
  isProgressPayload,
  isHITLPayload,
  isResultPayload,
  isErrorPayload,
} from '../types/index.js'

export interface UseEventsOptions {
  enabled: boolean
  url: string
}

export function useEvents(options: UseEventsOptions) {
  const clientRef = useRef<SSEClient | null>(null)

  const handleEvent = useCallback((event: GatewayEvent) => {
    const state = storeApi.getState()

    switch (event.eventType) {
      case 'intent': {
        if (isIntentPayload(event.payload)) {
          const { intent, confidence } = event.payload
          storeApi.getState().updateOrchestratorStatus({
            stage: 'intent',
            intent,
            progress: 0.1,
          })

          // 添加系统消息显示意图识别结果
          const message: SessionMessage = {
            role: 'system',
            content: `识别意图: ${intent} (置信度: ${(confidence * 100).toFixed(0)}%)`,
            timestamp: Date.now(),
            metadata: { stage: 'intent', confidence },
          }
          storeApi.getState().addMessage(message)
        }
        break
      }

      case 'plan': {
        if (isPlanPayload(event.payload)) {
          const plan = {
            tasks: event.payload.tasks.map((t) => ({ ...t, status: 'pending' as const })),
            estimatedDuration: event.payload.tasks.length * 5 * 60 * 1000,
          }
          storeApi.getState().updateOrchestratorStatus({
            stage: 'planning',
            plan,
            progress: 0.3,
          })

          const message: SessionMessage = {
            role: 'system',
            content: `任务规划: ${plan.tasks.length} 个任务`,
            timestamp: Date.now(),
            metadata: { stage: 'planning' },
          }
          storeApi.getState().addMessage(message)
        }
        break
      }

      case 'progress': {
        if (isProgressPayload(event.payload)) {
          const { currentAgent, progress } = event.payload
          storeApi.getState().updateOrchestratorStatus({
            stage: 'execution',
            currentAgent,
            progress: Math.min(0.9, progress),
          })
        }
        break
      }

      case 'hitl': {
        if (isHITLPayload(event.payload)) {
          const hitlRequest = event.payload
          storeApi.getState().setPendingHITL(hitlRequest)
          storeApi.getState().updateOrchestratorStatus({
            stage: 'hitl',
            progress: 0.5,
          })
        }
        break
      }

      case 'result': {
        if (isResultPayload(event.payload)) {
          const { result } = event.payload
          const message: SessionMessage = {
            role: 'assistant',
            content: result,
            timestamp: Date.now(),
          }
          storeApi.getState().addMessage(message)
          storeApi.getState().updateOrchestratorStatus({
            stage: 'done',
            progress: 1.0,
          })
        }
        break
      }

      case 'error': {
        if (isErrorPayload(event.payload)) {
          const { error } = event.payload
          storeApi.getState().setError(error)
          storeApi.getState().updateOrchestratorStatus({
            stage: 'error',
            error,
          })
        }
        break
      }

      case 'connected': {
        storeApi.getState().setConnected(true)
        break
      }

      case 'disconnected': {
        storeApi.getState().setConnected(false)
        break
      }
    }
  }, [])

  useEffect(() => {
    if (!options.enabled || !options.url) {
      return
    }

    const client = new SSEClient({
      url: options.url,
      reconnectInterval: 3000,
    })

    clientRef.current = client

    client.onEvent(handleEvent)
    client.onError((error) => {
      console.error('SSE error:', error)
      storeApi.getState().setError(`Connection error: ${error.message}`)
    })
    client.onOpen(() => {
      storeApi.getState().setConnected(true)
    })

    client.connect()

    return () => {
      client.disconnect()
      clientRef.current = null
    }
  }, [options.enabled, options.url, handleEvent])

  return {
    connected: storeApi.getState().connected,
    disconnect: () => clientRef.current?.disconnect(),
  }
}
