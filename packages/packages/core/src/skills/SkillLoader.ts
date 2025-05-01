import { readFileSync, existsSync, readdirSync, statSync, watch, type FSWatcher } from 'fs'
import { join, dirname, basename } from 'path'

export interface SkillMetadata {
  name: string
  version: string
  description: string
  author?: string
  tags?: string[]
  requiredVariables?: string[]
  optionalVariables?: string[]
  abTest?: {
    enabled: boolean
    variants: string[]
    weights?: number[]
  }
}

export interface SkillTemplate {
  name: string
  metadata: SkillMetadata
  content: string
  loadedAt: Date
  filePath: string
}

export interface RenderOptions {
  validateVariables?: boolean
  defaultValues?: Record<string, string>
  applyTerminology?: boolean
  abVariant?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface TerminologyMap {
  [nonStandard: string]: string
}

export interface SkillLoaderConfig {
  baseDir?: string
  enableHotReload?: boolean
  terminologyFile?: string
  defaultAbVariant?: string
}

export class SkillLoader {
  private baseDir: string
  private cache = new Map<string, SkillTemplate>()
  private terminologyMap = new Map<string, string>()
  private abTestAssignments = new Map<string, string>()
  private watchers = new Map<string, FSWatcher>()
  private config: SkillLoaderConfig
  private readonly frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

  constructor(config?: SkillLoaderConfig) {
    this.config = config || {}
    this.baseDir = this.config.baseDir || join(process.cwd(), '.yunpat', 'skills')
    this.loadTerminology()
    if (this.config.enableHotReload) {
      this.setupHotReload()
    }
  }

  async load(skillPath: string): Promise<SkillTemplate> {
    if (this.cache.has(skillPath)) {
      return this.cache.get(skillPath)!
    }

    const filePath = this.resolvePath(skillPath)
    if (!existsSync(filePath)) {
      throw new Error(`Skill 模板不存在: ${filePath}`)
    }

    const content = readFileSync(filePath, 'utf-8')
    const template = this.parseTemplate(skillPath, content, filePath)
    this.cache.set(skillPath, template)

    if (this.config.enableHotReload && !this.watchers.has(skillPath)) {
      this.watchFile(skillPath, filePath)
    }

    return template
  }

  async loadDirectory(dirPath: string): Promise<SkillTemplate[]> {
    const fullPath = join(this.baseDir, dirPath)
    if (!existsSync(fullPath)) {
      return []
    }

    const templates: SkillTemplate[] = []
    const entries = readdirSync(fullPath)

    for (const entry of entries) {
      const entryPath = join(fullPath, entry)
      const stat = statSync(entryPath)

      if (stat.isDirectory()) {
        const subTemplates = await this.loadDirectory(join(dirPath, entry))
        templates.push(...subTemplates)
      } else if (entry.endsWith('.md')) {
        const relativePath = join(dirPath, entry.replace('.md', ''))
        templates.push(await this.load(relativePath))
      }
    }

    return templates
  }

  render(
    template: SkillTemplate,
    variables: Record<string, unknown>,
    options: RenderOptions = {}
  ): string {
    if (options.validateVariables !== false) {
      const validation = this.validateVariables(template, variables)
      if (!validation.valid) {
        throw new Error(`变量验证失败:\n${validation.errors.join('\n')}`)
      }
    }

    let result = template.content

    result = this.processConditionals(result, variables)
    result = this.replaceVariables(result, variables, options.defaultValues)

    if (options.applyTerminology !== false && this.terminologyMap.size > 0) {
      result = this.applyTerminology(result)
    }

    return result
  }

  getAbVariant(skillPath: string): string {
    if (this.abTestAssignments.has(skillPath)) {
      return this.abTestAssignments.get(skillPath)!
    }

    const template = this.cache.get(skillPath)
    if (!template || !template.metadata.abTest?.enabled) {
      return this.config.defaultAbVariant || 'control'
    }

    const abTest = template.metadata.abTest
    const variants = abTest.variants || ['control', 'variant-b']
    const weights = abTest.weights || [0.5, 0.5]

    const random = Math.random()
    let cumulative = 0
    let selected = variants[0]

    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i] || 0
      if (random <= cumulative) {
        selected = variants[i]
        break
      }
    }

