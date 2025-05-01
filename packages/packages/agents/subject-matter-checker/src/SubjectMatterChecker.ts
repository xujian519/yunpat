/**
 * 保护客体检查智能体
 *
 * 专门用于专利申请的保护客体审查，包括：
 * 1. 专利法第2条检查（发明定义）
 * 2. 专利法第25条检查（不授予专利权的客体）
 * 3. 智力活动规则和方法检查
 * 4. 技术方案判断
 * 5. 违法性检查
 *
 * 特性：
 * - 基于专利法具体条款
 * - 自动识别非技术方案
 * - 判断保护客体适格性
 * - TDD方式（测试驱动开发）
 */

import {
  KnowledgeEnhancedAgent,
  type EventBus,
  createLogger,
  AgentInputError,
  type MemoryStore,
  type ToolRegistry,
  type LLMAdapter,
  type ExecutionContext,
} from '@yunpat/core'

/**
 * 保护客体检查输入
 */
export interface SubjectMatterCheckInput {
  /** 发明名称 */
  inventionTitle: string

  /** 权利要求书 */
  claims: Array<{
    /** 类型：独立或从属 */
    type: 'independent' | 'dependent'
    /** 编号 */
    number: number
    /** 内容 */
    content: string
  }>

  /** 说明书（用于辅助判断） */
  specification?: {
    /** 技术领域 */
    technicalField?: string
    /** 背景技术 */
    backgroundArt?: string
    /** 发明内容 */
    inventionContent?: string
  }

  /** 专利类型 */
  patentType: 'invention' | 'utilityModel'
}

/**
 * 保护客体分析结果
 */
interface SubjectMatterAnalysis {
  /** 是否属于技术方案 */
  isTechnicalSolution: boolean
  /** 技术特征 */
  technicalFeatures: string[]
  /** 解决的技术问题 */
  technicalProblem?: string
  /** 技术效果 */
  technicalEffect?: string
}

/**
 * 非保护客体识别结果
 */
interface NonProtectableSubjectMatter {
  /** 类型 */
  type:
    | 'scientific_discovery'
    | 'intellectual_activity_rules'
    | 'medical_diagnosis_treatment'
    | 'animal_plant_variety'
    | 'nuclear_transformation'
    | 'illegal_content'
    | 'aesthetic_design'
    | 'computer_program_only'
  /** 类型名称 */
  typeName: string
  /** 原因 */
  reason: string
  /** 涉及的权利要求 */
  relatedClaims: number[]
}

/**
 * 保护客体检查结果
 */
export interface SubjectMatterCheckResult {
  /** 专利法第2条（发明定义） */
  article2_inventionDefinition: {
    passed: boolean
    isTechnicalSolution: boolean
    issues: Array<{
      claimNumber: number
      issue: string
      suggestion: string
    }>
  }

  /** 专利法第25条（不授予专利权的客体） */
  article25_exclusions: {
    passed: boolean
    nonProtectableMatters: NonProtectableSubjectMatter[]
  }

  /** 技术方案分析 */
  technicalSolutionAnalysis: {
    independentClaimsAnalysis: SubjectMatterAnalysis[]
    hasTechnicalSolution: boolean
  }

  /** 智力活动规则检查 */
  intellectualActivityCheck: {
    hasIntellectualActivityRules: boolean
    detectedRules: Array<{
      claimNumber: number
      ruleType: string
      description: string
    }>
  }

  /** 违法性检查 */
  legalityCheck: {
    passed: boolean
    illegalContent?: {
      claimNumber: number
      content: string
      reason: string
    }
  }

  /** 总体报告 */
  overallReport: {
    passed: boolean
    totalIssues: number
    criticalIssues: number
    isProtectableSubjectMatter: boolean
    recommendations: string[]
  }
}

/**
 * 保护客体检查计划
 */
interface SubjectMatterCheckPlan {
  input: SubjectMatterCheckInput
  analysis: {
    totalClaims: number
    independentClaims: number
    hasTechnicalField: boolean
    hasInventionContent: boolean
  }
}

/**
 * 保护客体检查智能体
 */
