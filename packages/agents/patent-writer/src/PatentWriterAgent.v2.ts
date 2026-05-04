/**
 * 专利撰写智能体（重构版 - 符合Phase 4新架构）
 *
 * 专业的专利申请文件撰写智能体，提供：
 * 1. 技术方案理解
 * 2. 权利要求设计
 * 3. 说明书生成
 * 4. 质量评估
 *
 * 特性：
 * - 简洁的架构（符合Phase 4设计）
 * - 可被OrchestratorAgent调用
 * - 高度可测试
 * - 支持HITL检查点
 */

import { Agent, type LLMAdapter, type ExecutionContext } from '@yunpat/core'

/**
 * 专利撰写输入
 */
export interface PatentWriterInput {
  /** 发明名称 */
  title: string
  /** 技术领域 */
  field: string
  /** 申请人 */
  applicant: string
  /** 发明人 */
  inventors: string[]
  /** 技术交底书 */
  technicalDisclosure: string
  /** 附图列表 */
  drawings?: string[]
  /** 撰写模式 */
  mode?: 'full' | 'claims-only' | 'specification-only'
}

/**
 * 专利撰写输出
 */
export interface PatentWriterOutput {
  /** 发明名称 */
  title: string
  /** 摘要 */
  abstract: string
  /** 权利要求书 */
  claims: string
  /** 说明书 */
  description: string
  /** 附图说明 */
  drawings?: string
  /** 撰写指标 */
  metrics: {
    /** 撰写耗时（毫秒） */
    duration: number
    /** 权利要求数量 */
    claimsCount: number
    /** 说明书字数 */
    descriptionWordCount: number
    /** 质量评分（0-100） */
    qualityScore: number
  }
}

/**
 * 撰写计划
 */
interface WritingPlan {
  input: PatentWriterInput
  mode: 'full' | 'claims-only' | 'specification-only'
  stages: string[]
}

/**
 * 专利撰写智能体
 */
