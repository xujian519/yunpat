/**
 * 最小技术单元提取 - 类型定义
 *
 * 基于《专利侵权判定指南》第8条、最高人民法院(2020)民再125号判决
 * 以及复审无效决定确立的"最小技术单元"概念体系
 */

/** 技术方案类型 */
export type TechnicalSchemeType = 'product' | 'method'

/** 最小技术单元识别场景 */
export type TechUnitScenario =
  | 'infringement'
  | 'equivalent_infringement'
  | 'creativity'
  | 'functional_feature'
  | 'prior_art_defense'
  | 'claim_interpretation'

/** 最小技术单元三要件验证结果 */
export interface TechUnitCriteria {
  /** 相对独立的技术功能 */
  hasIndependentFunction: boolean
  /** 相对独立的技术效果 */
  hasIndependentEffect: boolean
  /** 是否不可再分（最小） */
  isIndivisible: boolean
  /** 验证说明 */
  reasoning: string
}

/** 最小技术单元 */
export interface MinimumTechUnit {
  /** 单元标识 */
  id: string
  /** 单元名称 */
  name: string
  /** 单元描述 */
  description: string
  /** 原始文本片段 */
  sourceText: string
  /** 技术功能 */
  technicalFunction: string
  /** 技术效果 */
  technicalEffect: string
  /** 三要件验证 */
  criteria: TechUnitCriteria
  /** 子单元（如果通过"协同不可分"测试合并了多个子特征） */
  subFeatures?: string[]
  /** 在原始权利要求中的位置（字符偏移） */
  position?: { start: number; end: number }
  /** 置信度 (0-1) */
  confidence: number
}

/** "不可再分"测试结果 */
export interface IndivisibilityTestResult {
  /** 能否拆分 */
  canSplit: boolean
  /** 拆分后的子单元 */
  splitParts?: Array<{
    text: string
    hasIndependentFunction: boolean
    hasIndependentEffect: boolean
  }>
  /** 结论 */
  conclusion: 'pass' | 'should_split'
  /** 理由 */
  reasoning: string
}

/** "协同不可分"测试结果 */
export interface SynergyTestResult {
  /** 是否应合并 */
  shouldMerge: boolean
  /** 合并条件检查 */
  conditions: {
    /** 共同解决同一技术问题 */
    sameTechnicalProblem: boolean
    /** 产生协同技术效果 */
    synergisticEffect: boolean
    /** 相互依存、缺一不可 */
    mutuallyDependent: boolean
  }
  /** 结论 */
  conclusion: 'merge' | 'keep_separate'
  /** 理由 */
  reasoning: string
}

/** 特征划分粒度倾向 */
export type GranularityBias = 'patent_owner' | 'infringer' | 'neutral'

/** 输入定义 */
export interface TechUnitExtractInput {
  /** 权利要求文本 */
  claimText: string
  /** 技术方案类型（自动检测或手动指定） */
  schemeType?: TechnicalSchemeType
  /** 技术领域 */
  technicalField?: string
  /** 发明目的 / 技术问题 */
  technicalProblem?: string
  /** 技术效果 */
  technicalEffects?: string[]
  /** 说明书摘要（辅助理解） */
  specificationSummary?: string
  /** 识别场景 */
  scenario?: TechUnitScenario
  /** 划分粒度倾向 */
  granularityBias?: GranularityBias
}

/** 输出定义 */
export interface TechUnitExtractOutput {
  /** 技术方案类型 */
  schemeType: TechnicalSchemeType
  /** 检测方法 */
  detectionMethod: 'product_name_connection' | 'method_step_sequence'
  /** 提取的最小技术单元列表 */
  units: MinimumTechUnit[]
  /** 不可再分测试结果 */
  indivisibilityTests: IndivisibilityTestResult[]
  /** 协同不可分测试结果 */
  synergyTests: SynergyTestResult[]
  /** 自检结果 */
  selfCheckResults: Array<{
    rule: string
    passed: boolean
    detail: string
  }>
  /** 整体分析摘要 */
  summary: {
    /** 总单元数 */
    totalUnits: number
    /** 独立单元数 */
    independentUnits: number
    /** 合并单元数 */
    mergedUnits: number
    /** 平均置信度 */
    averageConfidence: number
    /** 分析质量评估 */
    qualityAssessment: 'high' | 'medium' | 'low'
  }
}

/** 分析计划 */
export interface TechUnitPlan {
  input: TechUnitExtractInput
  schemeType: TechnicalSchemeType
  stages: Array<
    'detect_type' | 'extract_features' | 'indivisibility_test' | 'synergy_test' | 'self_check'
  >
}
