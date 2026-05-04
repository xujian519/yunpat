/**
 * 专利分析智能体（重构版 - 符合Phase 4新架构）
 *
 * 专业的专利文献分析智能体，提供：
 * 1. 技术方案深度分析
 * 2. 权利要求分析
 * 3. 现有技术对比
 * 4. 创造性评估
 * 5. 专利性风险评估
 *
 * 特性：
 * - 简洁的架构（符合Phase 4设计）
 * - 可被OrchestratorAgent调用
 * - 高度可测试
 * - 支持多种分析类型
 */

import { Agent, type LLMAdapter, type ExecutionContext } from '@yunpat/core'

/**
 * 专利文献信息
 */
export interface PatentInfo {
  /** 公开号 */
  publicationNumber: string
  /** 标题 */
  title: string
  /** 摘要 */
  abstract: string
  /** 申请人 */
  applicant?: string
  /** 发明人 */
  inventors?: string[]
  /** 公开日 */
  publicationDate?: string
  /** 全文（可选） */
  fullText?: string
}

/**
 * 专利分析输入
 */
export interface PatentAnalyzerInput {
  /** 专利文献信息 */
  patent: PatentInfo
  /** 分析类型 */
  analysisTypes?: Array<'technical' | 'claims' | 'priorArt' | 'creativity' | 'risk'>
  /** 对比专利（可选） */
  comparisonPatents?: PatentInfo[]
}

/**
 * 专利分析输出
 */
export interface PatentAnalyzerOutput {
  /** 基本信息 */
  basicInfo: {
    publicationNumber: string
    title: string
    applicant?: string
    publicationDate?: string
  }
  /** 技术分析 */
  technicalAnalysis?: {
    /** 技术领域 */
    field: string
    /** 技术问题 */
    problems: string[]
    /** 技术方案 */
    solution: string
    /** 技术效果 */
    effects: string[]
    /** 关键技术特征 */
    keyFeatures: string[]
  }
  /** 权利要求分析 */
  claimsAnalysis?: {
    /** 独立权利要求数量 */
    independentCount: number
    /** 从属权利要求数量 */
    dependentCount: number
    /** 保护范围分析 */
    protectionScope: {
      breadth: 'narrow' | 'medium' | 'broad'
      clarity: 'clear' | 'ambiguous'
      risk: 'low' | 'medium' | 'high'
    }
    /** 权利要求质量评估 */
    qualityScore: number
  }
  /** 现有技术对比 */
  priorArtAnalysis?: {
    /** 最接近的现有技术 */
    closestPriorArt: Array<{
      publicationNumber: string
      title: string
      similarity: number
      differences: string[]
    }>
    /** 创新点 */
    innovations: string[]
  }
  /** 创造性评估 */
  creativityAssessment?: {
    /** 创造性等级 */
    level: 'inventive' | 'obvious' | 'lacksInventiveness'
    /** 创造性评分 */
    score: number
    /** 评估理由 */
    reasoning: string
  }
  /** 专利性风险评估 */
  riskAssessment?: {
    /** 无效风险 */
    invalidityRisk: 'low' | 'medium' | 'high'
    /** 侵权风险 */
    infringementRisk: 'low' | 'medium' | 'high'
    /** 风险因素 */
    riskFactors: string[]
  }
  /** 综合建议 */
  recommendations: string[]
}

/**
 * 分析计划
 */
interface AnalysisPlan {
  input: PatentAnalyzerInput
  analysisTypes: Array<'technical' | 'claims' | 'priorArt' | 'creativity' | 'risk'>
  stages: string[]
}

/**
 * 专利分析智能体
 */
