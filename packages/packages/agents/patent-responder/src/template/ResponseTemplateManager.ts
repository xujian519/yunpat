/**
 * 答复模板管理器
 *
 * 负责管理答复文档模板，提供：
 * 1. 多地区模板支持 (CN/PCT/US/EP)
 * 2. 不同驳回类型的专用模板
 * 3. 模板变量替换
 * 4. 模板效果追踪
 * 5. 模板版本管理
 *
 * @module template/ResponseTemplateManager
 */

import type { ResponseTemplate, OAParseResult, StrategyRecommendation } from '../types/index.js'
import { RejectionType, ResponseStrategy } from '../types/index.js'
import { BUILT_IN_TEMPLATES } from './BuiltInTemplates.js'
import { replaceVariables, getRequiredVariables, getTemplateVariableList } from './TemplateUtils.js'

export interface TemplateVariable {
  name: string
  defaultValue?: string
  required?: boolean
  description?: string
}

export interface TemplateRenderResult {
  content: string
  templateId: string
  variables: Record<string, string>
  hasMissingRequired: boolean
  missingRequired: string[]
}

export interface TemplateManagerConfig {
  customTemplatePath?: string
  enableTracking?: boolean
  cacheSize?: number
}

export class ResponseTemplateManager {
  private config: Required<TemplateManagerConfig>
  private templates: Map<string, ResponseTemplate> = new Map()
  private templateStats: Map<string, { usageCount: number; successCount: number }> = new Map()

  constructor(config: TemplateManagerConfig = {}) {
    this.config = {
      customTemplatePath: config.customTemplatePath || '',
      enableTracking: config.enableTracking ?? true,
      cacheSize: config.cacheSize || 100,
    }

    for (const template of BUILT_IN_TEMPLATES) {
      this.templates.set(template.id, template)
      this.templateStats.set(template.id, { usageCount: 0, successCount: 0 })
    }
  }

  addTemplate(template: ResponseTemplate): void {
    this.templates.set(template.id, template)
    this.templateStats.set(template.id, {
      usageCount: template.usageCount || 0,
      successCount: 0,
    })
  }

  addTemplates(templates: ResponseTemplate[]): void {
    for (const template of templates) {
      this.addTemplate(template)
    }
  }

  getTemplate(id: string): ResponseTemplate | undefined {
    return this.templates.get(id)
  }

  getAllTemplates(): ResponseTemplate[] {
    return Array.from(this.templates.values())
  }

