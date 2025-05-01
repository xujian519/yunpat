/**
 * 专利答复智能体（Phase 5统一架构版本）
 *
 * 专业的审查意见答复智能体，提供：
 * 1. 审查意见深度分析
 * 2. 答复策略生成（argue/amend/abandon/appeal）
 * 3. 成功概率评估
 * 4. 答复文档撰写
 * 5. 修改建议生成
 *
 * 特性：
 * - 继承ProfessionalAgent基类
 * - 实现plan和act方法
 * - 可被OrchestratorAgent调用
 * - 支持多种答复策略
 * - 完整的风险评估
 *
 * @package @yunpat/agent-patent-responder
 */

import { ProfessionalAgent, type ExtendedExecutionContext } from '@yunpat/agent-base'
import type { LLMAdapter } from '@yunpat/core'

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
  /** 答复指标 */
  metrics: {
    /** 答复耗时（毫秒） */
    duration: number
    /** 成功概率 */
    successProbability: number
    /** 策略合理性评分 */
    strategyScore: number
  }
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
    | 'analyze-office-action'
    | 'generate-strategy'
    | 'draft-response'
    | 'generate-amendments'
    | 'assess-success'
  >
}

/**
 * 答复上下文（包含中间结果）
 */
interface ResponseContext extends ExtendedExecutionContext {
  /** 审查意见分析结果（在后续阶段使用） */
  analysis?: PatentResponderOutput['analysis']
  /** 答复策略（在后续阶段使用） */
  strategy?: ResponseStrategy
}

/**
 * 专利答复智能体
 */
export class PatentResponderAgent extends ProfessionalAgent<
  PatentResponderInput,
  PatentResponderOutput
