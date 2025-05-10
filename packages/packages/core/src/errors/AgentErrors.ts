/**
 * Agent相关错误类
 */

/**
 * Agent输入验证错误
 */
export class AgentInputError extends Error {
  constructor(
    message: string,
    public readonly fieldName?: string,
    public readonly fieldValue?: any
  ) {
    super(message)
    this.name = 'AgentInputError'
  }
}

/**
 * Agent执行错误
 */
export class AgentExecutionError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AgentExecutionError'
  }
}

/**
 * 外部服务调用错误
 */
export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly errorType?: 'TIMEOUT' | 'PARSE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN',
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'ExternalServiceError'
  }
}

/**
 * 数据验证错误
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: Array<{
      field: string
      message: string
      value?: any
    }>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * 工具执行错误
 *
 * 包含工具名、输入、错误类型和是否可重试。
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly input: unknown,
    public readonly errorType:
      | 'TIMEOUT'
      | 'PERMISSION_DENIED'
      | 'INTERRUPTED'
      | 'VALIDATION_FAILED'
      | 'EXECUTION_FAILED',
    public readonly retryable: boolean = false,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}

/**
 * 权限拒绝错误
 */
export class PermissionDeniedError extends ToolExecutionError {
  constructor(
    message: string,
    toolName: string,
    input: unknown,
    public readonly requiredPermissions: string[],
    public readonly reason: string
  ) {
    super(message, toolName, input, 'PERMISSION_DENIED', false)
    this.name = 'PermissionDeniedError'
  }
}
