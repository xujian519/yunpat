/**
 * 输入验证器
 *
 * 为审查答复智能体系统提供严格的输入验证
 */

import {
  OAResponderError,
  ValidationError,
  ErrorCode,
} from './errors.js'
import {
  VALIDATION_CONSTANTS,
  EXAMINER_CONSTANTS,
  PREDICTOR_CONSTANTS,
  HEBBIAN_CONSTANTS,
  WORKFLOW_CONSTANTS,
  isInRange,
  clamp,
} from './constants.js'

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean

  /** 错误信息 */
  errors: string[]

  /** 警告信息 */
  warnings: string[]
}

/**
 * 验证上下文
 */
export interface ValidationContext {
  /** 验证器名称 */
  validatorName: string

  /** 严格模式（遇到错误立即抛出） */
  strictMode?: boolean

  /** 收集警告 */
  collectWarnings?: boolean
}

/**
 * 通用验证器基类
 */
export abstract class BaseValidator {
  protected context: ValidationContext

  constructor(validatorName: string) {
    this.context = {
      validatorName,
      strictMode: false,
      collectWarnings: true,
    }
  }

  /**
   * 验证并抛出错误（如果严格模式）
   */
  protected validateOrFail(
    condition: boolean,
    fieldName: string,
    fieldValue: any,
    errorMessage: string
  ): void {
    if (!condition) {
      const error = new ValidationError(
        errorMessage,
        fieldName,
        fieldValue,
        { validator: this.context.validatorName }
      )

      if (this.context.strictMode) {
        throw error
      }
    }
  }

  /**
   * 添加警告
   */
  protected addWarning(warning: string): void {
    if (this.context.collectWarnings) {
      // 可以存储到上下文中
      console.warn(`[${this.context.validatorName}] ${warning}`)
    }
  }
}

/**
 * OfficeAction 验证器
 */
export class OfficeActionValidator extends BaseValidator {
  constructor() {
    super('OfficeActionValidator')
  }

