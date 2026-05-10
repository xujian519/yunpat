import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'
import {
  legalKnowledgeSearchToolSchema,
  invalidDecisionSearchToolSchema,
  patentRuleSearchToolSchema,
} from '@yunpat/agent-legal-qa'

export class LegalKnowledgeSearchTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: legalKnowledgeSearchToolSchema.name,
    description: legalKnowledgeSearchToolSchema.description,
    version: legalKnowledgeSearchToolSchema.version,
    inputSchema: legalKnowledgeSearchToolSchema.inputSchema,
  } satisfies import('./BaseMcpTool.js').McpToolMetadata

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm) {
      try {
        const { LegalQAAgent } = await import('@yunpat/agent-legal-qa')

        const legalAgent = new LegalQAAgent({
          name: 'legal-qa',
          description: '法律知识问答智能体',
          llm: context.llm,
          eventBus: context.eventBus!,
          memory: context.memory!,
          tools: context.registry!,
        })

        const result = await legalAgent.execute({
          question: input.question,
          domain: input.domain,
          sources: input.sources,
        })

        return {
          version: '1.0.0',
          integrationMode: 'real_agent',
          ...result,
        }
      } catch (error) {
        console.warn('[LegalKnowledgeSearchTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    try {
      const { PostgreSQLClient } = await import('@yunpat/unified-knowledge-graph')

      const client = new PostgreSQLClient()
      const topK = input.topK || 10

      const [structuredSearchResult, invalidDecisionsResult, patentRulesResult] =
        await Promise.allSettled([
          client.structuredSearch(input.question, topK),
          input.sources?.includes('invalid_decision')
            ? client.queryInvalidDecisions(input.question, topK)
            : Promise.resolve([]),
          input.sources?.includes('patent_rule')
            ? client.searchPatentRules({
                query: input.question,
                topK,
              })
            : Promise.resolve([]),
        ])

      const results = []

      if (structuredSearchResult.status === 'fulfilled' && structuredSearchResult.value) {
        results.push(
          ...structuredSearchResult.value.map((item) => ({
            type: item.category || 'legal_article',
            documentNumber: item.metadata?.documentNumber,
            title: item.title,
            content: item.content,
            domain: item.metadata?.domain,
            relevance: 0.8,
            source: '法律文章数据库',
          }))
        )
      }

      if (invalidDecisionsResult.status === 'fulfilled') {
        results.push(
          ...invalidDecisionsResult.value.map((item) => ({
            type: 'invalid_decision',
            documentNumber: item.metadata?.documentNumber,
            title: item.title,
            content: item.content,
            domain: item.metadata?.domain,
            relevance: 0.9,
            source: '无效决定数据库',
          }))
        )
      }

      if (patentRulesResult.status === 'fulfilled') {
        results.push(
          ...patentRulesResult.value.map((item) => ({
            type: 'patent_rule',
            articleId: item.articleId,
            title: item.title,
            content: item.content,
            corePrinciple: item.corePrinciple,
            relevance: item.similarity || 0.85,
            source: '专利审查指南',
          }))
        )
      }

      results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      const topResults = results.slice(0, topK)

      return {
        version: '1.0.0',
        integrationMode: 'rule_based',
        query: input.question,
        domain: input.domain,
        totalFound: results.length,
        results: topResults,
        citations: topResults.map((r, i) => ({
          id: i + 1,
          type: r.type,
          source: r.source,
          reference: (r as any).documentNumber || (r as any).articleId,
        })),
      }
    } catch (error) {
      return {
        version: '1.0.0',
        integrationMode: 'rule_based',
        error: `查询失败: ${error instanceof Error ? error.message : String(error)}`,
        results: [],
      }
    }
  }
}

