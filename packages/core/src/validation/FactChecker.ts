/**
 * 事实验证器 (FactChecker)
 *
 * 用于验证LLM生成内容中的事实声明，确保技术事实、法律判例、统计数据的准确性
 */

import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import {
  Claim,
  ClaimCategory,
  FactCheckResult,
  SourceReference,
  SourceType,
  FactCheckerConfig,
} from './hallucination-types.js'
import {
  ExternalFactChecker,
  ExternalFactCheckOptions,
  ExternalFactCheckResult,
  AggregatedFactCheck,
  aggregateResults,
  calculateConsensus,
  getSourceWeight,
  FactCheckError,
} from './ExternalFactChecker.js'

/**
 * 事实验证器
 */
export class FactChecker {
  private llm: LLMAdapter
  private knowledgeBase: KnowledgeBase
  private config: FactCheckerConfig
  private externalChecker?: ExternalFactChecker

  constructor(llm: LLMAdapter, knowledgeBase: KnowledgeBase, config?: Partial<FactCheckerConfig>) {
    this.llm = llm
    this.knowledgeBase = knowledgeBase
    this.config = {
      extractionMethod: 'hybrid',
      verificationMethods: ['knowledge_base'],
      knowledgeBaseOptions: {
        maxResults: 5,
        similarityThreshold: 0.85,
      },
      ...config,
    }

    // 初始化外部验证器（如果配置中启用）
    if (this.config.verificationMethods.includes('external_api')) {
      this.externalChecker = new ExternalFactChecker(
        this.config.externalAPIConfig as
          | { apiKey?: string; enableCache?: boolean; cacheTTL?: number }
          | undefined
      )
    }
  }

  /**
   * 验证内容中的所有声明
   *
   * @param content 要验证的内容
   * @returns 事实验证结果列表
   */
  async verifyContent(content: string): Promise<FactCheckResult[]> {
    // 1. 提取声明
    const claims = await this.extractClaims(content)

    // 2. 验证每个声明
    const results: FactCheckResult[] = []
    for (const claim of claims) {
      const result = await this.verifyClaim(claim)
      results.push(result)
    }

    return results
  }

  /**
   * 提取内容中的声明
   *
   * @param content 内容文本
   * @returns 提取的声明列表
   */
  private async extractClaims(content: string): Promise<Claim[]> {
    // const claims: Claim[] = []; // 未使用，已移除
    // const claimId = 0; // 未使用，已移除

    // 根据配置选择提取方法
    if (this.config.extractionMethod === 'regex') {
      return this.extractClaimsByRegex(content)
    } else if (this.config.extractionMethod === 'llm') {
      return await this.extractClaimsByLLM(content)
    } else {
      // 混合方法：先用正则提取，再用LLM过滤和增强
      const regexClaims = this.extractClaimsByRegex(content)
      const llmClaims = await this.extractClaimsByLLM(content)

      // 合并去重
      const combined = [...regexClaims]
      for (const llmClaim of llmClaims) {
        const isDuplicate = regexClaims.some(
          (rc) => rc.content.toLowerCase() === llmClaim.content.toLowerCase()
        )
        if (!isDuplicate) {
          combined.push(llmClaim)
        }
      }

      return combined
    }
  }

  /**
   * 使用正则表达式提取声明
   *
   * @param content 内容文本
   * @returns 提取的声明列表
   */
  private extractClaimsByRegex(content: string): Claim[] {
    const claims: Claim[] = []
    let claimId = 0

    // 匹配可能包含事实声明的句子模式
    const patterns = [
      // 技术参数声明
      /(?:根据|按照|依据)[^。]*?(标准|规范|规定)[^。]*?为[：:][^。]+/g,

      // 统计数据
      /\d+[%％][^。]*?(的)?[^。]*?(增长|下降|提高|降低)/g,

      // 法律引用
      /(?:根据|按照|依据)[^。]*?(专利法|商标法|著作权法)[^。]*?第\d+条/g,

      // 技术事实
      /(?:该|本)(?:发明|技术|方法|系统)[^。]*?(包括|包含|采用|使用)[^。]+/g,

      // 领域知识
      /(?:在|对于)[^。]*?(领域|行业)[^。]*?(中|内)[^。]*?(通常|一般|典型)[^。]+/g,
    ]

    const lines = content.split('\n')
    let currentPosition = 0

    for (const line of lines) {
      const lineStart = currentPosition
      const lineEnd = currentPosition + line.length

      for (const pattern of patterns) {
        const matches = line.match(pattern)
        if (matches) {
          for (const match of matches) {
            const start = line.indexOf(match)
            const end = start + match.length

            claims.push({
              id: `claim-${claimId++}`,
              content: match,
              category: this.categorizeClaim(match),
              confidence: 0.7, // 正则提取的置信度较低
              location: {
                start: lineStart + start,
                end: lineStart + end,
                text: match,
              },
            })
          }
        }
      }

      currentPosition = lineEnd + 1 // +1 for newline
    }

    return claims
  }

