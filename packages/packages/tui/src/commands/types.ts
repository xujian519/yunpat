/**
 * @file 命令类型定义
 */

import type { IntentType } from '../types/index.js'

export type CommandCategory = 'general' | 'session' | 'ui' | 'debug' | 'config' | 'business'

export interface CommandArg {
  name: string
  description: string
  required?: boolean
  variadic?: boolean
}

export interface CommandOption {
  name: string
  description: string
  short?: string
}

export interface CommandResult {
  success: boolean
  message?: string
  error?: string
  code?: string
  /** 如果命令需要发送消息到 Gateway，附带预设意图 */
  intentOverride?: string
}

export interface CommandContext {
  getState: () => TUICommandState
  setState: (state: Partial<TUICommandState>) => void
  gateway: {
    reconnect: () => Promise<void>
    disconnect: () => void
    getSessionInfo: () => { id: string | null; connected: boolean }
  }
  /** 当前执行引擎（standalone 或 gateway），业务命令通过它执行工作流 */
  engine?: {
    type: 'gateway' | 'local'
    executeWorkflow: (intent: IntentType, params: Record<string, unknown>) => Promise<void>
  }
  ui: {
    clearMessages: () => void
    clearError: () => void
    exit: () => void
    showMessage: (message: string) => void
  }
  metadata: {
    timestamp: number
    rawCommand: string
  }
}

export interface Command {
  name: string
  description: string
  help: string
  category: CommandCategory
  args?: CommandArg[]
  options?: CommandOption[]
  requiresConnection?: boolean
  execute: (
    context: CommandContext,
    args: string[],
    options?: Record<string, string>
  ) => CommandResult | Promise<CommandResult>
}

export interface CommandSuggestion {
  command: string
  description: string
  category: CommandCategory
}

export interface ParsedCommand {
  command: string
  args: string[]
  options: Record<string, string>
  raw: string
}

export interface TUICommandState {
  connected: boolean
  connecting: boolean
  gatewayUrl: string
  userId: string
  sessionActive: boolean
  workflow?: {
    type: string
    steps: Array<{ name: string; status: string }>
    currentStepIndex: number
    totalSteps: number
  } | null
}