  filterTemplates(filter: {
    rejectionType?: RejectionType
    strategy?: ResponseStrategy
    tags?: string[]
  }): ResponseTemplate[] {
    return this.getAllTemplates().filter((template) => {
      if (filter.rejectionType && !template.applicableRejections.includes(filter.rejectionType)) {
        return false
      }
      if (filter.strategy && !template.applicableStrategies.includes(filter.strategy)) {
        return false
      }
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every((tag) => template.tags.includes(tag))
        if (!hasAllTags) return false
      }
      return true
    })
  }

  recommendTemplate(
    parseResult: OAParseResult,
    recommendation: StrategyRecommendation,
    documentType: 'cn' | 'pct' | 'us' = 'cn'
  ): ResponseTemplate | null {
    const candidates = this.filterTemplates({
      rejectionType: parseResult.rejectionTypes[0],
      strategy: recommendation.strategy,
      tags: [documentType],
    })

    if (candidates.length === 0) return null

    candidates.sort((a, b) => {
      const scoreA = this.calculateTemplateScore(a)
      const scoreB = this.calculateTemplateScore(b)
      return scoreB - scoreA
    })

    return candidates[0]
  }

  private calculateTemplateScore(template: ResponseTemplate): number {
    let score = 0

    score += template.successRate * 50

    const usageScore = Math.min(template.usageCount / 100, 1) * 20
    score += usageScore

    const stats = this.templateStats.get(template.id)
    if (stats && stats.usageCount > 0) {
      const actualSuccessRate = stats.successCount / stats.usageCount
      score += actualSuccessRate * 30
    }

    return score
  }

  renderTemplate(
    templateId: string,
    variables: Record<string, string>,
    options?: {
      includeOpening?: boolean
      includeClosing?: boolean
      argumentCategories?: string[]
    }
  ): TemplateRenderResult {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`模板 ${templateId} 不存在`)
    }

    const result: TemplateRenderResult = {
      content: '',
      templateId,
      variables: { ...variables },
      hasMissingRequired: false,
      missingRequired: [],
    }

    let rendered = ''

    if (options?.includeOpening !== false && template.content.opening) {
      rendered += replaceVariables(template.content.opening, variables)
    }

    const categoriesToRender =
      options?.argumentCategories || template.content.argumentTemplates.map((t) => t.category)

    for (const argTemplate of template.content.argumentTemplates) {
      if (categoriesToRender.includes(argTemplate.category)) {
        rendered += '\n\n'
        rendered += replaceVariables(argTemplate.template, variables)
      }
    }

    if (options?.includeClosing !== false && template.content.closing) {
      rendered += replaceVariables(template.content.closing, variables)
    }

    result.content = rendered

    const requiredVars = getRequiredVariables(template)
    const missing = requiredVars.filter((v) => !variables[v] || variables[v].trim() === '')

    result.hasMissingRequired = missing.length > 0
    result.missingRequired = missing

    if (this.config.enableTracking) {
      this.trackUsage(templateId)
    }

    return result
  }

  getTemplateVariables(templateId: string): TemplateVariable[] {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`模板 ${templateId} 不存在`)
    }

    const variables = getRequiredVariables(template)
    return getTemplateVariableList(variables)
  }

  private trackUsage(templateId: string): void {
    const stats = this.templateStats.get(templateId)
    if (stats) {
      stats.usageCount++
    }

    const template = this.templates.get(templateId)
    if (template) {
      template.usageCount++
    }
  }

  recordSuccess(templateId: string): void {
    if (!this.config.enableTracking) return

    const stats = this.templateStats.get(templateId)
    if (stats) {
      stats.successCount++
    }

    const template = this.templates.get(templateId)
    if (template && stats) {
      template.successRate = stats.successCount / stats.usageCount
    }
  }

  recordSuccesses(templateIds: string[]): void {
    for (const id of templateIds) {
      this.recordSuccess(id)
    }
  }

  getTemplateStats(
    templateId: string
  ): { usageCount: number; successCount: number; successRate: number } | undefined {
    const stats = this.templateStats.get(templateId)
    if (!stats) return undefined

    return {
      usageCount: stats.usageCount,
      successCount: stats.successCount,
      successRate: stats.usageCount > 0 ? stats.successCount / stats.usageCount : 0,
    }
  }

  getAllStats(): Map<string, { usageCount: number; successCount: number; successRate: number }> {
    const result = new Map()

    for (const [id, stats] of this.templateStats) {
      result.set(id, {
        usageCount: stats.usageCount,
        successCount: stats.successCount,
        successRate: stats.usageCount > 0 ? stats.successCount / stats.usageCount : 0,
      })
    }

    return result
  }

  removeTemplate(templateId: string): boolean {
    const deleted = this.templates.delete(templateId)
    if (deleted) {
      this.templateStats.delete(templateId)
    }
    return deleted
  }

  clearCustomTemplates(): void {
    const builtInIds = new Set(BUILT_IN_TEMPLATES.map((t) => t.id))

    for (const id of this.templates.keys()) {
      if (!builtInIds.has(id)) {
        this.templates.delete(id)
        this.templateStats.delete(id)
      }
    }
  }

  exportTemplates(includeStats = false): string {
    const data: Record<string, any> = {
      templates: Array.from(this.templates.values()),
    }

    if (includeStats) {
      data.stats = Array.from(this.templateStats.entries())
    }

    return JSON.stringify(data, null, 2)
  }

  importTemplates(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData)

      if (Array.isArray(data.templates)) {
        for (const template of data.templates) {
          this.addTemplate(template)
        }
      }

      if (Array.isArray(data.stats)) {
        for (const [id, stats] of data.stats) {
          this.templateStats.set(id, stats as any)
        }
      }
    } catch (error) {
      throw new Error(`导入模板失败: ${error}`)
    }
  }

  async loadFromFile(filePath: string): Promise<void> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf-8')
      this.importTemplates(content)
    } else {
      throw new Error('文件加载功能仅在 Node.js 环境中可用')
    }
  }

  async saveToFile(filePath: string, includeStats = true): Promise<void> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs/promises')
      const content = this.exportTemplates(includeStats)
      await fs.writeFile(filePath, content, 'utf-8')
    } else {
      throw new Error('文件保存功能仅在 Node.js 环境中可用')
    }
  }
}

export function createTemplateManager(config?: TemplateManagerConfig): ResponseTemplateManager {
  return new ResponseTemplateManager(config)
}