  /**
   * 验证 OfficeAction 对象
   */
  validate(officeAction: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 基础验证
      this.validateNullOrUndefined(officeAction, 'officeAction', errors)

      // oa_type 验证
      this.validateOAType(officeAction?.oa_type, errors)

      // affected_claims 验证
      this.validateAffectedClaims(officeAction?.affected_claims, errors, warnings)

      // citations 验证
      this.validateCitations(officeAction?.citations, errors, warnings)

      // examiner_arguments 验证
      this.validateExaminerArguments(officeAction?.examiner_arguments, errors, warnings)
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message)
      } else {
        errors.push(`验证过程中发生错误: ${(error as Error).message}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private validateNullOrUndefined(value: any, fieldName: string, errors: string[]): void {
    if (value === null || value === undefined) {
      errors.push(`${fieldName} 不能为 null 或 undefined`)
    }
  }

  private validateOAType(oaType: any, errors: string[]): void {
    if (!oaType || typeof oaType !== 'string') {
      errors.push('oa_type 必须是非空字符串')
      return
    }

    const validTypes = ['Novelty', 'InventiveStep', 'Clarity', 'Support', 'Formality']
    if (!validTypes.includes(oaType)) {
      errors.push(`oa_type 必须是以下之一: ${validTypes.join(', ')}`)
    }
  }

  private validateAffectedClaims(
    claims: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!Array.isArray(claims)) {
      errors.push('affected_claims 必须是数组')
      return
    }

    if (claims.length === 0) {
      warnings.push('affected_claims 为空数组')
    }

    if (claims.length > VALIDATION_CONSTANTS.MAX_CLAIMS_COUNT) {
      warnings.push(
        `affected_claims 数量过多 (${claims.length})，可能影响性能`
      )
    }

    // 验证每个元素都是数字
    claims.forEach((claim, index) => {
      if (typeof claim !== 'number' || !Number.isInteger(claim)) {
        errors.push(`affected_claims[${index}] 必须是整数`)
      }
    })
  }

  private validateCitations(
    citations: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!Array.isArray(citations)) {
      errors.push('citations 必须是数组')
      return
    }

    if (citations.length > VALIDATION_CONSTANTS.MAX_ARRAY_LENGTH) {
      warnings.push(
        `citations 数量过多 (${citations.length})，可能影响性能`
      )
    }

    // 验证引用文献结构
    citations.forEach((citation: any, index: number) => {
      if (citation === null || typeof citation !== 'object') {
        errors.push(`citations[${index}] 必须是对象`)
        return
      }

      if (!citation.document_number || typeof citation.document_number !== 'string') {
        errors.push(`citations[${index}].document_number 必须是非空字符串`)
      }
    })
  }

  private validateExaminerArguments(
    arguments_: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!arguments_) {
      warnings.push('examiner_arguments 为空')
      return
    }

    if (typeof arguments_ !== 'string') {
      errors.push('examiner_arguments 必须是字符串')
      return
    }

    if (arguments_.length > VALIDATION_CONSTANTS.MAX_STRING_LENGTH) {
      errors.push(
        `examiner_arguments 过长 (${arguments_.length} 字符)，最大允许 ${VALIDATION_CONSTANTS.MAX_STRING_LENGTH} 字符`
      )
    }

    if (arguments_.length === 0) {
      warnings.push('examiner_arguments 为空字符串')
    }
  }
}

/**
 * ResponseDocument 验证器
 */
export class ResponseDocumentValidator extends BaseValidator {
  constructor() {
    super('ResponseDocumentValidator')
  }

  validate(responseDocument: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 基础验证
      this.validateNullOrUndefined(responseDocument, 'responseDocument', errors)

      // writtenArgument 验证
      this.validateWrittenArgument(responseDocument?.writtenArgument, errors, warnings)

      // amendedClaims 验证
      this.validateAmendedClaims(responseDocument?.amendedClaims, errors, warnings)

      // amendmentComparison 验证
      this.validateAmendmentComparison(responseDocument?.amendmentComparison, errors)

      // responseStrategy 验证
      this.validateResponseStrategy(responseDocument?.responseStrategy, errors)
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message)
      } else {
        errors.push(`验证过程中发生错误: ${(error as Error).message}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private validateNullOrUndefined(value: any, fieldName: string, errors: string[]): void {
    if (value === null || value === undefined) {
      errors.push(`${fieldName} 不能为 null 或 undefined`)
    }
  }

  private validateWrittenArgument(
    argument: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!argument) {
      errors.push('writtenArgument 不能为空')
      return
    }

    if (typeof argument !== 'string') {
      errors.push('writtenArgument 必须是字符串')
      return
    }

    if (argument.length > VALIDATION_CONSTANTS.MAX_STRING_LENGTH) {
      errors.push(
        `writtenArgument 过长 (${argument.length} 字符)，最大允许 ${VALIDATION_CONSTANTS.MAX_STRING_LENGTH} 字符`
      )
    }

    if (argument.length < 100) {
      warnings.push('writtenArgument 过短，可能不够详细')
    }
  }

  private validateAmendedClaims(
    claims: any,
    errors: string[],
    warnings: string[]
  ): void {
    if (!Array.isArray(claims)) {
      errors.push('amendedClaims 必须是数组')
      return
    }

    if (claims.length === 0) {
      warnings.push('amendedClaims 为空数组')
    }

    if (claims.length > VALIDATION_CONSTANTS.MAX_CLAIMS_COUNT) {
      errors.push(
        `amendedClaims 数量过多 (${claims.length})，最大允许 ${VALIDATION_CONSTANTS.MAX_CLAIMS_COUNT}`
      )
    }

    claims.forEach((claim: any, index: number) => {
      if (typeof claim !== 'string') {
        errors.push(`amendedClaims[${index}] 必须是字符串`)
      } else if (claim.trim().length === 0) {
        errors.push(`amendedClaims[${index}] 不能为空字符串`)
      }
    })
  }

  private validateAmendmentComparison(comparison: any, errors: string[]): void {
    if (!comparison) {
      return // 可选字段
    }

    if (typeof comparison !== 'string') {
      errors.push('amendmentComparison 必须是字符串')
    }
  }

  private validateResponseStrategy(strategy: any, errors: string[]): void {
    if (!strategy) {
      errors.push('responseStrategy 不能为空')
      return
    }

    const validStrategies = ['amendment', 'argument', 'combination']
    if (!validStrategies.includes(strategy)) {
      errors.push(
        `responseStrategy 必须是以下之一: ${validStrategies.join(', ')}`
      )
    }
  }
}

/**
 * 分数验证器
 */
export class ScoreValidator extends BaseValidator {
  constructor() {
    super('ScoreValidator')
  }

  /**
   * 验证分数
   */
  validate(
    score: any,
    min: number = VALIDATION_CONSTANTS.SCORE_MIN,
    max: number = VALIDATION_CONSTANTS.SCORE_MAX,
    fieldName: string = 'score'
  ): ValidationResult {
    const errors: string[] = []

    if (typeof score !== 'number') {
      errors.push(`${fieldName} 必须是数字`)
      return { isValid: false, errors, warnings: [] }
    }

    if (isNaN(score)) {
      errors.push(`${fieldName} 不能是 NaN`)
    }

    if (!isFinite(score)) {
      errors.push(`${fieldName} 不能是 Infinity`)
    }

    if (score < min || score > max) {
      errors.push(`${fieldName} 必须在 ${min} 到 ${max} 之间`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    }
  }

  /**
   * 验证并限制分数在范围内
   */
  validateAndClamp(
    score: any,
    min: number = VALIDATION_CONSTANTS.SCORE_MIN,
    max: number = VALIDATION_CONSTANTS.SCORE_MAX
  ): number {
    const result = this.validate(score, min, max)

    if (!result.isValid) {
      throw new ValidationError(
        result.errors.join('; '),
        'score',
        score
      )
    }

    return clamp(score, min, max)
  }
}

/**
 * 配置验证器
 */
export class ConfigValidator extends BaseValidator {
  constructor() {
    super('ConfigValidator')
  }

