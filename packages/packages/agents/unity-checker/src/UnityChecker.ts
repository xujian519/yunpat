/**
 * 单一性检查智能体
 *
 * 专门用于专利申请的单一性审查，包括：
 * 1. 实施细则第43条检查（单一性要求）
 * 2. 实施细则第44条检查（总的发明构思）
 * 3. 相同或相应的特定技术特征识别
 * 4. 技术关联性评估
 *
 * 特性：
 * - 基于专利法实施细则第43-44条
 * - 自动识别技术特征
 * - 评估单一性
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
 * 单一性检查输入
 */
export interface UnityCheckInput {
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
    /** 类别（用于分类） */
    category?: string
  }>

  /** 专利类型 */
  patentType: 'invention' | 'utilityModel'

  /** 发明名称 */
  inventionTitle?: string
}

/**
 * 特定技术特征
 */
interface TechnicalFeature {
  /** 特征内容 */
  content: string
  /** 特征类型 */
  type: 'structural' | 'functional' | 'compositional' | 'method'
  /** 重要性权重 */
  weight: number
}

/**
 * 独立权利要求分析
 */
interface IndependentClaimAnalysis {
  /** 权利要求编号 */
  claimNumber: number
  /** 权利要求内容 */
  content: string
  /** 提取的技术特征 */
  technicalFeatures: TechnicalFeature[]
  /** 主要技术特征 */
  primaryFeatures: string[]
  /** 技术领域 */
  technicalField?: string
}

/**
 * 单一性分析结果
 */
interface UnityAnalysis {
  /** 是否具备单一性 */
  hasUnity: boolean
  /** 总的发明构思 */
  generalInventiveConcept?: string
  /** 相同或相应的特定技术特征 */
  commonFeatures: string[]
  /** 技术关联性评分 (0-1) */
  technicalCorrelationScore: number
  /** 分析详情 */
  details: {
    /** 独立权利要求数量 */
    independentClaimsCount: number
    /** 具有单一性的权利要求组 */
    unifiedGroups: number[][]
    /** 不具备单一性的权利要求 */
    nonUnifiedClaims: number[]
  }
}

/**
 * 单一性检查结果
 */
export interface UnityCheckResult {
  /** 实施细则第43条（单一性要求） */
  rule43_unity: {
    passed: boolean
    issues: Array<{
      claimNumber: number
      issue: string
      suggestion: string
    }>
  }

  /** 实施细则第44条（总的发明构思） */
  rule44_generalConcept: {
    passed: boolean
    hasGeneralConcept: boolean
    generalConcept?: string
  }

  /** 技术特征分析 */
  featureAnalysis: {
    independentClaimsAnalysis: IndependentClaimAnalysis[]
    commonFeatures: string[]
    correspondingFeatures: Array<{
      claim1: number
      claim2: number
      feature: string
    }>
  }

  /** 单一性分析 */
  unityAnalysis: UnityAnalysis

  /** 总体报告 */
  overallReport: {
    passed: boolean
    totalIssues: number
    recommendations: string[]
    unityScore: number // 单一性评分 0-100
  }
}

/**
 * 单一性检查计划
 */
interface UnityCheckPlan {
  input: UnityCheckInput
  analysis: {
    totalClaims: number
    independentClaims: number
    dependentClaims: number
    claimCategories: string[]
  }
}

/**
 * 单一性检查智能体
 */
export class UnityChecker extends ProfessionalAgent<UnityCheckInput, UnityCheckResult> {
  private logger = createLogger('UnityChecker')

  constructor(config: ProfessionalAgentConfig) {
    super(config)
  }

