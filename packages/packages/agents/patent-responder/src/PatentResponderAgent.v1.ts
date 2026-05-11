/**
 * 专利答复智能体 v1（旧版兼容）
 *
 * @deprecated 使用 PatentResponderAgent.v4.ts（ProfessionalAgent 增强版）或 PatentResponderAgentV5.ts（数据库集成版）
 *
 * 专业的 OA 审查意见答复智能体，提供：
 *
 * 专业的 OA 审查意见答复智能体，提供：
 * 1. 审查意见分析
 * 2. 答复策略生成
 * 3. 答复文档撰写
 * 4. 修改建议生成
 * 5. 先例检索支持
 */

import { Agent, type ExecutionContext, SkillLoader } from '@yunpat/core'
import { join } from 'path'
import type { BaseAgentInput, BaseAgentOutput } from '@yunpat/agent-base'

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

export interface ResponseDocument {
  /** 答复文档类型 */
  documentType: 'cn' | 'pct' | 'us'
  /** 答复书 */
  responseLetter: string
  /** 修改后的权利要求书 */
  amendedClaims?: string
  /** 修改后的说明书部分 */
  amendedDescription?: string
  /** 论点详细说明 */
  detailedArguments: Array<{
    category: string
    argument: string
    evidence: string[]
  }>
  /** 统计信息 */
  metrics: {
    wordCount: number
    argumentCount: number
    amendmentCount: number
    generationTime: number
  }
}

export interface PatentResponderInput extends BaseAgentInput {
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
  /** 是否进行先例检索 */
  enablePriorArtSearch?: boolean
  /** 文档类型 */
  documentType?: 'cn' | 'pct' | 'us'
}

export interface PatentResponderOutput extends BaseAgentOutput {
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
    /** 可决性评估 */
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
 * 格式化配置接口
 */
interface FormatConfig {
  title: string
  labels: {
    applicationNo: string
    title: string
    applicant?: string
    responseLetter: string
    amendedClaims: string
    amendedDescription?: string
    detailedArguments: string
    evidence: string
  }
  includeApplicant?: boolean
  includeAmendedDescription?: boolean
}

interface ResponsePlan {
  input: PatentResponderInput
  analysisTypes: string[]
}

export class PatentResponderAgent extends Agent {
  private skillLoader?: SkillLoader

  constructor(config: any = {}) {
    super(config)
    this.skillLoader =
      config.skillLoader ||
      (config.enableTemplates !== false
        ? new SkillLoader({
            baseDir: join(process.cwd(), '.yunpat/skills/patent-responder'),
          })
        : undefined)
  }

  protected async plan(
    input: PatentResponderInput,
    _context: ExecutionContext
  ): Promise<ResponsePlan> {
    if (!input.officeAction?.officeActionContent?.trim()) {
      throw new Error('审查意见内容不能为空')
    }
    if (!input.originalApplication?.claims?.trim()) {
      throw new Error('原始权利要求书不能为空')
    }
    if (!input.originalApplication?.description?.trim()) {
      throw new Error('原始说明书不能为空')
    }

    console.log('[PatentResponder] 步骤1: 规划阶段')
    console.log(`   申请号: ${input.officeAction.applicationNumber}`)
    console.log(`   专利名称: ${input.officeAction.patentTitle}`)
    console.log(`   答略偏好: ${input.strategyPreference || 'moderate'}`)

    const analysisTypes = ['analyze', 'strategy', 'document']

    return { input, analysisTypes }
  }

  protected async act(
    plan: ResponsePlan,
    context: ExecutionContext
  ): Promise<PatentResponderOutput> {
    console.log('[PatentResponder] 步骤2: 答复阶段')

    const { input } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行答复生成')
    }

    const startTime = Date.now()

    // 1. 分析审查意见
    console.log('   1. 分析审查意见...')
    const analysis = await this.analyzeOfficeAction(input, context)

    // 2. 生成答复策略
    console.log('   2. 生成答复策略...')
    const strategy = await this.generateStrategy(input, analysis, context)

