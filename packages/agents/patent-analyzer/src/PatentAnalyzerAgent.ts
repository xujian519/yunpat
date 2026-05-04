/**
 * 专利分析智能体
 *
 * 专业的专利文献分析智能体，提供：
 * 1. 技术方案深度分析
 * 2. 权利要求分析
 * 3. 现有技术对比
 * 4. 创造性评估
 * 5. 专利性风险评估
 */

import { Agent, type ExecutionContext } from '@yunpat/core'
import { JSONParser } from './utils/index.js'
import { PatentDownloadTool } from '@yunpat/patent-tools'
import { promises as fs } from 'fs'

export interface PatentAnalyzerInput {
  /** 专利文献信息 */
  patent: {
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
  /** 分析类型 */
  analysisTypes?: ('technical' | 'claims' | 'priorArt' | 'creativity' | 'risk')[]
  /** 对比专利（可选） */
  comparisonPatents?: Array<{
    publicationNumber: string
    title: string
    abstract: string
  }>
}

export interface PatentAnalysisOutput {
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

interface AnalysisPlan {
  input: PatentAnalyzerInput
  analysisTypes: PatentAnalyzerInput['analysisTypes']
}

export class PatentAnalyzerAgent extends Agent {
  private patentDownloadTool?: PatentDownloadTool
  private downloadDir: string

  constructor(config: {
    name: string
    description: string
    eventBus: any
    memory: any
    tools: any
    llm: any
    patentDownloadTool?: PatentDownloadTool
    downloadDir?: string
  }) {
    super(config)
    this.patentDownloadTool = config.patentDownloadTool
    this.downloadDir = config.downloadDir || './downloads'
  }

