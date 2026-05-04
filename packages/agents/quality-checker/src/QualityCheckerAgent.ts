import { Agent, type ExecutionContext, createLogger } from '@yunpat/core'

/**
 * 质量检查输入
 */
export interface QualityCheckInput {
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
  /** 专利类型 */
  patentType: 'invention' | 'utilityModel' | 'design'
  /** 发明名称 */
  inventionTitle: string
  /** 附图（可选） */
  drawings?: Array<{
    figureNumber: string
    description: string
  }>
}

/**
 * 权利要求质量评分
 */
export interface ClaimsQuality {
  /** 清晰度 */
  clarity: number
  /** 支持度 */
  support: number
  /** 宽适度 */
  breadth: number
  /** 总体评分 */
  overall: number
}

/**
 * 说明书质量评分
 */
export interface SpecificationQuality {
  /** 清晰度 */
  clarity: number
  /** 充分性 */
  sufficiency: number
  /** 一致性 */
  consistency: number
  /** 总体评分 */
  overall: number
}

/**
 * 语言质量评分
 */
export interface LanguageQuality {
  /** 语法 */
  grammar: number
  /** 术语 */
  terminology: number
  /** 总体评分 */
  overall: number
}

/**
 * 质量评分
 */
export interface QualityScores {
  /** 权利要求质量 */
  claims: ClaimsQuality
  /** 说明书质量 */
  specification: SpecificationQuality
  /** 语言质量 */
  language: LanguageQuality
}

/**
 * 问题
 */
export interface Issue {
  /** 类别 */
  category: string
  /** 严重程度 */
  severity: 'high' | 'medium' | 'low'
  /** 描述 */
  description: string
  /** 建议 */
  suggestion: string
}

/**
 * 改进建议
 */
export interface Recommendation {
  /** 区域 */
  area: string
  /** 当前 */
  current: string
  /** 建议 */
  suggested: string
  /** 理由 */
  rationale: string
}

/**
 * 对比数据
 */
export interface Comparison {
  /** 平均质量 */
  averageQuality: number
  /** 百分位 */
  percentile: number
  /** 排名 */
  ranking: string
}

/**
 * 质量检查结果
 */
export interface QualityCheckResult {
  /** 完整性评分 */
  completenessScore: number
  /** 质量评分 */
  qualityScores: QualityScores
  /** 总体质量 */
  overallQuality: number
  /** 问题列表 */
  issues: Issue[]
  /** 改进建议 */
  recommendations: Recommendation[]
  /** 对比数据 */
  comparison: Comparison
}

interface QualityCheckPlan {
  input: QualityCheckInput
}

/**
 * 质量检查Agent
 *
 * 功能：
 * 1. 完整性检查
 * 2. 质量评分
 * 3. 改进建议生成
 */
export class QualityCheckerAgent extends Agent<QualityCheckInput, QualityCheckResult> {
  private logger = createLogger('QualityCheckerAgent')

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

  protected async plan(
    input: QualityCheckInput,
    _context: ExecutionContext
  ): Promise<QualityCheckPlan> {
    this.logger.info('开始规划质量检查', {
      inventionTitle: input.inventionTitle,
      claimsCount: input.claims.length,
    })

    return {
      input,
    }
  }

  protected async act(
    plan: QualityCheckPlan,
    _context: ExecutionContext
  ): Promise<QualityCheckResult> {
    this.logger.info('开始执行质量检查')

    const { input } = plan

    // 1. 完整性检查
    const completenessScore = this.checkCompleteness(input)

    // 2. 质量评分
    const qualityScores = this.calculateQualityScores(input)

    // 3. 总体质量
    const overallQuality = this.calculateOverallQuality(completenessScore, qualityScores)

    // 4. 问题检测
    const issues = this.detectIssues(input, qualityScores)

    // 5. 改进建议
    const recommendations = this.generateRecommendations(input, issues)

    // 6. 对比数据
    const comparison = this.generateComparison(overallQuality)

    this.logger.info('质量检查完成', {
      completenessScore: completenessScore.toFixed(1),
      overallQuality: overallQuality.toFixed(1),
      issuesCount: issues.length,
    })

    return {
      completenessScore,
      qualityScores,
      overallQuality,
      issues,
      recommendations,
      comparison,
    }
  }

