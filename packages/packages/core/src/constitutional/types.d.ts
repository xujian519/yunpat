/**
 * Constitutional AI - 类型定义
 *
 * 定义原则集、合规检查、自动纠正的核心类型
 */
import type { LLMAdapter } from '../lifecycle/Lifecycle.js'
export type { LLMAdapter }
/**
 * 原则类别
 */
export declare enum PrincipleCategory {
  CLARITY = 'clarity', // 清楚性
  BREVITY = 'brevity', // 简要性
  SUPPORT = 'support', // 支持性
  COMPLETENESS = 'completeness', // 完整性
  NOVELTY = 'novelty', // 创造性
  ENABLEMENT = 'enablement', // 充分公开
  BEST_MODE = 'best_mode', // 最佳实施例
  DEFINITENESS = 'definiteness',
}
/**
 * 违规严重程度
 */
export declare enum ViolationSeverity {
  CRITICAL = 'critical', // 严重违规，必须修正
  MAJOR = 'major', // 重要违规，建议修正
  MINOR = 'minor',
}
/**
 * 原则检查函数
 */
export interface PrincipleCheckFunction {
  (content: string): Promise<ComplianceResult>
}
/**
 * 宪法原则
 */
export interface ConstitutionalPrinciple {
  /** 原则唯一标识 */
  id: string
  /** 原则名称 */
  name: string
  /** 原则描述 */
  description: string
  /** 原则类别 */
  category: PrincipleCategory
  /** 优先级（1-10，10最高） */
  priority: number
  /** 检查函数 */
  checkFunction: PrincipleCheckFunction
  /** 法律依据（可选） */
  legalBasis?: string
  /** 示例（可选） */
  examples?: {
    compliant: string[]
    nonCompliant: string[]
  }
}
/**
 * 合规结果
 */
export interface ComplianceResult {
  /** 是否合规 */
  compliant: boolean
  /** 合规分数（0-1，1表示完全合规） */
  score: number
  /** 违规列表 */
  violations: Violation[]
  /** 警告列表 */
  warnings: Warning[]
}
/**
 * 违规详情
 */
export interface Violation {
  /** 违反的原则ID */
  principleId: string
  /** 原则名称 */
  principleName: string
  /** 严重程度 */
  severity: ViolationSeverity
  /** 违规位置 */
  location: {
    start: number
    end: number
    text: string
    context?: string
  }
  /** 违规描述 */
  description: string
  /** 建议修正 */
  suggestedCorrection: string
  /** 置信度（0-1） */
  confidence: number
}
/**
 * 警告详情
 */
export interface Warning {
  /** 原则ID */
  principleId: string
  /** 原则名称 */
  principleName: string
  /** 警告描述 */
  description: string
  /** 警告位置 */
  location?: {
    start: number
    end: number
    text: string
  }
  /** 建议改进 */
  suggestion: string
}
/**
 * 合规报告
 */
export interface ComplianceReport {
  /** 总体是否合规 */
  overallCompliant: boolean
  /** 总体合规分数（0-1） */
  score: number
  /** 违规列表 */
  violations: Violation[]
  /** 警告列表 */
  warnings: Warning[]
  /** 检查时间戳 */
  checkedAt: Date
  /** 检查耗时（毫秒） */
  duration: number
  /** 按原则分类的统计 */
  statistics: {
    principleId: string
    principleName: string
    violationCount: number
    warningCount: number
  }[]
}
/**
 * 纠正策略
 */
export declare enum CorrectionStrategy {
  RULE_BASED = 'rule_based', // 基于规则的纠正
  LLM_BASED = 'llm_based', // 基于LLM的纠正
  HYBRID = 'hybrid',
}
/**
 * 纠正结果
 */
export interface CorrectionResult {
  /** 纠正后的内容 */
  correctedContent: string
  /** 应用的纠正列表 */
  appliedCorrections: AppliedCorrection[]
  /** 纠正策略 */
  strategy: CorrectionStrategy
  /** 纠正耗时（毫秒） */
  duration: number
  /** 纠正时间戳 */
  correctedAt: Date
}
/**
 * 应用的纠正
 */
export interface AppliedCorrection {
  /** 原则ID */
  principleId: string
  /** 原始文本 */
  originalText: string
  /** 纠正后文本 */
  correctedText: string
  /** 位置 */
  location: {
    start: number
    end: number
  }
  /** 纠正理由 */
  reason: string
}
/**
 * Constitutional AI 配置
 */
export interface ConstitutionalAIConfig {
  /** 启用的原则（空数组表示启用所有） */
  enabledPrinciples: string[]
  /** 纠正策略 */
  correctionStrategy: CorrectionStrategy
  /** 严重程度阈值（低于此程度的违规不自动纠正） */
  severityThreshold: ViolationSeverity
  /** 是否使用LLM进行智能检查 */
  useLLMForCheck: boolean
  /** 是否使用LLM进行智能纠正 */
  useLLMForCorrection: boolean
  /** 最大LLM并发请求数 */
  maxLLMConcurrency: number
}
/**
 * 原则冲突解决结果
 */
export interface ConflictResolution {
  /** 保留的违规（高优先级） */
  keptViolations: Violation[]
  /** 移除的违规（低优先级） */
  removedViolations: Violation[]
  /** 解决说明 */
  resolution: string
}
//# sourceMappingURL=types.d.ts.map
