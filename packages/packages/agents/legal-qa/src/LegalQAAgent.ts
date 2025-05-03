/**
 * 法律知识问答智能体
 *
 * 基于法律世界模型的三库联动问答系统
 */

import {
  ProfessionalAgent,
  type ProfessionalAgentConfig,
  type AgentResult,
  type ExtendedExecutionContext,
} from '@yunpat/agent-base'
import { PostgreSQLClient } from '@yunpat/unified-knowledge-graph'
import type {
  LegalQAInput,
  LegalQAOutput,
  LawCitation,
  CaseCitation,
  LegalSource,
} from './types.js'

/**
 * 法律问答智能体
 *
 * 集成 PostgreSQL 数据库，支持多源法律知识检索
 */
export class LegalQAAgent extends ProfessionalAgent<LegalQAInput, LegalQAOutput> {
  private db: PostgreSQLClient

  constructor(config: ProfessionalAgentConfig & { dbConfig?: any }) {
    super(config)
    this.db = new PostgreSQLClient(config.dbConfig)
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    await this.db.initialize()
  }

  /**
   * 实现plan方法：生成查询计划
   */
  async plan(input: LegalQAInput): Promise<any> {
    return {
      question: input.question,
      domain: input.domain || 'patent',
      sources: input.sources || ['law_article', 'invalid_decision', 'patent_rule'],
      topK: input.topK || 5,
    }
  }