  /**
   * 完整性检查
   */
  private checkCompleteness(input: QualityCheckInput): number {
    let score = 0
    const maxScore = 100

    // 发明名称（10分）
    if (input.inventionTitle && input.inventionTitle.length > 0) {
      score += 10
    }

    // 权利要求（30分）
    if (input.claims && input.claims.length > 0) {
      const hasIndependent = input.claims.some((c) => c.type === 'independent')
      if (hasIndependent) score += 15
      if (input.claims.length >= 2) score += 15
    }

    // 说明书（60分）
    const spec = input.specification
    if (spec) {
      if (spec.technicalField && spec.technicalField.length > 10) score += 15
      if (spec.backgroundArt && spec.backgroundArt.length > 20) score += 15
      if (spec.inventionContent && spec.inventionContent.length > 20) score += 15
      if (spec.embodiment && spec.embodiment.length > 30) score += 15
    }

    return Math.min(score, maxScore)
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScores(input: QualityCheckInput): QualityScores {
    // 权利要求质量
    const claimsQuality = this.assessClaimsQuality(input)

    // 说明书质量
    const specificationQuality = this.assessSpecificationQuality(input)

    // 语言质量
    const languageQuality = this.assessLanguageQuality(input)

    return {
      claims: claimsQuality,
      specification: specificationQuality,
      language: languageQuality,
    }
  }

  /**
   * 评估权利要求质量
   */
  private assessClaimsQuality(input: QualityCheckInput): ClaimsQuality {
    // 清晰度：基于句子长度和结构
    let clarity = 100
    const avgClaimLength =
      input.claims.reduce((sum, c) => sum + c.content.length, 0) / input.claims.length
    if (avgClaimLength > 200) clarity -= 20
    if (avgClaimLength > 300) clarity -= 20

    // 支持度：基于从属权利要求比例
    let support = 100
    const dependentCount = input.claims.filter((c) => c.type === 'dependent').length
    const independentCount = input.claims.filter((c) => c.type === 'independent').length
    if (independentCount > 0 && dependentCount / independentCount < 1) {
      support -= 30
    }

    // 宽适度：基于权利要求数量
    let breadth = 100
    if (input.claims.length < 3) breadth -= 20
    if (input.claims.length < 5) breadth -= 10

    // 总体评分
    const overall = (clarity + support + breadth) / 3

    return { clarity, support, breadth, overall }
  }

  /**
   * 评估说明书质量
   */
  private assessSpecificationQuality(input: QualityCheckInput): SpecificationQuality {
    const spec = input.specification

    // 清晰度：基于各部分的长度
    let clarity = 100
    if (spec.technicalField && spec.technicalField.length < 20) clarity -= 25
    if (spec.inventionContent && spec.inventionContent.length < 50) clarity -= 25
    if (spec.embodiment && spec.embodiment.length < 100) clarity -= 25

    // 充分性：基于内容完整性
    let sufficiency = 100
    if (!spec.technicalField) sufficiency -= 25
    if (!spec.backgroundArt) sufficiency -= 25
    if (!spec.inventionContent) sufficiency -= 25
    if (!spec.embodiment) sufficiency -= 25

    // 一致性：简化检查
    let consistency = 100
    if (spec.technicalField && spec.inventionContent) {
      // 检查是否包含相似的关键词
      const fieldWords = spec.technicalField.split(/\s+/).slice(0, 5)
      const contentWords = spec.inventionContent.split(/\s+/).slice(0, 5)
      const fieldPrefix = fieldWords.join(' ')
      const contentPrefix = contentWords.join(' ')
      // 如果前5个词完全相同，降低一致性评分
      if (fieldPrefix === contentPrefix && fieldPrefix.length > 10) {
        consistency -= 20
      }
    }

    // 总体评分
    const overall = (clarity + sufficiency + consistency) / 3

    return { clarity, sufficiency, consistency, overall }
  }

  /**
   * 评估语言质量
   */
  private assessLanguageQuality(input: QualityCheckInput): LanguageQuality {
    // 语法：简化检查
    let grammar = 100
    input.claims.forEach((claim) => {
      if (claim.content.includes('。。') || claim.content.includes('，，')) {
        grammar -= 10
      }
    })

    // 术语：简化检查
    let terminology = 100
    const technicalTerms = ['装置', '方法', '系统', '设备']
    let hasTechnicalTerm = false
    input.claims.forEach((claim) => {
      if (technicalTerms.some((term) => claim.content.includes(term))) {
        hasTechnicalTerm = true
      }
    })
    if (!hasTechnicalTerm) terminology -= 30

    // 总体评分
    const overall = (grammar + terminology) / 2

    return { grammar, terminology, overall }
  }

  /**
   * 计算总体质量
   */
  private calculateOverallQuality(completenessScore: number, qualityScores: QualityScores): number {
    return (
      completenessScore * 0.3 +
      qualityScores.claims.overall * 0.3 +
      qualityScores.specification.overall * 0.25 +
      qualityScores.language.overall * 0.15
    )
  }

  /**
   * 检测问题
   */
  private detectIssues(input: QualityCheckInput, qualityScores: QualityScores): Issue[] {
    const issues: Issue[] = []

    // 权利要求问题
    if (qualityScores.claims.clarity < 70) {
      issues.push({
        category: '权利要求',
        severity: 'medium',
        description: '权利要求清晰度较低',
        suggestion: '建议简化权利要求的表述，避免过长或过于复杂的句子结构',
      })
    }

    // 说明书问题
    if (qualityScores.specification.sufficiency < 70) {
      issues.push({
        category: '说明书',
        severity: 'high',
        description: '说明书充分性不足',
        suggestion: '建议补充完善技术领域、背景技术、发明内容或具体实施方式',
      })
    }

    // 语言问题
    if (qualityScores.language.grammar < 80) {
      issues.push({
        category: '语言表达',
        severity: 'low',
        description: '存在语法错误',
        suggestion: '建议检查并修正标点符号和语法错误',
      })
    }

    return issues
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(input: QualityCheckInput, issues: Issue[]): Recommendation[] {
    const recommendations: Recommendation[] = []

    // 基于问题生成建议
    issues.forEach((issue) => {
      recommendations.push({
        area: issue.category,
        current: issue.description,
        suggested: issue.suggestion,
        rationale: '提高专利申请质量',
      })
    })

    // 额外的建议
    if (input.claims.length < 5) {
      recommendations.push({
        area: '权利要求',
        current: `权利要求数量为${input.claims.length}项`,
        suggested: '建议增加从属权利要求，形成多层次保护',
        rationale: '增加保护层次，提高专利稳定性',
      })
    }

    return recommendations
  }

  /**
   * 生成对比数据
   */
  private generateComparison(overallQuality: number): Comparison {
    // 模拟对比数据
    const averageQuality = 75
    const percentile = Math.min(Math.max(((overallQuality - 50) / 50) * 100, 0), 100)

    let ranking = '一般'
    if (percentile >= 90) ranking = '优秀'
    else if (percentile >= 70) ranking = '良好'
    else if (percentile >= 50) ranking = '中等'
    else ranking = '待改进'

    return {
      averageQuality,
      percentile,
      ranking,
    }
  }
}
