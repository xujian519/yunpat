/**
 * 验证模块 - 结果验证和自动纠正
 */

export {
  ResultValidator,
  ValidationResult,
  ValidationErrorType,
  QualityRequirements,
  QualityReport,
  Inconsistency,
  CorrectionStrategy,
  ResultValidatorConfig,
} from './ResultValidator.js';

// 幻觉检测系统 - 类型定义
export {
  HallucinationDetectorConfig,
  HallucinationReport,
  Claim,
  ClaimCategory,
  FactCheckResult,
  LogicalInconsistency,
  LogicalInconsistencyType,
  SourceAttributionIssue,
  SourceAttributionIssueType,
  SourceReference,
  SourceType,
  TextLocation,
  ImprovementSuggestion,
  SuggestionAction,
  FactCheckerConfig,
  LogicalConsistencyCheckerConfig,
  SourceAttributionValidatorConfig,
} from './hallucination-types.js';

// 幻觉检测系统 - 检测器类
export { FactChecker } from './FactChecker.js';

export { LogicalConsistencyChecker } from './LogicalConsistencyChecker.js';

export { SourceAttributionValidator } from './SourceAttributionValidator.js';

export { HallucinationDetector } from './HallucinationDetector.js';