  /**
   * 实现act方法：执行查询并生成回答
   */
  protected async act(
    plan: any,
    context: ExtendedExecutionContext
  ): Promise<LegalQAOutput> {
    const startTime = Date.now()

    try {
      // 1. 并行搜索多个数据源
      const [
        structuredResults,
        invalidDecisions,
        patentRules,
        entityResults,
      ] = await Promise.allSettled([
        this.db.structuredSearch(plan.question, Math.ceil(plan.topK / 4)),
        this.db.queryInvalidDecisions(plan.question, Math.ceil(plan.topK / 4)),
        this.searchPatentRules(plan.question, Math.ceil(plan.topK / 4)),
        this.searchEntityBased(plan.question, plan.domain, Math.ceil(plan.topK / 4)),
      ])

      // 2. 提取成功的结果
      const structuredData =
        structuredResults.status === 'fulfilled' ? structuredResults.value : []
      const invalidData =
        invalidDecisions.status === 'fulfilled' ? invalidDecisions.value : []
      const rulesData =
        patentRules.status === 'fulfilled' ? patentRules.value : []
      const entityData =
        entityResults.status === 'fulfilled' ? entityResults.value : []

      // 3. 转换为标准格式
      const lawCitations: LawCitation[] = this.mapToLawCitations(structuredData)
      const caseCitations: CaseCitation[] = this.mapToCaseCitations(invalidData, entityData)
      const ruleCitations = rulesData.map((rule: any) => ({
        articleId: rule.id.toString(),
        title: rule.title,
        content: rule.content,
        relevance: 0.8,
      }))

      // 4. 统计数据来源
      const sourceStats = this.calculateSourceStats(
        structuredData,
        invalidData,
        rulesData,
        entityData
      )

      // 5. 使用LLM生成最终回答
      const answer = await this.generateAnswer(
        plan.question,
        lawCitations,
        caseCitations,
        ruleCitations
      )

      // 6. 计算置信度（基于结果数量和质量）
      const confidence = this.calculateConfidence(
        lawCitations.length,
        caseCitations.length,
        ruleCitations.length
      )

      const executionTime = Date.now() - startTime

      return {
        answer,
        lawCitations,
        caseCitations,
        ruleCitations,
        confidence,
        sourceStats,
        executionTime,
      }
    } catch (error) {
      throw new Error(`法律问答失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 搜索专利规则
   */
  private async searchPatentRules(query: string, topK: number): Promise<any[]> {
    try {
      const result = await (this.db as any).pool.query(
        `
        SELECT
          id,
          title,
          content
        FROM patent_rules_unified
        WHERE title LIKE $1 OR content LIKE $1
        ORDER BY id
        LIMIT $2
        `,
        [`%${query}%`, topK]
      )
      return result.rows
    } catch (error) {
      console.error('[LegalQAAgent] 专利规则搜索失败:', error)
      return []
    }
  }

  /**
   * 基于实体的搜索
   */
  private async searchEntityBased(
    query: string,
    domain: string,
    topK: number
  ): Promise<any[]> {
    try {
      const entityResults = await this.db.entitySearch(query, undefined, topK)
      return entityResults
    } catch (error) {
      console.error('[LegalQAAgent] 实体搜索失败:', error)
      return []
    }
  }

  /**
   * 映射为法条引用格式
   */
  private mapToLawCitations(results: any[]): LawCitation[] {
    return results
      .filter((r) => r.category === 'legal_article')
      .map((r) => ({
        articleId: r.id.toString(),
        title: r.title,
        content: r.content?.substring(0, 500) || r.content || '',
        lawTitle: '法律文章',
        relevance: 0.8,
        source: 'law_article' as LegalSource,
      }))
  }

  /**
   * 映射为案例引用格式
   */
  private mapToCaseCitations(invalidData: any[], entityData: any[]): CaseCitation[] {
    const cases: CaseCitation[] = []

    for (const item of invalidData) {
      cases.push({
        documentNumber: item.metadata?.documentNumber || item.title,
        title: item.title,
        summary: item.content?.substring(0, 500) || item.content || '',
        domain: item.metadata?.domain || 'patent',
        relevance: 0.8,
        source: 'invalid_decision',
      })
    }

    for (const item of entityData) {
      if (item.entityType === 'PATENT_NUMBER') {
        cases.push({
          documentNumber: item.entityText,
          title: `相关案例: ${item.entityText}`,
          summary: `实体引用，置信度: ${item.confidence}`,
          domain: 'patent',
          relevance: item.confidence,
          source: 'patent_judgment',
        })
      }
    }

    return cases
  }

  /**
   * 计算数据来源统计
   */
  private calculateSourceStats(
    structuredData: any[],
    invalidData: any[],
    rulesData: any[],
    entityData: any[]
  ) {
    const stats: Record<LegalSource, number> = {
      law_article: structuredData.filter((r) => r.category === 'legal_article').length,
      invalid_decision: invalidData.length,
      patent_judgment: entityData.filter((e) => e.entityType === 'PATENT_NUMBER').length,
      patent_rule: rulesData.length,
      legal_document: 0,
    }

    return {
      totalQueries: Object.values(stats).reduce((sum, count) => sum + count, 0),
      sources: stats,
    }
  }

  /**
   * 使用LLM生成最终回答
   */
  private async generateAnswer(
    question: string,
    lawCitations: LawCitation[],
    caseCitations: CaseCitation[],
    ruleCitations: any[]
  ): Promise<string> {
    const systemPrompt = `你是一位专业的法律专家，擅长专利法及相关法律知识问答。

请根据提供的法律条文、案例和审查指南，回答用户的问题。

回答要求：
1. 基于提供的事实和法条回答，不编造信息
2. 清晰标注引用来源
3. 结构化回答，先结论后分析
4. 如果信息不足，明确说明`

    const relevantLaws = lawCitations.map((c) => `- ${c.title}: ${c.content}`).join('\n')
    const relevantCases = caseCitations.map((c) => `- ${c.title}: ${c.summary}`).join('\n')
    const relevantRules = ruleCitations.map((r) => `- ${r.title}`).join('\n')

    const userPrompt = `问题：${question}

相关法条：
${relevantLaws || '暂无'}

相关案例：
${relevantCases || '暂无'}

审查指南：
${relevantRules || '暂无'}

请给出专业、准确的回答。`

    try {
      const answer = await this.callLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 1500,
      })

      return answer
    } catch (error) {
      console.error('[LegalQAAgent] LLM调用失败:', error)
      return `基于检索到的${lawCitations.length}条法条、${caseCitations.length}个案例和${ruleCitations.length}条审查指南，${lawCitations.length > 0 ? '可以给出基于法律依据的回答' : '建议提供更多上下文信息'}。`
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    lawCount: number,
    caseCount: number,
    ruleCount: number
  ): number {
    const total = lawCount + caseCount + ruleCount

    if (total === 0) return 0.2
    if (total < 3) return 0.5
    if (total < 6) return 0.7
    return 0.9
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    await this.db.close()
  }
}
