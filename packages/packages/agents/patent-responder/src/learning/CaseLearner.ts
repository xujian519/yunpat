/**
 * 历史案例学习器
 *
 * 负责管理和学习历史答复案例：
 * 1. 案例存储和检索
 * 2. 相似案例匹配
 * 3. 案例特征提取
 * 4. 经验总结和规则提取
 * 5. 持续学习和优化
 *
 * @module learning/CaseLearner
 */

import type { HistoricalCase, ResponseArgument, AmendmentSuggestion } from '../types/index.js'
import { OAParseResult, RejectionType, ResponseStrategy } from '../types/index.js'

/**
 * 案例查询条件
 */
export interface CaseQuery {
  /** 驳回类型 */
  rejectionTypes?: RejectionType[]
  /** 答复策略 */
  strategy?: ResponseStrategy
  /** 结果 */
  outcome?: 'success' | 'partial_success' | 'failure'
  /** 技术领域 */
  technicalField?: string
  /** 审查员 */
  examiner?: string
  /** 日期范围 */
  dateRange?: { start: Date; end: Date }
  /** 最小相似度 */
  minSimilarity?: number
  /** IPC分类号 */
  ipcClassifications?: string[]
  /** 标签 */
  tags?: string[]
}

/**
 * 案例相似度结果
 */
export interface CaseSimilarity {
  case: HistoricalCase
  similarity: number
  matchingFactors: string[]
}

/**
 * 案例学习器配置
 */
export interface CaseLearnerConfig {
  /** 案例存储路径 */
  storagePath?: string
  /** 是否启用自动学习 */
  enableAutoLearning?: boolean
  /** 相似度计算方法 */
  similarityMethod?: 'cosine' | 'jaccard' | 'weighted'
  /** 最大缓存案例数 */
  maxCacheSize?: number
  /** 是否持久化 */
  enablePersistence?: boolean
}

/**
 * 案例特征向量
 */
interface CaseFeatures {
  /** 驳回类型编码 */
  rejectionTypeVector: number[]
  /** 严重程度编码 */
  severityVector: number[]
  /** 权利要求数量 */
  claimCount: number
  /** 引用文献数量 */
  referenceCount: number
  /** 策略编码 */
  strategyCode: number
  /** 技术领域编码 */
  fieldCode: number
}

/**
 * 驳回类型到索引的映射
 */
const REJECTION_TYPE_INDEX: Record<RejectionType, number> = {
  [RejectionType.NOVELTY]: 0,
  [RejectionType.INVENTIVENESS]: 1,
  [RejectionType.UTILITY]: 2,
  [RejectionType.SUPPORT]: 3,
  [RejectionType.CLARITY]: 4,
  [RejectionType.SCOPE]: 5,
  [RejectionType.AMENDMENT_SCOPE]: 6,
  [RejectionType.UNITY]: 7,
  [RejectionType.FORMALITY]: 8,
  [RejectionType.OTHER]: 9,
}

/**
 * 技术领域映射
 */
const TECHNICAL_FIELDS: Record<string, number> = {
  电子通信: 0,
  计算机软件: 1,
  机械制造: 2,
  化学材料: 3,
  医疗器械: 4,
  汽车工程: 5,
  其他: 6,
}

/**
 * 案例学习器类
 */
export class CaseLearner {
  private config: Required<CaseLearnerConfig>
  private cases: Map<string, HistoricalCase> = new Map()
  private featureCache: Map<string, CaseFeatures> = new Map()
  private dirtyCases: Set<string> = new Set()

  constructor(config: CaseLearnerConfig = {}) {
    this.config = {
      storagePath: config.storagePath || '',
      enableAutoLearning: config.enableAutoLearning ?? true,
      similarityMethod: config.similarityMethod || 'weighted',
      maxCacheSize: config.maxCacheSize || 1000,
      enablePersistence: config.enablePersistence ?? true,
    }
  }

  /**
   * 添加案例
   */
  addCase(caseData: HistoricalCase): void {
    this.cases.set(caseData.id, caseData)
    this.featureCache.delete(caseData.id)

    if (this.config.enablePersistence) {
      this.dirtyCases.add(caseData.id)
    }

    // 如果超过最大缓存大小，清理最少使用的案例
    if (this.cases.size > this.config.maxCacheSize) {
      this.evictLeastUsed()
    }
  }

