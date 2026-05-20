/**
 * 说明书形式检查智能体
 *
 * 专门用于说明书的形式审查，包括：
 * 1. 第26条第3款检查（充分公开）
 * 2. 第26条第4款检查（清楚、简要）
 * 3. 实施细则第17条检查（技术领域、背景技术等）
 * 4. 实施细则第18条检查（附图说明）
 * 5. 实施细则第19条检查（具体实施方式）
 *
 * 特性：
 * - 基于专利法具体条款
 * - 自动标记问题
 * - 生成修改建议
 * - TDD方式（测试驱动开发）
 */

import {
  ProfessionalAgent,
  type ProfessionalAgentConfig,
  type ExtendedExecutionContext,
} from '@yunpat/agent-base'
import {
  createLogger,
  AgentInputError,
} from '@yunpat/core'

/**
 * 说明书检查输入
 */
export interface SpecCheckInput {
  /** 说明书 */
  specification: {
    /** 技术领域 */
    technicalField?: string
    /** 背景技术 */
    backgroundArt?: string
    /** 发明内容 */
    inventionContent?: string
    /** 附图说明 */
    drawingsDescription?: string
    /** 具体实施方式 */
    embodiment?: string
  }

  /** 权利要求书（用于一致性检查） */
  claims?: Array<{
    /** 类型：独立或从属 */
    type: 'independent' | 'dependent'
    /** 编号 */
    number: number
    /** 内容 */
    content: string
    /** 从属关系（仅从属权利要求） */
    dependsOn?: number
  }>

  /** 专利类型 */
  patentType: 'invention' | 'utilityModel'
}

/**
 * 说明书形式检查结果
 */
export interface SpecFormalityCheckResult {
  /** 第26条第3款（充分公开） */
  article26_3_disclosure: {
    passed: boolean
    issues: Array<{
      section: string
      issue: string
      suggestion: string
    }>
  }

  /** 第26条第4款（清楚、简要） */
  article26_4_clarity: {
    passed: boolean
    issues: Array<{
      section: string
      issue: string
      suggestion: string
    }>
  }

  /** 实施细则第17条（必要组成部分） */
  rule17_components: {
    passed: boolean
    missingComponents: string[]
  }

  /** 实施细则第18条（附图说明） */
  rule18_drawings: {
    passed: boolean
    hasDrawings: boolean
    issues: Array<{
      issue: string
      suggestion: string
    }>
  }

  /** 实施细则第19条（具体实施方式） */
  rule19_embodiment: {
    passed: boolean
    issues: Array<{
      issue: string
      suggestion: string
    }>
  }

  /** 与权利要求书的一致性 */
  claimsConsistency: {
    passed: boolean
    unsupportedClaims: Array<{
      claimNumber: number
      claimContent: string
      missingInSpec: string
    }>
  }

  /** 总体报告 */
  overallReport: {
    passed: boolean
    totalIssues: number
    criticalIssues: number
    recommendations: string[]
  }
}

/**
 * 说明书检查计划
 */
interface SpecCheckPlan {
  input: SpecCheckInput
  specAnalysis: {
    hasTechnicalField: boolean
    hasBackgroundArt: boolean
    hasInventionContent: boolean
    hasDrawingsDescription: boolean
    hasEmbodiment: boolean
    completeness: number
  }
}

/**
 * 说明书形式检查智能体
 */
export class SpecFormalityChecker extends ProfessionalAgent<SpecCheckInput, SpecFormalityCheckResult> {
  private logger = createLogger('SpecFormalityChecker')

  constructor(config: ProfessionalAgentConfig) {
    super(config)
  }

  /**
   * 规划阶段：分析说明书
   */
  protected async plan(input: SpecCheckInput, _context: ExtendedExecutionContext): Promise<SpecCheckPlan> {
    this.logger.info('开始规划说明书检查', {
      patentType: input.patentType,
    })

    const hasTechnicalField = !!input.specification.technicalField?.trim()
    const hasBackgroundArt = !!input.specification.backgroundArt?.trim()
    const hasInventionContent = !!input.specification.inventionContent?.trim()
    const hasDrawingsDescription = !!input.specification.drawingsDescription?.trim()
    const hasEmbodiment = !!input.specification.embodiment?.trim()

    const components = [
      hasTechnicalField,
      hasBackgroundArt,
      hasInventionContent,
      hasDrawingsDescription,
      hasEmbodiment,
    ]
    const completeness = (components.filter(Boolean).length / components.length) * 100

    this.logger.info('说明书完整性分析完成', {
      completeness: `${completeness.toFixed(0)}%`,
      hasTechnicalField,
      hasBackgroundArt,
      hasInventionContent,
      hasDrawingsDescription,
      hasEmbodiment,
    })

    return {
      input,
      specAnalysis: {
        hasTechnicalField,
        hasBackgroundArt,
        hasInventionContent,
        hasDrawingsDescription,
        hasEmbodiment,
        completeness,
      },
    }
  }