    // 3. 撰写答复文档
    console.log('   3. 撰写答复文档...')
    const responseDocument = await this.generateResponseDocument(input, analysis, strategy, context)

    // 4. 生成后续建议
    console.log('   4. 生成后续建议...')
    const nextSteps = await this.generateNextSteps(input, analysis, strategy, context)

    const executionTime = Date.now() - startTime
    const duration = (executionTime / 1000).toFixed(1)
    console.log(`[PatentResponder] 完成 (耗时 ${duration}s)`)

    const output: PatentResponderOutput = {
      analysis,
      strategy,
      responseDocument,
      nextSteps,
      executionTime,
    }

    return output
  }

  /**
   * 分析审查意见
   */
  private async analyzeOfficeAction(
    input: PatentResponderInput,
    context: ExecutionContext
  ): Promise<PatentResponderOutput['analysis']> {
    const systemPrompt = `你是一位资深的专利审查意见分析专家。

你的任务是深入分析 OA 审查意见：
1. 总结审查员的核心观点
2. 识别关键问题和驳回理由
3. 评估问题的严重程度
4. 评估克服问题的可能性

输出严格的 JSON 格式。`

    const userPrompt = `## 审查意见

申请号: ${input.officeAction.applicationNumber}
专利名称: ${input.officeAction.patentTitle}
审查员: ${input.officeAction.examiner || '未知'}

### 审查意见内容
${input.officeAction.officeActionContent}

${
  input.officeAction.citedReferences && input.officeAction.citedReferences.length > 0
    ? `### 引用的对比文件
${input.officeAction.citedReferences
  .map(
    (ref, i) => `
${i + 1}. ${ref.publicationNumber}
   标题: ${ref.title}
   相关性: ${ref.relevance}
`
  )
  .join('\n')}`
    : ''
}

## 原始权利要求书
${input.originalApplication.claims}

请分析以上审查意见，输出以下 JSON 格式：

{
  "summary": "审查意见的核心观点摘要",
  "keyIssues": [
    {
      "type": "novelty|inventiveness|support|clarity|other",
      "description": "问题详细描述",
      "severity": "high|medium|low"
    }
  ],
  "overcomeProbability": 0-100的克服概率
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parseAnalysis(response.message.content)
  }

  /**
   * 生成答复策略
   */
  private async generateStrategy(
    input: PatentResponderInput,
    analysis: PatentResponderOutput['analysis'],
    context: ExecutionContext
  ): Promise<ResponseStrategy> {
    const systemPrompt = `你是一位专利答复策略专家。

根据审查意见分析，制定最佳的答复策略：
1. overallStrategy: 总体策略
   - argue: 通过争辩克服驳回（适用于新颖性、创造性问题）
   - amend: 通过修改权利要求克服驳回（适用于支持、清晰度问题）
   - abandon: 建议放弃（适用于无法克服的实质性缺陷）
   - appeal: 建议复审（适用于审查员意见明显错误）

2. 成功概率评估：0-100

3. 关键论点：3-5条核心论点

4. 建议修改：具体的权利要求修改建议

5. 补充证据：需要补充的实验数据、对比文件等

6. 风险提示：潜在的风险和不确定性

输出 JSON 格式。`

    const userPrompt = this.skillLoader
      ? this.skillLoader.render(await this.skillLoader.load('strategy'), {
          summary: analysis.summary,
          keyIssues: JSON.stringify(analysis.keyIssues, null, 2),
          overcomeProbability: String(analysis.overcomeProbability),
          preference: input.strategyPreference || 'moderate',
          claims: input.originalApplication.claims,
        })
      : `## 审查意见分析

${JSON.stringify(analysis, null, 2)}

## 答略偏好
${input.strategyPreference || 'moderate'}

## 原始权利要求书
${input.originalApplication.claims}

请生成答复策略，输出：

{
  "overallStrategy": "argue|amend|abandon|appeal",
  "successProbability": 0-100,
  "keyArguments": ["论点1", "论点2", "论点3"],
  "suggestedAmendments": [
    {
      "claimNumber": 权利要求编号,
      "currentText": "当前文本",
      "proposedText": "建议文本",
      "reason": "修改理由"
    }
  ],
  "additionalEvidence": ["证据1", "证据2"],
  "risks": ["风险1", "风险2"]
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
    })

