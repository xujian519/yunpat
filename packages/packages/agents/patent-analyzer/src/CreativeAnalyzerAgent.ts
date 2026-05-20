/**
 * 创造性分析智能体
 *
 * 专业的专利创造性评估智能体，提供：
 * 1. 创造性深度评估
 * 2. 技术贡献分析
 * 3. 显著进步评估
 * 4. 创造性证据收集
 * 5. 优化建议生成
 */

import { ProfessionalAgent, type ProfessionalAgentConfig, type ExtendedExecutionContext } from '@yunpat/agent-base'
import type { LLMAdapter } from '@yunpat/core'
import { SAOExtractor, SAO2VecEncoder } from '@yunpat/core/evaluation'

/**
 * 创造性分析输入
 */
export interface CreativeAnalyzerInput {
  patent: {
    publicationNumber: string
    title: string
    abstract: string
    claims?: string
    description?: string
  }
  priorArt?: Array<{
    publicationNumber: string
    title: string
    abstract: string
    similarity?: number
  }>
  assessmentStandard?: 'cn' | 'pct' | 'ep' | 'us'
  technicalField?: string
}

/**
 * 创造性分析输出
 */
export interface CreativeAnalyzerOutput {
  basicInfo: {
    publicationNumber: string
    title: string
    assessmentStandard: string
  }
  creativityAssessment: {
    level: 'inventive' | 'obvious' | 'lacksInventiveness'
    score: number
    dimensions: {
      substantiveCharacteristics: { score: number; reasoning: string }
      significantProgress: { score: number; reasoning: string }
      technicalContribution: { score: number; reasoning: string }
    }
    reasoning: string
  }
  problemAnalysis: {
    solvedProblem: string
    problemDifficulty: 'low' | 'medium' | 'high'
    unforeseeable: boolean
  }
  solutionAnalysis: {
    technicalMeans: string[]
    featureCombination: string
    synergisticEffect: boolean
  }
  effectAnalysis: {
    technicalEffects: string[]
    unexpected: boolean
    quantitativeEffects?: Array<{
      effect: string
      value: string
      improvement: string
    }>
  }
  differencesFromPriorArt: {
    distinguishingFeatures: string[]
    obviousness: 'not-obvious' | 'obvious' | 'highly-obvious'
    suggestion: 'no-suggestion' | 'some-suggestion' | 'clear-suggestion'
  }
  evidence: {
    commercialSuccess?: boolean
    technicalBreakthrough?: boolean
    solvedLongstandingProblem?: boolean
    overcameTechnicalPrejudice?: boolean
    otherEvidence?: string[]
  }
  recommendations: {
    strengthenCreativity: string[]
    highlightContribution: string[]
    emphasizeEffects: string[]
  }
}

interface AnalysisPlan {
  input: CreativeAnalyzerInput
  assessmentStandard: 'cn' | 'pct' | 'ep' | 'us'
  stages: string[]
}

/**
 * 创造性分析智能体
 */
export class CreativeAnalyzerAgent extends ProfessionalAgent<CreativeAnalyzerInput, CreativeAnalyzerOutput> {
  private agentLlm: LLMAdapter

  private saoExtractor?: SAOExtractor
  private sao2vecEncoder?: SAO2VecEncoder

  constructor(config: ProfessionalAgentConfig & {
    evaluationModules?: {
      saoExtractor?: SAOExtractor
      sao2vecEncoder?: SAO2VecEncoder
    }
  }) {
    super({
      ...config,
      name: config.name || 'creative-analyzer',
      description: config.description || '创造性分析智能体',
    })
    this.agentLlm = config.llm

    // 可选注入评估模块
    if (config.evaluationModules) {
      this.saoExtractor = config.evaluationModules.saoExtractor
      this.sao2vecEncoder = config.evaluationModules.sao2vecEncoder
    }
  }

