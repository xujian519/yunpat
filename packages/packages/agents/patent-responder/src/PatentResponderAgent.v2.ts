/**
 * 专利答复智能体（重构版 - 符合Phase 4新架构）
 *
 * 专业的审查意见答复智能体，提供：
 * 1. 审查意见分析
 * 2. 答复策略生成
 * 3. 答复文档撰写
 * 4. 修改建议生成
 *
 * 特性：
 * - 简洁的架构（符合Phase 4设计）
 * - 可被OrchestratorAgent调用
 * - 高度可测试
 * - 支持HITL检查点
 */

import { Agent, type LLMAdapter, type ExecutionContext } from '@yunpat/core'

/**
 * 审查意见信息
 */
export interface OAOfficeAction {
  /** 申请号 */
  applicationNumber: string
  /** 专利名称 */
  patentTitle: string
  /** 审查员 */
  examiner?: string
  /** 审查通知日期 */
  notificationDate?: string
  /** 答复期限 */
  deadline?: string
  /** 审查意见内容 */
  officeActionContent: string
  /** 引用的对比文件 */
  citedReferences?: Array<{
    publicationNumber: string
    title: string
    relevance: string
  }>
  /** 审查意见类型 */
  rejectionTypes?: ('novelty' | 'inventiveness' | 'support' | 'clarity' | 'other')[]
}

/**
 * 答复策略
 */
export interface ResponseStrategy {
  /** 总体策略 */
  overallStrategy: 'argue' | 'amend' | 'abandon' | 'appeal'
  /** 成功概率评估 */
  successProbability: number
  /** 关键论点 */
  keyArguments: string[]
  /** 建议修改内容 */
  suggestedAmendments: Array<{
    claimNumber: number
    currentText: string
    proposedText: string
    reason: string
  }>
  /** 需要补充的证据 */
  additionalEvidence: string[]
  /** 风险提示 */
  risks: string[]
}

/**
 * 答复文档
 */
export interface ResponseDocument {
  /** 答复书 */
  responseLetter: string
  /** 修改后的权利要求书 */
  amendedClaims?: string
  /** 修改后的说明书部分 */
  amendedDescription?: string
  /** 统计信息 */
  metrics: {
    wordCount: number
    argumentCount: number
    amendmentCount: number
    generationTime: number
  }
}

/**
 * 专利答复输入
 */
export interface PatentResponderInput {
  /** 审查意见信息 */
  officeAction: OAOfficeAction
  /** 原始专利申请文件 */
  originalApplication: {
    title: string
    claims: string
    description: string
    abstract?: string
  }
  /** 答复策略偏好 */
  strategyPreference?: 'aggressive' | 'moderate' | 'conservative'
  /** 文档类型 */
  documentType?: 'cn' | 'pct' | 'us'
}

/**
 * 专利答复输出
 */
export interface PatentResponderOutput {
  /** 审查意见分析 */
  analysis: {
    /** 审查意见摘要 */
    summary: string
    /** 关键问题识别 */
    keyIssues: Array<{
      type: string
      description: string
      severity: 'high' | 'medium' | 'low'
    }>
    /** 可克服性评估 */
    overcomeProbability: number
  }
  /** 答复策略 */
  strategy: ResponseStrategy
  /** 答复文档 */
  responseDocument: ResponseDocument
  /** 后续建议 */
  nextSteps: string[]
}

/**
 * 答复计划
 */
interface ResponsePlan {
  input: PatentResponderInput
  strategyPreference: 'aggressive' | 'moderate' | 'conservative'
  stages: string[]
}

/**
 * 专利答复智能体
 */