export class InvalidDecisionSearchTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: invalidDecisionSearchToolSchema.name,
    description: invalidDecisionSearchToolSchema.description,
    version: invalidDecisionSearchToolSchema.version,
    inputSchema: invalidDecisionSearchToolSchema.inputSchema,
  } satisfies import('./BaseMcpTool.js').McpToolMetadata

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm) {
      try {
        const { LegalQAAgent } = await import('@yunpat/agent-legal-qa')

        const legalAgent = new LegalQAAgent({
          name: 'legal-qa-invalid',
          description: '无效决定检索智能体',
          llm: context.llm,
          eventBus: context.eventBus!,
          memory: context.memory!,
          tools: context.registry!,
        })

        const result = await legalAgent.execute({
          question: input.query,
          domain: input.domain || 'patent',
          sources: ['invalid_decision'],
        })

        const caseResults = result.caseCitations || []
        const invalidResults = caseResults.filter(
          (c: any) => c.source === 'invalid_decision' || !c.source
        )

        if (invalidResults.length > 0) {
          return {
            version: '1.0.0',
            integrationMode: 'real_agent',
            query: input.query,
            domain: input.domain,
            totalFound: invalidResults.length,
            results: invalidResults.map((item: any) => ({
              documentNumber: item.documentNumber,
              title: item.title,
              content: item.summary || item.content,
              domain: item.domain,
              relevance: item.relevance || 0.9,
              decisionType: item.source,
              decisionDate: item.decisionDate,
            })),
          }
        }
      } catch (error) {
        console.warn('[InvalidDecisionSearchTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    try {
      const { PostgreSQLClient } = await import('@yunpat/unified-knowledge-graph')

      const client = new PostgreSQLClient()
      const topK = input.topK || 10

      const [queryResult, entityResult] = await Promise.allSettled([
        client.queryInvalidDecisions(input.query, topK),
        client.searchInvalidEntities({
          entityText: input.query,
          topK,
        }),
      ])

      const results = []

      if (queryResult.status === 'fulfilled') {
        results.push(
          ...queryResult.value.map((item) => ({
            documentNumber: item.metadata?.documentNumber,
            title: item.title,
            content: item.content,
            domain: item.metadata?.domain,
            relevance: 0.9,
            decisionType: item.category,
            decisionDate: item.metadata?.decisionDate,
          }))
        )
      }

      if (entityResult.status === 'fulfilled') {
        results.push(
          ...entityResult.value.map((item) => ({
            documentNumber: item.decisionId,
            title: `实体：${item.entityText}`,
            content: `实体类型：${item.entityType}，置信度：${item.confidence}`,
            domain: item.domain,
            relevance: item.confidence,
            decisionType: 'entity',
            decisionDate: item.metadata?.decisionDate,
          }))
        )
      }

      const uniqueResults = Array.from(
        new Map(results.map((item) => [item.documentNumber, item])).values()
      )
      uniqueResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0))

      return {
        version: '1.0.0',
        integrationMode: 'rule_based',
        query: input.query,
        domain: input.domain,
        totalFound: uniqueResults.length,
        results: uniqueResults.slice(0, topK),
      }
    } catch (error) {
      return {
        version: '1.0.0',
        error: `查询失败: ${error instanceof Error ? error.message : String(error)}`,
        results: [],
      }
    }
  }
}

export class PatentRuleSearchTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: patentRuleSearchToolSchema.name,
    description: patentRuleSearchToolSchema.description,
    version: patentRuleSearchToolSchema.version,
    inputSchema: patentRuleSearchToolSchema.inputSchema,
  } satisfies import('./BaseMcpTool.js').McpToolMetadata

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm) {
      try {
        const { LegalQAAgent } = await import('@yunpat/agent-legal-qa')

        const legalAgent = new LegalQAAgent({
          name: 'legal-qa-rules',
          description: '审查规则检索智能体',
          llm: context.llm,
          eventBus: context.eventBus!,
          memory: context.memory!,
          tools: context.registry!,
        })

        const result = await legalAgent.execute({
          question: input.query,
          domain: 'patent',
          sources: ['patent_rule'],
        })

        const ruleResults = result.ruleCitations || []

        if (ruleResults.length > 0) {
          return {
            version: '1.0.0',
            integrationMode: 'real_agent',
            query: input.query,
            articleType: input.articleType,
            totalFound: ruleResults.length,
            results: ruleResults.map((item: any) => ({
              articleId: item.articleId,
              title: item.title,
              content: item.content,
              corePrinciple: item.corePrinciple,
              relevance: item.relevance || item.similarity || 0.85,
              articleType: item.articleType,
            })),
          }
        }
      } catch (error) {
        console.warn('[PatentRuleSearchTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    try {
      const { PostgreSQLClient } = await import('@yunpat/unified-knowledge-graph')

      const client = new PostgreSQLClient()

      const results = await client.searchPatentRules({
        query: input.query,
        articleType: input.articleType,
        topK: input.topK || 10,
      })

      return {
        version: '1.0.0',
        integrationMode: 'rule_based',
        query: input.query,
        articleType: input.articleType,
        totalFound: results.length,
        results: results.map((item) => ({
          articleId: item.articleId,
          title: item.title,
          content: item.content,
          corePrinciple: item.corePrinciple,
          relevance: item.similarity || 0.85,
          articleType: item.articleType,
        })),
      }
    } catch (error) {
      return {
        version: '1.0.0',
        error: `查询失败: ${error instanceof Error ? error.message : String(error)}`,
        results: [],
      }
    }
  }
}
