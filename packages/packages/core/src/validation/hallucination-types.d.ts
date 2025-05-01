/**
 * 幻觉检测系统类型定义
 *
 * 用于检测和评估LLM生成内容中的幻觉、事实错误和逻辑不一致
 */
/**
 * 幻觉检测配置
 */
export interface HallucinationDetectorConfig {
  /** 是否启用事实验证 */
  enableFactCheck?: boolean
  /** 是否启用逻辑一致性检查 */
  enableLogicalConsistencyCheck?: boolean
  /** 是否启用源归属验证 */
  enableSourceAttribution?: boolean
  /** 事实验证阈值 */
  factCheckThreshold?: number
  /** 逻辑一致性阈值 */
  logicalConsistencyThreshold?: number
  /** 最大验证时间（毫秒） */
  maxValidationTime?: number
}
/**
 * 幻觉检测报告
 */
export interface HallucinationReport {
  /** 总体幻觉分数（0-1，越低越好） */
  overallScore: number
  /** 事实验证结果 */
  factCheckResults: FactCheckResult[]
  /** 逻辑不一致问题 */
  logicalInconsistencies: LogicalInconsistency[]
  /** 源归属问题 */
  sourceAttributionIssues: SourceAttributionIssue[]
  /** 改进建议 */
  suggestions: ImprovementSuggestion[]
  /** 检测耗时（毫秒） */
  duration: number
  /** 检测时间戳 */
  timestamp: Date
}
/**
 * 声明（Claim）
 */
export interface Claim {
  id: string
  content: string
  category: ClaimCategory
  confidence: number
  location?: TextLocation
}
/**
 * 声明类别
 */
export declare enum ClaimCategory {
  /** 法律判例 */
  LEGAL_PRECEDENT = 'legal_precedent',
  /** 技术事实 */
  TECHNICAL_FACT = 'technical_fact',
  /** 统计数据 */
  STATISTICAL_DATA = 'statistical_data',
  /** 领域知识 */
  DOMAIN_KNOWLEDGE = 'domain_knowledge',
  /** 一般陈述 */
  GENERAL_STATEMENT = 'general_statement',
}
/**
 * 事实验证结果
 */
export interface FactCheckResult {
  /** 声明 */
  claim: Claim
  /** 是否可验证 */
  isVerifiable: boolean
  /** 是否通过验证 */
  isVerified: boolean
  /** 置信度 */
  confidence: number
  /** 可信来源 */
  sources: SourceReference[]
  /** 验证方法 */
  verificationMethod: 'knowledge_base' | 'external_api' | 'manual'
  /** 验证详情 */
  details?: string
}
/**
 * 逻辑不一致
 */
export interface LogicalInconsistency {
  id: string
  type: LogicalInconsistencyType
  severity: 'critical' | 'major' | 'minor'
  description: string
  /** 不一致的位置 */
  locations: TextLocation[]
  /** 矛盾的陈述 */
  conflictingStatements: string[]
  /** 建议修正 */
  suggestedFix?: string
}
/**
 * 逻辑不一致类型
 */
export declare enum LogicalInconsistencyType {
  /** 矛盾 */
  CONTRADICTION = 'contradiction',
  /** 重复 */
  DUPLICATION = 'duplication',
  /** 逻辑断层 */
  LOGICAL_GAP = 'logical_gap',
  /** 因果倒置 */
  REVERSED_CAUSALITY = 'reversed_causality',
  /** 循环论证 */
  CIRCULAR_REASONING = 'circular_reasoning',
}
/**
 * 源归属问题
 */
export interface SourceAttributionIssue {
  id: string
  type: SourceAttributionIssueType
  severity: 'critical' | 'major' | 'minor'
  /** 缺少来源的内容 */
  content: string
  /** 内容位置 */
  location: TextLocation
  /** 建议的来源 */
  suggestedSources?: SourceReference[]
  /** 描述 */
  description: string
}
/**
 * 源归属问题类型
 */
export declare enum SourceAttributionIssueType {
  /** 缺少引用 */
  MISSING_CITATION = 'missing_citation',
  /** 引用格式错误 */
  INCORRECT_CITATION_FORMAT = 'incorrect_citation_format',
  /** 来源不可信 */
  UNRELIABLE_SOURCE = 'unreliable_source',
  /** 引用过时 */
  OUTDATED_SOURCE = 'outdated_source',
}
/**
 * 来源引用
 */
export interface SourceReference {
  id: string
  type: SourceType
  title: string
  author?: string
  year?: number
  url?: string
  credibility: number
  lastVerified?: Date
}
/**
 * 来源类型
 */
export declare enum SourceType {
  /** 法律文档 */
  LEGAL_DOCUMENT = 'legal_document',
  /** 学术论文 */
  ACADEMIC_PAPER = 'academic_paper',
  /** 技术标准 */
  TECHNICAL_STANDARD = 'technical_standard',
  /** 专利文档 */
  PATENT_DOCUMENT = 'patent_document',
  /** 知识库条目 */
  KNOWLEDGE_ENTRY = 'knowledge_entry',
  /** 外部API */
  EXTERNAL_API = 'external_api',
}
/**
 * 文本位置
 */
export interface TextLocation {
  start: number
  end: number
  line?: number
  column?: number
  text: string
}
/**
 * 改进建议
 */
export interface ImprovementSuggestion {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: 'factual' | 'logical' | 'attribution'
  description: string
  /** 建议的操作 */
  action: SuggestionAction
  /** 预期效果 */
  expectedImpact: string
}
/**
 * 建议操作
 */
export declare enum SuggestionAction {
  /** 添加引用 */
  ADD_CITATION = 'add_citation',
  /** 修正内容 */
  CORRECT_CONTENT = 'correct_content',
  /** 删除内容 */
  REMOVE_CONTENT = 'remove_content',
  /** 重新表述 */
  REPHRASE = 'rephrase',
  /** 人工审核 */
  MANUAL_REVIEW = 'manual_review',
}
/**
 * 事实验证器配置
 */
export interface FactCheckerConfig {
  /** 声明提取方法 */
  extractionMethod: 'regex' | 'llm' | 'hybrid'
  /** 验证方法 */
  verificationMethods: Array<'knowledge_base' | 'external_api'>
  /** 知识库搜索选项 */
  knowledgeBaseOptions?: {
    maxResults?: number
    similarityThreshold?: number
  }
  /** 外部API配置 */
  externalAPIConfig?: Record<string, unknown>
}
/**
 * 逻辑一致性检查器配置
 */
export interface LogicalConsistencyCheckerConfig {
  /** 是否检测矛盾 */
  detectContradictions?: boolean
  /** 是否检测重复 */
  detectDuplication?: boolean
  /** 是否检测逻辑断层 */
  detectLogicalGaps?: boolean
  /** 相似度阈值（用于检测重复） */
  similarityThreshold?: number
}
/**
 * 源归属验证器配置
 */
export interface SourceAttributionValidatorConfig {
  /** 必须引用的类别 */
  requiredCitationCategories?: ClaimCategory[]
  /** 允许的引用格式 */
  allowedCitationFormats?: string[]
  /** 最小来源可信度 */
  minSourceCredibility?: number
}
//# sourceMappingURL=hallucination-types.d.ts.map
