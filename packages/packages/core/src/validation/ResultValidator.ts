/**
 * 结果验证器 - P0 准确率优化方案 #2
 *
 * Facade 类：保留公开 API，委托到 ResultValidatorTypes、QualityChecker、ConsistencyDetector。
 */

import { z, ZodSchema } from 'zod'
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import { HallucinationDetector } from './HallucinationDetector.js'
import { checkQuality } from './QualityChecker.js'
import { detectInconsistencies } from './ConsistencyDetector.js'

// re-export 所有类型，保持公开 API 不变
export type {
  ValidationResult,
  QualityRequirements,
  QualityReport,
  Inconsistency,
  ResultValidatorConfig,
} from './ResultValidatorTypes.js'
export { ValidationErrorType, CorrectionStrategy } from './ResultValidatorTypes.js'

// 内部使用
import type { ValidationResult as TValidationResult } from './ResultValidatorTypes.js'
import type { ResultValidatorConfig as TConfig } from './ResultValidatorTypes.js'
import { ValidationErrorType, CorrectionStrategy } from './ResultValidatorTypes.js'

/**
 * 结果验证器
 */
export class ResultValidator {
  private config: TConfig
  private hallucinationDetector?: HallucinationDetector

  constructor(config: TConfig = {}) {
    this.config = {
      verbose: true,
      defaultCorrectionStrategy: CorrectionStrategy.RETRY,
      maxRetries: 3,
      llm: config.llm,
      knowledgeBase: config.knowledgeBase,
      enableHallucinationCheck: false,
    }

    // 应用用户配置
    if (config.verbose !== undefined) {
      this.config.verbose = config.verbose
    }
    if (config.defaultCorrectionStrategy !== undefined) {
      this.config.defaultCorrectionStrategy = config.defaultCorrectionStrategy
    }
    if (config.maxRetries !== undefined) {
      this.config.maxRetries = config.maxRetries
    }
    if (config.enableHallucinationCheck !== undefined) {
      this.config.enableHallucinationCheck = config.enableHallucinationCheck
    }

    // 初始化幻觉检测器（如果提供了 LLM 和 KnowledgeBase）
    if (config.llm && config.knowledgeBase && this.config.enableHallucinationCheck) {
      this.hallucinationDetector = new HallucinationDetector(config.llm, config.knowledgeBase, {
        enableFactCheck: true,
        enableLogicalConsistencyCheck: true,
        enableSourceAttribution: true,
        factCheckThreshold: 0.7,
      })
    }
  }

  /** 更新幻觉检测器配置（运行时） */
  public setHallucinationDetector(detector: HallucinationDetector): void {
    this.hallucinationDetector = detector
  }

  /** 获取幻觉检测器（如果已配置） */
  public getHallucinationDetector(): HallucinationDetector | undefined {
    return this.hallucinationDetector
  }

  /** 验证结果（结构 + 质量 + 逻辑） */
  async validate<T>(result: T, schema: ZodSchema<T>): Promise<TValidationResult<T>> {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. 结构验证（Zod schema）
    const structuralResult = this.validateStructure(result, schema)
    if (!structuralResult.valid) {
      errors.push(...structuralResult.errors)
      return {
        valid: false,
        errors,
        warnings,
        errorType: ValidationErrorType.STRUCTURAL,
      }
    }

    // 2. 内容质量检查（仅对字符串类型）
    if (typeof result === 'string' || (typeof result === 'object' && result !== null)) {
      const content = this.extractContent(result)
      if (content) {
        const qualityResult = checkQuality(content, {})
        if (!qualityResult.passed) {
          if (!qualityResult.lengthCheck.passed) {
            errors.push(
              `长度检查失败: 实际 ${qualityResult.lengthCheck.actualLength} 字符` +
                (qualityResult.lengthCheck.minLength
                  ? `, 要求最小 ${qualityResult.lengthCheck.minLength}`
                  : '') +
                (qualityResult.lengthCheck.maxLength
                  ? `, 要求最大 ${qualityResult.lengthCheck.maxLength}`
                  : '')
            )
          }
          if (!qualityResult.keywordCheck.passed) {
            if (qualityResult.keywordCheck.missingRequired.length > 0) {
              errors.push(
                `缺少必需关键词: ${qualityResult.keywordCheck.missingRequired.join(', ')}`
              )
            }
            if (qualityResult.keywordCheck.foundForbidden.length > 0) {
              errors.push(`包含禁止关键词: ${qualityResult.keywordCheck.foundForbidden.join(', ')}`)
            }
          }
          if (!qualityResult.completenessCheck.passed) {
            errors.push(
              `内容被截断，检测到标记: ${qualityResult.completenessCheck.truncationMarker}`
            )
          }
          return {
            valid: false,
            errors,
            warnings,
            errorType: ValidationErrorType.QUALITY,
          }
        }
      }
    }

    // 3. 逻辑一致性验证
    const content = this.extractContent(result)
    if (content && typeof content === 'string') {
      const inconsistencies = await detectInconsistencies(content)
      if (inconsistencies.length > 0) {
        warnings.push(`检测到 ${inconsistencies.length} 个潜在逻辑问题:`)
        inconsistencies.forEach((inc) => {
          warnings.push(`  - ${inc.type}: ${inc.description}`)
        })
        // 逻辑问题不阻止验证，只发出警告
      }
    }

    return {
      valid: true,
      data: structuralResult.data,
      errors,
      warnings,
    }
  }

