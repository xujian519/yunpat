/**
 * 对比分析智能体
 *
 * 职责：对目标发明与多篇对比文件进行交叉比对分析。
 * 依赖 Agent 1（发明理解）和 Agent 2（对比文件分析）的输出。
 *
 * 两种模式：
 * 1. 完整模式：发明理解 + 多篇对比文件 → 综合对比分析
 * 2. 仅对比文件模式：多篇对比文件 → 交叉对比（审查意见答复、复审、无效）
 *
 * @package @yunpat/agent-patent-analyzer
 */

import { ProfessionalAgent, type ExtendedExecutionContext } from '@yunpat/agent-base'
import type { PriorArtAnalysis, PriorArtDocumentType } from '@yunpat/agent-analysis'
import type { BaseAgentInput, BaseAgentOutput } from '@yunpat/agent-base'
import { PostgreSQLClient, type PatentRuleResult } from '@yunpat/unified-knowledge-graph'

/**
 * 分析场景
 */
export type ComparisonScenario =
  | 'new_application'
  | 'office_action'
  | 'reexamination'
  | 'invalidation'

/**
 * 发明理解摘要（来自 Agent 1）
 */
export interface InventionSummary {
  technicalProblem: string
  technicalSolution: string
  keyFeatures: string[]
  beneficialEffects?: string
}

/**
 * 对比分析输入
 */
export interface ComparisonAnalyzerInput extends BaseAgentInput {
  /** 发明理解（可选，来自 InventionUnderstandingAgent） */
  inventionUnderstanding?: InventionSummary
  /** 对比文件分析结果（必需，来自 PriorArtAnalyzerAgent） */
  priorArtAnalyses: PriorArtAnalysis[]
  /** 分析场景 */
  scenario?: ComparisonScenario
}

/**
 * 单篇对比文件的比对结果
 */
export interface PriorArtComparison {
  /** 对比文件信息 */
  documentInfo: {
    title: string
    type: PriorArtDocumentType
  }
  /** 与目标发明（或其他对比文件）的相似度（0-1） */
  similarity: number
  /** 共同特征 */
  overlappingFeatures: string[]
  /** 区别特征 */
  distinctFeatures: Array<{
    feature: string
    significance: 'major' | 'minor'
  }>
}

/**
 * 创造性评估
 */
export interface CreativityAssessment {
  /** 创造性等级 */
  level: 'inventive' | 'obvious' | 'lacks_inventiveness'
  /** 评分（0-100） */
  score: number
  /** 理由 */
  reasoning: string
}

/**
 * 风险评估
 */
export interface RiskAssessment {
  /** 无效风险 */
  invalidityRisk: 'low' | 'medium' | 'high'
  /** 侵权风险 */
  infringementRisk: 'low' | 'medium' | 'high'
  /** 风险因素 */
  riskFactors: string[]
}

/**
 * 对比分析输出
 */
export interface ComparisonAnalyzerOutput extends BaseAgentOutput {
  /** 分析场景 */
  scenario: ComparisonScenario
  /** 是否有发明理解 */
  hasInventionUnderstanding: boolean
  /** 各篇对比文件的比对结果 */
  comparisons: PriorArtComparison[]
  /** 最接近的对比文件 */
  closestPriorArt?: PriorArtComparison
  /** 创造性评估 */
  creativityAssessment?: CreativityAssessment
  /** 风险评估 */
  riskAssessment?: RiskAssessment
  /** 审查规则 */
  examinationRules?: Array<{
    articleId: string
    title: string
    content: string
    corePrinciple?: string
    similarity?: number
  }>
  /** 综合建议 */
  recommendations: string[]
  /** 元数据 */
  metadata: {
    priorArtCount: number
    timestamp: number
    confidence: number
  }
}

/**
 * 对比分析计划
 */
interface ComparisonPlan {
  input: ComparisonAnalyzerInput
  hasInvention: boolean
  stages: Array<
    | 'compare-prior-arts'
    | 'find-closest-prior-art'
    | 'assess-creativity'
    | 'assess-risks'
    | 'generate-recommendations'
  >
}

/**
 * 对比分析智能体
 *
 * @extends ProfessionalAgent
 */
export class ComparisonAnalyzerAgent extends ProfessionalAgent<
  ComparisonAnalyzerInput,
  ComparisonAnalyzerOutput
