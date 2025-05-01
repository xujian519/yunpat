/**
 * 条件激活类型定义
 *
 * @package @yunpat/skills
 */

import type { Skill } from '../types/Skill.js'

/**
 * 激活条件
 */
export interface ActivationCondition {
  /** Glob 路径模式数组 */
  paths?: string[]

  /** 文件扩展名数组 */
  fileTypes?: string[]

  /** 适用的 Agent 名称数组 */
  agent?: string[]
}

/**
 * 激活结果
 */
export interface ActivationResult {
  /** 被激活的 Skill */
  skill: Skill

  /** 匹配方式 */
  matchedBy: 'path' | 'fileType' | 'agent' | 'default'

  /** 匹配的模式或条件 */
  matchedPattern?: string

  /** 匹配的文件路径（如果是路径匹配） */
  matchedPath?: string
}

/**
 * 激活配置
 */
export interface ActivationConfig {
  /** Agent 名称 */
  agentName?: string

  /** 文件路径 */
  filePath?: string

  /** 额外的上下文信息 */
  context?: Record<string, unknown>
}

/**
 * 激活策略
 */
export enum ActivationStrategy {
  /** 匹配任一条件即激活 */
  ANY = 'any',

  /** 必须匹配所有条件才激活 */
  ALL = 'all',

  /** 默认激活（无条件） */
  DEFAULT = 'default',
}
