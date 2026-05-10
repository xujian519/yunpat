import { KnowledgeEnhancedAgent, type ExecutionContext, SkillLoader } from '@yunpat/core'
import { join } from 'path'

/**
 * 发明理解输入接口
 */
export interface InventionUnderstandingInput {
  /** 发明名称 */
  title: string
  /** 技术领域 */
  field: string
  /** 技术交底书内容 */
  technicalDisclosure: string
  /** 现有技术（由检索工具提供） */
  priorArt?: string[]
  /** 附图列表（可选） */
  drawings?: string[]
  /** 申请人（可选） */
  applicant?: string
  /** 发明人列表（可选） */
  inventors?: string[]
}

/**
 * 问题-特征-效果三元组
 */
export interface Triplet {
  /** 技术问题 */
  technicalProblem: string
  /** 技术特征（关键创新点） */
  keyFeatures: string[]
  /** 技术效果（优势） */
  technicalEffects: string[]
  /** 置信度 */
  confidence: number
}

/**
 * 发明理解输出接口
 */
export interface InventionUnderstandingOutput {
  /** 多组问题-特征-效果三元组 */
  inventionConcepts: Triplet[]
  /** 技术领域（标准化） */
  technicalField: string
  /** 背景技术（基于现有技术整理） */
  backgroundArt: string
  /** 实施方式提炼 */
  embodimentSummary: string
  /** 附图说明 */
  drawingDescriptions: string[]
  /** 总体置信度 */
  confidence: number
  /** 验证结果 */
  validation?: ValidationResult

  /** 兼容性字段：所有关键特征（从 inventionConcepts 提取） */
  keyFeatures: string[]
  /** 兼容性字段：技术问题（第一组的问题） */
  technicalProblem: string
  /** 兼容性字段：技术方案（第一组的特征） */
  technicalSolution: string
  /** 兼容性字段：有益效果（所有效果） */
  beneficialEffects: string
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  passed: boolean
  /** 错误列表 */
  errors: string[]
  /** 警告列表 */
  warnings: string[]
  /** 信息列表 */
  info: string[]
}

/**
 * 知识检索结果
 */
export interface KnowledgeRetrievalResult {
  /** 方法论指导 */
  methodology: {
    problem: string[]
    feature: string[]
    effect: string[]
    triplet: string[]
  }
  /** 术语映射 */
  terminology: Map<string, string>
  /** 领域特定知识 */
  domainKnowledge: {
    writingGuide?: string
    similarCases?: string[]
    commonErrors?: string[]
  }
  /** 验证规则 */
  validationRules: string[]
  /** 外部搜索结果（网络 + 学术） */
  externalKnowledge: ExternalSearchResult[]
}

/**
 * 外部搜索结果
 */
export interface ExternalSearchResult {
  source: 'web' | 'academic'
  title: string
  content: string
  url?: string
}

/**
 * 知识检索项
 */
interface KnowledgeItem {
  content: string
  score: number
}

/**
 * 发明理解计划
 */
interface InventionPlan {
  /** 输入数据 */
  input: InventionUnderstandingInput
  /** 知识检索结果 */
  knowledge: KnowledgeRetrievalResult
}

/**
 * 检索场景枚举
 */
enum RetrievalScenario {
  METHODOLOGY = 'methodology',
  TERMINOLOGY = 'terminology',
  DOMAIN = 'domain',
  VALIDATION = 'validation',
}

/**
 * 缓存项
 */
interface CacheItem {
  results: any[]
  timestamp: number
}

/**
 * 知识缓存
 */
class KnowledgeCache {
  private L1 = new Map<string, any[]>()
  private L2 = new Map<string, CacheItem>()
  private readonly TTL = 3600000 // 1小时

  async get(key: string): Promise<any[] | null> {
    // L1 缓存
    if (this.L1.has(key)) {
      return this.L1.get(key)!
    }

    // L2 缓存（这里简化为内存，实际应持久化到磁盘）
    const l2Data = this.L2.get(key)
    if (l2Data && !this.isExpired(l2Data)) {
      this.L1.set(key, l2Data.results)
      return l2Data.results
    }

    return null
  }

  async set(key: string, results: any[]): Promise<void> {
    this.L1.set(key, results)
    this.L2.set(key, {
      results,
      timestamp: Date.now(),
    })
  }

  private isExpired(data: CacheItem): boolean {
    return Date.now() - data.timestamp > this.TTL
  }

  clear(): void {
    this.L1.clear()
    this.L2.clear()
  }
}

/**
 * 发明理解智能体（完整版）
 *
 * 功能：
 * 1. 多阶段知识检索（方法论→术语→领域→验证）
 * 2. 提取多组问题-特征-效果三元组
 * 3. 术语标准化
 * 4. 一致性验证
 * 5. 知识库缓存
 *
 * @extends KnowledgeEnhancedAgent
 */
export class InventionUnderstandingAgent extends KnowledgeEnhancedAgent<
  InventionUnderstandingInput,
  InventionUnderstandingOutput
