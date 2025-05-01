import { Agent, type ExecutionContext } from '@yunpat/core'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchResult } from '@yunpat/agent-prior-art-search'
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
  /** 质量指标 */
  quality?: {
    clarity: number // 清晰度
    completeness: number // 完整性
    consistency: number // 一致性
  }
}

/**
 * 实施例
 */
export interface Embodiment {
  /** 实施例编号 */
  number: number
  /** 实施例标题 */
  title: string
  /** 实施例内容 */
  content: string
  /** 关联附图 */
  relatedDrawings: string[]
  /** 关键特征 */
  keyFeatures: string[]
  /** 实施例类型 */
  type: 'preferred' | 'alternative' | 'comparative'
}

/**
 * 附图说明
 */
export interface DrawingDescription {
  /** 附图编号 */
  figureNumber: string
  /** 附图标题 */
  title: string
  /** 附图内容说明 */
  description: string
  /** 关键要素标注 */
  keyElements: Array<{
    elementNumber: string
    description: string
  }>
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
    /** 有益效果列表（可量化） */
    beneficial_effects_list: Array<{
      effect: string
      metric?: string
      improvement?: string
    }>
  }
  /** 具体实施方式 */
  embodiments: SpecificationSection & {
    /** 实施例列表 */
    embodiment_list: Embodiment[]
    /** 实施方式完整性评分 */
    completeness_score: number
  }
  /** 附图说明 */
  drawings_description: SpecificationSection & {
    /** 附图列表 */
    drawings: DrawingDescription[]
  }
}

/**
 * 说明书撰写输入
 */
export interface SpecificationDrafterInput {
  /** 发明理解结果 */
  inventionUnderstanding: InventionUnderstandingOutput
  /** 先导技术检索结果 */
  priorArtSearch?: PriorArtSearchResult
  /** 权利要求集合 */
  claimsSet?: ClaimsSet
  /** 附图列表 */
  drawings?: string[]
  /** 要撰写的章节（可选，默认全部） */
  chapters?: SpecificationChapter[]
  /** 是否逐章确认 */
  enableChapterConfirmation?: boolean
  /** 撰写模式 */
  draftMode?: 'standard' | 'detailed' | 'concise'
  /** 专利类型 */
  patentType?: 'invention' | 'utilityModel' | 'design'
  /** 目标字数 */
  targetWordCount?: {
    technical_field?: number
    background_art?: number
    invention_content?: number
    embodiments?: number
    drawings_description?: number
  }
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
    /** 充分公开检查 */
    enablementCheck: boolean
    /** 支持性检查 */
    supportCheck: boolean
  }
  /** 质量评分 */
  qualityScore: {
    overall: number
    clarity: number
    completeness: number
    consistency: number
  }
  /** 置信度 */
  confidence: number
  /** 撰写元数据 */
  metadata: {
    draftMode: string
    timestamp: number
    chaptersDrafted: SpecificationChapter[]
  }
}

/**
 * 说明书撰写计划
 */
interface SpecificationPlan {
  input: SpecificationDrafterInput
  templateContent: string
  chapters: SpecificationChapter[]
  targetWordCounts: Required<NonNullable<SpecificationDrafterInput['targetWordCount']>>
}

