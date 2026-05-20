import { ProfessionalAgent, type ProfessionalAgentConfig, type ExtendedExecutionContext } from '@yunpat/agent-base'
import { SkillLoader } from '@yunpat/core'
import { join } from 'path'

/**
 * 对比文件类型
 */
export type PriorArtDocumentType = 'patent' | 'paper' | 'report'

/**
 * 对比文件
 */
export interface PriorArtDocument {
  /** 文件类型 */
  type: PriorArtDocumentType
  /** 标题 */
  title: string
  /** 内容（摘要或全文） */
  content: string
  /** 元数据（按类型使用不同字段） */
  metadata?: {
    /** 专利公开号 */
    publicationNumber?: string
    /** 专利申请人 */
    applicant?: string
    /** 公开/发表日期 */
    publicationDate?: string
    /** 论文作者 */
    authors?: string[]
    /** 论文发表期刊/会议 */
    venue?: string
    /** 调研报告来源 */
    source?: string
  }
}

/**
 * 对比文件分析输入
 */
export interface PriorArtAnalyzerInput {
  /** 待分析的对比文件 */
  document: PriorArtDocument
  /** 分析深度级别（1-3，默认2） */
  analysisDepth?: 1 | 2 | 3
  /** 是否启用知识图谱增强 */
  enableKnowledgeEnhancement?: boolean
}

/**
 * 特征必要性
 */
export type FeatureNecessity = 'essential' | 'important' | 'optional'

/**
 * 关键特征
 */
export interface KeyFeature {
  feature: string
  necessity: FeatureNecessity
  confidence: number
  claimLocation?: string
}

/**
 * 技术效果量化
 */
export interface TechnicalEffectQuantification {
  effect: string
  metric?: string
  improvement?: string
  confidence: number
}

/**
 * 技术方案分析
 */
export interface TechnicalSolutionAnalysis {
  core: string
  keyFeatures: KeyFeature[]
  implementation: string
  technicalEffects: TechnicalEffectQuantification[]
}

/**
 * 技术问题分析
 */
export interface TechnicalProblemAnalysis {
  main: string
  sub: string[]
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * 对比文件分析结果
 */
export interface PriorArtAnalysis {
  /** 文件基本信息 */
  documentInfo: {
    type: PriorArtDocumentType
    title: string
    metadata?: PriorArtDocument['metadata']
  }
  /** 技术分析 */
  technicalAnalysis: {
    technicalProblems: TechnicalProblemAnalysis
    technicalSolution: TechnicalSolutionAnalysis
  }
  /** 分析元数据 */
  metadata: {
    depth: 1 | 2 | 3
    timestamp: number
    confidence: number
    knowledgeGraphUsed: boolean
  }
}

/**
 * 分析计划
 */
interface AnalysisPlan {
  input: PriorArtAnalyzerInput
  knowledgeResults?: Array<{
    source: string
    content: string
    score: number
  }>
}

/**
 * 对比文件分析错误类
 */
export class PriorArtAnalysisError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'PriorArtAnalysisError'
    this.code = code
  }
}

/**
 * 对比文件分析智能体
 *
 * 职责：对单篇对比文件（专利/论文/调研报告）进行深度技术分析。
 * 不负责与目标发明的对比（由对比分析智能体负责）。
 *
 * @extends KnowledgeEnhancedAgent
 */
export class PriorArtAnalyzerAgent extends ProfessionalAgent<
  PriorArtAnalyzerInput,
  PriorArtAnalysis
