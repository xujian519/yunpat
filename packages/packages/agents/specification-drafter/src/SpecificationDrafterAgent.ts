import { Agent, type ExecutionContext } from '@yunpat/core'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type {
  SpecificationDrafterInput,
  SpecificationDrafterOutput,
  SpecificationPlan,
  SpecificationContent,
} from './SpecTypes.js'
import {
  normalizeOutput,
  getTargetWordCounts,
  createFallbackOutput,
} from './SpecOutputProcessor.js'
import {
  checkTerminologyConsistency,
  checkCoherence,
  checkEnablement,
  checkSupport,
  calculateQualityScore,
} from './SpecQualityChecker.js'

// Re-export types for backward compatibility
export type {
  SpecificationDrafterInput,
  SpecificationDrafterOutput,
  SpecificationContent,
  SpecificationSection,
  SpecificationChapter,
} from './SpecTypes.js'

/**
 * 说明书撰写智能体
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
    this.validateInput(input)

    const { inventionUnderstanding } = input

    console.log('\n📝 [说明书撰写] 步骤1: 规划阶段')
    console.log(`   发明名称: ${inventionUnderstanding.technicalField}`)
    console.log(`   关键特征: ${inventionUnderstanding.keyFeatures.length} 个`)
    console.log(`   撰写模式: ${input.draftMode || 'standard'}`)

    const templateContent = await this.loadTemplate()

    const chapters = input.chapters || [
      'technical_field',
      'background_art',
      'invention_content',
      'embodiments',
      'drawings_description',
    ]

    const draftMode = input.draftMode || 'standard'
    const targetWordCounts = getTargetWordCounts(draftMode, input.targetWordCount)

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

    const result = await this.performDrafting(context.llm, input, targetWordCounts)

    // 质量检查
    const metrics = this.performQualityChecks(result.specification)
    result.metrics = { ...result.metrics, ...metrics }

    // 计算质量评分
    result.qualityScore = calculateQualityScore(result.specification)

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
    targetWordCounts: SpecificationPlan['targetWordCounts']
  ): Promise<SpecificationDrafterOutput> {
    const systemPrompt = this.buildSystemPrompt(input)
    const userPrompt = this.buildUserPrompt(input, targetWordCounts)

    const parseResult = await this.callLLMWithFallback(llm, systemPrompt, userPrompt)

    if (!parseResult.success) {
      console.warn('[SpecificationDrafterAgent] LLM解析失败，使用回退输出')
      return createFallbackOutput(input)
    }

    return normalizeOutput(parseResult.data!, input)
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(input: SpecificationDrafterInput): string {
    const patentType = input.patentType || 'invention'
    const draftMode = input.draftMode || 'standard'

    return `你是一位资深的专利代理师，拥有15年的专利撰写经验。

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
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    input: SpecificationDrafterInput,
    targetWordCounts: SpecificationPlan['targetWordCounts']
  ): string {
    const contextInfo = this.buildContext(input)

    return `基于以下信息撰写专利说明书：

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
    "quality": { "clarity": 清晰度评分, "completeness": 完整性评分, "consistency": 一致性评分 }
  },
  "background_art": { "chapter": "背景技术", ... },
  "invention_content": {
    "chapter": "发明内容",
    "content": "发明内容详细描述",
    "technical_problem": "要解决的技术问题",
    "technical_solution": "技术方案详细描述",
    "beneficial_effects": "有益效果总体描述",
    "beneficial_effects_list": [{ "effect": "效果1", "metric": "指标", "improvement": "提升" }]
  },
  "embodiments": {
    "chapter": "具体实施方式",
    "content": "具体实施方式总体描述",
    "embodiment_list": [{ "number": 1, "title": "实施例1", "content": "...", "type": "preferred" }]
  },
  "drawings_description": {
    "chapter": "附图说明",
    "drawings": [{ "figureNumber": "图1", "title": "标题", "description": "说明" }]
  },
  "confidence": 置信度
}`
  }

  /**
   * 构建上下文信息
   */
  private buildContext(input: SpecificationDrafterInput): string {
    const { inventionUnderstanding, priorArtSearch, claimsSet, drawings } = input

    const sections: string[] = []

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

    if (drawings && drawings.length > 0) {
      sections.push('\n## 附图')
      drawings.forEach((drawing, index) => {
        sections.push(`图${index + 1}: ${drawing}`)
      })
    }

    return sections.join('\n')
  }

  /**
   * 执行质量检查
   */
  private performQualityChecks(
    specification: SpecificationContent
  ): Partial<SpecificationDrafterOutput['metrics']> {
    return {
      terminologyConsistency: checkTerminologyConsistency(specification),
      coherenceCheck: checkCoherence(specification),
      enablementCheck: checkEnablement(specification),
      supportCheck: checkSupport(specification),
    }
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
          timeout: 300000,
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
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || '未知错误',
    }
  }

  private validateInput(input: SpecificationDrafterInput): void {
    if (!input.inventionUnderstanding) {
      throw new Error('发明理解结果不能为空')
    }
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await readFile(this.templatePath, 'utf-8')
    } catch (error) {
      console.warn(`无法加载模板文件 ${this.templatePath}，使用默认配置`)
      return ''
    }
  }

  protected safeParseJSON(content: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(content)
      return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch {
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
}