  /**
   * 规划阶段：分析权利要求书
   */
  protected async plan(
    input: UnityCheckInput,
    _context: ExtendedExecutionContext
  ): Promise<UnityCheckPlan> {
    this.logger.info('开始规划单一性检查', {
      claimsCount: input.claims.length,
      patentType: input.patentType,
      inventionTitle: input.inventionTitle,
    })

    const independentClaims = input.claims.filter((c) => c.type === 'independent')

    // 输入验证
    this.checkInput(input)

    const dependentClaims = input.claims.filter((c) => c.type === 'dependent')

    this.logger.info('权利要求分类完成', {
      independentClaimsCount: independentClaims.length,
      dependentClaimsCount: dependentClaims.length,
    })

    // 提取权利要求类别
    const claimCategories = this.extractClaimCategories(input.claims)

    return {
      input,
      analysis: {
        totalClaims: input.claims.length,
        independentClaims: independentClaims.length,
        dependentClaims: dependentClaims.length,
        claimCategories,
      },
    }
  }

  /**
   * 验证输入参数
   */
  private checkInput(input: UnityCheckInput): void {
    // 验证权利要求
    if (!input.claims || input.claims.length === 0) {
      throw new AgentInputError('权利要求不能为空', 'claims')
    }

    // 验证专利类型
    const validTypes = ['invention', 'utilityModel', 'design']
    if (!validTypes.includes(input.patentType)) {
      throw new AgentInputError(
        `无效的专利类型: ${input.patentType}，必须是 ${validTypes.join('、')} 之一`,
        'patentType',
        input.patentType
      )
    }

    // 验证发明名称
    if (input.inventionTitle && input.inventionTitle.length > 200) {
      throw new AgentInputError(
        '发明名称过长（最大200字符）',
        'inventionTitle',
        input.inventionTitle.length
      )
    }

    // 验证权利要求数量
    if (input.claims.length > 100) {
      throw new AgentInputError(
        `权利要求数量过多（${input.claims.length}项），最多支持100项`,
        'claims',
        input.claims.length
      )
    }
  }

  /**
   * 执行阶段：执行单一性检查
   */
  protected async act(plan: UnityCheckPlan, _context: ExtendedExecutionContext): Promise<UnityCheckResult> {
    this.logger.info('开始执行单一性检查')

    const input = plan.input

    const result: UnityCheckResult = {
      rule43_unity: {
        passed: true,
        issues: [],
      },
      rule44_generalConcept: {
        passed: false,
        hasGeneralConcept: false,
      },
      featureAnalysis: {
        independentClaimsAnalysis: [],
        commonFeatures: [],
        correspondingFeatures: [],
      },
      unityAnalysis: {
        hasUnity: false,
        commonFeatures: [],
        technicalCorrelationScore: 0,
        details: {
          independentClaimsCount: plan.analysis.independentClaims,
          unifiedGroups: [],
          nonUnifiedClaims: [],
        },
      },
      overallReport: {
        passed: false,
        totalIssues: 0,
        recommendations: [],
        unityScore: 0,
      },
    }

    // 1. 分析独立权利要求的技术特征
    this.logger.debug('开始分析技术特征')
    this.analyzeIndependentClaims(input, result)

    // 2. 识别相同或相应的技术特征
    this.logger.debug('开始识别共同特征')
    this.identifyCommonFeatures(result)

    // 3. 检查单一性（第43条）
    this.logger.debug('开始检查单一性')
    this.checkUnityRequirement(plan, result)

    // 4. 评估总的发明构思（第44条）
    this.logger.debug('开始评估发明构思')
    this.evaluateGeneralInventiveConcept(result)

    // 5. 生成总体报告
    this.generateOverallReport(result)

    this.logger.info('单一性检查完成', {
      unityScore: result.overallReport.unityScore,
    })

    return result
  }

  /**
   * 分析独立权利要求的技术特征
   */
  private analyzeIndependentClaims(input: UnityCheckInput, result: UnityCheckResult): void {
    const independentClaims = input.claims.filter((c) => c.type === 'independent')

    for (const claim of independentClaims) {
      const features = this.extractTechnicalFeatures(claim.content)
      const primaryFeatures = this.identifyPrimaryFeatures(claim.content, features)

      const analysis: IndependentClaimAnalysis = {
        claimNumber: claim.number,
        content: claim.content,
        technicalFeatures: features,
        primaryFeatures,
        technicalField: this.inferTechnicalField(claim.content),
      }

      result.featureAnalysis.independentClaimsAnalysis.push(analysis)
    }
  }