  /**
   * 验证配置对象
   */
  validateConfig<T extends Record<string, any>>(
    config: T,
    schema: Record<
      keyof T,
      {
        required?: boolean
        type: string
        range?: [number, number]
        enum?: any[]
      }
    >
  ): ValidationResult {
    const errors: string[] = []

    for (const [key, rules] of Object.entries(schema)) {
      const value = config[key as keyof T]

      // 检查必填
      if (rules.required && value === undefined) {
        errors.push(`${String(key)} 是必填项`)
        continue
      }

      // 如果值不存在且非必填，跳过其他验证
      if (value === undefined) {
        continue
      }

      // 检查类型
      const actualType = typeof value
      if (actualType !== rules.type) {
        errors.push(`${String(key)} 必须是 ${rules.type} 类型（实际: ${actualType}）`)
      }

      // 检查范围
      if (rules.range && actualType === 'number') {
        const [min, max] = rules.range
        if (value < min || value > max) {
          errors.push(`${String(key)} 必须在 ${min} 到 ${max} 之间`)
        }
      }

      // 检查枚举
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${String(key)} 必须是以下之一: ${rules.enum.join(', ')}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    }
  }
}

/**
 * 批量验证器
 */
export class BatchValidator {
  private results: Map<string, ValidationResult> = new Map()

  /**
   * 添加验证结果
   */
  addResult(key: string, result: ValidationResult): void {
    this.results.set(key, result)
  }

  /**
   * 获取所有错误
   */
  getAllErrors(): Map<string, string[]> {
    const errors = new Map<string, string[]>()
    for (const [key, result] of this.results.entries()) {
      if (result.errors.length > 0) {
        errors.set(key, result.errors)
      }
    }
    return errors
  }

  /**
   * 获取所有警告
   */
  getAllWarnings(): Map<string, string[]> {
    const warnings = new Map<string, string[]>()

    for (const [key, result] of this.results.entries()) {
      if (result.warnings.length > 0) {
        warnings.set(key, result.warnings)
      }
    }

    return warnings
  }

  /**
   * 检查是否全部有效
   */
  isAllValid(): boolean {
    for (const result of this.results.values()) {
      if (!result.isValid) {
        return false
      }
    }
    return true
  }

  /**
   * 获取汇总报告
   */
  getSummary(): {
    total: number
    valid: number
    invalid: number
    errors: number
    warnings: number
  } {
    let valid = 0
    let invalid = 0
    let errors = 0
    let warnings = 0

    for (const result of this.results.values()) {
      if (result.isValid) {
        valid++
      } else {
        invalid++
      }
      errors += result.errors.length
      warnings += result.warnings.length
    }

    return {
      total: this.results.size,
      valid,
      invalid,
      errors,
      warnings,
    }
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 验证 OfficeAction（便捷函数）
 */
export function validateOfficeAction(officeAction: any): void {
  const validator = new OfficeActionValidator()
  const result = validator.validate(officeAction)

  if (!result.isValid) {
    throw new ValidationError(
      `OfficeAction 验证失败:\n${result.errors.join('\n')}`,
      'officeAction',
      officeAction
    )
  }

  if (result.warnings.length > 0) {
    console.warn('[OfficeActionValidator] 验证警告:')
    result.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }
}

/**
 * 验证 ResponseDocument（便捷函数）
 */
export function validateResponseDocument(responseDocument: any): void {
  const validator = new ResponseDocumentValidator()
  const result = validator.validate(responseDocument)

  if (!result.isValid) {
    throw new ValidationError(
      `ResponseDocument 验证失败:\n${result.errors.join('\n')}`,
      'responseDocument',
      responseDocument
    )
  }

  if (result.warnings.length > 0) {
    console.warn('[ResponseDocumentValidator] 验证警告:')
    result.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }
}

/**
 * 验证分数（便捷函数）
 */
export function validateScore(
  score: any,
  min: number = VALIDATION_CONSTANTS.SCORE_MIN,
  max: number = VALIDATION_CONSTANTS.SCORE_MAX,
  fieldName: string = 'score'
): number {
  const validator = new ScoreValidator()
  return validator.validateAndClamp(score, min, max)
}

/**
 * 验证配置（便捷函数）
 */
export function validateConfig<T extends Record<string, any>>(
  config: T,
  schema: Record<keyof T, { required?: boolean; type: string; range?: [number, number]; enum?: any[] }>
): void {
  const validator = new ConfigValidator()
  const result = validator.validateConfig(config, schema)

  if (!result.isValid) {
    throw new ValidationError(
      `配置验证失败:\n${result.errors.join('\n')}`,
      'config',
      config
    )
  }
}
