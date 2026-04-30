import { z } from 'zod';

/**
 * 专利类型
 */
export enum PatentType {
  INVENTION = 'invention', // 发明专利
  UTILITY_MODEL = 'utility_model', // 实用新型
  DESIGN = 'design', // 外观设计
}

/**
 * 申请人类型
 */
export enum ApplicantType {
  ENTERPRISE = 'enterprise', // 企业
  INDIVIDUAL = 'individual', // 个人
  UNIVERSITY = 'university', // 高校
  INSTITUTE = 'institute', // 研究机构,
}

/**
 * 权利要求类型
 */
export enum ClaimType {
  INDEPENDENT = 'independent', // 独立权利要求
  DEPENDENT = 'dependent', // 从属权利要求
}

/**
 * 发明类型
 */
export enum InventionType {
  DEVICE = 'device', // 装置
  METHOD = 'method', // 方法
  SYSTEM = 'system', // 系统
  COMPOSITION = 'composition', // 组合物
}

/**
 * 审查意见类型
 */
export enum ObjectionType {
  NOVELTY = 'novelty', // 新颖性问题 A22.2
  INVENTIVE_STEP = 'inventive_step', // 创造性问题 A22.3
  CLARITY = 'clarity', // 权利要求不清楚 A26.4
  SUPPORT = 'support', // 得不到支持 A26.4
  FORMALITY = 'formality', // 形式问题
  UNITY = 'unity', // 缺乏单一性
}

/**
 * 专利记录
 */
export interface PatentRecord {
  id: string;
  patentName: string;
  patentType: PatentType;
  applicationNumber: string;
  applicationDate?: Date;
  publicationNumber?: string;
  applicant: string;
  applicantType: ApplicantType;
  inventor?: string;
  ipcCode?: string;
  abstractText?: string;
  claimsContent?: string;
  citationCount: number;
  citedCount: number;
  sourceYear?: number;
}

/**
 * 权利要求草稿
 */
export interface ClaimDraft {
  claimNumber: number;
  claimType: ClaimType;
  text: string;
  dependsOn?: number[]; // 从属权利要求依赖的权利要求编号
}

/**
 * 技术特征
 */
export interface TechnicalFeature {
  text: string;
  isEssential: boolean; // 是否为必要特征
  category?: string; // 特征分类（结构/方法/参数等）
}

/**
 * 独立权利要求生成参数
 */
export interface IndependentClaimParams {
  inventionType: InventionType;
  coreFeatures: TechnicalFeature[];
  preamble?: string; // 前序部分
  transitionWord?: string; // 过渡词（"其特征在于"、"包括"等）
}

/**
 * 审查意见
 */
export interface Objection {
  type: ObjectionType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  citedReferences?: string[];
}

/**
 * 审查意见通知书
 */
export interface OfficeAction {
  applicationNumber: string;
  filingDate: Date;
  officeActionDate: Date;
  examiner?: string;
  objections: Objection[];
  citedReferences: CitedReference[];
}

/**
 * 引用文献
 */
export interface CitedReference {
  documentNumber: string;
  relevance: 'high' | 'medium' | 'low';
  relevantPassages: string[];
}

/**
 * 质量评估结果
 */
export interface QualityAssessment {
  totalScore: number; // 总分（0-10）
  dimensions: {
    completeness: number; // 完整性
    clarity: number; // 清晰性
    accuracy: number; // 准确性
    sufficiency: number; // 充分性
    consistency: number; // 一致性
    compliance: number; // 规范性
    support: number; // 支持性
  };
  qualityLevel: 'high' | 'medium' | 'low';
  suggestions: string[];
}

/**
 * 答复策略
 */
export enum ResponseStrategy {
  ARGUE_NOVELTY = 'argue_novelty', // 争辩新颖性
  ARGUE_INVENTIVE_STEP = 'argue_inventive_step', // 争辩创造性
  AMEND_CLAIMS = 'amend_claims', // 修改权利要求
  COMBINE = 'combine', // 组合策略
}

/**
 * 答复方案
 */
export interface ResponsePlan {
  strategy: ResponseStrategy;
  amendments: string[]; // 修改建议
  arguments: string[]; // 答复理由
  estimatedSuccessRate: number; // 预估成功率
}

// Zod Schemas

/**
 * 技术特征 Schema
 */
export const TechnicalFeatureSchema = z.object({
  text: z.string().describe('技术特征描述'),
  isEssential: z.boolean().describe('是否为必要特征'),
  category: z.string().optional().describe('特征分类'),
});

/**
 * 独立权利要求生成参数 Schema
 */
export const IndependentClaimParamsSchema = z.object({
  inventionType: z.nativeEnum(InventionType).describe('发明类型'),
  coreFeatures: z.array(TechnicalFeatureSchema).describe('核心技术特征列表'),
  preamble: z.string().optional().describe('前序部分'),
  transitionWord: z.string().optional().describe('过渡词'),
});

/**
 * 权利要求草稿 Schema
 */
export const ClaimDraftSchema = z.object({
  claimNumber: z.number().describe('权利要求编号'),
  claimType: z.nativeEnum(ClaimType).describe('权利要求类型'),
  text: z.string().describe('权利要求文本'),
  dependsOn: z.array(z.number()).optional().describe('依赖的权利要求编号'),
});

/**
 * 审查意见 Schema
 */
export const ObjectionSchema = z.object({
  type: z.nativeEnum(ObjectionType).describe('审查意见类型'),
  description: z.string().describe('审查意见描述'),
  severity: z.enum(['high', 'medium', 'low']).describe('严重程度'),
  citedReferences: z.array(z.string()).optional().describe('引用文献'),
});

/**
 * 审查意见通知书 Schema
 */
export const OfficeActionSchema = z.object({
  applicationNumber: z.string().describe('申请号'),
  filingDate: z.date().describe('申请日'),
  officeActionDate: z.date().describe('审查意见日期'),
  examiner: z.string().optional().describe('审查员'),
  objections: z.array(ObjectionSchema).describe('审查意见列表'),
  citedReferences: z
    .array(
      z.object({
        documentNumber: z.string(),
        relevance: z.enum(['high', 'medium', 'low']),
        relevantPassages: z.array(z.string()),
      })
    )
    .describe('引用文献列表'),
});