  /**
   * 批量添加案例
   */
  addCases(cases: HistoricalCase[]): void {
    for (const caseData of cases) {
      this.addCase(caseData)
    }
  }

  /**
   * 获取案例
   */
  getCase(id: string): HistoricalCase | undefined {
    return this.cases.get(id)
  }

  /**
   * 获取所有案例
   */
  getAllCases(): HistoricalCase[] {
    return Array.from(this.cases.values())
  }

  /**
   * 查询案例
   */
  queryCases(query: CaseQuery): HistoricalCase[] {
    let results = Array.from(this.cases.values())

    // 按驳回类型过滤
    if (query.rejectionTypes && query.rejectionTypes.length > 0) {
      results = results.filter((caseData) =>
        query.rejectionTypes!.some((type) => caseData.rejectionReasons.some((r) => r.type === type))
      )
    }

    // 按策略过滤
    if (query.strategy) {
      results = results.filter((caseData) => caseData.strategy === query.strategy)
    }

    // 按结果过滤
    if (query.outcome) {
      results = results.filter((caseData) => caseData.outcome === query.outcome)
    }

    // 按技术领域过滤
    if (query.technicalField) {
      results = results.filter((caseData) => caseData.technicalField === query.technicalField)
    }

    // 按审查员过滤
    if (query.examiner) {
      results = results.filter((caseData) => caseData.examiner === query.examiner)
    }

    // 按日期范围过滤
    if (query.dateRange) {
      results = results.filter((caseData) => {
        const caseDate = new Date(caseData.date)
        return caseDate >= query.dateRange!.start && caseDate <= query.dateRange!.end
      })
    }

    // 按IPC分类号过滤
    if (query.ipcClassifications && query.ipcClassifications.length > 0) {
      results = results.filter((caseData) =>
        query.ipcClassifications!.some((ipc) =>
          caseData.ipcClassifications?.some((caseIpc) => caseIpc.startsWith(ipc))
        )
      )
    }

    // 按标签过滤
    if (query.tags && query.tags.length > 0) {
      results = results.filter((caseData) => query.tags!.some((tag) => caseData.tags.includes(tag)))
    }

    // 按相似度过滤
    if (query.minSimilarity && query.minSimilarity > 0) {
      // 需要提供参考案例，这里返回空结果
      // 实际使用时应该使用 findSimilarCases 方法
    }

    return results
  }

  /**
   * 查找相似案例
   */
  findSimilarCases(
    parseResult: OAParseResult,
    strategy?: ResponseStrategy,
    limit: number = 10
  ): CaseSimilarity[] {
    const similarities: CaseSimilarity[] = []

    for (const caseData of this.cases.values()) {
      // 如果指定了策略，只匹配相同策略的案例
      if (strategy && caseData.strategy !== strategy) {
        continue
      }

      const similarity = this.calculateSimilarity(parseResult, caseData)

      if (similarity.similarity > 0) {
        similarities.push(similarity)
      }
    }

    // 按相似度排序并返回前N个
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
  }

