/**
 * @file HITL 处理 Hook
 * @description 处理人机协作交互
 */

import { useCallback } from 'react'
import type { HITLRequest, HITLResponse } from '../types/index.js'
import { storeApi } from '../store/index.js'

export function useHITL() {
  const respondToHITL = useCallback(async (response: HITLResponse) => {
    const pendingRequest = storeApi.getState().pendingHITL
    if (!pendingRequest) {
      console.warn('No pending HITL request')
      return
    }

    try {
      // 这里需要通过网关发送响应
      // 实际实现需要注入 GatewayClient
      await storeApi.getState().submitHITLResponse(response)

      // 清除待处理的 HITL
      storeApi.getState().setPendingHITL(null)

      // 恢复执行状态
      storeApi.getState().updateOrchestratorStatus({
        stage: 'execution',
        progress: 0.6,
      })
    } catch (error) {
      console.error('Failed to submit HITL response:', error)
      storeApi.getState().setError(`Failed to submit HITL response: ${error}`)
    }
  }, [])

  const approve = useCallback(() => {
    const pendingRequest = storeApi.getState().pendingHITL
    if (!pendingRequest) return

    respondToHITL({
      requestId: pendingRequest.requestId,
      action: 'approve',
    })
  }, [respondToHITL])

  const reject = useCallback(
    (feedback?: string) => {
      const pendingRequest = storeApi.getState().pendingHITL
      if (!pendingRequest) return

      respondToHITL({
        requestId: pendingRequest.requestId,
        action: 'reject',
        feedback,
      })
    },
    [respondToHITL]
  )

  const modify = useCallback(
    (corrections: Record<string, unknown>) => {
      const pendingRequest = storeApi.getState().pendingHITL
      if (!pendingRequest) return

      respondToHITL({
        requestId: pendingRequest.requestId,
        action: 'modify',
        corrections,
      })
    },
    [respondToHITL]
  )

  const skip = useCallback(() => {
    const pendingRequest = storeApi.getState().pendingHITL
    if (!pendingRequest) return

    respondToHITL({
      requestId: pendingRequest.requestId,
      action: 'skip',
    })
  }, [respondToHITL])

  return {
    pendingHITL: storeApi.getState().pendingHITL,
    approve,
    reject,
    modify,
    skip,
  }
}
