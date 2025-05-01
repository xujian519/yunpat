/**
 * 结果验证器 - P0 准确率优化方案 #2
 *
 * 核心功能：
 * 1. 结构验证（Zod schema 检查）
 * 2. 内容质量检查（长度、格式、完整性）
 * 3. 逻辑一致性验证（无矛盾、无重复）
 * 4. 幻觉检测（事实验证、逻辑一致性、源归属）
 * 5. 自动纠正策略（重试、降级、人工介入）
 */
import { ZodSchema } from 'zod'
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import { HallucinationDetector } from './HallucinationDetector.js'
import { HallucinationReport } from './hallucination-types.js'
/**
 * 验证结果
 */
export interface ValidationResult<T = unknown> {
  /** 是否通过验证 */
  valid: boolean
  /** 验证通过的数据 */
  data?: T
  /** 错误信息 */
  errors: string[]
  /** 警告信息 */
  warnings: string[]
  /** 错误类型 */
  errorType?: ValidationErrorType
  /** 幻觉检测报告（如果执行了幻觉检测） */
  hallucinationReport?: HallucinationReport
}
/**
 * 错误类型
 */
export declare enum ValidationErrorType {
  /** 结构错误（schema 不匹配） */
  STRUCTURAL = 'structural',
  /** 质量错误（长度、格式、完整性） */
  QUALITY = 'quality',
  /** 逻辑错误（矛盾、重复） */
  LOGICAL = 'logical',
  /** 事实错误（幻觉检测发现的错误） */
  FACTUAL = 'factual',
  /** 合规错误（违反规范或原则） */
  COMPLIANCE = 'compliance',
}
/**
 * 质量要求
 */
export interface QualityRequirements {
  /** 最小长度（字符数） */
  minLength?: number
  /** 最大长度（字符数） */
  maxLength?: number
  /** 必须包含的关键词 */
  requiredKeywords?: string[]
  /** 禁止包含的关键词 */
  forbiddenKeywords?: string[]
  /** 是否必须完整（不以截断标记结尾） */
  mustBeComplete?: boolean
  /** 截断标记列表 */
  truncationMarkers?: string[]
}
/**
 * 质量报告
 */
export interface QualityReport {
  /** 是否通过质量检查 */
  passed: boolean
  /** 长度检查结果 */
  lengthCheck: {
    passed: boolean
    actualLength: number
    minLength?: number
    maxLength?: number
  }
  /** 关键词检查结果 */
  keywordCheck: {
    passed: boolean
    missingRequired: string[]
    foundForbidden: string[]
  }
  /** 完整性检查结果 */
  completenessCheck: {
    passed: boolean
    isTruncated: boolean
    truncationMarker?: string
  }
}
/**
 * 不一致性
 */
export interface Inconsistency {
  /** 不一致类型 */
  type: 'contradiction' | 'repetition' | 'gap' | 'other'
  /** 描述 */
  description: string
  /** 位置（如果有） */
  location?: {
    start: number
    end: number
  }
}
/**
 * 纠正策略
 */
export declare enum CorrectionStrategy {
  /** 重试（简单重试机制） */
  RETRY = 'retry',
  /** 降级（返回部分结果） */
  DEGRADE = 'degrade',
  /** 人工介入（返回错误） */
  MANUAL = 'manual',
  /** 强制接受（标记警告） */
  FORCE_ACCEPT = 'force_accept',
}
/**
 * ResultValidator 配置
 */
export interface ResultValidatorConfig {
  /** 是否启用详细日志 */
  verbose?: boolean
  /** 默认纠正策略 */
  defaultCorrectionStrategy?: CorrectionStrategy
  /** 最大重试次数 */
  maxRetries?: number
  /** LLM 适配器（用于幻觉检测） */
  llm?: LLMAdapter
  /** 知识库（用于事实验证） */
  knowledgeBase?: KnowledgeBase
  /** 是否启用幻觉检测 */
  enableHallucinationCheck?: boolean
}
/**
 * 结果验证器
 */
export declare class ResultValidator {
  private config
  private hallucinationDetector?
  constructor(config?: ResultValidatorConfig)
  /**
   * 更新幻觉检测器配置（运行时）
   */
  setHallucinationDetector(detector: HallucinationDetector): void
  /**
   * 获取幻觉检测器（如果已配置）
   */
  getHallucinationDetector(): HallucinationDetector | undefined
  /**
   * 验证结果（结构 + 质量 + 逻辑）
   */
  validate<T>(result: T, schema: ZodSchema<T>): Promise<ValidationResult<T>>
  /**
   * 带幻觉检测的验证（结构 + 质量 + 逻辑 + 幻觉检测）
   */
  validateWithHallucinationCheck<T>(
    result: T,
    schema: ZodSchema<T>,
    options?: {
      factCheckThreshold?: number
      enableFactCheck?: boolean
      enableLogicalConsistencyCheck?: boolean
      enableSourceAttribution?: boolean
    }
  ): Promise<ValidationResult<T>>
  /**
   * 结构验证（Zod schema）
   */
  private validateStructure
  /**
   * 内容质量检查
   */
  checkQuality(content: string, requirements: QualityRequirements): QualityReport
  /**
   * 长度检查
   */
  private checkLength
  /**
   * 关键词检查
   */
  private checkKeywords
  /**
   * 完整性检查
   */
  private checkCompleteness
  /**
   * 逻辑一致性验证
   */
  detectInconsistencies(content: string): Promise<Inconsistency[]>
  /**
   * 检测矛盾陈述
   */
  private detectContradictions
  /**
   * 检测重复内容
   */
  private detectRepetitions
  /**
   * 检测逻辑断层
   */
  private detectGaps
  /**
   * 计算两个字符串的相似度（简化版）
   */
  private calculateSimilarity
  /**
   * Levenshtein 距离
   */
  private levenshteinDistance
  /**
   * 提取内容（从对象或字符串）
   */
  private extractContent
  /**
   * 纠正结果
   */
  correct<T>(
    result: T,
    validationResult: ValidationResult<T>,
    retryFn?: () => Promise<T>
  ): Promise<T>
  /**
   * 确定纠正策略
   */
  private determineCorrectionStrategy
  /**
   * 重试（带指数退避）
   */
  private retryWithBackoff
  /**
   * 降级结果
   */
  private degradeResult
  /**
   * 延迟函数
   */
  private sleep
  /**
   * 日志输出
   */
  private log
}
//# sourceMappingURL=ResultValidator.d.ts.map
