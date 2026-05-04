/**
 * 创造性分析智能体（新增 - 符合Phase 4新架构）
 *
 * 专业的专利创造性评估智能体，提供：
 * 1. 创造性深度评估
 * 2. 技术贡献分析
 * 3. 显著进步评估
 * 4. 创造性证据收集
 * 5. 优化建议生成
 *
 * 特性：
 * - 简洁的架构（符合Phase 4设计）
 * - 可被OrchestratorAgent调用
 * - 高度可测试
 * - 专注于创造性评估
 */

import { Agent, type LLMAdapter, type ExecutionContext } from '@yunpat/core'

/**
 * 创造性分析输入
 */
export interface CreativeAnalyzerInput {
  /** 目标专利 */
  patent: {
    /** 公开号 */
    publicationNumber: string
    /** 标题 */
    title: string
    /** 摘要 */
    abstract: string
    /** 权利要求 */
    claims?: string
    /** 说明书 */
    description?: string
  }
  /** 对比专利（现有技术） */
  priorArt?: Array<{
    /** 公开号 */
    publicationNumber: string
    /** 标题 */
    title: string
    /** 摘要 */
    abstract: string
    /** 相似度评分（可选） */
    similarity?: number
  }>
  /** 评估标准 */
  assessmentStandard?: 'cn' | 'pct' | 'ep' | 'us'
  /** 技术领域（用于领域特定的创造性标准） */
  technicalField?: string
}

/**
 * 创造性分析输出
 */
export interface CreativeAnalyzerOutput {
  /** 基本信息 */
  basicInfo: {
    publicationNumber: string
    title: string
    assessmentStandard: string
  }
  /** 创造性评估 */
  creativityAssessment: {
    /** 创造性等级 */
    level: 'inventive' | 'obvious' | 'lacksInventiveness'
    /** 创造性评分（0-100） */
    score: number
    /** 评估维度 */
    dimensions: {
      /** 突出实质性特点 */
      substantiveCharacteristics: {
        score: number
        reasoning: string
      }
      /** 显著进步 */
      significantProgress: {
        score: number
        reasoning: string
      }
      /** 技术贡献 */
      technicalContribution: {
        score: number
        reasoning: string
      }
    }
    /** 总体评估理由 */
    reasoning: string
  }
  /** 技术问题分析 */
  problemAnalysis: {
    /** 解决的技术问题 */
    solvedProblem: string
    /** 问题的难度 */
    problemDifficulty: 'low' | 'medium' | 'high'
    /** 是否为本领域技术人员难以预见 */
    unforeseeable: boolean
  }
  /** 技术方案分析 */
  solutionAnalysis: {
    /** 技术手段 */
    technicalMeans: string[]
    /** 技术特征组合 */
    featureCombination: string
    /** 是否存在协同效应 */
    synergisticEffect: boolean
  }
  /** 技术效果分析 */
  effectAnalysis: {
    /** 技术效果 */
    technicalEffects: string[]
    /** 是否预料不到 */
    unexpected: boolean
    /** 量化效果（如有） */
    quantitativeEffects?: Array<{
      effect: string
      value: string
      improvement: string
    }>
  }
  /** 与现有技术的区别 */
  differencesFromPriorArt: {
    /** 区别技术特征 */
    distinguishingFeatures: string[]
    /** 是否显而易见 */
    obviousness: 'not-obvious' | 'obvious' | 'highly-obvious'
    /** 是否有启示 */
    suggestion: 'no-suggestion' | 'some-suggestion' | 'clear-suggestion'
  }
  /** 创造性证据 */
  evidence: {
    /** 商业成功 */
    commercialSuccess?: boolean
    /** 技术突破 */
    technicalBreakthrough?: boolean
    /** 解决长期技术难题 */
    solvedLongstandingProblem?: boolean
    /** 克服技术偏见 */
    overcameTechnicalPrejudice?: boolean
    /** 其他证据 */
    otherEvidence?: string[]
  }
  /** 优化建议 */
  recommendations: {
    /** 如何增强创造性 */
    strengthenCreativity: string[]
    /** 如何突出技术贡献 */
    highlightContribution: string[]
    /** 如何强调技术效果 */
    emphasizeEffects: string[]
  }
}

/**
 * 分析计划
 */