export class PatentWriterAgent extends Agent {
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
      name: config.name || 'patent-writer',
      description: config.description || '专利撰写智能体 - 专业的专利申请文件撰写助手'
    })
    this.llm = config.llm
  }

  /**
   * 规划阶段：分析输入，制定撰写计划
   */
  protected async plan(
    input: PatentWriterInput,
    _context: ExecutionContext
  ): Promise<WritingPlan> {
    // 验证输入
    this.validateInput(input)

    // 确定撰写模式
    const mode = input.mode || 'full'

    // 确定撰写阶段
    const stages: string[] = []
    if (mode === 'full' || mode === 'claims-only') {
      stages.push('understand-invention', 'draft-claims')
    }
    if (mode === 'full' || mode === 'specification-only') {
      stages.push('draft-specification', 'generate-abstract')
    }
    stages.push('quality-check')

    return {
      input,
      mode,
      stages
    }
  }

  /**
   * 执行阶段：按计划撰写专利申请文件
   */
  protected async execute(
    plan: WritingPlan,
    context: ExecutionContext
  ): Promise<PatentWriterOutput> {
    const startTime = Date.now()
    const { input, mode, stages } = plan

    let claims = ''
    let description = ''
    let abstract = ''
    let drawings = input.drawings?.join('\n') || ''

    // 执行各个阶段
    for (const stage of stages) {
      context.logger?.info(`[PatentWriterAgent] 执行阶段: ${stage}`)

      switch (stage) {
        case 'understand-invention':
          // 技术方案理解（在后续阶段中使用）
          break

        case 'draft-claims':
          claims = await this.draftClaims(input, context)
          break

        case 'draft-specification':
          description = await this.draftSpecification(input, claims, context)
          break

        case 'generate-abstract':
          abstract = await this.generateAbstract(input, description, context)
          break

        case 'quality-check':
          // 质量检查（在最后计算质量评分）
          break
      }
    }

    // 计算撰写指标
    const duration = Date.now() - startTime
    const claimsCount = this.countClaims(claims)
    const descriptionWordCount = description.length
    const qualityScore = this.calculateQualityScore(
      claims,
      description,
      abstract
    )

    return {
      title: input.title,
      abstract,
      claims,
      description,
      drawings,
      metrics: {
        duration,
        claimsCount,
        descriptionWordCount,
        qualityScore
      }
    }
  }

  /**
   * 验证输入
   */
  private validateInput(input: PatentWriterInput): void {
    if (!input.title?.trim()) {
      throw new Error('发明名称不能为空')
    }
    if (!input.field?.trim()) {
      throw new Error('技术领域不能为空')
    }
    if (!input.applicant?.trim()) {
      throw new Error('申请人不能为空')
    }
    if (!input.inventors?.length) {
      throw new Error('发明人不能为空')
    }
    if (!input.technicalDisclosure?.trim()) {
      throw new Error('技术交底书不能为空')
    }
  }

  /**
   * 撰写权利要求
   */
  private async draftClaims(
    input: PatentWriterInput,
    context: ExecutionContext
  ): Promise<string> {
    const prompt = this.buildClaimsPrompt(input)

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理师，擅长撰写权利要求书。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 2000,
        temperature: 0.7
      })

      return response.content || ''
    } catch (error) {
      context.logger?.error('[PatentWriterAgent] 撰写权利要求失败:', error)
      throw new Error('撰写权利要求失败')
    }
  }

  /**
   * 撰写说明书
   */
  private async draftSpecification(
    input: PatentWriterInput,
    claims: string,
    context: ExecutionContext
  ): Promise<string> {
    const prompt = this.buildSpecificationPrompt(input, claims)

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理师，擅长撰写专利说明书。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 4000,
        temperature: 0.7
      })

      return response.content || ''
    } catch (error) {
      context.logger?.error('[PatentWriterAgent] 撰写说明书失败:', error)
      throw new Error('撰写说明书失败')
    }
  }

  /**
   * 生成摘要
   */
  private async generateAbstract(
    input: PatentWriterInput,
    description: string,
    context: ExecutionContext
  ): Promise<string> {
    const prompt = `请根据以下发明信息和说明书，撰写一份专利摘要（100-300字）：

发明名称：${input.title}
技术领域：${input.field}
技术交底书：${input.technicalDisclosure}

说明书节选：
${description.substring(0, 1000)}

要求：
1. 简明扼要地说明发明的技术方案、技术问题和有益效果
2. 字数控制在100-300字
3. 使用专业、准确的专利术语
`

    try {
      const response = await this.llm.invoke({
        messages: [
          {
            role: 'system',
            content: '你是一位专业的专利代理师，擅长撰写专利摘要。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        maxTokens: 500,
        temperature: 0.7
      })

      return response.content || ''
    } catch (error) {
      context.logger?.error('[PatentWriterAgent] 生成摘要失败:', error)
      throw new Error('生成摘要失败')
    }
  }

  /**
   * 构建权利要求撰写提示词
   */
  private buildClaimsPrompt(input: PatentWriterInput): string {
    return `请根据以下技术交底书，撰写权利要求书：

发明名称：${input.title}
技术领域：${input.field}
申请人：${input.applicant}
发明人：${input.inventors.join('、')}

技术交底书：
${input.technicalDisclosure}

要求：
1. 撰写1条独立权利要求，包含发明的全部必要技术特征
2. 撰写3-5条从属权利要求，对独立权利要求作进一步限定
3. 权利要求应当清楚、简要地限定保护范围
4. 使用"其特征在于..."、"根据权利要求X所述..."等标准表述
5. 按照保护范围由宽到窄的顺序排列
`
  }

  /**
   * 构建说明书撰写提示词
   */
  private buildSpecificationPrompt(
    input: PatentWriterInput,
    claims: string
  ): string {
    return `请根据以下技术交底书和权利要求书，撰写专利说明书：

发明名称：${input.title}
技术领域：${input.field}

权利要求书：
${claims}

技术交底书：
${input.technicalDisclosure}

要求：
1. 按照中国专利法规定的说明书结构撰写：
   - 技术领域
   - 背景技术
   - 发明内容
   - 附图说明（如有）
   - 具体实施方式
2. 说明书应当支持权利要求的保护范围
3. 详细描述技术方案，使本领域技术人员能够实现
4. 使用专业、准确的专利术语
`
  }

  /**
   * 统计权利要求数量
   */
  private countClaims(claims: string): number {
    return claims.split(/\n\d+\./).filter(s => s.trim().length > 0).length
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(
    claims: string,
    description: string,
    abstract: string
  ): number {
    let score = 0

    // 权利要求质量（40分）
    if (claims.includes('其特征在于')) score += 10
    if (claims.includes('根据权利要求')) score += 10
    if (claims.length > 200 && claims.length < 2000) score += 10
    if (this.countClaims(claims) >= 3) score += 10

    // 说明书质量（40分）
    if (description.includes('技术领域')) score += 8
    if (description.includes('背景技术')) score += 8
    if (description.includes('发明内容')) score += 8
    if (description.includes('具体实施方式')) score += 8
    if (description.length > 500) score += 8

    // 摘要质量（20分）
    if (abstract.length > 100 && abstract.length < 300) score += 10
    if (abstract.includes('技术方案') || abstract.includes('有益效果')) score += 10

    return score
  }
}