  /**
   * 执行阶段：执行5个核心条款检查
   */
  protected async act(
    plan: SpecCheckPlan,
    _context: ExtendedExecutionContext
  ): Promise<SpecFormalityCheckResult> {
    this.logger.info('开始执行说明书检查')

    const input = plan.input

    const result: SpecFormalityCheckResult = {
      article26_3_disclosure: {
        passed: true,
        issues: [],
      },
      article26_4_clarity: {
        passed: true,
        issues: [],
      },
      rule17_components: {
        passed: true,
        missingComponents: [],
      },
      rule18_drawings: {
        passed: true,
        hasDrawings: false,
        issues: [],
      },
      rule19_embodiment: {
        passed: true,
        issues: [],
      },
      claimsConsistency: {
        passed: true,
        unsupportedClaims: [],
      },
      overallReport: {
        passed: true,
        totalIssues: 0,
        criticalIssues: 0,
        recommendations: [],
      },
    }

    // 1. 检查充分公开
    this.logger.debug('开始检查充分公开')
    this.checkAdequateDisclosure(input, result)

    // 2. 检查清楚、简要
    this.logger.debug('开始检查清楚、简要')
    this.checkClarityAndBrevity(input, result)

    // 3. 检查必要组成部分
    this.logger.debug('开始检查必要组成部分')
    this.checkRequiredComponents(plan.specAnalysis, result)

    // 4. 检查附图说明
    this.logger.debug('开始检查附图说明')
    this.checkDrawingsDescription(input, result)

    // 5. 检查具体实施方式
    this.logger.debug('开始检查具体实施方式')
    this.checkEmbodiment(input, result)

    // 6. 检查与权利要求书的一致性
    if (input.claims && input.claims.length > 0) {
      this.logger.debug('开始检查权利要求一致性')
      this.checkClaimsConsistency(input, result)
    }

    // 生成总体报告
    this.generateOverallReport(result)

    this.logger.info('说明书检查完成', {
      totalIssues: result.overallReport.totalIssues,
    })

    return result
  }

  /**
   * 检查充分公开（第26条第3款）
   */
  private checkAdequateDisclosure(input: SpecCheckInput, result: SpecFormalityCheckResult): void {
    const { specification } = input

    // 检查技术领域是否足够具体
    if (specification.technicalField) {
      if (specification.technicalField.length < 20) {
        result.article26_3_disclosure.issues.push({
          section: '技术领域',
          issue: '技术领域描述过于简单',
          suggestion: '建议详细说明发明所属或直接应用的技术领域',
        })
      }
    }

    // 检查背景技术是否指出现有技术的不足
    if (specification.backgroundArt) {
      const hasProblemDescription = /不足|缺点|缺陷|问题|缺点/g.test(specification.backgroundArt)
      if (!hasProblemDescription) {
        result.article26_3_disclosure.issues.push({
          section: '背景技术',
          issue: '未明确指出现有技术的不足',
          suggestion: '建议描述现有技术存在的问题和缺点',
        })
      }
    }

    // 检查发明内容是否包含技术方案
    if (specification.inventionContent) {
      const hasSolution = /技术方案|解决|采用|包括|设置/g.test(specification.inventionContent)
      if (!hasSolution) {
        result.article26_3_disclosure.issues.push({
          section: '发明内容',
          issue: '缺少技术方案描述',
          suggestion: '建议详细描述解决技术问题所采用的技术方案',
        })
      }
    }

    // 检查具体实施方式是否详细
    if (specification.embodiment) {
      if (specification.embodiment.length < 100) {
        result.article26_3_disclosure.issues.push({
          section: '具体实施方式',
          issue: '具体实施方式过于简单',
          suggestion: '建议详细描述实现发明的优选方式，使本领域技术人员能够实现',
        })
      }
    }

    result.article26_3_disclosure.passed = result.article26_3_disclosure.issues.length === 0
  }

