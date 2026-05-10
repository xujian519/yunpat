/**
 * 结果验证器类型定义
 *
 * 包含所有接口、类型和枚举定义。
 */

import type { LLMAdapter } from '../lifecycle/Lifecycle.js'
import type { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import type { HallucinationReport } from './hallucination-types.js'

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
export enum ValidationErrorType {
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
export enum CorrectionStrategy {
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
