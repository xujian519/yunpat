/**
 * @file 会话管理 Hook
 * @description 管理会话状态和消息
 */

import { useEffect } from 'react'
import type { Session, SessionMessage, GatewayEvent } from '../types/index.js'
import { GatewayClient } from '../services/gateway.js'
import { storeApi } from '../store/index.js'

export interface UseSessionOptions {
  gatewayUrl: string
  userId: string
  onEvent?: (event: GatewayEvent) => void
}

export function useSession(options: UseSessionOptions) {
  const gateway = new GatewayClient({ baseUrl: options.gatewayUrl })

  useEffect(() => {
    // 初始化会话
    let session: Session | null = null

    async function init() {
      try {
        session = await gateway.createSession(options.userId)
        storeApi.getState().setSession(session)
      } catch (error) {
        console.error('Failed to create session:', error)
        storeApi.getState().setError(`Failed to create session: ${error}`)
      }
    }

    init()

    return () => {
      session?.id && gateway.deleteSession(session.id)
    }
  }, [options.gatewayUrl, options.userId])

  const sendMessage = async (content: string) => {
    try {
      // 添加用户消息
      const userMessage: SessionMessage = {
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      storeApi.getState().addMessage(userMessage)

      // 发送到网关
      await gateway.sendMessage(content)

      // 更新状态为处理中
      storeApi.getState().updateOrchestratorStatus({ stage: 'processing', progress: 0 })
    } catch (error) {
      console.error('Failed to send message:', error)
      storeApi.getState().setError(`Failed to send message: ${error}`)
    }
  }

  return {
    session: storeApi.getState().session,
    messages: storeApi.getState().messages,
    sendMessage,
    error: storeApi.getState().error,
  }
}
