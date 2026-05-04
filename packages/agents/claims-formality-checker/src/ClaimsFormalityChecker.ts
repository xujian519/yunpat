/**
 * 权利要求形式检查智能体
 *
 * 专门用于权利要求书的形式审查，包括：
 * 1. 第26条第4款检查（清楚、简要）
 * 2. 第26条第4款检查（权利要求书支持）
 * 3. 第4条第1款检查（发明/实用新型定义）
 * 4. 实施细则第20条第1款检查（非必要技术特征）
 *
 * 特性：
 * - 基于专利法具体条款
 * - 自动标记问题
 * - 生成修改建议
 * - TDD方式（测试驱动开发）
 */

import {
  Agent,
  type EventBus,
  type MemoryStore,
  createLogger,
  AgentInputError,
  type ToolRegistry,
  type LLMAdapter,
  type ExecutionContext,
} from '@yunpat/core'

/**
 * 权利要求检查输入
 */
export interface ClaimsCheckInput {
  /** 权利要求书 */
  claims: Array<{
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

  /** 说明书（用于支持性检查） */
  specification?: {
    /** 技术领域 */
    technicalField?: string
    /** 背景技术 */
    backgroundArt?: string
    /** 发明内容 */
    inventionContent?: string
    /** 具体实施方式 */
    embodiment?: string
  }
}

/**
 * 权利要求形式检查结果
 */
export interface ClaimsFormalityCheckResult {
  /** 第26条第4款（清楚、简要） */
  article26_4_clarity: {
    passed: boolean
    issues: Array<{
      claimNumber: number
      issue: string
      suggestion: string
    }>
  }

  /** 第26条第4款（权利要求书支持） */
  article26_4_support: {
    passed: boolean
    issues: Array<{
      claimNumber: number
      unsupportedFeature: string
      suggestion: string
    }>
  }

  /** 第4条第1款（发明/实用新型定义） */
  article4_1_definition: {
    passed: boolean
    patentType: 'invention' | 'utilityModel'
    issues: Array<{
      claimNumber: number
      issue: string
      suggestion: string
    }>
  }

