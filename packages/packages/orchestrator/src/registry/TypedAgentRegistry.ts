/**
 * TypedAgentRegistry - 类型安全的 Agent 注册表
 *
 * 提供编译时类型安全的 Agent 查找和注册。
 * 使用 AgentId 作为键，通过泛型参数确保输入/输出类型正确。
 *
 * @package @yunpat/orchestrator
 */

import type { AgentId, AgentResult } from '@yunpat/agent-base'

/**
 * 类型化的可执行 Agent 接口
 *
 * 使用泛型参数约束输入和输出类型，提供编译时类型检查。
 */
export interface TypedExecutableAgent<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<AgentResult<TOutput>>
}

/**
 * Agent 类型映射
 *
 * 将每个 AgentId 映射到其特定的输入和输出类型。
 * 未定义的 Agent 使用 unknown 作为输入和输出类型（将在 T1c 中填充）。
 */
export type AgentTypeMap = {
  'patent-search': {
    input: {
      title: string
      field: string
      technicalProblem: string
      technicalSolution: string
      keyFeatures: string[]
      sessionId?: string
      userId?: string
    }
    output: {
      strategy: unknown
      results: unknown[]
      totalFound: number
      executionTime: number
      dataSource?: string
      academicPapers?: Array<{
        title: string
        authors: string
        year: string
        venue: string
        citations: number
        url: string
        abstract: string
      }>
    }
  }
  'patent-analyzer': {
    input: {
      inventionUnderstanding?: {
        technicalProblem: string
        technicalSolution: string
        keyFeatures: string[]
        beneficialEffects?: string
      }
      priorArtAnalyses: unknown[]
      scenario?: string
      sessionId?: string
      userId?: string
    }
    output: {
      scenario: string
      hasInventionUnderstanding: boolean
      comparisons: unknown[]
      closestPriorArt?: unknown
      creativityAssessment?: {
        level: string
        score: number
        reasoning: string
      }
      riskAssessment?: {
        invalidityRisk: string
        infringementRisk: string
        riskFactors: string[]
      }
      examinationRules?: Array<{
        articleId: string
        title: string
        content: string
        corePrinciple?: string
        similarity?: number
      }>
      recommendations: string[]
      executionTime: number
      dataSource?: string
      metadata: {
        priorArtCount: number
        timestamp: number
        confidence: number
      }
    }
  }
  'patent-responder': {
    input: {
      officeAction: {
        applicationNumber: string
        patentTitle: string
        examiner?: string
        notificationDate?: string
        deadline?: string
        officeActionContent: string
        citedReferences?: Array<{
          publicationNumber: string
          title: string
          relevance: string
        }>
        rejectionTypes?: string[]
      }
      originalApplication: {
        title: string
        claims: string
        description: string
        abstract?: string
      }
      strategyPreference?: string
      enablePriorArtSearch?: boolean
      documentType?: string
      sessionId?: string
      userId?: string
    }
    output: {
      analysis: {
        summary: string
        keyIssues: Array<{
          type: string
          description: string
          severity: string
        }>
        overcomeProbability: number
      }
      strategy: {
        overallStrategy: string
        successProbability: number
        keyArguments: string[]
        suggestedAmendments: Array<{
          claimNumber: number
          currentText: string
          proposedText: string
          reason: string
        }>
        additionalEvidence: string[]
        risks: string[]
      }
      responseDocument: {
        documentType: string
        responseLetter: string
        amendedClaims?: string
        amendedDescription?: string
        detailedArguments: Array<{
          category: string
          argument: string
          evidence: string[]
        }>
        metrics: {
          wordCount: number
          argumentCount: number
          amendmentCount: number
          generationTime: number
        }
      }
      nextSteps: string[]
      executionTime: number
      dataSource?: string
    }
  }
  'patent-writer': { input: unknown; output: unknown }
  'patent-manager': { input: unknown; output: unknown }
  'claim-generator': {
    input: {
      inventionUnderstanding: {
        technicalField: string
        backgroundArt?: string
        technicalProblem: string
        technicalSolution: string
        beneficialEffects?: string
        keyFeatures: string[]
      }
      priorArtSearch?: unknown
      specificationDraft?: string
      enableStepwiseConfirmation?: boolean
      sessionId?: string
      userId?: string
    }
    output: {
      claimsSet: {
        independent_claims: Array<{
          claim_number: number
          claim_type: string
          preamble: string
          transition: string
          body: string
          full_text: string
          essential_features: string[]
        }>
        dependent_claims: Array<{
          claim_number: number
          parent_claim: number
          content: string
          additional_features: string[]
          limitation_type: string
        }>
        layout_strategy: string
        protection_scope_analysis: string
        quality_check: {
          clarity: string
          support: string
          essential_features: string
          potential_issues: string[]
          formality_check?: {
            passed: boolean
            clarityIssues: Array<{
              claimNumber: number
              issue: string
              suggestion: string
            }>
            unnecessaryFeatures: Array<{
              claimNumber: number
              feature: string
              reason: string
            }>
            recommendations: string[]
          }
        }
      }
      confidence: number
      executionTime: number
      dataSource?: string
    }
  }
  'legal-qa': {
    input: {
      question: string
      domain?: string
      sources?: string[]
      context?: {
        patentNumber?: string
        applicationNumber?: string
        applicantName?: string
        [key: string]: string | undefined
      }
      topK?: number
      sessionId?: string
      userId?: string
    }
    output: {
      answer: string
      lawCitations: Array<{
        articleId: string
        title: string
        content: string
        lawTitle: string
        relevance: number
        source: string
      }>
      caseCitations: Array<{
        documentNumber: string
        title: string
        summary: string
        domain: string
        relevance: number
        source: string
      }>
      ruleCitations: Array<{
        articleId: string
        title: string
        content: string
        relevance: number
      }>
      confidence: number
      sourceStats: {
        totalQueries: number
        sources: Record<string, number>
      }
      executionTime: number
      dataSource?: string
    }
  }
  'specification-drafter': { input: unknown; output: unknown }
  'abstract-drafter': { input: unknown; output: unknown }
  invention: { input: unknown; output: unknown }
  'tech-unit': { input: unknown; output: unknown }
  analysis: { input: unknown; output: unknown }
  'prior-art-search': { input: unknown; output: unknown }
  quality: { input: unknown; output: unknown }
  'quality-checker': { input: unknown; output: unknown }
  'image-understanding': { input: unknown; output: unknown }
  researcher: { input: unknown; output: unknown }
  writer: { input: unknown; output: unknown }
}