export class SubjectMatterChecker extends KnowledgeEnhancedAgent<
  SubjectMatterCheckInput,
  SubjectMatterCheckResult
> {
  private logger = createLogger('SubjectMatterChecker')

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
   * 规划阶段：分析专利申请
   */
  protected async plan(
    input: SubjectMatterCheckInput,
    _context: ExecutionContext
  ): Promise<SubjectMatterCheckPlan> {
    this.logger.info('开始规划保护客体检查', {
      inventionTitle: input.inventionTitle,
      claimsCount: input.claims.length,
      patentType: input.patentType,
    })

    const independentClaims = input.claims.filter((c) => c.type === 'independent')
    const hasTechnicalField = !!input.specification?.technicalField?.trim()
    const hasInventionContent = !!input.specification?.inventionContent?.trim()

    this.logger.info('说明书信息检查完成', {
      independentClaimsCount: independentClaims.length,
      hasTechnicalField,
      hasInventionContent,
    })

    return {
      input,
      analysis: {
        totalClaims: input.claims.length,
        independentClaims: independentClaims.length,
        hasTechnicalField,
        hasInventionContent,
      },
    }
  }

  /**
   * 执行阶段：执行保护客体检查
   */
  protected async act(
    plan: SubjectMatterCheckPlan,
    _context: ExecutionContext
  ): Promise<SubjectMatterCheckResult> {
    this.logger.info('开始执行保护客体检查')

    const input = plan.input

    const result: SubjectMatterCheckResult = {
      article2_inventionDefinition: {
        passed: true,
        isTechnicalSolution: false,
        issues: [],
      },
      article25_exclusions: {
        passed: true,
        nonProtectableMatters: [],
      },
      technicalSolutionAnalysis: {
        independentClaimsAnalysis: [],
        hasTechnicalSolution: false,
      },
      intellectualActivityCheck: {
        hasIntellectualActivityRules: false,
        detectedRules: [],
      },
      legalityCheck: {
        passed: true,
      },
      overallReport: {
        passed: false,
        totalIssues: 0,
        criticalIssues: 0,
        isProtectableSubjectMatter: false,
        recommendations: [],
      },
    }

    // 1. 分析技术方案（第2条）
    this.logger.debug('开始分析技术方案')
    this.analyzeTechnicalSolutions(input, result)

    // 2. 检查智力活动规则（第25条第1款第2项）
    this.logger.debug('开始检查智力活动规则')
    this.checkIntellectualActivityRules(input, result)

    // 3. 检查疾病诊断治疗方法（第25条第1款第3项）
    this.logger.debug('开始检查诊断治疗方法')
    this.checkMedicalDiagnosisTreatment(input, result)

    // 4. 检查违法性（第5条）
    this.logger.debug('开始检查违法性')
    this.checkLegality(input, result)

    // 5. 检查其他排除客体（第25条）
    this.logger.debug('开始检查其他排除客体')
    this.checkOtherExclusions(input, result)

    // 6. 生成总体报告
    this.generateOverallReport(result)

    this.logger.info('保护客体检查完成', {
      totalIssues: result.overallReport.totalIssues,
    })

    return result
  }

  /**
   * 分析技术方案（第2条）
   */
  private analyzeTechnicalSolutions(
    input: SubjectMatterCheckInput,
    result: SubjectMatterCheckResult
  ): void {
    const independentClaims = input.claims.filter((c) => c.type === 'independent')

    let hasTechnicalSolution = false

    for (const claim of independentClaims) {
      const analysis = this.analyzeClaimAsTechnicalSolution(claim, input)
      result.technicalSolutionAnalysis.independentClaimsAnalysis.push(analysis)

      if (analysis.isTechnicalSolution) {
        hasTechnicalSolution = true
      } else {
        result.article2_inventionDefinition.issues.push({
          claimNumber: claim.number,
          issue: '权利要求不构成技术方案',
          suggestion: '建议修改权利要求，使其包含技术特征、解决技术问题并产生技术效果',
        })
      }
    }

    result.technicalSolutionAnalysis.hasTechnicalSolution = hasTechnicalSolution
    result.article2_inventionDefinition.isTechnicalSolution = hasTechnicalSolution
    result.article2_inventionDefinition.passed = hasTechnicalSolution
  }

  /**
   * 分析权利要求是否为技术方案
   */
  private analyzeClaimAsTechnicalSolution(
    claim: { number: number; content: string },
    input: SubjectMatterCheckInput
  ): SubjectMatterAnalysis {
    const analysis: SubjectMatterAnalysis = {
      isTechnicalSolution: false,
      technicalFeatures: [],
    }

    // 检查是否包含技术特征
    analysis.technicalFeatures = this.extractTechnicalFeatures(claim.content)

    // 检查是否包含技术手段
    const hasTechnicalMeans = this.hasTechnicalMeans(claim.content)

    // 检查是否解决技术问题
    const technicalProblem = this.inferTechnicalProblem(input)
    analysis.technicalProblem = technicalProblem

    // 检查是否产生技术效果
    const technicalEffect = this.inferTechnicalEffect(input)
    analysis.technicalEffect = technicalEffect

    // 判断是否为技术方案
    // 技术方案 = 技术手段 + 技术问题 + 技术效果
    const hasAllThree =
      hasTechnicalMeans &&
      !!technicalProblem &&
      !!technicalEffect &&
      analysis.technicalFeatures.length > 0

    analysis.isTechnicalSolution = hasAllThree

    return analysis
  }

  /**
   * 提取技术特征
   */
  private extractTechnicalFeatures(content: string): string[] {
    const features: string[] = []

    // 提取引号中的特征
    const quotedFeatures = content.match(/["'「」『』]([^"'「」『』]+)["'「」『』]/g) || []
    for (const quoted of quotedFeatures) {
      const feature = quoted.replace(/["'「」『』]/g, '')
      if (feature.length >= 2) {
        features.push(feature)
      }
    }

    // 提取技术组件
    const technicalPatterns = [
      /([一-龥a-zA-Z0-9]{2,6})(?:装置|设备|机构|系统|单元|模块|组件|器件|器|电路|网络|总线|接口)/g,
    ]

    for (const pattern of technicalPatterns) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        if (!features.includes(match)) {
          features.push(match)
        }
      }
    }

    return features
  }

  /**
   * 检查是否包含技术手段
   */
  private hasTechnicalMeans(content: string): boolean {
    // 技术手段关键词
    const technicalMeansPatterns = [
      /装置|设备|机构|系统|单元|模块|组件|器件|电路|网络/g,
      /采用|利用|使用|设置|配置|安装|连接/g,
      /通过|经由|基于/g,
    ]

    return technicalMeansPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * 推断技术问题
   */
  private inferTechnicalProblem(input: SubjectMatterCheckInput): string | undefined {
    const { specification } = input

    if (!specification) return undefined

    // 从背景技术中推断技术问题
    if (specification.backgroundArt) {
      const problemPatterns = [
        /(?:存在|有)(?:问题|不足|缺点|缺陷|困难)/g,
        /(?:需要|缺乏|缺少)/g,
        /(?:低|差|弱|慢)/g,
      ]

      for (const pattern of problemPatterns) {
        const match = specification.backgroundArt.match(pattern)
        if (match) {
          return '存在技术问题'
        }
      }
    }

    return undefined
  }

  /**
   * 推断技术效果
   */
  private inferTechnicalEffect(input: SubjectMatterCheckInput): string | undefined {
    const { specification } = input

    if (!specification) return undefined

    // 从发明内容中推断技术效果
    if (specification.inventionContent) {
      const effectPatterns = [
        /(?:提高|改善|增强|优化|减少|降低|节省)/g,
        /(?:效率|精度|性能|质量|稳定性)/g,
      ]

      for (const pattern of effectPatterns) {
        const match = specification.inventionContent.match(pattern)
        if (match) {
          return '产生技术效果'
        }
      }
    }

    return undefined
  }

  /**
   * 检查智力活动规则（第25条第1款第2项）
   */
  private checkIntellectualActivityRules(
    input: SubjectMatterCheckInput,
    result: SubjectMatterCheckResult
  ): void {
    const intellectualActivityPatterns = [
      { pattern: /(?:方法|步骤).*(?:计算|运算|统计|分析|推理|判断|决策)/g, type: '智力活动方法' },
      { pattern: /(?:规则|方法|模式|算法|模型).*(?:管理|控制|优化)/g, type: '管理规则' },
      { pattern: /(?:游戏|竞赛|比赛).*(?:规则|方法)/g, type: '游戏规则' },
      { pattern: /(?:商业|经营|营销).*(?:模式|方法|策略)/g, type: '商业模式' },
      { pattern: /(?:流程|程序).*(?:管理|审批|审核)/g, type: '管理流程' },
    ]

    for (const claim of input.claims) {
      for (const { pattern, type } of intellectualActivityPatterns) {
        if (pattern.test(claim.content)) {
          result.intellectualActivityCheck.hasIntellectualActivityRules = true
          result.intellectualActivityCheck.detectedRules.push({
            claimNumber: claim.number,
            ruleType: type,
            description: `检测到${type}相关表述`,
          })

          // 添加到排除客体
          result.article25_exclusions.nonProtectableMatters.push({
            type: 'intellectual_activity_rules',
            typeName: '智力活动的规则和方法',
            reason: '仅涉及智力活动的规则和方法，未采用技术手段',
            relatedClaims: [claim.number],
          })
        }
      }
    }
  }

  /**
   * 检查疾病诊断治疗方法（第25条第1款第3项）
   */
  private checkMedicalDiagnosisTreatment(
    input: SubjectMatterCheckInput,
    result: SubjectMatterCheckResult
  ): void {
    const medicalPatterns = [
      /(?:疾病|病症|病情).*(?:诊断|检查|筛查|检测)/g,
      /(?:手术|治疗|疗法|医治).*(?:方法|方案)/g,
      /(?:药物|药品).*(?:配方|组合物).*(?:用于|治疗)/g,
      /(?:针灸|按摩|理疗).*(?:方法)/g,
    ]

    for (const claim of input.claims) {
      for (const pattern of medicalPatterns) {
        if (pattern.test(claim.content)) {
          result.article25_exclusions.nonProtectableMatters.push({
            type: 'medical_diagnosis_treatment',
            typeName: '疾病的诊断和治疗方法',
            reason: '涉及疾病的诊断和治疗方法',
            relatedClaims: [claim.number],
          })
        }
      }
    }
  }

  /**
   * 检查违法性（第5条）
   */
  private checkLegality(input: SubjectMatterCheckInput, result: SubjectMatterCheckResult): void {
    const illegalPatterns = [
      { pattern: /(?:赌博|博彩|赌场)/g, reason: '涉及赌博' },
      { pattern: /(?:毒品|违禁品|非法药物)/g, reason: '涉及违禁品' },
      { pattern: /(?:诈骗|欺诈|传销)/g, reason: '涉及违法犯罪' },
    ]

    for (const claim of input.claims) {
      for (const { pattern, reason } of illegalPatterns) {
        if (pattern.test(claim.content)) {
          result.legalityCheck.passed = false
          result.legalityCheck.illegalContent = {
            claimNumber: claim.number,
            content: claim.content,
            reason,
          }

          result.article25_exclusions.nonProtectableMatters.push({
            type: 'illegal_content',
            typeName: '违反法律、社会公德',
            reason,
            relatedClaims: [claim.number],
          })
        }
      }
    }
  }

  /**
   * 检查其他排除客体（第25条）
   */
  private checkOtherExclusions(
    input: SubjectMatterCheckInput,
    result: SubjectMatterCheckResult
  ): void {
    // 科学发现
    const discoveryPatterns = [/(?:发现|找到).*(?:新|未知)/g, /(?:规律|原理|定理).*(?:发现|揭示)/g]

    // 动植物品种
    const animalPlantPatterns = [/(?:动物|植物).*(?:品种|变种)/g, /(?:育种|培育).*(?:方法|技术)/g]

    // 原子核变换方法
    const nuclearPatterns = [/(?:原子核|核能).*(?:变换|裂变|聚变)/g]

    // 单纯的计算机程序
    const computerProgramPatterns = [
      /(?:仅仅|仅|单纯).*(?:计算机程序|软件|代码)/g,
      /(?:存储介质|载体).*(?:计算机程序)/g,
    ]

    for (const claim of input.claims) {
      // 检查科学发现
      for (const pattern of discoveryPatterns) {
        if (pattern.test(claim.content)) {
          result.article25_exclusions.nonProtectableMatters.push({
            type: 'scientific_discovery',
            typeName: '科学发现',
            reason: '属于科学发现，不是技术方案',
            relatedClaims: [claim.number],
          })
        }
      }

      // 检查动植物品种
      for (const pattern of animalPlantPatterns) {
        if (pattern.test(claim.content)) {
          result.article25_exclusions.nonProtectableMatters.push({
            type: 'animal_plant_variety',
            typeName: '动物和植物品种',
            reason: '涉及动物和植物品种',
            relatedClaims: [claim.number],
          })
        }
      }

      // 检查原子核变换方法
      for (const pattern of nuclearPatterns) {
        if (pattern.test(claim.content)) {
          result.article25_exclusions.nonProtectableMatters.push({
            type: 'nuclear_transformation',
            typeName: '原子核变换方法',
            reason: '涉及原子核变换方法',
            relatedClaims: [claim.number],
          })
        }
      }

      // 检查单纯的计算机程序
      for (const pattern of computerProgramPatterns) {
        if (pattern.test(claim.content)) {
          result.article25_exclusions.nonProtectableMatters.push({
            type: 'computer_program_only',
            typeName: '单纯的计算机程序',
            reason: '单纯的计算机程序不是专利保护客体',
            relatedClaims: [claim.number],
          })
        }
      }
    }

    // 更新通过状态
    result.article25_exclusions.passed =
      result.article25_exclusions.nonProtectableMatters.length === 0
  }

  /**
   * 生成总体报告
   */
  private generateOverallReport(result: SubjectMatterCheckResult): void {
    const totalIssues =
      result.article2_inventionDefinition.issues.length +
      result.article25_exclusions.nonProtectableMatters.length +
      (result.legalityCheck.illegalContent ? 1 : 0)

    const criticalIssues = result.article25_exclusions.nonProtectableMatters.filter(
      (m) => m.type === 'illegal_content' || m.type === 'computer_program_only'
    ).length

    result.overallReport.totalIssues = totalIssues
    result.overallReport.criticalIssues = criticalIssues
    result.overallReport.isProtectableSubjectMatter =
      result.article2_inventionDefinition.passed && result.article25_exclusions.passed

    result.overallReport.passed =
      result.overallReport.isProtectableSubjectMatter && criticalIssues === 0

    // 生成建议
    if (!result.article2_inventionDefinition.passed) {
      result.overallReport.recommendations.push(
        '建议修改权利要求，使其包含技术手段、解决技术问题并产生技术效果'
      )
    }

    if (result.intellectualActivityCheck.hasIntellectualActivityRules) {
      result.overallReport.recommendations.push(
        '建议在权利要求中增加技术手段，避免仅涉及智力活动规则'
      )
    }

    if (
      result.article25_exclusions.nonProtectableMatters.some(
        (m) => m.type === 'computer_program_only'
      )
    ) {
      result.overallReport.recommendations.push(
        '建议修改权利要求，使其包含硬件技术特征，或采用"方法+装置"的撰写方式'
      )
    }

    if (
      result.article25_exclusions.nonProtectableMatters.some(
        (m) => m.type === 'medical_diagnosis_treatment'
      )
    ) {
      result.overallReport.recommendations.push(
        '疾病的诊断和治疗方法不能授予专利，但诊断设备和治疗器械可以申请专利'
      )
    }

    if (!result.legalityCheck.passed) {
      result.overallReport.recommendations.push('专利申请不得违反法律、社会公德或者妨害公共利益')
    }

    if (result.overallReport.isProtectableSubjectMatter) {
      result.overallReport.recommendations.push('该申请属于专利保护客体')
    }
  }
}
