/**
 * 幻觉检测系统类型定义
 *
 * 用于检测和评估LLM生成内容中的幻觉、事实错误和逻辑不一致
 */
/**
 * 声明类别
 */
export var ClaimCategory
;(function (ClaimCategory) {
  /** 法律判例 */
  ClaimCategory['LEGAL_PRECEDENT'] = 'legal_precedent'
  /** 技术事实 */
  ClaimCategory['TECHNICAL_FACT'] = 'technical_fact'
  /** 统计数据 */
  ClaimCategory['STATISTICAL_DATA'] = 'statistical_data'
  /** 领域知识 */
  ClaimCategory['DOMAIN_KNOWLEDGE'] = 'domain_knowledge'
  /** 一般陈述 */
  ClaimCategory['GENERAL_STATEMENT'] = 'general_statement'
})(ClaimCategory || (ClaimCategory = {}))
/**
 * 逻辑不一致类型
 */
export var LogicalInconsistencyType
;(function (LogicalInconsistencyType) {
  /** 矛盾 */
  LogicalInconsistencyType['CONTRADICTION'] = 'contradiction'
  /** 重复 */
  LogicalInconsistencyType['DUPLICATION'] = 'duplication'
  /** 逻辑断层 */
  LogicalInconsistencyType['LOGICAL_GAP'] = 'logical_gap'
  /** 因果倒置 */
  LogicalInconsistencyType['REVERSED_CAUSALITY'] = 'reversed_causality'
  /** 循环论证 */
  LogicalInconsistencyType['CIRCULAR_REASONING'] = 'circular_reasoning'
})(LogicalInconsistencyType || (LogicalInconsistencyType = {}))
/**
 * 源归属问题类型
 */
export var SourceAttributionIssueType
;(function (SourceAttributionIssueType) {
  /** 缺少引用 */
  SourceAttributionIssueType['MISSING_CITATION'] = 'missing_citation'
  /** 引用格式错误 */
  SourceAttributionIssueType['INCORRECT_CITATION_FORMAT'] = 'incorrect_citation_format'
  /** 来源不可信 */
  SourceAttributionIssueType['UNRELIABLE_SOURCE'] = 'unreliable_source'
  /** 引用过时 */
  SourceAttributionIssueType['OUTDATED_SOURCE'] = 'outdated_source'
})(SourceAttributionIssueType || (SourceAttributionIssueType = {}))
/**
 * 来源类型
 */
export var SourceType
;(function (SourceType) {
  /** 法律文档 */
  SourceType['LEGAL_DOCUMENT'] = 'legal_document'
  /** 学术论文 */
  SourceType['ACADEMIC_PAPER'] = 'academic_paper'
  /** 技术标准 */
  SourceType['TECHNICAL_STANDARD'] = 'technical_standard'
  /** 专利文档 */
  SourceType['PATENT_DOCUMENT'] = 'patent_document'
  /** 知识库条目 */
  SourceType['KNOWLEDGE_ENTRY'] = 'knowledge_entry'
  /** 外部API */
  SourceType['EXTERNAL_API'] = 'external_api'
})(SourceType || (SourceType = {}))
/**
 * 建议操作
 */
export var SuggestionAction
;(function (SuggestionAction) {
  /** 添加引用 */
  SuggestionAction['ADD_CITATION'] = 'add_citation'
  /** 修正内容 */
  SuggestionAction['CORRECT_CONTENT'] = 'correct_content'
  /** 删除内容 */
  SuggestionAction['REMOVE_CONTENT'] = 'remove_content'
  /** 重新表述 */
  SuggestionAction['REPHRASE'] = 'rephrase'
  /** 人工审核 */
  SuggestionAction['MANUAL_REVIEW'] = 'manual_review'
})(SuggestionAction || (SuggestionAction = {}))
//# sourceMappingURL=hallucination-types.js.map
