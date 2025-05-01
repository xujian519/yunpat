/**
 * @file 命令执行器
 * @description 执行斜杠命令并处理结果
 */

import type { CommandContext, CommandResult, TUICommandState } from './types.js'
import { commandRegistry } from './CommandRegistry.js'
import type { GatewayClient } from '../services/gateway.js'
import type { Engine } from '../services/engine.js'

/**
 * 创建命令执行上下文
 */
export function createCommandContext(
  state: TUICommandState,
  setState: (state: Partial<TUICommandState>) => void,
  gatewayClient: GatewayClient | null,
  uiCallbacks: {
    clearMessages: () => void
    clearError: () => void
    exit: () => void
    showMessage: (message: string) => void
  },
  rawCommand: string,
  engine?: Engine | null
): CommandContext {
  return {
    getState: () => state,
    setState,

    gateway: {
      reconnect: async () => {
        if (!gatewayClient) {
          throw new Error('Gateway 客户端未初始化')
        }
        // 这里需要重新连接逻辑
        setState({ connecting: true })
        // TODO: 实现重连逻辑
        setState({ connecting: false, connected: true })
      },
      disconnect: () => {
        if (gatewayClient) {
          gatewayClient.deleteSession().catch(() => {
            // 忽略删除会话错误
          })
        }
        setState({ connected: false })
      },
      getSessionInfo: () => ({
        id: state.sessionActive ? state.userId : null,
        connected: state.connected,
      }),
    },

    // 暴露引擎给需要直接调用的命令
    engine: engine
      ? { type: engine.type, executeWorkflow: engine.executeWorkflow.bind(engine) }
      : undefined,

    ui: {
      clearMessages: uiCallbacks.clearMessages,
      clearError: uiCallbacks.clearError,
      exit: uiCallbacks.exit,
      showMessage: uiCallbacks.showMessage,
    },

    metadata: {
      timestamp: Date.now(),
      rawCommand,
    },
  }
}

/**
 * 执行命令
 */
export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  const parsed = commandRegistry.parse(input)

  if (!parsed) {
    return {
      success: false,
      error: '无效的命令格式。使用 /help 查看帮助',
      code: 'NOT_FOUND',
    }
  }

  const cmd = commandRegistry.get(parsed.command)

  if (!cmd) {
    return {
      success: false,
      error: `未知命令: ${parsed.command}`,
      code: 'NOT_FOUND',
    }
  }

  // 检查连接要求
  if (cmd.requiresConnection && !context.getState().connected) {
    return {
      success: false,
      error: '此命令需要先连接到 Gateway',
      code: 'MISSING_CONNECTION',
    }
  }

  // 验证参数
  if (cmd.args) {
    for (const arg of cmd.args) {
      if (arg.required && parsed.args.length === 0) {
        return {
          success: false,
          error: `缺少必需参数: ${arg.name}`,
          code: 'INVALID_ARGS',
        }
      }
    }
  }

  try {
    const result = await cmd.execute(context, parsed.args, parsed.options)
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '命令执行失败',
      code: 'COMMAND_FAILED',
    }
  }
}

/**
 * 检查输入是否为命令
 */
export function isCommand(input: string): boolean {
  return input.trim().startsWith('/')
}

/**
 * 获取命令建议（用于自动补全）
 */
export function getCommandSuggestions(prefix: string) {
  return commandRegistry.getSuggestions(prefix)
}