> {
  private cache = new KnowledgeCache()
  private skillLoader?: SkillLoader

  constructor(config: any = {}) {
    super(config)
    this.skillLoader =
      config.skillLoader ||
      new SkillLoader({
        baseDir: join(process.cwd(), '.yunpat/skills/invention-understanding'),
      })
  }

  /** 领域映射表 */
  private readonly FIELD_GUIDE_MAP = {
    机械工程: {
      guide: '撰写-机械-权利要求书撰写-基本问题',
      cases: [
        '撰写-机械-案例-陶瓷阀片组件',
        '撰写-机械-案例-易拉罐开启装置',
        '撰写-机械-案例-浇包底部的浇铸阀门',
      ],
      errors: ['撰写-常见错误-密封装置', '撰写-常见错误-水龙头', '撰写-常见错误-磁化防垢除垢器'],
    },
    化学: {
      guide: '撰写-化学-概述-化学领域发明的种类及范畴',
      cases: [
        '撰写-化学-化合物发明',
        '撰写-化学-组合物与药品',
        '撰写-化学-生物技术领域发明专利申请文件的撰写',
      ],
      errors: ['撰写-化学-审查-化合物', '撰写-化学-审查-组合物'],
    },
    计算机程序: {
      guide: '撰写-审查要点-计算机程序发明-撰写准备与说明书',
      cases: ['撰写-审查要点-计算机程序发明'],
      errors: [],
    },
    生物技术: {
      guide: '撰写-化学-生物技术领域发明专利申请文件的撰写',
      cases: [
        '撰写-化学-延伸-中国对生物技术的专利保护',
        '撰写-化学-延伸-生物技术专利保护与传统知识',
      ],
      errors: ['撰写-化学-审查-生物技术领域发明专利申请的审查'],
    },
    新材料: {
      guide: '撰写-化学-高分子化合物-撰写实例（上）',
      cases: ['撰写-化学-延伸-天然物质发明的专利保护', '撰写-化学-概述-化学发明专利保护的若干界限'],
      errors: ['撰写-化学-审查-高分子化合物'],
    },
    医药: {
      guide: '撰写-化学-组合物与药品发明专利申请文件的撰写',
      cases: ['撰写-化学-审查-药品', '撰写-化学-延伸-公共健康与医药领域的专利保护'],
      errors: ['撰写-化学-审查-药品-不授予专利权主题'],
    },
  }

  /** 术语映射表 */
  private readonly TERMINOLOGY_MAP = new Map([
    // 通用术语
    ['用', '采用'],
    ['使用', '采用'],
    ['利用', '采用'],
    ['连接', '固定连接'],
    ['设置', '配置'],
    ['放在', '配置'],
    ['安装', '配置'],
    ['装置', '设备'],
    ['设备', '设备'],
    ['仪器', '设备'],
    ['方法', '技术方案'],
    ['工艺', '技术方案'],

    // 机械领域
    ['连接在一起', '固定连接'],
    ['连在一起', '固定连接'],
    ['固定', '固定连接'],
    ['可拆卸', '可拆卸连接'],
    ['焊接', '焊接连接'],
    ['螺纹连接', '螺纹配合'],

    // 化学领域
    ['包含', '包括'],
    ['含有', '包括'],
    ['由...组成', '由...构成'],
    ['混合', '复合'],
    ['添加', '加入'],
    ['反应', '进行反应'],
    ['制备', '制造'],
    ['合成', '制备'],

    // 计算机程序领域
    ['通过', '采用'],
    ['利用', '使用'],
    ['基于', '采用'],
    ['程序', '计算机程序'],
    ['软件', '计算机软件'],
    ['算法', '计算机算法'],
    ['代码', '程序代码'],

    // 生物技术领域
    ['培养', '进行培养'],
    ['分离', '进行分离'],
    ['纯化', '进行纯化'],
    ['提取', '进行提取'],
    ['检测', '进行检测'],
    ['分析', '进行分析'],

    // 新材料领域
    ['材料', '材料组合物'],
    ['组合', '复合'],
    ['涂层', '涂层材料'],
    ['薄膜', '薄膜材料'],
    ['纳米材料', '纳米级材料'],
  ])

  /** 默认 LLM 温度 */
  private readonly DEFAULT_TEMPERATURE = 0.3

  protected async plan(
    input: InventionUnderstandingInput,
    _context: ExecutionContext
  ): Promise<InventionPlan> {
    // 输入验证
    this.validateInput(input)

    console.log('\n🔍 [发明理解] 步骤1: 规划与知识检索阶段')
    console.log(`   发明名称: ${input.title}`)
    console.log(`   技术领域: ${input.field}`)
    console.log(`   交底书长度: ${input.technicalDisclosure.length} 字符`)

    // 多阶段知识检索
    const knowledge = await this.performMultiStageRetrieval(input)

    console.log(`   ✅ 知识检索完成`)
    console.log(
      `   - 方法论: ${knowledge.methodology.problem.length + knowledge.methodology.feature.length + knowledge.methodology.effect.length + knowledge.methodology.triplet.length} 条`
    )
    console.log(`   - 术语映射: ${knowledge.terminology.size} 条`)
    console.log(`   - 验证规则: ${knowledge.validationRules.length} 条`)
    console.log(`   - 外部资料: ${knowledge.externalKnowledge.length} 条`)

    return {
      input,
      knowledge,
    }
  }

  protected async act(
    plan: InventionPlan,
    _context: ExecutionContext
  ): Promise<InventionUnderstandingOutput> {
    console.log('\n🧠 [发明理解] 步骤2: 分析与提取阶段')

    if (!_context.llm) {
      throw new Error('LLM 未配置，无法执行发明理解')
    }

    const { input, knowledge } = plan

    // 初步提取三元组
    const preliminaryResult = await this.extractTriplets(_context.llm, input, knowledge)

    // 术语标准化
    const normalizedResult = this.normalizeTerminology(preliminaryResult, knowledge.terminology)

    // 一致性验证
    const validationResult = this.validateConsistency(normalizedResult, knowledge.validationRules)

    // 输出辅助信息
    // 提取兼容性字段
    const allKeyFeatures = normalizedResult.inventionConcepts.flatMap(
      (concept) => concept.keyFeatures
    )
    const allTechnicalEffects = normalizedResult.inventionConcepts.flatMap(
      (concept) => concept.technicalEffects
    )
    const primaryProblem =
      normalizedResult.inventionConcepts.length > 0
        ? normalizedResult.inventionConcepts[0].technicalProblem
        : ''
    const primarySolution =
      normalizedResult.inventionConcepts.length > 0
        ? normalizedResult.inventionConcepts[0].keyFeatures.join('；')
        : ''

    const output: InventionUnderstandingOutput = {
      inventionConcepts: normalizedResult.inventionConcepts,
      technicalField: normalizedResult.technicalField,
      backgroundArt: this.summarizePriorArt(input.priorArt),
      embodimentSummary: this.extractEmbodiment(input.technicalDisclosure),
      drawingDescriptions: input.drawings || [],
      confidence: this.calculateOverallConfidence(normalizedResult.inventionConcepts),
      validation: validationResult,
      // 兼容性字段
      keyFeatures: allKeyFeatures,
      technicalProblem: primaryProblem,
      technicalSolution: primarySolution,
      beneficialEffects: allTechnicalEffects.join('；'),
    }

    console.log(`\n✅ [发明理解] 分析完成`)
    console.log(`   发明构思: ${output.inventionConcepts.length} 组三元组`)
    console.log(`   总体置信度: ${(output.confidence * 100).toFixed(0)}%`)
    console.log(`   验证结果: ${validationResult.passed ? '✅ 通过' : '❌ 未通过'}`)

    if (validationResult.errors.length > 0) {
      console.log(`   错误: ${validationResult.errors.length} 个`)
      validationResult.errors.forEach((err) => console.log(`     - ${err}`))
    }

    if (validationResult.warnings.length > 0) {
      console.log(`   警告: ${validationResult.warnings.length} 个`)
      validationResult.warnings.forEach((warn) => console.log(`     - ${warn}`))
    }

    return output
  }

  /**
   * 多阶段知识检索
   */
  private async performMultiStageRetrieval(
    input: InventionUnderstandingInput
  ): Promise<KnowledgeRetrievalResult> {
    const knowledge: KnowledgeRetrievalResult = {
      methodology: { problem: [], feature: [], effect: [], triplet: [] },
      terminology: new Map(),
      domainKnowledge: {},
      validationRules: [],
      externalKnowledge: [],
    }

    // 阶段 1: 方法论检索
    console.log('\n   📚 阶段 1: 检索方法论指导...')
    knowledge.methodology = await this.retrieveMethodology()

    // 阶段 2: 术语检索
    console.log('   📖 阶段 2: 检索术语标准...')
    knowledge.terminology = await this.retrieveTerminology(input.field)

    // 阶段 3: 领域特定检索
    console.log('   🎯 阶段 3: 检索领域特定知识...')
    knowledge.domainKnowledge = await this.retrieveDomainKnowledge(input.field)

    // 阶段 4: 验证规则检索
    console.log('   ✅ 阶段 4: 检索验证规则...')
    knowledge.validationRules = await this.retrieveValidationRules()

    // 阶段 5: 外部技术搜索（网络 + 学术）
    console.log('   🌐 阶段 5: 搜索外部技术资料...')
    knowledge.externalKnowledge = await this.searchExternalKnowledge(input)

    return knowledge
  }

  /**
   * 检索方法论指导
   */
  private async retrieveMethodology(): Promise<KnowledgeRetrievalResult['methodology']> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.METHODOLOGY, {})
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached as unknown as KnowledgeRetrievalResult['methodology']
    }

    const problemItems = await this.queryKnowledgeWithFallback(
      ['如何从技术交底书中提取技术问题', '技术问题的确定原则', '说明书-发明内容-技术问题'],
      2
    )

    const featureItems = await this.queryKnowledgeWithFallback(
      [
        '如何识别发明的关键技术特征',
        '技术特征的划分原则',
        '必要技术特征的认定',
        '权利要求-保护范围的确定',
      ],
      3
    )

    const effectItems = await this.queryKnowledgeWithFallback(
      ['如何描述发明的技术效果', '技术效果的认定规则', '有益效果的描述方法'],
      2
    )

    const tripletItems = await this.queryKnowledgeWithFallback(
      [
        '创造性-区别特征与实际解决的技术问题',
        '创造性-概述与三步法框架',
        '问题-特征-效果的逻辑关系',
      ],
      2
    )

    const methodology = {
      problem: problemItems.map((item) => item.content),
      feature: featureItems.map((item) => item.content),
      effect: effectItems.map((item) => item.content),
      triplet: tripletItems.map((item) => item.content),
    }

    await this.cache.set(cacheKey, methodology as unknown as any[])
    return methodology
  }

  /**
   * 检索术语标准
   */
  private async retrieveTerminology(field: string): Promise<Map<string, string>> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.TERMINOLOGY, { field })
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return new Map(cached)
    }

    // 通用术语标准
    const generalResults = await this.queryKnowledgeWithFallback(
      ['权利要求-清楚的要求', '技术特征的认定', '专利术语标准'],
      2
    )

    // 领域特定术语
    const domainResults = await this.queryKnowledgeWithFallback(
      this.mapFieldToTerminologyQueries(field),
      2
    )

    // 构建术语映射
    const terminologyMap = new Map(this.TERMINOLOGY_MAP)

    // 从检索结果中提取额外的术语映射
    for (const result of [...generalResults, ...domainResults]) {
      const mappings = this.extractTerminologyMappings(result.content)
      for (const [informal, standard] of mappings) {
        terminologyMap.set(informal, standard)
      }
    }

    await this.cache.set(cacheKey, Array.from(terminologyMap.entries()))
    return terminologyMap
  }

  /**
   * 检索领域特定知识
   */
  private async retrieveDomainKnowledge(
    field: string
  ): Promise<KnowledgeRetrievalResult['domainKnowledge']> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.DOMAIN, { field })
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached as unknown as KnowledgeRetrievalResult['domainKnowledge']
    }

    const domainInfo = this.FIELD_GUIDE_MAP[field as keyof typeof this.FIELD_GUIDE_MAP]

    const domainKnowledge: KnowledgeRetrievalResult['domainKnowledge'] = {}

    if (domainInfo) {
      // 检索撰写指南
      if (domainInfo.guide) {
        const guideResults = await this.queryKnowledgeWithFallback([domainInfo.guide], 1)
        domainKnowledge.writingGuide = guideResults[0]?.content
      }

      // 检索类似案例
      if (domainInfo.cases && domainInfo.cases.length > 0) {
        const caseResults: string[] = []
        for (const caseKey of domainInfo.cases) {
          const results = await this.queryKnowledgeWithFallback([caseKey], 1)
          if (results[0]?.content) {
            caseResults.push(results[0].content)
          }
        }
        domainKnowledge.similarCases = caseResults
      }

      // 检索常见错误
      if (domainInfo.errors && domainInfo.errors.length > 0) {
        const errorResults: string[] = []
        for (const errorKey of domainInfo.errors) {
          const results = await this.queryKnowledgeWithFallback([errorKey], 1)
          if (results[0]?.content) {
            errorResults.push(results[0].content)
          }
        }
        domainKnowledge.commonErrors = errorResults
      }
    }

    await this.cache.set(cacheKey, domainKnowledge as unknown as any[])
    return domainKnowledge
  }

  /**
   * 检索验证规则
   */
  private async retrieveValidationRules(): Promise<string[]> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.VALIDATION, {})
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached as string[]
    }

    const results = await this.queryKnowledgeWithFallback(
      ['说明书-充分公开概述', '权利要求-以说明书为依据', '创造性-技术启示的判断'],
      3
    )

    const rules = results.map((r) => r.content)
    await this.cache.set(cacheKey, rules)
    return rules
  }

  /**
   * 外部技术搜索（网络 + 学术论文）
   *
   * 根据发明标题、技术领域和交底书关键词搜索外部技术资料，
   * 帮助更深入地理解交底书中的技术内容。
   */
  private async searchExternalKnowledge(
    input: InventionUnderstandingInput
  ): Promise<ExternalSearchResult[]> {
    const results: ExternalSearchResult[] = []
    const keywords = this.extractSearchKeywords(input)

    const searchPromises = [
      this.searchWeb(keywords.webQueries).catch((err) => {
        console.warn(`   ⚠️ 网络搜索失败: ${err instanceof Error ? err.message : String(err)}`)
        return []
      }),
      this.searchAcademic(keywords.academicQuery).catch((err) => {
        console.warn(`   ⚠️ 学术搜索失败: ${err instanceof Error ? err.message : String(err)}`)
        return []
      }),
    ]

    const [webResults, academicResults] = await Promise.all(searchPromises)
    results.push(...webResults, ...academicResults)

    // 对高相关性的网页抓取全文
    const topWebResults = webResults.filter((r) => r.url).slice(0, 3)
    for (const result of topWebResults) {
      try {
        const fullContent = await this.fetchWebPage(result.url!)
        if (fullContent) {
          results.push({
            source: 'web',
            title: `${result.title}（全文）`,
            content: fullContent.substring(0, 2000),
            url: result.url,
          })
        }
      } catch {
        // 抓取失败不影响整体流程
      }
    }

    console.log(`   网络搜索: ${webResults.length} 条`)
    console.log(`   学术搜索: ${academicResults.length} 条`)
    console.log(`   网页抓取: ${topWebResults.length} 篇`)

    return results
  }

  /**
   * 从交底书中提取搜索关键词
   */
  private extractSearchKeywords(input: InventionUnderstandingInput): {
    webQueries: string[]
    academicQuery: string
  } {
    // 从标题和领域构建搜索查询
    const webQueries: string[] = []

    // 查询 1: 发明标题本身
    webQueries.push(input.title)

    // 查询 2: 技术领域 + 核心技术术语
    const technicalTerms = this.extractTechnicalTerms(input.technicalDisclosure)
    if (technicalTerms.length > 0) {
      webQueries.push(`${input.field} ${technicalTerms.slice(0, 3).join(' ')}`)
    }

    // 查询 3: 技术领域的最新发展
    webQueries.push(`${input.field} 技术原理 现有技术`)

    // 学术搜索查询
    const academicQuery =
      technicalTerms.length > 0
        ? `${input.field} ${technicalTerms.slice(0, 2).join(' ')}`
        : input.title

    return { webQueries, academicQuery }
  }

  /**
   * 从交底书中提取技术术语（简单规则匹配）
   */
  private extractTechnicalTerms(disclosure: string): string[] {
    const terms: string[] = []
    const patterns = [
      /(?:称为|叫做|简称|即|亦称)\s*[「"'"]?([^「"'"，。；]+)[「"'"]?/g,
      /(?:包括|包含|具有)\s*([^，。；\n]{2,15})/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(disclosure)) !== null) {
        const term = match[1].trim()
        if (term.length >= 2 && term.length <= 15 && !terms.includes(term)) {
          terms.push(term)
        }
      }
    }

    return terms.slice(0, 8)
  }

  /**
   * 网络搜索（DuckDuckGo API）
   */
  private async searchWeb(queries: string[]): Promise<ExternalSearchResult[]> {
    const results: ExternalSearchResult[] = []

    for (const query of queries.slice(0, 3)) {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)

        const data = (await response.json()) as {
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>
          AbstractText?: string
          AbstractURL?: string
        }

        if (data.AbstractText) {
          results.push({
            source: 'web',
            title: query,
            content: data.AbstractText,
            url: data.AbstractURL,
          })
        }

        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics) {
            if (topic.Text && topic.FirstURL && results.length < 10) {
              results.push({
                source: 'web',
                title: topic.Text.substring(0, 100),
                content: topic.Text,
                url: topic.FirstURL,
              })
            }
          }
        }
      } catch {
        // 单个查询失败不影响其他查询
      }
    }

    return results
  }

  /**
   * 学术论文搜索（Semantic Scholar API）
   */
  private async searchAcademic(query: string): Promise<ExternalSearchResult[]> {
    try {
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,abstract,url`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      const data = (await response.json()) as {
        data?: Array<{ title?: string; abstract?: string; url?: string }>
      }

      if (!data.data) return []

      return data.data
        .filter((paper) => paper.abstract)
        .map((paper) => ({
          source: 'academic' as const,
          title: paper.title || '',
          content: paper.abstract!.substring(0, 500),
          url: paper.url,
        }))
    } catch {
      return []
    }
  }

  /**
   * 抓取网页内容
   */
  private async fetchWebPage(url: string): Promise<string | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YunPat/1.0)' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) return null

      const html = await response.text()
      // 简单提取文本：去除 HTML 标签
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    } catch {
      return null
    }
  }

  /**
   * 带降级策略的知识检索
   */
  private async queryKnowledgeWithFallback(
    queries: string[],
    topK: number
  ): Promise<KnowledgeItem[]> {
    try {
      // 尝试主检索
      const results = await Promise.all(queries.map((q) => this.queryKnowledge(q, 1)))

      const flattened = results.flat()
      const scored: KnowledgeItem[] = flattened.map((r) => ({
        content: r.content,
        score: r.score,
      }))

      if (scored.length >= topK) {
        return scored.slice(0, topK)
      }

      console.warn(`检索结果不足 (${scored.length}/${topK})，使用降级策略`)

      // 降级策略：使用通用查询
      const fallbackResults = await this.queryKnowledge('撰写-说明书撰写要求', topK)

      return fallbackResults.map((r) => ({
        content: r.content,
        score: r.score,
      }))
    } catch (error) {
      console.error('检索失败，使用硬编码方法论:', error)

      // 最后的保底：硬编码方法论
      return [
        {
          content: this.getHardcodedMethodology(),
          score: 0.5,
        },
      ]
    }
  }

  /**
   * 提取三元组
   */
  private async extractTriplets(
    llm: NonNullable<ExecutionContext['llm']>,
    input: InventionUnderstandingInput,
    knowledge: KnowledgeRetrievalResult
  ): Promise<InventionUnderstandingOutput> {
    const systemPrompt = await this.buildSystemPrompt(knowledge)
    const userPrompt = await this.buildUserPrompt(input, knowledge)

    const response = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.DEFAULT_TEMPERATURE,
    })

    const parsed = this.safeParseJSON(response.message.content)
    if (!parsed) {
      throw new Error('无法解析 LLM 响应')
    }

    return this.normalizeOutput(parsed, input)
  }

  /**
   * 构建系统 Prompt（包含方法论）
   */
  private async buildSystemPrompt(knowledge: KnowledgeRetrievalResult): Promise<string> {
    if (this.skillLoader) {
      try {
        const template = await this.skillLoader.load('system-prompt')
        return this.skillLoader.render(template, {
          hasMethodologyTriplet: knowledge.methodology.triplet.length > 0,
          methodologyTriplet: knowledge.methodology.triplet.join('\n\n'),
          hasMethodologyProblem: knowledge.methodology.problem.length > 0,
          methodologyProblem: knowledge.methodology.problem.join('\n'),
          hasMethodologyFeature: knowledge.methodology.feature.length > 0,
          methodologyFeature: knowledge.methodology.feature.join('\n'),
          hasMethodologyEffect: knowledge.methodology.effect.length > 0,
          methodologyEffect: knowledge.methodology.effect.join('\n'),
        })
      } catch {
        /* knowledge enhancement failed, use default prompt */
      }
    }

    let prompt = `你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。

你的任务是深入理解技术交底书，提取**多组**问题-特征-效果三元组。

`

    // 添加方法论指导
    if (knowledge.methodology.triplet.length > 0) {
      prompt += `\n## 参考方法论（来自专利知识库）\n\n`
      prompt += `### 三步法框架\n`
      prompt += knowledge.methodology.triplet.join('\n\n')
      prompt += `\n`
    }

    if (knowledge.methodology.problem.length > 0) {
      prompt += `\n### 技术问题提取方法\n`
      prompt += knowledge.methodology.problem.join('\n')
      prompt += `\n`
    }

    if (knowledge.methodology.feature.length > 0) {
      prompt += `\n### 技术特征提取方法\n`
      prompt += knowledge.methodology.feature.join('\n')
      prompt += `\n`
    }

    if (knowledge.methodology.effect.length > 0) {
      prompt += `\n### 技术效果提取方法\n`
      prompt += knowledge.methodology.effect.join('\n')
      prompt += `\n`
    }

    // 添加外部搜索知识
    if (knowledge.externalKnowledge.length > 0) {
      prompt += `\n## 外部技术资料（来自网络搜索和学术论文）\n\n`
      for (const item of knowledge.externalKnowledge.slice(0, 8)) {
        const sourceLabel = item.source === 'academic' ? '学术论文' : '网络资料'
        prompt += `### [${sourceLabel}] ${item.title}\n`
        prompt += `${item.content.substring(0, 500)}\n\n`
      }
      prompt += `请参考上述外部技术资料来更准确地理解交底书中的技术内容。\n`
    }

    prompt += `
## 核心原则

1. **多组三元组**: 提取多组问题-特征-效果，覆盖发明的多个创新点
2. **逻辑一致性**: 问题-特征-效果必须一一对应
3. **具体性**: 技术特征必须具体，技术效果必须可量化或可验证
4. **对比性**: 技术效果必须与现有技术有明确对比

输出要求：
- 用中文回答，保持专业术语的准确性
- 输出必须是严格的 JSON 格式
- 为每个三元组提供置信度评估（0-1之间）
`

    return prompt
  }

  /**
   * 构建用户 Prompt
   */
  private async buildUserPrompt(
    input: InventionUnderstandingInput,
    knowledge: KnowledgeRetrievalResult
  ): Promise<string> {
    if (this.skillLoader) {
      try {
        const template = await this.skillLoader.load('user-prompt')
        return this.skillLoader.render(template, {
          title: input.title,
          field: input.field,
          applicant: input.applicant || '',
          inventors: input.inventors ? input.inventors.join(', ') : '',
          hasPriorArt: !!(input.priorArt && input.priorArt.length > 0),
          priorArt: input.priorArt ? input.priorArt.join('\n\n') : '',
          technicalDisclosure: input.technicalDisclosure,
          hasDrawings: !!(input.drawings && input.drawings.length > 0),
          drawings: input.drawings ? input.drawings.join('\n') : '',
          hasSimilarCases: !!(
            knowledge.domainKnowledge.similarCases &&
            knowledge.domainKnowledge.similarCases.length > 0
          ),
          similarCases: knowledge.domainKnowledge.similarCases
            ? knowledge.domainKnowledge.similarCases.join('\n\n---\n\n')
            : '',
          hasCommonErrors: !!(
            knowledge.domainKnowledge.commonErrors &&
            knowledge.domainKnowledge.commonErrors.length > 0
          ),
          commonErrors: knowledge.domainKnowledge.commonErrors
            ? knowledge.domainKnowledge.commonErrors.join('\n\n')
            : '',
        })
      } catch {
        /* knowledge enhancement failed, use default prompt */
      }
    }

    let prompt = `## 发明基本信息

发明名称：${input.title}
技术领域：${input.field}
${input.applicant ? `申请人：${input.applicant}` : ''}
${input.inventors ? `发明人：${input.inventors.join(', ')}` : ''}

`

    if (input.priorArt && input.priorArt.length > 0) {
      prompt += `## 现有技术（背景）\n\n`
      prompt += input.priorArt.join('\n\n')
      prompt += `\n\n`
    }

    prompt += `## 技术交底书\n\n`
    prompt += input.technicalDisclosure

    // 添加混合格式解析指导
    prompt += `

---

**重要提示**：以上文本可能是混合格式（例如同时包含权利要求书、说明书、对比文件、答题须知等）。
请专注于提取其中描述的发明创造的**实质技术内容**，忽略答题须知、评分标准、考试说明等非技术部分。
从说明书和/或权利要求书中提取发明的技术问题、关键技术特征和技术效果。
如果文本中包含对比文件，请将其视为现有技术参考，帮助理解发明的创新点。
`

    if (input.drawings && input.drawings.length > 0) {
      prompt += `\n\n## 附图说明\n\n`
      prompt += input.drawings.join('\n')
    }

    if (
      knowledge.domainKnowledge.similarCases &&
      knowledge.domainKnowledge.similarCases.length > 0
    ) {
      prompt += `\n\n## 参考案例\n\n`
      prompt += knowledge.domainKnowledge.similarCases.join('\n\n---\n\n')
    }

    if (
      knowledge.domainKnowledge.commonErrors &&
      knowledge.domainKnowledge.commonErrors.length > 0
    ) {
      prompt += `\n\n## 常见错误提醒\n\n`
      prompt += knowledge.domainKnowledge.commonErrors.join('\n\n')
    }

    if (knowledge.externalKnowledge.length > 0) {
      prompt += `\n\n## 外部技术参考\n\n`
      for (const item of knowledge.externalKnowledge.slice(0, 5)) {
        const sourceLabel = item.source === 'academic' ? '论文' : '网络'
        prompt += `[${sourceLabel}] ${item.title}\n${item.content.substring(0, 300)}\n\n`
      }
    }

    prompt += `

## 输出要求

请提取**多组**问题-特征-效果三元组，输出以下 JSON 格式：

\`\`\`json
{
  "inventionConcepts": [
    {
      "technicalProblem": "要解决的具体技术问题",
      "keyFeatures": ["特征1", "特征2", "特征3"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.9
    }
  ],
  "technicalField": "标准化的技术领域描述",
  "embodimentSummary": "实施方式提炼",
  "drawingDescriptions": ["图1描述", "图2描述"]
}
\`\`\`

**重要提示**：
- 每个技术特征必须对应至少一个技术效果
- 技术效果必须与现有技术有明确对比（如"提高50%"、"延长3倍"）
- 技术问题不应包含解决手段
- 技术特征必须具体（不是"改进设计"）
- 提取多组三元组，覆盖所有创新点
`

    return prompt
  }

  /**
   * 术语标准化
   */
  private normalizeTerminology(
    result: InventionUnderstandingOutput,
    terminologyMap: Map<string, string>
  ): InventionUnderstandingOutput {
    const normalize = (text: string): string => {
      let normalized = text
      for (const [informal, standard] of terminologyMap) {
        const regex = new RegExp(informal, 'g')
        normalized = normalized.replace(regex, standard)
      }
      return normalized
    }

    return {
      ...result,
      inventionConcepts: result.inventionConcepts.map((concept) => ({
        ...concept,
        technicalProblem: normalize(concept.technicalProblem),
        keyFeatures: concept.keyFeatures.map((f) => normalize(f)),
        technicalEffects: concept.technicalEffects.map((e) => normalize(e)),
      })),
      technicalField: normalize(result.technicalField),
    }
  }

  /**
   * 一致性验证
   */
  private validateConsistency(
    result: InventionUnderstandingOutput,
    _validationRules: string[]
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []

    // 验证每个三元组
    for (let i = 0; i < result.inventionConcepts.length; i++) {
      const concept = result.inventionConcepts[i]
      const prefix = `三元组${i + 1}`

      // 检查 1: 技术特征数量
      if (concept.keyFeatures.length === 0) {
        errors.push(`${prefix}: 缺少技术特征`)
      }

      // 检查 2: 技术效果数量
      if (concept.technicalEffects.length === 0) {
        errors.push(`${prefix}: 缺少技术效果`)
      }

      // 检查 3: 特征与效果对应关系
      if (concept.keyFeatures.length > concept.technicalEffects.length) {
        warnings.push(`${prefix}: 技术特征多于技术效果，可能存在无对应效果的特征`)
      }

      // 检查 4: 技术问题是否包含解决手段
      const forbiddenWords = ['通过', '采用', '使用', '利用']
      if (forbiddenWords.some((word) => concept.technicalProblem.includes(word))) {
        errors.push(`${prefix}: 技术问题包含解决手段`)
      }

      // 检查 5: 技术效果是否有对比
      const comparisonWords = ['提高', '降低', '延长', '缩短', '改善', '优于']
      const hasComparison = concept.technicalEffects.some(
        (e) =>
          comparisonWords.some((word) => e.includes(word)) || e.includes('%') || e.includes('倍')
      )
      if (!hasComparison) {
        warnings.push(`${prefix}: 技术效果缺乏明确的对比数据`)
      }

      // 检查 6: 技术特征是否具体
      const vagueWords = ['改进', '优化', '提升', '完善']
      const vagueFeatures = concept.keyFeatures.filter((f) =>
        vagueWords.some((word) => f.includes(word))
      )
      if (vagueFeatures.length > 0) {
        warnings.push(`${prefix}: 以下技术特征过于抽象: ${vagueFeatures.join(', ')}`)
      }
    }

    // 检查 7: 三元组之间的一致性
    if (result.inventionConcepts.length > 1) {
      const problems = new Set(result.inventionConcepts.map((c) => c.technicalProblem))
      if (problems.size < result.inventionConcepts.length) {
        info.push('多个三元组解决了相同的技术问题，可能需要合并')
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      info,
    }
  }

  /**
   * 计算总体置信度
   */
  private calculateOverallConfidence(concepts: Triplet[]): number {
    if (concepts.length === 0) return 0

    const sum = concepts.reduce((acc, c) => acc + c.confidence, 0)
    return sum / concepts.length
  }

  /**
   * 提取实施方式
   */
  private extractEmbodiment(disclosure: string): string {
    // 简化版本：提取前500个字符作为实施方式摘要
    // 实际实现应更智能地识别实施方式部分
    return disclosure.substring(0, Math.min(500, disclosure.length))
  }

  /**
   * 总结现有技术
   */
  private summarizePriorArt(priorArt?: string[]): string {
    if (!priorArt || priorArt.length === 0) {
      return '未提供现有技术信息'
    }
    return priorArt.join('\n\n')
  }

  /**
   * 标准化输出
   */
  private normalizeOutput(
    parsed: Record<string, unknown>,
    input: InventionUnderstandingInput
  ): InventionUnderstandingOutput {
    const getString = (key: string): string => {
      const value = parsed[key]
      return typeof value === 'string' ? value.trim() : ''
    }

    const getStringArray = (key: string): string[] => {
      const value = parsed[key]
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string').map((s) => s.trim())
        : []
    }

    const getNumber = (key: string, fallback: number): number => {
      const value = parsed[key]
      if (typeof value === 'number' && !isNaN(value)) {
        return Math.max(0, Math.min(1, value))
      }
      return fallback
    }

    // 提取三元组
    const conceptsRaw = parsed.inventionConcepts
    const inventionConcepts: Triplet[] = []

    if (Array.isArray(conceptsRaw)) {
      for (const item of conceptsRaw) {
        if (typeof item === 'object' && item !== null) {
          inventionConcepts.push({
            technicalProblem: getString.call(item, 'technicalProblem') || '',
            keyFeatures: getStringArray.call(item, 'keyFeatures'),
            technicalEffects: getStringArray.call(item, 'technicalEffects'),
            confidence: getNumber.call(item, 'confidence', 0.8),
          })
        }
      }
    }

    // 如果没有提取到三元组，创建一个默认的
    if (inventionConcepts.length === 0) {
      inventionConcepts.push({
        technicalProblem: getString('technicalProblem') || '',
        keyFeatures: getStringArray('keyFeatures'),
        technicalEffects: getStringArray('beneficialEffects'),
        confidence: 0.7,
      })
    }

    // 提取所有关键特征（用于兼容性）
    let allKeyFeatures = inventionConcepts.flatMap((concept) => concept.keyFeatures)
    const allTechnicalEffects = inventionConcepts.flatMap((concept) => concept.technicalEffects)

    // 兜底：如果LLM未提取到特征，从技术交底书中自动提取
    if (allKeyFeatures.length === 0) {
      allKeyFeatures = this.extractFeaturesFromDisclosure(input.technicalDisclosure)
      console.log(`[InventionUnderstandingAgent] 自动提取特征: ${allKeyFeatures.length} 个`)
    }

    const primaryProblem = inventionConcepts.length > 0 ? inventionConcepts[0].technicalProblem : ''
    const primarySolution = allKeyFeatures.join('；')

    return {
      inventionConcepts,
      technicalField: getString('technicalField') || input.field,
      backgroundArt: '',
      embodimentSummary: getString('embodimentSummary'),
      drawingDescriptions: getStringArray('drawingDescriptions'),
      confidence: 0.8,
      // 兼容性字段
      keyFeatures: allKeyFeatures,
      technicalProblem: primaryProblem,
      technicalSolution: primarySolution,
      beneficialEffects: allTechnicalEffects.join('；'),
    }
  }

  /**
   * 映射领域到术语查询
   */
  private mapFieldToTerminologyQueries(field: string): string[] {
    const FIELD_TERMINOLOGY_MAP: Record<string, string[]> = {
      机械工程: ['撰写-机械-权利要求书撰写-常见问题', '撰写-机械-说明书撰写-名称与技术领域'],
      化学: ['撰写-化学-概述-化学领域发明的种类及范畴', '撰写-化学-化合物发明-撰写要点'],
      计算机程序: ['撰写-审查要点-计算机程序发明'],
      生物技术: [
        '撰写-化学-生物技术领域发明专利申请文件的撰写',
        '撰写-化学-审查-生物技术领域发明专利申请的审查',
      ],
      新材料: ['撰写-化学-高分子化合物-撰写实例', '撰写-化学-高分子化合物-权利要求书'],
      医药: ['撰写-化学-组合物与药品发明专利申请文件的撰写', '撰写-化学-审查-药品-充分公开'],
    }

    return FIELD_TERMINOLOGY_MAP[field] || []
  }

  /**
   * 从技术交底书中提取特征（兜底机制）
   * 当LLM未能提取到特征时，使用多模式规则提取交底书中的技术组件
   */
  private extractFeaturesFromDisclosure(disclosure: string): string[] {
    const features: string[] = []

    // 过滤掉非技术内容（答题须知、评分标准等）
    const cleanedDisclosure = this.cleanTechnicalContent(disclosure)

    // 匹配 "包括..."、"具有..."、"包含..." 后的名词短语
    const includePatterns = [
      /包括\s*([^，。；\n]{2,40})/g,
      /具有\s*([^，。；\n]{2,40})/g,
      /包含\s*([^，。；\n]{2,40})/g,
      /设有\s*([^，。；\n]{2,40})/g,
      /设置有\s*([^，。；\n]{2,40})/g,
      /由\s*([^，。；\n]{2,40})\s*组成/g,
      /配置有\s*([^，。；\n]{2,40})/g,
      /安装有\s*([^，。；\n]{2,40})/g,
      /采用\s*([^，。；\n]{2,40})/g,
    ]

    for (const pattern of includePatterns) {
      let match
      while ((match = pattern.exec(cleanedDisclosure)) !== null) {
        const feature = match[1].trim()
        if (feature.length > 2 && feature.length <= 40 && !features.includes(feature)) {
          features.push(feature)
        }
      }
    }

    // 提取"其特征在于"后的特征（权利要求书格式）
    const characteristicPattern = /其特征在于[：:]\s*([^。；\n]{3,80})/g
    let charMatch
    while ((charMatch = characteristicPattern.exec(cleanedDisclosure)) !== null) {
      const feature = charMatch[1].trim()
      if (feature.length > 3 && !features.includes(feature)) {
        features.push(feature)
      }
    }

    // 提取权利要求中的组件（如"1. 一种...，其特征在于..."）
    const claimComponentPattern =
      /权利要求\s*\d+[^。]*?(?:包括|具有|包含|设有)[^。]*?(?:的)?([^，。；\n]{2,30})/g
    let compMatch
    while ((compMatch = claimComponentPattern.exec(cleanedDisclosure)) !== null) {
      const feature = compMatch[1].trim()
      if (feature.length > 2 && !features.includes(feature)) {
        features.push(feature)
      }
    }

    // 提取"用于..."、"用来..."后的功能描述
    const purposePattern = /(?:用于|用来|用以|旨在|以便)\s*([^，。；\n]{3,50})/g
    let purposeMatch
    while ((purposeMatch = purposePattern.exec(cleanedDisclosure)) !== null) {
      const feature = purposeMatch[1].trim()
      if (feature.length > 3 && !features.includes(feature)) {
        features.push(feature)
      }
    }

    // 如果还是没提取到，按标点分割取有意义的片段
    if (features.length === 0) {
      const segments = cleanedDisclosure
        .split(/[，。；]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5 && s.length < 60)
        .filter((s) => !/^\d+[\.、]/.test(s)) // 过滤纯编号行
      features.push(...segments.slice(0, 8))
    }

    return features.slice(0, 15)
  }

  /**
   * 清洗技术内容，去除非技术部分
   */
  private cleanTechnicalContent(disclosure: string): string {
    // 移除常见的考试/答题非技术部分
    const nonTechPatterns = [
      /答题须知[\s\S]*?(?=\n\n|\Z)/,
      /评分标准[\s\S]*?(?=\n\n|\Z)/,
      /考试说明[\s\S]*?(?=\n\n|\Z)/,
      /注意事项[\s\S]*?(?=\n\n|\Z)/,
      /^\s*\d+\s*分\s*$/m,
      /^(?:一|二|三|四|五|六|七|八|九|十)[、．.]\s*$/m,
    ]

    let cleaned = disclosure
    for (const pattern of nonTechPatterns) {
      cleaned = cleaned.replace(pattern, '')
    }

    return cleaned
  }

  /**
   * 提取术语映射
   */
  private extractTerminologyMappings(content: string): Array<[string, string]> {
    const mappings: Array<[string, string]> = []

    const patterns = [
      /[""「]([^""」]+)[""」]\s*[（(]\s*([^)）]+)\s*[)）]/g,
      /(?:又称|也称为|也叫|简称|缩写为|亦称|又名)\s*[：:""「]?([^,，。；\n""」]+?)[""」]?/g,
      /([^,，。；\n（(]+?)\s*[（(]\s*(?:英文|全称|简称)\s*[：:]\s*([^)）]+)\s*[)）]/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[（(]\s*([^)）]+)\s*[)）]/g,
      /([^\s,，。；\n（(]{2,10})\s*(?:→|->|➡|即|指的是?|代表)\s*([^\s,，。；\n]+)/g,
    ]

    const seen = new Set<string>()
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const from = match[1].trim()
        const to = match[2]?.trim() || match[1].trim()
        if (from && to && from !== to && !seen.has(`${from}:${to}`)) {
          seen.add(`${from}:${to}`)
          mappings.push([from, to])
        }
      }
    }

    const bracketPattern = /[（(]([^)）]{2,30})[)）]/g
    let bracketMatch
    while ((bracketMatch = bracketPattern.exec(content)) !== null) {
      const inner = bracketMatch[1].trim()
      const beforeText = content.substring(Math.max(0, bracketMatch.index - 20), bracketMatch.index)
      const chineseMatch = beforeText.match(/([\u4e00-\u9fff]{2,10})\s*$/)
      if (chineseMatch) {
        const from = chineseMatch[1]
        const to = inner
        if (from !== to && !seen.has(`${from}:${to}`)) {
          const looksLikeEnglish = /^[A-Za-z]/.test(to)
          const looksLikeChinese = /^[\u4e00-\u9fff]/.test(to)
          if (looksLikeEnglish || looksLikeChinese) {
            seen.add(`${from}:${to}`)
            mappings.push([from, to])
          }
        }
      }
    }

    return mappings.slice(0, 50)
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(scenario: RetrievalScenario, params: Record<string, any>): string {
    const parts = [scenario, params.field || 'general', params.query?.substring(0, 20) || '']

    return parts.join(':')
  }

  /**
   * 获取硬编码方法论（保底）
   */
  private getHardcodedMethodology(): string {
    return `
## 技术问题提取方法
1. 针对现有技术缺陷或不足
2. 用正面、简洁语言描述
3. 不包含解决手段本身

## 技术特征提取方法
1. 区分必要特征和非必要特征
2. 独立特征分开，协同特征整体
3. 实质对比而非文字对比

## 技术效果提取方法
1. 由技术特征直接带来
2. 与现有技术明确对比
3. 具体分析，量化描述
`
  }

  /**
   * 验证输入
   */
  private validateInput(input: InventionUnderstandingInput): void {
    if (!input.title?.trim()) {
      throw new Error('发明名称不能为空')
    }
    if (!input.field?.trim()) {
      throw new Error('技术领域不能为空')
    }
    if (!input.technicalDisclosure?.trim()) {
      throw new Error('技术交底书不能为空')
    }
    if (input.technicalDisclosure.length < 10) {
      throw new Error('技术交底书内容过少，请提供更详细的描述')
    }
  }
}

/**
 * 发明理解错误类
 */
export class InventionUnderstandingError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'InventionUnderstandingError'
    this.code = code
  }
}
