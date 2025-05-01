/**
 * 条件激活器
 *
 * 根据文件路径和其他条件自动激活相关 Skills
 *
 * @package @yunpat/skills
 */

import type { Skill } from '../types/Skill.js'
import type { SkillFrontmatter } from '../types/SkillFrontmatter.js'
import { PathMatcher } from './PathMatcher.js'
import type { ActivationCondition, ActivationResult, ActivationConfig } from './types.js'
import { ActivationStrategy } from './types.js'

/**
 * 条件激活器
 *
 * 评估 Skill 的激活条件并返回应激活的 Skills
 */
export class ConditionalActivator {
  private pathMatcher: PathMatcher
  private strategy: ActivationStrategy

  constructor(pathMatcher?: PathMatcher, strategy: ActivationStrategy = ActivationStrategy.ANY) {
    this.pathMatcher = pathMatcher || new PathMatcher()
    this.strategy = strategy
  }

  /**
   * 获取应激活的 Skills
   *
   * @param skills - 所有可用的 Skills
   * @param config - 激活配置
   * @returns 激活的 Skills 列表
   */
  getActiveSkills(skills: Skill[], config: ActivationConfig): ActivationResult[] {
    const results: ActivationResult[] = []

    for (const skill of skills) {
      const result = this.evaluateSkill(skill, config)
      if (result) {
        results.push(result)
      }
    }

    // 按优先级排序（路径匹配 > 文件类型 > 默认）
    return results.sort((a, b) => {
      const priority = { path: 3, fileType: 2, agent: 1, default: 0 }
      return priority[b.matchedBy] - priority[a.matchedBy]
    })
  }

  /**
   * 评估单个 Skill 是否应激活
   *
   * @param skill - Skill 对象
   * @param config - 激活配置
   * @returns 激活结果或 null
   */
  evaluateSkill(skill: Skill, config: ActivationConfig): ActivationResult | null {
    const { paths, fileTypes, agent } = this.extractConditions(skill.frontmatter)

    // 无条件 Skills 默认激活
    if (!paths && !fileTypes && !agent) {
      return {
        skill,
        matchedBy: 'default',
      }
    }

    // 提取条件
    const conditions: ActivationCondition = {
      paths,
      fileTypes,
      agent,
    }

    // 评估条件
    if (this.strategy === ActivationStrategy.ALL) {
      // 必须匹配所有条件
      if (this.matchesAll(conditions, config)) {
        return this.createResult(skill, conditions, config)
      }
    } else {
      // 匹配任一条件（默认）
      if (this.matchesAny(conditions, config)) {
        return this.createResult(skill, conditions, config)
      }
    }

    return null
  }

  /**
   * 检查 Skill 是否应激活
   *
   * @param skill - Skill 对象
   * @param config - 激活配置
   * @returns 是否应激活
   */
  isSkillActive(skill: Skill, config: ActivationConfig): boolean {
    return this.evaluateSkill(skill, config) !== null
  }

  /**
   * 提取 Skill 的激活条件
   *
   * @param frontmatter - Skill frontmatter
   * @returns 激活条件
   */
  private extractConditions(frontmatter: SkillFrontmatter): ActivationCondition {
    // 处理 agent 字段（可能是 string 或 string[]）
    let agentList: string[] | undefined
    if (frontmatter.agent) {
      agentList = Array.isArray(frontmatter.agent) ? frontmatter.agent : [frontmatter.agent]
    }

    return {
      paths: frontmatter.paths,
      fileTypes: frontmatter['file-types'],
      agent: agentList,
    }
  }

