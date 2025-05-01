/**
 * 答复模板管理器
 *
 * 负责管理答复文档模板，提供：
 * 1. 多地区模板支持 (CN/PCT/US/EP)
 * 2. 不同驳回类型的专用模板
 * 3. 模板变量替换
 * 4. 模板效果追踪
 * 5. 模板版本管理
 *
 * @module template/ResponseTemplateManager
 */

import type { ResponseTemplate, OAParseResult, StrategyRecommendation } from '../types/index.js'
import { RejectionType, ResponseStrategy } from '../types/index.js'

/**
 * 模板变量
 */
export interface TemplateVariable {
  /** 变量名 */
  name: string
  /** 默认值 */
  defaultValue?: string
  /** 是否必需 */
  required?: boolean
  /** 描述 */
  description?: string
}

/**
 * 模板渲染结果
 */
export interface TemplateRenderResult {
  /** 渲染后的内容 */
  content: string
  /** 使用的模板ID */
  templateId: string
  /** 替换的变量 */
  variables: Record<string, string>
  /** 是否有缺失的必需变量 */
  hasMissingRequired: boolean
  /** 缺失的必需变量列表 */
  missingRequired: string[]
}

/**
 * 模板管理器配置
 */
export interface TemplateManagerConfig {
  /** 自定义模板路径 */
  customTemplatePath?: string
  /** 是否启用模板追踪 */
  enableTracking?: boolean
  /** 模板缓存大小 */
  cacheSize?: number
}

/**
 * 内置模板定义
 */
