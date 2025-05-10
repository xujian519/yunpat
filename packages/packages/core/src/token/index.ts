/**
 * Token 预算与估算模块
 *
 * 导出 Phase 1 核心组件：
 * - TokenBudgetManager：上下文窗口动态计算与预算管理
 * - TokenEstimator：文本/图片 token 数估算
 */

export {
  type TokenBudgetConfig,
  type TokenBudget,
  type PatentTokenBudget,
  TokenBudgetManager,
  defaultTokenBudgetManager,
} from './token-budget.js'

export {
  type ContentType,
  type EstimateOptions,
  type ImageEstimateParams,
  estimateTextTokens,
  estimateMessagesTokens,
  estimateImageTokens,
  estimateBase64ImageTokens,
  TokenEstimator,
  tokenEstimator,
} from './token-estimator.js'