  /**
   * 检查是否匹配任一条件
   *
   * @param conditions - 激活条件
   * @param config - 激活配置
   * @returns 是否匹配
   */
  private matchesAny(conditions: ActivationCondition, config: ActivationConfig): boolean {
    // 路径匹配
    if (conditions.paths && conditions.paths.length > 0 && config.filePath) {
      if (this.pathMatcher.matchAny(config.filePath, conditions.paths)) {
        return true
      }
    }

    // 文件类型匹配
    if (conditions.fileTypes && conditions.fileTypes.length > 0 && config.filePath) {
      const ext = this.getExtension(config.filePath)
      if (ext && conditions.fileTypes.includes(ext)) {
        return true
      }
    }

    // Agent 匹配
    if (conditions.agent && conditions.agent.length > 0 && config.agentName) {
      if (conditions.agent.includes(config.agentName)) {
        return true
      }
    }

    return false
  }

  /**
   * 检查是否匹配所有条件
   *
   * @param conditions - 激活条件
   * @param config - 激活配置
   * @returns 是否匹配
   */
  private matchesAll(conditions: ActivationCondition, config: ActivationConfig): boolean {
    let matched = true

    // 路径必须匹配
    if (conditions.paths && conditions.paths.length > 0) {
      if (!config.filePath) {
        return false
      }
      matched = matched && this.pathMatcher.matchAny(config.filePath, conditions.paths)
    }

    // 文件类型必须匹配
    if (conditions.fileTypes && conditions.fileTypes.length > 0) {
      if (!config.filePath) {
        return false
      }
      const ext = this.getExtension(config.filePath)
      matched = matched && ext !== null && conditions.fileTypes.includes(ext)
    }

    // Agent 必须匹配
    if (conditions.agent && conditions.agent.length > 0) {
      if (!config.agentName) {
        return false
      }
      matched = matched && conditions.agent.includes(config.agentName)
    }

    return matched
  }

  /**
   * 创建激活结果
   *
   * @param skill - Skill 对象
   * @param conditions - 激活条件
   * @param config - 激活配置
   * @returns 激活结果
   */
  private createResult(
    skill: Skill,
    conditions: ActivationCondition,
    config: ActivationConfig
  ): ActivationResult {
    // 确定匹配方式
    let matchedBy: ActivationResult['matchedBy'] = 'default'
    let matchedPattern: string | undefined

    if (
      conditions.paths &&
      config.filePath &&
      this.pathMatcher.matchAny(config.filePath, conditions.paths)
    ) {
      matchedBy = 'path'
      // 找到匹配的模式
      matchedPattern = conditions.paths.find((pattern) =>
        this.pathMatcher.match(config.filePath!, pattern)
      )
    } else if (conditions.fileTypes && config.filePath) {
      matchedBy = 'fileType'
      const ext = this.getExtension(config.filePath)
      matchedPattern = ext || undefined
    } else if (
      conditions.agent &&
      config.agentName &&
      conditions.agent.includes(config.agentName)
    ) {
      matchedBy = 'agent'
      matchedPattern = config.agentName
    }

    return {
      skill,
      matchedBy,
      matchedPattern,
      matchedPath: config.filePath,
    }
  }

  /**
   * 获取文件扩展名
   *
   * @param filePath - 文件路径
   * @returns 文件扩展名（包含点号）
   */
  private getExtension(filePath: string): string | null {
    const lastDot = filePath.lastIndexOf('.')
    if (lastDot === -1 || lastDot === filePath.length - 1) {
      return null
    }
    return filePath.substring(lastDot)
  }

  /**
   * 设置激活策略
   *
   * @param strategy - 激活策略
   */
  setStrategy(strategy: ActivationStrategy): void {
    this.strategy = strategy
  }

  /**
   * 获取激活策略
   *
   * @returns 当前激活策略
   */
  getStrategy(): ActivationStrategy {
    return this.strategy
  }
}

/**
 * 创建条件激活器（工厂函数）
 *
 * @param pathMatcher - 路径匹配器（可选）
 * @param strategy - 激活策略
 * @returns 条件激活器实例
 */
export function createConditionalActivator(
  pathMatcher?: PathMatcher,
  strategy?: ActivationStrategy
): ConditionalActivator {
  return new ConditionalActivator(pathMatcher, strategy)
}

/**
 * 默认条件激活器实例
 */
export const defaultActivator = new ConditionalActivator()
