/**
 * Prompt 工程模块
 *
 * 导出 Phase 0 重构的核心组件：
 * - SystemPrompt 品牌类型与工具函数
 * - PersonaLibrary 角色库
 * - SectionRegistry 提示词片段注册表
 * - PromptAssemblyPipeline 组装管道
 * - AgentDefinition 定义解析器
 */

// System Prompt 品牌类型
export {
  type SystemPrompt,
  asSystemPrompt,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  hasDynamicBoundary,
  splitByDynamicBoundary,
  removeBoundary,
} from './system-prompt.js'

// 角色库
export {
  type Persona,
  PERSONA_LIBRARY,
  PERSONA_REF_REGEX,
  renderPersonaRefs,
  getPersona,
  listPersonaIds,
} from './persona-library.js'

// Section 注册表
export {
  type PromptSection,
  sectionRegistry,
  registerSection,
  registerDynamicSection,
  registerDefaultPromptSections,
} from './section-registry.js'

// 组装管道
export {
  type PromptConfig,
  PromptAssemblyPipeline,
  promptPipeline,
} from './prompt-assembly-pipeline.js'

// Agent 定义解析
export {
  type AgentDefinition,
  parseAgentDefinition,
  parseAgentDefinitionContent,
  AgentDefinitionLoader,
  agentDefinitionLoader,
} from './agent-definition.js'
