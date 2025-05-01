/**
 * 条件激活模块入口
 *
 * @package @yunpat/skills
 */

// 路径匹配器
export {
  PathMatcher,
  createPathMatcher,
  defaultPathMatcher,
  matchPath,
  matchAnyPath,
  type PathMatcherConfig,
} from './PathMatcher.js'

// 条件激活器
export {
  ConditionalActivator,
  createConditionalActivator,
  defaultActivator,
} from './ConditionalActivator.js'

// 类型定义
export {
  type ActivationCondition,
  type ActivationResult,
  type ActivationConfig,
  ActivationStrategy,
} from './types.js'