  /**
   * 计算相似度
   */
  calculateSimilarity(parseResult: OAParseResult, caseData: HistoricalCase): CaseSimilarity {
    const matchingFactors: string[] = []
    let similarity = 0
    let totalWeight = 0

    // 1. 驳回类型相似度 (权重: 0.35)
    const parseTypes = new Set(parseResult.rejectionTypes)
    const caseTypes = new Set(caseData.rejectionReasons.map((r) => r.type))
    const typeIntersection = [...parseTypes].filter((t) => caseTypes.has(t))
    const typeUnion = new Set([...parseTypes, ...caseTypes])

    const unionSize = typeUnion.size
    if (unionSize > 0) {
      const typeSimilarity = typeIntersection.length / unionSize
      similarity += typeSimilarity * 0.35
      totalWeight += 0.35

      if (typeIntersection.length > 0) {
        matchingFactors.push(`驳回类型匹配: ${[...typeIntersection].join(', ')}`)
      }
    }

    // 2. 权利要求数量相似度 (权重: 0.15)
    const claimDiff = Math.abs(
      parseResult.affectedClaims.length - (caseData.grantedClaims?.length || 0)
    )
    const claimSimilarity = Math.max(0, 1 - claimDiff / 10)
    similarity += claimSimilarity * 0.15
    totalWeight += 0.15

    // 3. 引用文献数量相似度 (权重: 0.10)
    const refDiff = Math.abs(parseResult.citedReferences.length - caseData.rejectionReasons.length)
    const refSimilarity = Math.max(0, 1 - refDiff / 5)
    similarity += refSimilarity * 0.1
    totalWeight += 0.1

    // 4. 技术领域相似度 (权重: 0.15)
    const parseField = this.inferTechnicalField(parseResult)
    if (parseField && caseData.technicalField) {
      if (parseField === caseData.technicalField) {
        similarity += 0.15
        matchingFactors.push(`技术领域匹配: ${parseField}`)
      }
      totalWeight += 0.15
    }

    // 5. 严重程度相似度 (权重: 0.15)
    const parseSeverity = this.calculateAverageSeverity(parseResult.rejectionReasons)
    const caseSeverity = this.calculateAverageSeverity(caseData.rejectionReasons)
    const severitySimilarity = 1 - Math.abs(parseSeverity - caseSeverity) / 2
    similarity += severitySimilarity * 0.15
    totalWeight += 0.15

    // 6. 可克服性相似度 (权重: 0.10)
    const parseOvercome = this.calculateAverageOvercome(parseResult.rejectionReasons)
    const caseOvercome = this.calculateAverageOvercome(caseData.rejectionReasons)
    const overcomeSimilarity = 1 - Math.abs(parseOvercome - caseOvercome) / 100
    similarity += overcomeSimilarity * 0.1
    totalWeight += 0.1

    // 归一化
    const normalizedSimilarity = totalWeight > 0 ? similarity / totalWeight : 0

    return {
      case: caseData,
      similarity: normalizedSimilarity,
      matchingFactors,
    }
  }

  /**
   * 推断技术领域
   */
  private inferTechnicalField(parseResult: OAParseResult): string | undefined {
    const title = parseResult.patentTitle.toLowerCase()

    for (const [field, keywords] of Object.entries(this.getFieldKeywords())) {
      if (keywords.some((kw) => title.includes(kw))) {
        return field
      }
    }

    return '其他'
  }

  /**
   * 获取技术领域关键词
   */
  private getFieldKeywords(): Record<string, string[]> {
    return {
      电子通信: ['通信', '网络', '信号', '天线', '基站', '5g', '6g', '无线'],
      计算机软件: ['软件', '程序', '算法', '数据', '计算', 'ai', '人工智能', '机器学习'],
      机械制造: ['机械', '装置', '设备', '机构', '传动', '加工', '制造'],
      化学材料: ['化学', '材料', '组合物', '合成', '反应', '催化剂'],
      医疗器械: ['医疗', '治疗', '诊断', '医用', '药物'],
      汽车工程: ['汽车', '车辆', '驾驶', '制动', '转向'],
    }
  }

  /**
   * 计算平均严重程度
   */
  private calculateAverageSeverity(
    rejections: Array<{ severity: 'high' | 'medium' | 'low' }>
  ): number {
    if (rejections.length === 0) return 1 // medium

    const severityMap = { high: 2, medium: 1, low: 0 }
    const sum = rejections.reduce((acc, r) => acc + severityMap[r.severity], 0)
    return sum / rejections.length
  }

  /**
   * 计算平均可克服性
   */
  private calculateAverageOvercome(rejections: Array<{ overcomeProbability?: number }>): number {
    const validRejections = rejections.filter((r) => r.overcomeProbability !== undefined)
    if (validRejections.length === 0) return 50

    const sum = validRejections.reduce((acc, r) => acc + (r.overcomeProbability || 50), 0)
    return sum / validRejections.length
  }