> {
  private static readonly DEFAULT_DEPTH = 2
  private static readonly DEFAULT_TEMPERATURE = 0.3
  private static readonly MAX_RETRIES = 2
  private skillLoader?: SkillLoader

  constructor(config: ProfessionalAgentConfig & { skillLoader?: SkillLoader } = {} as any) {
    super(config)
    this.skillLoader =
      config.skillLoader ||
      new SkillLoader({
        baseDir: join(process.cwd(), '.yunpat/skills/prior-art-analysis'),
      })
  }

  protected async plan(
    input: PriorArtAnalyzerInput,
    _context: ExtendedExecutionContext
  ): Promise<AnalysisPlan> {
    this.checkAnalyzerInput(input)

    const depth = input.analysisDepth ?? PriorArtAnalyzerAgent.DEFAULT_DEPTH

    console.log('\n📄 [对比文件分析] 步骤1: 规划阶段')
    console.log(`   文件类型: ${this.getDocumentTypeLabel(input.document.type)}`)
    console.log(`   标题: ${input.document.title}`)
    console.log(`   分析深度: 级别${depth}`)

    let knowledgeResults: Array<{ source: string; content: string; score: number }> | undefined
    if (input.enableKnowledgeEnhancement !== false && this.knowledgeGraph) {
      try {
        const queryText = `${input.document.title} ${input.document.content.substring(0, 200)}`
        const results = await this.queryKnowledge(queryText, 3)
        if (results.length > 0) {
          knowledgeResults = results.map((r) => ({
            source: r.source,
            content: r.content,
            score: r.score,
          }))
          console.log(`   知识图谱: 检索到 ${results.length} 条相关知识`)
        }
      } catch (error) {
        console.warn(`   知识图谱检索失败:`, error)
      }
    }

    return { input, knowledgeResults }
  }

  protected async act(plan: AnalysisPlan, context: ExtendedExecutionContext): Promise<PriorArtAnalysis> {
    console.log('\n🔬 [对比文件分析] 步骤2: 分析阶段')

    if (!context.llm) {
      throw new PriorArtAnalysisError('LLM 未配置，无法执行对比文件分析', 'llm_not_configured')
    }

    const { input, knowledgeResults } = plan

    const analysis = await this.performAnalysis(context.llm, input, knowledgeResults)
    const enhancedAnalysis = this.enhanceAnalysis(analysis)

    console.log(`   ✅ 分析完成`)
    console.log(
      `      技术问题: ${enhancedAnalysis.technicalAnalysis.technicalProblems.main || '(未提取)'}`
    )
    console.log(
      `      核心方案: ${enhancedAnalysis.technicalAnalysis.technicalSolution.core.substring(0, 50)}...`
    )
    console.log(
      `      关键特征: ${enhancedAnalysis.technicalAnalysis.technicalSolution.keyFeatures.length} 个`
    )
    console.log(
      `      技术效果: ${enhancedAnalysis.technicalAnalysis.technicalSolution.technicalEffects.length} 个`
    )

    return enhancedAnalysis
  }

  private async performAnalysis(
    llm: NonNullable<ExtendedExecutionContext['llm']>,
    input: PriorArtAnalyzerInput,
    knowledgeResults?: Array<{ source: string; content: string; score: number }>
  ): Promise<PriorArtAnalysis> {
    const systemPrompt = await this.buildSystemPrompt(input, knowledgeResults)
    const userPrompt = await this.buildUserPrompt(input)

    const parseResult = await this.callLLMWithRetry(llm, systemPrompt, userPrompt)

    if (!parseResult.success) {
      console.warn('[PriorArtAnalyzerAgent] LLM解析失败，使用默认分析')
      return this.getDefaultAnalysis(input)
    }

    return this.normalizeAnalysis(parseResult.data!, input)
  }

  private async buildSystemPrompt(
    input: PriorArtAnalyzerInput,
    knowledgeResults?: Array<{ source: string; content: string; score: number }>
  ): Promise<string> {
    const depth = input.analysisDepth ?? PriorArtAnalyzerAgent.DEFAULT_DEPTH
    const typeLabel = this.getDocumentTypeLabel(input.document.type)

    // 尝试使用 SkillLoader 动态模板
    if (this.skillLoader) {
      try {
        const template = await this.skillLoader.load('system-prompt')
        const knowledgeContext =
          knowledgeResults && knowledgeResults.length > 0
            ? knowledgeResults
                .map(
                  (k, i) =>
                    `[${i + 1}] ${k.source} (相关性: ${(k.score * 100).toFixed(0)}%): ${k.content.substring(0, 150)}...`
                )
                .join('\n')
            : ''
        return this.skillLoader.render(template, {
          documentType: typeLabel,
          analysisDepth: String(depth),
          hasKnowledge: !!(knowledgeResults && knowledgeResults.length > 0),
          knowledgeContext,
        })
      } catch {
        /* 模板不存在，使用硬编码降级 */
      }
    }

    let prompt = `你是一位资深的技术分析专家，擅长从${typeLabel}中提取和深度分析技术信息。

你的任务：
1. 分析文档中涉及的技术问题（主要问题 + 子问题 + 严重性）
2. 提取技术方案的核心、关键特征（按必要性分类：essential/important/optional）和实施方式
3. 识别并量化技术效果（包括具体指标和改进幅度）

分析深度级别：${depth}
- 级别1：基础信息提取
- 级别2：深入分析（默认）
- 级别3：专家级分析（包括隐含特征推断）

输出必须是严格的JSON格式。`

    if (knowledgeResults && knowledgeResults.length > 0) {
      prompt += `\n\n相关知识参考：`
      knowledgeResults.forEach((k, i) => {
        prompt += `\n[${i + 1}] ${k.source} (相关性: ${(k.score * 100).toFixed(0)}%): ${k.content.substring(0, 150)}...`
      })
    }

    return prompt
  }

  private async buildUserPrompt(input: PriorArtAnalyzerInput): Promise<string> {
    const depth = input.analysisDepth ?? PriorArtAnalyzerAgent.DEFAULT_DEPTH
    const doc = input.document

    // 尝试使用 SkillLoader 动态模板
    if (this.skillLoader) {
      try {
        const template = await this.skillLoader.load('user-prompt')
        const typeLabels: Record<string, string> = {
          patent: '专利文献',
          paper: '学术论文',
          report: '调研报告',
        }
        return this.skillLoader.render(template, {
          docType: typeLabels[doc.type] || doc.type,
          docTitle: doc.title,
          docContent: doc.content.substring(0, depth === 3 ? 5000 : depth === 2 ? 3000 : 1500),
          publicationNumber: doc.metadata?.publicationNumber || '',
          applicant: doc.metadata?.applicant || '',
          inventors: doc.metadata?.authors?.join(', ') || '',
          publicationDate: doc.metadata?.publicationDate || '',
          analysisDepth: String(depth),
          maxLength: String(depth === 3 ? 5000 : depth === 2 ? 3000 : 1500),
        })
      } catch {
        /* 模板不存在，使用硬编码降级 */
      }
    }

    let prompt = `## ${this.getDocumentTypeLabel(doc.type)}信息\n`

    prompt += `标题: ${doc.title}\n`

    if (doc.metadata) {
      if (doc.metadata.publicationNumber) {
        prompt += `公开号: ${doc.metadata.publicationNumber}\n`
      }
      if (doc.metadata.applicant) {
        prompt += `申请人: ${doc.metadata.applicant}\n`
      }
      if (doc.metadata.authors?.length) {
        prompt += `作者: ${doc.metadata.authors.join(', ')}\n`
      }
      if (doc.metadata.venue) {
        prompt += `发表期刊/会议: ${doc.metadata.venue}\n`
      }
      if (doc.metadata.source) {
        prompt += `来源: ${doc.metadata.source}\n`
      }
      if (doc.metadata.publicationDate) {
        prompt += `日期: ${doc.metadata.publicationDate}\n`
      }
    }

    const maxLength = depth === 3 ? 5000 : depth === 2 ? 3000 : 1500
    const truncated = doc.content.length > maxLength
    prompt += `\n## 内容\n${doc.content.substring(0, maxLength)}${truncated ? '...' : ''}`

    prompt += `

请按以下JSON格式输出分析结果：

{
  "technical_analysis": {
    "technical_problems": {
      "main": "主要技术问题",
      "sub": ["子问题1", "子问题2"],
      "severity": "medium"
    },
    "technical_solution": {
      "core": "核心技术方案描述",
      "key_features": [
        {
          "feature": "特征1",
          "necessity": "essential",
          "confidence": 0.95
        },
        {
          "feature": "特征2",
          "necessity": "important",
          "confidence": 0.85
        }
      ],
      "implementation": "实施方式概述",
      "technical_effects": [
        {
          "effect": "效果描述",
          "metric": "性能指标",
          "improvement": "提升百分比",
          "confidence": 0.9
        }
      ]
    }
  }
}`

    return prompt
  }

  private async callLLMWithRetry(
    llm: NonNullable<ExtendedExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= PriorArtAnalyzerAgent.MAX_RETRIES; attempt++) {
      try {
        const response = await llm.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: PriorArtAnalyzerAgent.DEFAULT_TEMPERATURE,
        })

        const parsed = this.safeParseJSON(response.message.content)
        if (parsed) {
          return { success: true, data: parsed }
        }

        lastError = new Error('无法解析JSON响应')
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(
          `[PriorArtAnalyzerAgent] LLM调用失败 (尝试 ${attempt + 1}/${PriorArtAnalyzerAgent.MAX_RETRIES + 1}): ${lastError.message}`
        )
        if (attempt < PriorArtAnalyzerAgent.MAX_RETRIES) {
          await this.sleep(1000 * (attempt + 1))
        }
      }
    }

    return { success: false, error: lastError?.message || '未知错误' }
  }

  private normalizeAnalysis(
    data: Record<string, unknown>,
    input: PriorArtAnalyzerInput
  ): PriorArtAnalysis {
    const technicalAnalysis = data.technical_analysis as Record<string, unknown> | undefined

    return {
      documentInfo: {
        type: input.document.type,
        title: input.document.title,
        metadata: input.document.metadata,
      },
      technicalAnalysis: {
        technicalProblems: this.normalizeTechnicalProblems(technicalAnalysis?.technical_problems),
        technicalSolution: this.normalizeTechnicalSolution(technicalAnalysis?.technical_solution),
      },
      metadata: {
        depth: input.analysisDepth ?? PriorArtAnalyzerAgent.DEFAULT_DEPTH,
        timestamp: Date.now(),
        confidence: this.calculateOverallConfidence(data),
        knowledgeGraphUsed: !!this.knowledgeGraph,
      },
    }
  }

  private normalizeTechnicalProblems(data: unknown): TechnicalProblemAnalysis {
    if (typeof data !== 'object' || data === null) {
      return { main: '', sub: [], severity: 'medium' }
    }
    const problems = data as Record<string, unknown>
    return {
      main: this.getString(problems, 'main'),
      sub: this.getStringArray(problems, 'sub'),
      severity: this.getSeverity(problems.severity),
    }
  }

  private normalizeTechnicalSolution(data: unknown): TechnicalSolutionAnalysis {
    if (typeof data !== 'object' || data === null) {
      return { core: '', keyFeatures: [], implementation: '', technicalEffects: [] }
    }
    const solution = data as Record<string, unknown>
    return {
      core: this.getString(solution, 'core'),
      keyFeatures: this.normalizeKeyFeatures(solution.key_features),
      implementation: this.getString(solution, 'implementation'),
      technicalEffects: this.normalizeTechnicalEffects(solution.technical_effects),
    }
  }

  private normalizeKeyFeatures(data: unknown): KeyFeature[] {
    if (!Array.isArray(data)) return []
    return data.map((f: unknown) => {
      if (typeof f !== 'object' || f === null) {
        return { feature: String(f), necessity: 'optional', confidence: 0.5 }
      }
      const feature = f as Record<string, unknown>
      return {
        feature: this.getString(feature, 'feature'),
        necessity: this.getNecessity(feature.necessity),
        confidence: this.getNumber(feature, 'confidence', 0.8),
        claimLocation: feature.claim_location ? String(feature.claim_location) : undefined,
      }
    })
  }

  private normalizeTechnicalEffects(data: unknown): TechnicalEffectQuantification[] {
    if (!Array.isArray(data)) return []
    return data.map((e: unknown) => {
      if (typeof e !== 'object' || e === null) {
        return { effect: String(e), confidence: 0.5 }
      }
      const effect = e as Record<string, unknown>
      return {
        effect: this.getString(effect, 'effect'),
        metric: effect.metric ? String(effect.metric) : undefined,
        improvement: effect.improvement ? String(effect.improvement) : undefined,
        confidence: this.getNumber(effect, 'confidence', 0.8),
      }
    })
  }

  private enhanceAnalysis(analysis: PriorArtAnalysis): PriorArtAnalysis {
    analysis.metadata.knowledgeGraphUsed = !!this.knowledgeGraph
    return analysis
  }

  private calculateOverallConfidence(data: Record<string, unknown>): number {
    let sum = 0
    let count = 0
    const technicalAnalysis = data.technical_analysis as Record<string, unknown> | undefined
    if (technicalAnalysis) {
      const solution = technicalAnalysis.technical_solution as Record<string, unknown> | undefined
      if (solution?.key_features && Array.isArray(solution.key_features)) {
        for (const f of solution.key_features) {
          if (typeof f === 'object' && f !== null) {
            const conf = (f as Record<string, unknown>).confidence
            if (typeof conf === 'number') {
              sum += conf
              count++
            }
          }
        }
      }
    }
    return count > 0 ? sum / count : 0.8
  }

  private getDefaultAnalysis(input: PriorArtAnalyzerInput): PriorArtAnalysis {
    return {
      documentInfo: {
        type: input.document.type,
        title: input.document.title,
        metadata: input.document.metadata,
      },
      technicalAnalysis: {
        technicalProblems: { main: '', sub: [], severity: 'medium' },
        technicalSolution: {
          core: input.document.content.substring(0, 200),
          keyFeatures: [],
          implementation: '',
          technicalEffects: [],
        },
      },
      metadata: {
        depth: 1,
        timestamp: Date.now(),
        confidence: 0.5,
        knowledgeGraphUsed: false,
      },
    }
  }

  private checkAnalyzerInput(input: PriorArtAnalyzerInput): void {
    if (!input.document?.title?.trim()) {
      throw new PriorArtAnalysisError('文件标题不能为空', 'missing_title')
    }
    if (!input.document?.content?.trim()) {
      throw new PriorArtAnalysisError('文件内容不能为空', 'missing_content')
    }
  }

  private getDocumentTypeLabel(type: PriorArtDocumentType): string {
    const labels: Record<PriorArtDocumentType, string> = {
      patent: '专利文献',
      paper: '学术论文',
      report: '调研报告',
    }
    return labels[type]
  }

  private getNecessity(value: unknown): FeatureNecessity {
    if (value === 'essential') return 'essential'
    if (value === 'important') return 'important'
    return 'optional'
  }

  private getSeverity(value: unknown): 'low' | 'medium' | 'high' | 'critical' {
    if (value === 'low') return 'low'
    if (value === 'high') return 'high'
    if (value === 'critical') return 'critical'
    return 'medium'
  }

  private getString(obj: Record<string, unknown>, key: string): string {
    const value = obj[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  private getStringArray(obj: Record<string, unknown>, key: string): string[] {
    const value = obj[key]
    if (!Array.isArray(value)) return []
    return value.filter((v): v is string => typeof v === 'string').map((s) => s.trim())
  }

  private getNumber(obj: Record<string, unknown>, key: string, fallback: number): number {
    const value = obj[key]
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, Math.min(1, value))
    }
    return fallback
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