  /**
   * 使用LLM提取声明
   *
   * @param content 内容文本
   * @returns 提取的声明列表
   */
  private async extractClaimsByLLM(content: string): Promise<Claim[]> {
    const prompt = `请从以下文本中提取所有需要验证的事实声明，包括技术参数、统计数据、法律引用等。

文本内容：
${content}

请以JSON格式返回，格式如下：
[
  {
    "content": "声明内容",
    "category": "legal_precedent|technical_fact|statistical_data|domain_knowledge",
    "confidence": 0.9
  }
]

只返回JSON，不要有其他内容。`

    try {
      const response = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content: '你是一个专业的事实声明提取助手，擅长识别需要验证的事实性陈述。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      })

      const parsed = JSON.parse(response.message.content)

      return parsed.map((item: unknown, index: number) => ({
        id: `claim-llm-${index}`,
        content: (item as any).content,
        category: this.parseClaimCategory((item as any).category),
        confidence: (item as any).confidence || 0.8,
      }))
    } catch (error) {
      console.error('LLM声明提取失败:', error)
      return []
    }
  }

  /**
   * 验证单个声明
   *
   * @param claim 要验证的声明
   * @returns 事实验证结果
   */
  private async verifyClaim(claim: Claim): Promise<FactCheckResult> {
    const results: FactCheckResult[] = []

    // 使用配置的验证方法
    for (const method of this.config.verificationMethods) {
      if (method === 'knowledge_base') {
        const result = await this.verifyWithKnowledgeBase(claim)
        results.push(result)
      } else if (method === 'external_api') {
        try {
          const result = await this.verifyWithExternalAPI(claim)
          results.push(result)
        } catch (error) {
          console.warn('外部API验证失败:', error)
        }
      }
    }

    // 合并多个验证方法的结果
    return this.mergeVerificationResults(claim, results)
  }

  /**
   * 使用知识库验证声明
   *
   * @param claim 要验证的声明
   * @returns 事实验证结果
   */
  private async verifyWithKnowledgeBase(claim: Claim): Promise<FactCheckResult> {
    try {
      // 在知识库中搜索相关内容
      const searchResults = await this.knowledgeBase.search(claim.content, {
        limit: this.config.knowledgeBaseOptions?.maxResults || 5,
        minSimilarity: this.config.knowledgeBaseOptions?.similarityThreshold || 0.85,
      })

      if (searchResults.length === 0) {
        // 未找到匹配结果
        return {
          claim,
          isVerifiable: true,
          isVerified: false,
          confidence: 0.3,
          sources: [],
          verificationMethod: 'knowledge_base',
          details: '在知识库中未找到相关内容',
        }
      }

      // 找到了相关结果
      const sources: SourceReference[] = searchResults.map((result) => ({
        id: result.entry.id,
        type: SourceType.KNOWLEDGE_ENTRY,
        title: result.entry.title || result.entry.content.substring(0, 50),
        credibility: (result.entry.priority || 5) / 10,
        lastVerified: new Date(),
      }))

      // 计算验证置信度
      const maxSimilarity = Math.max(...searchResults.map((r) => r.score || 0))
      const confidence = maxSimilarity

      return {
        claim,
        isVerifiable: true,
        isVerified: confidence >= (this.config.knowledgeBaseOptions?.similarityThreshold || 0.85),
        confidence,
        sources,
        verificationMethod: 'knowledge_base',
        details: `找到 ${searchResults.length} 个相关知识条目`,
      }
    } catch (error) {
      console.error('知识库验证失败:', error)
      return {
        claim,
        isVerifiable: false,
        isVerified: false,
        confidence: 0,
        sources: [],
        verificationMethod: 'knowledge_base',
        details: `验证失败: ${error}`,
      }
    }
  }