    this.abTestAssignments.set(skillPath, selected)
    return selected
  }

  loadAbVariantTemplate(skillPath: string, variant: string): Promise<SkillTemplate> {
    const variantPath = `${skillPath}.${variant}`
    return this.load(variantPath)
  }

  validateVariables(template: SkillTemplate, variables: Record<string, unknown>): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (template.metadata.requiredVariables) {
      for (const required of template.metadata.requiredVariables) {
        if (
          !(required in variables) ||
          variables[required] === undefined ||
          variables[required] === ''
        ) {
          errors.push(`缺少必需变量: ${required}`)
        }
      }
    }

    const allVariables = [
      ...(template.metadata.requiredVariables || []),
      ...(template.metadata.optionalVariables || []),
    ]

    for (const key of Object.keys(variables)) {
      if (!allVariables.includes(key)) {
        warnings.push(`未使用的变量: ${key}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  listSkills(): string[] {
    return this.scanDirectory(this.baseDir)
  }

  getCacheStats() {
    return {
      cachedCount: this.cache.size,
      cachedSkills: Array.from(this.cache.keys()),
      terminologySize: this.terminologyMap.size,
      watchersCount: this.watchers.size,
    }
  }

  clearCache(): void {
    this.cache.clear()
    this.abTestAssignments.clear()
  }

  destroy(): void {
    this.watchers.forEach((watcher) => watcher.close())
    this.watchers.clear()
    this.clearCache()
  }

  private loadTerminology(): void {
    const terminologyPath =
      this.config.terminologyFile || join(this.baseDir, 'shared', 'terminology.md')
    if (!existsSync(terminologyPath)) {
      return
    }

    try {
      const content = readFileSync(terminologyPath, 'utf-8')
      const tableRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g
      let match
      while ((match = tableRegex.exec(content)) !== null) {
        const nonStandard = match[1].trim()
        const standard = match[2].trim()
        if (nonStandard && standard && nonStandard !== '非标准术语' && nonStandard !== '---') {
          this.terminologyMap.set(nonStandard, standard)
        }
      }
      console.log(`[SkillLoader] 加载术语映射: ${this.terminologyMap.size} 条`)
    } catch {
      console.debug('[SkillLoader] 术语文件未找到，跳过术语标准化')
    }
  }

  private applyTerminology(content: string): string {
    let result = content
    for (const [nonStandard, standard] of this.terminologyMap.entries()) {
      const regex = new RegExp(nonStandard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      result = result.replace(regex, standard)
    }
    return result
  }

  private setupHotReload(): void {
    if (!existsSync(this.baseDir)) {
      return
    }

    const watcher = watch(this.baseDir, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        const skillPath = filename.replace('.md', '').replace(/\\/g, '/')
        if (this.cache.has(skillPath)) {
          console.log(`[SkillLoader] 热更新: ${skillPath}`)
          this.cache.delete(skillPath)
        }
      }
    })

    console.log(`[SkillLoader] 热更新已启用，监听目录: ${this.baseDir}`)
  }

  private watchFile(skillPath: string, filePath: string): void {
    const watcher = watch(filePath, (eventType) => {
      if (eventType === 'change') {
        console.log(`[SkillLoader] 文件变更: ${skillPath}`)
        this.cache.delete(skillPath)
      }
    })
    this.watchers.set(skillPath, watcher)
  }

  private parseTemplate(name: string, content: string, filePath: string): SkillTemplate {
    const match = content.match(this.frontmatterRegex)

    if (!match) {
      return {
        name,
        metadata: {
          name: basename(name),
          version: '1.0.0',
          description: '',
        },
        content: content.trim(),
        loadedAt: new Date(),
        filePath,
      }
    }

    const frontmatter = match[1]
    const templateContent = match[2].trim()
    const metadata = this.parseFrontmatter(frontmatter)

    return {
      name,
      metadata,
      content: templateContent,
      loadedAt: new Date(),
      filePath,
    }
  }

  private parseFrontmatter(frontmatter: string): SkillMetadata {
    const metadata: Record<string, any> = {
      name: '',
      version: '1.0.0',
      description: '',
    }

    const lines = frontmatter.split('\n')
    let inAbTest = false
    let abTestData: any = {}

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === 'abTest:') {
        inAbTest = true
        abTestData = {}
        continue
      }

      if (inAbTest) {
        if (trimmed.startsWith('enabled:')) {
          abTestData.enabled = trimmed.split(':')[1].trim() === 'true'
        } else if (trimmed.startsWith('variants:')) {
          abTestData.variants = trimmed
            .split(':')[1]
            .trim()
            .slice(1, -1)
            .split(',')
            .map((v) => v.trim())
        } else if (trimmed.startsWith('weights:')) {
          abTestData.weights = trimmed
            .split(':')[1]
            .trim()
            .slice(1, -1)
            .split(',')
            .map((v) => parseFloat(v.trim()))
        } else if (!trimmed.startsWith(' ') && trimmed.includes(':')) {
          inAbTest = false
        }

        if (!inAbTest) {
          metadata.abTest = abTestData
        }
        continue
      }

      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim()
        let value = line.slice(colonIndex + 1).trim()

        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1)
          metadata[key] = value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        } else {
          metadata[key] = value
        }
      }
    }

    if (inAbTest && Object.keys(abTestData).length > 0) {
      metadata.abTest = abTestData
    }

    return metadata as SkillMetadata
  }

  private processConditionals(content: string, variables: Record<string, unknown>): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g

    return content.replace(conditionalRegex, (match, varName, innerContent) => {
      const value = variables[varName]
      if (value && value !== '' && value !== false && value !== 0) {
        return innerContent
      }
      return ''
    })
  }

  private replaceVariables(
    content: string,
    variables: Record<string, unknown>,
    defaultValues?: Record<string, string>
  ): string {
    let result = content

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      result = result.replace(regex, String(value))
    }

    if (defaultValues) {
      for (const [key, defaultValue] of Object.entries(defaultValues)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
        if (result.includes(`{{${key}}}`)) {
          result = result.replace(regex, defaultValue)
        }
      }
    }

    result = result.replace(/\{\{[^#/][^}]+\}\}/g, '')

    return result
  }

  private resolvePath(skillPath: string): string {
    if (skillPath.startsWith('/')) {
      return skillPath
    }

    return join(this.baseDir, `${skillPath}.md`)
  }

  private scanDirectory(dir: string, prefix: string = ''): string[] {
    if (!existsSync(dir)) {
      return []
    }

    const skills: string[] = []
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const entryPath = join(dir, entry)
      const stat = statSync(entryPath)
      const relativePath = prefix ? `${prefix}/${entry}` : entry

      if (stat.isDirectory()) {
        skills.push(...this.scanDirectory(entryPath, relativePath))
      } else if (entry.endsWith('.md')) {
        skills.push(relativePath.replace('.md', ''))
      }
    }

    return skills
  }
}

export function createSkillLoader(config?: SkillLoaderConfig): SkillLoader {
  return new SkillLoader(config)
}
