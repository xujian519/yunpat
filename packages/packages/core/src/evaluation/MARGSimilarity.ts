/**
 * MARGSimilarity - 多维度推理图专利相似度评估
 *
 * 将专利相似度分解为三个维度：
 * - 技术特征
 * - 应用领域
 * - 权利范围
 *
 * 四阶段推理流程：
 * 1. 领域关系分析 — 评估两个专利技术领域之间的关联性
 * 2. 信息分布分析 — 分析各维度信息在专利文档中的分布密度
 * 3. 维度相关性评估 — 根据专利类型动态调整各维度权重
 * 4. 交叉验证推理 — 综合所有维度信息进行最终相似度判断
 *
 * 参考：PatentMind (arXiv:2505.19347)
 * Pearson 相关达 0.938（与专家评估一致）
 */

/**
 * 专利信息接口
 */
export interface PatentInfo {
  /** 专利标题 */
  title?: string
  /** 摘要 */
  abstract?: string
  /** 权利要求列表 */
  claims?: string[]
  /** IPC 分类号 */
  ipcCodes?: string[]
  /** CPC 分类号 */
  cpcCodes?: string[]
  /** 技术领域描述 */
  technicalField?: string
}

/**
 * 维度评分接口
 */
export interface DimensionScore {
  /** 评分 0-1 */
  score: number
  /** 评估理由 */
  reasoning: string
  /** 关键特征 */
  keyFeatures?: string[]
}

/**
 * 权利范围分析结果
 */
export interface ClaimScopeAnalysis {
  /** 权利要求数量 */
  count: number
  /** 独立权利要求比例 */
  independentRatio: number
  /** 平均长度 */
  avgLength: number
}

/**
 * MARG 结果接口
 */
export interface MARGResult {
  /** 总体相似度 0-1 */
  overallSimilarity: number
  /** 各维度评分 */
  dimensions: {
    /** 技术特征维度 */
    technical: DimensionScore
    /** 应用领域维度 */
    application: DimensionScore
    /** 权利范围维度 */
    claimScope: DimensionScore
  }
  /** 领域关系描述 */
  domainRelation: string
  /** 权重分配 */
  weights: {
    /** 技术维度权重 */
    technical: number
    /** 应用维度权重 */
    application: number
    /** 权利范围维度权重 */
    claimScope: number
  }
  /** 交叉验证说明 */
  crossValidation: string
}

/**
 * 权重配置
 */
export interface WeightConfig {
  technical: number
  application: number
  claimScope: number
}

/**
 * LLM 客户端接口（可选）
 */
export interface LLMClient {
  generate(prompt: string): Promise<string>
}

/**
 * MARGSimilarity - 多维度推理图专利相似度评估器
 */