  /** 实施细则第20条第1款（非必要技术特征） */
  rule20_1_necessaryFeatures: {
    passed: boolean
    unnecessaryFeatures: Array<{
      claimNumber: number
      feature: string
      reason: string
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
 * 权利要求检查计划
 */
interface ClaimsCheckPlan {
  input: ClaimsCheckInput
  claimsAnalysis: {
    totalClaims: number
    independentClaims: number
    dependentClaims: number
  }
}

/**
 * 权利要求形式检查智能体
 */
export class ClaimsFormalityChecker extends Agent<ClaimsCheckInput, ClaimsFormalityCheckResult> {
  private logger = createLogger('ClaimsFormalityChecker')

  constructor(config: {
    name: string
    description: string
    eventBus: EventBus
    memory: MemoryStore
    tools: ToolRegistry
    llm: LLMAdapter
  }) {
    super(config)
  }

  /**
   * 规划阶段：分析权利要求书
   */
  protected async plan(
    input: ClaimsCheckInput,
    _context: ExecutionContext
  ): Promise<ClaimsCheckPlan> {
    this.logger.info('开始规划权利要求检查', {
      claimsCount: input.claims.length,
      patentType: input.patentType,
    })

    const independentClaims = input.claims.filter((c) => c.type === 'independent')
    const dependentClaims = input.claims.filter((c) => c.type === 'dependent')

    this.logger.info('权利要求分类完成', {
      independentClaimsCount: independentClaims.length,
      dependentClaimsCount: dependentClaims.length,
    })

    return {
      input,
      claimsAnalysis: {
        totalClaims: input.claims.length,
        independentClaims: independentClaims.length,
        dependentClaims: dependentClaims.length,
      },
    }
  }

  /**
   * 执行阶段：执行4个核心条款检查
   */
  protected async act(
    plan: ClaimsCheckPlan,
    _context: ExecutionContext
  ): Promise<ClaimsFormalityCheckResult> {
    this.logger.info('开始执行权利要求检查')

    const input = plan.input

    const result: ClaimsFormalityCheckResult = {
      article26_4_clarity: {
        passed: true,
        issues: [],
      },
      article26_4_support: {
        passed: true,
        issues: [],
      },
      article4_1_definition: {
        passed: true,
        patentType: input.patentType,
        issues: [],
      },
      rule20_1_necessaryFeatures: {
        passed: true,
        unnecessaryFeatures: [],
      },
      overallReport: {
        passed: true,
        totalIssues: 0,
        criticalIssues: 0,
        recommendations: [],
      },
    }

    // 1. 检查清楚、简要
    this.logger.debug('开始检查清楚、简要')
    this.checkClarityAndBrevity(input, result)

    // 2. 检查权利要求书支持
    this.logger.debug('开始检查权利要求书支持')
    this.checkSupportFromSpecification(input, result)

    // 3. 检查发明/实用新型定义
    this.logger.debug('开始检查发明/实用新型定义')
    this.checkPatentDefinition(input, result)

    // 4. 检查非必要技术特征
    this.logger.debug('开始检查非必要技术特征')
    this.checkNecessaryFeatures(input, result)

    // 生成总体报告
    this.generateOverallReport(result)

    this.logger.info('权利要求检查完成', {
      totalIssues: result.overallReport.totalIssues,
    })

    return result
  }

  /**
   * 检查清楚、简要（第26条第4款）
   */
  private checkClarityAndBrevity(
    input: ClaimsCheckInput,
    result: ClaimsFormalityCheckResult
  ): void {
    const { claims } = input

    for (const claim of claims) {
      // 检查是否清楚
      if (this.isUnclear(claim.content)) {
        result.article26_4_clarity.issues.push({
          claimNumber: claim.number,
          issue: '权利要求不清楚',
          suggestion: '建议使用明确的技术术语，避免模糊词汇',
        })
      }

      // 检查是否简要
      if (!this.isConcise(claim.content)) {
        result.article26_4_clarity.issues.push({
          claimNumber: claim.number,
          issue: '权利要求不简要',
          suggestion: '建议删除非必要的技术细节，保持权利要求简洁',
        })
      }
    }

    result.article26_4_clarity.passed = result.article26_4_clarity.issues.length === 0
  }

  /**
   * 检查权利要求书支持（第26条第4款）
   */
  private checkSupportFromSpecification(
    input: ClaimsCheckInput,
    result: ClaimsFormalityCheckResult
  ): void {
    const { claims, specification } = input

    // 如果没有权利要求，跳过检查
    if (!claims || claims.length === 0) {
      result.article26_4_support.passed = true
      return
    }

    // 检查是否提供了说明书内容
    const hasSpecContent =
      specification &&
      (specification.technicalField ||
        specification.backgroundArt ||
        specification.inventionContent ||
        specification.embodiment)

    if (!hasSpecContent) {
      // 如果没有提供说明书，无法检查支持性
      result.article26_4_support.issues.push({
        claimNumber: 0,
        unsupportedFeature: '未提供说明书',
        suggestion: '请提供说明书以检查权利要求书的支持性',
      })
      result.article26_4_support.passed = false
      return
    }

    // 检查从属权利要求的基础权利要求是否存在
    for (const claim of claims) {
      if (claim.type === 'dependent' && claim.dependsOn) {
        const baseClaim = claims.find((c) => c.number === claim.dependsOn)
        if (!baseClaim) {
          result.article26_4_support.issues.push({
            claimNumber: claim.number,
            unsupportedFeature: `引用的权利要求${claim.dependsOn}不存在`,
            suggestion: `请确保权利要求${claim.dependsOn}存在或修改引用`,
          })
        }
      }
    }

    // 检查独立权利要求是否在说明书中得到支持
    const independentClaims = claims.filter((c) => c.type === 'independent')
    const specText = JSON.stringify(specification).toLowerCase()

    for (const claim of independentClaims) {
      // 提取权利要求中的关键技术特征
      const features = this.extractKeyFeatures(claim.content)

      for (const feature of features) {
        // 检查特征是否在说明书中提到
        if (!this.isFeatureInSpecification(feature, specText)) {
          result.article26_4_support.issues.push({
            claimNumber: claim.number,
            unsupportedFeature: feature,
            suggestion: `建议在说明书中补充对"${feature}"的描述`,
          })
        }
      }
    }

    result.article26_4_support.passed = result.article26_4_support.issues.length === 0
  }

  /**
   * 检查发明/实用新型定义（第4条第1款）
   */
  private checkPatentDefinition(input: ClaimsCheckInput, result: ClaimsFormalityCheckResult): void {
    const { claims, patentType } = input

    // 检查是否有方法特征
    for (const claim of claims) {
      const hasMethodFeature = this.hasMethodFeature(claim.content)

      if (patentType === 'invention' && hasMethodFeature) {
        // 发明专利不应该有方法特征
        result.article4_1_definition.issues.push({
          claimNumber: claim.number,
          issue: '发明专利包含方法特征',
          suggestion: '建议将方法特征写入具体实施方式，或在权利要求中限定为产品',
        })
      }

      if (patentType === 'utilityModel' && !hasMethodFeature) {
        // 实用新型应该有形状、构造特征
        result.article4_1_definition.issues.push({
          claimNumber: claim.number,
          issue: '实用新型缺少形状、构造特征',
          suggestion: '建议在权利要求中明确产品的形状、构造特征',
        })
      }
    }

    result.article4_1_definition.passed = result.article4_1_definition.issues.length === 0
  }

  /**
   * 检查非必要技术特征（实施细则第20条第1款）
   */
  private checkNecessaryFeatures(
    input: ClaimsCheckInput,
    result: ClaimsFormalityCheckResult
  ): void {
    const { claims } = input

    // 检查是否有明显非必要的技术特征
    for (const claim of claims) {
      const unnecessaryFeatures = this.identifyUnnecessaryFeatures(claim.content)

      for (const feature of unnecessaryFeatures) {
        result.rule20_1_necessaryFeatures.unnecessaryFeatures.push({
          claimNumber: claim.number,
          feature: feature.feature,
          reason: feature.reason,
        })
      }
    }

    result.rule20_1_necessaryFeatures.passed =
      result.rule20_1_necessaryFeatures.unnecessaryFeatures.length === 0
  }

  /**
   * 检查权利要求是否清楚
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
   * 检查权利要求是否简要
   */
  private isConcise(content: string): boolean {
    // 检查长度：超过300字可能不简要
    if (content.length > 300) {
      return false
    }

    // 检查是否包含过多细节描述
    const detailPatterns = [/其中所述/g, /具体来说/g, /优选地/g, /更优选地/g]

    const detailCount = detailPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern)
      return count + (matches ? matches.length : 0)
    }, 0)

    // 如果有3个或更多细节描述，可能不简要
    return detailCount < 3
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
    // 匹配模式：修饰词(2-4字) + 器件类型
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
    // 简单的子串匹配
    return specText.includes(feature)
  }

