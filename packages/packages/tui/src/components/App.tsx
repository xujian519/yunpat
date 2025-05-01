/**
 * @file TUI 主应用组件
 * @description Claude Code 风格的 TUI 界面
 *
 * 职责：
 *   - 连接管理（网关连接/重连、standalone 模式）
 *   - 布局组合（顶栏 + 对话 + 状态 + 输入）
 *   - 全局快捷键
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { ChatPanel } from './ChatPanel.js'
import { HITLPanel } from './HITLPanel.js'
import { InputBar } from './InputBar.js'
import { InlineStatus } from './InlineStatus.js'
import { useDialog } from './DialogProvider.js'
import { CommandPalette } from './CommandPalette.js'
import { ModelSelector } from './ModelSelector.js'
import { AgentSelector } from './AgentSelector.js'
import { useStore, storeApi } from '../store/index.js'
import { GatewayClient } from '../services/gateway.js'
import { SSEClient } from '../services/sse.js'
import { handleSSEEvent } from '../services/sse-events.js'
import { createEngine } from '../services/engine-factory.js'
import type { Engine } from '../services/engine.js'
import { isCommand, executeCommand, createCommandContext } from '../commands/index.js'
import type { IntentType } from '../types/index.js'
import { THEME, ICONS } from '../theme.js'
import { isHITLPayload } from '../types/index.js'

// ─── 常量 ────────────────────────────────────────────
const CONNECTION_TIMEOUT = 8000
const RECONNECT_DELAY = 5000
const MAX_RECONNECT_ATTEMPTS = 5

// ─── 图标（使用主题） ────────────────────────

// ─── 本地闲聊回退 ────────────────────────────────────
function localChitchat(text: string): string | null {
  const t = text.trim().toLowerCase()
  if (['你好', 'hello', 'hi', '嗨', 'hey'].includes(t)) {
    return '您好！我是 YunPat 专利智能助手。\n\n我可以帮您：\n  • 撰写专利申请（/draft）\n  • 答复审查意见（/oa）\n  • 现有技术检索（/search）\n  • 专利组合分析（/analyze）\n  • 编程开发（/code）\n\n注意：当前网关未连接，完整功能需要网关服务。\n输入 /help 查看命令列表。'
  }
  if (['帮助', 'help', '你能做什么', '你能干什么', '功能'].includes(t)) {
    return 'YunPat 支持以下命令：\n\n  /draft   - 完整专利撰写\n  /claims  - 权利要求\n  /spec    - 说明书\n  /oa      - 审查意见答复\n  /search  - 专利检索\n  /analyze - 专利组合分析\n  /code    - 编程任务\n  /status  - 连接状态\n  /connect - 连接网关\n\n您也可以直接用自然语言描述需求。'
  }
  if (['谢谢', '感谢', 'thanks', 'thank you'].includes(t)) {
    return '不客气！有需要随时找我。'
  }
  return null
}

// ─── Props ───────────────────────────────────────────
export interface AppProps {
  gatewayUrl?: string
  userId?: string
  standalone?: boolean
}

// ─── 主组件 ──────────────────────────────────────────
export const App: React.FC<AppProps> = ({
  gatewayUrl = `http://localhost:${process.env.GATEWAY_PORT ?? 8081}`,
  userId = 'cli-user',
  standalone = false,
}) => {
  const { exit } = useApp()

  // ─── 本地状态 ─────────────────────────────────
  const [showHITL, setShowHITL] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)

  // ─── Refs ─────────────────────────────────────
  const gatewayClientRef = useRef<GatewayClient | null>(null)
  const sseClientRef = useRef<SSEClient | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Zustand store ────────────────────────────
  const messages = useStore((s) => s.messages)
  const connected = useStore((s) => s.connected)
  const session = useStore((s) => s.session)
  const pendingHITL = useStore((s) => s.pendingHITL)
  const orchestratorStatus = useStore((s) => s.orchestratorStatus)
  const workflow = useStore((s) => s.workflow)
  const error = useStore((s) => s.error)

  // ─── 对话框 ──────────────────────────────────
  const { activeDialog, openDialog, closeDialog } = useDialog()

  // ─── Gateway client（memo） ──────────────────
  const gatewayClient = useMemo(
    () => new GatewayClient({ baseUrl: gatewayUrl, timeout: CONNECTION_TIMEOUT }),
    [gatewayUrl]
  )
  gatewayClientRef.current = gatewayClient

  // ─── 辅助函数 ─────────────────────────────────
  const addSystemMessage = useCallback((content: string) => {
    storeApi.getState().addMessage({ role: 'system', content, timestamp: Date.now() })
  }, [])

  // ─── Spinner 动画 ─────────────────────────────
  useEffect(() => {
    if (!isConnecting) return
    const interval = setInterval(() => {
      setSpinnerIndex((i) => (i + 1) % ICONS.spinner.length)
    }, 80)
    return () => clearInterval(interval)
  }, [isConnecting])

  // ─── SSE 连接 ─────────────────────────────────
  const connectSSE = useCallback(
    (sse: SSEClient) => {
      // 使用统一的事件处理器
      sse.onEvent(handleSSEEvent)

      // HITL 特殊处理：需要本地 UI 状态
      sse.onEvent((event) => {
        if (event.eventType === 'hitl' && isHITLPayload(event.payload)) {
          setShowHITL(true)
        }
        if (event.eventType === 'result') {
          setShowHITL(false)
        }
        if (event.eventType === 'error') {
          setShowHITL(false)
        }
      })

      sse.onError((err) => {
        addSystemMessage(`⚠ SSE 连接中断: ${err.message}`)
      })
    },
    [addSystemMessage]
  )

  // ─── 尝试连接网关 ─────────────────────────────
  const attemptConnect = useCallback(
    async (attempt: number): Promise<boolean> => {
      const gateway = gatewayClientRef.current
      if (!gateway) return false

      setIsConnecting(true)
      storeApi.getState().updateOrchestratorStatus({ stage: 'idle', progress: 0 })

      if (attempt === 0) {
        addSystemMessage(`正在连接网关 ${gatewayUrl} ...`)
      } else {
        addSystemMessage(`重连中 (第 ${attempt} 次) ...`)
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('连接超时')), CONNECTION_TIMEOUT)
        )

        const sessionData = (await Promise.race([
          gateway.createSession(userId),
          timeoutPromise,
        ])) as { id: string; userId: string }

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
        setIsConnecting(false)
        setReconnectAttempt(0)

        addSystemMessage(`✓ 已连接 (会话 ${session.id.slice(0, 8)})`)

        // 启动 SSE
        const sse = new SSEClient({
          url: gateway.getEventStreamUrl(),
          reconnectInterval: 3000,
          maxReconnectAttempts: 10,
        })
        sseClientRef.current = sse
        connectSSE(sse)
        sse.connect()

        return true
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误'
        setIsConnecting(false)
        storeApi.getState().setConnected(false)

        if (attempt === 0) {
          addSystemMessage(`✗ 网关连接失败: ${msg}`)
          addSystemMessage('ℹ 离线模式：可使用本地命令和闲聊，输入 /connect 重试')
        }
        return false
      }
    },
    [gatewayUrl, userId, addSystemMessage, connectSSE]
  )

  // ─── 自动重连 ─────────────────────────────────
  const scheduleReconnect = useCallback(
    (attempt: number) => {
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        addSystemMessage(`已达到最大重连次数 (${MAX_RECONNECT_ATTEMPTS})，输入 /connect 手动重连`)
        return
      }
      const delay = RECONNECT_DELAY * Math.pow(1.5, Math.min(attempt, 3))
      setReconnectAttempt(attempt + 1)
      reconnectTimerRef.current = setTimeout(() => {
        attemptConnect(attempt + 1)
      }, delay)
    },
    [attemptConnect, addSystemMessage]
  )

  // ─── 初始化 ────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    storeApi.setState({
      submitHITLResponse: async (response) => {
        if (gatewayClientRef.current) {
          await gatewayClientRef.current.submitHITLResponse(response)
        }
      },
    })

    if (standalone) {
      setIsConnecting(false)
      createEngine('standalone', { userId })
        .then((engine) => {
          if (isMounted) {
            engineRef.current = engine
            addSystemMessage('✓ standalone 模式已就绪（本地 LLM）')
          }
        })
        .catch((error) => {
          if (isMounted) {
            const msg = error instanceof Error ? error.message : '未知错误'
            addSystemMessage(`⚠ standalone 模式初始化失败: ${msg}`)
            addSystemMessage('ℹ 可使用本地命令和闲聊，输入 /connect 切换到网关模式')
          }
        })
    } else {
      attemptConnect(0).then((ok) => {
        if (!ok && isMounted) scheduleReconnect(0)
      })
    }

    return () => {
      isMounted = false
      setIsConnecting(false)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      sseClientRef.current?.disconnect()
      sseClientRef.current = null
      engineRef.current?.disconnect?.()
      engineRef.current = null
    }
  }, [gatewayUrl, userId, standalone])

  // ─── 全局快捷键 ────────────────────────────────
  useInput(
    (input, key) => {
      // 对话框打开时，Esc 优先关闭对话框
      if (key.escape && activeDialog) {
        closeDialog()
        return
      }

      if (key.ctrl && input === 'c') {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        sseClientRef.current?.disconnect()
        exit()
      }

      // Ctrl+K: 命令面板
      if (key.ctrl && (input === 'k' || input === 'K')) {
        openDialog('command')
        return
      }

      // Ctrl+M: 模型选择
      if (key.ctrl && (input === 'm' || input === 'M')) {
        openDialog('model')
        return
      }

      // Ctrl+A: Agent 选择
      if (key.ctrl && (input === 'a' || input === 'A')) {
        openDialog('agent')
        return
      }

      if (key.escape && showHITL) {
        setShowHITL(false)
        storeApi.getState().setPendingHITL(null)
      }

      // HITL 快捷键（数字选择）
      if (showHITL) {
        const hitlRequest = storeApi.getState().pendingHITL
        if (hitlRequest && /^\d+$/.test(input)) {
          const index = parseInt(input, 10) - 1
          if (index >= 0 && index < hitlRequest.options.length) {
            const option = hitlRequest.options[index]
            storeApi.getState().submitHITLResponse({
              requestId: hitlRequest.requestId,
              action: option.action,
            })
            setShowHITL(false)
            storeApi.getState().setPendingHITL(null)
          }
        }
      }
    },
    { isActive: true }
  )

  // ─── 消息提交 ──────────────────────────────────
  const handleSubmit = useCallback(
    async (text: string) => {
      // 斜杠命令
      if (isCommand(text)) {
        const cmdContext = createCommandContext(
          {
            connected: storeApi.getState().connected,
            connecting: isConnecting,
            gatewayUrl,
            userId,
            sessionActive: !!storeApi.getState().session,
          },
          (partial) => {
            if ('connected' in partial) storeApi.getState().setConnected(partial.connected!)
          },
          gatewayClientRef.current,
          {
            clearMessages: () => storeApi.setState({ messages: [] }),
            clearError: () => storeApi.getState().setError(null),
            exit,
            showMessage: (msg) => addSystemMessage(msg),
          },
          text,
          engineRef.current
        )

        const result = await executeCommand(text, cmdContext)

        if (result.message) {
          addSystemMessage(result.message)
        }

        if (!result.success) {
          storeApi.getState().setError(result.error ?? '命令执行失败')
          return
        }

        // 命令附带意图覆盖 → 发送到引擎
        if (result.intentOverride) {
          const intent = result.intentOverride as IntentType
          storeApi.getState().addMessage({
            role: 'user',
            content: text,
            timestamp: Date.now(),
          })
          storeApi.getState().updateOrchestratorStatus({
            stage: 'processing',
            progress: 0,
            intent,
          })
          storeApi.getState().setError(null)

          if (engineRef.current) {
            await engineRef.current.executeWorkflow(intent, {
              message: result.message || text,
            })
          } else if (gatewayClientRef.current) {
            await gatewayClientRef.current.sendMessageWithIntent(result.message || text, intent)
          }
          return
        }

        // 命令不附带意图 → 结束
        return
      }

      // 普通消息
      storeApi.getState().addMessage({ role: 'user', content: text, timestamp: Date.now() })
      storeApi.getState().updateOrchestratorStatus({ stage: 'processing', progress: 0 })
      storeApi.getState().setError(null)

      // 优先本地闲聊回退
      const chitchat = localChitchat(text)
      if (chitchat) {
        storeApi
          .getState()
          .addMessage({ role: 'assistant', content: chitchat, timestamp: Date.now() })
        storeApi.getState().updateOrchestratorStatus({ stage: 'done', progress: 1 })
        return
      }

      // 发送到引擎
      if (engineRef.current) {
        await engineRef.current.executeWorkflow('CHITCHAT' as IntentType, { message: text })
      } else if (gatewayClientRef.current && storeApi.getState().connected) {
        await gatewayClientRef.current.sendMessage(text)
      } else {
        storeApi.getState().addMessage({
          role: 'system',
          content: '⚠ 未连接网关，无法处理。输入 /connect 重试。',
          timestamp: Date.now(),
        })
      }
    },
    [isConnecting, gatewayUrl, userId, exit, addSystemMessage]
  )

  // ─── 状态显示 ──────────────────────────────────
  const statusDisplay = useMemo(() => {
    if (isConnecting) {
      return { icon: ICONS.spinner[spinnerIndex] ?? '⟳', text: '连接中', color: 'yellow' }
    }
    if (connected) return { icon: ICONS.check, text: '就绪', color: 'green' }
    return { icon: ICONS.empty, text: '离线', color: 'yellow' }
  }, [isConnecting, connected, spinnerIndex])

  // ─── 命令面板（全屏覆盖） ─────────────────────
  if (activeDialog === 'command') {
    return React.createElement(CommandPalette, {
      onSelect: (commandText: string) => {
        handleSubmit(commandText)
      },
      onClose: closeDialog,
    })
  }

  // ─── 渲染（全宽对话流布局） ───────────────
  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 0, width: '100%' },

    // ═══ 顶部栏 ═══
    React.createElement(
      Box,
      {
        key: 'header',
        paddingX: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      React.createElement(
        Box,
        null,
        React.createElement(Text, { bold: true, color: 'cyan' }, `${ICONS.brand} YunPat`),
        session?.id
          ? React.createElement(Text, { dimColor: true }, ` · ${session.id.slice(0, 8)}`)
          : null,
        standalone
          ? React.createElement(Text, { color: 'green' }, ' [standalone]')
          : !connected && !isConnecting
            ? React.createElement(Text, { color: 'yellow', bold: true }, ' [离线]')
            : null
      ),
      React.createElement(
        Box,
        null,
        React.createElement(
          Text,
          { color: statusDisplay.color },
          `${statusDisplay.icon} ${statusDisplay.text}`
        ),
        React.createElement(Text, { dimColor: true }, ' · Ctrl+C 退出 · Ctrl+K 命令')
      )
    ),

    // ═══ 分隔线 ═══
    React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(Text, { dimColor: true }, '─'.repeat(60))
    ),

    // ═══ 对话区（全宽） ═══
    React.createElement(
      Box,
      { key: 'chat', flexGrow: 1, flexDirection: 'column', paddingX: 1 },
      React.createElement(ChatPanel, { messages })
    ),

    // ═══ 内嵌状态 ═══
    React.createElement(InlineStatus, {
      stage: orchestratorStatus.stage,
      intent: orchestratorStatus.intent,
      progress: orchestratorStatus.progress,
      currentAgent: orchestratorStatus.currentAgent,
      error: error ?? undefined,
      isConnecting,
      workflow,
    }),

    // ═══ HITL 面板 ═══
    ...(showHITL && pendingHITL
      ? [
          React.createElement(
            Box,
            { key: 'hitl', paddingX: 1, paddingTop: 1 },
            React.createElement(HITLPanel, {
              request: pendingHITL,
              onSelect: (optionId: string) => {
                const option = pendingHITL.options.find((o) => o.id === optionId)
                if (option) {
                  storeApi.getState().submitHITLResponse({
                    requestId: pendingHITL.requestId,
                    action: option.action,
                  })
                  setShowHITL(false)
                  storeApi.getState().setPendingHITL(null)
                }
              },
            })
          ),
        ]
      : []),

    // ═══ 错误提示条 ═══
    ...(error && !showHITL
      ? [
          React.createElement(
            Box,
            { key: 'error-bar', paddingX: 1 },
            React.createElement(Text, { color: 'red' }, `${ICONS.cross} ${error}`)
          ),
        ]
      : []),

    // ═══ 模型选择器（底部面板） ═══
    ...(activeDialog === 'model'
      ? [
          React.createElement(
            Box,
            { key: 'model-selector', paddingX: 1, paddingTop: 1 },
            React.createElement(ModelSelector, {
              currentModel: undefined,
              onSelect: (modelId: string) => {
                addSystemMessage(`⚙ 已切换模型: ${modelId}`)
                closeDialog()
              },
              onClose: closeDialog,
            })
          ),
        ]
      : []),

    // ═══ Agent 选择器（底部面板） ═══
    ...(activeDialog === 'agent'
      ? [
          React.createElement(
            Box,
            { key: 'agent-selector', paddingX: 1, paddingTop: 1 },
            React.createElement(AgentSelector, {
              currentAgent: undefined,
              onSelect: (agentId: string) => {
                addSystemMessage(`★ 已切换智能体: ${agentId}`)
                closeDialog()
              },
              onClose: closeDialog,
            })
          ),
        ]
      : []),

    // ═══ 输入区 ═══
    React.createElement(
      Box,
      { key: 'input', paddingX: 1, paddingTop: 1 },
      React.createElement(InputBar, {
        onSubmit: handleSubmit,
        disabled: showHITL || orchestratorStatus.stage === 'hitl' || !!activeDialog,
        placeholder: showHITL
          ? '请先处理 HITL 请求'
          : activeDialog
            ? '请先关闭对话框 (Esc)'
            : standalone
              ? 'Ctrl+K 命令面板 | Ctrl+M 模型 | Ctrl+A 智能体'
              : !connected && !isConnecting
                ? '离线模式 - Ctrl+K 命令面板 | /connect 重连'
                : 'Ctrl+K 命令面板 | Ctrl+M 模型 | Ctrl+A 智能体',
      })
    )
  )
}