export class MARGSimilarity {
  private llmClient?: LLMClient

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient
  }

  /**
   * 比较两个专利的相似度
   */
  async compare(patentA: PatentInfo, patentB: PatentInfo): Promise<MARGResult> {
    // 阶段1：领域关系分析
    const domainRelation = await this.analyzeDomainRelation(patentA, patentB)
    const domainSimilarity = this.extractDomainSimilarity(domainRelation)

    // 阶段3：维度相关性评估（动态权重）
    const weights = this.adjustWeights(domainSimilarity)

    // 阶段4：维度评分
    const technicalScore = await this.scoreTechnicalDimension(patentA, patentB)
    const applicationScore = await this.scoreApplicationDimension(patentA, patentB)
    const claimScopeScore = await this.scoreClaimScopeDimension(patentA, patentB)

    // 阶段5：交叉验证
    const crossValidation = this.performCrossValidation(
      technicalScore,
      applicationScore,
      claimScopeScore,
      weights
    )

    // 计算总体相似度
    const overallSimilarity =
      technicalScore.score * weights.technical +
      applicationScore.score * weights.application +
      claimScopeScore.score * weights.claimScope

    return {
      overallSimilarity: Math.min(1, Math.max(0, overallSimilarity)),
      dimensions: {
        technical: technicalScore,
        application: applicationScore,
        claimScope: claimScopeScore,
      },
      domainRelation,
      weights,
      crossValidation,
    }
  }

  /**
   * 阶段1：领域关系分析
   */
  private async analyzeDomainRelation(patentA: PatentInfo, patentB: PatentInfo): Promise<string> {
    const codesA = [...(patentA.ipcCodes || []), ...(patentA.cpcCodes || [])]
    const codesB = [...(patentB.ipcCodes || []), ...(patentB.cpcCodes || [])]

    if (codesA.length === 0 && codesB.length === 0) {
      return '缺少分类信息，无法确定领域关系'
    }

    const similarity = this.compareIPCCodes(codesA, codesB)

    let relation = ''

    if (similarity >= 0.9) {
      relation = '相同技术领域（分类号完全匹配）'
    } else if (similarity >= 0.7) {
      relation = '高度相关领域（同一子类）'
    } else if (similarity >= 0.5) {
      relation = '相关领域（同一大类）'
    } else if (similarity >= 0.3) {
      relation = '邻近领域（跨类相关）'
    } else {
      relation = '不同技术领域'
    }

    // 添加技术领域文本分析
    if (patentA.technicalField && patentB.technicalField) {
      const fieldTermsA = this.extractTechnicalTerms(patentA.technicalField)
      const fieldTermsB = this.extractTechnicalTerms(patentB.technicalField)
      const fieldJaccard = this.computeJaccard(fieldTermsA, fieldTermsB)

      if (fieldJaccard > 0.5) {
        relation += `，技术领域描述高度相关`
      } else if (fieldJaccard > 0.2) {
        relation += `，技术领域描述部分重叠`
      }
    }

    return relation
  }

  /**
   * 从领域关系描述中提取相似度分数
   */
  private extractDomainSimilarity(domainRelation: string): number {
    if (domainRelation.includes('完全匹配')) return 1.0
    if (domainRelation.includes('同一子类')) return 0.8
    if (domainRelation.includes('同一大类')) return 0.5
    if (domainRelation.includes('跨类相关')) return 0.3
    if (domainRelation.includes('缺少分类')) return 0.5
    return 0.2
  }

  /**
   * 阶段3：根据领域关系调整权重
   */
  private adjustWeights(domainSimilarity: number): WeightConfig {
    // 相同领域：技术特征和权利范围更重要
    if (domainSimilarity >= 0.8) {
      return {
        technical: 0.4,
        application: 0.2,
        claimScope: 0.4,
      }
    }

    // 相关领域：平衡各维度
    if (domainSimilarity >= 0.5) {
      return {
        technical: 0.35,
        application: 0.3,
        claimScope: 0.35,
      }
    }

    // 跨领域：应用领域更重要
    if (domainSimilarity >= 0.3) {
      return {
        technical: 0.3,
        application: 0.4,
        claimScope: 0.3,
      }
    }

    // 不同领域：应用领域主导
    return {
      technical: 0.2,
      application: 0.5,
      claimScope: 0.3,
    }
  }

  /**
   * 阶段4a：技术特征维度评分
   */
  private async scoreTechnicalDimension(
    patentA: PatentInfo,
    patentB: PatentInfo
  ): Promise<DimensionScore> {
    // 提取技术术语
    const allTextA = [patentA.title, patentA.abstract, ...(patentA.claims || [])].join(' ')
    const allTextB = [patentB.title, patentB.abstract, ...(patentB.claims || [])].join(' ')

    const termsA = this.extractTechnicalTerms(allTextA)
    const termsB = this.extractTechnicalTerms(allTextB)

    // 计算术语集合相似度（Jaccard）
    const jaccard = this.computeJaccard(termsA, termsB)

    // 如果有 LLM 客户端，可以进行语义增强
    let enhancedScore = jaccard
    let reasoning = `基于术语集合的 Jaccard 相似度: ${(jaccard * 100).toFixed(1)}%`

    if (this.llmClient && termsA.length > 0 && termsB.length > 0) {
      try {
        const prompt = `请评估以下两组技术术语之间的语义相似度（0-1），并简要说明理由：

术语组A: ${termsA.slice(0, 10).join(', ')}
术语组B: ${termsB.slice(0, 10).join(', ')}

返回格式：分数（数字）| 理由（简短描述）`

        const response = await this.llmClient.generate(prompt)
        const parts = response.split('|')
        if (parts.length >= 2) {
          const llmScore = parseFloat(parts[0].trim())
          if (!isNaN(llmScore)) {
            enhancedScore = (jaccard + llmScore) / 2
            reasoning = `术语相似度: ${(jaccard * 100).toFixed(1)}% + 语义相似度: ${(
              llmScore * 100
            ).toFixed(1)}% = ${(enhancedScore * 100).toFixed(1)}%`
          }
        }
      } catch (error) {
        // LLM 调用失败，回退到基于规则的方法
        reasoning += '（LLM 不可用，使用规则方法）'
      }
    }

    // 提取关键共同特征
    const commonFeatures = termsA.filter((t) => termsB.includes(t)).slice(0, 5)

    return {
      score: enhancedScore,
      reasoning,
      keyFeatures: commonFeatures.length > 0 ? commonFeatures : undefined,
    }
  }

  /**
   * 阶段4b：应用领域维度评分
   */
  private async scoreApplicationDimension(
    patentA: PatentInfo,
    patentB: PatentInfo
  ): Promise<DimensionScore> {
    const textA = patentA.abstract || ''
    const textB = patentB.abstract || ''

    // 提取应用相关关键词
    const applicationTerms = [
      '应用',
      '场景',
      '用途',
      '使用',
      '适用',
      '领域',
      '行业',
      '系统',
      '平台',
      '装置',
      '设备',
    ]

    const appTermsA = this.extractTermsWithKeywords(textA, applicationTerms)
    const appTermsB = this.extractTermsWithKeywords(textB, applicationTerms)

    // 计算应用场景相似度
    const jaccard = this.computeJaccard(appTermsA, appTermsB)

    // 考虑技术领域描述
    let fieldSimilarity = 0
    if (patentA.technicalField && patentB.technicalField) {
      const fieldTermsA = this.extractTechnicalTerms(patentA.technicalField)
      const fieldTermsB = this.extractTechnicalTerms(patentB.technicalField)
      fieldSimilarity = this.computeJaccard(fieldTermsA, fieldTermsB)
    }

    // 综合评分
    const score = jaccard * 0.6 + fieldSimilarity * 0.4

    const reasoning =
      `应用场景相似度: ${(jaccard * 100).toFixed(1)}%` +
      (fieldSimilarity > 0 ? `，技术领域相似度: ${(fieldSimilarity * 100).toFixed(1)}%` : '') +
      `，综合: ${(score * 100).toFixed(1)}%`

    const keyFeatures = appTermsA.filter((t) => appTermsB.includes(t)).slice(0, 5)

    return {
      score,
      reasoning,
      keyFeatures: keyFeatures.length > 0 ? keyFeatures : undefined,
    }
  }

  /**
   * 阶段4c：权利范围维度评分
   */
  private async scoreClaimScopeDimension(
    patentA: PatentInfo,
    patentB: PatentInfo
  ): Promise<DimensionScore> {
    const scopeA = this.analyzeClaimScope(patentA.claims || [])
    const scopeB = this.analyzeClaimScope(patentB.claims || [])

    // 权利要求数量相似度
    const countSimilarity =
      1 - Math.abs(scopeA.count - scopeB.count) / Math.max(scopeA.count, scopeB.count, 1)

    // 独立权利要求比例相似度
    const independentSimilarity = 1 - Math.abs(scopeA.independentRatio - scopeB.independentRatio)

    // 权利要求长度相似度
    const lengthSimilarity =
      1 -
      Math.abs(scopeA.avgLength - scopeB.avgLength) /
        Math.max(scopeA.avgLength, scopeB.avgLength, 1)

    // 综合评分
    const score = countSimilarity * 0.3 + independentSimilarity * 0.4 + lengthSimilarity * 0.3

    const reasoning =
      `权利要求数量相似度: ${(countSimilarity * 100).toFixed(1)}%，` +
      `独立权利要求比例相似度: ${(independentSimilarity * 100).toFixed(1)}%，` +
      `权利要求长度相似度: ${(lengthSimilarity * 100).toFixed(1)}%，` +
      `综合: ${(score * 100).toFixed(1)}%`

    return {
      score,
      reasoning,
    }
  }

  /**
   * 阶段5：交叉验证
   */
  private performCrossValidation(
    technical: DimensionScore,
    application: DimensionScore,
    claimScope: DimensionScore,
    weights: WeightConfig
  ): string {
    const scores = [technical.score, application.score, claimScope.score]
    const maxScore = Math.max(...scores)
    const minScore = Math.min(...scores)
    const variance = maxScore - minScore

    let validation = '各维度评分一致性: '

    if (variance < 0.2) {
      validation += '良好（差异 < 0.2）'
    } else if (variance < 0.4) {
      validation += '中等（差异 < 0.4）'
    } else {
      validation += '偏低（差异 > 0.4），建议人工复核'
    }

    // 检查是否有维度异常高或异常低
    if (minScore < 0.2 && maxScore > 0.6) {
      validation +=
        '，存在显著维度差异（' +
        `技术=${(technical.score * 100).toFixed(1)}%, ` +
        `应用=${(application.score * 100).toFixed(1)}%, ` +
        `权利范围=${(claimScope.score * 100).toFixed(1)}%）`
    }

    validation += `。权重分配: 技术=${weights.technical}, 应用=${weights.application}, 权利范围=${weights.claimScope}`

    return validation
  }

  /**
   * 提取技术术语（名词和专有名词）
   */
  private extractTechnicalTerms(text: string): string[] {
    if (!text) return []

    // 中文技术术语提取模式
    const chinesePattern = /[\u4e00-\u9fa5]{2,}/g
    const chineseTerms = text.match(chinesePattern) || []

    // 去除常见停用词
    const stopWords = [
      '的',
      '是',
      '在',
      '和',
      '与',
      '或',
      '及',
      '以及',
      '包括',
      '包含',
      '具有',
      '通过',
      '利用',
    ]
    const filtered = chineseTerms.filter((term) => !stopWords.some((stop) => term.includes(stop)))

    // 英文技术术语提取
    const englishPattern = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g
    const englishTerms = text.match(englishPattern) || []

    // 合并去重
    return [...new Set([...filtered, ...englishTerms])]
  }

  /**
   * 使用关键词提取术语
   */
  private extractTermsWithKeywords(text: string, keywords: string[]): string[] {
    const terms: string[] = []

    for (const keyword of keywords) {
      const pattern = new RegExp(`${keyword}[^，。；！？\\n]{0,10}`, 'g')
      const matches = text.match(pattern) || []
      terms.push(...matches)
    }

    return [...new Set(terms)]
  }

  /**
   * 比较 IPC/CPC 分类号相似度
   */
  private compareIPCCodes(codesA: string[], codesB: string[]): number {
    if (codesA.length === 0 || codesB.length === 0) {
      return 0.5
    }

    let maxSimilarity = 0

    for (const codeA of codesA) {
      for (const codeB of codesB) {
        const similarity = this.computeCodeSimilarity(codeA, codeB)
        maxSimilarity = Math.max(maxSimilarity, similarity)
      }
    }

    return maxSimilarity
  }

  /**
   * 计算单个分类号的相似度
   */
  private computeCodeSimilarity(codeA: string, codeB: string): number {
    if (codeA === codeB) return 1.0

    // 格式化：去除空格和斜杠
    const normalizedA = codeA.replace(/[\s/]/g, '')
    const normalizedB = codeB.replace(/[\s/]/g, '')

    if (normalizedA === normalizedB) return 1.0

    // 比较 A01B vs A01B
    // 相同子类（前4位）= 0.8
    if (normalizedA.slice(0, 4) === normalizedB.slice(0, 4)) return 0.8

    // 相同大类（前3位）= 0.5
    if (normalizedA.slice(0, 3) === normalizedB.slice(0, 3)) return 0.5

    // 相同部（第1位）= 0.3
    if (normalizedA[0] === normalizedB[0]) return 0.3

    return 0.2
  }

  /**
   * 计算 Jaccard 相似度
   */
  private computeJaccard(setA: string[], setB: string[]): number {
    const setAMap = new Set(setA.map((s) => s.toLowerCase()))
    const setBMap = new Set(setB.map((s) => s.toLowerCase()))

    if (setAMap.size === 0 && setBMap.size === 0) return 0.5

    const intersection = new Set([...setAMap].filter((x) => setBMap.has(x)))
    const union = new Set([...setAMap, ...setBMap])

    return union.size === 0 ? 0 : intersection.size / union.size
  }

  /**
   * 分析权利范围
   */
  private analyzeClaimScope(claims: string[]): ClaimScopeAnalysis {
    if (claims.length === 0) {
      return { count: 0, independentRatio: 0, avgLength: 0 }
    }

    let independentCount = 0
    let totalLength = 0

    for (const claim of claims) {
      totalLength += claim.length
      // 独立权利要求通常不包含"根据权利要求X所述"
      if (!claim.includes('根据权利要求') && !claim.includes('权利要求')) {
        independentCount++
      }
    }

    return {
      count: claims.length,
      independentRatio: claims.length > 0 ? independentCount / claims.length : 0,
      avgLength: claims.length > 0 ? totalLength / claims.length : 0,
    }
  }
}
