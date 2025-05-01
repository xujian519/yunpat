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
  /** 检查级别（1-3，默认2） */
  checkLevel?: 1 | 2 | 3
  /** 是否启用自动修复建议 */
  enableAutoFix?: boolean
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
  /** 保护范围合理性 */
  protectionScope: number
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
  /** 支持性 */
  supportiveness: number
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
  /** 表达准确性 */
  accuracy: number
  /** 总体评分 */
  overall: number
}

/**
 * 法律质量评分
 */
export interface LegalQuality {
  /** 形式合规性 */
  formality: number
  /** 可专利性 */
  patentability: number
  /** 风险评估 */
  riskLevel: 'low' | 'medium' | 'high'
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
  /** 法律质量 */
  legal: LegalQuality
}

/**
 * 问题
 */
export interface Issue {
  /** 类别 */
  category: string
  /** 子类别 */
  subCategory?: string
  /** 严重程度 */
  severity: 'critical' | 'high' | 'medium' | 'low'
  /** 描述 */
  description: string
  /** 位置 */
  location?: string
  /** 规则引用 */
  ruleReference?: string
  /** 建议 */
  suggestion: string
  /** 自动修复 */
  autoFix?: {
    original: string
    fixed: string
    confidence: number
  }
}

/**
 * 改进建议
 */
export interface Recommendation {
  /** 区域 */
  area: string
  /** 优先级 */
  priority: 'high' | 'medium' | 'low'
  /** 当前 */
  current: string
  /** 建议 */
  suggested: string
  /** 理由 */
  rationale: string
  /** 预期效果 */
  expectedImpact?: string
}

/**
 * 修复操作
 */
export interface FixOperation {
  /** 操作类型 */
  type: 'replace' | 'insert' | 'delete' | 'reorder'
  /** 目标位置 */
  target: string
  /** 原始内容 */
  original: string
  /** 修复后内容 */
  fixed: string
  /** 说明 */
  description: string
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
  /** 对比组 */
  comparisonGroup: string
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
  /** 质量等级 */
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor'
  /** 问题列表 */
  issues: Issue[]
  /** 改进建议 */
  recommendations: Recommendation[]
  /** 自动修复操作 */
  fixOperations?: FixOperation[]
  /** 对比数据 */
  comparison: Comparison
  /** 检查元数据 */
  metadata: {
    checkLevel: number
    timestamp: number
    rulesApplied: string[]
    autoFixEnabled: boolean
  }
}

/**
 * 质量检查规则
 */
interface QualityRule {
  /** 规则ID */
  id: string
  /** 规则名称 */
  name: string
  /** 类别 */
  category: string
  /** 严重程度 */
  severity: 'critical' | 'high' | 'medium' | 'low'
  /** 检查函数 */
  check: (input: QualityCheckInput) => Issue | null
  /** 修复函数 */
  fix?: (issue: Issue) => FixOperation | null
}

/**
 * 质量检查计划
 */
interface QualityCheckPlan {
  input: QualityCheckInput
  rules: QualityRule[]
}

/**
 * 质量检查Agent
 *
 * 功能：
 * 1. 完整性检查（根据专利类型）
 * 2. 多维度质量评分（权利要求、说明书、语言、法律）
 * 3. 规则库驱动的质量问题检测
 * 4. 自动修复建议
 * 5. 对比分析和排名
 * 6. 可配置的检查级别
 */
export class QualityCheckerAgent extends Agent<QualityCheckInput, QualityCheckResult> {
  private logger = createLogger('QualityCheckerAgent')
  private rules: QualityRule[]

  constructor(config: {
    name: string
    description: string
    eventBus: any
    memory: any
    tools: any
    llm: any
  }) {
    super(config)
    this.rules = this.initializeRules()
  }

  protected async plan(
    input: QualityCheckInput,
    _context: ExecutionContext
  ): Promise<QualityCheckPlan> {
    this.logger.info('开始规划质量检查', {
      inventionTitle: input.inventionTitle,
      claimsCount: input.claims.length,
      patentType: input.patentType,
      checkLevel: input.checkLevel ?? 2,
    })

    // 根据检查级别选择规则
    const checkLevel = input.checkLevel ?? 2
    const selectedRules = this.selectRulesByLevel(checkLevel)

    return {
      input,
      rules: selectedRules,
    }
  }

