/**
 * 专利答复核心类型定义
 *
 * 统一的类型定义，供所有模块使用
 */

/**
 * 驳回理由类型
 */
export enum RejectionType {
  /** 新颖性 */
  NOVELTY = 'novelty',
  /** 创造性 */
  INVENTIVENESS = 'inventiveness',
  /** 实用性 */
  UTILITY = 'utility',
  /** 充分公开 */
  SUPPORT = 'support',
  /** 清晰度 */
  CLARITY = 'clarity',
  /** 保护范围 */
  SCOPE = 'scope',
  /** 修改超范围 */
  AMENDMENT_SCOPE = 'amendment_scope',
  /** 单一性 */
  UNITY = 'unity',
  /** 形式缺陷 */
  FORMALITY = 'formality',
  /** 其他 */
  OTHER = 'other',
}

/**
 * 严重程度
 */
export enum Severity {
  /** 高 - 需要立即处理 */
  HIGH = 'high',
  /** 中 - 需要处理 */
  MEDIUM = 'medium',
  /** 低 - 可选处理 */
  LOW = 'low',
}

/**
 * 引用文献
 */
export interface CitedReference {
  /** 公开号 */
  publicationNumber: string
  /** 标题 */
  title: string
  /** 相关性描述 */
  relevance: string
  /** 相关性等级 (1-5) */
  relevanceLevel?: number
  /** 引用类型 (D1/D2/D3/ PX/PY等) */
  referenceType?: string
  /** 引用的权利要求 */
  citedClaims?: number[]
  /** 公开日期 */
  publicationDate?: string
  /** 申请人/发明人 */
  applicant?: string
}

/**
 * 驳回理由
 */
export interface RejectionReason {
  /** 驳回理由类型 */
  type: RejectionType
  /** 问题描述 */
  description: string
  /** 严重程度 */
  severity: Severity
  /** 涉及的权利要求 */
  affectedClaims: number[]
  /** 相关对比文件 */
  relatedReferences?: string[]
  /** 可克服性评估 (0-100) */
  overcomeProbability?: number
  /** 建议的应对方式 */
  suggestedResponse?: 'argue' | 'amend' | 'both' | 'abandon'
}

/**
 * 答复策略
 */
export enum ResponseStrategy {
  /** 争辩 - 不修改权利要求，通过论点反驳 */
  ARGUE = 'argue',
  /** 修改 - 通过修改权利要求克服驳回 */
  AMEND = 'amend',
  /** 混合 - 同时进行争辩和修改 */
  BOTH = 'both',
  /** 放弃 - 建议撤回申请 */
  ABANDON = 'abandon',
  /** 复审 - 建议提起复审 */
  APPEAL = 'appeal',
}

/**
 * 修改建议
 */
export interface AmendmentSuggestion {
  /** 权利要求编号 */
  claimNumber: number
  /** 当前文本 */
  currentText: string
  /** 建议文本 */
  proposedText: string
  /** 修改理由 */
  reason: string
  /** 修改类型 (添加/删除/修改) */
  amendmentType: 'add' | 'delete' | 'modify'
  /** 预期效果 */
  expectedEffect?: string
  /** 是否有新增事项 */
  addsNewMatter?: boolean
}

/**
 * 答复论点
 */
export interface ResponseArgument {
  /** 论点分类 */
  category: string
  /** 论点内容 */
  argument: string
  /** 支持证据 */
  evidence: string[]
  /** 目标驳回理由 */
  targetRejection: RejectionType
  /** 论点强度 (1-5) */
  strength?: number
  /** 成功案例参考 */
  precedents?: string[]
}

/**
 * 成功概率预测结果
 */
export interface SuccessPrediction {
  /** 整体成功概率 (0-100) */
  overallProbability: number
  /** 各项驳回理由的克服概率 */
  rejectionProbabilities: Map<RejectionType, number>
  /** 置信区间 */
  confidenceInterval: {
    lower: number
    upper: number
  }
  /** 关键成功因素 */
  keySuccessFactors: string[]
  /** 风险因素 */
  riskFactors: string[]
  /** 基于的案例数量 */
  basedOnCases: number
}

