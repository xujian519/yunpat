/**
 * Skill 接口定义
 *
 * @package @yunpat/skills
 */

import type { SkillFrontmatter } from './SkillFrontmatter.js'
import type { SkillContext } from './SkillContext.js'

/**
 * Skill 接口
 *
 * 表示一个可加载的技能，包含元数据、内容和渲染方法
 */
export interface Skill {
  // ========== 基本信息 ==========

  /** 技能名称 */
  name: string

  /** 技能描述 */
  description: string

  /** 技能版本（可选） */
  version?: string

  // ========== 元数据 ==========

  /** Frontmatter 元数据 */
  frontmatter: SkillFrontmatter

  /** 提示词内容（Markdown 格式） */
  content: string

  // ========== 渲染方法 ==========

  /**
   * 获取提示词
   *
   * @param args - 技能参数
   * @param context - 技能上下文
   * @returns 渲染后的提示词
   */
  getPromptForCommand(args: Record<string, any>, context: SkillContext): Promise<SkillPrompt>

  // ========== 元数据 ==========

  /** 加载时间 */
  loadedAt: Date

  /** 技能来源 */
  source: SkillSource
}

/**
 * 技能提示词
 *
 * 包含系统提示词和用户提示词
 */
export interface SkillPrompt {
  /** 系统提示词 */
  system: string

  /** 用户提示词 */
  user: string

  /** 提示词元数据 */
  metadata: {
    /** Token 数量 */
    tokenCount: number

    /** 是否包含知识库内容 */
    hasKnowledge: boolean

    /** 是否包含变量 */
    hasVariables: boolean

    /** 是否包含 Shell 命令 */
    hasShellCommands: boolean
  }
}

/**
 * 技能来源枚举
 */
export const enum SkillSource {
  /** 系统级技能 */
  SYSTEM = 'system',

  /** 用户级技能 */
  USER = 'user',

  /** 项目级技能 */
  PROJECT = 'project',
}
