/**
 * 检索分析类工具 — 包装 prior-art-search, comparison-report-generator, researcher Agent
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'
import type { ToolExecutionResult } from './DraftingTools.js'

// ============================================================
// 类型定义
// ============================================================

/** 权利要求项 */
export interface ClaimItem {
  type: 'independent' | 'dependent'
  number: number
  content: string
  dependsOn?: number
}

/** 说明书内容 */
export interface SpecificationContent {
  technicalField?: string
  backgroundArt?: string
  inventionContent?: string
  embodiment?: string
}

/** 检索选项 */
export interface SearchOptions {
  keywords?: string[]
  classification?: string
  dateRange?: { start: string; end: string }
  applicant?: string
  limit?: number
}

/** 申请信息 */
export interface ApplicationInfo {
  claims?: string[]
  specification?: string
  inventionTitle: string
}

/** 对比文件 */
export interface PriorArtItem {
  patentId?: string
  title: string
  abstract?: string
  claims?: string[]
  description?: string
}

/** 报告选项 */
export interface ReportOptions {
  format?: 'markdown' | 'structured'
  includeTables?: boolean
  language?: 'zh' | 'en'
}

// ============================================================
// PriorArtSearchTool
// ============================================================

const priorArtSearchSchema = z.object({
  inventionTitle: z.string().describe('发明名称'),
  claims: z.array(z.object({
    type: z.enum(['independent', 'dependent']),
    number: z.number(),
    content: z.string(),
    dependsOn: z.number().optional(),
  })).optional().describe('权利要求列表（可选）'),
  specification: z.object({
    technicalField: z.string().optional(),
    backgroundArt: z.string().optional(),
    inventionContent: z.string().optional(),
    embodiment: z.string().optional(),
  }).optional().describe('说明书内容（可选）'),
  patentType: z
    .enum(['invention', 'utilityModel', 'design'])
    .optional()
    .default('invention')
    .describe('专利类型'),
  searchOptions: z.object({
    keywords: z.array(z.string()).optional(),
    classification: z.string().optional(),
    dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
    applicant: z.string().optional(),
    limit: z.number().optional().default(20),
  }).optional().describe('检索选项'),
})

export class PriorArtSearchTool extends BaseMcpTool<z.infer<typeof priorArtSearchSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'prior_art_search',
    description:
      '现有技术检索：基于发明信息和权利要求，构建检索策略并执行现有技术检索，返回检索结果和新颖性评估。用于专利申请前的查新检索。',
    version: '1.0.0',
    inputSchema: priorArtSearchSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof priorArtSearchSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { PriorArtSearchAgent } = await import('@yunpat/agent-prior-art-search')
        const agent = new PriorArtSearchAgent({
          name: 'prior-art-search',
          description: '现有技术检索智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute({
          inventionTitle: input.inventionTitle,
          claims: input.claims as Record<string, unknown> | undefined,
          specification: input.specification as Record<string, unknown> | undefined,
          patentType: input.patentType || 'invention',
          searchOptions: input.searchOptions as Record<string, unknown> | undefined,
        })
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[PriorArtSearchTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    // 规则模式 fallback
    const keywords = input.searchOptions?.keywords || [input.inventionTitle]
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      searchResults: [],
      analysis: {
        keywords,
        searchStrategy: `基于 "${input.inventionTitle}" 的关键词检索`,
      },
      noveltyAssessment: { hasNovelty: true, confidence: 0.3 },
      searchQuery: keywords.join(' AND '),
    }
  }
}

// ============================================================
// ComparisonReportTool
// ============================================================

const comparisonReportSchema = z.object({
  application: z
    .object({
  claims: z.array(z.string()).optional().describe('权利要求列表'),
  specification: z.string().optional().describe('说明书摘要'),
  inventionTitle: z.string().describe('发明名称'),
}).describe('本申请信息'),
priorArt: z.array(
  z.object({
    patentId: z.string().optional(),
    title: z.string(),
    abstract: z.string().optional(),
    claims: z.array(z.string()).optional(),
    description: z.string().optional(),
  })
).describe('对比文件列表'),
options: z.object({
  format: z.enum(['markdown', 'structured']).optional().default('markdown'),
  includeTables: z.boolean().optional().default(true),
  language: z.enum(['zh', 'en']).optional().default('zh'),
}).optional().describe('报告选项'),
})

export class ComparisonReportTool extends BaseMcpTool<z.infer<typeof comparisonReportSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'comparison_report',
    description:
      '对比分析报告生成：生成专利申请与现有技术的对比分析报告，包括技术差异、新颖性和创造性分析。用于专利评估和答复审查意见。',
    version: '1.0.0',
    inputSchema: comparisonReportSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof comparisonReportSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { ComparisonReportGeneratorAgent } =
          await import('@yunpat/comparison-report-generator')
        const agent = new ComparisonReportGeneratorAgent({
          name: 'comparison-report',
          description: '对比报告生成智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute({
          application: input.application as Record<string, unknown>,
          priorArt: input.priorArt as Record<string, unknown>[],
          options: input.options as Record<string, unknown> | undefined,
        })
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[ComparisonReportTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      report: {
        title: `${input.application.inventionTitle} 对比分析报告`,
        summary: `本申请与 ${input.priorArt.length} 篇对比文件的初步对比`,
        sections: [],
        conclusions: ['需要 LLM 进行深度对比分析'],
      },
      analysis: { technicalDifferences: [], advantages: [], novelty: '待分析' },
    }
  }
}

// ============================================================
// ResearcherTool
// ============================================================

const researcherSchema = z.object({
  question: z.string().describe('研究问题'),
  depth: z
    .enum(['quick', 'standard', 'comprehensive'])
    .optional()
    .default('standard')
    .describe('研究深度'),
  sources: z
    .array(z.enum(['web', 'academic', 'database']))
    .optional()
    .default(['web', 'academic'])
    .describe('信息来源'),
  timeRange: z
    .enum(['day', 'week', 'month', 'year', 'all'])
    .optional()
    .default('year')
    .describe('时间范围'),
  maxResults: z.number().optional().default(20).describe('最大结果数'),
})

export class ResearcherTool extends BaseMcpTool<z.infer<typeof researcherSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'research',
    description:
      '研究分析：对给定问题进行信息搜集、数据整理和分析报告生成。支持网络搜索、学术搜索和数据库检索。用于技术调研和竞争情报收集。',
    version: '1.0.0',
    inputSchema: researcherSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof researcherSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { ResearcherAgent } = await import('@yunpat/agent-researcher')
        const agentConfig: Record<string, unknown> & {
          llm: unknown
          eventBus: unknown
          memory: unknown
          tools: unknown
        } = {
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        }
        const agent = new ResearcherAgent(agentConfig)
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[ResearcherTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      keyFindings: ['需要 LLM 进行深度研究分析'],
      dataSummary: { totalResults: 0, credibleSources: 0 },
      searchResults: [],
      metadata: { query: input.question, sourcesAnalyzed: 0 },
    }
  }
}
