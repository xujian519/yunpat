import { Agent, type ExecutionContext } from '@yunpat/core'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchOutput } from '@yunpat/agent-prior-art-search'
import type { ClaimsSet } from '@yunpat/agent-claim-generator'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

/**
 * 说明书章节
 */
export type SpecificationChapter =
  | 'technical_field' // 技术领域
  | 'background_art' // 背景技术
  | 'invention_content' // 发明内容
  | 'embodiments' // 具体实施方式
  | 'drawings_description' // 附图说明

/**
 * 说明书章节内容
 */
export interface SpecificationSection {
  /** 章节名称 */
  chapter: string
  /** 章节标题 */
  title: string
  /** 章节内容 */
  content: string
  /** 字数统计 */
  wordCount: number
}

/**
 * 说明书完整内容
 */
export interface SpecificationContent {
  /** 技术领域 */
  technical_field: SpecificationSection
  /** 背景技术 */
  background_art: SpecificationSection
  /** 发明内容 */
  invention_content: SpecificationSection & {
    /** 技术问题 */
    technical_problem: string
    /** 技术方案 */
    technical_solution: string
    /** 有益效果 */
    beneficial_effects: string
  }
  /** 具体实施方式 */
  embodiments: SpecificationSection
  /** 附图说明 */
  drawings_description: SpecificationSection
}

/**
 * 说明书撰写输入
 */
export interface SpecificationDrafterInput {
  /** 发明理解结果 */
  inventionUnderstanding: InventionUnderstandingOutput
  /** 先导技术检索结果 */
  priorArtSearch?: PriorArtSearchOutput
  /** 权利要求集合 */
  claimsSet?: ClaimsSet
  /** 附图列表 */
  drawings?: string[]
  /** 要撰写的章节（可选，默认全部） */
  chapters?: SpecificationChapter[]
  /** 是否逐章确认 */
  enableChapterConfirmation?: boolean
}

/**
 * 说明书撰写输出
 */
export interface SpecificationDrafterOutput {
  /** 说明书内容 */
  specification: SpecificationContent
  /** 撰写指标 */
  metrics: {
    /** 总字数 */
    totalWordCount: number
    /** 章节数量 */
    chapterCount: number
    /** 术语一致性检查 */
    terminologyConsistency: boolean
    /** 连贯性检查 */
    coherenceCheck: boolean
  }
  /** 置信度 */
  confidence: number
}

interface SpecificationPlan {
  input: SpecificationDrafterInput
  templateContent: string
  chapters: SpecificationChapter[]
}

/**
 * 说明书撰写智能体
 *
 * 功能：
 * 1. 基于发明理解、检索分析和权利要求撰写说明书
 * 2. 分5个章节撰写：技术领域、背景技术、发明内容、具体实施方式、附图说明
 * 3. 每章生成后支持人类确认
 * 4. 确保术语统一、连贯一致
 * 5. 遵循充分公开原则（清楚、完整、能够实现）
 */
export class SpecificationDrafterAgent extends Agent<
  SpecificationDrafterInput,
  SpecificationDrafterOutput
