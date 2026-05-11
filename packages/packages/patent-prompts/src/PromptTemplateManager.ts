import { readFile } from 'fs/promises'
import { join } from 'path'

export interface PromptTemplate {
  name: string
  description: string
  content: string
  variables: string[]
  loadedAt: Date
}

export interface TemplateLoadStrategy {
  preload?: string[]
  onDemand?: string[]
  lazy?: string[]
}

export interface KnowledgeBridge {
  queryByConcept(concept: string): Promise<string[]>
  readWikiPage(page: string): Promise<string>
  vectorSearchLaw?(query: string, topK?: number): Promise<string[]>
  searchInvalidDecisions?(query: string, topK?: number): Promise<string[]>
  searchPatentRules?(query: string, topK?: number): Promise<string[]>
  queryKnowledgeGraph?(query: string, options?: Record<string, unknown>): Promise<string[]>
}

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map()
  private templateDir: string
  private loadStrategy: Map<string, TemplateLoadStrategy>

  constructor(templateDir?: string) {
    this.templateDir =
      templateDir || process.env.PROMPT_TEMPLATES_DIR || './prompts/patent-drafting'
    this.loadStrategy = new Map()
    this.initializeLoadStrategy()
  }

  private initializeLoadStrategy() {
    this.loadStrategy.set('invention-understanding', {
      preload: ['03-creativity-analysis'],
    })

    this.loadStrategy.set('claims-generation', {
      onDemand: ['01-claims-generation'],
    })

    this.loadStrategy.set('specification-drafting', {
      onDemand: ['02-specification-drafting'],
    })

    this.loadStrategy.set('quality-assessment', {
      lazy: ['01-claims-generation', '02-specification-drafting', '03-creativity-analysis'],
    })

    this.loadStrategy.set('full-drafting', {
      preload: ['01-claims-generation'],
      onDemand: ['02-specification-drafting', '03-creativity-analysis'],
    })
  }

  async preload(stage: string): Promise<void> {
    const strategy = this.loadStrategy.get(stage)
    if (!strategy || !strategy.preload) {
      return
    }

    console.log(`[PromptTemplateManager] 预加载模板: ${strategy.preload.join(', ')}`)

    for (const templateName of strategy.preload) {
      await this.loadTemplate(templateName)
    }
  }

  async loadTemplate(templateName: string): Promise<PromptTemplate> {
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!
    }

    console.log(`[PromptTemplateManager] 加载模板: ${templateName}`)

    const templatePath = join(this.templateDir, `${templateName}.md`)
    const content = await readFile(templatePath, 'utf-8')

    const variableMatches = content.match(/\{\{(\w+)\}\}/g) || []
    const variables = variableMatches.map((v) => v.replace(/[{}]/g, ''))

    const template: PromptTemplate = {
      name: templateName,
      description: this.extractDescription(content),
      content,
      variables,
      loadedAt: new Date(),
    }

    this.templates.set(templateName, template)

    return template
  }

  async loadTemplates(templateNames: string[]): Promise<void> {
    await Promise.all(templateNames.map((name) => this.loadTemplate(name)))
  }

  render(templateName: string, variables: Record<string, unknown>): string {
    const template = this.templates.get(templateName)
    if (!template) {
      throw new Error(`模板 ${templateName} 未加载，请先调用 loadTemplate()`)
    }

    let rendered = template.content

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      rendered = rendered.replace(regex, String(value))
    }

    return rendered
  }

  isLoaded(templateName: string): boolean {
    return this.templates.has(templateName)
  }

  unload(templateName: string): void {
    this.templates.delete(templateName)
    console.log(`[PromptTemplateManager] 卸载模板: ${templateName}`)
  }

  unloadAll(): void {
    const count = this.templates.size
    this.templates.clear()
    console.log(`[PromptTemplateManager] 卸载所有模板: ${count}个`)
  }

  getLoadedTemplates(): string[] {
    return Array.from(this.templates.keys())
  }

  getCacheStats() {
    return {
      templates: this.templates.size,
      loadedAt: Array.from(this.templates.values()).map((t) => ({
        name: t.name,
        loadedAt: t.loadedAt,
      })),
    }
  }

  private extractDescription(content: string): string {
    const match = content.match(/^# (.+)$/m)
    return match ? match[1] : ''
  }

  async extractFromKnowledge(knowledgeBridge: KnowledgeBridge, concept: string): Promise<string> {
    console.log(`[PromptTemplateManager] 从知识库提炼: ${concept}`)

    const relatedPages = await knowledgeBridge.queryByConcept(concept)
    const contents = await Promise.all(
      relatedPages.map((page) => knowledgeBridge.readWikiPage(page))
    )

    const prompt = `
# ${concept}提示词模板

> 从知识库自动提炼
> 提炼时间：${new Date().toISOString()}

## 知识来源

${relatedPages.map((page) => `- [[${page}]]`).join('\n')}

## 核心知识

${contents.join('\n\n---\n\n')}

---

*本模板基于${contents.length}个知识页面提炼*
    `

    return prompt
  }
}
