/**
 * Skill 去重器
 *
 * 负责去除重复的 Skills
 *
 * @package @yunpat/skills
 */

import { realpath } from 'fs/promises'
import type { Skill } from '../types/Skill.js'

/**
 * 去重配置
 */
export interface DeduplicateConfig {
  /** 是否使用 realpath 解析符号链接 */
  useRealpath?: boolean

  /** 是否记录日志 */
  logDuplicates?: boolean
}

/**
 * 获取 Skill 唯一标识
 *
 * @param skill - Skill 对象
 * @param config - 去重配置
 * @returns 唯一标识
 */
async function getSkillIdentity(skill: Skill, config: DeduplicateConfig): Promise<string> {
  // 简化版本：使用 skill.name 作为唯一标识
  // 实际应用中可以使用更复杂的逻辑，比如基于内容哈希
  return skill.name
}

/**
 * 去重 Skills
 *
 * @param skills - Skills 数组
 * @param config - 去重配置
 * @returns 去重后的 Skills
 */
export async function deduplicateSkills(
  skills: Skill[],
  config: DeduplicateConfig = {}
): Promise<Skill[]> {
  const { useRealpath = true, logDuplicates = true } = config

  const seen = new Map<string, Skill>()
  const duplicates: string[] = []

  for (const skill of skills) {
    try {
      const identity = await getSkillIdentity(skill, { useRealpath })

      if (seen.has(identity)) {
        duplicates.push(identity)
        if (logDuplicates) {
          console.log(
            `[SkillDeduplicator] Skipping duplicate skill '${skill.name}' (same identity as existing skill)`
          )
        }
        continue
      }

      seen.set(identity, skill)
    } catch (error) {
      // 如果获取标识失败，保留该 Skill（保守策略）
      console.warn(`[SkillDeduplicator] Failed to get identity for '${skill.name}':`, error)
      // 使用 skill.name 作为后备标识
      if (!seen.has(skill.name)) {
        seen.set(skill.name, skill)
      }
    }
  }

  if (logDuplicates && duplicates.length > 0) {
    console.log(`[SkillDeduplicator] Deduplicated ${duplicates.length} skills`)
  }

  return Array.from(seen.values())
}

/**
 * 合并 Skills（去重）
 *
 * @param skillsArray - 多个 Skills 数组
 * @param config - 去重配置
 * @returns 合并并去重后的 Skills
 */
export async function mergeSkills(
  skillsArray: Skill[][],
  config: DeduplicateConfig = {}
): Promise<Skill[]> {
  // 合并所有 Skills
  const merged = skillsArray.flat()

  // 去重
  return deduplicateSkills(merged, config)
}
