import { z } from 'zod'
import { EventBus } from '../eventbus/EventBus.js'
import { LLMAdapter, MemoryStore } from '../lifecycle/Lifecycle.js'

/**
 * 工具分类
 */
export enum ToolCategory {
  FILE = 'file', // 文件操作
  SEARCH = 'search', // 搜索
  CODE = 'code', // 代码执行
  NETWORK = 'network', // 网络请求
  DATABASE = 'database', // 数据库
  PATENT = 'patent', // 专利相关
  ANALYSIS = 'analysis', // 数据分析
  UTILITY = 'utility', // 通用工具
  DOCUMENT = 'document', // 文档解析
}

/**
 * 工具元数据
 */
export interface ToolMetadata<TInput = any, TOutput = any> {
  /** 工具名称（唯一标识） */
  name: string

  /** 工具描述 */
  description: string

  /** 输入参数 Schema（Zod） */
  inputSchema: z.ZodType<TInput>

  /** 输出结果 Schema（Zod） */
  outputSchema?: z.ZodType<TOutput>

  /** 工具分类 */
  category?: ToolCategory

  /** 所需权限 */
  permissions?: string[]

  /** 限流配置 */
  rateLimit?: {
    max: number
    window: number // 毫秒
  }

  /** 是否并发安全（只读工具可以并发） */
  isConcurrencySafe?: boolean

  /** 最大结果字符数，超过后自动持久化到磁盘。默认 Infinity（不持久化） */
  maxResultSizeChars?: number

  /** 是否为 MCP 工具 */
  isMcp?: boolean

  /** MCP 服务器名称 */
  mcpServer?: string

  /** 工具版本 */
  version?: string

  /** 工具作者 */
  author?: string
}

import type { ToolRegistry } from '../lifecycle/Lifecycle.js'

/**
 * 工具执行上下文
 */
export interface ToolContext {
  /** 工具注册表 */
  registry: ToolRegistry

  /** LLM 适配器 */
  llm: LLMAdapter

  /** 记忆存储 */
  memory: MemoryStore

  /** 事件总线 */
  eventBus: EventBus

  /** 用户 ID（用于权限控制） */
  userId?: string

  /** 会话 ID（用于追踪） */
  sessionId?: string

  /** 额外的上下文数据 */
  metadata?: Record<string, unknown>
}

export type ToolValidationResult =
  | { result: true }
  | { result: false; message: string; errorCode: number }

/**
 * 中断行为配置
 *
 * 定义工具如何响应中断信号（AbortSignal）和超时。
 * 借鉴 Claude Code 的 interruptBehavior 设计。
 */
export interface InterruptBehavior {
  /** 超时时间（毫秒），0 表示无超时 */
  timeout: number

  /** 中断信号（AbortController.signal） */
  signal?: AbortSignal

  /** 超时后的回调（用于清理资源） */
  onTimeout?: () => void | Promise<void>

  /** 中断时的清理回调 */
  cleanup?: () => void | Promise<void>

  /** 是否可重试（超时后是否允许重试） */
  retryable: boolean
}

/**
 * 工具结果 Block 参数
 *
 * 将工具结果映射为 LLM 可用的 message block 格式。
 * 支持文本、图片、JSON 等多种类型。
 */
export interface ToolResultBlockParam {
  /** Block 类型 */
  type: 'text' | 'image' | 'json' | 'error'

  /** 文本内容（type='text' 时使用） */
  text?: string

  /** JSON 内容（type='json' 时使用） */
  json?: unknown

  /** 图片数据（type='image' 时使用） */
  image?: {
    /** Base64 编码的图片数据 */
    data: string
    /** MIME 类型 */
    mimeType: string
  }

  /** 错误信息（type='error' 时使用） */
  error?: {
    message: string
    code?: string
  }

  /** 是否已压缩 */
  isCompacted?: boolean

  /** 原始 Token 数（压缩前） */
  originalTokens?: number
}

/**
 * UI 渲染规范
 *
 * 供前端渲染工具结果的结构化描述。
 */
export interface UIRenderSpec {
  /** 渲染组件类型 */
  component: 'text' | 'code' | 'table' | 'image' | 'json' | 'diff' | 'chart'

