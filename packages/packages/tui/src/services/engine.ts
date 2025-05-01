/**
 * @file 引擎抽象接口
 * @description 统一 Gateway 和本地执行引擎的抽象层
 *
 * TUI 支持两种运行模式：
 * - gateway: 通过 HTTP/SSE 与 Rust 网关通信（原有模式）
 * - standalone: 直接调用 @yunpat/core 原语和智能体包（新模式）
 *
 * 两种引擎产生相同格式的事件，使 TUI UI 无需修改即可工作。
 */

import type { IntentType } from '../types/index.js'

/**
 * 引擎配置
 */
export interface EngineConfig {
  /** LLM API Key */
  apiKey?: string
  /** LLM 提供商: deepseek | aliyun | zhipu | ollama | auto */
  provider?: string
  /** Gateway URL (仅 gateway 模式使用) */
  gatewayUrl?: string
  /** 用户 ID */
  userId?: string
  /** LLM 请求超时（毫秒） */
  timeout?: number
}

/**
 * 引擎抽象接口
 *
 * 所有引擎必须实现此接口，以保证 TUI 的状态管理代码
 * 在不同模式下行为一致。
 */
export interface Engine {
  /** 初始化引擎（创建连接、LLM 实例等） */
  initialize(config: EngineConfig): Promise<void>

  /** 执行工作流 */
  executeWorkflow(intent: IntentType, params: Record<string, unknown>): Promise<void>

  /** 提交 HITL（人机协同）响应 */
  submitHITLResponse(response: unknown): Promise<void>

  /** 断开引擎连接、释放资源 */
  disconnect?(): void

  /** 引擎类型标识 */
  readonly type: 'gateway' | 'local'
}