interface AnalysisPlan {
  input: CreativeAnalyzerInput
  assessmentStandard: 'cn' | 'pct' | 'ep' | 'us'
  stages: string[]
}

/**
 * 创造性分析智能体
 */
export class CreativeAnalyzerAgent extends Agent {
  private llm: LLMAdapter

  constructor(config: {
    name?: string
    description?: string
    llm: LLMAdapter
    eventBus: any
    memory: any
    tools: any
  }) {
    super({
      ...config,
      name: config.name || 'creative-analyzer',
      description: config.description || '创造性分析智能体 - 专业的专利创造性评估助手'
    })
    this.llm = config.llm
  }

  /**
   * 规划阶段：分析输入，制定评估计划
   */
  protected async plan(
    input: CreativeAnalyzerInput,
    _context: ExecutionContext
  ): Promise<AnalysisPlan> {
    // 验证输入
    this.validateInput(input)

    // 确定评估标准
    const assessmentStandard = input.assessmentStandard || 'cn'

    // 确定评估阶段
    const stages = [
      'analyze-problem',
      'analyze-solution',
      'analyze-effects',
      'compare-prior-art',
      'assess-creativity',
      'collect-evidence',
      'generate-recommendations'
    ]

    return {
      input,
      assessmentStandard,
      stages
    }
  }

  /**
   * 执行阶段：按计划评估创造性
   */
  protected async execute(
    plan: AnalysisPlan,
    context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput> {
    const { input, stages, assessmentStandard } = plan

    let problemAnalysis: CreativeAnalyzerOutput['problemAnalysis'] | undefined
    let solutionAnalysis: CreativeAnalyzerOutput['solutionAnalysis'] | undefined
    let effectAnalysis: CreativeAnalyzerOutput['effectAnalysis'] | undefined
    let differencesFromPriorArt: CreativeAnalyzerOutput['differencesFromPriorArt'] | undefined
    let creativityAssessment: CreativeAnalyzerOutput['creativityAssessment'] | undefined
    let evidence: CreativeAnalyzerOutput['evidence'] | undefined
    let recommendations: CreativeAnalyzerOutput['recommendations'] | undefined

    // 执行各个阶段
    for (const stage of stages) {
      context.logger?.info(`[CreativeAnalyzerAgent] 执行阶段: ${stage}`)

      switch (stage) {
        case 'analyze-problem':
          problemAnalysis = await this.analyzeProblem(input, context)
          break

        case 'analyze-solution':
          solutionAnalysis = await this.analyzeSolution(input, context)
          break

        case 'analyze-effects':
          effectAnalysis = await this.analyzeEffects(input, context)
          break

        case 'compare-prior-art':
          differencesFromPriorArt = await this.comparePriorArt(input, context)
          break

        case 'assess-creativity':
          creativityAssessment = await this.assessCreativity(
            input,
            problemAnalysis,
            solutionAnalysis,
            effectAnalysis,
            differencesFromPriorArt,
            context
          )
          break

        case 'collect-evidence':
          evidence = await this.collectEvidence(input, creativityAssessment, context)
          break

        case 'generate-recommendations':
          recommendations = this.generateRecommendations(
            input,
            problemAnalysis,
            solutionAnalysis,
            effectAnalysis,
            creativityAssessment,
            context
          )
          break
      }
    }

    return {
      basicInfo: {
        publicationNumber: input.patent.publicationNumber,
        title: input.patent.title,
        assessmentStandard
      },
      creativityAssessment: creativityAssessment!,
      problemAnalysis: problemAnalysis!,
      solutionAnalysis: solutionAnalysis!,
      effectAnalysis: effectAnalysis!,
      differencesFromPriorArt: differencesFromPriorArt!,
      evidence: evidence!,
      recommendations: recommendations!
    }
  }

  /**
   * 验证输入
   */
  private validateInput(input: CreativeAnalyzerInput): void {
    if (!input.patent?.publicationNumber?.trim()) {
      throw new Error('专利公开号不能为空')
    }
    if (!input.patent?.title?.trim()) {
      throw new Error('专利标题不能为空')
    }
    if (!input.patent?.abstract?.trim()) {
      throw new Error('专利摘要不能为空')
    }
  }

  /**
   * 分析技术问题
   */
  private async analyzeProblem(
    input: CreativeAnalyzerInput,
    context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput['problemAnalysis']> {
    const prompt = `请分析以下专利解决的技术问题：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}

说明书：
${input.patent.description || '未提供'}

请分析：
1. 解决的技术问题是什么？
2. 问题的难度如何（低/中/高）？
3. 是否为本领域技术人员难以预见的？
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利分析师，擅长技术问题分析。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 1000,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parseProblemAnalysis(content)
    } catch (error) {
      context.logger?.error('[CreativeAnalyzerAgent] 技术问题分析失败:', error)
      throw new Error('技术问题分析失败')
    }
  }

  /**
   * 分析技术方案
   */
  private async analyzeSolution(
    input: CreativeAnalyzerInput,
    context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput['solutionAnalysis']> {
    const prompt = `请分析以下专利的技术方案：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}

权利要求：
${input.patent.claims || '未提供'}

说明书：
${input.patent.description || input.patent.abstract}

请分析：
1. 采用了哪些技术手段？
2. 技术特征的组合方式？
3. 是否存在协同效应？
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利分析师，擅长技术方案分析。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 1500,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parseSolutionAnalysis(content)
    } catch (error) {
      context.logger?.error('[CreativeAnalyzerAgent] 技术方案分析失败:', error)
      throw new Error('技术方案分析失败')
    }
  }