  /** 标题 */
  title?: string

  /** 内容 */
  content: unknown

  /** 元数据 */
  meta?: {
    language?: string
    lineCount?: number
    truncated?: boolean
    [key: string]: unknown
  }
}

/**
 * 权限检查结果
 */
export interface PermissionResult {
  /** 是否允许执行 */
  allowed: boolean

  /** 拒绝原因（allowed=false 时） */
  reason?: string

  /** 所需权限列表 */
  requiredPermissions?: string[]

  /** 建议的操作（如 "请求权限"、"使用替代工具"） */
  suggestion?: string
}

/**
 * 增强的工具接口（扩展自 Lifecycle.Tool）
 *
 * 借鉴 Claude Code 工具系统设计：
 * - 行为标记方法（isReadOnly/isConcurrencySafe/isDestructive）接受 input 参数，支持运行时动态判断
 * - validateInput 前置校验，在 Zod schema 验证后执行语义校验
 * - before/after 生命周期钩子
 */
export interface EnhancedTool<TInput = any, TOutput = any> {
  /** 工具元数据 */
  readonly metadata: ToolMetadata<TInput, TOutput>

  /** 执行工具 */
  execute(input: TInput, context: ToolContext): Promise<TOutput>

  /**
   * 是否只读操作。默认 false。
   * 只读工具可被缓存中间件缓存、可并发执行。
   * 接受 input 参数以支持运行时动态判断（如 BashTool 的 git status vs rm）。
   */
  isReadOnly?(input: TInput): boolean

  /**
   * 是否并发安全。默认 false（假设不安全）。
   * 覆盖 metadata.isConcurrencySafe 静态字段，支持按调用动态判断。
   */
  isConcurrencySafe?(input: TInput): boolean

  /**
   * 是否破坏性操作（删除、覆盖、发送）。默认 false。
   * 破坏性操作需要更严格的权限检查。
   */
  isDestructive?(input: TInput): boolean

  /**
   * 语义级输入校验（在 Zod schema 验证之后执行）。
   * 返回 false 时阻止工具执行。
   */
  validateInput?(input: TInput): Promise<ToolValidationResult>

  /**
   * 动态权限检查（执行前调用）。
   * 基于 input 和 context 判断当前用户是否有权限执行。
   */
  checkPermissions?(input: TInput, context: ToolContext): Promise<PermissionResult>

  /**
   * 中断行为配置。
   * 定义工具如何响应超时和中断信号。
   */
  interruptBehavior?: InterruptBehavior

  /**
   * 渲染工具结果为 LLM 可用的 message block。
   * 未实现时由 ToolResultRenderer 使用默认渲染。
   */
  renderToolResultMessage?(
    result: TOutput
  ): ToolResultBlockParam[] | Promise<ToolResultBlockParam[]>

  /**
   * 渲染工具调用请求为可读的描述文本。
   * 用于日志、审计、UI 展示。
   */
  renderToolUseMessage?(input: TInput): string | Promise<string>

  /** 可选：前置钩子 */
  before?(input: TInput, context: ToolContext): Promise<void>

  /** 可选：后置钩子 */
  after?(output: TOutput, context: ToolContext): Promise<void>
}

/**
 * 工具执行上下文（用于中间件）
 */
export interface ToolExecutionContext {
  /** 工具实例 */
  tool: EnhancedTool

  /** 输入参数 */
  input: unknown

  /** 执行上下文 */
  context: ToolContext

  /** 开始时间 */
  startTime: number

  /** 执行结果（执行后填充） */
  result?: unknown

  /** 执行错误（如果有） */
  error?: Error

  /** 是否被缓存 */
  cached?: boolean
}

/**
 * 工具执行统计
 */
export interface ToolExecutionStats {
  /** 工具名称 */
  toolName: string

  /** 总调用次数 */
  totalCalls: number

  /** 成功次数 */
  successCount: number

  /** 失败次数 */
  errorCount: number

  /** 平均执行时间（毫秒） */
  avgDuration: number

  /** 最小执行时间 */
  minDuration: number

  /** 最大执行时间 */
  maxDuration: number

  /** 缓存命中次数 */
  cacheHits: number

  /** 最后执行时间 */
  lastExecutedAt?: Date
}
