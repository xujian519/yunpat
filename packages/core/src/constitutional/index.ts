/**
 * Constitutional AI 模块
 *
 * 导出所有Constitutional AI相关的类型、类和常量
 */

// 类型定义
export type {
  LLMAdapter,
  PrincipleCheckFunction,
  ConstitutionalPrinciple,
  ComplianceResult,
  Violation,
  Warning,
  ComplianceReport,
  CorrectionResult,
  AppliedCorrection,
  ConstitutionalAIConfig,
  ConflictResolution,
} from './types.js';

// 枚举（既是类型又是值）
export { PrincipleCategory, ViolationSeverity, CorrectionStrategy } from './types.js';

// 原则集
export { PATENT_PRINCIPLES } from './PatentPrinciples.js';

// 主类
export { ConstitutionalAI } from './ConstitutionalAI.js';
export { ComplianceChecker } from './ComplianceChecker.js';
export { AutoCorrector } from './AutoCorrector.js';