    return this.parseStrategy(response.message.content)
  }

  /**
   * 生成答复文档
   */
  private async generateResponseDocument(
    input: PatentResponderInput,
    analysis: PatentResponderOutput['analysis'],
    strategy: ResponseStrategy,
    context: ExecutionContext
  ): Promise<ResponseDocument> {
    const docStartTime = Date.now()
    const systemPrompt = `你是一位专业的专利答复文档撰写专家。

请根据审查意见和答复策略，撰写专业的答复文档。

文档结构：
1. 答复书（开头）
2. 修改后的权利要求书（如有修改）
3. 修改后的说明书部分（如有修改）
4. 详细论点说明
5. 结论

输出 JSON 格式。`

    const suggestedAmendmentsText =
      strategy.suggestedAmendments.length > 0
        ? strategy.suggestedAmendments
            .map(
              (amd) => `
权利要求 ${amd.claimNumber}:
- 当前: ${amd.currentText}
- 建议: ${amd.proposedText}
- 理由: ${amd.reason}
`
            )
            .join('\n')
        : '无修改建议'

    const userPrompt = this.skillLoader
      ? this.skillLoader.render(await this.skillLoader.load('document'), {
          applicationNumber: input.officeAction.applicationNumber,
          patentTitle: input.officeAction.patentTitle,
          documentType: input.documentType || 'cn',
          analysisSummary: analysis.summary,
          keyIssues: analysis.keyIssues
            .map((issue) => `- ${issue.type}: ${issue.description}`)
            .join('\n'),
          strategy: strategy.overallStrategy,
          keyArguments: strategy.keyArguments.map((arg, i) => `${i + 1}. ${arg}`).join('\n'),
          suggestedAmendments: suggestedAmendmentsText,
          claims: input.originalApplication.claims,
          description: input.originalApplication.description.substring(0, 3000),
        })
      : `## 审查意见

申请号: ${input.officeAction.applicationNumber}
专利名称: ${input.officeAction.patentTitle}

### 审查意见摘要
${analysis.summary}

### 关键问题
${analysis.keyIssues.map((issue) => `- ${issue.type}: ${issue.description}`).join('\n')}

## 答复策略

总体策略: ${strategy.overallStrategy}
成功概率: ${strategy.successProbability}%

### 关键论点
${strategy.keyArguments.map((arg, i) => `${i + 1}. ${arg}`).join('\n')}

### 建议修改
${suggestedAmendmentsText}

## 原始申请文件

权利要求书:
${input.originalApplication.claims}

说明书:
${input.originalApplication.description.substring(0, 3000)}...

请撰写答复文档，输出：

{
  "documentType": "${input.documentType || 'cn'}",
  "responseLetter": "答复书全文",
  "amendedClaims": "修改后的权利要求书（如有）",
  "amendedDescription": "修改后的说明书部分（如有）",
  "detailedArguments": [
    {
      "category": "论点分类",
      "argument": "论点详细说明",
      "evidence": ["证据1", "证据2"]
    }
  ]
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    })

    const parsed = this.parseResponseDocument(response.message.content)
    const generationTime = Date.now() - docStartTime

    return {
      ...parsed,
      metrics: {
        wordCount: response.message.content.length,
        argumentCount: parsed.detailedArguments.length,
        amendmentCount: strategy.suggestedAmendments.length,
        generationTime,
      },
    }
  }

  /**
   * 生成后续建议
   */
  private async generateNextSteps(
    input: PatentResponderInput,
    analysis: PatentResponderOutput['analysis'],
    strategy: ResponseStrategy,
    context: ExecutionContext
  ): Promise<string[]> {
    const systemPrompt = `你是一位专利策略顾问。

根据审查意见分析、答复策略和文档，提供具体的后续步骤建议。请列出 3-5 条建议。`

    const userPrompt = this.skillLoader
      ? this.skillLoader.render(await this.skillLoader.load('next-steps'), {
          strategy: strategy.overallStrategy,
          successProbability: String(strategy.successProbability),
          keyIssues: analysis.keyIssues
            .map((issue) => `- ${issue.type}: ${issue.description}`)
            .join('\n'),
          risks: strategy.risks.map((risk) => `- ${risk}`).join('\n'),
        })
      : `## 答复策略

总体策略: ${strategy.overallStrategy}
成功概率: ${strategy.successProbability}%

## 关键问题
${analysis.keyIssues.map((issue) => `- ${issue.type}: ${issue.description}`).join('\n')}

## 风险提示
${strategy.risks.map((risk) => `- ${risk}`).join('\n')}

请提供 3-5 条具体建议（纯文本，每条一行）。`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    })

    const nextSteps = response.message.content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    return nextSteps.slice(0, 5)
  }

  /**
   * 解析分析结果
   */
  private parseAnalysis(content: string): PatentResponderOutput['analysis'] {
    try {
      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) ||
        content.match(/```\s*([\s\S]*?)\s*```/) ||
        content.match(/{[\s\S]*}/)

      if (!jsonMatch) {
        throw new Error('未找到 JSON 格式')
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const data = JSON.parse(jsonStr)

      return {
        summary: data.summary || '',
        keyIssues: Array.isArray(data.keyIssues) ? data.keyIssues : [],
        overcomeProbability:
          typeof data.overcomeProbability === 'number' ? data.overcomeProbability : 50,
      }
    } catch (error) {
      console.warn('[PatentResponderAgent] 分析结果解析失败:', error)
      return {
        summary: '',
        keyIssues: [],
        overcomeProbability: 50,
      }
    }
  }

  /**
   * 解析策略结果
   */
  private parseStrategy(content: string): ResponseStrategy {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        return this.getDefaultStrategy()
      }

      const data = JSON.parse(jsonMatch[0])

      const validStrategies = ['argue', 'amend', 'abandon', 'appeal']
      const overallStrategy = validStrategies.includes(data.overallStrategy)
        ? data.overallStrategy
        : 'argue'

      return {
        overallStrategy,
        successProbability:
          typeof data.successProbability === 'number' ? data.successProbability : 50,
        keyArguments: Array.isArray(data.keyArguments) ? data.keyArguments : [],
        suggestedAmendments: Array.isArray(data.suggestedAmendments)
          ? data.suggestedAmendments
          : [],
        additionalEvidence: Array.isArray(data.additionalEvidence) ? data.additionalEvidence : [],
        risks: Array.isArray(data.risks) ? data.risks : [],
      }
    } catch (error) {
      console.warn('[PatentResponderAgent] 策略解析失败:', error)
      return this.getDefaultStrategy()
    }
  }

  /**
   * 解析答复文档
   */
  private parseResponseDocument(content: string): Omit<ResponseDocument, 'metrics'> {
    try {
      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) ||
        content.match(/```\s*([\s\S]*?)\s*```/) ||
        content.match(/{[\s\S]*}/)

      if (!jsonMatch) {
        throw new Error('未找到 JSON 格式')
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const data = JSON.parse(jsonStr)

      return {
        documentType: data.documentType || 'cn',
        responseLetter: data.responseLetter || '',
        amendedClaims: data.amendedClaims,
        amendedDescription: data.amendedDescription,
        detailedArguments: Array.isArray(data.detailedArguments) ? data.detailedArguments : [],
      }
    } catch (error) {
      console.warn('[PatentResponderAgent] 答复文档解析失败:', error)
      return {
        documentType: 'cn',
        responseLetter: '',
        detailedArguments: [],
      }
    }
  }

  private getDefaultStrategy(): ResponseStrategy {
    return {
      overallStrategy: 'argue',
      successProbability: 50,
      keyArguments: [],
      suggestedAmendments: [],
      additionalEvidence: [],
      risks: [],
    }
  }

  /**
   * 导出为指定格式
   *
   * @param result - 答复执行结果
   * @param input - 原始输入
   * @param format - 目标格式
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
        argumentCount: responseDocument.detailedArguments.length,
        amendmentCount: responseDocument.metrics.amendmentCount,
        wordCount: responseDocument.metrics.wordCount,
      },
    }
  }

  /**
   * 统一的格式生成方法
   */
  private generateFormat(
    document: ResponseDocument,
    officeAction: OAOfficeAction,
    config: FormatConfig
  ): string {
    let content = `# ${config.title}\n\n`

    // 基本信息
    content += `${config.labels.applicationNo}: ${officeAction.applicationNumber}\n`
    content += `${config.labels.title}: ${officeAction.patentTitle}\n`

    if (config.includeApplicant && config.labels.applicant) {
      content += `${config.labels.applicant}: [申请人名称]\n`
    }
    content += '\n'

    // 答复书
    content += `## ${config.labels.responseLetter}\n\n`
    content += document.responseLetter

    // 修改后的权利要求书
    if (document.amendedClaims) {
      content += `\n\n## ${config.labels.amendedClaims}\n\n`
      content += document.amendedClaims
    }

    // 修改后的说明书（仅 CN 格式）
    if (
      config.includeAmendedDescription &&
      document.amendedDescription &&
      config.labels.amendedDescription
    ) {
      content += `\n\n## ${config.labels.amendedDescription}\n\n`
      content += document.amendedDescription
    }

    // 详细论点
    content += `\n\n## ${config.labels.detailedArguments}\n\n`
    document.detailedArguments.forEach((arg, index) => {
      content += `### ${index + 1}. ${arg.category}\n\n`
      content += `${arg.argument}\n\n`
      if (arg.evidence.length > 0) {
        content += `**${config.labels.evidence}**:\n`
        arg.evidence.forEach((ev) => {
          content += `- ${ev}\n`
        })
        content += '\n'
      }
    })

    return content
  }

  /**
   * CN 格式配置
   */
  private readonly CN_FORMAT: FormatConfig = {
    title: '审查意见答复书',
    labels: {
      applicationNo: '申请号',
      title: '发明名称',
      applicant: '申请人',
      responseLetter: '答复书',
      amendedClaims: '修改后的权利要求书',
      amendedDescription: '修改后的说明书部分',
      detailedArguments: '详细论点',
      evidence: '证据',
    },
    includeApplicant: true,
    includeAmendedDescription: true,
  }

  /**
   * PCT 格式配置
   */
  private readonly PCT_FORMAT: FormatConfig = {
    title: 'RESPONSE TO OFFICE ACTION',
    labels: {
      applicationNo: 'Application No',
      title: 'Title',
      responseLetter: 'Response Letter',
      amendedClaims: 'Amended Claims',
      detailedArguments: 'Detailed Arguments',
      evidence: 'Evidence',
    },
    includeApplicant: false,
    includeAmendedDescription: false,
  }

  /**
   * US 格式配置
   */
  private readonly US_FORMAT: FormatConfig = {
    title: 'RESPONSE TO OFFICE ACTION (USPTO)',
    labels: {
      applicationNo: 'Application No',
      title: 'Title',
      responseLetter: 'Response Letter',
      amendedClaims: 'Amended Claims',
      detailedArguments: 'Detailed Arguments',
      evidence: 'Evidence',
    },
    includeApplicant: false,
    includeAmendedDescription: false,
  }

  private generateCNFormat(document: ResponseDocument, officeAction: OAOfficeAction): string {
    return this.generateFormat(document, officeAction, this.CN_FORMAT)
  }

  private generatePCTFormat(document: ResponseDocument, officeAction: OAOfficeAction): string {
    return this.generateFormat(document, officeAction, this.PCT_FORMAT)
  }

  private generateUSFormat(document: ResponseDocument, officeAction: OAOfficeAction): string {
    return this.generateFormat(document, officeAction, this.US_FORMAT)
  }
}
