/**
 * 发明理解类工具 — 包装 invention 和 analysis Agent
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

// ============================================================
// InventionUnderstandingTool
// ============================================================

const inventionUnderstandingSchema = z.object({
  inventionTitle: z.string().describe('发明名称'),
  technicalField: z.string().describe('技术领域'),
  technicalDisclosure: z.string().describe('技术交底书内容'),
  priorArt: z.array(z.string()).optional().describe('现有技术描述列表'),
  drawings: z.array(z.string()).optional().describe('附图列表'),
  applicant: z.string().optional().describe('申请人'),
  inventors: z.array(z.string()).optional().describe('发明人列表'),
})

export class InventionUnderstandingTool extends BaseMcpTool<
  z.infer<typeof inventionUnderstandingSchema>,
  any
> {
  readonly metadata = {
    name: 'invention_understanding',
    description:
      '发明理解分析：解析技术交底书，提取发明概念、关键技术特征、技术问题-解决方案-效果三元组。用于专利申请前的发明理解和结构化分析。',
    version: '1.0.0',
    inputSchema: inventionUnderstandingSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof inventionUnderstandingSchema>,
    context: McpToolContext
  ): Promise<any> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
        const agent = new InventionUnderstandingAgent({
          name: 'invention-understanding',
          description: '发明理解智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute({
          title: input.inventionTitle,
          field: input.technicalField,
          technicalDisclosure: input.technicalDisclosure,
          priorArt: input.priorArt,
          drawings: input.drawings,
          applicant: input.applicant,
          inventors: input.inventors,
        })
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[InventionUnderstandingTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    // 规则模式 fallback
    const concepts = input.technicalDisclosure
      .split(/[。；\n]/)
      .filter((s) => s.trim().length > 5)
      .slice(0, 5)
      .map((s) => ({
        problem: s.trim(),
        feature: s.trim().substring(0, 30),
        effect: '提升技术效果',
      }))

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      inventionConcepts: concepts,
      technicalField: input.technicalField,
      keyFeatures: concepts.map((c) => c.feature),
      technicalProblem: input.technicalDisclosure.substring(0, 100),
      technicalSolution: input.inventionTitle,
      beneficialEffects: '待分析',
      confidence: 0.5,
    }
  }
}

// ============================================================
// PriorArtAnalyzerTool
// ============================================================

const priorArtAnalysisSchema = z.object({
  document: z
    .object({
      type: z.enum(['patent', 'paper', 'report']).describe('文档类型'),
      title: z.string().describe('文档标题'),
      content: z.string().describe('文档内容'),
    })
    .describe('待分析的现有技术文档'),
  analysisDepth: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .default(2)
    .describe('分析深度: 1=基础, 2=标准, 3=深度'),
  enableKnowledgeEnhancement: z
    .boolean()
    .optional()
    .default(false)
    .describe('是否启用知识增强'),
})

export class PriorArtAnalyzerTool extends BaseMcpTool<
  z.infer<typeof priorArtAnalysisSchema>,
  any
> {
  readonly metadata = {
    name: 'prior_art_analysis',
    description:
      '现有技术深度分析：分析专利/论文/报告，提取技术问题、解决方案、关键特征，评估新颖性和创造性。用于对比分析和现有技术调研。',
    version: '1.0.0',
    inputSchema: priorArtAnalysisSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof priorArtAnalysisSchema>,
    context: McpToolContext
  ): Promise<any> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { PriorArtAnalyzerAgent } = await import('@yunpat/agent-analysis')
        const agent = new PriorArtAnalyzerAgent({
          name: 'prior-art-analyzer',
          description: '现有技术分析智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute({
          document: input.document,
          analysisDepth: input.analysisDepth || 2,
          enableKnowledgeEnhancement: input.enableKnowledgeEnhancement || false,
        })
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[PriorArtAnalyzerTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    // 规则模式 fallback
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      documentInfo: { type: input.document.type, title: input.document.title },
      technicalProblem: { main: '待分析', sub: [], severity: 'medium' },
      technicalSolution: {
        core: input.document.content.substring(0, 200),
        keyFeatures: input.document.content.split(/[，。、]/).slice(0, 5),
      },
      noveltyAssessment: { hasNovelty: true, distinguishingFeatures: [], confidence: 0.3 },
      overallAssessment: '规则模式分析 — 需要 LLM 进行深度分析',
    }
  }
}
