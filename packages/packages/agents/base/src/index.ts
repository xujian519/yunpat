/**
 * @yunpat/agent-base - 专业层Agent基类
 *
 * 提供统一的Agent架构，所有专业层Agent都应该继承此类
 */

export { ProfessionalAgent } from './ProfessionalAgent.js'
export { SkillsProfessionalAgent } from './SkillsProfessionalAgent.js'
export type {
  ProfessionalAgentConfig,
  AgentResult,
  ExtendedExecutionContext,
  LLMCallParams,
  LLMResponse,
} from './ProfessionalAgent.js'
export type { SkillsConfig, ExtendedProfessionalAgentConfig } from './SkillsProfessionalAgent.js'
