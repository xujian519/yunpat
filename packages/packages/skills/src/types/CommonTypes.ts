/**
 * 通用类型定义
 *
 * 定义 Skills 系统中使用的通用类型
 *
 * @package @yunpat/skills
 */

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string

  /** 工具描述 */
  description: string

  /** 参数模式（JSON Schema 格式） */
  parameters?: Record<string, unknown>

  /** 工具处理器 */
  handler?: (...args: unknown[]) => Promise<unknown>
}

/**
 * 工具注册表
 */
export interface ToolRegistry {
  [name: string]: ToolDefinition
}

/**
 * Agent 配置接口
 */
export interface AgentConfig {
  /** Agent 名称 */
  name: string

  /** Agent 描述 */
  description?: string

  /** LLM 适配器 */
  llm: unknown

  /** 事件总线 */
  eventBus: Record<string, unknown>

  /** 记忆存储 */
  memory: Record<string, unknown>

  /** 工具注册表 */
  tools: ToolRegistry

  /** 最大迭代次数 */
  maxIterations?: number

  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  /** 主题 */
  theme?: 'light' | 'dark' | 'auto'

  /** 语言 */
  language?: string

  /** 时区 */
  timezone?: string

  /** 其他偏好 */
  [key: string]: unknown
}

/**
 * 用户信息
 */
export interface UserInfo {
  /** 用户名 */
  name: string

  /** 用户邮箱 */
  email?: string

  /** 用户偏好 */
  preferences?: UserPreferences
}

/**
 * Skill 参数值类型
 */
export type SkillArgumentValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | Record<string, unknown>
  | null

/**
 * Skill 参数集合
 */
export interface SkillArguments {
  [key: string]: SkillArgumentValue
}
