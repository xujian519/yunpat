/**
 * @file 内置命令定义
 * @description TUI 内置的斜杠命令
 */

import type { Command, CommandContext } from './types.js'
import { commandRegistry } from './CommandRegistry.js'

/**
 * /help - 显示帮助信息
 */
const helpCommand: Command = {
  name: 'help',
  description: '显示帮助信息',
  help: '显示所有可用命令的列表，或特定命令的详细帮助。\n\n示例:\n  /help\n  /help connect',
  category: 'general',
  execute: (ctx, args) => {
    const commandName = args[0]
    const helpText = commandRegistry.getHelp(commandName)
    return { success: true, message: helpText }
  },
}

/**
 * /clear - 清空消息
 */
const clearCommand: Command = {
  name: 'clear',
  description: '清空对话历史',
  help: '清空当前对话历史中的所有消息。',
  category: 'ui',
  execute: (ctx) => {
    ctx.ui.clearMessages()
    return { success: true, message: '对话历史已清空' }
  },
}

/**
 * /exit - 退出 TUI
 */
const exitCommand: Command = {
  name: 'exit',
  description: '退出 TUI',
  help: '退出 TUI 并关闭连接。\n\n也可以使用 Ctrl+C',
  category: 'general',
  execute: (ctx) => {
    ctx.ui.exit()
    return { success: true }
  },
}

/**
 * /quit - /exit 的别名
 */
const quitCommand: Command = {
  name: 'quit',
  description: '退出 TUI（/exit 的别名）',
  help: '/exit 命令的别名。',
  category: 'general',
  execute: (ctx) => {
    ctx.ui.exit()
    return { success: true }
  },
}

/**
 * /status - 显示连接状态
 */
const statusCommand: Command = {
  name: 'status',
  description: '显示当前状态',
  help: '显示当前的连接状态、会话信息和配置。\n\n示例:\n  /status',
  category: 'general',
  execute: (ctx) => {
    const state = ctx.getState()
    const gatewayInfo = ctx.gateway.getSessionInfo()

    const lines = [
      '=== TUI 状态 ===',
      '',
      `连接状态: ${state.connected ? '已连接' : '未连接'}`,
      `Gateway URL: ${state.gatewayUrl}`,
      `用户 ID: ${state.userId}`,
      `会话 ID: ${gatewayInfo.id || '无'}`,
    ]

    return { success: true, message: lines.join('\n') }
  },
}

/**
 * /connect - 连接到 Gateway
 */
const connectCommand: Command = {
  name: 'connect',
  description: '连接到 Gateway 服务',
  help: '连接到指定的 Gateway 服务地址。\n\n示例:\n  /connect http://localhost:8888\n  /connect',
  category: 'session',
  args: [
    {
      name: 'url',
      description: 'Gateway 服务地址（不指定则使用默认）',
      required: false,
    },
  ],
  execute: async (ctx, args, _options) => {
    const url = args[0]
    if (url) {
      // 更新 URL 并重连
      ctx.setState({ gatewayUrl: url })
    }

    try {
      await ctx.gateway.reconnect()
      return { success: true, message: '连接成功' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败',
        code: 'COMMAND_FAILED',
      }
    }
  },
}

/**
 * /disconnect - 断开连接
 */
const disconnectCommand: Command = {
  name: 'disconnect',
  description: '断开当前连接',
  help: '断开与 Gateway 的连接，但保持 TUI 运行。',
  category: 'session',
  execute: (ctx) => {
    ctx.gateway.disconnect()
    return { success: true, message: '已断开连接' }
  },
}

/**
 * /echo - 回显消息（测试用）
 */
const echoCommand: Command = {
  name: 'echo',
  description: '回显消息',
  help: '将输入的消息原样返回，用于测试。\n\n示例:\n  /echo Hello World',
  category: 'debug',
  args: [
    {
      name: 'message',
      description: '要回显的消息',
      required: true,
      variadic: true,
    },
  ],
  execute: (ctx, args) => {
    const message = args.join(' ')
    return { success: true, message }
  },
}

/**
 * /version - 显示版本信息
 */
const versionCommand: Command = {
  name: 'version',
  description: '显示版本信息',
  help: '显示 TUI 和 Gateway 的版本信息。',
  category: 'general',
  execute: (ctx) => {
    const lines = ['YunPat TUI v0.1.0', 'Gateway: 连接中...', 'Orchestrator Adapter: v0.1.0']

    if (ctx.getState().connected) {
      lines[1] = 'Gateway: 已连接'
    }

    return { success: true, message: lines.join('\n') }
  },
}

/**
 * 注册所有内置命令
 */
export function registerBuiltinCommands(): void {
  commandRegistry.registerAll([
    helpCommand,
    clearCommand,
    exitCommand,
    quitCommand,
    statusCommand,
    connectCommand,
    disconnectCommand,
    echoCommand,
    versionCommand,
  ])
}
