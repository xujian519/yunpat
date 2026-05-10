/**
 * 发明理解智能体 — 类型定义与常量
 */

/**
 * 发明理解输入接口
 */
export interface InventionUnderstandingInput {
  title: string
  field: string
  technicalDisclosure: string
  priorArt?: string[]
  drawings?: string[]
  applicant?: string
  inventors?: string[]
}

/**
 * 问题-特征-效果三元组
 */
export interface Triplet {
  technicalProblem: string
  keyFeatures: string[]
  technicalEffects: string[]
  confidence: number
}

/**
 * 发明理解输出接口
 */
export interface InventionUnderstandingOutput {
  inventionConcepts: Triplet[]
  technicalField: string
  backgroundArt: string
  embodimentSummary: string
  drawingDescriptions: string[]
  confidence: number
  validation?: ValidationResult

  keyFeatures: string[]
  technicalProblem: string
  technicalSolution: string
  beneficialEffects: string
}

/**
 * 验证结果
 */
export interface ValidationResult {
  passed: boolean
  errors: string[]
  warnings: string[]
  info: string[]
}

/**
 * 知识检索结果
 */
export interface KnowledgeRetrievalResult {
  methodology: {
    problem: string[]
    feature: string[]
    effect: string[]
    triplet: string[]
  }
  terminology: Map<string, string>
  domainKnowledge: {
    writingGuide?: string
    similarCases?: string[]
    commonErrors?: string[]
  }
  validationRules: string[]
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
export interface KnowledgeItem {
  content: string
  score: number
}

/**
 * 发明理解计划
 */
export interface InventionPlan {
  input: InventionUnderstandingInput
  knowledge: KnowledgeRetrievalResult
}

/**
 * 检索场景枚举
 */
export enum RetrievalScenario {
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
export class KnowledgeCache {
  private L1 = new Map<string, any[]>()
  private L2 = new Map<string, CacheItem>()
  private readonly TTL = 3600000

  async get(key: string): Promise<any[] | null> {
    if (this.L1.has(key)) {
      return this.L1.get(key)!
    }

    const l2Data = this.L2.get(key)
    if (l2Data && !this.isExpired(l2Data)) {
      this.L1.set(key, l2Data.results)
      return l2Data.results
    }

    return null
  }

  async set(key: string, results: any[]): Promise<void> {
    this.L1.set(key, results)
    this.L2.set(key, { results, timestamp: Date.now() })
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
 * 领域映射表
 */
export const FIELD_GUIDE_MAP: Record<
  string,
  {
    guide: string
    cases: string[]
    errors: string[]
  }
> = {
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
    cases: ['撰写-化学-延伸-中国对生物技术的专利保护', '撰写-化学-延伸-生物技术专利保护与传统知识'],
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

/**
 * 术语映射表
 */
export const TERMINOLOGY_MAP_ENTRIES: Array<[string, string]> = [
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
]

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