  protected async plan(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<AnalysisPlan> {
    if (!input.patent?.publicationNumber?.trim()) {
      throw new Error('专利公开号不能为空')
    }
    if (!input.patent?.title?.trim()) {
      throw new Error('专利标题不能为空')
    }
    if (!input.patent?.abstract?.trim()) {
      throw new Error('专利摘要不能为空')
    }

    console.log('[PatentAnalyzer] 步骤1: 规划阶段')
    console.log(`   专利: ${input.patent.publicationNumber} - ${input.patent.title}`)
    console.log(`   分析类型: ${input.analysisTypes?.join(', ') || '全面分析'}`)

    // 尝试下载专利全文（如果配置了PatentDownloadTool）
    if (this.patentDownloadTool && !input.patent.fullText) {
      try {
        console.log('[PatentAnalyzer] 正在下载专利全文...')
        const toolContext = {
          registry: this.tools,
          llm: context.llm,
          memory: this.memory,
          eventBus: this.eventBus,
          metadata: {
            agentName: this.name,
            executionId: `analyzer-${Date.now()}`,
          },
        }

        const downloadResult = await this.patentDownloadTool.execute(
          {
            patent: input.patent.publicationNumber,
            outputPath: this.downloadDir,
          },
          toolContext as any
        )

        if (downloadResult.success && downloadResult.outputPath) {
          console.log(`   ✅ 专利全文下载成功: ${downloadResult.outputPath}`)

          // 尝试读取PDF文件（需要额外的PDF解析库）
          // 这里只是标记下载成功，实际PDF解析需要额外的库如pdf-parse
          // 为了简化，我们暂时不读取PDF内容
        }
      } catch (error) {
        console.warn(
          `   ⚠️ 专利全文下载失败: ${error instanceof Error ? error.message : String(error)}`
        )
        console.warn('   继续使用摘要进行分析...')
      }
    }

    return {
      input,
      analysisTypes: input.analysisTypes || [
        'technical',
        'claims',
        'priorArt',
        'creativity',
        'risk',
      ],
    }
  }

  protected async act(
    plan: AnalysisPlan,
    context: ExecutionContext
  ): Promise<PatentAnalysisOutput> {
    console.log('[PatentAnalyzer] 步骤2: 分析阶段')

    const { input, analysisTypes } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行专利分析')
    }

    const startTime = Date.now()
    const output: PatentAnalysisOutput = {
      basicInfo: {
        publicationNumber: input.patent.publicationNumber,
        title: input.patent.title,
        applicant: input.patent.applicant,
        publicationDate: input.patent.publicationDate,
      },
      recommendations: [],
    }

    // 技术分析
    if (analysisTypes?.includes('technical')) {
      console.log('   1️⃣ 技术分析...')
      output.technicalAnalysis = await this.analyzeTechnical(input, context)
    }

    // 权利要求分析
    if (analysisTypes?.includes('claims')) {
      console.log('   2️⃣ 权利要求分析...')
      output.claimsAnalysis = await this.analyzeClaims(input, context)
    }

    // 现有技术对比
    if (analysisTypes?.includes('priorArt')) {
      console.log('   3️⃣ 现有技术对比...')
      output.priorArtAnalysis = await this.analyzePriorArt(input, context)
    }

    // 创造性评估
    if (analysisTypes?.includes('creativity')) {
      console.log('   4️⃣ 创造性评估...')
      output.creativityAssessment = await this.assessCreativity(input, context)
    }

    // 风险评估
    if (analysisTypes?.includes('risk')) {
      console.log('   5️⃣ 风险评估...')
      output.riskAssessment = await this.assessRisks(input, context)
    }

    // 综合建议
    console.log('   6️⃣ 生成建议...')
    output.recommendations = await this.generateRecommendations(output, context)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[PatentAnalyzer] 完成 (耗时 ${duration}s)`)

    return output
  }

  /**
   * 技术分析
   */
  private async analyzeTechnical(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalysisOutput['technicalAnalysis']> {
    const systemPrompt = `你是一位资深的专利分析专家，擅长从专利文献中提取和结构化技术信息。

你的任务是深入分析专利的技术内容：
1. 识别技术领域
2. 提取技术问题（可能多个）
3. 理解技术方案的核心
4. 识别技术效果
5. 提取关键技术特征

输出严格的 JSON 格式。`

    const userPrompt = `## 专利信息

公开号: ${input.patent.publicationNumber}
标题: ${input.patent.title}
申请人: ${input.patent.applicant || '未知'}
公开日: ${input.patent.publicationDate || '未知'}

## 摘要
${input.patent.abstract}

${input.patent.fullText ? `## 全文\n${input.patent.fullText.substring(0, 5000)}...` : ''}

请分析以上专利，输出以下 JSON 格式：

{
  "field": "技术领域",
  "problems": ["技术问题1", "技术问题2"],
  "solution": "技术方案详细描述",
  "effects": ["技术效果1", "技术效果2"],
  "keyFeatures": ["技术特征1", "技术特征2"]
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parseTechnicalAnalysis(response.message.content)
  }

  /**
   * 权利要求分析
   */
  private async analyzeClaims(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalysisOutput['claimsAnalysis']> {
    // 如果没有提供权利要求信息，返回默认值
    if (!input.patent.fullText) {
      return {
        independentCount: 0,
        dependentCount: 0,
        protectionScope: {
          breadth: 'medium',
          clarity: 'clear',
          risk: 'medium',
        },
        qualityScore: 70,
      }
    }

    const systemPrompt = `你是一位专利权利要求分析专家。

请分析专利权利要求的：
1. 独立和从属权利要求数量
2. 保护范围的宽窄程度
3. 保护范围的清晰程度
4. 专利性风险

输出 JSON 格式。`

    const userPrompt = `## 专利全文

${input.patent.fullText.substring(0, 3000)}

请分析权利要求，输出：

{
  "independentCount": 独立权利要求数量,
  "dependentCount": 从属权利要求数量,
  "protectionScope": {
    "breadth": "narrow|medium|broad",
    "clarity": "clear|ambiguous",
    "risk": "low|medium|high"
  },
  "qualityScore": 0-100的质量评分
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parseClaimsAnalysis(response.message.content)
  }

  /**
   * 现有技术对比
   */
  private async analyzePriorArt(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalysisOutput['priorArtAnalysis']> {
    if (!input.comparisonPatents || input.comparisonPatents.length === 0) {
      return {
        closestPriorArt: [],
        innovations: [],
      }
    }

    const systemPrompt = `你是一位专利现有技术对比专家。

请分析目标专利与对比专利的相似性和区别。`

    const userPrompt = `## 目标专利

${input.patent.title}
${input.patent.abstract}

## 对比专利

${input.comparisonPatents
  .map(
    (p, i) => `
### 专利 ${i + 1}
公开号: ${p.publicationNumber}
标题: ${p.title}
摘要: ${p.abstract}
`
  )
  .join('\n')}

请输出：

{
  "closestPriorArt": [
    {
      "publicationNumber": "公开号",
      "title": "标题",
      "similarity": 0.0-1.0的相似度,
      "differences": ["区别1", "区别2"]
    }
  ],
  "innovations": ["创新点1", "创新点2"]
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parsePriorArtAnalysis(response.message.content)
  }

  /**
   * 创造性评估
   */
  private async assessCreativity(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalysisOutput['creativityAssessment']> {
    const systemPrompt = `你是一位专利创造性评估专家。

请根据专利的技术方案，评估其创造性水平：
1. inventive（具有创造性）- 非显而易见
2. obvious（显而易见）- 本领域技术人员容易想到
3. lacksInventiveness（缺乏创造性）- 不具备专利性

评分范围：0-100
- 80-100：创造性高
- 60-79：有创造性
- 40-59：创造性一般
- 20-39：创造性低
- 0-19：无创造性`

    const userPrompt = `## 专利信息

${input.patent.title}
${input.patent.abstract}

${input.patent.fullText ? input.patent.fullText.substring(0, 2000) : ''}

请评估创造性，输出：

{
  "level": "inventive|obvious|lacksInventiveness",
  "score": 0-100的评分,
  "reasoning": "评估理由"
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parseCreativityAssessment(response.message.content)
  }

  /**
   * 风险评估
   */
  private async assessRisks(
    input: PatentAnalyzerInput,
    context: ExecutionContext
  ): Promise<PatentAnalysisOutput['riskAssessment']> {
    const systemPrompt = `你是一位专利风险评估专家。

请评估专利的：
1. 无效风险 - 被无效宣告的可能性
2. 侵权风险 - 侵犯他人专利权的可能性

风险评估：low/medium/high`

    const userPrompt = `## 专利信息

${input.patent.title}
${input.patent.abstract}

${input.patent.fullText ? input.patent.fullText.substring(0, 2000) : ''}

请评估风险，输出：

{
  "invalidityRisk": "low|medium|high",
  "infringementRisk": "low|medium|high",
  "riskFactors": ["风险因素1", "风险因素2"]
}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    return this.parseRiskAssessment(response.message.content)
  }

  /**
   * 生成建议
   */
  private async generateRecommendations(
    output: PatentAnalysisOutput,
    context: ExecutionContext
  ): Promise<string[]> {
    const systemPrompt = `你是一位专利策略顾问。

根据专利分析结果，提供具体的建议和改进措施。请列出 3-5 条建议。`

    const summary = this.generateAnalysisSummary(output)

    const userPrompt = `## 专利分析摘要

${summary}

请提供 3-5 条具体建议（纯文本，每条一行）。`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    })

    const recommendations = response.message.content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    return recommendations.slice(0, 5)
  }

  /**
   * 生成分析摘要
   */
  private generateAnalysisSummary(output: PatentAnalysisOutput): string {
    const parts: string[] = []

    if (output.technicalAnalysis) {
      parts.push(`技术领域: ${output.technicalAnalysis.field}`)
      parts.push(`关键特征: ${output.technicalAnalysis.keyFeatures.length} 个`)
    }

    if (output.claimsAnalysis) {
      parts.push(
        `权利要求: ${output.claimsAnalysis.independentCount} 独立 + ${output.claimsAnalysis.dependentCount} 从属`
      )
      parts.push(`质量评分: ${output.claimsAnalysis.qualityScore}/100`)
    }

    if (output.creativityAssessment) {
      parts.push(
        `创造性: ${output.creativityAssessment.level} (${output.creativityAssessment.score}/100)`
      )
    }

    if (output.riskAssessment) {
      parts.push(`无效风险: ${output.riskAssessment.invalidityRisk}`)
      parts.push(`侵权风险: ${output.riskAssessment.infringementRisk}`)
    }

    return parts.join('\n')
  }

  /**
   * 解析技术分析响应
   */
  private parseTechnicalAnalysis(content: string): PatentAnalysisOutput['technicalAnalysis'] {
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
        field: data.field || '',
        problems: Array.isArray(data.problems) ? data.problems : [],
        solution: data.solution || '',
        effects: Array.isArray(data.effects) ? data.effects : [],
        keyFeatures: Array.isArray(data.keyFeatures) ? data.keyFeatures : [],
      }
    } catch (error) {
      console.warn('[PatentAnalyzerAgent] 技术分析解析失败:', error)
      return {
        field: '',
        problems: [],
        solution: '',
        effects: [],
        keyFeatures: [],
      }
    }
  }

