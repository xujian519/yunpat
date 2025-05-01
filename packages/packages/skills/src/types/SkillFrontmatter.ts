/**
 * Skill Frontmatter 接口定义
 *
 * @package @yunpat/skills
 */

/**
 * Skill Frontmatter 接口
 *
 * 定义 SKILL.md 文件中的 frontmatter 字段
 */
export interface SkillFrontmatter {
  // ========== 基本信息 ==========

  /** 技能名称（可选，默认使用目录名） */
  name?: string

  /** 技能描述（必填，或与 name 二选一） */
  description?: string

  /** 技能版本（可选） */
  version?: string

  // ========== 可见性控制 ==========

  /** 用户是否可直接调用（默认 true） */
  'user-invocable'?: boolean

  /** 是否在列表中隐藏（默认 false） */
  hidden?: boolean

  // ========== 使用指导 ==========

  /** 使用时机（可选） */
  when_to_use?: string | string[]

  // ========== 工具限制 ==========

  /** 允许使用的工具列表（可选） */
  'allowed-tools'?: string[]

  // ========== 模型配置 ==========

  /** 指定使用的模型（可选） */
  model?: string

  /** 温度参数（可选） */
  temperature?: number

  /** 最大 Token 数（可选） */
  'max-tokens'?: number

  // ========== 条件激活 ==========

  /** 文件路径模式（可选） */
  paths?: string[]

  /** 文件类型（可选） */
  'file-types'?: string[]

  // ========== 知识库增强 ==========

  /** 知识库配置（可选） */
  knowledge?: KnowledgeConfig

  // ========== 参数定义 ==========

  /** 参数名列表（可选） */
  arguments?: string[]

  /** 参数提示（可选） */
  'argument-hint'?: string

  // ========== 执行上下文 ==========

  /** 执行模式（可选） */
  context?: 'inline' | 'fork'

  /** 指定执行的 Agent（可选） */
  agent?: string

  // ========== 努力程度 ==========

  /** 努力程度（可选） */
  effort?: 'low' | 'medium' | 'high' | number

  // ========== Hooks ==========

  /** 生命周期钩子（可选） */
  hooks?: SkillHooks

  // ========== Shell 执行 ==========

  /** Shell 类型（可选） */
  shell?: 'bash' | 'node'

  /** Shell 超时（毫秒，可选） */
  'shell-timeout'?: number

  /** 允许的命令列表（可选） */
  'allowed-commands'?: string[]

  // ========== 其他 ==========

  /** 标签（可选） */
  tags?: string[]

  /** 是否弃用（可选） */
  deprecated?: boolean

  /** 替代技能（可选） */
  'deprecated-by'?: string

  /** 迁移指南（可选） */
  'migration-guide'?: string

  // ========== 调试 ==========

  /** 调试模式（可选） */
  debug?: boolean

  /** 日志级别（可选） */
  'log-level'?: 'silent' | 'error' | 'warn' | 'info' | 'debug'
}

/**
 * 知识库配置
 */
export interface KnowledgeConfig {
  /** 相关概念列表 */
  concepts?: string[]

  /** Wiki 页面列表 */
  wiki_pages?: string[]

  /** 知识卡片列表（支持通配符） */
  cards?: string[]

  /** 最多返回数量（默认 5） */
  max_items?: number

  /** 缓存时间（秒，可选） */
  cache_ttl?: number

  /** 是否预加载（可选） */
  preload?: boolean
}

/**
 * Skill Hooks
 */
export interface SkillHooks {
  /** 执行前钩子 */
  before?: SkillHook[]

  /** 执行后钩子 */
  after?: SkillHook[]
}

/**
 * Skill Hook
 */
export interface SkillHook {
  /** Hook 类型 */
  type: 'log' | 'command' | 'validate' | 'save' | 'notify'

  /** 日志级别（log 类型） */
  level?: string

  /** 日志消息（log/notify 类型） */
  message?: string

  /** 命令（command 类型） */
  command?: string

  /** 保存变量名（command 类型） */
  save_as?: string

  /** 验证类型（validate 类型） */
  check?: string

  /** 验证参数（validate 类型） */
  param?: string

  /** 保存目录（save 类型） */
  dir?: string

  /** 保存格式（save 类型） */
  format?: string
}