/**
 * 历史案例
 */
export interface HistoricalCase {
  /** 案例ID */
  id: string
  /** 申请号 */
  applicationNumber: string
  /** 专利名称 */
  patentTitle: string
  /** 审查意见摘要 */
  officeActionSummary: string
  /** 驳回理由列表 */
  rejectionReasons: RejectionReason[]
  /** 使用的答复策略 */
  strategy: ResponseStrategy
  /** 答复论点 */
  arguments: ResponseArgument[]
  /** 修改内容 */
  amendments: AmendmentSuggestion[]
  /** 最终结果 */
  outcome: 'success' | 'partial_success' | 'failure'
  /** 最终授权的权利要求 */
  grantedClaims?: number[]
  /** 审查轮次 */
  round: number
  /** 相似度标签 (用于检索) */
  tags: string[]
  /** 案例日期 */
  date: Date
  /** 审查员 */
  examiner?: string
  /** 技术领域 */
  technicalField?: string
  /** IPC分类号 */
  ipcClassifications?: string[]
}

/**
 * OA 解析结果
 */
export interface OAParseResult {
  /** 申请号 */
  applicationNumber: string
  /** 专利名称 */
  patentTitle: string
  /** 审查员 */
  examiner?: string
  /** 审查通知日期 */
  notificationDate?: Date
  /** 答复期限 */
  deadline?: Date
  /** 原始审查意见内容 */
  rawContent: string
  /** 提取的驳回理由 */
  rejectionReasons: RejectionReason[]
  /** 引用的对比文件 */
  citedReferences: CitedReference[]
  /** 审查意见类型 */
  rejectionTypes: RejectionType[]
  /** 涉及的权利要求 */
  affectedClaims: number[]
  /** 审查意见摘要 */
  summary: string
  /** 置信度 (0-1) */
  confidence: number
  /** 解析器版本 */
  parserVersion: string
}

/**
 * 策略推荐结果
 */
export interface StrategyRecommendation {
  /** 推荐的策略 */
  strategy: ResponseStrategy
  /** 成功概率 */
  successProbability: number
  /** 推荐理由 */
  rationale: string
  /** 关键论点 */
  keyArguments: ResponseArgument[]
  /** 修改建议 */
  amendmentSuggestions: AmendmentSuggestion[]
  /** 需要补充的证据 */
  additionalEvidence: string[]
  /** 风险提示 */
  risks: string[]
  /** 替代策略 */
  alternativeStrategies: Array<{
    strategy: ResponseStrategy
    probability: number
    rationale: string
  }>
  /** 基于的案例 */
  basedOnCases: string[]
}

/**
 * 答复文档模板
 */
export interface ResponseTemplate {
  /** 模板ID */
  id: string
  /** 模板名称 */
  name: string
  /** 适用的驳回理由类型 */
  applicableRejections: RejectionType[]
  /** 适用的策略类型 */
  applicableStrategies: ResponseStrategy[]
  /** 模板内容 */
  content: {
    /** 开头语 */
    opening?: string
    /** 论点模板 */
    argumentTemplates: Array<{
      category: string
      template: string
      placeholders: string[]
    }>
    /** 结束语 */
    closing?: string
  }
  /** 标签 */
  tags: string[]
  /** 使用次数 */
  usageCount: number
  /** 成功率 */
  successRate: number
}

/**
 * 学习配置
 */
export interface LearningConfig {
  /** 是否启用学习 */
  enabled: boolean
  /** 案例数据库路径 */
  caseDatabasePath?: string
  /** 最小相似度阈值 */
  minSimilarityThreshold: number
  /** 最大参考案例数量 */
  maxReferenceCases: number
  /** 学习模式 (similarity/strategy/ml) */
  mode: 'similarity' | 'strategy' | 'ml'
}
