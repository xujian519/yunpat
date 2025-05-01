/**
 * Skill 加载器
 *
 * 负责从文件系统加载 Skills
 *
 * @package @yunpat/skills
 */

import { readFile } from 'fs/promises'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { realpath } from 'fs/promises'
import type { Skill } from '../types/Skill.js'
import type { SkillFrontmatter } from '../types/SkillFrontmatter.js'
import type { SkillContext } from '../types/SkillContext.js'
import type { SkillSource, SkillPrompt } from '../types/Skill.js'
import { parseFrontmatter } from './FrontmatterParser.js'
import { renderSkillPrompt } from '../renderer/SkillRenderer.js'

/**
 * 从目录加载 Skills
 *
 * @param dir - Skills 目录路径
 * @param source - Skills 来源
 * @returns 加载的 Skills 数组
 */
export async function loadSkillsFromDir(dir: string, source: SkillSource): Promise<Skill[]> {
  const skills: Skill[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // 跳过非目录文件
      if (!entry.isDirectory()) continue

      const skillDir = join(dir, entry.name)
      const skillFile = join(skillDir, 'SKILL.md')

      try {
        const content = await readFile(skillFile, 'utf-8')
        const { frontmatter, content: markdownContent } = parseFrontmatter(content, skillFile)

        const skill: Skill = {
          name: frontmatter.name || entry.name,
          description: frontmatter.description || entry.name,
          version: frontmatter.version,
          frontmatter,
          content: markdownContent,
          getPromptForCommand: async (args, context) => {
            return renderSkillPrompt(skill, args, context)
          },
          loadedAt: new Date(),
          source,
        }

        skills.push(skill)
      } catch (error) {
        // 记录错误但继续加载其他 Skills
        console.warn(`[SkillLoader] Failed to load skill from ${skillDir}:`, error)
      }
    }
  } catch (error) {
    console.warn(`[SkillLoader] Failed to read skills directory ${dir}:`, error)
  }

  return skills
}

/**
 * 去重 Skills
 *
 * 通过 realpath 解析符号链接，去除重复的 Skills
 *
 * @param skills - Skills 数组
 * @returns 去重后的 Skills
 */
export async function deduplicateSkills(skills: Skill[]): Promise<Skill[]> {
  const fileIds = new Map<string, Skill>()
  const deduplicated: Skill[] = []

  // 并行计算所有 Skills 的文件标识
  const identities = await Promise.all(
    skills.map(async (skill) => {
      // 这里简化处理，实际应该基于 Skill 文件路径
      // 暂时使用 skill.name 作为唯一标识
      return skill.name
    })
  )

  // 去重（保留第一次出现的）
  for (let i = 0; i < skills.length; i++) {
    const identity = identities[i]
    if (!fileIds.has(identity)) {
      fileIds.set(identity, skills[i]!)
      deduplicated.push(skills[i]!)
    }
  }

  const duplicatesRemoved = skills.length - deduplicated.length
  if (duplicatesRemoved > 0) {
    console.log(`[SkillLoader] Deduplicated ${duplicatesRemoved} skills (same name)`)
  }

  return deduplicated
}

/**
 * 加载 Skills（主入口）
 *
 * @param dirs - Skills 目录列表
 * @param source - Skills 来源
 * @returns 加载并去重后的 Skills
 */
export async function loadSkills(dirs: string[], source: SkillSource): Promise<Skill[]> {
  // 并行加载所有目录
  const allSkills = await Promise.all(dirs.map((dir) => loadSkillsFromDir(dir, source)))

  // 合并所有 Skills
  const merged = allSkills.flat()

  // 去重
  return deduplicateSkills(merged)
}

/**
 * 创建 Skill 对象（工厂函数）
 *
 * @param name - Skill 名称
 * @param frontmatter - Frontmatter 元数据
 * @param content - Markdown 内容
 * @param source - Skills 来源
 * @returns Skill 对象
 */
export function createSkill(
  name: string,
  frontmatter: SkillFrontmatter,
  content: string,
  source: SkillSource
): Skill {
  return {
    name,
    description: frontmatter.description || name,
    version: frontmatter.version,
    frontmatter,
    content,
    getPromptForCommand: async (args, context) => {
      return renderSkillPrompt({ name, frontmatter, content } as Skill, args, context)
    },
    loadedAt: new Date(),
    source,
  }
}
