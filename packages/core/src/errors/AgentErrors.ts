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
