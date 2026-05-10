import type { BaseAgentInput, BaseAgentOutput } from '@yunpat/agent-base'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchResult } from '@yunpat/agent-prior-art-search'
import type { EssentialFeatureAnalysis } from '@yunpat/core'

/**
 * 权利要求生成智能体输入
 */
export interface ClaimGeneratorInput extends BaseAgentInput {
  /** 发明理解结果（来自Phase 2） */
  inventionUnderstanding: InventionUnderstandingOutput
  /** 先导技术检索结果（来自Phase 3） */
  priorArtSearch?: PriorArtSearchResult
  /** 说明书草稿（可选） */
  specificationDraft?: string
  /** 是否启用逐段确认 */
  enableStepwiseConfirmation?: boolean
}

/**
 * 独立权利要求
 */
export interface IndependentClaim {
  /** 权利要求编号 */
  claim_number: number
  /** 权利要求类型 */
  claim_type: 'device' | 'method' | 'system' | 'composition'
  /** 前序部分 */
  preamble: string
  /** 过渡语 */
  transition: string
  /** 特征部分 */
  body: string
  /** 完整文本 */
  full_text: string
  /** 必要技术特征 */
  essential_features: string[]
}

/**
 * 从属权利要求
 */
export interface DependentClaim {
  /** 权利要求编号 */
  claim_number: number
  /** 引用的权利要求 */
  parent_claim: number
  /** 权利要求内容 */
  content: string
  /** 附加特征 */
  additional_features: string[]
  /** 限定类型 */
  limitation_type: 'further_limitation' | 'alternative' | 'preferred_embodiment'
}

/**
 * 形式检查问题
 */
export interface FormalityIssue {
  /** 权利要求编号 */
  claimNumber: number
  /** 问题描述 */
  issue: string
  /** 修改建议 */
  suggestion: string
}

/**
 * 权利要求集合
 */
export interface ClaimsSet {
  /** 独立权利要求列表 */
  independent_claims: IndependentClaim[]
  /** 从属权利要求列表 */
  dependent_claims: DependentClaim[]
  /** 布局策略说明 */
  layout_strategy: string
  /** 保护范围分析 */
  protection_scope_analysis: string
  /** 质量检查 */
  quality_check: {
    /** 清楚性检查 */
    clarity: string
    /** 支持性检查（A26.4） */
    support: string
    /** 必要技术特征检查 */
    essential_features: string
    /** 潜在问题 */
    potential_issues: string[]
    /** 形式检查结果（基于专利法条款） */
    formality_check?: {
      /** 是否通过 */
      passed: boolean
      /** 清楚简要问题（第26条第4款） */
      clarityIssues: FormalityIssue[]
      /** 非必要技术特征（实施细则第20条第1款） */
      unnecessaryFeatures: Array<{ claimNumber: number; feature: string; reason: string }>
      /** 总体建议 */
      recommendations: string[]
    }
  }
}

/**
 * 权利要求生成输出
 */
export interface ClaimGeneratorOutput extends BaseAgentOutput {
  /** 权利要求集合 */
  claimsSet: ClaimsSet
  /** 生成置信度 */
  confidence: number
}

export interface StructuredInput {
  invention_title: string
  invention_type: string
  technical_field: string
  background_art?: string
  technical_problem: string
  technical_solution: string
  technical_effects?: string[]
  essential_features: Array<{
    name: string
    description: string
    is_essential: boolean
    is_distinguishing: boolean
  }>
  optional_features: Array<unknown>
  prior_art_analysis?: {
    closest_prior_art: string
    differences: string[]
    technical_problem_solved: string
  }
}

export interface ClaimGeneratorPlan {
  input: ClaimGeneratorInput
  templateContent: string
  structuredInput: StructuredInput
}

export interface ClaimRegenerationContext {
  attemptNumber: number
  maxAttempts: number
  missingFeatures: Array<{
    feature: string
    reason: string
    suggestedFix: string
    severity: string
  }>
  unnecessaryIncludedFeatures: Array<{ feature: string; reason: string }>
  featureResolutionHistory: Array<{
    attempt: number
    missingCount: number
    unnecessaryCount: number
    features: string[]
  }>
}

/** 必要技术特征分析结果（LLM 第一步输出） */
export interface EssentialAnalysisResult {
  actual_technical_problem: string
  analysis_table: EssentialFeatureAnalysis[]
}

/** 领域到提示词文件的映射 */
export const DOMAIN_PROMPT_MAP: Record<string, string> = {
  机械: 'claims-domain-mechanical.md',
  机械工程: 'claims-domain-mechanical.md',
  电气: 'claims-domain-electrical.md',
  电学: 'claims-domain-electrical.md',
  化学: 'claims-domain-chemical.md',
  医药: 'claims-domain-chemical.md',
  计算机: 'claims-domain-computer.md',
  软件: 'claims-domain-computer.md',
  通信: 'claims-domain-electrical.md',
}

/** 匹配领域关键词 */
export const DOMAIN_KEYWORDS: Array<{ keywords: string[]; file: string }> = [
  {
    keywords: ['机械', '结构', '装置', '设备', '泵', '阀', '轴承', '齿轮', '轴'],
    file: 'claims-domain-mechanical.md',
  },
  {
    keywords: ['电', '电路', '信号', '通信', '半导体', '芯片'],
    file: 'claims-domain-electrical.md',
  },
  {
    keywords: ['化学', '组合物', '化合物', '制备', '催化剂', '聚合'],
    file: 'claims-domain-chemical.md',
  },
  {
    keywords: ['计算机', '软件', '算法', '数据处理', '人工智能', '机器学习'],
    file: 'claims-domain-computer.md',
  },
]

/** 常量：形式检查和解析相关阈值 */
export const MAX_REGENERATION_ATTEMPTS = 3
export const MAX_CLAIM_NUMBER = 1000
export const MAX_CLAIM_TEXT_LENGTH = 2000
export const MAX_INDEPENDENT_CLAIM_LENGTH = 300
export const MAX_DETAIL_PATTERN_COUNT = 3
export const MIN_FEATURE_LENGTH = 3
export const MAX_FEATURE_LENGTH = 80
export const LLM_MAX_RETRIES = 2