  /**
   * 提取技术特征
   */
  private extractTechnicalFeatures(content: string): TechnicalFeature[] {
    const features: TechnicalFeature[] = []

    // 提取引号中的特征
    const quotedFeatures = content.match(/["'「」『』]([^"'「」『』]+)["'「」『』]/g) || []
    for (const quoted of quotedFeatures) {
      const featureContent = quoted.replace(/["'「」『』]/g, '')
      features.push({
        content: featureContent,
        type: this.inferFeatureType(featureContent),
        weight: 1.0,
      })
    }

    // 提取组件特征（排除通用词）
    const componentPatterns = [
      /([一-龥a-zA-Z0-9]{2,6})(?:芯片|电路|传感器|控制器|处理器|执行器|驱动器|接收器|发射器|显示器|存储器|计数器|定时器|调节器|变换器|转换器|适配器|连接器)/g,
    ]

    for (const pattern of componentPatterns) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        if (!features.some((f) => f.content === match)) {
          features.push({
            content: match,
            type: 'structural',
            weight: 0.8,
          })
        }
      }
    }

    return features
  }

  /**
   * 推断特征类型
   */
  private inferFeatureType(content: string): TechnicalFeature['type'] {
    if (/(方法|工艺|步骤|流程|过程)/.test(content)) return 'method'
    if (/(包括|包含|设有|设置|配置)/.test(content)) return 'structural'
    if (/(由.*组成|成分|材料|组合物)/.test(content)) return 'compositional'
    return 'functional'
  }

  /**
   * 识别主要技术特征
   */
  private identifyPrimaryFeatures(_content: string, features: TechnicalFeature[]): string[] {
    // 选取权重最高的特征作为主要特征
    const sortedFeatures = [...features].sort((a, b) => b.weight - a.weight)
    return sortedFeatures.slice(0, 3).map((f) => f.content)
  }

  /**
   * 推断技术领域
   */
  private inferTechnicalField(content: string): string | undefined {
    const fieldPatterns = [
      { pattern: /电子|电路|芯片|处理器|控制器|传感器/, field: '电子技术' },
      { pattern: /机械|装置|设备|机构|结构/, field: '机械工程' },
      { pattern: /化学|材料|组合物|成分|合成/, field: '化学工程' },
      { pattern: /软件|算法|数据处理|计算|程序/, field: '计算机软件' },
      { pattern: /通信|网络|传输|信号/, field: '通信技术' },
    ]

    for (const { pattern, field } of fieldPatterns) {
      if (pattern.test(content)) return field
    }

    return undefined
  }

  /**
   * 识别共同特征
   */
  private identifyCommonFeatures(result: UnityCheckResult): void {
    const analyses = result.featureAnalysis.independentClaimsAnalysis

    if (analyses.length < 2) return

    // 提取所有权利要求的特征
    const allFeatures = analyses.map((a) => a.technicalFeatures.map((f) => f.content))

    // 找出共同特征
    const common: string[] = []
    const firstClaimFeatures = allFeatures[0] || []

    for (const feature of firstClaimFeatures) {
      // 检查是否在所有其他权利要求中都存在
      const isInAll = allFeatures.slice(1).every((features) => features.includes(feature))

      if (isInAll && !common.includes(feature)) {
        common.push(feature)
      }
    }

    result.featureAnalysis.commonFeatures = common

    // 识别相应特征（相似但不完全相同）
    this.identifyCorrespondingFeatures(result)
  }

