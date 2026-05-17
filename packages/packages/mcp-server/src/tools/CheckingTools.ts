/**
 * 检查类工具 — 包装 subject-matter-checker, unity-checker, spec-formality-checker, tech-unit Agent
 */

import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'
import type { ToolExecutionResult } from './DraftingTools.js'
import type { ClaimItem, SpecificationContent } from './SearchAnalysisTools.js'

// ============================================================
// 类型定义
// ============================================================

/** 带类别的权利要求 */
export interface ClaimWithCategory extends ClaimItem {
  category?: string
}

/** 智能体构造函数配置 */
type AgentConstructorConfig = Record<string, unknown>

// ============================================================
// SubjectMatterCheckerTool
// ============================================================

const subjectMatterSchema = z.object({
  inventionTitle: z.string().describe('发明名称'),
  claims: z
    .array(
      z.object({
        type: z.enum(['independent', 'dependent']),
        number: z.number(),
        content: z.string(),
      })
    )
    .describe('权利要求列表'),
  specification: z
    .object({
      technicalField: z.string().optional(),
      backgroundArt: z.string().optional(),
      inventionContent: z.string().optional(),
    })
    .optional()
    .describe('说明书内容（可选）'),
  patentType: z
    .enum(['invention', 'utilityModel'])
    .optional()
    .default('invention')
    .describe('专利类型'),
})

export class SubjectMatterCheckerTool extends BaseMcpTool<
  z.infer<typeof subjectMatterSchema>,
  ToolExecutionResult
