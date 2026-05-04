import { Agent, type ExecutionContext, createLogger } from '@yunpat/core'

/**
 * 对比报告生成输入
 */
export interface ComparisonReportInput {
  /** 专利申请 */
  application: {
    /** 权利要求书 */
    claims: Array<{
      type: 'independent' | 'dependent'
      number: number
      content: string
      dependsOn?: number
    }>
    /** 说明书 */
    specification: {
      technicalField?: string
      backgroundArt?: string
      inventionContent?: string
      embodiment?: string
    }
    /** 发明名称 */
    inventionTitle: string
  }
  /** 现有技术 */
  priorArt: Array<{
    /** 专利ID */
    patentId: string
    /** 标题 */
    title: string
    /** 摘要 */
    abstract: string
    /** 权利要求 */
    claims: string[]
    /** 说明书 */
    description: string
  }>
  /** 选项 */
  options?: {
    /** 格式 */
    format?: 'markdown' | 'html' | 'pdf'
    /** 是否包含表格 */
    includeTables?: boolean
    /** 是否包含图表 */
    includeDiagrams?: boolean
    /** 语言 */
    language?: 'zh-CN' | 'en-US'
  }
}

/**
 * 表格
 */
export interface Table {
  /** 表头 */
  headers: string[]
  /** 行数据 */
  rows: string[][]
}

/**
 * 图表
 */
export interface Diagram {
  /** 类型 */
  type: 'flowchart' | 'structure' | 'network'
  /** 内容 */
  content: string
}

/**
 * 报告章节
 */
export interface Section {
  /** 标题 */
  heading: string
  /** 内容 */
  content: string
  /** 表格 */
  tables?: Table[]
  /** 图表 */
  diagrams?: Diagram[]
}

/**
 * 报告
 */
export interface Report {
  /** 标题 */
  title: string
  /** 摘要 */
  summary: string
  /** 章节 */
  sections: Section[]
  /** 结论 */
  conclusions: string[]
  /** 建议 */
  recommendations: string[]
}

/**
 * 分析结果
 */
export interface Analysis {
  /** 技术差异 */
  technicalDifferences: string[]
  /** 优势 */
  advantages: string[]
  /** 劣势 */
  disadvantages: string[]
  /** 新颖性 */
  novelty: string
  /** 创造性 */
  inventiveStep: string
}

/**
 * 元数据
 */
export interface Metadata {
  /** 生成时间 */
  generatedAt: Date
  /** 格式 */
  format: string
  /** 版本 */
  version: string
}

/**
 * 对比报告生成结果
 */
export interface ComparisonReportResult {
  /** 报告 */
  report: Report
  /** 分析 */
  analysis: Analysis
  /** 元数据 */
  metadata: Metadata
}

interface ComparisonReportPlan {
  input: ComparisonReportInput
  extractedFeatures: {
    application: string[]
    priorArt: string[][]
  }
}

/**
 * 对比报告生成Agent
 *
 * 功能：
 * 1. 对比分析：本申请vs现有技术
 * 2. 差异识别：结构、功能、效果差异
 * 3. 报告生成：Markdown格式报告
 */
export class ComparisonReportGeneratorAgent extends Agent<
  ComparisonReportInput,
  ComparisonReportResult