  /**
   * 识别相应特征
   */
  private identifyCorrespondingFeatures(result: UnityCheckResult): void {
    const analyses = result.featureAnalysis.independentClaimsAnalysis

    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const features1 = analyses[i].technicalFeatures.map((f) => f.content)
        const features2 = analyses[j].technicalFeatures.map((f) => f.content)

        // 检查相似特征
        for (const f1 of features1) {
          for (const f2 of features2) {
            if (this.areFeaturesCorresponding(f1, f2)) {
              result.featureAnalysis.correspondingFeatures.push({
                claim1: analyses[i].claimNumber,
                claim2: analyses[j].claimNumber,
                feature: f1,
              })
            }
          }
        }
      }
    }
  }

  /**
   * 判断两个特征是否相应
   */
  private areFeaturesCorresponding(feature1: string, feature2: string): boolean {
    // 完全相同
    if (feature1 === feature2) return false // 已经在commonFeatures中处理

    // 包含关系
    if (feature1.includes(feature2) || feature2.includes(feature1)) return true

    // 相似度检查（简单实现）
    const similarity = this.calculateSimilarity(feature1, feature2)
    return similarity > 0.6
  }

  /**
   * 计算相似度（改进版：结合多种算法）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    const maxLen = Math.max(len1, len2)

    if (maxLen === 0) return 0

    // 1. 字符重叠度（0-1）
    const commonChars = str1.split('').filter((char) => str2.includes(char)).length
    const charOverlap = commonChars / maxLen

    // 2. Jaccard相似度（基于词）
    const words1 = new Set(str1.split(/\s+/).filter((w) => w.length > 0))
    const words2 = new Set(str2.split(/\s+/).filter((w) => w.length > 0))

    if (words1.size === 0 && words2.size === 0) {
      // 两个都是空或只有空白
      return charOverlap
    }

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])
    const jaccard = union.size > 0 ? intersection.size / union.size : 0

    // 3. 余弦相似度（简化版）
    const bigram1 = this.getBigrams(str1)
    const bigram2 = this.getBigrams(str2)
    const commonBigrams = bigram1.filter((b) => bigram2.includes(b))
    const cosineSimilarity =
      bigram1.length > 0 && bigram2.length > 0
        ? (2 * commonBigrams.length) / (bigram1.length + bigram2.length)
        : 0

    // 加权组合
    // 字符重叠度: 0.2（不够准确）
    // Jaccard相似度: 0.5（考虑词级别）
    // 余弦相似度: 0.3（考虑序列特征）
    return charOverlap * 0.2 + jaccard * 0.5 + cosineSimilarity * 0.3
  }

  /**
   * 获取二元组（用于余弦相似度）
   */
  private getBigrams(text: string): string[] {
    const bigrams: string[] = []
    const chars = text.split('')
    for (let i = 0; i < chars.length - 1; i++) {
      bigrams.push(chars[i] + chars[i + 1])
    }
    return bigrams
  }

  /**
   * 检查单一性要求（第43条）
   */
  private checkUnityRequirement(plan: UnityCheckPlan, result: UnityCheckResult): void {
    const { independentClaims } = plan.analysis

    // 只有一个独立权利要求，自动具备单一性
    if (independentClaims <= 1) {
      result.rule43_unity.passed = true
      result.unityAnalysis.hasUnity = true
      result.unityAnalysis.details.unifiedGroups = [
        result.featureAnalysis.independentClaimsAnalysis.map((a) => a.claimNumber),
      ]
      return
    }

    // 检查是否有共同特征或相应特征
    const hasCommonFeatures = result.featureAnalysis.commonFeatures.length > 0
    const hasCorrespondingFeatures = result.featureAnalysis.correspondingFeatures.length > 0

    if (!hasCommonFeatures && !hasCorrespondingFeatures) {
      // 没有共同或相应特征，不具备单一性
      const independentClaimNumbers = result.featureAnalysis.independentClaimsAnalysis.map(
        (a) => a.claimNumber
      )

      for (const claimNum of independentClaimNumbers) {
        result.rule43_unity.issues.push({
          claimNumber: claimNum,
          issue: '与其他独立权利要求之间缺乏相同或相应的特定技术特征',
          suggestion: '建议删除或分案申请',
        })
      }

      result.rule43_unity.passed = false
      result.unityAnalysis.hasUnity = false
      result.unityAnalysis.details.nonUnifiedClaims = independentClaimNumbers
    } else {
      result.rule43_unity.passed = true
      result.unityAnalysis.hasUnity = true

      // 分组具有单一性的权利要求
      result.unityAnalysis.details.unifiedGroups = [
        result.featureAnalysis.independentClaimsAnalysis.map((a) => a.claimNumber),
      ]
    }
  }

  /**
   * 评估总的发明构思（第44条）
   */
  private evaluateGeneralInventiveConcept(result: UnityCheckResult): void {
    const analyses = result.featureAnalysis.independentClaimsAnalysis

    if (analyses.length <= 1) {
      result.rule44_generalConcept.passed = true
      result.rule44_generalConcept.hasGeneralConcept = true
      result.rule44_generalConcept.generalConcept = analyses[0]?.content || '单一发明'
      return
    }

    // 基于共同特征生成总的发明构思
    const commonFeatures = result.featureAnalysis.commonFeatures

    if (commonFeatures.length > 0) {
      result.rule44_generalConcept.hasGeneralConcept = true
      result.rule44_generalConcept.generalConcept = `基于${commonFeatures.join('、')}的${analyses.length}项相关发明`
      result.rule44_generalConcept.passed = true
      result.unityAnalysis.generalInventiveConcept = result.rule44_generalConcept.generalConcept

      // 计算技术关联性评分
      result.unityAnalysis.technicalCorrelationScore = Math.min(
        1.0,
        0.5 + commonFeatures.length * 0.1
      )
    } else {
      result.rule44_generalConcept.hasGeneralConcept = false
      result.rule44_generalConcept.passed = false

      // 基于相应特征计算关联性
      const correspondingCount = result.featureAnalysis.correspondingFeatures.length
      result.unityAnalysis.technicalCorrelationScore = Math.min(1.0, correspondingCount * 0.15)
    }
  }

  /**
   * 生成总体报告
   */
  private generateOverallReport(result: UnityCheckResult): void {
    const totalIssues = result.rule43_unity.issues.length

    result.overallReport.totalIssues = totalIssues

    // 计算单一性评分
    const baseScore = result.unityAnalysis.hasUnity ? 60 : 0
    const correlationBonus = result.unityAnalysis.technicalCorrelationScore * 40
    result.overallReport.unityScore = Math.round(baseScore + correlationBonus)

    result.overallReport.passed = result.rule43_unity.passed && result.rule44_generalConcept.passed

    // 生成建议
    if (!result.unityAnalysis.hasUnity) {
      result.overallReport.recommendations.push('建议将不具备单一性的权利要求分案申请')
    }

    if (result.rule43_unity.issues.length > 0) {
      result.overallReport.recommendations.push('建议删除或修改不具备单一性的权利要求')
    }

    if (
      !result.rule44_generalConcept.hasGeneralConcept &&
      result.featureAnalysis.independentClaimsAnalysis.length > 1
    ) {
      result.overallReport.recommendations.push(
        '建议补充总的发明构思说明，或调整权利要求使其属于同一发明构思'
      )
    }

    if (result.overallReport.unityScore >= 80) {
      result.overallReport.recommendations.push('单一性良好，可以继续申请')
    } else if (result.overallReport.unityScore >= 60) {
      result.overallReport.recommendations.push('单一性一般，建议进一步优化权利要求的关联性')
    }
  }

  /**
   * 提取权利要求类别
   */
  private extractClaimCategories(claims: UnityCheckInput['claims']): string[] {
    const categories = new Set<string>()

    for (const claim of claims) {
      if (claim.category) {
        categories.add(claim.category)
      }
    }

    return Array.from(categories)
  }
}
