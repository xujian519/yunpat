/**
 * 专利答复智能体 v4.0 - 增强版
 *
 * 专业的审查意见答复智能体，提供：
 * 1. 增强的 OA 解析（支持多种格式）
 * 2. 智能策略推荐（基于历史案例）
 * 3. 成功率预测（机器学习）
 * 4. 答复模板系统（可扩展）
 * 5. 历史案例学习（持续优化）
 *
 * @package @yunpat/agent-patent-responder
 */

import { ProfessionalAgent, type ExtendedExecutionContext } from '@yunpat/agent-base'
import type { LLMAdapter } from '@yunpat/core'

// 导入所有模块
import { OAParser, type OARawData } from './parsing/index.js'
import { StrategyRecommender } from './strategy/index.js'
import { ResponseTemplateManager } from './template/index.js'
import { SuccessPredictor } from './prediction/index.js'
import { CaseLearner } from './learning/index.js'

// 导入类型
import type { OAParseResult, StrategyRecommendation, SuccessPrediction } from './types/index.js'
import { ResponseStrategy } from './types/index.js'

// 本地定义这些类型（从 v3 迁移）
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
    relevanceLevel?: number
  }>
  /** 审查意见类型 */
  rejectionTypes?: Array<'novelty' | 'inventiveness' | 'support' | 'clarity' | 'other'>
}

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
  strategy: {
    /** 总体策略 */
    overallStrategy: ResponseStrategy
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
  /** 答复文档 */
  responseDocument: ResponseDocument
  /** 后续建议 */
  nextSteps: string[]
}

/**
 * 答复计划
 */
export interface ResponsePlan {
  /** 输入数据 */
  input: PatentResponderInput
  /** 策略偏好 */
  strategyPreference: 'aggressive' | 'moderate' | 'conservative'
  /** 答复阶段 */
  stages: Array<
    | 'parse-oa'
    | 'predict-success'
    | 'recommend-strategy'
    | 'select-template'
    | 'draft-response'
    | 'assess-quality'
  >
}

/**
 * 答复上下文（包含中间结果）
 */
interface ResponseContext extends ExtendedExecutionContext {
  /** OA 解析结果 */
  parseResult?: OAParseResult
  /** 成功预测 */
  prediction?: SuccessPrediction
  /** 策略推荐 */
  recommendation?: StrategyRecommendation
}

/**
 * 专利答复智能体配置
 */
export interface PatentResponderConfig {
  /** LLM 适配器 */
  llm: LLMAdapter
  /** 事件总线 */
  eventBus: any
  /** 记忆存储 */
  memory: any
  /** 工具注册表 */
  tools: any
  /** 智能体名称 */
  name?: string
  /** 智能体描述 */
  description?: string
  /** OA 解析器配置 */
  parserConfig?: ConstructorParameters<typeof OAParser>[0]
  /** 策略推荐器配置 */
  recommenderConfig?: ConstructorParameters<typeof StrategyRecommender>[0]
  /** 模板管理器配置 */
  templateConfig?: ConstructorParameters<typeof ResponseTemplateManager>[0]
  /** 预测器配置 */
  predictorConfig?: ConstructorParameters<typeof SuccessPredictor>[0]
  /** 案例学习器配置 */
  learnerConfig?: ConstructorParameters<typeof CaseLearner>[0]
  /** 是否启用所有增强功能 */
  enableEnhancements?: boolean
  /** 是否启用知识图谱 */
  enableKnowledgeGraph?: boolean
}

/**
 * 专利答复智能体 v4.0
 */
export class PatentResponderAgent extends ProfessionalAgent<
  PatentResponderInput,
  PatentResponderOutput
