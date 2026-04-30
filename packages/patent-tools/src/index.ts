/**
 * YunPat 专利工具集
 *
 * 提供专利检索、撰写、质量评估、审查答复等工具
 */

// 工具导出
export { ClaimsGeneratorTool, FeatureExtractorTool } from './tools/ClaimsGeneratorTool.js';

export { GooglePatentsFetchTool, GooglePatentDetailTool } from './tools/GooglePatentsTool.js';

export { PatentSearchTool, SimilarPatentSearchTool } from './tools/PatentSearchTool.js';

export { PatentDetailTool, HighCitationPatentsTool } from './tools/PatentDetailTool.js';

// 类型导出
export {
  PatentType,
  ApplicantType,
  ClaimType,
  InventionType,
  ObjectionType,
  PatentRecord,
  ClaimDraft,
  TechnicalFeature,
  IndependentClaimParams,
  Objection,
  OfficeAction,
  CitedReference,
  QualityAssessment,
  ResponseStrategy,
  ResponsePlan,
} from './types/patent.js';

// Zod Schema 导出
export {
  TechnicalFeatureSchema,
  IndependentClaimParamsSchema,
  ClaimDraftSchema,
  ObjectionSchema,
  OfficeActionSchema,
} from './types/patent.js';

// 模板导出
export {
  CLAIMS_TEMPLATES,
  DEFAULT_PREAMBLES,
  DEFAULT_TRANSITION_WORDS,
  buildIndependentClaimPrompt,
  buildDependentClaimPrompt,
  buildQualityAssessmentPrompt,
  buildOfficeActionParsePrompt,
  buildResponseStrategyPrompt,
} from './utils/template.js';
