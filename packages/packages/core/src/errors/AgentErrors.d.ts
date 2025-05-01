/**
 * Agent相关错误类
 */
/**
 * Agent输入验证错误
 */
export declare class AgentInputError extends Error {
  readonly fieldName?: string | undefined
  readonly fieldValue?: any | undefined
  constructor(message: string, fieldName?: string | undefined, fieldValue?: any | undefined)
}
/**
 * Agent执行错误
 */
export declare class AgentExecutionError extends Error {
  readonly originalError?: Error | undefined
  readonly context?: Record<string, any> | undefined
  constructor(
    message: string,
    originalError?: Error | undefined,
    context?: Record<string, any> | undefined
  )
}
/**
 * 外部服务调用错误
 */
export declare class ExternalServiceError extends Error {
  readonly serviceName: string
  readonly errorType?: 'TIMEOUT' | 'PARSE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN' | undefined
  readonly originalError?: Error | undefined
  constructor(
    message: string,
    serviceName: string,
    errorType?: 'TIMEOUT' | 'PARSE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN' | undefined,
    originalError?: Error | undefined
  )
}
/**
 * 数据验证错误
 */
export declare class ValidationError extends Error {
  readonly validationErrors: Array<{
    field: string
    message: string
    value?: any
  }>
  constructor(
    message: string,
    validationErrors: Array<{
      field: string
      message: string
      value?: any
    }>
  )
}
//# sourceMappingURL=AgentErrors.d.ts.map