  protected async act(
    plan: QualityCheckPlan,
    _context: ExecutionContext
  ): Promise<QualityCheckResult> {
    this.logger.info('开始执行质量检查')

    const { input, rules } = plan

    // 1. 完整性检查
    const completenessScore = this.checkCompleteness(input)

    // 2. 质量评分
    const qualityScores = this.calculateQualityScores(input)

    // 3. 总体质量
    const overallQuality = this.calculateOverallQuality(completenessScore, qualityScores)

    // 4. 问题检测
    const issues = this.detectIssues(input, rules)

    // 5. 生成修复操作
    const fixOperations = input.enableAutoFix ? this.generateFixOperations(issues) : undefined

    // 6. 改进建议
    const recommendations = this.generateRecommendations(input, issues, qualityScores)

    // 7. 对比数据
    const comparison = this.generateComparison(overallQuality, input.patentType)

    // 8. 质量等级
    const qualityLevel = this.getQualityLevel(overallQuality)

    const rulesApplied = rules.map((r) => r.id)

    this.logger.info('质量检查完成', {
      completenessScore: completenessScore.toFixed(1),
      overallQuality: overallQuality.toFixed(1),
      qualityLevel,
      issuesCount: issues.length,
      rulesApplied,
    })

    return {
      completenessScore,
      qualityScores,
      overallQuality,
      qualityLevel,
      issues,
      recommendations,
      fixOperations,
      comparison,
      metadata: {
        checkLevel: input.checkLevel ?? 2,
        timestamp: Date.now(),
        rulesApplied,
        autoFixEnabled: input.enableAutoFix ?? false,
      },
    }
  }

