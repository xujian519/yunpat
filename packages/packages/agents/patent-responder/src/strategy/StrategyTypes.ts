import { ResponseStrategy, type RejectionType } from '../types/index.js'

/**
 * 策略推荐器配置
 */
export interface StrategyRecommenderConfig {
  defaultPreference?: 'aggressive' | 'moderate' | 'conservative'
  enableCaseBasedLearning?: boolean
  minCaseSimilarity?: number
  maxReferenceCases?: number
  riskTolerance?: number
}

/**
 * 策略评分结果
 */
export interface StrategyScore {
  strategy: ResponseStrategy
  score: number
  details: {
    baseScore: number
    rejectionMatch: number
    historicalSuccess: number
    riskAdjustment: number
    userPreference: number
  }
}

/** 策略评分权重 */
export const WEIGHTS = {
  baseScore: 0.3,
  rejectionMatch: 0.25,
  historicalSuccess: 0.2,
  riskAdjustment: 0.15,
  userPreference: 0.1,
}

/** 驳回类型与最佳策略的映射 */
export const REJECTION_STRATEGY_MAP: Record<RejectionType, ResponseStrategy[]> = {
  novelty: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
  inventiveness: [ResponseStrategy.ARGUE, ResponseStrategy.AMEND, ResponseStrategy.BOTH],
  utility: [ResponseStrategy.AMEND, ResponseStrategy.ABANDON],
  support: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE],
  clarity: [ResponseStrategy.AMEND],
  scope: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE],
  amendment_scope: [ResponseStrategy.AMEND, ResponseStrategy.ABANDON],
  unity: [ResponseStrategy.AMEND, ResponseStrategy.ARGUE],
  formality: [ResponseStrategy.AMEND],
  other: [ResponseStrategy.ARGUE, ResponseStrategy.AMEND],
}
