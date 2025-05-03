/**
 * YunPat Agent 统一类型系统
 *
 * 所有 Agent 的共享类型定义，包括：
 * - 基础输入/输出接口
 * - Agent 标识符
 * - 统一执行结果
 * - 结构化错误码
 * - 重试策略映射
 *
 * @package @yunpat/agent-base
 */

// ============================================================================
// Agent 标识符
// ============================================================================

/** Agent 唯一标识符（编译时安全） */
export type AgentId =
  | 'patent-search'
  | 'patent-analyzer'
  | 'patent-responder'
  | 'patent-writer'
  | 'patent-manager'
  | 'claim-generator'
  | 'specification-drafter'
  | 'abstract-drafter'
  | 'invention'
  | 'tech-unit'
  | 'analysis'
  | 'prior-art-search'
  | 'quality'
  | 'quality-checker'
  | 'image-understanding'
  | 'researcher'
  | 'legal-qa'
  | 'writer'

// ============================================================================
// 基础 Agent 输入/输出
// ============================================================================

/** 所有 Agent 输入的可选共享字段 */
export interface BaseAgentInput {
  /** 会话 ID（编排层注入） */
  sessionId?: string
  /** 用户 ID（编排层注入） */
  userId?: string
}

/** 所有 Agent 输出的共享字段 */
export interface BaseAgentOutput {
  /** 执行时间（毫秒） */
  executionTime: number
  /** 数据来源 */
  dataSource?: string
}

// ============================================================================
// 统一 Agent 执行结果
// ============================================================================

/** Agent 执行结果（统一格式，替代 base 和 orchestrator 的重复定义） */
export interface AgentResult<T = unknown> {
  /** 是否成功 */
  success: boolean
  /** 数据 */
  data: T
  /** 结构化错误（失败时） */
  error?: AgentError
  /** 执行时间（毫秒） */
  executionTime: number
  /** 是否需要 HITL */
  requiresHITL?: boolean
  /** HITL 检查点（requiresHITL=true 时） */
  hitlCheckpoint?: string
  /** 元数据 */
  metadata?: Record<string, unknown>
}

// ============================================================================
// 结构化错误
// ============================================================================

/** 结构化错误（替代裸 Error 对象） */
export interface AgentError {
  /** 错误码 */
  code: AgentErrorCode
  /** 人类可读的错误消息 */
  message: string
  /** 附加详情 */
  details?: unknown
  /** 是否可重试 */
  retryable: boolean
}

/** 错误码枚举 */
export enum AgentErrorCode {
  // 基础错误
  UNKNOWN = 'UNKNOWN',
  TIMEOUT = 'TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',

  // LLM 相关
  LLM_UNAVAILABLE = 'LLM_UNAVAILABLE',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_BAD_RESPONSE = 'LLM_BAD_RESPONSE',

  // Agent 相关
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED',

  // 数据相关
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  VECTOR_SEARCH_FAILED = 'VECTOR_SEARCH_FAILED',

  // 业务相关
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  NO_RESULTS = 'NO_RESULTS',
}

// ============================================================================
// 重试策略
// ============================================================================

/** 重试策略配置 */
export interface RetryStrategy {
  /** 是否可重试 */
  retryable: boolean
  /** 最大重试次数 */
  maxRetries: number
  /** 退避时间（毫秒） */
  backoffMs: number
}

/** 错误码到重试策略的映射 */
export const RETRY_STRATEGY: Record<AgentErrorCode, RetryStrategy> = {
  [AgentErrorCode.TIMEOUT]: { retryable: true, maxRetries: 3, backoffMs: 1000 },
  [AgentErrorCode.LLM_RATE_LIMIT]: { retryable: true, maxRetries: 5, backoffMs: 2000 },
  [AgentErrorCode.LLM_UNAVAILABLE]: { retryable: true, maxRetries: 3, backoffMs: 5000 },
  [AgentErrorCode.LLM_BAD_RESPONSE]: { retryable: true, maxRetries: 2, backoffMs: 500 },
  [AgentErrorCode.DB_CONNECTION_FAILED]: { retryable: true, maxRetries: 3, backoffMs: 3000 },
  [AgentErrorCode.DB_QUERY_FAILED]: { retryable: true, maxRetries: 2, backoffMs: 1000 },
  [AgentErrorCode.VECTOR_SEARCH_FAILED]: { retryable: true, maxRetries: 2, backoffMs: 500 },
  [AgentErrorCode.INVALID_INPUT]: { retryable: false, maxRetries: 0, backoffMs: 0 },
  [AgentErrorCode.AGENT_NOT_FOUND]: { retryable: false, maxRetries: 0, backoffMs: 0 },
  [AgentErrorCode.AGENT_EXECUTION_FAILED]: { retryable: false, maxRetries: 0, backoffMs: 0 },
  [AgentErrorCode.LOW_CONFIDENCE]: { retryable: false, maxRetries: 0, backoffMs: 0 },
  [AgentErrorCode.NO_RESULTS]: { retryable: false, maxRetries: 0, backoffMs: 0 },
  [AgentErrorCode.UNKNOWN]: { retryable: false, maxRetries: 0, backoffMs: 0 },
}

/** 从 Error 对象推断 AgentErrorCode */
export function inferErrorCode(error: Error): AgentErrorCode {
  const msg = error.message.toLowerCase()
  if (msg.includes('timeout') || msg.includes('timed out')) return AgentErrorCode.TIMEOUT
  if (msg.includes('rate limit') || msg.includes('429')) return AgentErrorCode.LLM_RATE_LIMIT
  if (msg.includes('connection') || msg.includes('econnrefused'))
    return AgentErrorCode.DB_CONNECTION_FAILED
  if (msg.includes('vector') || msg.includes('embedding')) return AgentErrorCode.VECTOR_SEARCH_FAILED
  if (msg.includes('not found') || msg.includes('no agent')) return AgentErrorCode.AGENT_NOT_FOUND
  if (msg.includes('llm') || msg.includes('api')) return AgentErrorCode.LLM_UNAVAILABLE
  return AgentErrorCode.UNKNOWN
}

/** 将 AgentError 转换为原生 Error（向后兼容） */
export function agentErrorToError(ae: AgentError): Error {
  const err = new Error(`[${ae.code}] ${ae.message}`)
  err.name = ae.code
  return err
}

/** 从原生 Error 创建 AgentError */
export function errorToAgentError(error: Error): AgentError {
  const code = inferErrorCode(error)
  return {
    code,
    message: error.message,
    details: error.stack,
    retryable: RETRY_STRATEGY[code].retryable,
  }
}