  /**
   * 初始化质量检查规则
   */
  private initializeRules(): QualityRule[] {
    return [
      // 权利要求规则
      {
        id: 'CLAIM_001',
        name: '独立权利要求前置',
        category: '权利要求',
        severity: 'critical',
        check: (input) => {
          const firstClaim = input.claims[0]
          if (firstClaim && firstClaim.type !== 'independent') {
            return {
              category: '权利要求',
              subCategory: '结构',
              severity: 'critical',
              description: '第一项权利要求必须是独立权利要求',
              location: `权利要求${firstClaim.number}`,
              ruleReference: 'A26.4',
              suggestion: '将第一项权利要求改为独立权利要求，或调整权利要求顺序',
            }
          }
          return null
        },
      },
      {
        id: 'CLAIM_002',
        name: '从属权利要求引用',
        category: '权利要求',
        severity: 'high',
        check: (input) => {
          for (const claim of input.claims) {
            if (claim.type === 'dependent') {
              if (!claim.dependsOn || claim.dependsOn >= claim.number) {
                return {
                  category: '权利要求',
                  subCategory: '引用',
                  severity: 'high',
                  description: `权利要求${claim.number}的引用关系无效`,
                  location: `权利要求${claim.number}`,
                  ruleReference: 'A26.4',
                  suggestion: `检查权利要求${claim.number}的引用关系，确保引用在先的权利要求`,
                }
              }
            }
          }
          return null
        },
      },
      {
        id: 'CLAIM_003',
        name: '权利要求长度',
        category: '权利要求',
        severity: 'medium',
        check: (input) => {
          for (const claim of input.claims) {
            if (claim.content.length > 500) {
              return {
                category: '权利要求',
                subCategory: '表达',
                severity: 'medium',
                description: `权利要求${claim.number}过长（${claim.content.length}字）`,
                location: `权利要求${claim.number}`,
                suggestion: '建议将部分技术特征拆分到从属权利要求中',
                autoFix: {
                  original: claim.content,
                  fixed: claim.content.substring(0, 300) + '...', // 简化示例
                  confidence: 0.5,
                },
              }
            }
          }
          return null
        },
      },
      {
        id: 'CLAIM_004',
        name: '技术术语一致性',
        category: '权利要求',
        severity: 'medium',
        check: (input) => {
          const terms = new Set<string>()
          const inconsistencies: string[] = []

          input.claims.forEach((claim) => {
            const matches = claim.content.match(
              /(?:其特征在于|其中)[^，。]{0,50}?(?:装置|方法|系统|设备)/g
            )
            if (matches) {
              matches.forEach((m) => terms.add(m))
            }
          })

          if (terms.size > 3) {
            return {
              category: '权利要求',
              subCategory: '术语',
              severity: 'medium',
              description: '技术术语使用不一致',
              suggestion: '统一技术术语的使用，确保同一概念使用相同表述',
            }
          }

          return null
        },
      },
      // 说明书规则
      {
        id: 'SPEC_001',
        name: '技术领域完整性',
        category: '说明书',
        severity: 'high',
        check: (input) => {
          const { technicalField } = input.specification
          if (!technicalField || technicalField.length < 20) {
            return {
              category: '说明书',
              subCategory: '技术领域',
              severity: 'high',
              description: '技术领域描述不充分',
              location: '技术领域',
              ruleReference: 'A26.3',
              suggestion: '技术领域应明确说明发明所属或直接应用的具体技术领域',
            }
          }
          return null
        },
      },
      {
        id: 'SPEC_002',
        name: '背景技术完整性',
        category: '说明书',
        severity: 'high',
        check: (input) => {
          const { backgroundArt } = input.specification
          if (!backgroundArt || backgroundArt.length < 50) {
            return {
              category: '说明书',
              subCategory: '背景技术',
              severity: 'high',
              description: '背景技术描述不充分',
              location: '背景技术',
              ruleReference: 'A26.3',
              suggestion: '背景技术应介绍现有技术及其存在的问题',
            }
          }
          return null
        },
      },
      {
        id: 'SPEC_003',
        name: '发明内容完整性',
        category: '说明书',
        severity: 'high',
        check: (input) => {
          const { inventionContent } = input.specification
          if (!inventionContent || inventionContent.length < 100) {
            return {
              category: '说明书',
              subCategory: '发明内容',
              severity: 'high',
              description: '发明内容描述不充分',
              location: '发明内容',
              ruleReference: 'A26.3',
              suggestion: '发明内容应清楚、完整地描述要解决的技术问题、技术方案和有益效果',
            }
          }
          return null
        },
      },
      {
        id: 'SPEC_004',
        name: '具体实施方式充分性',
        category: '说明书',
        severity: 'high',
        check: (input) => {
          const { embodiment } = input.specification
          if (!embodiment || embodiment.length < 200) {
            return {
              category: '说明书',
              subCategory: '具体实施方式',
              severity: 'high',
              description: '具体实施方式不充分',
              location: '具体实施方式',
              ruleReference: 'A26.3',
              suggestion: '具体实施方式应详细描述至少一个实施例，使所属领域技术人员能够实现',
            }
          }
          return null
        },
      },
      {
        id: 'SPEC_005',
        name: '权利要求支持性',
        category: '说明书',
        severity: 'high',
        check: (input) => {
          const { embodiment } = input.specification
          if (!embodiment) return null

          const claimFeatures = new Set<string>()
          input.claims.forEach((claim) => {
            const features = claim.content.match(/(?:包括|包含|设有|配置)[^，。]{1,30}?/g)
            if (features) features.forEach((f) => claimFeatures.add(f))
          })

          let supportedCount = 0
          claimFeatures.forEach((feature) => {
            if (embodiment.includes(feature.substring(0, 10))) {
              supportedCount++
            }
          })

          if (claimFeatures.size > 0 && supportedCount / claimFeatures.size < 0.8) {
            return {
              category: '说明书',
              subCategory: '支持性',
              severity: 'high',
              description: '说明书对权利要求的支持不足',
              location: '具体实施方式',
              ruleReference: 'A26.4',
              suggestion: '在具体实施方式中补充描述权利要求中的技术特征',
            }
          }

          return null
        },
      },
      // 语言规则
      {
        id: 'LANG_001',
        name: '标点符号规范',
        category: '语言表达',
        severity: 'low',
        check: (input) => {
          for (const claim of input.claims) {
            if (
              claim.content.includes('。。') ||
              claim.content.includes('，，') ||
              claim.content.includes('、。') ||
              claim.content.includes('、，')
            ) {
              return {
                category: '语言表达',
                subCategory: '标点符号',
                severity: 'low',
                description: '存在标点符号使用错误',
                location: `权利要求${claim.number}`,
                suggestion: '检查并修正标点符号的使用',
              }
            }
          }
          return null
        },
      },
      {
        id: 'LANG_002',
        name: '表达完整性',
        category: '语言表达',
        severity: 'medium',
        check: (input) => {
          for (const claim of input.claims) {
            if (claim.content.endsWith('，') || claim.content.endsWith('、')) {
              return {
                category: '语言表达',
                subCategory: '表达',
                severity: 'medium',
                description: `权利要求${claim.number}结尾不完整`,
                location: `权利要求${claim.number}`,
                suggestion: '确保权利要求以句号结尾，表达完整',
              }
            }
          }
          return null
        },
      },
      {
        id: 'LANG_003',
        name: '模糊表达检查',
        category: '语言表达',
        severity: 'medium',
        check: (input) => {
          const vagueTerms = ['大约', '左右', '可能', '也许', '大概', '约', '等']
          for (const claim of input.claims) {
            for (const term of vagueTerms) {
              if (claim.content.includes(term)) {
                return {
                  category: '语言表达',
                  subCategory: '精确性',
                  severity: 'medium',
                  description: `存在模糊表达"${term}"`,
                  location: `权利要求${claim.number}`,
                  suggestion: '使用精确的技术表述，避免模糊词汇',
                }
              }
            }
          }
          return null
        },
      },
      // 法律规则
      {
        id: 'LEGAL_001',
        name: '单一性检查',
        category: '法律要求',
        severity: 'high',
        check: (input) => {
          const independentClaims = input.claims.filter((c) => c.type === 'independent')
          if (independentClaims.length > 1) {
            // 简化的单一性检查
            const firstKeywords = this.extractKeywords(independentClaims[0].content)
            let hasSingleInventiveConcept = true

            for (let i = 1; i < independentClaims.length; i++) {
              const keywords = this.extractKeywords(independentClaims[i].content)
              const overlap = this.calculateKeywordOverlap(firstKeywords, keywords)
              if (overlap < 0.3) {
                hasSingleInventiveConcept = false
                break
              }
            }

            if (!hasSingleInventiveConcept) {
              return {
                category: '法律要求',
                subCategory: '单一性',
                severity: 'high',
                description: '可能存在单一性问题',
                ruleReference: 'A31.1',
                suggestion: '检查各独立权利要求是否属于一个总的发明构思',
              }
            }
          }
          return null
        },
      },
    ]
  }