> {
  private legalDb?: PostgreSQLClient

  constructor(
    config: ConstructorParameters<typeof ProfessionalAgent>[0] & { enableLegalKnowledge?: boolean }
  ) {
    super(config)
    if (config.enableLegalKnowledge !== false) {
      this.legalDb = new PostgreSQLClient()
    }
  }

  /**
   * 搜索审查规则
   */
  private async searchExaminationRules(
    query: string,
    topK: number = 5
  ): Promise<PatentRuleResult[]> {
    if (!this.legalDb) return []
    await this.legalDb.initialize()
    const results = await this.legalDb.searchPatentRules({ query, topK })
    return results
  }
  protected async plan(
    input: ComparisonAnalyzerInput,
    _context: ExtendedExecutionContext
  ): Promise<ComparisonPlan> {
    this.checkInput(input)

    const hasInvention = !!input.inventionUnderstanding
    const stages: ComparisonPlan['stages'] = []

    stages.push('compare-prior-arts')

    if (hasInvention) {
      stages.push('find-closest-prior-art')
      stages.push('assess-creativity')
    }

    stages.push('assess-risks')
    stages.push('generate-recommendations')

    console.log('\n⚖️ [对比分析] 步骤1: 规划阶段')
    console.log(`   场景: ${this.getScenarioLabel(input.scenario || 'new_application')}`)
    console.log(`   发明理解: ${hasInvention ? '已提供' : '未提供'}`)
    console.log(`   对比文件: ${input.priorArtAnalyses.length} 篇`)

    return { input, hasInvention, stages }
  }

  protected async act(
    plan: ComparisonPlan,
    context: ExtendedExecutionContext
  ): Promise<ComparisonAnalyzerOutput> {
    console.log('\n📊 [对比分析] 步骤2: 分析阶段')

    const startTime = Date.now()

    const { input, hasInvention, stages } = plan
    const output: Partial<ComparisonAnalyzerOutput> = {
      scenario: input.scenario || 'new_application',
      hasInventionUnderstanding: hasInvention,
      comparisons: [],
      recommendations: [],
    }

    const examinationRules = await this.searchRelevantExaminationRules(input, output)

    for (const stage of stages) {
      switch (stage) {
        case 'compare-prior-arts':
          output.comparisons = this.comparePriorArts(input)
          break

        case 'find-closest-prior-art':
          output.closestPriorArt = this.findClosestPriorArt(output.comparisons!)
          break

        case 'assess-creativity':
          if (context.llm) {
            output.creativityAssessment = await this.assessCreativity(
              input,
              output.comparisons!,
              context
            )
          }
          break

        case 'assess-risks':
          if (context.llm) {
            output.riskAssessment = await this.assessRisks(input, output, context)
          }
          break

        case 'generate-recommendations':
          output.recommendations = this.generateRecommendations(output)
          break
      }
    }

    const executionTime = Date.now() - startTime

    const result: ComparisonAnalyzerOutput = {
      scenario: output.scenario!,
      hasInventionUnderstanding: output.hasInventionUnderstanding!,
      comparisons: output.comparisons!,
      closestPriorArt: output.closestPriorArt,
      creativityAssessment: output.creativityAssessment,
      riskAssessment: output.riskAssessment,
      examinationRules: examinationRules,
      recommendations: output.recommendations || [],
      executionTime,
      metadata: {
        priorArtCount: input.priorArtAnalyses.length,
        timestamp: Date.now(),
        confidence: this.calculateConfidence(output),
      },
    }

    console.log(`   ✅ 对比分析完成`)
    console.log(`   对比文件: ${result.comparisons.length} 篇`)
    if (result.closestPriorArt) {
      console.log(`   最接近对比文件: ${result.closestPriorArt.documentInfo.title}`)
      console.log(`   相似度: ${(result.closestPriorArt.similarity * 100).toFixed(1)}%`)
    }
    if (result.creativityAssessment) {
      console.log(
        `   创造性: ${result.creativityAssessment.level} (${result.creativityAssessment.score}/100)`
      )
    }
    if (result.riskAssessment) {
      console.log(`   无效风险: ${result.riskAssessment.invalidityRisk}`)
    }

    return result
  }

  /**
   * 对比文件交叉比对
   */
  private comparePriorArts(input: ComparisonAnalyzerInput): PriorArtComparison[] {
    const invention = input.inventionUnderstanding
    const analyses = input.priorArtAnalyses

    return analyses.map((analysis) => {
      const overlappingFeatures: string[] = []
      const distinctFeatures: Array<{ feature: string; significance: 'major' | 'minor' }> = []

      // 提取该对比文件的关键特征
      const priorArtFeatures =
        analysis.technicalAnalysis?.technicalSolution?.keyFeatures?.map(
          (f: { feature: string }) => f.feature
        ) || []
      const priorArtEffects =
        analysis.technicalAnalysis?.technicalSolution?.technicalEffects?.map(
          (e: { effect: string }) => e.effect
        ) || []

      if (invention) {
        // 模式1：与目标发明对比
        for (const feature of invention.keyFeatures) {
          if (this.isFeatureOverlapping(feature, priorArtFeatures)) {
            overlappingFeatures.push(feature)
          } else {
            distinctFeatures.push({
              feature,
              significance: 'major',
            })
          }
        }
        for (const feature of priorArtFeatures) {
          if (!this.isFeatureOverlapping(feature, invention.keyFeatures)) {
            distinctFeatures.push({
              feature: `[对比] ${feature}`,
              significance: 'minor',
            })
          }
        }
      } else {
        // 模式2：仅对比文件间交叉比对
        // 与其他对比文件比较找差异
        for (const feature of priorArtFeatures) {
          const isCommon = analyses.some(
            (other) =>
              other !== analysis &&
              other.technicalAnalysis?.technicalSolution?.keyFeatures?.some(
                (f: { feature: string }) => this.isFeatureOverlapping(feature, [f.feature])
              )
          )
          if (isCommon) {
            overlappingFeatures.push(feature)
          } else {
            distinctFeatures.push({
              feature,
              significance: 'major',
            })
          }
        }
      }

      const similarity = this.calculateSimilarity(
        invention?.keyFeatures || [],
        priorArtFeatures,
        priorArtEffects
      )

      return {
        documentInfo: {
          title: analysis.documentInfo.title,
          type: analysis.documentInfo.type,
        },
        similarity,
        overlappingFeatures,
        distinctFeatures,
      }
    })
  }

  /**
   * 找到最接近的对比文件
   */
  private findClosestPriorArt(comparisons: PriorArtComparison[]): PriorArtComparison | undefined {
    if (comparisons.length === 0) return undefined
    return comparisons.reduce((max, curr) => (curr.similarity > max.similarity ? curr : max))
  }

  /**
   * 搜索相关审查规则
   */
  private async searchRelevantExaminationRules(
    input: ComparisonAnalyzerInput,
    output: Partial<ComparisonAnalyzerOutput>
  ): Promise<
    | Array<{
        articleId: string
        title: string
        content: string
        corePrinciple?: string
        similarity?: number
      }>
    | undefined
  > {
    if (!this.legalDb) return undefined

    const searchQueries: string[] = []

    if (input.inventionUnderstanding) {
      if (output.comparisons && output.comparisons.length > 0) {
        searchQueries.push('新颖性 判断标准 对比文件 技术方案')
      }
      if (input.inventionUnderstanding.keyFeatures.length > 0) {
        searchQueries.push('创造性 三步法 区别特征 技术效果')
      }
    }

    if (output.riskAssessment) {
      searchQueries.push('专利性风险 无效宣告 现有技术')
    }

    const uniqueQueries = [...new Set(searchQueries)].slice(0, 3)

    const allResults: PatentRuleResult[] = []
    for (const query of uniqueQueries) {
      const results = await this.searchExaminationRules(query, 3)
      allResults.push(...results)
    }

    const seen = new Set<string>()
    return allResults
      .filter((r) => !seen.has(r.articleId) && seen.add(r.articleId))
      .map((r) => ({
        articleId: r.articleId,
        title: r.title,
        content: r.content,
        corePrinciple: r.corePrinciple,
        similarity: r.similarity,
      }))
      .slice(0, 5)
  }

  /**
   * 创造性评估（LLM）
   */
  private async assessCreativity(
    input: ComparisonAnalyzerInput,
    comparisons: PriorArtComparison[],
    context: ExtendedExecutionContext
  ): Promise<CreativityAssessment> {
    const invention = input.inventionUnderstanding!
    const closest = this.findClosestPriorArt(comparisons)

    const priorArtSummary = comparisons
      .map(
        (c) =>
          `- ${c.documentInfo.title}: 相似度 ${(c.similarity * 100).toFixed(0)}%，区别特征 ${c.distinctFeatures.filter((d) => d.significance === 'major').length} 个`
      )
      .join('\n')

    const examinationRules = await this.searchExaminationRules('创造性 三步法', 3)
    const rulesText =
      examinationRules.length > 0
        ? `\n\n## 相关审查规则\n${examinationRules.map((r) => `- [${r.articleId}] ${r.title}\n  ${r.corePrinciple || r.content.substring(0, 100)}...`).join('\n')}`
        : ''

    const prompt = `请评估目标发明相对于以下对比文件的创造性：

## 目标发明
技术问题: ${invention.technicalProblem}
技术方案: ${invention.technicalSolution}
关键特征: ${invention.keyFeatures.join('、')}

## 对比文件
${priorArtSummary}

${
  closest
    ? `最接近的对比文件: ${closest.documentInfo.title}（相似度 ${(closest.similarity * 100).toFixed(0)}%）
区别特征: ${closest.distinctFeatures.map((d) => d.feature).join('、')}`
    : ''
}
${rulesText}

请基于三步法评估创造性，并参考上述审查规则，以JSON格式返回：
{
  "level": "inventive" | "obvious" | "lacks_inventiveness",
  "score": 0-100,
  "reasoning": "评估理由"
}`

    try {
      const response = await this.callLLM({
        messages: [
          { role: 'system', content: '你是一位专业的专利审查员，擅长使用三步法评估创造性。' },
          { role: 'user', content: prompt },
        ],
      })

      const parsed = this.safeParseJSON(response)
      if (parsed) {
        return {
          level:
            parsed.level === 'inventive' ||
            parsed.level === 'obvious' ||
            parsed.level === 'lacks_inventiveness'
              ? parsed.level
              : 'obvious',
          score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50,
          reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        }
      }
    } catch {
      // LLM 调用失败，使用规则评估
    }

    return this.ruleBasedCreativityAssessment(invention, comparisons)
  }

  /**
   * 基于规则的创造性评估（兜底）
   */
  private ruleBasedCreativityAssessment(
    _invention: InventionSummary,
    comparisons: PriorArtComparison[]
  ): CreativityAssessment {
    const closest = this.findClosestPriorArt(comparisons)
    const majorDiffs =
      closest?.distinctFeatures.filter((d) => d.significance === 'major').length || 0

    if (majorDiffs >= 3) {
      return {
        level: 'inventive',
        score: 80,
        reasoning: `与最接近对比文件存在 ${majorDiffs} 个主要区别特征，具有创造性。`,
      }
    }
    if (majorDiffs >= 1) {
      return {
        level: 'obvious',
        score: 55,
        reasoning: `与最接近对比文件存在 ${majorDiffs} 个主要区别特征，创造性一般。`,
      }
    }
    return {
      level: 'lacks_inventiveness',
      score: 30,
      reasoning: '与最接近对比文件区别特征较少，创造性不足。',
    }
  }

  /**
   * 风险评估
   */
  private async assessRisks(
    _input: ComparisonAnalyzerInput,
    output: Partial<ComparisonAnalyzerOutput>,
    _context: ExtendedExecutionContext
  ): Promise<RiskAssessment> {
    const riskFactors: string[] = []

    const highSimilarity = output.comparisons?.filter((c) => c.similarity > 0.7).length || 0
    if (highSimilarity > 0) {
      riskFactors.push(`${highSimilarity} 篇对比文件相似度超过70%`)
    }

    if (output.creativityAssessment?.level === 'lacks_inventiveness') {
      riskFactors.push('创造性评估不足')
    }

    if (output.creativityAssessment && output.creativityAssessment.score < 50) {
      riskFactors.push('创造性评分低于50分')
    }

    const closest = output.closestPriorArt
    if (
      closest &&
      closest.distinctFeatures.filter((d) => d.significance === 'major').length === 0
    ) {
      riskFactors.push('与最接近对比文件无主要区别特征')
    }

    if (_context.llm && riskFactors.length > 0) {
      try {
        const riskSummary = riskFactors.map((r) => `- ${r}`).join('\n')
        const examinationRules = await this.searchExaminationRules('无效宣告 专利性风险', 3)
        const rulesText =
          examinationRules.length > 0
            ? `\n\n## 相关审查规则\n${examinationRules.map((r) => `- [${r.articleId}] ${r.title}\n  ${r.corePrinciple || r.content.substring(0, 100)}...`).join('\n')}`
            : ''

        const prompt = `基于以下风险因素，评估专利风险：

${riskSummary}
${rulesText}

请以JSON格式返回：
{
  "invalidityRisk": "low" | "medium" | "high",
  "infringementRisk": "low" | "medium" | "high",
  "additionalFactors": ["额外风险因素"]
}`

        const response = await this.callLLM({
          messages: [
            { role: 'system', content: '你是一位专业的专利风险分析师。' },
            { role: 'user', content: prompt },
          ],
        })

        const parsed = this.safeParseJSON(response)
        if (parsed) {
          return {
            invalidityRisk: this.parseRiskLevel(parsed.invalidityRisk),
            infringementRisk: this.parseRiskLevel(parsed.infringementRisk),
            riskFactors: [
              ...riskFactors,
              ...(Array.isArray(parsed.additionalFactors) ? parsed.additionalFactors : []),
            ],
          }
        }
      } catch {
        // LLM 增强失败，使用规则评估
      }
    }

    // 规则评估
    return {
      invalidityRisk: riskFactors.length >= 3 ? 'high' : riskFactors.length >= 1 ? 'medium' : 'low',
      infringementRisk: highSimilarity > 0 ? 'medium' : 'low',
      riskFactors,
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(output: Partial<ComparisonAnalyzerOutput>): string[] {
    const recommendations: string[] = []

    if (output.creativityAssessment?.level === 'lacks_inventiveness') {
      recommendations.push('建议补充技术创新点，突出与对比文件的区别')
    }

    if (output.creativityAssessment && output.creativityAssessment.score < 60) {
      recommendations.push('建议补充技术效果数据和实施例，增强创造性论证')
    }

    if (output.riskAssessment?.invalidityRisk === 'high') {
      recommendations.push('建议重新评估专利申请策略，考虑缩小权利要求保护范围')
    }

    const closest = output.closestPriorArt
    if (closest && closest.similarity > 0.8) {
      recommendations.push(
        `与"${closest.documentInfo.title}"高度相似，建议重点论证区别特征的技术效果`
      )
    }

    if (output.comparisons && output.comparisons.length > 3) {
      recommendations.push('对比文件较多，建议聚焦最接近的2-3篇进行深度对比')
    }

    return recommendations
  }

  // ==================== 辅助方法 ====================

  private checkInput(input: ComparisonAnalyzerInput): void {
    if (!input.priorArtAnalyses || input.priorArtAnalyses.length === 0) {
      throw new Error('对比文件分析结果不能为空')
    }
  }

  private calculateSimilarity(
    inventionFeatures: string[],
    priorArtFeatures: string[],
    _priorArtEffects: string[]
  ): number {
    if (inventionFeatures.length === 0) {
      // 仅对比文件模式：基于效果重叠度估算
      return priorArtFeatures.length > 0 ? 0.3 : 0
    }

    let overlapCount = 0
    for (const feature of inventionFeatures) {
      if (this.isFeatureOverlapping(feature, priorArtFeatures)) {
        overlapCount++
      }
    }

    return inventionFeatures.length > 0 ? overlapCount / inventionFeatures.length : 0
  }

  private isFeatureOverlapping(feature: string, targetFeatures: string[]): boolean {
    const normalized = feature.toLowerCase().trim()
    return targetFeatures.some(
      (tf) =>
        tf.toLowerCase().trim() === normalized ||
        tf.toLowerCase().includes(normalized) ||
        normalized.includes(tf.toLowerCase().trim())
    )
  }

  private calculateConfidence(output: Partial<ComparisonAnalyzerOutput>): number {
    let score = 0.7

    if (output.comparisons && output.comparisons.length > 0) score += 0.1
    if (output.creativityAssessment) score += 0.1
    if (output.riskAssessment) score += 0.1

    return Math.min(score, 1.0)
  }

  private parseRiskLevel(value: unknown): 'low' | 'medium' | 'high' {
    if (value === 'low') return 'low'
    if (value === 'high') return 'high'
    return 'medium'
  }

  private getScenarioLabel(scenario: ComparisonScenario): string {
    const labels: Record<ComparisonScenario, string> = {
      new_application: '新申请',
      office_action: '审查意见答复',
      reexamination: '复审',
      invalidation: '无效宣告',
    }
    return labels[scenario]
  }
}