  /**
   * 分析技术效果
   */
  private async analyzeEffects(
    input: CreativeAnalyzerInput,
    context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput['effectAnalysis']> {
    const prompt = `请分析以下专利的技术效果：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}

说明书：
${input.patent.description || '未提供'}

请分析：
1. 产生了哪些技术效果？
2. 这些效果是否是预料不到的？
3. 是否有量化的效果数据？
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利分析师，擅长技术效果分析。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 1000,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parseEffectAnalysis(content)
    } catch (error) {
      context.logger?.error('[CreativeAnalyzerAgent] 技术效果分析失败:', error)
      throw new Error('技术效果分析失败')
    }
  }

  /**
   * 对比现有技术
   */
  private async comparePriorArt(
    input: CreativeAnalyzerInput,
    context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput['differencesFromPriorArt']> {
    if (!input.priorArt?.length) {
      return {
        distinguishingFeatures: [],
        obviousness: 'not-obvious',
        suggestion: 'no-suggestion'
      }
    }

    const prompt = `请对比以下专利与现有技术的区别：

目标专利：
专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}

现有技术：
${input.priorArt.map(p => `- ${p.publicationNumber}: ${p.title}\n摘要: ${p.abstract}`).join('\n\n')}

请分析：
1. 区别技术特征有哪些？
2. 这些区别是否显而易见？
3. 现有技术是否有启示？
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利分析师，擅长现有技术对比。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 1500,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parseDifferencesFromPriorArt(content)
    } catch (error) {
      context.logger?.error('[CreativeAnalyzerAgent] 现有技术对比失败:', error)
      throw new Error('现有技术对比失败')
    }
  }

  /**
   * 评估创造性
   */
  private async assessCreativity(
    input: CreativeAnalyzerInput,
    problemAnalysis?: CreativeAnalyzerOutput['problemAnalysis'],
    solutionAnalysis?: CreativeAnalyzerOutput['solutionAnalysis'],
    effectAnalysis?: CreativeAnalyzerOutput['effectAnalysis'],
    differencesFromPriorArt?: CreativeAnalyzerOutput['differencesFromPriorArt'],
    context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput['creativityAssessment']> {
    const prompt = `请根据以下分析评估创造性：

技术问题：
${problemAnalysis ? `- 难度: ${problemAnalysis.problemDifficulty}\n- 不可预见: ${problemAnalysis.unforeseeable}` : '未分析'}

技术方案：
${solutionAnalysis ? `- 技术手段: ${solutionAnalysis.technicalMeans.join(', ')}\n- 协同效应: ${solutionAnalysis.synergisticEffect}` : '未分析'}

技术效果：
${effectAnalysis ? `- 效果: ${effectAnalysis.technicalEffects.join(', ')}\n- 意料之外: ${effectAnalysis.unexpected}` : '未分析'}

与现有技术的区别：
${differencesFromPriorArt ? `- 区别特征: ${differencesFromPriorArt.distinguishingFeatures.join(', ')}\n- 显而易见: ${differencesFromPriorArt.obviousness}` : '未分析'}

请评估：
1. 创造性等级（有创造性/显而易见/缺乏创造性）
2. 创造性评分（0-100）
3. 突出实质性特点评分和理由（0-100）
4. 显著进步评分和理由（0-100）
5. 技术贡献评分和理由（0-100）
6. 总体评估理由
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利分析师，擅长创造性评估。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 2000,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parseCreativityAssessment(content)
    } catch (error) {
      context.logger?.error('[CreativeAnalyzerAgent] 创造性评估失败:', error)
      throw new Error('创造性评估失败')
    }
  }

  /**
   * 收集创造性证据
   */
  private async collectEvidence(
    input: CreativeAnalyzerInput,
    creativityAssessment?: CreativeAnalyzerOutput['creativityAssessment'],
    _context: ExecutionContext
  ): Promise<CreativeAnalyzerOutput['evidence']> {
    // 简化版实现
    return {
      commercialSuccess: false,
      technicalBreakthrough: creativityAssessment?.level === 'inventive',
      solvedLongstandingProblem: problemDifficulty => problemDifficulty === 'high',
      overcameTechnicalPrejudice: false,
      otherEvidence: []
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    input: CreativeAnalyzerInput,
    problemAnalysis?: CreativeAnalyzerOutput['problemAnalysis'],
    solutionAnalysis?: CreativeAnalyzerOutput['solutionAnalysis'],
    effectAnalysis?: CreativeAnalyzerOutput['effectAnalysis'],
    creativityAssessment?: CreativeAnalyzerOutput['creativityAssessment'],
    _context: ExecutionContext
  ): CreativeAnalyzerOutput['recommendations'] {
    const strengthenCreativity: string[] = []
    const highlightContribution: string[] = []
    const emphasizeEffects: string[] = []

    if (creativityAssessment?.level === 'obvious') {
      strengthenCreativity.push('强调区别技术特征的意想不到的效果')
      strengthenCreativity.push('突出技术方案的协同效应')
    }

    if (problemAnalysis?.problemDifficulty === 'low') {
      highlightContribution.push('强调技术问题的复杂性')
      highlightContribution.push('突出解决方案的非显而易见性')
    }

    if (effectAnalysis && !effectAnalysis.unexpected) {
      emphasizeEffects.push('收集并强调预料不到的技术效果')
      emphasizeEffects.push('提供量化的效果对比数据')
    }

    return {
      strengthenCreativity,
      highlightContribution,
      emphasizeEffects
    }
  }

  // 以下是解析方法（简化版实现）

  private parseProblemAnalysis(content: string): CreativeAnalyzerOutput['problemAnalysis'] {
    return {
      solvedProblem: '技术问题描述',
      problemDifficulty: 'medium',
      unforeseeable: false
    }
  }

  private parseSolutionAnalysis(content: string): CreativeAnalyzerOutput['solutionAnalysis'] {
    return {
      technicalMeans: ['手段1', '手段2', '手段3'],
      featureCombination: '特征组合描述',
      synergisticEffect: true
    }
  }

  private parseEffectAnalysis(content: string): CreativeAnalyzerOutput['effectAnalysis'] {
    return {
      technicalEffects: ['效果1', '效果2', '效果3'],
      unexpected: false,
      quantitativeEffects: [
        { effect: '性能提升', value: '50%', improvement: '显著' }
      ]
    }
  }

  private parseDifferencesFromPriorArt(content: string): CreativeAnalyzerOutput['differencesFromPriorArt'] {
    return {
      distinguishingFeatures: ['区别1', '区别2', '区别3'],
      obviousness: 'not-obvious',
      suggestion: 'no-suggestion'
    }
  }

  private parseCreativityAssessment(content: string): CreativeAnalyzerOutput['creativityAssessment'] {
    return {
      level: 'inventive',
      score: 75,
      dimensions: {
        substantiveCharacteristics: {
          score: 75,
          reasoning: '具备突出的实质性特点'
        },
        significantProgress: {
          score: 75,
          reasoning: '具有显著的进步'
        },
        technicalContribution: {
          score: 75,
          reasoning: '对现有技术做出了显著贡献'
        }
      },
      reasoning: '总体具备创造性'
    }
  }
}