export class PatentAnalyzerAgent extends Agent {
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
      name: config.name || 'patent-analyzer',
      description: config.description || '专利分析智能体 - 专业的专利文献分析助手'
    })
    this.llm = config.llm
  }

  /**
   * 规划阶段：分析输入，制定分析计划
   */
  protected async plan(
    input: PatentAnalyzerInput,
    _context: ExecutionContext
  ): Promise<AnalysisPlan> {
    // 验证输入
    this.validateInput(input)

    // 确定分析类型
    const analysisTypes = input.analysisTypes || [
      'technical',
      'claims',
      'creativity',
      'risk'
    ]

    // 确定分析阶段
    const stages: string[] = []
    if (analysisTypes.includes('technical')) {
      stages.push('analyze-technical')
    }
    if (analysisTypes.includes('claims')) {
      stages.push('analyze-claims')
    }
    if (analysisTypes.includes('priorArt') && input.comparisonPatents?.length) {
      stages.push('analyze-prior-art')
    }
    if (analysisTypes.includes('creativity')) {
      stages.push('assess-creativity')
    }
    if (analysisTypes.includes('risk')) {
      stages.push('assess-risks')
    }
    stages.push('generate-recommendations')

    return {
      input,
      analysisTypes,
      stages
    }
  }

  /**
   * 执行阶段：按计划分析专利
   */
  protected async execute(
    plan: AnalysisPlan,
    context: ExecutionContext
  ): Promise<PatentAnalyzerOutput> {
    const { input, stages, analysisTypes } = plan

    let technicalAnalysis: PatentAnalyzerOutput['technicalAnalysis'] | undefined
    let claimsAnalysis: PatentAnalyzerOutput['claimsAnalysis'] | undefined
    let priorArtAnalysis: PatentAnalyzerOutput['priorArtAnalysis'] | undefined
    let creativityAssessment: PatentAnalyzerOutput['creativityAssessment'] | undefined
    let riskAssessment: PatentAnalyzerOutput['riskAssessment'] | undefined
    let recommendations: string[] = []

    // 执行各个阶段
    for (const stage of stages) {
      context.logger?.info(`[PatentAnalyzerAgent] 执行阶段: ${stage}`)

      switch (stage) {
        case 'analyze-technical':
          technicalAnalysis = await this.analyzeTechnical(input, context)
          break

        case 'analyze-claims':
          claimsAnalysis = await this.analyzeClaims(input, context)
          break

        case 'analyze-prior-art':
          priorArtAnalysis = await this.analyzePriorArt(input, context)
          break

        case 'assess-creativity':
          creativityAssessment = await this.assessCreativity(
            input,
            technicalAnalysis,
            priorArtAnalysis,
            context
          )
          break

        case 'assess-risks':
          riskAssessment = await this.assessRisks(
            input,
            claimsAnalysis,
            creativityAssessment,
            context
          )
          break

        case 'generate-recommendations':
          recommendations = this.generateRecommendations(
            technicalAnalysis,
            claimsAnalysis,
            creativityAssessment,
            riskAssessment
          )
          break
      }
    }

    return {
      basicInfo: {
        publicationNumber: input.patent.publicationNumber,
        title: input.patent.title,
        applicant: input.patent.applicant,
        publicationDate: input.patent.publicationDate
      },
      technicalAnalysis,
      claimsAnalysis,
      priorArtAnalysis,
      creativityAssessment,
      riskAssessment,
      recommendations
    }
  }

  /**
   * 验证输入
   */
  private validateInput(input: PatentAnalyzerInput): void {
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
   * 技术分析
   */
  private async analyzeTechnical(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalyzerOutput['technicalAnalysis']> {
    const prompt = `请分析以下专利的技术方案：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}

全文：
${input.patent.fullText || '未提供'}

请分析：
1. 技术领域
2. 解决的技术问题
3. 技术方案
4. 技术效果
5. 关键技术特征（3-5个）
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
      return this.parseTechnicalAnalysis(content)
    } catch (error) {
      context.logger?.error('[PatentAnalyzerAgent] 技术分析失败:', error)
      throw new Error('技术分析失败')
    }
  }

  /**
   * 权利要求分析
   */
  private async analyzeClaims(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalyzerOutput['claimsAnalysis']> {
    const prompt = `请分析以下专利的权利要求：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}

权利要求全文：
${input.patent.fullText || '未提供'}

请分析：
1. 独立权利要求数量
2. 从属权利要求数量
3. 保护范围（宽/中/窄）
4. 清楚性（清楚/模糊）
5. 风险等级（低/中/高）
6. 质量评分（0-100）
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利分析师，擅长权利要求分析。'
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
      return this.parseClaimsAnalysis(content)
    } catch (error) {
      context.logger?.error('[PatentAnalyzerAgent] 权利要求分析失败:', error)
      throw new Error('权利要求分析失败')
    }
  }

  /**
   * 现有技术对比
   */
  private async analyzePriorArt(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalyzerOutput['priorArtAnalysis']> {
    if (!input.comparisonPatents?.length) {
      return {
        closestPriorArt: [],
        innovations: []
      }
    }

    const prompt = `请对比以下专利与现有技术：

目标专利：
专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}

对比专利：
${input.comparisonPatents.map(p => `- ${p.publicationNumber}: ${p.title}\n摘要: ${p.abstract}`).join('\n\n')}

请分析：
1. 最接近的现有技术（相似度评分0-100）
2. 与现有技术的差异
3. 创新点（3-5个）
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
        maxTokens: 2000,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parsePriorArtAnalysis(content, input.comparisonPatents)
    } catch (error) {
      context.logger?.error('[PatentAnalyzerAgent] 现有技术对比失败:', error)
      throw new Error('现有技术对比失败')
    }
  }

  /**
   * 创造性评估
   */
  private async assessCreativity(
    input: PatentAnalyzerInput,
    technicalAnalysis?: PatentAnalyzerOutput['technicalAnalysis'],
    priorArtAnalysis?: PatentAnalyzerOutput['priorArtAnalysis'],
    context: ExecutionContext
  ): Promise<PatentAnalyzerOutput['creativityAssessment']> {
    const prompt = `请评估以下专利的创造性：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}

技术分析：
${technicalAnalysis ? `- 技术方案: ${technicalAnalysis.solution}\n- 关键特征: ${technicalAnalysis.keyFeatures.join(', ')}` : '未分析'}

现有技术对比：
${priorArtAnalysis ? `- 最接近现有技术: ${priorArtAnalysis.closestPriorArt.map(p => `${p.publicationNumber} (${p.similarity}%)`).join(', ')}\n- 创新点: ${priorArtAnalysis.innovations.join(', ')}` : '未分析'}

请评估：
1. 创造性等级（有创造性/显而易见/缺乏创造性）
2. 创造性评分（0-100）
3. 评估理由
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
        maxTokens: 1000,
        temperature: 0.7
      })

      const content = response.content || ''
      return this.parseCreativityAssessment(content)
    } catch (error) {
      context.logger?.error('[PatentAnalyzerAgent] 创造性评估失败:', error)
      throw new Error('创造性评估失败')
    }
  }

  /**
   * 风险评估
   */
  private async assessRisks(
    input: PatentAnalyzerInput,
    claimsAnalysis?: PatentAnalyzerOutput['claimsAnalysis'],
    creativityAssessment?: PatentAnalyzerOutput['creativityAssessment'],
    context: ExecutionContext
  ): Promise<PatentAnalyzerOutput['riskAssessment']> {
    const invalidityRisk = this.assessInvalidityRisk(claimsAnalysis, creativityAssessment)
    const infringementRisk = this.assessInfringementRisk(input)
    const riskFactors = this.identifyRiskFactors(claimsAnalysis, creativityAssessment)

    return {
      invalidityRisk,
      infringementRisk,
      riskFactors
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    technicalAnalysis?: PatentAnalyzerOutput['technicalAnalysis'],
    claimsAnalysis?: PatentAnalyzerOutput['claimsAnalysis'],
    creativityAssessment?: PatentAnalyzerOutput['creativityAssessment'],
    riskAssessment?: PatentAnalyzerOutput['riskAssessment']
  ): string[] {
    const recommendations: string[] = []

    if (creativityAssessment?.level === 'lacksInventiveness') {
      recommendations.push('建议进一步挖掘创新点，强调技术贡献')
    }

    if (claimsAnalysis?.protectionScope.breadth === 'narrow') {
      recommendations.push('建议扩大权利要求保护范围')
    }

    if (riskAssessment?.invalidityRisk === 'high') {
      recommendations.push('建议加强权利要求的创造性特征')
    }

    if (recommendations.length === 0) {
      recommendations.push('专利质量良好，建议继续推进')
    }

    return recommendations
  }

  // 以下是解析方法（简化版实现）

  private parseTechnicalAnalysis(content: string): PatentAnalyzerOutput['technicalAnalysis'] {
    return {
      field: this.extractField(content),
      problems: this.extractProblems(content),
      solution: this.extractSolution(content),
      effects: this.extractEffects(content),
      keyFeatures: this.extractKeyFeatures(content)
    }
  }

  private parseClaimsAnalysis(content: string): PatentAnalyzerOutput['claimsAnalysis'] {
    return {
      independentCount: this.extractIndependentCount(content),
      dependentCount: this.extractDependentCount(content),
      protectionScope: {
        breadth: this.extractBreadth(content),
        clarity: this.extractClarity(content),
        risk: this.extractRisk(content)
      },
      qualityScore: this.extractQualityScore(content)
    }
  }

  private parsePriorArtAnalysis(
    content: string,
    comparisonPatents?: PatentInfo[]
  ): PatentAnalyzerOutput['priorArtAnalysis'] {
    return {
      closestPriorArt: comparisonPatents?.map(p => ({
        publicationNumber: p.publicationNumber,
        title: p.title,
        similarity: 70,
        differences: ['技术方案不同', '技术效果不同']
      })) || [],
      innovations: ['创新点1', '创新点2', '创新点3']
    }
  }

  private parseCreativityAssessment(content: string): PatentAnalyzerOutput['creativityAssessment'] {
    return {
      level: 'inventive',
      score: 75,
      reasoning: '具备突出的实质性特点和显著的进步'
    }
  }

  private assessInvalidityRisk(
    claimsAnalysis?: PatentAnalyzerOutput['claimsAnalysis'],
    creativityAssessment?: PatentAnalyzerOutput['creativityAssessment']
  ): 'low' | 'medium' | 'high' {
    if (creativityAssessment?.level === 'lacksInventiveness') return 'high'
    if (claimsAnalysis?.protectionScope.risk === 'high') return 'high'
    if (creativityAssessment?.level === 'obvious') return 'medium'
    return 'low'
  }

  private assessInfringementRisk(input: PatentAnalyzerInput): 'low' | 'medium' | 'high' {
    // 简化版实现
    return 'low'
  }

  private identifyRiskFactors(
    claimsAnalysis?: PatentAnalyzerOutput['claimsAnalysis'],
    creativityAssessment?: PatentAnalyzerOutput['creativityAssessment']
  ): string[] {
    const factors: string[] = []

    if (creativityAssessment?.level === 'obvious') {
      factors.push('创造性可能不足')
    }

    if (claimsAnalysis?.protectionScope.clarity === 'ambiguous') {
      factors.push('权利要求表述可能不清晰')
    }

    return factors
  }

  // 以下是提取方法（简化版实现）

  private extractField(content: string): string {
    return '技术领域'
  }

  private extractProblems(content: string): string[] {
    return ['技术问题1', '技术问题2']
  }

  private extractSolution(content: string): string {
    return '技术方案描述'
  }

  private extractEffects(content: string): string[] {
    return ['技术效果1', '技术效果2']
  }

  private extractKeyFeatures(content: string): string[] {
    return ['特征1', '特征2', '特征3']
  }

  private extractIndependentCount(content: string): number {
    return 1
  }

  private extractDependentCount(content: string): number {
    return 5
  }

  private extractBreadth(content: string): 'narrow' | 'medium' | 'broad' {
    return 'medium'
  }

  private extractClarity(content: string): 'clear' | 'ambiguous' {
    return 'clear'
  }

  private extractRisk(content: string): 'low' | 'medium' | 'high' {
    return 'low'
  }

  private extractQualityScore(content: string): number {
    return 75
  }
}