  /**
   * 检查清楚、简要（第26条第4款）
   */
  private checkClarityAndBrevity(input: SpecCheckInput, result: SpecFormalityCheckResult): void {
    const { specification } = input

    // 检查各部分是否清楚
    const sections = [
      { name: '技术领域', content: specification.technicalField },
      { name: '背景技术', content: specification.backgroundArt },
      { name: '发明内容', content: specification.inventionContent },
      { name: '附图说明', content: specification.drawingsDescription },
      { name: '具体实施方式', content: specification.embodiment },
    ]

    for (const section of sections) {
      if (!section.content) continue

      // 检查是否包含模糊词汇
      if (this.isUnclear(section.content)) {
        result.article26_4_clarity.issues.push({
          section: section.name,
          issue: '包含不清楚的表述',
          suggestion: '建议使用明确的技术术语，避免模糊词汇',
        })
      }

      // 检查是否简要
      if (section.name !== '具体实施方式' && !this.isConcise(section.content)) {
        result.article26_4_clarity.issues.push({
          section: section.name,
          issue: '描述过于冗长',
          suggestion: '建议删除非必要的技术细节，保持描述简洁',
        })
      }
    }

    result.article26_4_clarity.passed = result.article26_4_clarity.issues.length === 0
  }

  /**
   * 检查必要组成部分（实施细则第17条）
   */
  private checkRequiredComponents(
    analysis: SpecCheckPlan['specAnalysis'],
    result: SpecFormalityCheckResult
  ): void {
    const missing: string[] = []

    if (!analysis.hasTechnicalField) missing.push('技术领域')
    if (!analysis.hasBackgroundArt) missing.push('背景技术')
    if (!analysis.hasInventionContent) missing.push('发明内容')
    if (!analysis.hasEmbodiment) missing.push('具体实施方式')

    result.rule17_components.missingComponents = missing
    result.rule17_components.passed = missing.length === 0
  }

  /**
   * 检查附图说明（实施细则第18条）
   */
  private checkDrawingsDescription(input: SpecCheckInput, result: SpecFormalityCheckResult): void {
    const { specification } = input

    // 检查是否有附图说明
    const hasDrawings = !!specification.drawingsDescription?.trim()
    result.rule18_drawings.hasDrawings = hasDrawings

    if (!hasDrawings) {
      // 如果有附图，必须有附图说明
      // 这里简化处理，实际需要检查是否有附图
      result.rule18_drawings.issues.push({
        issue: '缺少附图说明',
        suggestion: '如果有附图，应当说明附图的图名和简要说明',
      })
      result.rule18_drawings.passed = false
      return
    }

    // 检查附图说明格式
    const hasFigureReference =
      specification.drawingsDescription &&
      /图\s*\d+|图\s*[一二三四五六七八九十]/g.test(specification.drawingsDescription)
    if (!hasFigureReference) {
      result.rule18_drawings.issues.push({
        issue: '附图说明格式不规范',
        suggestion: '建议使用"图1为..."、"图2为..."等格式',
      })
    }

    result.rule18_drawings.passed = result.rule18_drawings.issues.length === 0
  }

  /**
   * 检查具体实施方式（实施细则第19条）
   */
  private checkEmbodiment(input: SpecCheckInput, result: SpecFormalityCheckResult): void {
    const { specification, patentType } = input

    if (!specification.embodiment) {
      result.rule19_embodiment.issues.push({
        issue: '缺少具体实施方式',
        suggestion: '应当至少提供一个实施例，详细描述实现发明的优选方式',
      })
      result.rule19_embodiment.passed = false
      return
    }

    // 检查是否有附图引用
    const hasFigureReference = /如图\s*\d+|如图\s*[一二三四五六七八九十]/g.test(
      specification.embodiment
    )
    if (hasFigureReference && !specification.drawingsDescription) {
      result.rule19_embodiment.issues.push({
        issue: '具体实施方式引用了附图但缺少附图说明',
        suggestion: '建议在附图说明部分补充相应的附图说明',
      })
    }

    // 实用新型必须包含形状、构造特征
    if (patentType === 'utilityModel') {
      const hasStructureFeatures = /形状|构造|结构|设置|配置|连接/g.test(specification.embodiment)
      if (!hasStructureFeatures) {
        result.rule19_embodiment.issues.push({
          issue: '实用新型缺少形状、构造特征描述',
          suggestion: '实用新型必须描述产品的形状、构造或其结合',
        })
      }
    }

    result.rule19_embodiment.passed = result.rule19_embodiment.issues.length === 0
  }