> {
  private logger = createLogger('ComparisonReportGeneratorAgent')

  constructor(config: {
    name: string
    description: string
    eventBus: any
    memory: any
    tools: any
    llm: any
  }) {
    super(config)
  }

  public async plan(
    input: ComparisonReportInput,
    _context: ExecutionContext
  ): Promise<ComparisonReportPlan> {
    this.logger.info('开始规划对比报告生成', {
      inventionTitle: input.application.inventionTitle,
      priorArtCount: input.priorArt.length,
    })

    // 提取特征
    const applicationFeatures = this.extractApplicationFeatures(input)
    const priorArtFeatures = input.priorArt.map((pa) => this.extractPriorArtFeatures(pa))

    const totalPriorArtFeatures = priorArtFeatures.map((f) => f.length).reduce((a, b) => a + b, 0)

    this.logger.info('特征提取完成', {
      applicationFeaturesCount: applicationFeatures.length,
      priorArtFeaturesCount: totalPriorArtFeatures,
    })

    return {
      input,
      extractedFeatures: {
        application: applicationFeatures,
        priorArt: priorArtFeatures,
      },
    }
  }

  protected async act(
    plan: ComparisonReportPlan,
    _context: ExecutionContext
  ): Promise<ComparisonReportResult> {
    this.logger.info('开始生成对比报告')

    const { input, extractedFeatures } = plan

    // 1. 生成分析
    const analysis = this.generateAnalysis(input, extractedFeatures)

    // 2. 生成报告
    const report = this.generateReport(input, analysis)

    // 3. 生成元数据
    const metadata: Metadata = {
      generatedAt: new Date(),
      format: input.options?.format || 'markdown',
      version: '1.0.0',
    }

    this.logger.info('对比报告生成完成', {
      technicalDifferencesCount: analysis.technicalDifferences.length,
      advantagesCount: analysis.advantages.length,
      disadvantagesCount: analysis.disadvantages.length,
    })

    return {
      report,
      analysis,
      metadata,
    }
  }

  /**
   * 提取申请特征
   */
  private extractApplicationFeatures(input: ComparisonReportInput): string[] {
    const features: string[] = []

    // 从发明名称提取
    if (input.application.inventionTitle) {
      features.push(input.application.inventionTitle)
    }

    // 从权利要求提取
    input.application.claims.forEach((claim) => {
      // 提取引号内容
      const quotedMatches = claim.content.match(/["'「『]([^"'」』]+)["'」』]/g)
      if (quotedMatches) {
        features.push(...quotedMatches.map((m) => m.replace(/["'「『」』]/g, '')))
      }
      // 提取关键词
      const keywords = claim.content.split(/[，。、；：]/)
      features.push(...keywords.filter((k) => k.length > 2))
    })

    // 从说明书提取
    if (input.application.specification.inventionContent) {
      const sentences = input.application.specification.inventionContent.split(/[，。、]/)
      features.push(...sentences.filter((s) => s.length > 3))
    }

    // 去重
    return Array.from(new Set(features))
  }

  /**
   * 提取现有技术特征
   */
  private extractPriorArtFeatures(priorArt: {
    patentId: string
    title: string
    abstract: string
    claims: string[]
    description: string
  }): string[] {
    const features: string[] = []

    // 从标题提取
    features.push(priorArt.title)

    // 从摘要提取
    const sentences = priorArt.abstract.split(/[，。、]/)
    features.push(...sentences.filter((s) => s.length > 3))

    // 从权利要求提取
    features.push(...priorArt.claims)

    // 去重
    return Array.from(new Set(features))
  }

  /**
   * 生成分析
   */
  private generateAnalysis(
    input: ComparisonReportInput,
    extractedFeatures: ComparisonReportPlan['extractedFeatures']
  ): Analysis {
    const { application, priorArt } = extractedFeatures

    // 技术差异
    const technicalDifferences = this.identifyTechnicalDifferences(input, extractedFeatures)

    // 优势
    const advantages = this.identifyAdvantages(input, priorArt)

    // 劣势
    const disadvantages = this.identifyDisadvantages(input, priorArt)

    // 新颖性
    const novelty = this.assessNovelty(input, priorArt)

    // 创造性
    const inventiveStep = this.assessInventiveStep(input, priorArt)

    return {
      technicalDifferences,
      advantages,
      disadvantages,
      novelty,
      inventiveStep,
    }
  }

  /**
   * 识别技术差异
   */
  private identifyTechnicalDifferences(
    input: ComparisonReportInput,
    extractedFeatures: ComparisonReportPlan['extractedFeatures']
  ): string[] {
    const differences: string[] = []
    const { application, priorArt } = extractedFeatures

    // 提取申请中的独特特征
    const uniqueFeatures = application.filter(
      (feature) => !priorArt.some((pa) => pa.includes(feature))
    )

    // 生成差异描述
    uniqueFeatures.slice(0, 5).forEach((feature) => {
      differences.push(`本申请采用了"${feature}"，而现有技术未采用此特征`)
    })

    // 检查权利要求差异
    const claimCount = input.application.claims.length
    const avgClaimCountInPriorArt =
      priorArt.reduce((sum, pa) => sum + pa.length, 0) / priorArt.length
    if (claimCount > avgClaimCountInPriorArt) {
      differences.push(
        `本申请权利要求数量（${claimCount}项）多于现有技术平均水平（${avgClaimCountInPriorArt.toFixed(1)}项）`
      )
    }

    return differences
  }

  /**
   * 识别优势
   */
  private identifyAdvantages(input: ComparisonReportInput, priorArt: string[][]): string[] {
    const advantages: string[] = []

    // 检查是否有更多权利要求
    if (input.application.claims.length > 3) {
      advantages.push('权利要求层次丰富，形成了多层次保护体系，提高了专利稳定性')
    }

    // 检查说明书充分性
    const spec = input.application.specification
    if (spec.technicalField && spec.backgroundArt && spec.inventionContent && spec.embodiment) {
      advantages.push('说明书各部分完整，技术披露充分')
    }

    // 检查是否有从属权利要求
    const dependentCount = input.application.claims.filter((c) => c.type === 'dependent').length
    if (dependentCount > 0) {
      advantages.push(`包含${dependentCount}项从属权利要求，保护范围更加明确`)
    }

    return advantages
  }

  /**
   * 识别劣势
   */
  private identifyDisadvantages(input: ComparisonReportInput, priorArt: string[][]): string[] {
    const disadvantages: string[] = []

    // 检查权利要求数量是否过少
    if (input.application.claims.length < 3) {
      disadvantages.push('权利要求数量较少，可能影响保护范围和专利稳定性')
    }

    // 检查说明书是否充分
    const spec = input.application.specification
    if (!spec.embodiment || spec.embodiment.length < 50) {
      disadvantages.push('具体实施方式描述不够充分')
    }

    // 检查现有技术竞争情况
    if (priorArt.length > 5) {
      disadvantages.push(`现有技术较多（${priorArt.length}项），竞争激烈，需要突出创新点`)
    }

    return disadvantages
  }

  /**
   * 评估新颖性
   */
  private assessNovelty(input: ComparisonReportInput, priorArt: string[][]): string {
    const appFeatures = this.extractApplicationFeatures(input)
    const uniqueFeatures = appFeatures.filter(
      (feature) => !priorArt.some((pa) => pa.includes(feature))
    )

    const uniqueRatio = uniqueFeatures.length / appFeatures.length

    if (uniqueRatio > 0.5) {
      return `新颖性较高：本申请有${uniqueFeatures.length}个独特特征，占总特征的${(uniqueRatio * 100).toFixed(1)}%`
    } else if (uniqueRatio > 0.3) {
      return `新颖性中等：本申请有${uniqueFeatures.length}个独特特征，占总特征的${(uniqueRatio * 100).toFixed(1)}%`
    } else {
      return `新颖性一般：本申请仅有${uniqueFeatures.length}个独特特征，占总特征的${(uniqueRatio * 100).toFixed(1)}%，需要强调区别技术特征`
    }
  }

  /**
   * 评估创造性
   */
  private assessInventiveStep(input: ComparisonReportInput, priorArt: string[][]): string {
    // 简化评估：基于权利要求的复杂度和从属关系
    const hasDependentClaims = input.application.claims.some((c) => c.type === 'dependent')
    const avgClaimLength =
      input.application.claims.reduce((sum, c) => sum + c.content.length, 0) /
      input.application.claims.length

    if (hasDependentClaims && avgClaimLength > 50) {
      return '创造性较高：权利要求结构复杂，包含多层次技术方案，具有突出的实质性特点和显著的进步'
    } else if (hasDependentClaims || avgClaimLength > 30) {
      return '创造性中等：权利要求具有一定的技术复杂度，具备实质性特点和进步'
    } else {
      return '创造性一般：建议进一步充实权利要求的技术内容，突出技术方案的创造性和进步性'
    }
  }

  /**
   * 生成报告
   */
  private generateReport(input: ComparisonReportInput, analysis: Analysis): Report {
    const sections: Section[] = []

    // 1. 概述
    sections.push({
      heading: '一、概述',
      content: this.generateOverview(input, analysis),
    })

    // 2. 现有技术分析
    sections.push({
      heading: '二、现有技术分析',
      content: this.generatePriorArtAnalysis(input),
    })

    // 3. 技术对比
    if (input.options?.includeTables !== false) {
      sections.push({
        heading: '三、技术对比',
        content: '',
        tables: [this.generateComparisonTable(input, analysis)],
      })
    }

    // 4. 差异分析
    sections.push({
      heading: '四、差异分析',
      content: this.generateDifferenceAnalysis(analysis),
    })

    // 5. 结论与建议
    sections.push({
      heading: '五、结论与建议',
      content: this.generateConclusions(input, analysis),
    })

    // 生成报告
    const report: Report = {
      title: `${input.application.inventionTitle} - 对比分析报告`,
      summary: this.generateSummary(input, analysis),
      sections,
      conclusions: this.generateConclusionsList(analysis),
      recommendations: this.generateRecommendations(analysis),
    }

    return report
  }

  /**
   * 生成概述
   */
  private generateOverview(input: ComparisonReportInput, analysis: Analysis): string {
    return `本报告对"${input.application.inventionTitle}"与${input.priorArt.length}项现有技术进行了全面对比分析。

**分析要点：**
- ${analysis.novelty}
- ${analysis.inventiveStep}

**总体评价：**
本申请相较于现有技术，${analysis.advantages.length > 0 ? analysis.advantages[0] : '具有一定的技术优势'}。`
  }

  /**
   * 生成现有技术分析
   */
  private generatePriorArtAnalysis(input: ComparisonReportInput): string {
    let content = `本次分析共检索到${input.priorArt.length}项相关现有技术：\n\n`

    input.priorArt.slice(0, 5).forEach((pa, index) => {
      content += `${index + 1}. **${pa.title}** (${pa.patentId})\n`
      content += `   - 摘要：${pa.abstract.substring(0, 100)}...\n\n`
    })

    if (input.priorArt.length > 5) {
      content += `\n*注：仅显示前5项，共${input.priorArt.length}项现有技术*\n`
    }

    return content
  }

  /**
   * 生成对比表格
   */
  private generateComparisonTable(input: ComparisonReportInput, analysis: Analysis): Table {
    const headers = ['对比项目', '本申请', '现有技术']
    const rows: string[][] = []

    // 技术领域
    rows.push([
      '技术领域',
      input.application.specification.technicalField || '未描述',
      input.priorArt[0]?.title || '无',
    ])

    // 权利要求数量
    rows.push([
      '权利要求数量',
      `${input.application.claims.length}项`,
      `${(input.priorArt.reduce((sum, pa) => sum + pa.claims.length, 0) / input.priorArt.length).toFixed(1)}项（平均）`,
    ])

    // 技术特征
    rows.push([
      '主要技术特征',
      input.application.claims[0]?.content.substring(0, 50) + '...' || '无',
      input.priorArt[0]?.abstract.substring(0, 50) + '...' || '无',
    ])

    // 优势
    rows.push(['优势', analysis.advantages[0] || '无', '已有技术积累'])

    return { headers, rows }
  }

  /**
   * 生成差异分析
   */
  private generateDifferenceAnalysis(analysis: Analysis): string {
    let content = '### 技术差异\n\n'

    analysis.technicalDifferences.forEach((diff, index) => {
      content += `${index + 1}. ${diff}\n`
    })

    content += '\n### 优势分析\n\n'
    analysis.advantages.forEach((adv, index) => {
      content += `${index + 1}. ${adv}\n`
    })

    if (analysis.disadvantages.length > 0) {
      content += '\n### 待改进方面\n\n'
      analysis.disadvantages.forEach((dis, index) => {
        content += `${index + 1}. ${dis}\n`
      })
    }

    return content
  }

  /**
   * 生成结论
   */
  private generateConclusions(input: ComparisonReportInput, analysis: Analysis): string {
    return `### 新颖性结论

${analysis.novelty}

### 创造性结论

${analysis.inventiveStep}

### 总体评价

本申请相较于现有技术，具有以下特点：
${analysis.advantages.map((a) => `- ${a}`).join('\n')}

${analysis.disadvantages.length > 0 ? `需要注意：\n${analysis.disadvantages.map((d) => `- ${d}`).join('\n')}` : ''}`
  }

  /**
   * 生成摘要
   */
  private generateSummary(input: ComparisonReportInput, analysis: Analysis): string {
    return `本报告对"${input.application.inventionTitle}"与${input.priorArt.length}项现有技术进行了对比分析。

主要发现：
- 识别出${analysis.technicalDifferences.length}项技术差异
- 发现${analysis.advantages.length}项优势
- 指出${analysis.disadvantages.length}项待改进方面

${analysis.novelty}
${analysis.inventiveStep}`
  }

  /**
   * 生成结论列表
   */
  private generateConclusionsList(analysis: Analysis): string[] {
    const conclusions: string[] = []

    if (analysis.technicalDifferences.length > 0) {
      conclusions.push(`本申请与现有技术存在${analysis.technicalDifferences.length}项显著差异`)
    }

    if (analysis.advantages.length > analysis.disadvantages.length) {
      conclusions.push('本申请整体技术方案优于现有技术')
    } else if (analysis.advantages.length === analysis.disadvantages.length) {
      conclusions.push('本申请与现有技术各有优劣')
    } else {
      conclusions.push('本申请需要进一步强化技术优势')
    }

    return conclusions
  }

  /**
   * 生成建议
   */
  private generateRecommendations(analysis: Analysis): string[] {
    const recommendations: string[] = []

    if (analysis.disadvantages.length > 0) {
      recommendations.push(...analysis.disadvantages.map((d) => `改进：${d}`))
    }

    if (analysis.technicalDifferences.length > 0) {
      recommendations.push('在答复审查意见时，应重点强调与现有技术的区别特征')
    }

    recommendations.push('建议定期关注相关技术领域的最新发展动态')

    return recommendations
  }
}