> {
  constructor(config: { llm: LLMAdapter; eventBus: any; memory: any; tools: any }) {
    super({
      name: 'patent-responder',
      description: '专利答复智能体 - 专业的审查意见答复助手',
      ...config,
    })
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
    const stages: ResponsePlan['stages'] = [
      'analyze-office-action',
      'generate-strategy',
      'draft-response',
      'generate-amendments',
      'assess-success',
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
  protected async act(
    plan: ResponsePlan,
    context: ExtendedExecutionContext
  ): Promise<PatentResponderOutput> {
    const startTime = Date.now()
    const { input, stages } = plan

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
        overallStrategy: 'argue',
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
      metrics: {
        duration: 0,
        successProbability: 0,
        strategyScore: 0,
      },
    }

    // 执行各个答复阶段
    for (const stage of stages) {
      context.logger?.info(`[PatentResponderAgent] 执行阶段: ${stage}`)

      switch (stage) {
        case 'analyze-office-action':
          output.analysis = await this.analyzeOfficeAction(input, context)
          responseContext.analysis = output.analysis
          break

        case 'generate-strategy':
          output.strategy = await this.generateStrategy(input, responseContext, context)
          responseContext.strategy = output.strategy
          break

        case 'draft-response':
          output.responseDocument = await this.draftResponse(input, responseContext, context)
          break

        case 'generate-amendments':
          if (output.strategy?.overallStrategy === 'amend') {
            await this.generateAmendments(input, output, context)
          }
          break

        case 'assess-success':
          output.metrics.successProbability = output.strategy?.successProbability || 0
          output.metrics.strategyScore = this.calculateStrategyScore(output)
          output.nextSteps = this.generateNextSteps(output)
          break
      }
    }

    // 计算答复指标
    output.metrics.duration = Date.now() - startTime

    return output
  }

  /**
   * 分析审查意见
   */
  private async analyzeOfficeAction(
    input: PatentResponderInput,
    context: ExtendedExecutionContext
  ): Promise<PatentResponderOutput['analysis']> {
    const { officeAction } = input

    try {
      const prompt = `请分析以下审查意见：

申请号：${officeAction.applicationNumber}
专利名称：${officeAction.patentTitle}
审查通知日期：${officeAction.notificationDate || '未指定'}
答复期限：${officeAction.deadline || '未指定'}

审查意见内容：
${officeAction.officeActionContent}

${
  officeAction.citedReferences?.length
    ? `引用的对比文件：
${officeAction.citedReferences
  .map((ref) => `- ${ref.publicationNumber}: ${ref.title} (${ref.relevance})`)
  .join('\n')}`
    : ''
}

审查意见类型：${officeAction.rejectionTypes?.join(', ') || '未指定'}

请从以下几个方面进行分析：
1. 审查意见摘要（50-100字）
2. 关键问题识别（3-5个问题，每个问题包括：类型、描述、严重程度）
3. 可克服性评估（0-100分）

请以JSON格式返回：
{
  "summary": "审查意见摘要",
  "keyIssues": [
    {"type": "问题类型", "description": "问题描述", "severity": "high|medium|low"}
  ],
  "overcomeProbability": 70
}
`

      const response = await this.callLLM({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理人，擅长分析审查意见。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      // 解析JSON响应
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // 如果JSON解析失败，返回默认值
      return {
        summary: officeAction.officeActionContent.substring(0, 100),
        keyIssues: [
          {
            type: 'general',
            description: '审查意见需要仔细分析',
            severity: 'medium',
          },
        ],
        overcomeProbability: 50,
      }
    } catch (error) {
      const message = this.formatErrorMessage(error, '审查意见分析失败')
      context.logger?.error(message)
      throw new Error(message)
    }
  }

  /**
   * 生成答复策略
   */
  private async generateStrategy(
    input: PatentResponderInput,
    responseContext: ResponseContext,
    context: ExtendedExecutionContext
  ): Promise<ResponseStrategy> {
    const { officeAction, strategyPreference } = input
    const analysis = responseContext.analysis

    try {
      // 根据策略偏好确定总体策略
      let overallStrategy: 'argue' | 'amend' | 'abandon' | 'appeal' = 'argue'

      if (analysis.overcomeProbability < 30) {
        overallStrategy = 'abandon'
      } else if (analysis.overcomeProbability < 60) {
        overallStrategy = strategyPreference === 'aggressive' ? 'argue' : 'amend'
      } else if (analysis.overcomeProbability < 80) {
        overallStrategy = strategyPreference === 'conservative' ? 'amend' : 'argue'
      } else {
        overallStrategy = 'argue'
      }

      const prompt = `请为以下审查意见制定答复策略：

申请号：${officeAction.applicationNumber}
专利名称：${officeAction.patentTitle}

审查意见分析：
- 摘要：${analysis.summary}
- 可克服性：${analysis.overcomeProbability}/100
- 关键问题：
${analysis.keyIssues.map((issue) => `- ${issue.type}: ${issue.description} (${issue.severity})`).join('\n')}

答复策略偏好：${strategyPreference}

建议的总体策略：${overallStrategy}

请制定详细的答复策略，包括：
1. 关键论点（3-5个）
2. 建议修改内容（如果需要）
3. 需要补充的证据（如果有）
4. 风险提示（如果有）

请以JSON格式返回：
{
  "overallStrategy": "${overallStrategy}",
  "successProbability": 70,
  "keyArguments": ["论点1", "论点2"],
  "suggestedAmendments": [{"claimNumber": 1, "currentText": "原文", "proposedText": "修改后", "reason": "理由"}],
  "additionalEvidence": ["证据1"],
  "risks": ["风险1"]
}
`

      const response = await this.callLLM({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理人，擅长制定答复策略。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      // 解析JSON响应
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // 如果JSON解析失败，返回默认值
      return {
        overallStrategy,
        successProbability: analysis.overcomeProbability,
        keyArguments: ['需要进一步分析'],
        suggestedAmendments: [],
        additionalEvidence: [],
        risks: [],
      }
    } catch (error) {
      const message = this.formatErrorMessage(error, '策略生成失败')
      context.logger?.error(message)
      throw new Error(message)
    }
  }

  /**
   * 撰写答复文档
   */
  private async draftResponse(
    input: PatentResponderInput,
    responseContext: ResponseContext,
    context: ExtendedExecutionContext
  ): Promise<ResponseDocument> {
    const { officeAction, originalApplication, documentType = 'cn' } = input
    const strategy = responseContext.strategy

    const startTime = Date.now()

    try {
      const prompt = `请撰写审查意见答复书：

申请号：${officeAction.applicationNumber}
专利名称：${officeAction.patentTitle}

审查意见：
${officeAction.officeActionContent.substring(0, 500)}

答复策略：
- 总体策略：${strategy.overallStrategy}
- 成功概率：${strategy.successProbability}%
- 关键论点：
${strategy.keyArguments.map((arg) => `- ${arg}`).join('\n')}

原始权利要求：
${originalApplication.claims.substring(0, 500)}

请撰写一份正式的答复书，包括：
1. 开头（致审查员）
2. 对审查意见的回应
3. 关键论点的详细阐述
4. 结论

文档类型：${documentType.toUpperCase()}
语言：中文

答复书应该专业、礼貌、有说服力。`

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

      const wordCount = response.length
      const argumentCount = strategy.keyArguments.length
      const generationTime = Date.now() - startTime

      return {
        responseLetter: response,
        metrics: {
          wordCount,
          argumentCount,
          amendmentCount: 0,
          generationTime,
        },
      }
    } catch (error) {
      const message = this.formatErrorMessage(error, '答复文档撰写失败')
      context.logger?.error(message)
      throw new Error(message)
    }
  }

  /**
   * 生成修改建议
   */
  private async generateAmendments(
    input: PatentResponderInput,
    output: PatentResponderOutput,
    context: ExtendedExecutionContext
  ): Promise<void> {
    const { originalApplication } = input
    const { strategy } = output

    if (strategy.suggestedAmendments.length === 0) {
      // 如果没有修改建议，使用LLM生成
      try {
        const prompt = `请为以下专利生成修改建议：

专利名称：${input.officeAction.patentTitle}

原始权利要求：
${originalApplication.claims}

关键问题：
${output.analysis.keyIssues.map((issue) => `- ${issue.description}`).join('\n')}

请生成2-3个具体的修改建议，格式：
{
  "suggestedAmendments": [
    {
      "claimNumber": 1,
      "currentText": "原文",
      "proposedText": "修改后",
      "reason": "理由"
    }
  ]
}
`

        const response = await this.callLLM({
          messages: [
            {
              role: 'system',
              content: '你是一位专业的专利代理人，擅长修改权利要求。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        })

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          strategy.suggestedAmendments = result.suggestedAmendments
          ;(output.responseDocument as { amendmentCount?: number }).amendmentCount =
            result.suggestedAmendments.length
        }
      } catch (error) {
        context.logger?.error('修改建议生成失败:', error)
      }
    }
  }

  /**
   * 计算策略合理性评分
   */
  private calculateStrategyScore(output: PatentResponderOutput): number {
    let score = 0

    // 成功概率评分（40分）
    if (output.metrics.successProbability > 80) score += 40
    else if (output.metrics.successProbability > 60) score += 30
    else if (output.metrics.successProbability > 40) score += 20
    else score += 10

    // 论点数量评分（30分）
    const argumentCount = output.strategy.keyArguments.length
    if (argumentCount >= 5) score += 30
    else if (argumentCount >= 3) score += 20
    else if (argumentCount >= 1) score += 10

    // 风险评估评分（30分）
    const riskCount = output.strategy.risks.length
    if (riskCount === 0) score += 30
    else if (riskCount <= 2) score += 20
    else if (riskCount <= 4) score += 10

    return score
  }

  /**
   * 生成后续建议
   */
  private generateNextSteps(output: PatentResponderOutput): string[] {
    const nextSteps: string[] = []

    // 基于成功概率
    if (output.metrics.successProbability > 70) {
      nextSteps.push('建议按照当前策略提交答复')
      if (output.strategy.overallStrategy === 'amend') {
        nextSteps.push('准备修改后的权利要求书')
      }
    } else if (output.metrics.successProbability > 40) {
      nextSteps.push('建议考虑修改权利要求')
      nextSteps.push('可能需要补充实验数据或证据')
    } else {
      nextSteps.push('建议与审查员进行会晤')
      nextSteps.push('考虑申请复审或放弃')
    }

    // 基于风险
    if (output.strategy.risks.length > 0) {
      nextSteps.push(`注意以下风险：${output.strategy.risks[0]}`)
    }

    return nextSteps
  }
}
