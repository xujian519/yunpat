/**
 * Agent相关错误类
 */
/**
 * Agent输入验证错误
 */
export class AgentInputError extends Error {
  fieldName
  fieldValue
  constructor(message, fieldName, fieldValue) {
    super(message)
    this.fieldName = fieldName
    this.fieldValue = fieldValue
    this.name = 'AgentInputError'
  }
}
/**
 * Agent执行错误
 */
export class AgentExecutionError extends Error {
  originalError
  context
  constructor(message, originalError, context) {
    super(message)
    this.originalError = originalError
    this.context = context
    this.name = 'AgentExecutionError'
  }
}
/**
 * 外部服务调用错误
 */
export class ExternalServiceError extends Error {
  serviceName
  errorType
  originalError
  constructor(message, serviceName, errorType, originalError) {
    super(message)
    this.serviceName = serviceName
    this.errorType = errorType
    this.originalError = originalError
    this.name = 'ExternalServiceError'
  }
}
/**
 * 数据验证错误
 */
export class ValidationError extends Error {
  validationErrors
  constructor(message, validationErrors) {
    super(message)
    this.validationErrors = validationErrors
    this.name = 'ValidationError'
  }
}
//# sourceMappingURL=AgentErrors.js.map