  /** 带幻觉检测的验证（结构 + 质量 + 逻辑 + 幻觉检测） */
  async validateWithHallucinationCheck<T>(
    result: T,
    schema: ZodSchema<T>,
    options?: {
      factCheckThreshold?: number
      enableFactCheck?: boolean
      enableLogicalConsistencyCheck?: boolean
      enableSourceAttribution?: boolean
    }
  ): Promise<TValidationResult<T>> {
    // 1. 执行基础验证
    const baseResult = await this.validate(result, schema)

    // 2. 如果没有配置幻觉检测器，直接返回基础验证结果
    if (!this.hallucinationDetector) {
      return baseResult
    }

    // 3. 提取内容并进行幻觉检测
    const content = this.extractContent(result)
    if (!content || typeof content !== 'string') {
      return baseResult
    }

    try {
      // 执行幻觉检测
      const hallucinationReport = await this.hallucinationDetector.detect(content)

      // 根据幻觉检测报告更新验证结果
      const errors = [...baseResult.errors]
      const warnings = [...baseResult.warnings]

      // 如果幻觉分数过高，添加错误
      if (hallucinationReport.overallScore >= (options?.factCheckThreshold ?? 0.7)) {
        errors.push(
          `幻觉检测分数过高: ${(hallucinationReport.overallScore * 100).toFixed(1)}% ` +
            `(阈值: ${((options?.factCheckThreshold ?? 0.7) * 100).toFixed(1)}%)`
        )
      }

      // 添加事实验证结果到警告
      if (hallucinationReport.factCheckResults.length > 0) {
        const unverifiedFacts = hallucinationReport.factCheckResults.filter(
          (r) => r.isVerifiable && !r.isVerified
        )
        if (unverifiedFacts.length > 0) {
          warnings.push(`发现 ${unverifiedFacts.length} 个未验证的事实声明`)
        }
      }

      // 添加逻辑不一致问题到警告
      if (hallucinationReport.logicalInconsistencies.length > 0) {
        warnings.push(`发现 ${hallucinationReport.logicalInconsistencies.length} 个逻辑不一致问题`)
      }

      // 添加源归属问题到警告
      if (hallucinationReport.sourceAttributionIssues.length > 0) {
        const criticalIssues = hallucinationReport.sourceAttributionIssues.filter(
          (i) => i.severity === 'critical'
        )
        if (criticalIssues.length > 0) {
          warnings.push(`发现 ${criticalIssues.length} 个关键源归属问题`)
        }
      }

      return {
        ...baseResult,
        errors,
        warnings,
        hallucinationReport,
        errorType: errors.length > 0 ? ValidationErrorType.FACTUAL : baseResult.errorType,
      }
    } catch (error) {
      // 幻觉检测失败，记录警告但不阻止验证
      if (this.config.verbose) {
        console.warn('幻觉检测失败:', error)
      }
      return {
        ...baseResult,
        warnings: [
          ...baseResult.warnings,
          `幻觉检测失败: ${error instanceof Error ? error.message : '未知错误'}`,
        ],
      }
    }
  }

  /** 结构验证（Zod schema） */
  private validateStructure<T>(result: T, schema: ZodSchema<T>): TValidationResult<T> {
    try {
      const data = schema.parse(result)
      return {
        valid: true,
        data,
        errors: [],
        warnings: [],
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorsList = error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
        return {
          valid: false,
          errors: errorsList,
          warnings: [],
        }
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      }
    }
  }