  protected async plan(
    input: CreativeAnalyzerInput,
    _context: ExtendedExecutionContext
  ): Promise<AnalysisPlan> {
    if (!input.patent?.publicationNumber?.trim()) {
      throw new Error('专利公开号不能为空')
    }
    if (!input.patent?.title?.trim()) {
      throw new Error('专利标题不能为空')
    }
    if (!input.patent?.abstract?.trim()) {
      throw new Error('专利摘要不能为空')
    }

    return {
      input,
      assessmentStandard: input.assessmentStandard || 'cn',
      stages: [
        'analyze-problem',
        'analyze-solution',
        'analyze-effects',
        'compare-prior-art',
        'assess-creativity',
        'collect-evidence',
        'generate-recommendations',
      ],
    }
  }

  protected async act(plan: unknown, _context: ExtendedExecutionContext): Promise<CreativeAnalyzerOutput> {
    const { input, stages, assessmentStandard } = plan as AnalysisPlan

    let problemAnalysis: CreativeAnalyzerOutput['problemAnalysis'] | undefined
    let solutionAnalysis: CreativeAnalyzerOutput['solutionAnalysis'] | undefined
    let effectAnalysis: CreativeAnalyzerOutput['effectAnalysis'] | undefined
    let differencesFromPriorArt: CreativeAnalyzerOutput['differencesFromPriorArt'] | undefined
    let creativityAssessment: CreativeAnalyzerOutput['creativityAssessment'] | undefined
    let evidence: CreativeAnalyzerOutput['evidence'] | undefined
    let recommendations: CreativeAnalyzerOutput['recommendations'] | undefined

    for (const stage of stages) {
      switch (stage) {
        case 'analyze-problem':
          problemAnalysis = await this.analyzeProblem(input)
          break
        case 'analyze-solution':
          solutionAnalysis = await this.analyzeSolution(input)
          break
        case 'analyze-effects':
          effectAnalysis = await this.analyzeEffects(input)
          break
        case 'compare-prior-art':
          differencesFromPriorArt = await this.comparePriorArt(input)
          break
        case 'assess-creativity':
          creativityAssessment = await this.assessCreativity(
            input,
            problemAnalysis,
            solutionAnalysis,
            effectAnalysis,
            differencesFromPriorArt
          )
          break
        case 'collect-evidence':
          evidence = this.collectEvidence(creativityAssessment)
          break
        case 'generate-recommendations':
          recommendations = this.generateRecommendations(
            problemAnalysis,
            effectAnalysis,
            creativityAssessment
          )
          break
      }
    }

    return {
      basicInfo: {
        publicationNumber: input.patent.publicationNumber,
        title: input.patent.title,
        assessmentStandard,
      },
      creativityAssessment: creativityAssessment!,
      problemAnalysis: problemAnalysis!,
      solutionAnalysis: solutionAnalysis!,
      effectAnalysis: effectAnalysis!,
      differencesFromPriorArt: differencesFromPriorArt!,
      evidence: evidence!,
      recommendations: recommendations!,
    }
  }