  /**
   * 提取案例特征
   */
  private extractFeatures(caseData: HistoricalCase): CaseFeatures {
    // 检查缓存
    const cached = this.featureCache.get(caseData.id)
    if (cached) {
      return cached
    }

    // 驳回类型向量 (one-hot编码)
    const rejectionTypeVector = new Array(10).fill(0)
    for (const rejection of caseData.rejectionReasons) {
      const index = REJECTION_TYPE_INDEX[rejection.type]
      if (index !== undefined) {
        rejectionTypeVector[index] = 1
      }
    }

    // 严重程度向量
    const severityCounts = { high: 0, medium: 0, low: 0 }
    for (const rejection of caseData.rejectionReasons) {
      severityCounts[rejection.severity]++
    }
    const total = caseData.rejectionReasons.length || 1
    const severityVector = [
      severityCounts.high / total,
      severityCounts.medium / total,
      severityCounts.low / total,
    ]

    // 策略编码
    const strategyCode = this.encodeStrategy(caseData.strategy)

    // 技术领域编码
    const fieldCode = TECHNICAL_FIELDS[caseData.technicalField || '其他'] || 6

    const features: CaseFeatures = {
      rejectionTypeVector,
      severityVector,
      claimCount: caseData.grantedClaims?.length || 0,
      referenceCount: caseData.rejectionReasons.length,
      strategyCode,
      fieldCode,
    }

    // 缓存特征
    this.featureCache.set(caseData.id, features)

    return features
  }

  /**
   * 编码策略
   */
  private encodeStrategy(strategy: ResponseStrategy): number {
    const codes: Record<ResponseStrategy, number> = {
      [ResponseStrategy.ARGUE]: 0,
      [ResponseStrategy.AMEND]: 1,
      [ResponseStrategy.BOTH]: 2,
      [ResponseStrategy.ABANDON]: 3,
      [ResponseStrategy.APPEAL]: 4,
    }
    return codes[strategy]
  }

  /**
   * 学习成功模式
   */
  learnSuccessPatterns(): {
    commonStrategies: Map<ResponseStrategy, number>
    effectiveArguments: Map<RejectionType, ResponseArgument[]>
    successfulAmendments: AmendmentSuggestion[]
    insights: string[]
  } {
    const successCases = this.getAllCases().filter(
      (c) => c.outcome === 'success' || c.outcome === 'partial_success'
    )

    // 统计常用策略
    const commonStrategies = new Map<ResponseStrategy, number>()
    for (const caseData of successCases) {
      commonStrategies.set(caseData.strategy, (commonStrategies.get(caseData.strategy) || 0) + 1)
    }

    // 提取有效论点
    const effectiveArguments = new Map<RejectionType, ResponseArgument[]>()
    for (const caseData of successCases) {
      for (const arg of caseData.arguments) {
        if (arg.strength && arg.strength >= 4) {
          const args = effectiveArguments.get(arg.targetRejection) || []
          args.push(arg)
          effectiveArguments.set(arg.targetRejection, args)
        }
      }
    }

    // 提取成功修改
    const successfulAmendments: AmendmentSuggestion[] = []
    for (const caseData of successCases) {
      if (caseData.amendments) {
        successfulAmendments.push(...caseData.amendments)
      }
    }

    // 生成洞察
    const insights = this.generateInsights(successCases)

    return {
      commonStrategies,
      effectiveArguments,
      successfulAmendments,
      insights,
    }
  }

