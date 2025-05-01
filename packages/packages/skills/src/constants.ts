/**
 * Skills 常量定义
 *
 * @package @yunpat/skills
 */

/**
 * 默认 Skill 配置
 */
export const DEFAULT_SKILL_CONFIG = {
  /** 默认模型 */
  model: 'claude-sonnet-4-6',

  /** 默认温度 */
  temperature: 0.3,

  /** 默认最大 Token 数 */
  maxTokens: 4000,

  /** 默认知识库最大返回数量 */
  maxKnowledgeItems: 5,

  /** 默认 Shell 超时（毫秒） */
  shellTimeout: 5000,

  /** 默认缓存时间（秒） */
  cacheTTL: 3600,
} as const

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = ['pdf', 'patent', 'markdown', 'md', 'txt', 'json'] as const

/**
 * 支持的 Shell 类型
 */
export const SUPPORTED_SHELL_TYPES = ['bash', 'node'] as const

/**
 * 支持的日志级别
 */
export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'] as const

/**
 Skills 目录名称
 */
export const SKILLS_DIR_NAME = '.yunpat/skills'

/**
 * Skill 文件名称
 */
export const SKILL_FILE_NAME = 'SKILL.md'
