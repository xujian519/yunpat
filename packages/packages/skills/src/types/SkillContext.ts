/**
 * Skill Context 接口定义
 *
 * @package @yunpat/skills
 */

import type { ToolRegistry, UserInfo } from './CommonTypes.js'

/**
 * Skill Context 接口
 *
 * 定义传递给 Skill 的上下文信息
 */
export interface SkillContext {
  // ========== Agent 上下文 ==========

  /** Agent 名称 */
  agentName: string

  /** Agent 描述 */
  agentDescription: string

  // ========== 工具上下文 ==========

  /** 工具注册表 */
  tools: ToolRegistry

  /** 允许的工具列表 */
  'allowed-tools': string[]

  // ========== 知识库上下文 ==========

  /** 知识库数据（可选） */
  knowledge?: {
    /** 概念列表 */
    concepts: ConceptEntry[]

    /** Wiki 页面列表 */
    wiki_pages: WikiPageEntry[]

    /** 知识卡片列表 */
    cards: CardEntry[]
  }

  // ========== 环境上下文 ==========

  /** 环境信息 */
  env: {
    /** 当前工作目录 */
    cwd: string

    /** 用户主目录 */
    home: string

    /** 会话 ID */
    sessionId: string

    /** 允许访问的路径列表（用于 Shell 命令安全验证） */
    allowedPaths?: string[]
  }

  // ========== 用户上下文 ==========

  /** 用户信息（可选） */
  user?: UserInfo

  // ========== 调用上下文 ==========

  /** 调用信息 */
  call: {
    /** 技能名称 */
    skillName: string

    /** 技能参数 */
    args: Record<string, any>

    /** 调用时间戳 */
    timestamp: Date
  }
}

/**
 * 概念条目
 */
export interface ConceptEntry {
  /** 概念名称 */
  name: string

  /** 概念描述 */
  description: string

  /** 相关页面 */
  related_pages: string[]
}

/**
 * Wiki 页面条目
 */
export interface WikiPageEntry {
  /** 页面标题 */
  title: string

  /** 页面内容 */
  content: string

  /** 页面路径 */
  path: string
}

/**
 * 知识卡片条目
 */
export interface CardEntry {
  /** 卡片标题 */
  title: string

  /** 卡片内容 */
  content: string

  /** 卡片文件名 */
  filename: string

  /** 创建时间 */
  createdAt: Date
}