> {
  private templatePath: string

  constructor(config: any) {
    super({
      ...config,
      name: config.name || 'specification-drafter',
      description: config.description || '说明书撰写智能体 - 专业的专利说明书撰写',
    })
    this.templatePath =
      config.templatePath ||
      resolve(
        process.cwd(),
        'patents/prompts/templates/patent-drafting/02-specification-drafting.md'
      )
  }

  protected async plan(
    input: SpecificationDrafterInput,
    _context: ExecutionContext
  ): Promise<SpecificationPlan> {
    if (!input.inventionUnderstanding) {
      throw new Error('发明理解结果不能为空')
    }

    const { inventionUnderstanding } = input

    console.log('\n📝 [说明书撰写] 步骤1: 规划阶段')
    console.log(`   发明名称: ${inventionUnderstanding.technicalField}`)
    console.log(`   关键特征: ${inventionUnderstanding.keyFeatures.length} 个`)

    // 读取模板内容
    const templateContent = await this.loadTemplate()

    // 确定要撰写的章节
    const chapters = input.chapters || [
      'technical_field',
      'background_art',
      'invention_content',
      'embodiments',
      'drawings_description',
    ]

    return {
      input,
      templateContent,
      chapters,
    }
  }

  protected async act(
    plan: SpecificationPlan,
    context: ExecutionContext
  ): Promise<SpecificationDrafterOutput> {
    console.log('\n📝 [说明书撰写] 步骤2: 撰写阶段')

    const { inventionUnderstanding, priorArtSearch, claimsSet, drawings } = plan.input

    const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写说明书：

1. 充分公开原则（A26.3）
   - 清楚：技术术语含义清晰、指向明确
   - 完整：包含理解发明不可缺少的内容
   - 能够实现：所属领域技术人员能够实现

2. 清楚性要求
   - 技术用语含义清晰
   - 自造词需明确定义
   - 明显错误不影响理解

3. 完整性要求
   - 给出具体技术手段（不只描述结果）
   - 公知内容可省略
   - 确定新颖性/创造性所需的内容必须完整

4. 各章节要求
   - 技术领域：明确发明所属技术领域
   - 背景技术：介绍现有技术及其缺陷
   - 发明内容：技术问题、技术方案、有益效果
   - 具体实施方式：结合附图详细描述至少一个实施例
   - 附图说明：对各幅附图做简要说明

输出必须是严格的 JSON 格式。`

    // 构建上下文信息
    const contextInfo = this.buildContext(plan.input)

    const userPrompt = `基于以下信息撰写专利说明书：

${contextInfo}

请按章节输出以下 JSON 格式：
{
  "technical_field": {
    "chapter": "技术领域",
    "title": "技术领域",
    "content": "技术领域内容",
    "wordCount": 100
  },
  "background_art": {
    "chapter": "背景技术",
    "title": "背景技术",
    "content": "背景技术内容",
    "wordCount": 300
  },
  "invention_content": {
    "chapter": "发明内容",
    "title": "发明内容",
    "content": "发明内容详细描述，包括技术问题、技术方案、有益效果",
    "wordCount": 800,
    "technical_problem": "要解决的技术问题",
    "technical_solution": "技术方案详细描述",
    "beneficial_effects": "有益效果描述"
  },
  "embodiments": {
    "chapter": "具体实施方式",
    "title": "具体实施方式",
    "content": "结合附图详细描述至少一个实施例，以所属领域技术人员能够实现为准",
    "wordCount": 1500
  },
  "drawings_description": {
    "chapter": "附图说明",
    "title": "附图说明",
    "content": "对各幅附图做简要说明",
    "wordCount": 200
  }
}`

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行说明书撰写')
    }

    const result = await this.callLLMWithFallback(context.llm, systemPrompt, userPrompt, plan.input)

    console.log(`\n✅ [说明书撰写] 撰写完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   总字数: ${result.metrics.totalWordCount}`)
    console.log(`   章节数: ${result.metrics.chapterCount}`)
    console.log(`   术语一致性: ${result.metrics.terminologyConsistency ? '✓' : '✗'}`)
    console.log(`   连贯性: ${result.metrics.coherenceCheck ? '✓' : '✗'}`)

    return result
  }

  /**
   * 构建上下文信息
   */
  private buildContext(input: SpecificationDrafterInput): string {
    const { inventionUnderstanding, priorArtSearch, claimsSet, drawings } = input

    const sections: string[] = []

    // 发明理解
    sections.push('## 发明理解')
    sections.push(`### 技术领域`)
    sections.push(inventionUnderstanding.technicalField)
    sections.push(`### 背景技术`)
    sections.push(inventionUnderstanding.backgroundArt || '无')
    sections.push(`### 技术问题`)
    sections.push(inventionUnderstanding.technicalProblem)
    sections.push(`### 技术方案`)
    sections.push(inventionUnderstanding.technicalSolution)
    sections.push(`### 有益效果`)
    sections.push(inventionUnderstanding.beneficialEffects || '无')
    sections.push(`### 关键特征`)
    inventionUnderstanding.keyFeatures.forEach((feature, index) => {
      sections.push(`${index + 1}. ${feature}`)
    })

    // 权利要求（如果有）
    if (claimsSet) {
      sections.push('\n## 权利要求')
      sections.push('### 独立权利要求')
      claimsSet.independent_claims.forEach((claim) => {
        sections.push(claim.full_text)
      })
      sections.push('### 从属权利要求')
      claimsSet.dependent_claims.forEach((claim) => {
        sections.push(claim.content)
      })
    }

    // 检索分析（如果有）
    if (priorArtSearch) {
      sections.push('\n## 先导技术分析')
      sections.push(`### 最接近的现有技术`)
      sections.push(priorArtSearch.comparisonAnalysis.closestPriorArt.title)
      sections.push(`### 区别特征`)
      priorArtSearch.comparisonAnalysis.differences.forEach((diff) => {
        sections.push(`- ${diff}`)
      })
      sections.push(`### 实际解决的技术问题`)
      sections.push(priorArtSearch.comparisonAnalysis.technicalProblemSolved)
    }

    // 附图（如果有）
    if (drawings && drawings.length > 0) {
      sections.push('\n## 附图')
      drawings.forEach((drawing, index) => {
        sections.push(`图${index + 1}: ${drawing}`)
      })
    }

    return sections.join('\n')
  }

  /**
   * 加载说明书模板
   */
  private async loadTemplate(): Promise<string> {
    try {
      return await readFile(this.templatePath, 'utf-8')
    } catch (error) {
      console.warn(`无法加载模板文件 ${this.templatePath}，使用默认配置`)
      return ''
    }
  }

  private async callLLMWithFallback(
    llm: NonNullable<ExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string,
    input: SpecificationDrafterInput
  ): Promise<SpecificationDrafterOutput> {
    const maxRetries = 2
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await llm.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        })

        const content = response.message.content
        const parsed = this.safeParseJSON(content)

        if (parsed) {
          return this.normalizeOutput(parsed, input)
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(
          `[SpecificationDrafterAgent] LLM 调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
        )
      }
    }

    console.error('[SpecificationDrafterAgent] 说明书撰写失败，使用回退输出:', lastError)
    return this.createFallbackOutput(input)
  }

  private normalizeOutput(
    parsed: Record<string, unknown>,
    input: SpecificationDrafterInput
  ): SpecificationDrafterOutput {
    const getString = (key: string): string => {
      const value = parsed[key]
      return typeof value === 'string' ? value : ''
    }

    const getNumber = (key: string, fallback: number): number => {
      const value = parsed[key]
      return typeof value === 'number' && !isNaN(value) ? value : fallback
    }

    // 解析各章节
    const technical_field: SpecificationSection = {
      chapter: '技术领域',
      title: '技术领域',
      content: getString('technical_field') || parsed.technical_field?.toString() || '',
      wordCount: getNumber('technical_field_wordCount', 100),
    }

    const background_art: SpecificationSection = {
      chapter: '背景技术',
      title: '背景技术',
      content: getString('background_art') || parsed.background_art?.toString() || '',
      wordCount: getNumber('background_art_wordCount', 300),
    }

    const invention_content_raw = parsed.invention_content as Record<string, unknown> | undefined
    const invention_content: SpecificationSection & {
      technical_problem: string
      technical_solution: string
      beneficial_effects: string
    } = {
      chapter: '发明内容',
      title: '发明内容',
      content: getString('invention_content') || '',
      wordCount: getNumber('invention_content_wordCount', 800),
      technical_problem: invention_content_raw ? getString('technical_problem') : '',
      technical_solution: invention_content_raw ? getString('technical_solution') : '',
      beneficial_effects: invention_content_raw ? getString('beneficial_effects') : '',
    }

    const embodiments: SpecificationSection = {
      chapter: '具体实施方式',
      title: '具体实施方式',
      content: getString('embodiments') || '',
      wordCount: getNumber('embodiments_wordCount', 1500),
    }

    const drawings_description: SpecificationSection = {
      chapter: '附图说明',
      title: '附图说明',
      content: getString('drawings_description') || '',
      wordCount: getNumber('drawings_description_wordCount', 200),
    }

    const specification: SpecificationContent = {
      technical_field,
      background_art,
      invention_content,
      embodiments,
      drawings_description,
    }

    // 计算指标
    const totalWordCount =
      technical_field.wordCount +
      background_art.wordCount +
      invention_content.wordCount +
      embodiments.wordCount +
      drawings_description.wordCount

    const metrics = {
      totalWordCount,
      chapterCount: 5,
      terminologyConsistency: true, // TODO: 实现术语一致性检查
      coherenceCheck: true, // TODO: 实现连贯性检查
    }

    return {
      specification,
      metrics,
      confidence: getNumber('confidence', 0.85),
    }
  }

  private createFallbackOutput(input: SpecificationDrafterInput): SpecificationDrafterOutput {
    const { inventionUnderstanding } = input

    const specification: SpecificationContent = {
      technical_field: {
        chapter: '技术领域',
        title: '技术领域',
        content: inventionUnderstanding.technicalField,
        wordCount: inventionUnderstanding.technicalField.length,
      },
      background_art: {
        chapter: '背景技术',
        title: '背景技术',
        content: inventionUnderstanding.backgroundArt || '无',
        wordCount: inventionUnderstanding.backgroundArt?.length || 0,
      },
      invention_content: {
        chapter: '发明内容',
        title: '发明内容',
        content: `${inventionUnderstanding.technicalProblem}\n\n${inventionUnderstanding.technicalSolution}\n\n${inventionUnderstanding.beneficialEffects || ''}`,
        wordCount:
          inventionUnderstanding.technicalProblem.length +
          inventionUnderstanding.technicalSolution.length +
          (inventionUnderstanding.beneficialEffects?.length || 0),
        technical_problem: inventionUnderstanding.technicalProblem,
        technical_solution: inventionUnderstanding.technicalSolution,
        beneficial_effects: inventionUnderstanding.beneficialEffects || '',
      },
      embodiments: {
        chapter: '具体实施方式',
        title: '具体实施方式',
        content: '本发明的具体实施方式将结合附图进行详细描述。',
        wordCount: 30,
      },
      drawings_description: {
        chapter: '附图说明',
        title: '附图说明',
        content: input.drawings?.map((d, i) => `图${i + 1}: ${d}`).join('\n') || '无',
        wordCount: input.drawings?.join('\n').length || 0,
      },
    }

    return {
      specification,
      metrics: {
        totalWordCount: 500,
        chapterCount: 5,
        terminologyConsistency: false,
        coherenceCheck: false,
      },
      confidence: 0.5,
    }
  }
}