  /** 提取内容（从对象或字符串） */
  private extractContent(result: unknown): string | null {
    if (typeof result === 'string') {
      return result
    }

    if (typeof result === 'object' && result !== null) {
      const obj = result as Record<string, unknown>
      // 尝试提取常见的 content/message/text 字段
      if (typeof obj.content === 'string') return obj.content
      if (typeof obj.message === 'string') return obj.message
      if (typeof obj.text === 'string') return obj.text
      if (typeof obj.output === 'string') return obj.output

      // 如果没有单个content字段，尝试合并所有字符串字段
      const stringFields = Object.entries(obj)
        .filter(([key, value]) => typeof value === 'string' && !key.startsWith('_'))
        .map(([_key, value]) => value as string)

      if (stringFields.length > 0) {
        // 返回合并的内容，用换行符分隔
        return stringFields.join('\n')
      }

      // 尝试提取 LLM 响应格式
      if (
        Array.isArray(obj.choices) &&
        obj.choices.length > 0 &&
        typeof obj.choices[0] === 'object' &&
        obj.choices[0] !== null
      ) {
        const choice = obj.choices[0] as Record<string, unknown>
        if (typeof choice.message === 'object' && choice.message !== null) {
          const message = choice.message as Record<string, unknown>
          if (typeof message.content === 'string') {
            return message.content
          }
        }
      }
    }

    return null
  }

  /** 纠正结果 */
  async correct<T>(
    result: T,
    validationResult: TValidationResult<T>,
    retryFn?: () => Promise<T>
  ): Promise<T> {
    const strategy = this.determineCorrectionStrategy(validationResult)

    this.log(`执行纠正策略: ${strategy}`)

    switch (strategy) {
      case CorrectionStrategy.RETRY:
        if (!retryFn) {
          throw new Error('重试策略需要提供 retryFn')
        }
        return await this.retryWithBackoff(retryFn)

      case CorrectionStrategy.DEGRADE:
        return this.degradeResult(result, validationResult)

      case CorrectionStrategy.MANUAL:
        throw new Error(`验证失败，需要人工介入: ${validationResult.errors.join('; ')}`)

      case CorrectionStrategy.FORCE_ACCEPT:
        this.log('强制接受结果（带有警告）')
        if (validationResult.warnings.length > 0) {
          console.warn('[ResultValidator] 警告:', validationResult.warnings)
        }
        return result

      default:
        throw new Error(`未知的纠正策略: ${strategy}`)
    }
  }

  /** 确定纠正策略 */
  private determineCorrectionStrategy<T>(result: TValidationResult<T>): CorrectionStrategy {
    // 结构错误：重试
    if (result.errorType === ValidationErrorType.STRUCTURAL) {
      return CorrectionStrategy.RETRY
    }

    // 质量错误：根据默认策略
    if (result.errorType === ValidationErrorType.QUALITY) {
      return this.config.defaultCorrectionStrategy ?? CorrectionStrategy.RETRY
    }

    // 逻辑错误：强制接受（只警告）
    if (result.errorType === ValidationErrorType.LOGICAL) {
      return CorrectionStrategy.FORCE_ACCEPT
    }

    // 未知错误：使用默认策略
    return this.config.defaultCorrectionStrategy ?? CorrectionStrategy.RETRY
  }

  /** 重试（带指数退避） */
  private async retryWithBackoff<T>(retryFn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined
    const maxRetries = this.config.maxRetries ?? 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`重试 ${attempt}/${maxRetries}`)
        return await retryFn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        this.log(`重试 ${attempt} 失败: ${lastError.message}`)

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('所有重试均失败')
  }

  /** 降级结果 */
  private degradeResult<T>(result: T, validationResult: TValidationResult<T>): T {
    this.log('降级处理: 返回部分结果')

    // 如果是字符串，添加警告前缀
    if (typeof result === 'string') {
      return `[警告: 验证未通过] ${result}` as T
    }

    // 如果是对象，尝试添加警告字段
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      const degradedResult = {
        ...result,
        _validationWarnings: validationResult.errors,
      }
      return degradedResult as T
    }

    // 其他情况，直接返回
    return result
  }

  /** 延迟函数 */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** 日志输出 */
  private log(message: string): void {
    if (!this.config.verbose) return

    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [ResultValidator] ${message}`)
  }
}
