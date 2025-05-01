/**
 * Skills 包入口
 *
 * @package @yunpat/skills
 */

// ========== 类型导出 ==========
export type { Skill, SkillPrompt } from './types/Skill.js'
export { SkillSource } from './types/Skill.js'

export type {
  SkillFrontmatter,
  KnowledgeConfig,
  SkillHooks,
  SkillHook,
} from './types/SkillFrontmatter.js'

export type { SkillContext, ConceptEntry, WikiPageEntry, CardEntry } from './types/SkillContext.js'

export type {
  ToolDefinition,
  ToolRegistry,
  AgentConfig,
  UserPreferences,
  UserInfo,
  SkillArgumentValue,
  SkillArguments,
} from './types/CommonTypes.js'

// ========== 加载器导出 ==========
export { parseFrontmatter, validateFrontmatter } from './loader/FrontmatterParser.js'
export { loadSkillsFromDir, loadSkills, createSkill } from './loader/SkillLoader.js'
export { deduplicateSkills, mergeSkills } from './loader/SkillDeduplicator.js'

// ========== 渲染器导出 ==========
export {
  replaceVariables,
  getTemplateVariables,
  validateRequiredVariables,
} from './renderer/VariableReplacer.js'
export { renderSkillPrompt } from './renderer/SkillRenderer.js'
export {
  validateAndSanitizePath,
  validateShellCommand,
  createShellCommandHandler,
  type PathValidationConfig,
} from './renderer/ShellValidator.js'

// ========== 条件激活导出 ==========
export {
  PathMatcher,
  createPathMatcher,
  defaultPathMatcher,
  matchPath,
  matchAnyPath,
  ConditionalActivator,
  createConditionalActivator,
  defaultActivator,
  ActivationStrategy,
  type PathMatcherConfig,
  type ActivationCondition,
  type ActivationResult,
  type ActivationConfig,
} from './activation/index.js'

// ========== 知识库导出 ==========
export {
  ObsidianBridge,
  KnowledgeRetriever,
  KnowledgeEntryType,
  type KnowledgeConfig as ObsidianKnowledgeConfig,
  type KnowledgeEntry,
  type KnowledgeQuery,
  type KnowledgeResult,
  type IndexStats,
  type WikiLink,
  type Tag,
} from './knowledge/index.js'

// ========== 常量导出 ==========
export { DEFAULT_SKILL_CONFIG } from './constants.js'