  /**
   * 合并多个验证方法的结果
   *
   * @param claim 原始声明
   * @param results 多个验证方法的结果
   * @returns 合并后的验证结果
   */
  private mergeVerificationResults(claim: Claim, results: FactCheckResult[]): FactCheckResult {
    if (results.length === 0) {
      return {
        claim,
        isVerifiable: false,
        isVerified: false,
        confidence: 0,
        sources: [],
        verificationMethod: 'knowledge_base',
        details: '没有可用的验证方法',
      }
    }

    if (results.length === 1) {
      return results[0]
    }

    // 多个验证方法：选择置信度最高的结果
    const sortedResults = results.sort((a, b) => b.confidence - a.confidence)
    const bestResult = sortedResults[0]

    // 合并所有来源
    const allSources: SourceReference[] = []
    for (const result of results) {
      allSources.push(...result.sources)
    }

    return {
      ...bestResult,
      sources: allSources,
      details: `合并了 ${results.length} 种验证方法的结果`,
    }
  }

  /**
   * 对声明进行分类
   *
   * @param content 声明内容
   * @returns 声明类别
   */
  private categorizeClaim(content: string): ClaimCategory {
    const lowerContent = content.toLowerCase()

    // 法律相关
    if (
      lowerContent.includes('专利法') ||
      lowerContent.includes('商标法') ||
      lowerContent.includes('著作权法') ||
      (lowerContent.includes('第') && lowerContent.includes('条'))
    ) {
      return ClaimCategory.LEGAL_PRECEDENT
    }

    // 统计数据
    if (
      /\d+[%％]/.test(content) ||
      lowerContent.includes('增长') ||
      lowerContent.includes('下降') ||
      lowerContent.includes('提高') ||
      lowerContent.includes('降低')
    ) {
      return ClaimCategory.STATISTICAL_DATA
    }

    // 技术标准
    if (
      lowerContent.includes('标准') ||
      lowerContent.includes('规范') ||
      lowerContent.includes('规定') ||
      lowerContent.includes('gb/') ||
      lowerContent.includes('iso/')
    ) {
      return ClaimCategory.TECHNICAL_FACT
    }

    // 领域知识
    if (
      lowerContent.includes('领域') ||
      lowerContent.includes('行业') ||
      lowerContent.includes('通常') ||
      lowerContent.includes('一般')
    ) {
      return ClaimCategory.DOMAIN_KNOWLEDGE
    }

    // 默认为一般陈述
    return ClaimCategory.GENERAL_STATEMENT
  }

  /**
   * 解析声明类别
   *
   * @param category 类别字符串
   * @returns 声明类别枚举
   */
  private parseClaimCategory(category: string): ClaimCategory {
    const categoryMap: Record<string, ClaimCategory> = {
      legal_precedent: ClaimCategory.LEGAL_PRECEDENT,
      technical_fact: ClaimCategory.TECHNICAL_FACT,
      statistical_data: ClaimCategory.STATISTICAL_DATA,
      domain_knowledge: ClaimCategory.DOMAIN_KNOWLEDGE,
      general_statement: ClaimCategory.GENERAL_STATEMENT,
    }

    return categoryMap[category] || ClaimCategory.GENERAL_STATEMENT
  }

  /**
   * 批量验证声明
   *
   * @param claims 声明列表
   * @returns 事实验证结果列表
   */
  async verifyClaims(claims: Claim[]): Promise<FactCheckResult[]> {
    const results: FactCheckResult[] = []

    // 并发验证（限制并发数）
    const concurrency = 5
    for (let i = 0; i < claims.length; i += concurrency) {
      const batch = claims.slice(i, i + concurrency)
      const batchResults = await Promise.all(batch.map((claim) => this.verifyClaim(claim)))
      results.push(...batchResults)
    }

    return results
  }

  /**
   * 获取事实验证统计
   *
   * @param results 验证结果列表
   * @returns 统计信息
   */
  getFactCheckStats(results: FactCheckResult[]): {
    total: number
    verifiable: number
    verified: number
    unverified: number
    verificationRate: number
    avgConfidence: number
  } {
    const verifiable = results.filter((r) => r.isVerifiable)
    const verified = results.filter((r) => r.isVerified)
    const unverified = results.filter((r) => r.isVerifiable && !r.isVerified)

    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0)

