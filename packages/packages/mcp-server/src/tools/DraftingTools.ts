/**
 * 撰写类工具 — 包装 specification-drafter, abstract-drafter, writer Agent
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

// ============================================================
// SpecificationDrafterTool
// ============================================================

const specificationDrafterSchema = z.object({
  inventionUnderstanding: z
    .object({
      technicalField: z.string(),
      technicalProblem: z.string(),
      technicalSolution: z.string(),
      keyFeatures: z.array(z.string()),
    })
    .describe('发明理解结果'),
  priorArtSearch: z.any().optional().describe('现有技术检索结果（可选）'),
  claimsSet: z.any().optional().describe('权利要求集（可选）'),
  draftMode: z
    .enum(['standard', 'detailed', 'concise'])
    .optional()
    .default('standard')
    .describe('撰写模式'),
  patentType: z
    .enum(['invention', 'utilityModel', 'design'])
    .optional()
    .default('invention')
    .describe('专利类型'),
})

export class SpecificationDrafterTool extends BaseMcpTool<
  z.infer<typeof specificationDrafterSchema>,
  any
> {
  readonly metadata = {
    name: 'specification_drafter',
    description:
      '说明书撰写：基于发明理解结果，分章节撰写专利说明书（技术领域、背景技术、发明内容、具体实施方式等）。用于新专利申请的说明书撰写。',
    version: '1.0.0',
    inputSchema: specificationDrafterSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof specificationDrafterSchema>,
    context: McpToolContext
  ): Promise<any> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { SpecificationDrafterAgent } = await import(
          '@yunpat/agent-specification-drafter'
        )
        const agent = new SpecificationDrafterAgent({
          name: 'specification-drafter',
          description: '说明书撰写智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute({
          inventionUnderstanding: input.inventionUnderstanding as any,
          priorArtSearch: input.priorArtSearch as any,
          claimsSet: input.claimsSet as any,
          draftMode: input.draftMode || 'standard',
          patentType: input.patentType || 'invention',
        })
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[SpecificationDrafterTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    // 规则模式 fallback
    const { inventionUnderstanding: iu } = input
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      specification: {
        technicalField: iu.technicalField,
        backgroundArt: '待基于检索结果补充',
        inventionContent: {
          technicalProblem: iu.technicalProblem,
          technicalSolution: iu.technicalSolution,
          beneficialEffects: '待分析',
        },
        embodiments: ['待基于发明理解生成具体实施方式'],
      },
      metrics: { totalWordCount: 0, chapterCount: 1, averageChapterQuality: 0 },
    }
  }
}

// ============================================================
// AbstractDrafterTool
// ============================================================

const abstractDrafterSchema = z.object({
  inventionUnderstanding: z
    .object({
      technicalField: z.string(),
      technicalProblem: z.string(),
      technicalSolution: z.string(),
      keyFeatures: z.array(z.string()),
    })
    .describe('发明理解结果'),
  specification: z.any().optional().describe('说明书内容（可选）'),
  claims: z.any().optional().describe('权利要求集（可选）'),
  maxWords: z.number().optional().default(300).describe('摘要最大字数'),
})

export class AbstractDrafterTool extends BaseMcpTool<
  z.infer<typeof abstractDrafterSchema>,
  any
> {
  readonly metadata = {
    name: 'abstract_drafter',
    description:
      '专利摘要撰写：基于发明理解和说明书内容，生成符合要求的专利摘要。用于专利申请的摘要部分撰写。',
    version: '1.0.0',
    inputSchema: abstractDrafterSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof abstractDrafterSchema>,
    context: McpToolContext
  ) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { AbstractDrafterAgent } = await import('@yunpat/agent-abstract-drafter')
        const agent = new AbstractDrafterAgent({
          name: 'abstract-drafter',
          description: '摘要撰写智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute({
          inventionUnderstanding: input.inventionUnderstanding as any,
          specification: input.specification as any,
          claims: input.claims as any,
          maxWords: input.maxWords || 300,
        })
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[AbstractDrafterTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    // 规则模式 fallback
    const { inventionUnderstanding: iu } = input
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      abstract: {
        content: `本发明涉及${iu.technicalField}领域，特别涉及${iu.technicalSolution}。主要解决${iu.technicalProblem}的问题。`,
        wordCount: 0,
        keyElements: {
          technicalField: true,
          technicalSolution: true,
          beneficialEffects: false,
          application: false,
        },
      },
      confidence: 0.3,
    }
  }
}

// ============================================================
// WriterTool
// ============================================================

const writerSchema = z.object({
  type: z
    .enum(['generate', 'optimize', 'convert', 'format'])
    .describe('操作类型: generate=生成, optimize=优化, convert=转换, format=格式化'),
  topic: z.string().describe('写作主题'),
  format: z
    .enum(['markdown', 'html', 'pdf'])
    .optional()
    .default('markdown')
    .describe('输出格式'),
  requirements: z.array(z.string()).optional().describe('写作要求列表'),
  references: z.array(z.string()).optional().describe('参考资料列表'),
})

export class WriterTool extends BaseMcpTool<z.infer<typeof writerSchema>, any> {
  readonly metadata = {
    name: 'patent_writer_general',
    description:
      '通用专利写作：生成、优化、转换或格式化专利相关文档内容。用于专利文档的撰写辅助和格式处理。',
    version: '1.0.0',
    inputSchema: writerSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof writerSchema>,
    context: McpToolContext
  ) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { WriterAgent } = await import('@yunpat/agent-writer')
        const agent = new WriterAgent({
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        } as any)
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[WriterTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    // 规则模式 fallback
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      content: `# ${input.topic}\n\n待生成完整内容。`,
      format: input.format || 'markdown',
      quality: { clarity: 0.5, coherence: 0.5, completeness: 0.3 },
    }
  }
}
