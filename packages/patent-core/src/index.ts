export {
  setCliPath,
  extractFeatures,
  parseDisclosure,
  generateClaims,
  parseOa,
  recommendStrategy,
  reviseClaims,
  assessQuality,
  classifyIpc,
  type TechnicalFeature,
  type ProblemFeatureEffect,
  type DisclosureDoc,
  type ClaimDraft,
  type OfficeAction,
  type CitedReference,
  type ResponseStrategy,
  type QualityAssessment,
  type QualityIssue,
  type IpcClassification,
} from './PatentCoreBridge.js';

export {
  extractFeaturesFallback,
  parseDisclosureFallback,
  generateClaimsFallback,
  isFallbackResult,
} from './PatentCoreFallback.js';