  /**
   * 生成洞察
   */
  private generateInsights(successCases: HistoricalCase[]): string[] {
    const insights: string[] = []

    // 计算平均成功率
    const totalCases = this.cases.size
    const successCount = successCases.length
    if (totalCases > 0) {
      const successRate = (successCount / totalCases) * 100
      insights.push(`总体成功率: ${successRate.toFixed(1)}%`)
    }

    // 分析最成功的策略
    const strategySuccess = new Map<ResponseStrategy, { total: number; success: number }>()
    for (const caseData of this.cases.values()) {
      const stats = strategySuccess.get(caseData.strategy) || { total: 0, success: 0 }
      stats.total++
      if (caseData.outcome === 'success' || caseData.outcome === 'partial_success') {
        stats.success++
      }
      strategySuccess.set(caseData.strategy, stats)
    }

    let bestStrategy: ResponseStrategy | null = null
    let bestRate = 0
    for (const [strategy, stats] of strategySuccess) {
      if (stats.total >= 5) {
        const rate = stats.success / stats.total
        if (rate > bestRate) {
          bestRate = rate
          bestStrategy = strategy
        }
      }
    }

    if (bestStrategy) {
      insights.push(`最成功策略: ${bestStrategy} (成功率: ${(bestRate * 100).toFixed(1)}%)`)
    }

    // 分析最常被驳回的类型
    const rejectionCounts = new Map<RejectionType, number>()
    for (const caseData of this.cases.values()) {
      for (const rejection of caseData.rejectionReasons) {
        rejectionCounts.set(rejection.type, (rejectionCounts.get(rejection.type) || 0) + 1)
      }
    }

    const sortedRejections = [...rejectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

    if (sortedRejections.length > 0) {
      insights.push(
        `最常见驳回类型: ${sortedRejections.map(([type, count]) => `${type}(${count})`).join(', ')}`
      )
    }

    return insights
  }

  /**
   * 从成功案例中提取模板
   */
  extractTemplates(): Array<{
    rejectionType: RejectionType
    template: string
    usageCount: number
    successRate: number
  }> {
    const templates: Array<{
      rejectionType: RejectionType
      template: string
      usageCount: number
      successRate: number
    }> = []

    // 按驳回类型分组
    const byRejectionType = new Map<RejectionType, HistoricalCase[]>()
    for (const caseData of this.cases.values()) {
      for (const rejection of caseData.rejectionReasons) {
        const cases = byRejectionType.get(rejection.type) || []
        cases.push(caseData)
        byRejectionType.set(rejection.type, cases)
      }
    }

    // 为每种驳回类型提取模板
    for (const [rejectionType, cases] of byRejectionType) {
      const successCases = cases.filter(
        (c) => c.outcome === 'success' || c.outcome === 'partial_success'
      )

      if (successCases.length >= 3) {
        // 提取常用论点模式
        const argumentPatterns = new Map<string, number>()
        for (const caseData of successCases) {
          for (const arg of caseData.arguments) {
            if (arg.targetRejection === rejectionType) {
              argumentPatterns.set(arg.argument, (argumentPatterns.get(arg.argument) || 0) + 1)
            }
          }
        }

        // 找出最常用的论点作为模板
        const sortedPatterns = [...argumentPatterns.entries()].sort((a, b) => b[1] - a[1])

        for (const [pattern, count] of sortedPatterns.slice(0, 2)) {
          templates.push({
            rejectionType,
            template: pattern,
            usageCount: count,
            successRate: successCases.length / cases.length,
          })
        }
      }
    }

    return templates
  }

  /**
   * 淘汰最少使用的案例
   */
  private evictLeastUsed(): void {
    let minUsage = Infinity
    let evictId: string | null = null

    for (const [id, caseData] of this.cases) {
      // 简单的使用频率估算：基于日期
      const age = Date.now() - new Date(caseData.date).getTime()
      if (age > minUsage) {
        minUsage = age
        evictId = id
      }
    }

    if (evictId) {
      this.cases.delete(evictId)
      this.featureCache.delete(evictId)
      this.dirtyCases.delete(evictId)
    }
  }

  /**
   * 删除案例
   */
  removeCase(id: string): boolean {
    const deleted = this.cases.delete(id)
    if (deleted) {
      this.featureCache.delete(id)
      this.dirtyCases.delete(id)
    }
    return deleted
  }

  /**
   * 清空所有案例
   */
  clear(): void {
    this.cases.clear()
    this.featureCache.clear()
    this.dirtyCases.clear()
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCases: number
    successRate: number
    casesByStrategy: Map<ResponseStrategy, number>
    casesByRejectionType: Map<RejectionType, number>
    casesByOutcome: Map<string, number>
    cacheSize: number
  } {
    const successCases = Array.from(this.cases.values()).filter(
      (c) => c.outcome === 'success' || c.outcome === 'partial_success'
    )

    const casesByStrategy = new Map<ResponseStrategy, number>()
    const casesByRejectionType = new Map<RejectionType, number>()
    const casesByOutcome = new Map<string, number>()

    for (const caseData of this.cases.values()) {
      // 按策略统计
      casesByStrategy.set(caseData.strategy, (casesByStrategy.get(caseData.strategy) || 0) + 1)

      // 按驳回类型统计
      for (const rejection of caseData.rejectionReasons) {
        casesByRejectionType.set(
          rejection.type,
          (casesByRejectionType.get(rejection.type) || 0) + 1
        )
      }

      // 按结果统计
      casesByOutcome.set(caseData.outcome, (casesByOutcome.get(caseData.outcome) || 0) + 1)
    }

    return {
      totalCases: this.cases.size,
      successRate: this.cases.size > 0 ? successCases.length / this.cases.size : 0,
      casesByStrategy,
      casesByRejectionType,
      casesByOutcome,
      cacheSize: this.featureCache.size,
    }
  }

  /**
   * 导出案例数据
   */
  exportCases(includeFeatures = false): string {
    const data: Record<string, any> = {
      cases: Array.from(this.cases.values()),
    }

    if (includeFeatures) {
      data.features = Array.from(this.featureCache.entries())
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * 导入案例数据
   */
  importCases(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData)

      if (Array.isArray(data.cases)) {
        for (const caseData of data.cases) {
          // 转换日期字符串为Date对象
          if (typeof caseData.date === 'string') {
            caseData.date = new Date(caseData.date)
          }
          this.addCase(caseData)
        }
      }

      if (Array.isArray(data.features)) {
        for (const [id, features] of data.features) {
          this.featureCache.set(id, features as CaseFeatures)
        }
      }
    } catch (error) {
      throw new Error(`导入案例失败: ${error}`)
    }
  }

  /**
   * 保存到文件
   */
  async saveToFile(filePath?: string): Promise<void> {
    const path = filePath || this.config.storagePath
    if (!path) {
      throw new Error('未指定存储路径')
    }

    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs/promises')
      const content = this.exportCases(true)
      await fs.writeFile(path, content, 'utf-8')
      this.dirtyCases.clear()
    } else {
      throw new Error('文件保存功能仅在 Node.js 环境中可用')
    }
  }