/**
 * 类型安全的 Agent 注册表
 *
 * 核心特性：
 * - 使用 AgentId 类型作为键，提供编译时类型检查
 * - register 和 get 方法通过泛型参数 K 约束，确保类型安全
 * - 自动推断 Agent 的输入和输出类型
 *
 * @example
 * ```typescript
 * const registry = new TypedAgentRegistry()
 *
 * // 注册 Agent（类型检查通过）
 * registry.register('patent-search', searchAgent)
 *
 * // 获取 Agent（类型正确推断）
 * const agent = registry.get('patent-search')
 * if (agent) {
 *   const result = await agent.execute({
 *     title: '深度学习图像识别',
 *     field: '人工智能',
 *     technicalProblem: '...',
 *     technicalSolution: '...',
 *     keyFeatures: ['CNN', '特征提取']
 *   })
 * }
 * ```
 */
export class TypedAgentRegistry {
  private agents = new Map<AgentId, TypedExecutableAgent>()

  /**
   * 注册 Agent
   *
   * @param id - Agent ID（类型约束为 AgentId）
   * @param agent - Agent 实例（输入/输出类型通过 AgentTypeMap 自动推断）
   */
  register<K extends keyof AgentTypeMap>(
    id: K,
    agent: TypedExecutableAgent<AgentTypeMap[K]['input'], AgentTypeMap[K]['output']>
  ): void {
    this.agents.set(id as AgentId, agent as TypedExecutableAgent)
  }

  /**
   * 获取 Agent
   *
   * @param id - Agent ID（类型约束为 AgentId）
   * @returns Agent 实例（输入/输出类型通过 AgentTypeMap 自动推断），不存在时返回 undefined
   */
  get<K extends keyof AgentTypeMap>(
    id: K
  ): TypedExecutableAgent<AgentTypeMap[K]['input'], AgentTypeMap[K]['output']> | undefined {
    return this.agents.get(id as AgentId) as
      | TypedExecutableAgent<AgentTypeMap[K]['input'], AgentTypeMap[K]['output']>
      | undefined
  }

  /**
   * 检查 Agent 是否已注册
   *
   * @param id - Agent ID
   * @returns 是否存在
   */
  has(id: AgentId): boolean {
    return this.agents.has(id)
  }

  /**
   * 列出所有已注册的 Agent ID
   *
   * @returns Agent ID 数组
   */
  list(): AgentId[] {
    return Array.from(this.agents.keys())
  }

  /**
   * 注销 Agent
   *
   * @param id - Agent ID
   * @returns 是否成功删除
   */
  unregister(id: AgentId): boolean {
    return this.agents.delete(id)
  }

  /**
   * 获取已注册 Agent 的数量
   *
   * @returns Agent 数量
   */
  get size(): number {
    return this.agents.size
  }
}
