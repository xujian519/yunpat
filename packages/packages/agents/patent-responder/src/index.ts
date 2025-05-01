/**
 * 专利答复智能体入口
 *
 * @package @yunpat/agent-patent-responder
 */

// 导出所有类型定义
export * from './types/index.js'

// 导出 v4.0 增强版（默认）
export { PatentResponderAgent } from './PatentResponderAgent.v4.js'
export type { PatentResponderConfig, ResponsePlan } from './PatentResponderAgent.v4.js'

// 导出 V5 版本（集成真实数据库）
export { PatentResponderAgentV5 } from './PatentResponderAgentV5.js'
export type {
  PatentResponderInputV2,
  PatentResponderOutputV2,
  PrecedentCase,
} from './PatentResponderAgentV5.js'

// 导出所有子模块
export * from './parsing/index.js'
export * from './strategy/index.js'
export * from './template/index.js'
export * from './prediction/index.js'
export * from './learning/index.js'

// 保留旧版本导出（向后兼容）
export { PatentResponderAgent as PatentResponderAgentV3 } from './PatentResponderAgent.v3.js'