  /**
   * 解析权利要求分析响应
   */
  private parseClaimsAnalysis(content: string): PatentAnalysisOutput['claimsAnalysis'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        return this.getDefaultClaimsAnalysis()
      }

      const data = JSON.parse(jsonMatch[0])

      return {
        independentCount: data.independentCount || 0,
        dependentCount: data.dependentCount || 0,
        protectionScope: {
          breadth: data.protectionScope?.breadth || 'medium',
          clarity: data.protectionScope?.clarity || 'clear',
          risk: data.protectionScope?.risk || 'medium',
        },
        qualityScore: data.qualityScore || 70,
      }
    } catch (error) {
      console.warn('[PatentAnalyzerAgent] 权利要求分析解析失败:', error)
      return this.getDefaultClaimsAnalysis()
    }
  }

  /**
   * 解析现有技术对比响应
   */
  private parsePriorArtAnalysis(content: string): PatentAnalysisOutput['priorArtAnalysis'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        return {
          closestPriorArt: [],
          innovations: [],
        }
      }

      const data = JSON.parse(jsonMatch[0])

      return {
        closestPriorArt: Array.isArray(data.closestPriorArt) ? data.closestPriorArt : [],
        innovations: Array.isArray(data.innovations) ? data.innovations : [],
      }
    } catch (error) {
      console.warn('[PatentAnalyzerAgent] 现有技术对比解析失败:', error)
      return {
        closestPriorArt: [],
        innovations: [],
      }
    }
  }

  /**
   * 解析创造性评估响应
   */
  private parseCreativityAssessment(content: string): PatentAnalysisOutput['creativityAssessment'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        return this.getDefaultCreativityAssessment()
      }

      const data = JSON.parse(jsonMatch[0])

      // 验证创造性等级
      const validLevels = ['inventive', 'obvious', 'lacksInventiveness']
      const level = validLevels.includes(data.level) ? data.level : 'obvious'

      return {
        level,
        score: typeof data.score === 'number' ? data.score : 50,
        reasoning: data.reasoning || '未提供详细理由',
      }
    } catch (error) {
      console.warn('[PatentAnalyzerAgent] 创造性评估解析失败:', error)
      return this.getDefaultCreativityAssessment()
    }
  }

  /**
   * 解析风险评估响应
   */
  private parseRiskAssessment(content: string): PatentAnalysisOutput['riskAssessment'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        return this.getDefaultRiskAssessment()
      }

      const data = JSON.parse(jsonMatch[0])

      // 验证风险等级
      const validRisks = ['low', 'medium', 'high']
      const invalidityRisk = validRisks.includes(data.invalidityRisk)
        ? data.invalidityRisk
        : 'medium'
      const infringementRisk = validRisks.includes(data.infringementRisk)
        ? data.infringRisk
        : 'medium'

      return {
        invalidityRisk,
        infringementRisk,
        riskFactors: Array.isArray(data.riskFactors) ? data.riskFactors : [],
      }
    } catch (error) {
      console.warn('[PatentAnalyzerAgent] 风险评估解析失败:', error)
      return this.getDefaultRiskAssessment()
    }
  }

  private getDefaultClaimsAnalysis(): PatentAnalysisOutput['claimsAnalysis'] {
    return {
      independentCount: 0,
      dependentCount: 0,
      protectionScope: {
        breadth: 'medium',
        clarity: 'clear',
        risk: 'medium',
      },
      qualityScore: 70,
    }
  }

  private getDefaultCreativityAssessment(): PatentAnalysisOutput['creativityAssessment'] {
    return {
      level: 'obvious',
      score: 50,
      reasoning: '无法确定创造性水平',
    }
  }

  private getDefaultRiskAssessment(): PatentAnalysisOutput['riskAssessment'] {
    return {
      invalidityRisk: 'medium',
      infringementRisk: 'medium',
      riskFactors: ['未进行详细分析'],
    }
  }
}