const BUILT_IN_TEMPLATES: ResponseTemplate[] = [
  // CN - 新颖性模板
  {
    id: 'cn-novelty-argue',
    name: 'CN新颖性争辩模板',
    applicableRejections: [RejectionType.NOVELTY],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        '尊敬的审查员：\n\n申请人收到贵局于{notificationDate}发出的关于申请号{applicationNumber}的审查意见通知书。现针对审查意见中指出的新颖性问题，陈述意见如下：\n',
      argumentTemplates: [
        {
          category: '区别技术特征',
          template:
            '一、关于权利要求{claimNumbers}的新颖性\n\n1. 对比文件{referenceNumber}公开的技术内容\n   {referenceContent}\n\n2. 本申请权利要求{claimNumbers}与对比文件{referenceNumber}的区别技术特征\n   经对比分析，本申请权利要求{claimNumbers}与对比文件{referenceNumber}相比，至少存在以下区别技术特征：\n   {distinguishingFeatures}\n\n3. 关于区别技术特征的说明\n   上述区别技术特征在对比文件{referenceNumber}中并未公开，也不属于本领域的公知常识。',
          placeholders: [
            'claimNumbers',
            'referenceNumber',
            'referenceContent',
            'distinguishingFeatures',
          ],
        },
        {
          category: '技术效果对比',
          template:
            '二、区别技术特征带来的技术效果\n\n本申请通过上述区别技术特征的设置，实现了{technicalEffect}的技术效果，而对比文件{referenceNumber}无法实现该技术效果。',
          placeholders: ['technicalEffect', 'referenceNumber'],
        },
      ],
      closing:
        '\n综上所述，本申请权利要求{claimNumbers}相对于对比文件{referenceNumber}具备《专利法》第22条第2款规定的新颖性。\n\n此致\n敬礼！\n\n{responseDate}',
    },
    tags: ['cn', 'novelty', 'argue'],
    usageCount: 0,
    successRate: 0.65,
  },

  // CN - 创造性模板
  {
    id: 'cn-inventiveness-argue',
    name: 'CN创造性争辩模板',
    applicableRejections: [RejectionType.INVENTIVENESS],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        '尊敬的审查员：\n\n申请人收到贵局于{notificationDate}发出的关于申请号{applicationNumber}的审查意见通知书。现针对审查意见中指出的创造性问题，陈述意见如下：\n',
      argumentTemplates: [
        {
          category: '最接近现有技术',
          template:
            '一、最接近的现有技术\n\n对比文件{referenceNumber}公开了{referenceContent}，其与本申请属于相同的技术领域，可作为最接近的现有技术。',
          placeholders: ['referenceNumber', 'referenceContent'],
        },
        {
          category: '区别技术特征',
          template:
            '二、区别技术特征的确定\n\n权利要求{claimNumbers}与对比文件{referenceNumber}相比，具有以下区别技术特征：\n{distinguishingFeatures}',
          placeholders: ['claimNumbers', 'distinguishingFeatures'],
        },
        {
          category: '技术问题',
          template:
            '三、实际解决的技术问题\n\n根据上述区别技术特征，本申请实际解决的技术问题是：{technicalProblem}。',
          placeholders: ['technicalProblem'],
        },
        {
          category: '非显而易见性',
          template:
            '四、关于显而易见性的分析\n\n1. 对比文件{referenceNumber}未给出技术启示\n   对比文件{referenceNumber}虽然涉及相关技术，但并未给出将上述区别技术特征应用于最接近现有技术以解决上述技术问题的任何技术启示。\n\n2. 不存在技术动机\n   本领域技术人员在面对上述技术问题时，没有动机将对比文件{referenceNumber}与最接近现有技术相结合。\n\n3. 技术障碍的存在\n   在将上述区别技术特征应用于最接近现有技术时，存在{technicalObstacle}的技术障碍，而本申请成功克服了该障碍。',
          placeholders: ['referenceNumber', 'technicalObstacle'],
        },
        {
          category: '预料不到的技术效果',
          template:
            '五、预料不到的技术效果\n\n本申请通过上述区别技术特征的设置，实现了{unexpectedEffect}的技术效果，这对于本领域技术人员来说是预料不到的，进一步证明了本申请的创造性。',
          placeholders: ['unexpectedEffect'],
        },
      ],
      closing:
        '\n综上所述，本申请权利要求{claimNumbers}相对于对比文件{referenceNumber}具备突出的实质性特点和显著的进步，符合《专利法》第22条第3款关于创造性的规定。\n\n此致\n敬礼！\n\n{responseDate}',
    },
    tags: ['cn', 'inventiveness', 'argue'],
    usageCount: 0,
    successRate: 0.6,
  },

  // CN - 充分公开模板
  {
    id: 'cn-support-amend',
    name: 'CN充分公开修改模板',
    applicableRejections: [RejectionType.SUPPORT],
    applicableStrategies: [ResponseStrategy.AMEND, ResponseStrategy.BOTH],
    content: {
      opening:
        '尊敬的审查员：\n\n申请人收到贵局于{notificationDate}发出的关于申请号{applicationNumber}的审查意见通知书。现针对审查意见中指出的充分公开问题，陈述意见并进行修改如下：\n',
      argumentTemplates: [
        {
          category: '说明书公开内容',
          template:
            '一、说明书的公开内容\n\n说明书在第{section}段中对{feature}进行了详细描述，公开内容包括：\n{disclosureContent}\n\n本领域技术人员根据说明书公开的内容，完全能够实现该技术方案。',
          placeholders: ['section', 'feature', 'disclosureContent'],
        },
        {
          category: '修改说明',
          template:
            '二、权利要求的修改说明\n\n根据说明书的公开内容，申请人对权利要求{claimNumbers}进行了修改，将{feature}进一步限定为：{amendedContent}\n\n该修改内容直接来源于说明书第{section}段的记载，未超出原说明书和权利要求书记载的范围。',
          placeholders: ['claimNumbers', 'feature', 'amendedContent', 'section'],
        },
      ],
      closing:
        '\n综上所述，通过上述修改，本申请已经符合《专利法》第26条第3款关于充分公开的规定。\n\n此致\n敬礼！\n\n{responseDate}',
    },
    tags: ['cn', 'support', 'amend'],
    usageCount: 0,
    successRate: 0.8,
  },

  // PCT - 新颖性模板
  {
    id: 'pct-novelty-argue',
    name: 'PCT Novelty Response Template',
    applicableRejections: [RejectionType.NOVELTY],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nThe Applicant received the Office Action dated {notificationDate} regarding application No. {applicationNumber}. We would like to respond to the novelty objections as follows:\n',
      argumentTemplates: [
        {
          category: 'Distinguishing Features',
          template:
            '1. Distinguishing Features over {referenceNumber}\n\nClaim {claimNumbers} differs from {referenceNumber} in at least the following aspects:\n{distinguishingFeatures}\n\nThese distinguishing features are not disclosed in {referenceNumber}, nor do they belong to the common general knowledge in the art.',
          placeholders: ['referenceNumber', 'claimNumbers', 'distinguishingFeatures'],
        },
        {
          category: 'Technical Effects',
          template:
            '2. Technical Effects of Distinguishing Features\n\nThe distinguishing features mentioned above provide the following technical effects:\n{technicalEffects}\n\nThese technical effects are not achieved by {referenceNumber}.',
          placeholders: ['technicalEffects', 'referenceNumber'],
        },
      ],
      closing:
        '\nIn conclusion, claim {claimNumbers} is novel over {referenceNumber} in accordance with the requirements of Article 16(2) of the PCT.\n\nSincerely,\n\n{responseDate}',
    },
    tags: ['pct', 'novelty', 'argue'],
    usageCount: 0,
    successRate: 0.65,
  },

  // PCT - 创造性模板
  {
    id: 'pct-inventiveness-argue',
    name: 'PCT Inventive Step Response Template',
    applicableRejections: [RejectionType.INVENTIVENESS],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nThe Applicant received the Office Action dated {notificationDate} regarding application No. {applicationNumber}. We would like to respond to the inventive step objections as follows:\n',
      argumentTemplates: [
        {
          category: 'Closest Prior Art',
          template:
            '1. Closest Prior Art\n\n{referenceNumber} discloses {referenceContent} and belongs to the same technical field as the claimed invention. It can be considered as the closest prior art.',
          placeholders: ['referenceNumber', 'referenceContent'],
        },
        {
          category: 'Distinguishing Features',
          template:
            '2. Distinguishing Features\n\nThe claimed invention differs from {referenceNumber} in the following aspects:\n{distinguishingFeatures}',
          placeholders: ['referenceNumber', 'distinguishingFeatures'],
        },
        {
          category: 'Technical Problem',
          template:
            '3. Technical Problem\n\nThe technical problem actually solved by the claimed invention in view of the closest prior art is: {technicalProblem}.',
          placeholders: ['technicalProblem'],
        },
        {
          category: 'Non-obviousness',
          template:
            '4. Non-obviousness\n\n{referenceNumber} does not suggest the combination of the distinguishing features with the closest prior art to solve the technical problem mentioned above. A person skilled in the art would not have had a motive to make such combination, especially considering the existence of the following technical obstacles:\n{technicalObstacles}',
          placeholders: ['referenceNumber', 'technicalObstacles'],
        },
        {
          category: 'Unexpected Technical Effects',
          template:
            '5. Unexpected Technical Effects\n\nThe claimed invention achieves the following unexpected technical effects:\n{unexpectedEffects}\n\nThis further demonstrates the inventive step of the claimed invention.',
          placeholders: ['unexpectedEffects'],
        },
      ],
      closing:
        '\nIn conclusion, the claimed invention involves an inventive step in accordance with the requirements of Article 16(3) of the PCT.\n\nSincerely,\n\n{responseDate}',
    },
    tags: ['pct', 'inventiveness', 'argue'],
    usageCount: 0,
    successRate: 0.6,
  },

  // US - 新颖性模板
  {
    id: 'us-novelty-argue',
    name: 'US Novelty Response Template',
    applicableRejections: [RejectionType.NOVELTY],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nApplicant acknowledges receipt of the Office Action dated {notificationDate} regarding application No. {applicationNumber}. In response to the novelty rejection under 35 U.S.C. § 102, Applicant submits the following remarks:\n',
      argumentTemplates: [
        {
          category: 'Anticipation Analysis',
          template:
            '1. Analysis of Anticipation\n\nThe examiner argues that {referenceNumber} anticipates claim {claimNumbers}. However, claim {claimNumbers} differs from {referenceNumber} in the following aspects:\n{distinguishingFeatures}\n\nThese distinguishing features are not disclosed in {referenceNumber}. Therefore, {referenceNumber} does not anticipate claim {claimNumbers}.',
          placeholders: ['referenceNumber', 'claimNumbers', 'distinguishingFeatures'],
        },
      ],
      closing:
        '\nBased on the foregoing, claim {claimNumbers} is novel over {referenceNumber} in accordance with 35 U.S.C. § 102.\n\nRespectfully submitted,\n\n{responseDate}',
    },
    tags: ['us', 'novelty', 'argue'],
    usageCount: 0,
    successRate: 0.65,
  },

  // US - 创造性模板
  {
    id: 'us-inventiveness-argue',
    name: 'US Non-obviousness Response Template',
    applicableRejections: [RejectionType.INVENTIVENESS],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nApplicant acknowledges receipt of the Office Action dated {notificationDate} regarding application No. {applicationNumber}. In response to the obviousness rejection under 35 U.S.C. § 103, Applicant submits the following remarks:\n',
      argumentTemplates: [
        {
          category: 'Graham Analysis',
          template:
            '1. Graham Factor Analysis\n\n(a) Scope and Content of Prior Art\n{referenceNumber} discloses {referenceContent}.\n\n(b) Differences Between Prior Art and Claims at Issue\nClaim {claimNumbers} differs from the prior art in the following aspects:\n{distinguishingFeatures}\n\n(c) Level of Ordinary Skill in the Art\nBased on the complexity of the technology, a person having ordinary skill in the art (PHOSITA) would have...\n\n(d) Secondary Considerations\nThe claimed invention provides the following unexpected technical effects:\n{unexpectedEffects}',
          placeholders: [
            'referenceNumber',
            'referenceContent',
            'claimNumbers',
            'distinguishingFeatures',
            'unexpectedEffects',
          ],
        },
        {
          category: 'TSM Test',
          template:
            '2. Teaching, Suggestion, or Motivation (TSM) Test\n\n{referenceNumber} does not teach, suggest, or motivate a person of ordinary skill in the art to modify the prior art to arrive at the claimed invention. In particular:\n- There is no teaching in {referenceNumber} to make the proposed modification\n- There is no suggestion in the prior art to combine the references\n- There is no motivation to arrive at the claimed invention',
          placeholders: ['referenceNumber'],
        },
      ],
      closing:
        '\nBased on the foregoing, claim {claimNumbers} is non-obvious in accordance with 35 U.S.C. § 103.\n\nRespectfully submitted,\n\n{responseDate}',
    },
    tags: ['us', 'inventiveness', 'argue'],
    usageCount: 0,
    successRate: 0.6,
  },

  // 通用 - 修改权利要求模板
  {
    id: 'general-amend-claims',
    name: '通用权利要求修改模板',
    applicableRejections: [
      RejectionType.NOVELTY,
      RejectionType.INVENTIVENESS,
      RejectionType.CLARITY,
      RejectionType.SCOPE,
    ],
    applicableStrategies: [ResponseStrategy.AMEND, ResponseStrategy.BOTH],
    content: {
      opening: '',
      argumentTemplates: [
        {
          category: '修改说明',
          template:
            '权利要求{claimNumber}的修改说明：\n\n原权利要求{claimNumber}：\n{originalText}\n\n修改后的权利要求{claimNumber}：\n{amendedText}\n\n修改依据：说明书第{section}段记载了"{basis}"。\n\n修改理由：通过添加"{addedFeature}"技术特征，进一步限定了{limitedAspect}，使权利要求{claimNumber}的保护范围更加清晰明确。',
          placeholders: [
            'claimNumber',
            'originalText',
            'amendedText',
            'section',
            'basis',
            'addedFeature',
            'limitedAspect',
          ],
        },
      ],
      closing: '',
    },
    tags: ['general', 'amend'],
    usageCount: 0,
    successRate: 0.7,
  },
]