  /**
   * 检查与权利要求书的一致性
   */
  private checkClaimsConsistency(input: SpecCheckInput, result: SpecFormalityCheckResult): void {
    if (!input.claims) return

    const specText = JSON.stringify(input.specification).toLowerCase()

    for (const claim of input.claims) {
      // 提取权利要求中的关键技术特征
      const features = this.extractKeyFeatures(claim.content)

      for (const feature of features) {
        // 检查特征是否在说明书中提到
        if (!this.isFeatureInSpecification(feature, specText)) {
          result.claimsConsistency.unsupportedClaims.push({
            claimNumber: claim.number,
            claimContent: claim.content,
            missingInSpec: feature,
          })
        }
      }
    }

    result.claimsConsistency.passed = result.claimsConsistency.unsupportedClaims.length === 0
  }

  /**
   * 检查文本是否清楚
   */
  private isUnclear(content: string): boolean {
    const unclearPatterns = [
      /大约/g,
      /左右/g,
      /上下/g,
      /等等/g,
      /可能/g,
      /大概/g,
      /约/g,
      /或者其组合/g,
    ]

    return unclearPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * 检查文本是否简要
   */
  private isConcise(content: string): boolean {
    // 检查长度：超过500字可能不简要（对发明内容等）
    if (content.length > 500) {
      return false
    }

    // 检查是否包含过多重复描述
    const sentences = content.split(/[。；;！!?]/g)
    const uniqueSentences = new Set(sentences.map((s) => s.trim()))
    const duplicationRatio = 1 - uniqueSentences.size / sentences.length

    // 如果重复率超过30%，可能不简要
    return duplicationRatio < 0.3
  }

  /**
   * 提取关键技术特征
   */
  private extractKeyFeatures(content: string): string[] {
    const features: string[] = []

    // 简化实现：提取带引号的术语和专有名词
    // 提取引号中的内容
    const quotedFeatures = content.match(/["'「」『』]([^"'「」『』]+)["'「」『』]/g) || []
    for (const quoted of quotedFeatures) {
      const feature = quoted.replace(/["'「」『』]/g, '')
      if (feature.length >= 2 && !features.includes(feature)) {
        features.push(feature)
      }
    }

    // 提取常见的组件/器件术语（使用Unicode字符类匹配中文）
    const componentPatterns = [
      /[一-龥a-zA-Z]{2,4}(?:器|件|装置|设备|机构|系统|单元|模块|组件|传感器|控制器|处理器|执行器|驱动器|接收器|发射器|显示器|存储器|计数器|定时器|调节器|变换器|转换器|适配器|连接器|接口|电路|网络|总线|通道|端口)/g,
    ]

    for (const pattern of componentPatterns) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        if (match.length >= 3 && match.length <= 10 && !features.includes(match)) {
          features.push(match)
        }
      }
    }

    return features
  }

  /**
   * 检查特征是否在说明书中
   */
  private isFeatureInSpecification(feature: string, specText: string): boolean {
    if (!feature) return false
    // 简单的子串匹配
    return specText.includes(feature)
  }

  /**
   * 生成总体报告
   */
  private generateOverallReport(result: SpecFormalityCheckResult): void {
    const totalIssues =
      result.article26_3_disclosure.issues.length +
      result.article26_4_clarity.issues.length +
      result.rule17_components.missingComponents.length +
      result.rule18_drawings.issues.length +
      result.rule19_embodiment.issues.length +
      result.claimsConsistency.unsupportedClaims.length

    const criticalIssues =
      result.article26_3_disclosure.issues.length +
      result.rule17_components.missingComponents.length +
      result.claimsConsistency.unsupportedClaims.length

    result.overallReport.totalIssues = totalIssues
    result.overallReport.criticalIssues = criticalIssues
    result.overallReport.passed = totalIssues === 0

    // 生成建议
    if (result.article26_3_disclosure.issues.length > 0) {
      result.overallReport.recommendations.push('建议补充技术细节，确保充分公开')
    }

    if (result.article26_4_clarity.issues.length > 0) {
      result.overallReport.recommendations.push('建议修改不清楚或不简要的表述')
    }

    if (result.rule17_components.missingComponents.length > 0) {
      result.overallReport.recommendations.push(
        `建议补充缺少的组成部分：${result.rule17_components.missingComponents.join('、')}`
      )
    }

    if (result.rule18_drawings.issues.length > 0) {
      result.overallReport.recommendations.push('建议完善附图说明')
    }

    if (result.rule19_embodiment.issues.length > 0) {
      result.overallReport.recommendations.push('建议补充具体实施方式')
    }

    if (result.claimsConsistency.unsupportedClaims.length > 0) {
      result.overallReport.recommendations.push('建议在说明书中补充对权利要求中技术特征的描述')
    }
  }
}