/**
 * 说明书撰写智能体
 *
 * 功能：
 * 1. 基于发明理解、检索分析和权利要求撰写说明书
 * 2. 分5个章节撰写：技术领域、背景技术、发明内容、具体实施方式、附图说明
 * 3. 智能生成实施例（包括优选实施例、替代实施例、对比实施例）
 * 4. 自动生成附图说明和要素标注
 * 5. 确保术语统一、连贯一致、充分公开
 * 6. 支持多种撰写模式（标准/详细/简洁）
 * 7. 完整的质量检查指标
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
    // 输入验证
    this.validateInput(input)

    const { inventionUnderstanding } = input

    console.log('\n📝 [说明书撰写] 步骤1: 规划阶段')
    console.log(`   发明名称: ${inventionUnderstanding.technicalField}`)
    console.log(`   关键特征: ${inventionUnderstanding.keyFeatures.length} 个`)
    console.log(`   撰写模式: ${input.draftMode || 'standard'}`)

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

    // 确定目标字数
    const draftMode = input.draftMode || 'standard'
    const targetWordCounts = this.getTargetWordCounts(draftMode, input.targetWordCount)

    console.log(`   目标字数: ${Object.values(targetWordCounts).reduce((a, b) => a + b, 0)} 字`)

    return {
      input,
      templateContent,
      chapters,
      targetWordCounts,
    }
  }

  protected async act(
    plan: SpecificationPlan,
    context: ExecutionContext
  ): Promise<SpecificationDrafterOutput> {
    console.log('\n📝 [说明书撰写] 步骤2: 撰写阶段')

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行说明书撰写')
    }

    const { input, targetWordCounts } = plan

    // 执行撰写
    const result = await this.performDrafting(context.llm, input, targetWordCounts)

    // 质量检查
    const metrics = this.performQualityChecks(result.specification)
    result.metrics = { ...result.metrics, ...metrics }

    // 计算质量评分
    result.qualityScore = this.calculateQualityScore(result.specification)

    console.log(`\n✅ [说明书撰写] 撰写完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   总字数: ${result.metrics.totalWordCount}`)
    console.log(`   章节数: ${result.metrics.chapterCount}`)
    console.log(`   质量评分: ${result.qualityScore.overall.toFixed(1)}`)
    console.log(`   术语一致性: ${result.metrics.terminologyConsistency ? '✓' : '✗'}`)
    console.log(`   连贯性: ${result.metrics.coherenceCheck ? '✓' : '✗'}`)
    console.log(`   充分公开: ${result.metrics.enablementCheck ? '✓' : '✗'}`)

    return result
  }

  /**
   * 执行说明书撰写
   */
  private async performDrafting(
    llm: NonNullable<ExecutionContext['llm']>,
    input: SpecificationDrafterInput,
    targetWordCounts: Required<NonNullable<SpecificationDrafterInput['targetWordCount']>>
  ): Promise<SpecificationDrafterOutput> {
    const systemPrompt = this.buildSystemPrompt(input)
    const userPrompt = this.buildUserPrompt(input, targetWordCounts)

    const parseResult = await this.callLLMWithFallback(llm, systemPrompt, userPrompt)

    if (!parseResult.success) {
      console.warn('[SpecificationDrafterAgent] LLM解析失败，使用回退输出')
      return this.createFallbackOutput(input, parseResult.error)
    }

    return this.normalizeOutput(parseResult.data!, input)
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(input: SpecificationDrafterInput): string {
    const patentType = input.patentType || 'invention'
    const draftMode = input.draftMode || 'standard'

    const prompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写说明书：

## 充分公开原则（A26.3）
- 清楚：技术术语含义清晰、指向明确
- 完整：包含理解发明不可缺少的内容
- 能够实现：所属领域技术人员能够实现

## 清楚性要求
- 技术用语含义清晰
- 自造词需明确定义
- 明显错误不影响理解

## 完整性要求
- 给出具体技术手段（不只描述结果）
- 公知内容可省略
- 确定新颖性/创造性所需的内容必须完整

## 各章节撰写要求
1. 技术领域：明确发明所属技术领域（通常1段）
2. 背景技术：介绍现有技术及其缺陷（通常2-3段）
3. 发明内容：技术问题、技术方案、有益效果（通常3-5段）
4. 具体实施方式：结合附图详细描述至少一个实施例
5. 附图说明：对各幅附图做简要说明

## 撰写模式：${draftMode === 'detailed' ? '详细模式' : draftMode === 'concise' ? '简洁模式' : '标准模式'}
${draftMode === 'detailed' ? '- 提供更详细的技术描述和多个实施例' : ''}
${draftMode === 'concise' ? '- 精简表述，突出核心要点' : ''}

## 专利类型：${patentType === 'invention' ? '发明专利' : patentType === 'utilityModel' ? '实用新型' : '外观设计'}

输出必须是严格的 JSON 格式。`

    return prompt
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    input: SpecificationDrafterInput,
    targetWordCounts: Required<NonNullable<SpecificationDrafterInput['targetWordCount']>>
  ): string {
    const contextInfo = this.buildContext(input)

    const prompt = `基于以下信息撰写专利说明书：

${contextInfo}

## 目标字数要求
- 技术领域: ${targetWordCounts.technical_field} 字
- 背景技术: ${targetWordCounts.background_art} 字
- 发明内容: ${targetWordCounts.invention_content} 字
- 具体实施方式: ${targetWordCounts.embodiments} 字
- 附图说明: ${targetWordCounts.drawings_description} 字

请按章节输出以下 JSON 格式：

{
  "technical_field": {
    "chapter": "技术领域",
    "title": "技术领域",
    "content": "技术领域内容...",
    "wordCount": 实际字数,
    "quality": {
      "clarity": 清晰度评分,
      "completeness": 完整性评分,
      "consistency": 一致性评分
    }
  },
  "background_art": {
    "chapter": "背景技术",
    "title": "背景技术",
    "content": "背景技术内容...",
    "wordCount": 实际字数,
    "quality": { ... }
  },
  "invention_content": {
    "chapter": "发明内容",
    "title": "发明内容",
    "content": "发明内容详细描述",
    "wordCount": 实际字数,
    "technical_problem": "要解决的技术问题",
    "technical_solution": "技术方案详细描述",
    "beneficial_effects": "有益效果总体描述",
    "beneficial_effects_list": [
      {
        "effect": "效果1",
        "metric": "性能指标",
        "improvement": "提升百分比"
      }
    ],
    "quality": { ... }
  },
  "embodiments": {
    "chapter": "具体实施方式",
    "title": "具体实施方式",
    "content": "具体实施方式总体描述",
    "wordCount": 实际字数,
    "embodiment_list": [
      {
        "number": 1,
        "title": "实施例1标题",
        "content": "实施例1详细描述",
        "relatedDrawings": ["图1"],
        "keyFeatures": ["特征1", "特征2"],
        "type": "preferred"
      }
    ],
    "completeness_score": 充分性评分,
    "quality": { ... }
  },
  "drawings_description": {
    "chapter": "附图说明",
    "title": "附图说明",
    "content": "附图说明总体描述",
    "wordCount": 实际字数,
    "drawings": [
      {
        "figureNumber": "图1",
        "title": "附图1标题",
        "description": "附图1详细说明",
        "keyElements": [
          {
            "elementNumber": "1",
            "description": "要素1说明"
          }
        ]
      }
    ],
    "quality": { ... }
  },
  "confidence": 置信度
}
`

    return prompt
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
      claimsSet.independent_claims?.forEach((claim: any) => {
        sections.push(claim.full_text || claim.content)
      })
      sections.push('### 从属权利要求')
      claimsSet.dependent_claims?.forEach((claim: any) => {
        sections.push(claim.content)
      })
    }

    // 检索分析（如果有）
    if (priorArtSearch?.comparisonAnalysis) {
      sections.push('\n## 先导技术分析')
      sections.push(`### 最接近的现有技术`)
      sections.push(priorArtSearch.comparisonAnalysis.closestPriorArt?.title || '无')
      sections.push(`### 区别特征`)
      priorArtSearch.comparisonAnalysis.differences?.forEach((diff: string) => {
        sections.push(`- ${diff}`)
      })
      sections.push(`### 实际解决的技术问题`)
      sections.push(priorArtSearch.comparisonAnalysis.technicalProblemSolved || '无')
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
   * 带重试的LLM调用
   */
  private async callLLMWithFallback(
    llm: NonNullable<ExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
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
          timeout: 300000, // 5分钟超时 - 说明书撰写需要更长时间
        })

        const content = response.message.content
        const parsed = this.safeParseJSON(content)

        if (parsed) {
          return { success: true, data: parsed }
        }

        lastError = new Error('无法解析JSON响应')
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(
          `[SpecificationDrafterAgent] LLM 调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
        )

        if (attempt < maxRetries) {
          await this.sleep(1000 * (attempt + 1))
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || '未知错误',
    }
  }

  /**
   * 标准化输出
   */
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
    const technical_field: SpecificationSection = this.parseSection('technical_field', parsed)
    const background_art: SpecificationSection = this.parseSection('background_art', parsed)

    const invention_content_raw = parsed.invention_content as Record<string, unknown> | undefined
    const invention_content: SpecificationSection & {
      technical_problem: string
      technical_solution: string
      beneficial_effects: string
      beneficial_effects_list: Array<{ effect: string; metric?: string; improvement?: string }>
    } = {
      ...this.parseSection('invention_content', parsed),
      technical_problem: invention_content_raw ? getString('technical_problem') : '',
      technical_solution: invention_content_raw ? getString('technical_solution') : '',
      beneficial_effects: invention_content_raw ? getString('beneficial_effects') : '',
      beneficial_effects_list: this.parseBeneficialEffectsList(
        invention_content_raw?.beneficial_effects_list
      ),
    }

    const embodiments_raw = parsed.embodiments as Record<string, unknown> | undefined
    const embodiments: SpecificationSection & {
      embodiment_list: Embodiment[]
      completeness_score: number
    } = {
      ...this.parseSection('embodiments', parsed),
      embodiment_list: this.parseEmbodimentList(embodiments_raw?.embodiment_list),
      completeness_score: embodiments_raw ? getNumber('completeness_score', 0.8) : 0.8,
    }

    const drawings_description_raw = parsed.drawings_description as
      | Record<string, unknown>
      | undefined
    const drawings_description: SpecificationSection & {
      drawings: DrawingDescription[]
    } = {
      ...this.parseSection('drawings_description', parsed),
      drawings: this.parseDrawingsList(drawings_description_raw?.drawings, input.drawings),
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

    const draftMode = input.draftMode || 'standard'

    return {
      specification,
      metrics: {
        totalWordCount,
        chapterCount: 5,
        terminologyConsistency: true, // 将在质量检查中更新
        coherenceCheck: true,
        enablementCheck: true,
        supportCheck: true,
      },
      qualityScore: {
        overall: 0.8,
        clarity: 0.8,
        completeness: 0.8,
        consistency: 0.8,
      },
      confidence: getNumber('confidence', 0.85),
      metadata: {
        draftMode,
        timestamp: Date.now(),
        chaptersDrafted: input.chapters || [
          'technical_field',
          'background_art',
          'invention_content',
          'embodiments',
          'drawings_description',
        ],
      },
    }
  }

  /**
   * 解析章节
   */
  private parseSection(key: string, parsed: Record<string, unknown>): SpecificationSection {
    const section = parsed[key] as Record<string, unknown> | undefined

    if (!section) {
      return {
        chapter: key,
        title: key,
        content: '',
        wordCount: 0,
      }
    }

    return {
      chapter: this.getString(section, 'chapter', key),
      title: this.getString(section, 'title', key),
      content: this.getString(section, 'content', ''),
      wordCount: this.getNumber(section, 'wordCount', 0),
      quality: section.quality
        ? {
            clarity: this.getNumber(section.quality as Record<string, unknown>, 'clarity', 0.8),
            completeness: this.getNumber(
              section.quality as Record<string, unknown>,
              'completeness',
              0.8
            ),
            consistency: this.getNumber(
              section.quality as Record<string, unknown>,
              'consistency',
              0.8
            ),
          }
        : undefined,
    }
  }

  /**
   * 解析有益效果列表
   */
  private parseBeneficialEffectsList(
    data: unknown
  ): Array<{ effect: string; metric?: string; improvement?: string }> {
    if (!Array.isArray(data)) return []

    return data.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        return { effect: String(item) }
      }
      const itemObj = item as Record<string, unknown>
      return {
        effect: this.getString(itemObj, 'effect', ''),
        metric: itemObj.metric ? String(itemObj.metric) : undefined,
        improvement: itemObj.improvement ? String(itemObj.improvement) : undefined,
      }
    })
  }

  /**
   * 解析实施例列表
   */
  private parseEmbodimentList(data: unknown): Embodiment[] {
    if (!Array.isArray(data)) return []

    return data.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        return {
          number: 1,
          title: '实施例',
          content: String(item),
          relatedDrawings: [],
          keyFeatures: [],
          type: 'preferred' as const,
        }
      }

      const itemObj = item as Record<string, unknown>
      return {
        number: this.getNumber(itemObj, 'number', 1),
        title: this.getString(itemObj, 'title', '实施例'),
        content: this.getString(itemObj, 'content', ''),
        relatedDrawings: this.getStringArray(itemObj, 'relatedDrawings'),
        keyFeatures: this.getStringArray(itemObj, 'keyFeatures'),
        type:
          itemObj.type === 'alternative'
            ? 'alternative'
            : itemObj.type === 'comparative'
              ? 'comparative'
              : 'preferred',
      }
    })
  }

  /**
   * 解析附图列表
   */
  private parseDrawingsList(data: unknown, inputDrawings?: string[]): DrawingDescription[] {
    if (!Array.isArray(data)) {
      // 如果没有返回附图，使用输入中的附图
      return (inputDrawings || []).map((d, i) => ({
        figureNumber: `图${i + 1}`,
        title: `附图${i + 1}`,
        description: d,
        keyElements: [],
      }))
    }

    return data.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        return {
          figureNumber: `图${Array.isArray(data) ? data.indexOf(item) + 1 : 1}`,
          title: '附图',
          description: String(item),
          keyElements: [],
        }
      }

      const itemObj = item as Record<string, unknown>
      const keyElements = itemObj.keyElements as unknown[] | undefined
      return {
        figureNumber: this.getString(itemObj, 'figureNumber', ''),
        title: this.getString(itemObj, 'title', '附图'),
        description: this.getString(itemObj, 'description', ''),
        keyElements: (keyElements || []).map((el: unknown) => {
          if (typeof el !== 'object' || el === null) {
            return { elementNumber: '', description: String(el) }
          }
          const elObj = el as Record<string, unknown>
          return {
            elementNumber: this.getString(elObj, 'elementNumber', ''),
            description: this.getString(elObj, 'description', ''),
          }
        }),
      }
    })
  }

  /**
   * 执行质量检查
   */
  private performQualityChecks(
    specification: SpecificationContent
  ): Partial<SpecificationDrafterOutput['metrics']> {
    // 术语一致性检查
    const terminologyConsistency = this.checkTerminologyConsistency(specification)

    // 连贯性检查
    const coherenceCheck = this.checkCoherence(specification)

    // 充分公开检查
    const enablementCheck = this.checkEnablement(specification)

    // 支持性检查
    const supportCheck = this.checkSupport(specification)

    return {
      terminologyConsistency,
      coherenceCheck,
      enablementCheck,
      supportCheck,
    }
  }

  /**
   * 术语一致性检查
   */
  private checkTerminologyConsistency(specification: SpecificationContent): boolean {
    // 提取各章节中的技术术语
    const extractTerms = (text: string): Set<string> => {
      const terms = text.match(/[一-龥]{2,4}(?:装置|设备|系统|方法|模块|单元)/g) || []
      return new Set(terms)
    }

    const fieldTerms = extractTerms(specification.technical_field.content)
    const contentTerms = extractTerms(specification.invention_content.content)
    const embodimentTerms = extractTerms(specification.embodiments.content)

    // 检查术语一致性
    const allTerms = new Set([...fieldTerms, ...contentTerms, ...embodimentTerms])

    // 如果有超过5个术语，检查是否有不一致
    if (allTerms.size > 5) {
      const intersection = new Set([...fieldTerms].filter((x) => contentTerms.has(x)))
      return intersection.size >= Math.min(fieldTerms.size, contentTerms.size) * 0.7
    }

    return true
  }

  /**
   * 连贯性检查
   */
  private checkCoherence(specification: SpecificationContent): boolean {
    // 检查各章节之间是否有逻辑连贯性
    const { technical_problem, technical_solution, beneficial_effects } =
      specification.invention_content

    // 基本检查：各字段都不为空
    if (!technical_problem || !technical_solution || !beneficial_effects) {
      return false
    }

    // 检查技术方案是否与技术问题相关
    const problemWords = new Set(technical_problem.match(/[一-龥]{2,}/g) || [])
    const solutionWords = new Set(technical_solution.match(/[一-龥]{2,}/g) || [])

    let overlap = 0
    problemWords.forEach((word) => {
      if (solutionWords.has(word)) overlap++
    })

    return overlap > 0
  }

  /**
   * 充分公开检查
   */
  private checkEnablement(specification: SpecificationContent): boolean {
    const { embodiments, invention_content } = specification

    // 检查实施方式是否足够详细
    if (embodiments.wordCount < 300) {
      return false
    }

    // 检查是否有实施例
    if (!embodiments.embodiment_list || embodiments.embodiment_list.length === 0) {
      return false
    }

    // 检查实施例是否包含关键特征
    const hasKeyFeatures = embodiments.embodiment_list.some(
      (emb) => emb.keyFeatures && emb.keyFeatures.length > 0
    )

    return hasKeyFeatures
  }

  /**
   * 支持性检查
   */
  private checkSupport(specification: SpecificationContent): boolean {
    const { embodiments, invention_content } = specification

    // 检查实施方式是否支持发明内容中的技术方案
    const solutionWords = new Set(invention_content.technical_solution.match(/[一-龥]{2,}/g) || [])
    const embodimentWords = new Set(embodiments.content.match(/[一-龥]{2,}/g) || [])

    let overlap = 0
    solutionWords.forEach((word) => {
      if (embodimentWords.has(word)) overlap++
    })

    return overlap >= Math.min(solutionWords.size, 5)
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(
    specification: SpecificationContent
  ): SpecificationDrafterOutput['qualityScore'] {
    // 计算各章节质量
    const calculateSectionQuality = (section: SpecificationSection): number => {
      if (!section.quality) return 0.8
      return (
        (section.quality.clarity + section.quality.completeness + section.quality.consistency) / 3
      )
    }

    const technicalFieldQuality = calculateSectionQuality(specification.technical_field)
    const backgroundArtQuality = calculateSectionQuality(specification.background_art)
    const inventionContentQuality = calculateSectionQuality(specification.invention_content)
    const embodimentsQuality = calculateSectionQuality(specification.embodiments)
    const drawingsQuality = calculateSectionQuality(specification.drawings_description)

    const overall =
      technicalFieldQuality * 0.1 +
      backgroundArtQuality * 0.15 +
      inventionContentQuality * 0.3 +
      embodimentsQuality * 0.35 +
      drawingsQuality * 0.1

    return {
      overall,
      clarity: (technicalFieldQuality + inventionContentQuality + embodimentsQuality) / 3,
      completeness: (backgroundArtQuality + inventionContentQuality + embodimentsQuality) / 3,
      consistency: (technicalFieldQuality + inventionContentQuality) / 2,
    }
  }

  /**
   * 获取目标字数
   */
  private getTargetWordCounts(
    draftMode: string,
    customTargets?: SpecificationDrafterInput['targetWordCount']
  ): Required<NonNullable<SpecificationDrafterInput['targetWordCount']>> {
    if (customTargets) {
      return {
        technical_field: customTargets.technical_field ?? 100,
        background_art: customTargets.background_art ?? 300,
        invention_content: customTargets.invention_content ?? 800,
        embodiments: customTargets.embodiments ?? 1500,
        drawings_description: customTargets.drawings_description ?? 200,
      }
    }

    const multipliers: Record<string, number> = {
      detailed: 1.5,
      standard: 1.0,
      concise: 0.6,
    }

    const multiplier = multipliers[draftMode] ?? 1.0

    return {
      technical_field: Math.round(100 * multiplier),
      background_art: Math.round(300 * multiplier),
      invention_content: Math.round(800 * multiplier),
      embodiments: Math.round(1500 * multiplier),
      drawings_description: Math.round(200 * multiplier),
    }
  }

  /**
   * 创建回退输出
   */
  private createFallbackOutput(
    input: SpecificationDrafterInput,
    error?: string
  ): SpecificationDrafterOutput {
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
        beneficial_effects_list: [],
      },
      embodiments: {
        chapter: '具体实施方式',
        title: '具体实施方式',
        content: '本发明的具体实施方式将结合附图进行详细描述。',
        wordCount: 30,
        embodiment_list: [],
        completeness_score: 0.3,
      },
      drawings_description: {
        chapter: '附图说明',
        title: '附图说明',
        content: input.drawings?.map((d, i) => `图${i + 1}: ${d}`).join('\n') || '无',
        wordCount: input.drawings?.join('\n').length || 0,
        drawings:
          input.drawings?.map((d, i) => ({
            figureNumber: `图${i + 1}`,
            title: `附图${i + 1}`,
            description: d,
            keyElements: [],
          })) || [],
      },
    }

    return {
      specification,
      metrics: {
        totalWordCount: 500,
        chapterCount: 5,
        terminologyConsistency: false,
        coherenceCheck: false,
        enablementCheck: false,
        supportCheck: false,
      },
      qualityScore: {
        overall: 0.5,
        clarity: 0.5,
        completeness: 0.5,
        consistency: 0.5,
      },
      confidence: 0.5,
      metadata: {
        draftMode: input.draftMode || 'standard',
        timestamp: Date.now(),
        chaptersDrafted: [],
      },
    }
  }

  /**
   * 验证输入
   */
  private validateInput(input: SpecificationDrafterInput): void {
    if (!input.inventionUnderstanding) {
      throw new Error('发明理解结果不能为空')
    }
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

  /**
   * 辅助方法：获取字符串
   */
  private getString(obj: Record<string, unknown>, key: string, fallback: string): string {
    const value = obj[key]
    return typeof value === 'string' ? value : fallback
  }

  /**
   * 辅助方法：获取数字
   */
  private getNumber(obj: Record<string, unknown>, key: string, fallback: number): number {
    const value = obj[key]
    return typeof value === 'number' && !isNaN(value) ? value : fallback
  }

  /**
   * 辅助方法：获取字符串数组
   */
  private getStringArray(obj: Record<string, unknown>, key: string): string[] {
    const value = obj[key]
    if (!Array.isArray(value)) return []
    return value.filter((v): v is string => typeof v === 'string')
  }

  /**
   * 安全解析JSON
   */
  protected safeParseJSON(content: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(content)
      return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch {
      // 尝试提取JSON块
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1] || jsonMatch[0])
        } catch {
          return null
        }
      }
      return null
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