> {
  readonly metadata = {
    name: 'subject_matter_check',
    description:
      '保护客体检查：依据专利法第2条和第25条，检查权利要求是否属于可授予专利权的保护客体。用于专利申请前的合规性预检。',
    version: '1.0.0',
    inputSchema: subjectMatterSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof subjectMatterSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const module = await import('@yunpat/subject-matter-checker')
        const AgentClass = 'SubjectMatterChecker' in module
          ? (module as { SubjectMatterChecker: new (config: Record<string, unknown>) => { execute(input: unknown): Promise<unknown> } }).SubjectMatterChecker
          : (module as { default: new (config: Record<string, unknown>) => { execute(input: unknown): Promise<unknown> } }).default

        const agent = new AgentClass({
          name: 'subject-matter-checker',
          description: '保护客体检查智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        } satisfies AgentConstructorConfig)
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[SubjectMatterCheckerTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      article2Check: {
        passed: true,
        isTechnicalSolution: true,
        analysis: '规则模式预检',
        issues: [],
      },
      article25Check: { passed: true, nonProtectableSubjects: [], issues: [] },
      overallResult: {
        isProtectable: true,
        recommendations: ['建议使用 LLM 模式进行深度检查'],
        confidence: 0.3,
      },
    }
  }
}

// ============================================================
// UnityCheckerTool
// ============================================================

const unityCheckSchema = z.object({
  claims: z
    .array(
      z.object({
        type: z.enum(['independent', 'dependent']),
        number: z.number(),
        content: z.string(),
        dependsOn: z.number().optional(),
        category: z.string().optional(),
      })
    )
    .describe('权利要求列表'),
  patentType: z
    .enum(['invention', 'utilityModel'])
    .optional()
    .default('invention')
    .describe('专利类型'),
  inventionTitle: z.string().optional().describe('发明名称'),
})

export class UnityCheckerTool extends BaseMcpTool<z.infer<typeof unityCheckSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'unity_check',
    description:
      '单一性检查：依据实施细则第43-44条，检查权利要求是否满足单一性要求。用于专利申请前的单一性预检。',
    version: '1.0.0',
    inputSchema: unityCheckSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof unityCheckSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const module = await import('@yunpat/unity-checker')
        const AgentClass = 'UnityChecker' in module
          ? (module as { UnityChecker: new (config: Record<string, unknown>) => { execute(input: unknown): Promise<unknown> } }).UnityChecker
          : (module as { default: new (config: Record<string, unknown>) => { execute(input: unknown): Promise<unknown> } }).default

        const agent = new AgentClass({
          name: 'unity-checker',
          description: '单一性检查智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        } satisfies AgentConstructorConfig)
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[UnityCheckerTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    const independentClaims = input.claims.filter((c) => c.type === 'independent')
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      article43Check: {
        hasUnity: independentClaims.length <= 1,
        unifiedGroups:
          independentClaims.length > 1 ? [independentClaims.map((c) => c.number)] : [[1]],
        nonUnifiedClaims: [],
        analysis: `共 ${independentClaims.length} 个独立权利要求`,
      },
      overallResult: {
        passed: independentClaims.length <= 1,
        recommendations: [],
        confidence: 0.3,
      },
    }
  }
}

// ============================================================
// SpecFormalityCheckerTool
// ============================================================

const specFormalitySchema = z.object({
  specification: z.string().describe('说明书全文'),
  checkItems: z
    .array(z.enum(['section_completeness', 'section_order', 'word_count', 'format', 'terminology']))
    .optional()
    .default(['section_completeness', 'section_order', 'word_count'])
    .describe('检查项列表'),
})

export class SpecFormalityCheckerTool extends BaseMcpTool<
  z.infer<typeof specFormalitySchema>,
  ToolExecutionResult
> {
  readonly metadata = {
    name: 'spec_formality_check',
    description:
      '说明书格式检查：检查专利说明书的章节完整性、顺序、字数、格式和术语一致性。用于提交前的格式合规检查。',
    version: '1.0.0',
    inputSchema: specFormalitySchema,
  }

  protected async executeInternal(
    input: z.infer<typeof specFormalitySchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const module = await import('@yunpat/spec-formality-checker')
        const AgentClass = 'SpecFormalityChecker' in module
          ? (module as { SpecFormalityChecker: new (config: Record<string, unknown>) => { execute(input: unknown): Promise<unknown> } }).SpecFormalityChecker
          : (module as { default: new (config: Record<string, unknown>) => { execute(input: unknown): Promise<unknown> } }).default

        const agent = new AgentClass({
          name: 'spec-formality-checker',
          description: '说明书格式检查智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        } satisfies AgentConstructorConfig)
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[SpecFormalityCheckerTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      passed: input.specification.length > 300,
      score: input.specification.length > 300 ? 60 : 30,
      details: {
        section_completeness: { status: 'unknown', issues: ['需要 LLM 进行章节分析'] },
        word_count: { status: input.specification.length > 300 ? 'pass' : 'fail', issues: [] },
      },
    }
  }
}

// ============================================================
// TechUnitExtractorTool
// ============================================================

const techUnitSchema = z.object({
  claimText: z.string().describe('权利要求文本'),
  schemeType: z.enum(['product', 'method']).optional().describe('方案类型（可选，自动检测）'),
  technicalField: z.string().optional().describe('技术领域（可选）'),
})

export class TechUnitExtractorTool extends BaseMcpTool<z.infer<typeof techUnitSchema>, ToolExecutionResult> {
  readonly metadata = {
    name: 'tech_unit_extract',
    description:
      '最小技术单元提取：从权利要求中划分技术特征并识别最小技术单元。用于侵权判定和创造性分析的基础准备。',
    version: '1.0.0',
    inputSchema: techUnitSchema,
  }

  protected async executeInternal(
    input: z.infer<typeof techUnitSchema>,
    context: McpToolContext
  ): Promise<ToolExecutionResult> {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { MinimumTechUnitAgent } = await import('@yunpat/agent-tech-unit')
        const agent = new MinimumTechUnitAgent({
          name: 'tech-unit',
          description: '最小技术单元提取智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })
        const result = await agent.execute(input)
        return { version: '3.0.0', integrationMode: 'real_agent', ...result }
      } catch (error) {
        console.warn('[TechUnitExtractorTool] 智能体调用失败，回退规则模式:', error)
      }
    }

    const sentences = input.claimText.split(/[，；]/).filter((s) => s.trim().length > 2)
    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      schemeType: input.schemeType || 'product',
      units: sentences.slice(0, 10).map((s, i) => ({
        id: i + 1,
        content: s.trim(),
        isPrimary: i === 0,
      })),
      summary: { totalUnits: sentences.length, primaryFeatureCount: 1 },
    }
  }
}
