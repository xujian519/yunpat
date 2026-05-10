/**
 * 质量检查输入
 */
export interface QualityCheckInput {
  /** 权利要求书 */
  claims: Array<{
    type: 'independent' | 'dependent'
    number: number
    content: string
    dependsOn?: number
  }>
  /** 说明书 */
  specification: {
    technicalField?: string
    backgroundArt?: string
    inventionContent?: string
    embodiment?: string
  }
  /** 专利类型 */
  patentType: 'invention' | 'utilityModel' | 'design'
  /** 发明名称 */
  inventionTitle: string
  /** 附图（可选） */
  drawings?: Array<{
    figureNumber: string
    description: string
  }>
  /** 检查级别（1-3，默认2） */
  checkLevel?: 1 | 2 | 3
  /** 是否启用自动修复建议 */
  enableAutoFix?: boolean
}

/**
 * 权利要求质量评分
 */
export interface ClaimsQuality {
  clarity: number
  support: number
  breadth: number
  protectionScope: number
  overall: number
}

/**
 * 说明书质量评分
 */
export interface SpecificationQuality {
  clarity: number
  sufficiency: number
  consistency: number
  supportiveness: number
  overall: number
}

/**
 * 语言质量评分
 */
export interface LanguageQuality {
  grammar: number
  terminology: number
  accuracy: number
  overall: number
}

/**
 * 法律质量评分
 */
export interface LegalQuality {
  formality: number
  patentability: number
  riskLevel: 'low' | 'medium' | 'high'
  overall: number
}

/**
 * 质量评分
 */
export interface QualityScores {
  claims: ClaimsQuality
  specification: SpecificationQuality
  language: LanguageQuality
  legal: LegalQuality
}

/**
 * 问题
 */
export interface Issue {
  category: string
  subCategory?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  location?: string
  ruleReference?: string
  suggestion: string
  autoFix?: {
    original: string
    fixed: string
    confidence: number
  }
}

/**
 * 改进建议
 */
export interface Recommendation {
  area: string
  priority: 'high' | 'medium' | 'low'
  current: string
  suggested: string
  rationale: string
  expectedImpact?: string
}

/**
 * 修复操作
 */
export interface FixOperation {
  type: 'replace' | 'insert' | 'delete' | 'reorder'
  target: string
  original: string
  fixed: string
  description: string
}

/**
 * 对比数据
 */
export interface Comparison {
  averageQuality: number
  percentile: number
  ranking: string
  comparisonGroup: string
}

/**
 * 质量检查结果
 */
export interface QualityCheckResult {
  completenessScore: number
  qualityScores: QualityScores
  overallQuality: number
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor'
  issues: Issue[]
  recommendations: Recommendation[]
  fixOperations?: FixOperation[]
  comparison: Comparison
  metadata: {
    checkLevel: number
    timestamp: number
    rulesApplied: string[]
    autoFixEnabled: boolean
  }
}

/**
 * 质量检查规则
 */
export interface QualityRule {
  id: string
  name: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  check: (input: QualityCheckInput) => Issue | null
  fix?: (issue: Issue) => FixOperation | null
}

/**
 * 质量检查计划
 */
export interface QualityCheckPlan {
  input: QualityCheckInput
  rules: QualityRule[]
}