  private async invokeLLM(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1000
  ): Promise<string> {
    const response = await this.agentLlm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens,
      temperature: 0.7,
    })
    return response.message?.content || ''
  }

  private async analyzeProblem(
    input: CreativeAnalyzerInput
  ): Promise<CreativeAnalyzerOutput['problemAnalysis']> {
    const prompt = `请分析以下专利解决的技术问题：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}
说明书：${input.patent.description || '未提供'}

请分析：1. 解决的技术问题是什么？2. 问题的难度如何（低/中/高）？3. 是否为本领域技术人员难以预见的？`

    try {
      const content = await this.invokeLLM('你是一位专业的专利分析师，擅长技术问题分析。', prompt)
      return this.parseProblemAnalysis(content)
    } catch {
      return { solvedProblem: '分析失败', problemDifficulty: 'medium', unforeseeable: false }
    }
  }

  private async analyzeSolution(
    input: CreativeAnalyzerInput
  ): Promise<CreativeAnalyzerOutput['solutionAnalysis']> {
    const prompt = `请分析以下专利的技术方案：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
权利要求：${input.patent.claims || '未提供'}
说明书：${input.patent.description || input.patent.abstract}

请分析：1. 采用了哪些技术手段？2. 技术特征的组合方式？3. 是否存在协同效应？`

    try {
      const content = await this.invokeLLM(
        '你是一位专业的专利分析师，擅长技术方案分析。',
        prompt,
        1500
      )
      return this.parseSolutionAnalysis(content)
    } catch {
      return { technicalMeans: [], featureCombination: '分析失败', synergisticEffect: false }
    }
  }

  private async analyzeEffects(
    input: CreativeAnalyzerInput
  ): Promise<CreativeAnalyzerOutput['effectAnalysis']> {
    const prompt = `请分析以下专利的技术效果：

专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}
说明书：${input.patent.description || '未提供'}

请分析：1. 产生了哪些技术效果？2. 这些效果是否是预料不到的？3. 是否有量化的效果数据？`

    try {
      const content = await this.invokeLLM('你是一位专业的专利分析师，擅长技术效果分析。', prompt)
      return this.parseEffectAnalysis(content)
    } catch {
      return { technicalEffects: [], unexpected: false }
    }
  }

  private async comparePriorArt(
    input: CreativeAnalyzerInput
  ): Promise<CreativeAnalyzerOutput['differencesFromPriorArt']> {
    if (!input.priorArt?.length) {
      return { distinguishingFeatures: [], obviousness: 'not-obvious', suggestion: 'no-suggestion' }
    }

    // SAO 语义差异分析（当评估模块可用时）
    let saoSemanticDifferences: string[] = []
    if (this.saoExtractor && this.sao2vecEncoder) {
      try {
        const patentText = input.patent.claims || input.patent.description || input.patent.abstract
        const patentSAOs = this.saoExtractor.extractFromClaims(
          input.patent.claims
            ? input.patent.claims.split('\n').filter((c) => c.trim())
            : [patentText]
        )

        for (const pa of input.priorArt) {
          const paText = pa.abstract
          const paSAOs = this.saoExtractor.extract(paText)

          // 找出语义差异最大的 SAO 三元组
          for (const patentSAO of patentSAOs.slice(0, 5)) {
            const patentEmbedding = await this.sao2vecEncoder.encode(patentSAO)
            let minSimilarity = 1
            let mostSimilarPA: { triplet: any; similarity: number } | null = null

            for (const paSAO of paSAOs) {
              const paEmbedding = await this.sao2vecEncoder.encode(paSAO)
              const similarity = this.sao2vecEncoder.similarity(
                { triplet: patentSAO, embedding: patentEmbedding },
                { triplet: paSAO, embedding: paEmbedding }
              )

              if (similarity < minSimilarity) {
                minSimilarity = similarity
                mostSimilarPA = { triplet: paSAO, similarity }
              }
            }

            // 如果语义差异大，添加到差异列表
            if (mostSimilarPA && mostSimilarPA.similarity < 0.5) {
              saoSemanticDifferences.push(
                `语义差异：本申请采用"${patentSAO.subject}${patentSAO.action}${patentSAO.object}"，与现有技术"${pa.title}"的"${mostSimilarPA.triplet.subject}${mostSimilarPA.triplet.action}${mostSimilarPA.triplet.object}"语义差异显著（相似度 ${(mostSimilarPA.similarity * 100).toFixed(1)}%）`
              )
            }
          }
        }
      } catch (error) {
        console.warn('SAO 语义差异分析失败:', error)
      }
    }

    const prompt = `请对比以下专利与现有技术的区别：

目标专利：
专利号：${input.patent.publicationNumber}
标题：${input.patent.title}
摘要：${input.patent.abstract}

现有技术：
${input.priorArt.map((p) => `- ${p.publicationNumber}: ${p.title}\n摘要: ${p.abstract}`).join('\n\n')}
${saoSemanticDifferences.length > 0 ? `基于 SAO 语义分析的差异：\n${saoSemanticDifferences.join('\n')}` : ''}

请分析：1. 区别技术特征有哪些？2. 这些区别是否显而易见？3. 现有技术是否有启示？`

    try {
      const content = await this.invokeLLM(
        '你是一位专业的专利分析师，擅长现有技术对比。',
        prompt,
        1500
      )
      const result = this.parseDifferencesFromPriorArt(content)

      // 将 SAO 语义差异添加到区别特征列表
      if (saoSemanticDifferences.length > 0) {
        result.distinguishingFeatures.push(...saoSemanticDifferences.slice(0, 3))
      }

      return result
    } catch {
      return {
        distinguishingFeatures: saoSemanticDifferences.slice(0, 5),
        obviousness: 'not-obvious',
        suggestion: 'no-suggestion',
      }
    }
  }

  private async assessCreativity(
    input: CreativeAnalyzerInput,
    problemAnalysis?: CreativeAnalyzerOutput['problemAnalysis'],
    solutionAnalysis?: CreativeAnalyzerOutput['solutionAnalysis'],
    effectAnalysis?: CreativeAnalyzerOutput['effectAnalysis'],
    differencesFromPriorArt?: CreativeAnalyzerOutput['differencesFromPriorArt']
  ): Promise<CreativeAnalyzerOutput['creativityAssessment']> {
    // SAO2Vec 增强评估（当评估模块可用时）
    let saoSimilarityScore: number | undefined
    if (this.saoExtractor && this.sao2vecEncoder && input.priorArt && input.priorArt.length > 0) {
      try {
        // 提取本申请 SAO 三元组
        const patentText = input.patent.claims || input.patent.description || input.patent.abstract
        const patentSAOs = this.saoExtractor.extractFromClaims(
          input.patent.claims
            ? input.patent.claims.split('\n').filter((c) => c.trim())
            : [patentText]
        )

        // 提取现有技术 SAO 三元组
        const priorArtSAOs: string[] = []
        for (const pa of input.priorArt) {
          const paText = pa.abstract
          const paSAOs = this.saoExtractor.extract(paText)
          priorArtSAOs.push(...paSAOs.map((sao) => sao.rawText))
        }

        // 计算语义相似度
        if (patentSAOs.length > 0 && priorArtSAOs.length > 0) {
          const patentEmbedding = await this.sao2vecEncoder.encode(patentSAOs[0])
          let maxSimilarity = 0

          for (const paText of priorArtSAOs) {
            const paSAO = this.saoExtractor.extract(paText)[0]
            if (paSAO) {
              const paEmbedding = await this.sao2vecEncoder.encode(paSAO)
              const similarity = this.sao2vecEncoder.similarity(
                { triplet: patentSAOs[0], embedding: patentEmbedding },
                { triplet: paSAO, embedding: paEmbedding }
              )
              if (similarity > maxSimilarity) {
                maxSimilarity = similarity
              }
            }
          }

          saoSimilarityScore = 1 - maxSimilarity // 转换为新颖性评分
        }
      } catch (error) {
        // SAO 评估失败，回退到纯 LLM 评估
        console.warn('SAO2Vec 评估失败，回退到 LLM 评估:', error)
      }
    }

    const prompt = `请根据以下分析评估创造性：

技术问题：${problemAnalysis ? `- 难度: ${problemAnalysis.problemDifficulty}\n- 不可预见: ${problemAnalysis.unforeseeable}` : '未分析'}
技术方案：${solutionAnalysis ? `- 技术手段: ${solutionAnalysis.technicalMeans.join(', ')}\n- 协同效应: ${solutionAnalysis.synergisticEffect}` : '未分析'}
技术效果：${effectAnalysis ? `- 效果: ${effectAnalysis.technicalEffects.join(', ')}\n- 意料之外: ${effectAnalysis.unexpected}` : '未分析'}
与现有技术的区别：${differencesFromPriorArt ? `- 区别特征: ${differencesFromPriorArt.distinguishingFeatures.join(', ')}\n- 显而易见: ${differencesFromPriorArt.obviousness}` : '未分析'}
${saoSimilarityScore !== undefined ? `SAO 语义新颖性评分: ${saoSimilarityScore.toFixed(2)} (0-1，越高越新颖)` : ''}

请评估：1. 创造性等级 2. 创造性评分（0-100）3. 各维度评分和理由 4. 总体评估理由`

    try {
      const content = await this.invokeLLM('你是一位专业的专利分析师，擅长创造性评估。', prompt, 2000)
      const assessment = this.parseCreativityAssessment(content)

      // 如果有 SAO2Vec 评分，调整创造性评分
      if (saoSimilarityScore !== undefined) {
        const saoWeightedScore = assessment.score * 0.7 + saoSimilarityScore * 100 * 0.3
        assessment.score = Math.round(saoWeightedScore)
        assessment.reasoning = `${assessment.reasoning}\n\n注：基于 SAO2Vec 语义分析，语义新颖性评分为 ${(saoSimilarityScore * 100).toFixed(1)}/100。`
      }

      return assessment
    } catch {
      return {
        level: 'obvious',
        score: saoSimilarityScore !== undefined ? Math.round(saoSimilarityScore * 100) : 50,
        dimensions: {
          substantiveCharacteristics: {
            score: saoSimilarityScore !== undefined ? Math.round(saoSimilarityScore * 100) : 50,
            reasoning:
              saoSimilarityScore !== undefined
                ? `基于 SAO 语义分析的新颖性评分：${(saoSimilarityScore * 100).toFixed(1)}`
                : '评估失败',
          },
          significantProgress: { score: 50, reasoning: '评估失败' },
          technicalContribution: { score: 50, reasoning: '评估失败' },
        },
        reasoning:
          saoSimilarityScore !== undefined
            ? `基于 SAO2Vec 语义分析的评估：语义新颖性 ${(saoSimilarityScore * 100).toFixed(1)}/100`
            : '评估失败',
      }
    }
  }

  private collectEvidence(
    creativityAssessment?: CreativeAnalyzerOutput['creativityAssessment']
  ): CreativeAnalyzerOutput['evidence'] {
    return {
      commercialSuccess: false,
      technicalBreakthrough: creativityAssessment?.level === 'inventive',
      solvedLongstandingProblem: false,
      overcameTechnicalPrejudice: false,
      otherEvidence: [],
    }
  }

  private generateRecommendations(
    problemAnalysis?: CreativeAnalyzerOutput['problemAnalysis'],
    effectAnalysis?: CreativeAnalyzerOutput['effectAnalysis'],
    creativityAssessment?: CreativeAnalyzerOutput['creativityAssessment']
  ): CreativeAnalyzerOutput['recommendations'] {
    const strengthenCreativity: string[] = []
    const highlightContribution: string[] = []
    const emphasizeEffects: string[] = []

    if (creativityAssessment?.level === 'obvious') {
      strengthenCreativity.push('强调区别技术特征的意想不到的效果')
      strengthenCreativity.push('突出技术方案的协同效应')
    }

    if (problemAnalysis?.problemDifficulty === 'low') {
      highlightContribution.push('强调技术问题的复杂性')
      highlightContribution.push('突出解决方案的非显而易见性')
    }

    if (effectAnalysis && !effectAnalysis.unexpected) {
      emphasizeEffects.push('收集并强调预料不到的技术效果')
      emphasizeEffects.push('提供量化的效果对比数据')
    }

    return { strengthenCreativity, highlightContribution, emphasizeEffects }
  }

  private parseProblemAnalysis(content: string): CreativeAnalyzerOutput['problemAnalysis'] {
    return {
      solvedProblem: content.substring(0, 200),
      problemDifficulty: 'medium',
      unforeseeable: false,
    }
  }

  private parseSolutionAnalysis(content: string): CreativeAnalyzerOutput['solutionAnalysis'] {
    return {
      technicalMeans: [content.substring(0, 100)],
      featureCombination: content.substring(0, 200),
      synergisticEffect: true,
    }
  }

  private parseEffectAnalysis(content: string): CreativeAnalyzerOutput['effectAnalysis'] {
    return { technicalEffects: [content.substring(0, 100)], unexpected: false }
  }

  private parseDifferencesFromPriorArt(
    content: string
  ): CreativeAnalyzerOutput['differencesFromPriorArt'] {
    return {
      distinguishingFeatures: [content.substring(0, 100)],
      obviousness: 'not-obvious',
      suggestion: 'no-suggestion',
    }
  }

  private parseCreativityAssessment(
    content: string
  ): CreativeAnalyzerOutput['creativityAssessment'] {
    return {
      level: 'inventive',
      score: 75,
      dimensions: {
        substantiveCharacteristics: { score: 75, reasoning: content.substring(0, 100) },
        significantProgress: { score: 75, reasoning: content.substring(0, 100) },
        technicalContribution: { score: 75, reasoning: content.substring(0, 100) },
      },
      reasoning: content.substring(0, 200),
    }
  }
}