  /**
   * 根据检查级别选择规则
   */
  private selectRulesByLevel(level: number): QualityRule[] {
    if (level === 1) {
      // 级别1：仅检查关键规则
      return this.rules.filter((r) => r.severity === 'critical' || r.severity === 'high')
    } else if (level === 2) {
      // 级别2：检查高优先级规则
      return this.rules.filter((r) => r.severity !== 'low')
    }
    // 级别3：检查所有规则
    return this.rules
  }

  /**
   * 完整性检查
   */
  private checkCompleteness(input: QualityCheckInput): number {
    let score = 0
    const maxScore = 100

    // 发明名称（5分）
    if (input.inventionTitle && input.inventionTitle.length > 0) {
      score += 5
    }

    // 权利要求（35分）
    if (input.claims && input.claims.length > 0) {
      const hasIndependent = input.claims.some((c) => c.type === 'independent')
      if (hasIndependent) score += 20
      if (input.claims.length >= 2) score += 10
      if (input.claims.length >= 5) score += 5
    }

    // 说明书（60分）
    const spec = input.specification
    if (spec) {
      if (spec.technicalField && spec.technicalField.length > 10) score += 12
      if (spec.backgroundArt && spec.backgroundArt.length > 20) score += 12
      if (spec.inventionContent && spec.inventionContent.length > 50) score += 12
      if (spec.embodiment && spec.embodiment.length > 100) score += 12
      if (input.drawings && input.drawings.length > 0) score += 12
    }

    return Math.min(score, maxScore)
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScores(input: QualityCheckInput): QualityScores {
    return {
      claims: this.assessClaimsQuality(input),
      specification: this.assessSpecificationQuality(input),
      language: this.assessLanguageQuality(input),
      legal: this.assessLegalQuality(input),
    }
  }

  /**
   * 评估权利要求质量
   */
  private assessClaimsQuality(input: QualityCheckInput): ClaimsQuality {
    let clarity = 100
    let support = 100
    let breadth = 100
    let protectionScope = 100

    if (input.claims.length === 0) {
      return { clarity: 0, support: 0, breadth: 0, protectionScope: 0, overall: 0 }
    }

    // 清晰度：基于句子长度和结构
    const avgClaimLength =
      input.claims.reduce((sum, c) => sum + c.content.length, 0) / input.claims.length
    if (avgClaimLength > 200) clarity -= 15
    if (avgClaimLength > 300) clarity -= 15
    if (avgClaimLength > 400) clarity -= 20

    // 复杂句式惩罚
    const complexSentences = input.claims.filter(
      (c) => (c.content.match(/，/g) || []).length > 5
    ).length
    clarity -= (complexSentences / input.claims.length) * 20

    // 支持度：基于从属权利要求比例
    const dependentCount = input.claims.filter((c) => c.type === 'dependent').length
    const independentCount = input.claims.filter((c) => c.type === 'independent').length
    if (independentCount > 0) {
      const ratio = dependentCount / independentCount
      if (ratio < 1) support -= 30
      if (ratio < 2) support -= 15
      if (ratio >= 3) support += 10 // 奖励多层次保护
    }

    // 宽适度：基于权利要求数量和层次
    if (input.claims.length < 2) breadth -= 30
    if (input.claims.length < 3) breadth -= 15
    if (input.claims.length >= 5) breadth += 10
    if (input.claims.length >= 10) breadth += 10

    // 保护范围合理性
    const independentClaims = input.claims.filter((c) => c.type === 'independent')
    if (independentClaims.length === 1) {
      protectionScope = 100 // 单一独立权利要求
    } else if (independentClaims.length > 3) {
      protectionScope -= 20 // 过多独立权利要求可能范围过窄
    }

    const overall = (clarity + support + breadth + protectionScope) / 4
    return { clarity, support, breadth, protectionScope, overall }
  }

  /**
   * 评估说明书质量
   */
  private assessSpecificationQuality(input: QualityCheckInput): SpecificationQuality {
    const spec = input.specification

    let clarity = 100
    let sufficiency = 100
    let consistency = 100
    let supportiveness = 100

    // 清晰度评估
    if (!spec.technicalField || spec.technicalField.trim().length < 20) clarity -= 20
    if (!spec.inventionContent || spec.inventionContent.trim().length < 50) clarity -= 20
    if (!spec.embodiment || spec.embodiment.trim().length < 100) clarity -= 20
    if (!spec.embodiment || spec.embodiment.trim().length < 200) clarity -= 20

    // 充分性评估
    if (!spec.technicalField || spec.technicalField.trim().length === 0) sufficiency -= 25
    if (!spec.backgroundArt || spec.backgroundArt.trim().length === 0) sufficiency -= 25
    if (!spec.inventionContent || spec.inventionContent.trim().length === 0) sufficiency -= 25
    if (!spec.embodiment || spec.embodiment.trim().length === 0) sufficiency -= 25

    // 一致性评估
    const hasTechField = spec.technicalField && spec.technicalField.trim().length > 0
    const hasInventionContent = spec.inventionContent && spec.inventionContent.trim().length > 0
    if (hasTechField && hasInventionContent) {
      const fieldTerms = this.extractKeywords(spec.technicalField!)
      const contentTerms = this.extractKeywords(spec.inventionContent!)
      const overlap = this.calculateKeywordOverlap(fieldTerms, contentTerms)
      if (overlap < 0.2) consistency -= 30
    } else {
      consistency -= 30
    }

    // 支持性评估：检查说明书是否支持权利要求
    if (spec.embodiment && spec.embodiment.trim().length > 0 && input.claims.length > 0) {
      const claimTerms = new Set<string>()
      input.claims.forEach((c) => {
        const terms = this.extractKeywords(c.content)
        terms.forEach((t) => claimTerms.add(t))
      })

      let supportedTerms = 0
      claimTerms.forEach((term) => {
        if (spec.embodiment!.includes(term)) supportedTerms++
      })

      if (claimTerms.size > 0) {
        const supportRatio = supportedTerms / claimTerms.size
        supportiveness = supportRatio * 100
      }
    } else if (input.claims.length > 0) {
      supportiveness = 0
    }

    const overall = (clarity + sufficiency + consistency + supportiveness) / 4
    return { clarity, sufficiency, consistency, supportiveness, overall }
  }

  /**
   * 评估语言质量
   */
  private assessLanguageQuality(input: QualityCheckInput): LanguageQuality {
    let grammar = 100
    let terminology = 100
    let accuracy = 100

    // 语法检查
    input.claims.forEach((claim) => {
      if (claim.content.includes('。。') || claim.content.includes('，，')) grammar -= 10
      if (claim.content.includes('、。') || claim.content.includes('、，')) grammar -= 5
      if (!claim.content.endsWith('。')) grammar -= 5
    })

    // 术语检查
    const technicalTerms = ['装置', '方法', '系统', '设备', '模块', '单元', '组件']
    let hasTechnicalTerm = false
    input.claims.forEach((claim) => {
      if (technicalTerms.some((term) => claim.content.includes(term))) {
        hasTechnicalTerm = true
      }
    })
    if (!hasTechnicalTerm) terminology -= 40

    // 表达准确性检查
    const vagueTerms = ['大约', '左右', '可能', '也许', '大概']
    input.claims.forEach((claim) => {
      vagueTerms.forEach((term) => {
        if (claim.content.includes(term)) accuracy -= 10
      })
    })

    const overall = (grammar + terminology + accuracy) / 3
    return { grammar, terminology, accuracy, overall }
  }

  /**
   * 评估法律质量
   */
  private assessLegalQuality(input: QualityCheckInput): LegalQuality {
    let formality = 100
    let patentability = 80
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    // 形式合规性
    if (!input.inventionTitle) formality -= 20
    if (input.claims.length === 0) formality -= 50
    if (input.claims.length > 0 && input.claims[0].type !== 'independent') formality -= 30

    // 可专利性评估（简化）
    const spec = input.specification
    if (!spec.technicalField || !spec.backgroundArt || !spec.inventionContent) {
      patentability -= 30
    }

    if (!spec.embodiment || spec.embodiment.length < 100) {
      patentability -= 20
    }

    // 风险评估
    if (formality < 70 || patentability < 60) {
      riskLevel = 'high'
    } else if (formality < 85 || patentability < 75) {
      riskLevel = 'medium'
    }

    const overall = (formality + patentability) / 2
    return { formality, patentability, riskLevel, overall }
  }

  /**
   * 计算总体质量
   */
  private calculateOverallQuality(completenessScore: number, qualityScores: QualityScores): number {
    return (
      completenessScore * 0.25 +
      qualityScores.claims.overall * 0.3 +
      qualityScores.specification.overall * 0.25 +
      qualityScores.language.overall * 0.1 +
      qualityScores.legal.overall * 0.1
    )
  }

  /**
   * 检测问题
   */
  private detectIssues(input: QualityCheckInput, rules: QualityRule[]): Issue[] {
    const issues: Issue[] = []

    for (const rule of rules) {
      try {
        const issue = rule.check(input)
        if (issue) {
          issues.push(issue)
        }
      } catch (error) {
        this.logger.warn(`规则 ${rule.id} 执行失败:`, error as Error)
      }
    }

    // 按严重程度排序
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return issues
  }

  /**
   * 生成修复操作
   */
  private generateFixOperations(issues: Issue[]): FixOperation[] {
    const operations: FixOperation[] = []

    for (const issue of issues) {
      if (issue.autoFix) {
        operations.push({
          type: 'replace',
          target: issue.location || '未知',
          original: issue.autoFix.original,
          fixed: issue.autoFix.fixed,
          description: issue.description,
        })
      }
    }

    return operations
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(
    input: QualityCheckInput,
    issues: Issue[],
    qualityScores: QualityScores
  ): Recommendation[] {
    const recommendations: Recommendation[] = []

    // 基于问题生成建议
    const issueCategories = new Set<string>()
    issues.forEach((issue) => {
      issueCategories.add(issue.category)
      recommendations.push({
        area: issue.category,
        priority: issue.severity === 'critical' || issue.severity === 'high' ? 'high' : 'medium',
        current: issue.description,
        suggested: issue.suggestion,
        rationale: `根据规则${issue.ruleReference || ''}，${issue.description}`,
      })
    })

    // 基于质量评分生成额外建议
    if (qualityScores.claims.breadth < 80) {
      recommendations.push({
        area: '权利要求',
        priority: 'medium',
        current: `权利要求数量为${input.claims.length}项`,
        suggested: '建议增加从属权利要求，形成多层次保护',
        rationale: '多层次保护可以提高专利的稳定性和抗无效能力',
        expectedImpact: '预计提高保护范围得分10-20分',
      })
    }

    if (qualityScores.specification.supportiveness < 80) {
      recommendations.push({
        area: '说明书',
        priority: 'high',
        current: '说明书对权利要求的支持不足',
        suggested: '在具体实施方式中详细描述权利要求中的技术特征',
        rationale: 'A26.4要求权利要求应当得到说明书的支持',
        expectedImpact: '预计提高支持性得分20-30分',
      })
    }

    if (qualityScores.language.accuracy < 85) {
      recommendations.push({
        area: '语言表达',
        priority: 'medium',
        current: '存在模糊或不精确的表达',
        suggested: '使用精确的技术术语，避免模糊词汇',
        rationale: '精确的表达有助于明确保护范围',
        expectedImpact: '预计提高表达准确性得分10-15分',
      })
    }

    return recommendations
  }

  /**
   * 生成对比数据
   */
  private generateComparison(overallQuality: number, patentType: string): Comparison {
    // 不同专利类型的基准分
    const benchmarks: Record<string, { avg: number; stdDev: number }> = {
      invention: { avg: 75, stdDev: 10 },
      utilityModel: { avg: 70, stdDev: 12 },
      design: { avg: 72, stdDev: 11 },
    }

    const benchmark = benchmarks[patentType] || benchmarks.invention
    const percentile = this.calculatePercentile(overallQuality, benchmark.avg, benchmark.stdDev)

    let ranking = '一般'
    if (percentile >= 90) ranking = '优秀'
    else if (percentile >= 75) ranking = '良好'
    else if (percentile >= 50) ranking = '中等'
    else ranking = '待改进'

    return {
      averageQuality: benchmark.avg,
      percentile,
      ranking,
      comparisonGroup:
        patentType === 'invention'
          ? '发明专利申请'
          : patentType === 'utilityModel'
            ? '实用新型申请'
            : '外观设计申请',
    }
  }

  /**
   * 计算百分位
   */
  private calculatePercentile(value: number, mean: number, stdDev: number): number {
    // 简化的正态分布百分位计算
    const zScore = (value - mean) / stdDev
    // 使用误差函数近似
    const percentile = 100 * (1 - Math.exp(-0.717 * zScore - 0.416 * zScore * zScore))
    return Math.max(0, Math.min(100, percentile))
  }

  /**
   * 获取质量等级
   */
  private getQualityLevel(overallQuality: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (overallQuality >= 90) return 'excellent'
    if (overallQuality >= 75) return 'good'
    if (overallQuality >= 60) return 'fair'
    return 'poor'
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简化的关键词提取
    const words = text.match(/[一-龥]{2,}/g) || []
    const stopWords = new Set(['的', '是', '在', '和', '与', '或', '等', '为', '有', '中'])
    return words.filter((w) => !stopWords.has(w))
  }

  /**
   * 计算关键词重叠度
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0

    const set1 = new Set(keywords1)
    const set2 = new Set(keywords2)

    let overlap = 0
    set1.forEach((k) => {
      if (set2.has(k)) overlap++
    })

    return overlap / Math.max(set1.size, set2.size)
  }
}
