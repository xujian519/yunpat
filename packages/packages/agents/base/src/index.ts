/**
 * @yunpat/agent-base - 专业层Agent基类
 *
 * 提供统一的Agent架构，所有专业层Agent都应该继承此类
 */

export { ProfessionalAgent } from './ProfessionalAgent.js'
export { SkillsProfessionalAgent } from './SkillsProfessionalAgent.js'
export type {
  ProfessionalAgentConfig,
  ExtendedExecutionContext,
  LLMCallParams,
  LLMResponse,
} from './ProfessionalAgent.js'
export type { SkillsConfig, ExtendedProfessionalAgentConfig } from './SkillsProfessionalAgent.js'

export type {
  AgentId,
  BaseAgentInput,
  BaseAgentOutput,
  AgentResult,
  AgentError,
  RetryStrategy,
} from './types.js'
export {
  AgentErrorCode,
  RETRY_STRATEGY,
  inferErrorCode,
  agentErrorToError,
  errorToAgentError,
} from './types.js'