> {
  // 子模块
  private oaParser: OAParser
  private strategyRecommender: StrategyRecommender
  private templateManager: ResponseTemplateManager
  private successPredictor: SuccessPredictor
  private caseLearner: CaseLearner

  // 配置
  private enableEnhancements: boolean

  constructor(config: PatentResponderConfig) {
    super({
      name: config.name || 'patent-responder',
      description: config.description || '专利答复智能体 v4.0 - 增强版',
      llm: config.llm,
      eventBus: config.eventBus,
      memory: config.memory,
      tools: config.tools,
      enableKnowledgeGraph: config.enableKnowledgeGraph,
    })

    this.enableEnhancements = config.enableEnhancements ?? true

    // 初始化子模块
    this.oaParser = new OAParser(config.parserConfig)
    this.strategyRecommender = new StrategyRecommender(config.recommenderConfig)
    this.templateManager = new ResponseTemplateManager(config.templateConfig)
    this.successPredictor = new SuccessPredictor(config.predictorConfig)
    this.caseLearner = new CaseLearner(config.learnerConfig)

    // 如果启用增强功能，初始化一些默认历史案例
    if (this.enableEnhancements) {
      this.initializeDefaultCases()
    }
  }

  /**
   * 初始化默认历史案例
   */
  private initializeDefaultCases(): void {
    // 这里可以添加一些默认的成功案例
    // 实际使用时应该从数据库加载
  }

  /**
   * 规划阶段：分析审查意见，制定答复计划
   */
  protected async plan(
    input: PatentResponderInput,
    _context: ExtendedExecutionContext
  ): Promise<ResponsePlan> {
    // 验证输入
    this.validateInput(input.officeAction as unknown as Record<string, unknown>, [
      'applicationNumber',
      'patentTitle',
      'officeActionContent',
    ])
    this.validateInput(input.originalApplication as unknown as Record<string, unknown>, [
      'title',
      'claims',
      'description',
    ])

    // 确定策略偏好
    const strategyPreference = input.strategyPreference || 'moderate'

    // 确定答复阶段
    const stages: ResponsePlan['stages'] = this.enableEnhancements
      ? [
          'parse-oa',
          'predict-success',
          'recommend-strategy',
          'select-template',
          'draft-response',
          'assess-quality',
        ]
      : ['parse-oa', 'recommend-strategy', 'draft-response']

    return {
      input,
      strategyPreference,
      stages,
    }
  }

  /**
   * 执行阶段：按计划生成答复文档
   */
  protected async act(
    plan: ResponsePlan,
    context: ExtendedExecutionContext
  ): Promise<PatentResponderOutput> {
    const startTime = Date.now()
    const { input, stages, strategyPreference } = plan

    // 创建答复上下文
    const responseContext = context as ResponseContext

    // 初始化输出
    const output: PatentResponderOutput = {
      analysis: {
        summary: '',
        keyIssues: [],
        overcomeProbability: 0,
      },
      strategy: {
        overallStrategy: ResponseStrategy.ARGUE,
        successProbability: 0,
        keyArguments: [],
        suggestedAmendments: [],
        additionalEvidence: [],
        risks: [],
      },
      responseDocument: {
        responseLetter: '',
        metrics: {
          wordCount: 0,
          argumentCount: 0,
          amendmentCount: 0,
          generationTime: 0,
        },
      },
      nextSteps: [],
    }

    // 执行各个答复阶段
    for (const stage of stages) {
      context.logger?.info(`[PatentResponderAgent v4.0] 执行阶段: ${stage}`)

      switch (stage) {
        case 'parse-oa':
          await this.executeParseOA(input, responseContext, context)
          break

        case 'predict-success':
          await this.executePredictSuccess(input, responseContext, context)
          break

        case 'recommend-strategy':
          await this.executeRecommendStrategy(input, strategyPreference, responseContext, context)
          break

        case 'select-template':
          await this.executeSelectTemplate(input, responseContext, context)
          break

        case 'draft-response':
          await this.executeDraftResponse(input, responseContext, output, context)
          break

        case 'assess-quality':
          await this.executeAssessQuality(input, output, context)
          break
      }
    }

    // 计算答复指标
    const duration = Date.now() - startTime
    output.responseDocument.metrics.generationTime = duration

    // 生成后续建议
    output.nextSteps = this.generateNextSteps(output, responseContext)

    context.logger?.info(`[PatentResponderAgent v4.0] 完成 (耗时 ${(duration / 1000).toFixed(1)}s)`)

    return output
  }

  /**
   * 执行 OA 解析
   */
  private async executeParseOA(
    input: PatentResponderInput,
    responseContext: ResponseContext,
    context: ExtendedExecutionContext
  ): Promise<void> {
    try {
      const rawData: OARawData = {
        applicationNumber: input.officeAction.applicationNumber,
        patentTitle: input.officeAction.patentTitle,
        content: input.officeAction.officeActionContent,
        documentType: input.documentType || 'cn',
        examiner: input.officeAction.examiner,
        notificationDate: input.officeAction.notificationDate,
        deadline: input.officeAction.deadline,
      }

      const parseResult = await this.oaParser.parse(rawData)
      responseContext.parseResult = parseResult

      context.logger?.info(
        `[OA解析] 识别到 ${parseResult.rejectionReasons.length} 个驳回理由，` +
          `置信度: ${(parseResult.confidence * 100).toFixed(0)}%`
      )
    } catch (error) {
      const message = this.formatErrorMessage(error, 'OA 解析失败')
      context.logger?.error(message)
      throw new Error(message)
    }
  }

  /**
   * 执行成功预测
   */
  private async executePredictSuccess(
    input: PatentResponderInput,
    responseContext: ResponseContext,
    context: ExtendedExecutionContext
  ): Promise<void> {
    if (!responseContext.parseResult) {
      throw new Error('OA 解析结果不存在')
    }

    try {
      // 首先进行初步策略推荐以用于预测
      const tempRecommendation = await this.strategyRecommender.recommend(
        responseContext.parseResult,
        input.strategyPreference
      )

      const prediction = await this.successPredictor.predict(
        responseContext.parseResult,
        tempRecommendation.strategy,
        1
      )

      responseContext.prediction = prediction

      context.logger?.info(
        `[成功预测] 预测成功率: ${prediction.overallProbability}%，` +
          `基于 ${prediction.basedOnCases} 个案例`
      )
    } catch (error) {
      context.logger?.warn(`[成功预测] 预测失败: ${error}`)
    }
  }

  /**
   * 执行策略推荐
   */
  private async executeRecommendStrategy(
    input: PatentResponderInput,
    strategyPreference: 'aggressive' | 'moderate' | 'conservative',
    responseContext: ResponseContext,
    context: ExtendedExecutionContext
  ): Promise<void> {
    if (!responseContext.parseResult) {
      throw new Error('OA 解析结果不存在')
    }

    try {
      const recommendation = await this.strategyRecommender.recommend(
        responseContext.parseResult,
        strategyPreference
      )

      responseContext.recommendation = recommendation

      context.logger?.info(
        `[策略推荐] 推荐策略: ${recommendation.strategy}，` +
          `成功概率: ${recommendation.successProbability}%`
      )
    } catch (error) {
      const message = this.formatErrorMessage(error, '策略推荐失败')
      context.logger?.error(message)
      throw new Error(message)
    }
  }

  /**
   * 执行模板选择
   */
  private async executeSelectTemplate(
    input: PatentResponderInput,
    responseContext: ResponseContext,
    context: ExtendedExecutionContext
  ): Promise<void> {
    if (!responseContext.parseResult || !responseContext.recommendation) {
      throw new Error('OA 解析结果或策略推荐不存在')
    }

    try {
      const template = this.templateManager.recommendTemplate(
        responseContext.parseResult,
        responseContext.recommendation,
        input.documentType || 'cn'
      )

      if (template) {
        context.logger?.info(`[模板选择] 选择模板: ${template.name}`)
      } else {
        context.logger?.info('[模板选择] 未找到匹配模板，将使用通用格式')
      }
    } catch (error) {
      context.logger?.warn(`[模板选择] 模板选择失败: ${error}`)
    }
  }

  /**
   * 执行答复撰写
   */
  private async executeDraftResponse(
    input: PatentResponderInput,
    responseContext: ResponseContext,
    output: PatentResponderOutput,
    context: ExtendedExecutionContext
  ): Promise<void> {
    if (!responseContext.parseResult || !responseContext.recommendation) {
      throw new Error('OA 解析结果或策略推荐不存在')
    }

    const { parseResult, recommendation } = responseContext

    try {
      // 准备模板变量
      const templateVars = this.prepareTemplateVariables(input, parseResult, recommendation)

      // 尝试使用模板渲染
      const template = this.templateManager.recommendTemplate(
        parseResult,
        recommendation,
        input.documentType || 'cn'
      )

      let responseLetter = ''

      if (template) {
        const renderResult = this.templateManager.renderTemplate(template.id, templateVars, {
          includeOpening: true,
          includeClosing: true,
        })
        responseLetter = renderResult.content
      } else {
        // 使用 LLM 生成答复
        responseLetter = await this.generateResponseWithLLM(
          input,
          parseResult,
          recommendation,
          context
        )
      }

      // 更新输出
      output.analysis = {
        summary: parseResult.summary,
        keyIssues: parseResult.rejectionReasons.map((r) => ({
          type: r.type,
          description: r.description,
          severity: r.severity,
        })),
        overcomeProbability: this.calculateOvercomeProbability(parseResult),
      }

      output.strategy = {
        overallStrategy: recommendation.strategy,
        successProbability: recommendation.successProbability,
        keyArguments: recommendation.keyArguments.map((a) => a.argument),
        suggestedAmendments: recommendation.amendmentSuggestions.map((amd) => ({
          claimNumber: amd.claimNumber,
          currentText: amd.currentText,
          proposedText: amd.proposedText,
          reason: amd.reason,
        })),
        additionalEvidence: recommendation.additionalEvidence,
        risks: recommendation.risks,
      }

      output.responseDocument = {
        responseLetter,
        amendedClaims: this.generateAmendedClaims(recommendation.amendmentSuggestions),
        metrics: {
          wordCount: responseLetter.length,
          argumentCount: recommendation.keyArguments.length,
          amendmentCount: recommendation.amendmentSuggestions.length,
          generationTime: 0,
        },
      }

      context.logger?.info(
        `[答复撰写] 生成答复文档，字数: ${responseLetter.length}，` +
          `论点数: ${recommendation.keyArguments.length}`
      )
    } catch (error) {
      const message = this.formatErrorMessage(error, '答复撰写失败')
      context.logger?.error(message)
      throw new Error(message)
    }
  }

  /**
   * 准备模板变量
   */
  private prepareTemplateVariables(
    input: PatentResponderInput,
    parseResult: OAParseResult,
    recommendation: StrategyRecommendation
  ): Record<string, string> {
    return {
      applicationNumber: parseResult.applicationNumber,
      patentTitle: parseResult.patentTitle,
      notificationDate: parseResult.notificationDate?.toLocaleDateString('zh-CN') || '',
      responseDate: new Date().toLocaleDateString('zh-CN'),
      claimNumbers: parseResult.affectedClaims.join(', ') || '全部',
      referenceNumber: parseResult.citedReferences[0]?.publicationNumber || 'D1',
      referenceContent: parseResult.citedReferences[0]?.title || '对比文件内容',
      distinguishingFeatures: recommendation.keyArguments[0]?.argument || '区别技术特征',
      technicalEffect: '技术效果',
      technicalProblem: '技术问题',
      technicalObstacle: '技术障碍',
      unexpectedEffects: '预料不到的技术效果',
      section: '说明书',
      originalText: input.originalApplication.claims.substring(0, 100),
      amendedText: '修改后的内容',
      addedFeature: '添加的特征',
      limitedAspect: '限定的方面',
    }
  }

  /**
   * 使用 LLM 生成答复
   */
  private async generateResponseWithLLM(
    input: PatentResponderInput,
    parseResult: OAParseResult,
    recommendation: StrategyRecommendation,
    context: ExtendedExecutionContext
  ): Promise<string> {
    const prompt = this.buildResponsePrompt(input, parseResult, recommendation)

    const response = await this.callLLM({
      messages: [
        {
          role: 'system',
          content: '你是一位专业的专利代理人，擅长撰写审查意见答复书。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      maxTokens: 3000,
    })

    return response
  }

  /**
   * 构建答复提示词
   */
  private buildResponsePrompt(
    input: PatentResponderInput,
    parseResult: OAParseResult,
    recommendation: StrategyRecommendation
  ): string {
    const parts: string[] = []

    parts.push('请根据以下信息撰写审查意见答复书：\n')
    parts.push(`申请号：${parseResult.applicationNumber}`)
    parts.push(`专利名称：${parseResult.patentTitle}`)
    parts.push(`\n审查意见摘要：\n${parseResult.summary}`)
    parts.push(`\n推荐策略：${recommendation.strategy}`)
    parts.push(`成功概率：${recommendation.successProbability}%`)
    parts.push(`\n关键论点：`)
    recommendation.keyArguments.forEach((arg, i) => {
      parts.push(`${i + 1}. ${arg.category}`)
      parts.push(`   ${arg.argument}`)
    })

    if (recommendation.amendmentSuggestions.length > 0) {
      parts.push(`\n修改建议：`)
      recommendation.amendmentSuggestions.forEach((amd) => {
        parts.push(`- 权利要求${amd.claimNumber}: ${amd.reason}`)
      })
    }

    parts.push(`\n请撰写一份正式、专业的答复书。`)

    return parts.join('\n')
  }

  /**
   * 生成修改后的权利要求书
   */
  private generateAmendedClaims(
    amendments: Array<{
      claimNumber: number
      proposedText: string
    }>
  ): string | undefined {
    if (amendments.length === 0) {
      return undefined
    }

    const parts: string[] = []
    parts.push('修改后的权利要求书：\n')

    // 按权利要求编号排序
    const sortedAmendments = [...amendments].sort((a, b) => a.claimNumber - b.claimNumber)

    for (const amd of sortedAmendments) {
      parts.push(`${amd.claimNumber}. ${amd.proposedText}`)
    }

    return parts.join('\n')
  }

  /**
   * 计算可克服概率
   */
  private calculateOvercomeProbability(parseResult: OAParseResult): number {
    if (parseResult.rejectionReasons.length === 0) {
      return 50
    }

    const sum = parseResult.rejectionReasons.reduce(
      (acc, r) => acc + (r.overcomeProbability || 50),
      0
    )

    return Math.round(sum / parseResult.rejectionReasons.length)
  }

  /**
   * 执行质量评估
   */
  private async executeAssessQuality(
    input: PatentResponderInput,
    output: PatentResponderOutput,
    context: ExtendedExecutionContext
  ): Promise<void> {
    // 检查答复质量
    const qualityScore = this.assessQuality(output)

    context.logger?.info(`[质量评估] 质量得分: ${qualityScore}/100`)

    // 如果质量得分过低，发出警告
    if (qualityScore < 60) {
      context.logger?.warn('[质量评估] 答复质量较低，建议人工复核')
    }
  }

  /**
   * 评估答复质量
   */
  private assessQuality(output: PatentResponderOutput): number {
    let score = 0

    // 论点数量 (30分)
    const argumentCount = output.strategy.keyArguments.length
    if (argumentCount >= 5) score += 30
    else if (argumentCount >= 3) score += 20
    else if (argumentCount >= 1) score += 10

    // 答复书长度 (20分)
    const wordCount = output.responseDocument.responseLetter.length
    if (wordCount >= 2000) score += 20
    else if (wordCount >= 1000) score += 15
    else if (wordCount >= 500) score += 10
    else score += 5

    // 风险评估 (20分)
    if (output.strategy.risks.length <= 2) score += 20
    else if (output.strategy.risks.length <= 4) score += 10
    else score += 5

    // 成功概率 (30分)
    if (output.strategy.successProbability >= 70) score += 30
    else if (output.strategy.successProbability >= 50) score += 20
    else if (output.strategy.successProbability >= 30) score += 10
    else score += 5

    return score
  }

  /**
   * 生成后续建议
   */
  private generateNextSteps(
    output: PatentResponderOutput,
    responseContext: ResponseContext
  ): string[] {
    const steps: string[] = []

    // 基于成功概率
    if (output.strategy.successProbability >= 70) {
      steps.push('建议按照当前策略提交答复')
      if (
        output.strategy.overallStrategy === 'amend' ||
        output.strategy.overallStrategy === 'both'
      ) {
        steps.push('准备修改后的权利要求书替换页')
      }
    } else if (output.strategy.successProbability >= 40) {
      steps.push('建议进一步补充论点或修改权利要求')
      steps.push('可考虑与审查员会晤沟通')
    } else {
      steps.push('建议重新评估答复策略')
      steps.push('可考虑申请复审或重新撰写')
    }

    // 基于风险提示
    output.strategy.risks.slice(0, 2).forEach((risk) => {
      steps.push(`注意：${risk}`)
    })

    // 基于预测信息
    if (responseContext.prediction) {
      const pred = responseContext.prediction
      if (pred.keySuccessFactors.length > 0) {
        steps.push(`有利因素：${pred.keySuccessFactors[0]}`)
      }
    }

    return steps
  }

  /**
   * 添加历史案例
   */
  public addHistoricalCase(caseData: Parameters<CaseLearner['addCase']>[0]): void {
    this.caseLearner.addCase(caseData)
    this.strategyRecommender.addHistoricalCase(caseData)
    this.successPredictor.addHistoricalCase(caseData)
  }

  /**
   * 批量添加历史案例
   */
  public addHistoricalCases(cases: Parameters<CaseLearner['addCases']>[0]): void {
    this.caseLearner.addCases(cases)
    this.strategyRecommender.addHistoricalCases(cases)
    this.successPredictor.addHistoricalCases(cases)
  }

  /**
   * 获取子模块实例（用于高级用法）
   */
  public getModules() {
    return {
      oaParser: this.oaParser,
      strategyRecommender: this.strategyRecommender,
      templateManager: this.templateManager,
      successPredictor: this.successPredictor,
      caseLearner: this.caseLearner,
    }
  }

  /**
   * 记录答复结果（用于持续学习）
   */
  public async recordResponse(
    input: PatentResponderInput,
    output: PatentResponderOutput,
    outcome: 'success' | 'partial_success' | 'failure',
    parseResult?: OAParseResult
  ): Promise<void> {
    // 如果没有提供 parseResult，需要重新解析
    let result = parseResult
    if (!result) {
      const rawData: OARawData = {
        applicationNumber: input.officeAction.applicationNumber,
        patentTitle: input.officeAction.patentTitle,
        content: input.officeAction.officeActionContent,
        documentType: input.documentType || 'cn',
        examiner: input.officeAction.examiner,
        notificationDate: input.officeAction.notificationDate,
        deadline: input.officeAction.deadline,
      }
      result = await this.oaParser.parse(rawData)
    }

    // 创建案例数据
    const newCase = this.caseLearner.createCaseFromResponse(
      result,
      output.strategy.overallStrategy,
      output.strategy.keyArguments.map((arg) => ({
        category: 'general',
        argument: arg,
        evidence: [],
        targetRejection: result.rejectionTypes[0] || ('other' as any),
      })),
      output.strategy.suggestedAmendments.map((amd) => ({
        claimNumber: amd.claimNumber,
        currentText: amd.currentText,
        proposedText: amd.proposedText,
        reason: amd.reason,
        amendmentType: 'modify' as const,
      })),
      outcome,
      {
        examiner: input.officeAction.examiner,
        round: 1,
      }
    )

    this.addHistoricalCase(newCase)
  }

  /**
   * 导出为指定格式
   */
  async exportToFormat(
    result: PatentResponderOutput,
    input: PatentResponderInput,
    format: 'cn' | 'pct' | 'us'
  ): Promise<{
    format: string
    content: string
    metadata: {
      exportDate: Date
      applicationNumber: string
      patentTitle: string
      argumentCount: number
      amendmentCount: number
      wordCount: number
    }
  }> {
    const { responseDocument } = result
    const { officeAction } = input

    let content = ''

    if (format === 'cn') {
      content = this.generateCNFormat(responseDocument, officeAction)
    } else if (format === 'pct') {
      content = this.generatePCTFormat(responseDocument, officeAction)
    } else if (format === 'us') {
      content = this.generateUSFormat(responseDocument, officeAction)
    }

    return {
      format,
      content,
      metadata: {
        exportDate: new Date(),
        applicationNumber: officeAction.applicationNumber,
        patentTitle: officeAction.patentTitle,
        argumentCount: responseDocument.metrics.argumentCount,
        amendmentCount: responseDocument.metrics.amendmentCount,
        wordCount: responseDocument.metrics.wordCount,
      },
    }
  }

  /**
   * 生成 CN 格式
   */
  private generateCNFormat(document: ResponseDocument, officeAction: OAOfficeAction): string {
    const parts: string[] = []

    parts.push('# 审查意见答复书\n')
    parts.push(`申请号：${officeAction.applicationNumber}`)
    parts.push(`发明名称：${officeAction.patentTitle}`)
    if (officeAction.examiner) {
      parts.push(`审查员：${officeAction.examiner}`)
    }
    parts.push('')

    parts.push('## 答复书\n')
    parts.push(document.responseLetter)

    if (document.amendedClaims) {
      parts.push('\n\n## 修改后的权利要求书\n')
      parts.push(document.amendedClaims)
    }

    return parts.join('')
  }

  /**
   * 生成 PCT 格式
   */
  private generatePCTFormat(document: ResponseDocument, officeAction: OAOfficeAction): string {
    const parts: string[] = []

    parts.push('# RESPONSE TO OFFICE ACTION\n')
    parts.push(`Application No: ${officeAction.applicationNumber}`)
    parts.push(`Title: ${officeAction.patentTitle}`)
    parts.push('')

    parts.push('## Response Letter\n')
    parts.push(document.responseLetter)

    if (document.amendedClaims) {
      parts.push('\n\n## Amended Claims\n')
      parts.push(document.amendedClaims)
    }

    return parts.join('')
  }

  /**
   * 生成 US 格式
   */
  private generateUSFormat(document: ResponseDocument, officeAction: OAOfficeAction): string {
    return this.generatePCTFormat(document, officeAction)
  }
}

// 为了让 recordResponse 方法能访问 responseContext，我们需要修改类结构
// 这里提供一个简化版本的记录方法