    return {
      total: results.length,
      verifiable: verifiable.length,
      verified: verified.length,
      unverified: unverified.length,
      verificationRate: verifiable.length > 0 ? verified.length / verifiable.length : 0,
      avgConfidence: results.length > 0 ? totalConfidence / results.length : 0,
    }
  }

  /**
   * 使用外部 API 验证声明
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 事实验证结果
   */
  async verifyWithExternalAPI(
    claim: Claim,
    options?: ExternalFactCheckOptions
  ): Promise<FactCheckResult> {
    if (!this.externalChecker) {
      throw new FactCheckError('外部 API 未启用', undefined, 'FactChecker')
    }

    const externalResult = await this.externalChecker.verifyClaim(claim.content, options)

    // 转换为 FactCheckResult 格式
    return {
      claim,
      isVerifiable: externalResult.isValid !== 'UNKNOWN',
      isVerified: externalResult.isValid === 'TRUE',
      confidence: externalResult.confidence,
      sources: externalResult.sources.map((s) => ({
        id: s.url,
        type: SourceType.EXTERNAL_API,
        title: s.name,
        url: s.url,
        credibility: this.calculateSourceCredibility(externalResult.isValid),
        lastVerified: new Date(s.date || Date.now()),
      })),
      verificationMethod: 'external_api',
      details: `外部 API 验证结果: ${externalResult.isValid}`,
    }
  }

  /**
   * 多源交叉验证
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 聚合验证结果
   */
  async verifyCrossSources(
    claim: Claim,
    options?: ExternalFactCheckOptions
  ): Promise<AggregatedFactCheck> {
    const results: ExternalFactCheckResult[] = []

    // 1. 知识库验证
    try {
      const kbResult = await this.getKnowledgeBaseResult(claim)
      if (kbResult) {
        results.push(kbResult)
      }
    } catch (error) {
      console.warn('知识库验证失败:', error)
    }

    // 2. 外部 API 验证
    if (this.externalChecker) {
      try {
        const externalResult = await this.externalChecker.verifyClaim(claim.content, options)
        results.push(externalResult)
      } catch (error) {
        console.warn('外部 API 验证失败:', error)
      }
    }

    // 3. 聚合结果
    return aggregateResults(results)
  }

  /**
   * 获取知识库验证结果（转换为外部结果格式）
   *
   * @param claim 声明
   * @returns 外部验证结果或 undefined
   */
  private async getKnowledgeBaseResult(claim: Claim): Promise<ExternalFactCheckResult | undefined> {
    const kbResult = await this.verifyWithKnowledgeBase(claim)

    if (!kbResult.isVerifiable || kbResult.sources.length === 0) {
      return undefined
    }

    return {
      claim: claim.content,
      isValid: kbResult.isVerified ? 'TRUE' : 'FALSE',
      confidence: kbResult.confidence,
      sources: kbResult.sources.map((s) => ({
        name: s.title,
        url: s.url || '',
        rating: kbResult.isVerified ? 'Verified' : 'Unverified',
        date: s.lastVerified?.toISOString(),
      })),
      source: 'knowledge_base',
      timestamp: new Date(),
    }
  }

  /**
   * 计算来源可信度
   *
   * @param isValid 验证状态
   * @returns 可信度分数
   */
  private calculateSourceCredibility(isValid: 'TRUE' | 'FALSE' | 'MIXED' | 'UNKNOWN'): number {
    switch (isValid) {
      case 'TRUE':
        return 0.9
      case 'MIXED':
        return 0.5
      case 'FALSE':
        return 0.1
      default:
        return 0
    }
  }

  /**
   * 批量外部验证
   *
   * @param claims 声明列表
   * @param options 验证选项
   * @returns 验证结果列表
   */
  async verifyClaimsWithExternalAPI(
    claims: Claim[],
    options?: ExternalFactCheckOptions
  ): Promise<FactCheckResult[]> {
    if (!this.externalChecker) {
      throw new FactCheckError('外部 API 未启用', undefined, 'FactChecker')
    }

    const externalResults = await this.externalChecker.verifyClaims(
      claims.map((c) => c.content),
      options
    )

    return externalResults.map((result, index) => ({
      claim: claims[index],
      isVerifiable: result.isValid !== 'UNKNOWN',
      isVerified: result.isValid === 'TRUE',
      confidence: result.confidence,
      sources: result.sources.map((s) => ({
        id: s.url,
        type: SourceType.EXTERNAL_API,
        title: s.name,
        url: s.url,
        credibility: this.calculateSourceCredibility(result.isValid),
        lastVerified: new Date(s.date || Date.now()),
      })),
      verificationMethod: 'external_api',
      details: `外部 API 验证结果: ${result.isValid}`,
    }))
  }

  /**
   * 获取外部验证器状态
   *
   * @returns 状态信息
   */
  getExternalCheckerStatus(): {
    enabled: boolean
    configured: boolean
    cacheStats?: { size: number; keys: string[] }
  } {
    const enabled = this.config.verificationMethods.includes('external_api')
    const configured = !!this.externalChecker

    return {
      enabled,
      configured,
      cacheStats: this.externalChecker?.getCacheStats(),
    }
  }

  /**
   * 清除外部验证缓存
   */
  clearExternalCache(): void {
    this.externalChecker?.clearCache()
  }
}