/**
 * 模板管理器类
 */
export class ResponseTemplateManager {
  private config: Required<TemplateManagerConfig>
  private templates: Map<string, ResponseTemplate> = new Map()
  private templateStats: Map<string, { usageCount: number; successCount: number }> = new Map()

  constructor(config: TemplateManagerConfig = {}) {
    this.config = {
      customTemplatePath: config.customTemplatePath || '',
      enableTracking: config.enableTracking ?? true,
      cacheSize: config.cacheSize || 100,
    }

    // 初始化内置模板
    this.initializeBuiltInTemplates()
  }

  /**
   * 初始化内置模板
   */
  private initializeBuiltInTemplates(): void {
    for (const template of BUILT_IN_TEMPLATES) {
      this.templates.set(template.id, template)
      this.templateStats.set(template.id, { usageCount: 0, successCount: 0 })
    }
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: ResponseTemplate): void {
    this.templates.set(template.id, template)
    this.templateStats.set(template.id, {
      usageCount: template.usageCount || 0,
      successCount: 0,
    })
  }

  /**
   * 批量添加模板
   */
  addTemplates(templates: ResponseTemplate[]): void {
    for (const template of templates) {
      this.addTemplate(template)
    }
  }

  /**
   * 获取模板
   */
  getTemplate(id: string): ResponseTemplate | undefined {
    return this.templates.get(id)
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): ResponseTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * 根据条件筛选模板
   */
  filterTemplates(filter: {
    rejectionType?: RejectionType
    strategy?: ResponseStrategy
    tags?: string[]
  }): ResponseTemplate[] {
    return this.getAllTemplates().filter((template) => {
      if (filter.rejectionType && !template.applicableRejections.includes(filter.rejectionType)) {
        return false
      }
      if (filter.strategy && !template.applicableStrategies.includes(filter.strategy)) {
        return false
      }
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every((tag) => template.tags.includes(tag))
        if (!hasAllTags) {
          return false
        }
      }
      return true
    })
  }

  /**
   * 推荐最佳模板
   */
  recommendTemplate(
    parseResult: OAParseResult,
    recommendation: StrategyRecommendation,
    documentType: 'cn' | 'pct' | 'us' = 'cn'
  ): ResponseTemplate | null {
    // 筛选符合条件的模板
    const candidates = this.filterTemplates({
      rejectionType: parseResult.rejectionTypes[0],
      strategy: recommendation.strategy,
      tags: [documentType],
    })

    if (candidates.length === 0) {
      return null
    }

    // 按成功率排序
    candidates.sort((a, b) => {
      const scoreA = this.calculateTemplateScore(a, parseResult)
      const scoreB = this.calculateTemplateScore(b, parseResult)
      return scoreB - scoreA
    })

    return candidates[0]
  }

  /**
   * 计算模板得分
   */
  private calculateTemplateScore(template: ResponseTemplate, parseResult: OAParseResult): number {
    let score = 0

    // 基础分：成功率
    score += template.successRate * 50

    // 使用次数权重（适度降低权重，避免过拟合）
    const usageScore = Math.min(template.usageCount / 100, 1) * 20
    score += usageScore

    // 统计数据
    const stats = this.templateStats.get(template.id)
    if (stats && stats.usageCount > 0) {
      const actualSuccessRate = stats.successCount / stats.usageCount
      score += actualSuccessRate * 30
    }

    return score
  }

  /**
   * 渲染模板
   */
  renderTemplate(
    templateId: string,
    variables: Record<string, string>,
    options?: {
      includeOpening?: boolean
      includeClosing?: boolean
      argumentCategories?: string[]
    }
  ): TemplateRenderResult {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`模板 ${templateId} 不存在`)
    }

    const result: TemplateRenderResult = {
      content: '',
      templateId,
      variables: { ...variables },
      hasMissingRequired: false,
      missingRequired: [],
    }

    let rendered = ''

    // 渲染开头
    if (options?.includeOpening !== false && template.content.opening) {
      rendered += this.replaceVariables(template.content.opening, variables)
    }

    // 渲染论点模板
    const categoriesToRender =
      options?.argumentCategories || template.content.argumentTemplates.map((t) => t.category)

    for (const argTemplate of template.content.argumentTemplates) {
      if (categoriesToRender.includes(argTemplate.category)) {
        rendered += '\n\n'
        rendered += this.replaceVariables(argTemplate.template, variables)
      }
    }

    // 渲染结尾
    if (options?.includeClosing !== false && template.content.closing) {
      rendered += this.replaceVariables(template.content.closing, variables)
    }

    result.content = rendered

    // 检查必需变量
    const requiredVars = this.getRequiredVariables(template)
    const missing = requiredVars.filter((v) => !variables[v] || variables[v].trim() === '')

    result.hasMissingRequired = missing.length > 0
    result.missingRequired = missing

    // 更新使用统计
    if (this.config.enableTracking) {
      this.trackUsage(templateId)
    }

    return result
  }

  /**
   * 替换变量
   */
  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g')
      result = result.replace(placeholder, value || `{${key}}`)
    }

    return result
  }

  /**
   * 获取模板的所有必需变量
   */
  private getRequiredVariables(template: ResponseTemplate): string[] {
    const allPlaceholders = new Set<string>()

    // 从开头提取
    if (template.content.opening) {
      const matches = template.content.opening.matchAll(/\{([^}]+)\}/g)
      for (const match of matches) {
        allPlaceholders.add(match[1])
      }
    }

    // 从论点模板提取
    for (const argTemplate of template.content.argumentTemplates) {
      if (argTemplate.placeholders) {
        argTemplate.placeholders.forEach((p) => allPlaceholders.add(p))
      }
      // 同时从模板内容中提取
      const matches = argTemplate.template.matchAll(/\{([^}]+)\}/g)
      for (const match of matches) {
        allPlaceholders.add(match[1])
      }
    }

    // 从结尾提取
    if (template.content.closing) {
      const matches = template.content.closing.matchAll(/\{([^}]+)\}/g)
      for (const match of matches) {
        allPlaceholders.add(match[1])
      }
    }

    return Array.from(allPlaceholders)
  }

  /**
   * 获取模板变量列表
   */
  getTemplateVariables(templateId: string): TemplateVariable[] {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`模板 ${templateId} 不存在`)
    }

    const variables = this.getRequiredVariables(template)
    const commonDefaults: Record<string, string> = {
      applicationNumber: '申请号',
      patentTitle: '专利名称',
      notificationDate: '审查通知日期',
      responseDate: new Date().toLocaleDateString('zh-CN'),
      claimNumbers: '1, 2',
      claimNumber: '1',
      referenceNumber: 'D1',
      referenceContent: '对比文件内容',
      distinguishingFeatures: '区别技术特征',
      technicalEffect: '技术效果',
      technicalProblem: '技术问题',
      technicalObstacle: '技术障碍',
      unexpectedEffects: '预料不到的技术效果',
      section: '说明书第X段',
      originalText: '原始权利要求文本',
      amendedText: '修改后的权利要求文本',
      addedFeature: '添加的特征',
      limitedAspect: '限定的方面',
    }

    return variables.map((name) => ({
      name,
      defaultValue: commonDefaults[name] || '',
      required: !name.startsWith('optional_'),
      description: `变量 ${name}`,
    }))
  }

  /**
   * 追踪模板使用
   */
  private trackUsage(templateId: string): void {
    const stats = this.templateStats.get(templateId)
    if (stats) {
      stats.usageCount++
    }

    // 更新模板的使用次数
    const template = this.templates.get(templateId)
    if (template) {
      template.usageCount++
    }
  }

  /**
   * 记录模板成功
   */
  recordSuccess(templateId: string): void {
    if (!this.config.enableTracking) {
      return
    }

    const stats = this.templateStats.get(templateId)
    if (stats) {
      stats.successCount++
    }

    // 更新模板成功率
    const template = this.templates.get(templateId)
    if (template && stats) {
      template.successRate = stats.successCount / stats.usageCount
    }
  }

  /**
   * 批量记录成功
   */
  recordSuccesses(templateIds: string[]): void {
    for (const id of templateIds) {
      this.recordSuccess(id)
    }
  }

  /**
   * 获取模板统计信息
   */
  getTemplateStats(
    templateId: string
  ): { usageCount: number; successCount: number; successRate: number } | undefined {
    const stats = this.templateStats.get(templateId)
    if (!stats) {
      return undefined
    }

    return {
      usageCount: stats.usageCount,
      successCount: stats.successCount,
      successRate: stats.usageCount > 0 ? stats.successCount / stats.usageCount : 0,
    }
  }

  /**
   * 获取所有模板的统计信息
   */
  getAllStats(): Map<string, { usageCount: number; successCount: number; successRate: number }> {
    const result = new Map()

    for (const [id, stats] of this.templateStats) {
      result.set(id, {
        usageCount: stats.usageCount,
        successCount: stats.successCount,
        successRate: stats.usageCount > 0 ? stats.successCount / stats.usageCount : 0,
      })
    }

    return result
  }

  /**
   * 删除模板
   */
  removeTemplate(templateId: string): boolean {
    const deleted = this.templates.delete(templateId)
    if (deleted) {
      this.templateStats.delete(templateId)
    }
    return deleted
  }

  /**
   * 清空自定义模板
   */
  clearCustomTemplates(): void {
    // 只保留内置模板
    const builtInIds = new Set(BUILT_IN_TEMPLATES.map((t) => t.id))

    for (const id of this.templates.keys()) {
      if (!builtInIds.has(id)) {
        this.templates.delete(id)
        this.templateStats.delete(id)
      }
    }
  }

  /**
   * 导出模板配置
   */
  exportTemplates(includeStats = false): string {
    const data: Record<string, any> = {
      templates: Array.from(this.templates.values()),
    }

    if (includeStats) {
      data.stats = Array.from(this.templateStats.entries())
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * 导入模板配置
   */
  importTemplates(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData)

      if (Array.isArray(data.templates)) {
        for (const template of data.templates) {
          this.addTemplate(template)
        }
      }

      if (Array.isArray(data.stats)) {
        for (const [id, stats] of data.stats) {
          this.templateStats.set(id, stats as any)
        }
      }
    } catch (error) {
      throw new Error(`导入模板失败: ${error}`)
    }
  }

  /**
   * 从文件加载模板
   */
  async loadFromFile(filePath: string): Promise<void> {
    // 在 Node.js 环境中实现文件读取
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf-8')
      this.importTemplates(content)
    } else {
      throw new Error('文件加载功能仅在 Node.js 环境中可用')
    }
  }

  /**
   * 保存模板到文件
   */
  async saveToFile(filePath: string, includeStats = true): Promise<void> {
    // 在 Node.js 环境中实现文件写入
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs/promises')
      const content = this.exportTemplates(includeStats)
      await fs.writeFile(filePath, content, 'utf-8')
    } else {
      throw new Error('文件保存功能仅在 Node.js 环境中可用')
    }
  }
}

/**
 * 创建默认模板管理器实例
 */
export function createTemplateManager(config?: TemplateManagerConfig): ResponseTemplateManager {
  return new ResponseTemplateManager(config)
}
