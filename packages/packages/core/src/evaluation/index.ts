/**
 * 评估模块导出
 *
 * 提供创新性评估功能：
 * - ACUDecomposer：文档分解为原子内容单元 (ACU)
 * - NovAScoreEvaluator：基于 ACU 的文档级创新性评估
 * - RNDEvaluator：相对邻居密度创新性评估器
 * - MARGSimilarity：多维度推理图专利相似度评估器
 * - SAOExtractor：主谓宾三元组提取器（SAO2Vec）
 * - SAO2VecEncoder：SAO 三元组向量化编码器
 */

export { ACUDecomposer } from './ACUDecomposer.js'
export type { ACU, ACUDecomposerConfig } from './ACUDecomposer.js'

export { NovAScoreEvaluator } from './NovAScoreEvaluator.js'
export type { NovAScoreResult, NovAScoreConfig } from './NovAScoreEvaluator.js'

export { RNDEvaluator, createRNDEvaluator } from './RNDEvaluator.js'
export type { RNDResult, RNDOptions, NeighborInfo } from './RNDEvaluator.js'

export { MARGSimilarity } from './MARGSimilarity.js'
export type {
  PatentInfo,
  DimensionScore,
  MARGResult,
  ClaimScopeAnalysis,
  WeightConfig,
  LLMClient,
} from './MARGSimilarity.js'

export { SAOExtractor } from './SAOExtractor.js'
export type { SAOTriplet } from './SAOExtractor.js'

export { SAO2VecEncoder } from './SAO2VecEncoder.js'
export type { SAOEmbedding } from './SAO2VecEncoder.js'

export { DualQualityEvaluator } from './DualQualityEvaluator.js'
export type { DualEvaluationResult, DualEvaluatorConfig } from './DualQualityEvaluator.js'

export {
  EvaluationTuningConfig,
  DEFAULT_EVALUATION_CONFIG,
  createEvaluationConfig,
  readEvaluationConfigFromEnv,
  createEvaluationConfigWithEnv,
} from './EvaluationTuningConfig.js'