  /**
   * 从文件加载
   */
  async loadFromFile(filePath?: string): Promise<void> {
    const path = filePath || this.config.storagePath
    if (!path) {
      throw new Error('未指定存储路径')
    }

    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs/promises')
      const content = await fs.readFile(path, 'utf-8')
      this.importCases(content)
    } else {
      throw new Error('文件加载功能仅在 Node.js 环境中可用')
    }
  }

  /**
   * 创建新案例ID
   */
  generateCaseId(): string {
    return `case-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 从答复结果创建案例
   */
  createCaseFromResponse(
    parseResult: OAParseResult,
    strategy: ResponseStrategy,
    responseArguments: ResponseArgument[],
    amendments: AmendmentSuggestion[],
    outcome: 'success' | 'partial_success' | 'failure',
    metadata?: {
      examiner?: string
      technicalField?: string
      ipcClassifications?: string[]
      round?: number
      grantedClaims?: number[]
    }
  ): HistoricalCase {
    return {
      id: this.generateCaseId(),
      applicationNumber: parseResult.applicationNumber,
      patentTitle: parseResult.patentTitle,
      officeActionSummary: parseResult.summary,
      rejectionReasons: parseResult.rejectionReasons,
      strategy,
      arguments: responseArguments,
      amendments,
      outcome,
      round: metadata?.round || 1,
      tags: [],
      date: new Date(),
      examiner: metadata?.examiner || parseResult.examiner,
      technicalField: metadata?.technicalField || this.inferTechnicalField(parseResult),
      ipcClassifications: metadata?.ipcClassifications,
      grantedClaims: metadata?.grantedClaims,
    }
  }
}

/**
 * 创建默认案例学习器实例
 */
export function createCaseLearner(config?: CaseLearnerConfig): CaseLearner {
  return new CaseLearner(config)
}
