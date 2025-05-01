/**
 * 生命周期阶段枚举
 *
 * 框架按照固定顺序调用各阶段钩子：
 * 1. before -> 前置处理（可选）
 * 2. init -> 初始化（首次）
 * 3. plan -> 规划（必需）
 * 4. act -> 执行（必需，可能循环多次）
 * 5. reflect -> 反思（可选）
 * 6. after -> 后置处理（可选）
 */
export enum LifecycleStage {
  /** 前置钩子 - 在所有处理之前 */
  BEFORE = 'before',
  /** 初始化 - 首次执行时调用一次 */
  INIT = 'init',
  /** 规划 - 生成执行计划 */
  PLAN = 'plan',
  /** 执行 - 执行计划中的步骤 */
  ACT = 'act',
  /** 反思 - 评估执行结果 */
  REFLECT = 'reflect',
  /** 后置钩子 - 在所有处理之后 */
  AFTER = 'after',
}

/**
 * 生命周期钩函数类型
 */
export type LifecycleHook<TInput = unknown> = (
  input: TInput,
  context: ExecutionContext
) => Promise<void>

/**
 * 规划函数类型
 */
export type PlanFunction<TInput = unknown, TPlan = unknown> = (
  input: TInput,
  context: ExecutionContext
) => Promise<TPlan>

/**
 * 执行函数类型
 */
export type ActFunction<TPlan = unknown, TResult = unknown> = (
  plan: TPlan,
  context: ExecutionContext
) => Promise<TResult>

/**
 * 反思函数类型
 */
export type ReflectFunction<TResult = unknown, TReflection = unknown> = (
  result: TResult,
  context: ExecutionContext
) => Promise<TReflection>

/**
 * 执行上下文接口
 *
 * 框架提供统一的执行上下文，包含：
 * - 记忆存储
 * - 事件总线
 * - 工具注册表
 * - LLM 适配器
 * - 执行状态和元数据
 */
export interface ExecutionContext {
  /** 执行 ID - 唯一标识一次执行 */
  executionId: string

  /** 智能体名称 */
  agentName: string

  /** 开始时间 */
  startTime: Date

  /** 当前阶段 */
  currentStage: LifecycleStage

  /** 记忆存储 - 智能体读写数据的接口 */
  memory: MemoryStore

  /** 事件总线 - 智能体间通信的接口 */
  eventBus: EventBus

  /** 工具注册表 - 调用工具的接口 */
  tools: ToolRegistry

  /** LLM 适配器 - 调用大模型的接口 */
  llm: LLMAdapter

  /** 执行元数据 */
  metadata: Record<string, unknown>

  /** 共享状态 - 用于在生命周期钩子间传递数据 */
  sharedState: Map<string, unknown>
}

/**
 * 记忆存储接口
 *
 * 提供短期记忆（工作记忆）和长期记忆（持久化）
 */
export interface MemoryStore {
  /** 读取短期记忆 */
  get(key: string): Promise<unknown>

  /** 写入短期记忆 */
  set(key: string, value: unknown): Promise<void>

  /** 删除记忆 */
  delete(key: string): Promise<void>

  /** 检查记忆是否存在 */
  has(key: string): Promise<boolean>

  /** 获取所有短期记忆 */
  getAll(): Promise<Record<string, unknown>>

  /** 批量写入短期记忆 */
  setAll(entries: Record<string, unknown>): Promise<void>

  /** 清空短期记忆 */
  clear(): Promise<void>

  /** 搜索长期记忆（向量搜索） */
  search(query: string, topK?: number): Promise<MemoryEntry[]>
}

/**
 * 记忆条目
 */
export interface MemoryEntry {
  key: string
  value: unknown
  similarity?: number
  timestamp: Date
}

/**
 * 事件总线接口
 *
 * 提供发布订阅模式的事件通信
 */
export interface EventBus {
  /** 发布事件 */
  publish(event: AgentEvent): void

  /** 订阅事件 */
  subscribe(pattern: string, handler: EventHandler): Subscription

  /** 取消订阅 */
  unsubscribe(subscription: Subscription): void

  /** 请求响应模式 */
  request(target: string, message: unknown, timeout?: number): Promise<unknown>
}

/**
 * 智能体事件
 */
export interface AgentEvent {
  /** 事件类型 - 如 agent:started, agent:completed */
  type: string

  /** 事件源 - 智能体名称 */
  source: string

  /** 事件目标 - 可选的目标智能体 */
  target?: string

  /** 事件数据 */
  data: unknown

  /** 事件时间戳 */
  timestamp: Date
}

/**
 * 事件处理器
 */
export type EventHandler = (event: AgentEvent) => void | Promise<void>

/**
 * 订阅信息
 */
export interface Subscription {
  /** 订阅 ID */
  id: string

  /** 订阅模式 */
  pattern: string

  /** 事件处理器 */
  handler: EventHandler

  /** 取消订阅 */
  unsubscribe: () => void
}

/**
 * 工具注册表接口
 *
 * 提供工具注册和调用
 */
export interface ToolRegistry {
  /** 注册工具 */
  register(tool: Tool): void

  /** 注销工具 */
  unregister(name: string): void

  /** 获取工具 */
  get(name: string): Tool | undefined

  /** 调用工具 */
  call(name: string, input: unknown): Promise<unknown>

  /** 列出所有工具 */
  list(): Tool[]
}

/**
 * 工具接口
 */
export interface Tool {
  /** 工具名称 */
  name: string

  /** 工具描述 */
  description: string

  /** 输入模式（用于验证） */
  inputSchema?: unknown

  /** 执行工具 */
  execute(input: unknown): Promise<unknown>
}

/**
 * LLM 适配器接口
 *
 * 统一的大模型调用接口
 */
export interface LLMAdapter {
  /** 聊天 - 单次调用 */
  chat(params: ChatParams): Promise<ChatResponse>

  /** 聊天 - 流式调用 */
  chatStream(params: ChatParams): AsyncIterable<ChatChunk>

  /** 嵌入 - 生成向量 */
  embed(texts: string[]): Promise<number[][]>
}

/**
 * 聊天参数
 */
export interface ChatParams {
  /** 消息列表 */
  messages: ChatMessage[]

  /** 温度 - 控制随机性 */
  temperature?: number

  /** 最大 token 数 */
  maxTokens?: number

  /** 停止词 */
  stopSequences?: string[]

  /** 工具定义 - 用于函数调用 */
  tools?: unknown[]

  /** 超时时间（毫秒）- 覆盖适配器默认超时 */
  timeout?: number
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 角色 - system/user/assistant/tool */
  role: 'system' | 'user' | 'assistant' | 'tool'

  /** 内容 */
  content: string

  /** 工具调用（仅 assistant） */
  toolCalls?: unknown[]

  /** 工具响应 ID（仅 tool） */
  toolCallId?: string
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  /** 消息 */
  message: ChatMessage

  /** 使用的 token 数 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * 流式聊天块
 */
export interface ChatChunk {
  /** 内容增量 */
  delta: string

  /** 是否结束 */
  done: boolean
}