  /**
   * 检查是否有方法特征
   */
  private hasMethodFeature(content: string): boolean {
    const methodPatterns = [/.*方法.*/, /.*步骤.*/, /.*工艺.*/, /.*过程.*/]

    return methodPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * 识别非必要技术特征
   */
  private identifyUnnecessaryFeatures(content: string): Array<{
    feature: string
    reason: string
  }> {
    const unnecessary: Array<{ feature: string; reason: string }> = []

    // 检查是否包含公知常识
    const commonKnowledge = [
      { pattern: /采用常规技术/g, reason: '常规技术不需要写入权利要求' },
      { pattern: /使用现有技术/g, reason: '现有技术不需要写入权利要求' },
      { pattern: /本领域技术人员熟知/g, reason: '本领域技术人员熟知的内容不需要写入权利要求' },
    ]

    for (const item of commonKnowledge) {
      if (item.pattern.test(content)) {
        unnecessary.push({
          feature: item.pattern.source,
          reason: item.reason,
        })
      }
    }

    return unnecessary
  }

  /**
   * 生成总体报告
   */
  private generateOverallReport(result: ClaimsFormalityCheckResult): void {
    const totalIssues =
      result.article26_4_clarity.issues.length +
      result.article26_4_support.issues.length +
      result.article4_1_definition.issues.length +
      result.rule20_1_necessaryFeatures.unnecessaryFeatures.length

    const criticalIssues =
      result.article26_4_clarity.issues.length + result.article26_4_support.issues.length

    result.overallReport.totalIssues = totalIssues
    result.overallReport.criticalIssues = criticalIssues
    result.overallReport.passed = totalIssues === 0

    // 生成建议
    if (result.article26_4_clarity.issues.length > 0) {
      result.overallReport.recommendations.push('建议修改不清楚或不简要的权利要求')
    }

    if (result.article26_4_support.issues.length > 0) {
      result.overallReport.recommendations.push('建议补充说明书内容以支持权利要求')
    }

    if (result.article4_1_definition.issues.length > 0) {
      result.overallReport.recommendations.push('建议调整权利要求以符合专利类型定义')
    }

    if (result.rule20_1_necessaryFeatures.unnecessaryFeatures.length > 0) {
      result.overallReport.recommendations.push('建议删除非必要技术特征')
    }
  }
}
