/**
 * 预测模块类型定义与默认权重
 *
 * @module prediction/predictionTypes
 */

import { RejectionType, Severity, ResponseStrategy } from '../types/index.js'

/**
 * 预测特征
 */
export interface PredictionFeatures {
  /** 驳回类型特征 */
  rejectionTypes: Set<RejectionType>
  /** 严重程度特征 */
  severity: Severity
  /** 涉及权利要求数量 */
  claimCount: number
  /** 引用文献数量 */
  referenceCount: number
  /** 答复策略 */
  strategy: ResponseStrategy
  /** 审查轮次 */
  round: number
  /** 技术领域 */
  technicalField?: string
}

/**
 * 特征权重
 */
export interface FeatureWeights {
  rejectionTypeWeights: Map<RejectionType, number>
  severityWeights: Map<Severity, number>
  claimCountWeight: number
  referenceCountWeight: number
  strategyWeights: Map<ResponseStrategy, number>
  roundWeight: number
}

/**
 * 预测器配置
 */
export interface SuccessPredictorConfig {
  /** 是否启用机器学习 */
  enableML?: boolean
  /** 最小样本数量 */
  minSamples?: number
  /** 置信水平 (0-1) */
  confidenceLevel?: number
  /** 自定义权重 */
  customWeights?: Partial<FeatureWeights>
}

/** 默认特征权重 */
export const DEFAULT_WEIGHTS: FeatureWeights = {
  rejectionTypeWeights: new Map([
    [RejectionType.NOVELTY, 0.25],
    [RejectionType.INVENTIVENESS, 0.3],
    [RejectionType.UTILITY, 0.15],
    [RejectionType.SUPPORT, 0.2],
    [RejectionType.CLARITY, 0.25],
    [RejectionType.SCOPE, 0.22],
    [RejectionType.AMENDMENT_SCOPE, 0.18],
    [RejectionType.UNITY, 0.2],
    [RejectionType.FORMALITY, 0.4],
    [RejectionType.OTHER, 0.2],
  ]),
  severityWeights: new Map([
    [Severity.HIGH, -0.25],
    [Severity.MEDIUM, 0],
    [Severity.LOW, 0.15],
  ]),
  claimCountWeight: -0.03,
  referenceCountWeight: -0.05,
  strategyWeights: new Map([
    [ResponseStrategy.ARGUE, 0.55],
    [ResponseStrategy.AMEND, 0.6],
    [ResponseStrategy.BOTH, 0.65],
    [ResponseStrategy.ABANDON, 0.1],
    [ResponseStrategy.APPEAL, 0.35],
  ]),
  roundWeight: -0.08,
}