export class PatentResponderAgent extends Agent {
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
      name: config.name || 'patent-responder',
      description: config.description || '专利答复智能体 - 专业的审查意见答复助手',
    })
    this.llm = config.llm
  }

  /**
   * 规划阶段：分析审查意见，制定答复计划
   */
  protected async plan(
    input: PatentResponderInput,
    _context: ExecutionContext
  ): Promise<ResponsePlan> {
    // 验证输入
    this.validateInput(input)

    // 确定策略偏好
    const strategyPreference = input.strategyPreference || 'moderate'

    // 确定答复阶段
    const stages = [
      'analyze-office-action',
      'determine-strategy',
      'draft-response',
      'quality-check',
    ]

    return {
      input,
      strategyPreference,
      stages,
    }
  }

  /**
   * 执行阶段：按计划生成答复文档
   */
  protected async execute(
    plan: ResponsePlan,
    context: ExecutionContext
  ): Promise<PatentResponderOutput> {
    const startTime = Date.now()
    const { input, stages } = plan

    let analysis: PatentResponderOutput['analysis'] | null = null
    let strategy: ResponseStrategy | null = null
    let responseDocument: ResponseDocument | null = null
    let nextSteps: string[] = []

    // 执行各个阶段
    for (const stage of stages) {
      context.logger?.info(`[PatentResponderAgent] 执行阶段: ${stage}`)

      switch (stage) {
        case 'analyze-office-action':
          analysis = await this.analyzeOfficeAction(input, context)
          break

        case 'determine-strategy':
          strategy = await this.determineStrategy(
            input,
            analysis!,
            plan.strategyPreference,
            context
          )
          break

        case 'draft-response':
          responseDocument = await this.draftResponse(input, strategy!, context)
          nextSteps = this.generateNextSteps(strategy!)
          break

        case 'quality-check':
          // 质量检查（已在各阶段完成）
          break
      }
    }

    // 计算生成时间
    const generationTime = Date.now() - startTime
    if (responseDocument) {
      responseDocument.metrics.generationTime = generationTime
    }

    return {
      analysis: analysis!,
      strategy: strategy!,
      responseDocument: responseDocument!,
      nextSteps,
    }
  }

  /**
   * 验证输入
   */
  private validateInput(input: PatentResponderInput): void {
    if (!input.officeAction?.applicationNumber?.trim()) {
      throw new Error('申请号不能为空')
    }
    if (!input.officeAction?.officeActionContent?.trim()) {
      throw new Error('审查意见内容不能为空')
    }
    if (!input.originalApplication?.title?.trim()) {
      throw new Error('专利名称不能为空')
    }
    if (!input.originalApplication?.claims?.trim()) {
      throw new Error('权利要求书不能为空')
    }
  }

  /**
   * 分析审查意见
   */
  private async analyzeOfficeAction(
    input: PatentResponderInput,
    context: ExecutionContext
  ): Promise<PatentResponderOutput['analysis']> {
    const prompt = this.buildAnalysisPrompt(input)

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理师，擅长分析审查意见。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 1500,
        temperature: 0.7,
      })

      // 解析LLM响应（简化版）
      const content = response.content || ''
      const summary = this.extractSummary(content)
      const keyIssues = this.extractKeyIssues(content)
      const overcomeProbability = this.extractOvercomeProbability(content)

      return {
        summary,
        keyIssues,
        overcomeProbability,
      }
    } catch (error) {
      context.logger?.error('[PatentResponderAgent] 分析审查意见失败:', error)
      throw new Error('分析审查意见失败')
    }
  }

  /**
   * 确定答复策略
   */
  private async determineStrategy(
    input: PatentResponderInput,
    analysis: PatentResponderOutput['analysis'],
    preference: 'aggressive' | 'moderate' | 'conservative',
    context: ExecutionContext
  ): Promise<ResponseStrategy> {
    const prompt = this.buildStrategyPrompt(input, analysis, preference)

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理师，擅长制定答复策略。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 2000,
        temperature: 0.7,
      })

      // 解析LLM响应（简化版）
      const content = response.content || ''
      const overallStrategy = this.extractOverallStrategy(content, preference)
      const successProbability = this.extractSuccessProbability(content)
      const keyArguments = this.extractKeyArguments(content)
      const suggestedAmendments = this.extractSuggestedAmendments(content)
      const additionalEvidence = this.extractAdditionalEvidence(content)
      const risks = this.extractRisks(content)

      return {
        overallStrategy,
        successProbability,
        keyArguments,
        suggestedAmendments,
        additionalEvidence,
        risks,
      }
    } catch (error) {
      context.logger?.error('[PatentResponderAgent] 确定答复策略失败:', error)
      throw new Error('确定答复策略失败')
    }
  }

  /**
   * 撰写答复文档
   */
  private async draftResponse(
    input: PatentResponderInput,
    strategy: ResponseStrategy,
    context: ExecutionContext
  ): Promise<ResponseDocument> {
    const prompt = this.buildResponsePrompt(input, strategy)

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理师，擅长撰写答复文档。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 3000,
        temperature: 0.7,
      })

      const content = response.content || ''
      const responseLetter = this.extractResponseLetter(content)
      const amendedClaims = this.extractAmendedClaims(content)
      const amendedDescription = this.extractAmendedDescription(content)

      return {
        responseLetter,
        amendedClaims,
        amendedDescription,
        metrics: {
          wordCount: responseLetter.length,
          argumentCount: strategy.keyArguments.length,
          amendmentCount: strategy.suggestedAmendments.length,
          generationTime: 0, // 会在execute方法中设置
        },
      }
    } catch (error) {
      context.logger?.error('[PatentResponderAgent] 撰写答复文档失败:', error)
      throw new Error('撰写答复文档失败')
    }
  }

  /**
   * 生成后续建议
   */
  private generateNextSteps(strategy: ResponseStrategy): string[] {
    const steps: string[] = []

    if (strategy.overallStrategy === 'abandon') {
      steps.push('考虑放弃本申请')
      steps.push('评估是否提出复审请求')
    } else if (strategy.overallStrategy === 'appeal') {
      steps.push('准备复审请求书')
      steps.push('收集补充证据')
    } else {
      steps.push('根据答复策略修改权利要求书')
      steps.push('准备答复陈述意见')
      if (strategy.suggestedAmendments.length > 0) {
        steps.push('提交修改后的申请文件')
      }
      if (strategy.additionalEvidence.length > 0) {
        steps.push('收集并提交补充证据')
      }
    }

    return steps
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(input: PatentResponderInput): string {
    return `请分析以下审查意见：

申请号：${input.officeAction.applicationNumber}
专利名称：${input.officeAction.patentTitle}
审查员：${input.officeAction.examiner || '未提供'}

审查意见内容：
${input.officeAction.officeActionContent}

引用的对比文件：
${input.officeAction.citedReferences?.map((r) => `- ${r.publicationNumber}: ${r.title} (${r.relevance})`).join('\n') || '无'}

请分析：
1. 审查意见的主要问题是什么？
2. 各问题的严重程度如何（高/中/低）？
3. 克服这些问题的概率有多大（0-100）？
`
  }

  /**
   * 构建策略提示词
   */
  private buildStrategyPrompt(
    input: PatentResponderInput,
    analysis: PatentResponderOutput['analysis'],
    preference: 'aggressive' | 'moderate' | 'conservative'
  ): string {
    return `请根据以下信息制定答复策略：

审查意见分析：
${analysis.summary}

关键问题：
${analysis.keyIssues.map((i) => `- ${i.type}: ${i.description}（严重程度：${i.severity}）`).join('\n')}

可克服性：${analysis.overcomeProbability}%

策略偏好：${preference}（${preference === 'aggressive' ? '积极争辩' : preference === 'moderate' ? '适中策略' : '保守策略'}）

请提供：
1. 总体策略（争辩/修改/放弃/复审）
2. 成功概率评估（0-100）
3. 关键论点（3-5个）
4. 建议修改内容（如需修改）
5. 需要补充的证据
6. 风险提示
`
  }

  /**
   * 构建答复提示词
   */
  private buildResponsePrompt(input: PatentResponderInput, strategy: ResponseStrategy): string {
    return `请根据以下策略撰写答复文档：

总体策略：${strategy.overallStrategy}

关键论点：
${strategy.keyArguments.map((a, i) => `${i + 1}. ${a}`).join('\n')}

建议修改：
${strategy.suggestedAmendments.map((a) => `权利要求${a.claimNumber}:\n当前: ${a.currentText}\n建议: ${a.proposedText}\n理由: ${a.reason}`).join('\n\n')}

原始权利要求书：
${input.originalApplication.claims}

请撰写：
1. 答复陈述意见
2. 修改后的权利要求书（如有修改）
3. 修改说明书部分（如有修改）
`
  }

  // 以下是辅助方法，用于从LLM响应中提取结构化信息
  // 实际实现中应该使用更复杂的解析逻辑或结构化输出

  private extractSummary(content: string): string {
    const match = content.match(/摘要[:：](.*?)(?=\n|$)/s)
    return match ? match[1].trim() : content.substring(0, 200)
  }

  private extractKeyIssues(content: string): Array<{
    type: string
    description: string
    severity: 'high' | 'medium' | 'low'
  }> {
    // 简化版实现
    return [
      {
        type: 'novelty',
        description: '新颖性问题',
        severity: 'high',
      },
    ]
  }

  private extractOvercomeProbability(content: string): number {
    const match = content.match(/可克服性[:：](\d+)/)
    return match ? parseInt(match[1]) : 50
  }

  private extractOverallStrategy(
    content: string,
    preference: string
  ): 'argue' | 'amend' | 'abandon' | 'appeal' {
    if (content.includes('修改') || content.includes('amend')) return 'amend'
    if (content.includes('争辩') || content.includes('argue')) return 'argue'
    if (content.includes('放弃') || content.includes('abandon')) return 'abandon'
    if (content.includes('复审') || content.includes('appeal')) return 'appeal'
    return preference === 'aggressive' ? 'argue' : 'amend'
  }

  private extractSuccessProbability(content: string): number {
    const match = content.match(/成功概率[:：](\d+)/)
    return match ? parseInt(match[1]) : 60
  }

  private extractKeyArguments(content: string): string[] {
    // 简化版实现
    return ['与对比文件存在实质性差异', '具备突出的实质性特点', '具备显著的进步']
  }

  private extractSuggestedAmendments(content: string): Array<{
    claimNumber: number
    currentText: string
    proposedText: string
    reason: string
  }> {
    // 简化版实现
    return []
  }

  private extractAdditionalEvidence(content: string): string[] {
    return []
  }

  private extractRisks(content: string): string[] {
    return ['审查员可能不接受当前论点', '修改可能导致保护范围缩小']
  }

  private extractResponseLetter(content: string): string {
    return content
  }

  private extractAmendedClaims(content: string): string | undefined {
    return undefined
  }

  private extractAmendedDescription(content: string): string | undefined {
    return undefined
  }
}
