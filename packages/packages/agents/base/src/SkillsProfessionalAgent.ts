/**
 * ProfessionalAgent 扩展 - Skills 集成
 *
 * 为 ProfessionalAgent 添加 Skills 系统支持
 *
 * @package @yunpat/agents/base
 */

import type { ExecutionContext } from '@yunpat/core'
import {
  type Skill,
  SkillSource,
  type SkillContext,
  type ActivationResult,
  type ActivationConfig,
  ConditionalActivator,
} from '@yunpat/skills'
import { ProfessionalAgent, type ProfessionalAgentConfig } from './ProfessionalAgent.js'

/** Skills 专用配置 */
export interface SkillsConfig {
  /** Skills 目录列表 */
  skillsDirs?: string[]
  /** 是否自动加载 Skills */
  autoLoadSkills?: boolean
  /** Skills 来源 */
  skillsSource?: SkillSource
}

/** 扩展配置 = ProfessionalAgentConfig + SkillsConfig */
export type ExtendedProfessionalAgentConfig = ProfessionalAgentConfig & SkillsConfig

/**
 * 扩展 ProfessionalAgent 基类
 *
 * 添加 Skills 系统支持
 */
export abstract class SkillsProfessionalAgent<
  TInput = any,
  TOutput = any,
> extends ProfessionalAgent<TInput, TOutput> {
  protected skills: Map<string, Skill> = new Map()
  protected skillsDirs: string[] = []
  protected skillsSource: SkillSource = SkillSource.PROJECT
  protected allowedPaths: string[] = []
  protected activator: ConditionalActivator = new ConditionalActivator()

  constructor(config: ExtendedProfessionalAgentConfig) {
    super(config)
    this.skillsDirs = config.skillsDirs || []
    this.skillsSource = config.skillsSource || SkillSource.PROJECT
    this.allowedPaths = [process.cwd(), ...this.skillsDirs]
  }

  async loadSkills(dirs?: string[], source?: SkillSource): Promise<void> {
    const skillsDirsToLoad = dirs || this.skillsDirs
    const skillsSource = source || this.skillsSource

    if (skillsDirsToLoad.length === 0) {
      console.warn('[SkillsProfessionalAgent] No skills directories configured')
      return
    }

    const { loadSkills } = await import('@yunpat/skills')
    const loadedSkills = await loadSkills(skillsDirsToLoad, skillsSource)

    for (const skill of loadedSkills) {
      this.skills.set(skill.name, skill)
    }

    console.log(
      `[SkillsProfessionalAgent] Loaded ${loadedSkills.length} skills from ${skillsDirsToLoad.length} directories`
    )
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  hasSkill(name: string): boolean {
    return this.skills.has(name)
  }

  getLoadedSkillNames(): string[] {
    return Array.from(this.skills.keys())
  }

  unloadSkill(name: string): boolean {
    const result = this.skills.delete(name)
    if (result) {
      console.log(`[SkillsProfessionalAgent] Unloaded skill: ${name}`)
    }
    return result
  }

  unloadAllSkills(): number {
    const count = this.skills.size
    this.skills.clear()
    console.log(`[SkillsProfessionalAgent] Unloaded ${count} skills`)
    return count
  }

  async reloadSkills(dirs?: string[], source?: SkillSource): Promise<void> {
    console.log('[SkillsProfessionalAgent] Reloading skills...')
    this.unloadAllSkills()
    await this.loadSkills(dirs, source)
  }

  async callSkill(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<{
    system: string
    user: string
    metadata: unknown
  }> {
    const skill = this.getSkill(name)
    if (!skill) {
      throw new Error(
        `Skill '${name}' not found. Available skills: ${this.getLoadedSkillNames().join(', ')}`
      )
    }

    const context: SkillContext = await this.buildSkillContext()
    const prompt = await skill.getPromptForCommand(args, context)

    return {
      system: prompt.system,
      user: prompt.user,
      metadata: prompt.metadata,
    }
  }

  getActiveSkills(filePath: string): ActivationResult[] {
    const allSkills = Array.from(this.skills.values())
    const config: ActivationConfig = {
      agentName: this.name,
      filePath,
    }
    return this.activator.getActiveSkills(allSkills, config)
  }

  isSkillActive(skillName: string, filePath: string): boolean {
    const skill = this.getSkill(skillName)
    if (!skill) return false
    const config: ActivationConfig = {
      agentName: this.name,
      filePath,
    }
    return this.activator.isSkillActive(skill, config)
  }

  getFirstActiveSkill(filePath: string): Skill | undefined {
    const activeSkills = this.getActiveSkills(filePath)
    return activeSkills.length > 0 ? activeSkills[0].skill : undefined
  }

  async callActiveSkill(
    filePath: string,
    args: Record<string, unknown> = {}
  ): Promise<{
    system: string
    user: string
    metadata: unknown
    skillName: string
  } | null> {
    const activeSkills = this.getActiveSkills(filePath)
    if (activeSkills.length === 0) {
      return null
    }

    const skill = activeSkills[0].skill
    const result = await this.callSkill(skill.name, args)

    return {
      ...result,
      skillName: skill.name,
    }
  }

  protected async buildSkillContext(): Promise<SkillContext> {
    const context: SkillContext = {
      agentName: this.name,
      agentDescription: this.description || '',
      tools: this.tools as unknown as SkillContext['tools'],
      'allowed-tools': [],
      env: {
        cwd: process.cwd(),
        home: process.env.HOME || '',
        sessionId: `${Date.now()}`,
        allowedPaths: this.allowedPaths,
      },
      call: {
        skillName: '',
        args: {},
        timestamp: new Date(),
      },
    }

    return context
  }

  protected override async before(_input: TInput, _context: ExecutionContext): Promise<void> {
    if (this.skillsDirs.length > 0) {
      await this.loadSkills()
    }
  }
}
