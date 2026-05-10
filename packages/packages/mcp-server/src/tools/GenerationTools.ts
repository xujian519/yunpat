import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'
import { claimsGeneratorToolSchema } from '@yunpat/agent-claim-generator'
import { qualityCheckerToolSchema } from '@yunpat/agent-quality'
import { z } from 'zod'

export class ClaimsGeneratorTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: claimsGeneratorToolSchema.name,
    description: claimsGeneratorToolSchema.description,
    version: claimsGeneratorToolSchema.version,
    inputSchema: claimsGeneratorToolSchema.inputSchema,
  } satisfies import('./BaseMcpTool.js').McpToolMetadata

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { ClaimGeneratorAgent } = await import('@yunpat/agent-claim-generator')

        const claimsAgent = new ClaimGeneratorAgent({
          name: 'claims-generator',
          description: '权利要求生成智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })

        const inventionUnderstanding = {
          inventionConcepts: [
            {
              technicalProblem: input.technicalProblem || '',
              keyFeatures: input.keyFeatures || [],
              technicalEffects: input.beneficialEffects ? [input.beneficialEffects] : [],
              confidence: 0.8,
            },
          ],
          technicalField: input.technicalField || '',
          backgroundArt: '',
          embodimentSummary: input.technicalSolution || '',
          drawingDescriptions: [],
          confidence: 0.8,
          keyFeatures: input.keyFeatures || [],
          technicalProblem: input.technicalProblem || '',
          technicalSolution: input.technicalSolution || '',
          beneficialEffects: input.beneficialEffects || '',
        }

        const result = await claimsAgent.execute({
          inventionUnderstanding,
        })

        return {
          version: '3.0.0',
          integrationMode: 'real_agent',
          ...result,
        }
      } catch (error) {
        console.warn('[ClaimsGeneratorTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    const independentClaim = {
      claimNumber: 1,
      claimType: input.technicalField.includes('方法') ? 'method' : 'device',
      preamble: `一种${input.technicalField}`,
      transition: '其特征在于',
      body: input.keyFeatures.slice(0, 5).join('；') + '。',
      fullText: `一种${input.technicalField}，其特征在于，${input.keyFeatures.slice(0, 5).join('；')}。`,
      essentialFeatures: input.keyFeatures.slice(0, 5),
    }

    const dependentClaims =
      input.enableDependentClaims && input.keyFeatures.length > 1
        ? input.keyFeatures.slice(1).map((feature: string, i: number) => ({
            claimNumber: i + 2,
            claimType: 'dependent',
            parentClaim: 1,
            content: `根据权利要求1所述的${input.technicalField}，其特征在于，${feature}。`,
            additionalFeatures: [feature],
            limitationType: 'further_limitation',
          }))
        : []

    const qualityCheck = {
      clarity: independentClaim.body.length > 20 ? '良好' : '优秀',
      support: '充分',
      essentialFeatures: '完整',
      breadth: this.assessBreadth(independentClaim),
      potentialIssues: [] as string[],
    }

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      claimsSet: {
        independent_claims: [independentClaim],
        dependent_claims: dependentClaims,
        layout_strategy: '标准布局',
        protection_scope_analysis: this.assessProtectionScope(independentClaim),
        quality_check: qualityCheck,
      },
      confidence: this.calculateConfidence(input, independentClaim, dependentClaims),
      fullClaimsText: [
        independentClaim.fullText,
        ...dependentClaims.map((c: any) => c.content),
      ].join('\n\n'),
      recommendations: this.generateRecommendations(independentClaim, dependentClaims, input),
    }
  }

  private assessBreadth(claim: any): string {
    const breadth = claim.body.length / 10
    if (breadth > 25) return '宽'
    if (breadth < 10) return '窄'
    return '适中'
  }

  private assessProtectionScope(claim: any): string {
    return this.assessBreadth(claim)
  }

  private calculateConfidence(input: any, independentClaim: any, dependentClaims: any[]): number {
    let confidence = 0.8

    if (input.keyFeatures.length >= 5) confidence += 0.05
    if (dependentClaims.length >= 3) confidence += 0.05
    if (input.beneficialEffects.length >= 20) confidence += 0.05

    return Math.min(confidence, 0.98)
  }

  private generateRecommendations(
    independentClaim: any,
    dependentClaims: any[],
    input: any
  ): string[] {
    const recommendations = []

    if (dependentClaims.length < 3 && input.keyFeatures.length > 4) {
      recommendations.push('建议增加更多从属权利要求以形成多层次保护')
    }

    if (independentClaim.body.length < 15) {
      recommendations.push('独立权利要求较为简短，建议补充更多技术细节')
    }

    recommendations.push('权利要求布局合理，保护层次清晰')

    return recommendations
  }
}

export class QualityCheckerTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: qualityCheckerToolSchema.name,
    description: qualityCheckerToolSchema.description,
    version: qualityCheckerToolSchema.version,
    inputSchema: qualityCheckerToolSchema.inputSchema,
  } satisfies import('./BaseMcpTool.js').McpToolMetadata

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { QualityCheckerAgent } = await import('@yunpat/agent-quality')

        const qualityAgent = new QualityCheckerAgent({
          name: 'quality-checker',
          description: '质量检查智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })

        const result = await qualityAgent.execute({
          claims: input.claims,
          specification: input.specification,
        })

        return {
          version: '3.0.0',
          integrationMode: 'real_agent',
          ...result,
        }
      } catch (error) {
        console.warn('[QualityCheckerTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    let score = 100
    const issues: any[] = []

    if (!input.claims.independentClaims || input.claims.independentClaims.length === 0) {
      issues.push({
        category: '权利要求',
        severity: 'critical',
        description: '缺少独立权利要求',
        suggestion: '添加独立权利要求',
      })
      score -= 30
    }

    const spec = input.specification
    if (!spec.technicalField) {
      issues.push({
        category: '说明书',
        severity: 'high',
        description: '缺少技术领域',
        suggestion: '补充技术领域章节',
      })
      score -= 10
    }

    if (!spec.detailedDescription || spec.detailedDescription.length < 200) {
      issues.push({
        category: '说明书',
        severity: 'high',
        description: '具体实施方式不充分',
        suggestion: '补充详细实施例',
      })
      score -= 20
    }

    if (!spec.inventionContent || !spec.inventionContent.technicalSolution) {
      issues.push({
        category: '说明书',
        severity: 'high',
        description: '缺少技术方案',
        suggestion: '补充技术方案描述',
      })
      score -= 15
    }

    const recommendations = issues.map((i: any) => ({
      area: i.category,
      priority: i.severity === 'critical' ? 'high' : 'medium',
      suggested: i.suggestion,
      rationale: i.description,
    }))

    return {
      version: '3.0.0',
      integrationMode: 'rule_based',
      overallScore: Math.max(0, score),
      claimsCheck: {
        score: Math.max(0, score - 10),
        protectionScope: {
          status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
          issues: issues.filter((i) => i.category === '权利要求').map((i) => i.description),
        },
        clarity: {
          status: score >= 70 ? 'pass' : 'warning',
          issues: [],
        },
        support: {
          status: score >= 70 ? 'pass' : 'warning',
          issues: [],
        },
      },
      specificationCheck: {
        score: Math.max(0, score - 15),
        disclosure: {
          status: score >= 70 ? 'pass' : 'warning',
          issues: issues.filter((i) => i.category === '说明书').map((i) => i.description),
        },
        termConsistency: {
          status: 'pass',
          inconsistentTerms: [],
        },
        completeness: {
          status: score >= 70 ? 'pass' : 'warning',
          issues: [],
        },
      },
      formalCheck: {
        score: Math.max(0, score - 5),
        errors: issues.map((i) => ({
          type: i.category,
          location: '全文',
          description: i.description,
          severity: i.severity,
        })),
      },
      improvementSuggestions: recommendations,
    }
  }
}

export class PatentWriterTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: 'patent_writer',
    description:
      '专利说明书撰写工具 — 根据技术交底书生成完整的专利说明书（技术领域、背景技术、发明内容、具体实施方式、附图说明）。',
    version: '1.0.0',
    inputSchema: z.object({
      inventionTitle: z.string().min(1).describe('发明名称'),
      technicalField: z.string().min(1).describe('技术领域'),
      technicalProblem: z.string().min(1).describe('技术问题'),
      technicalSolution: z.string().min(1).describe('技术方案'),
      beneficialEffects: z.string().min(1).describe('有益效果'),
      keyFeatures: z.array(z.string()).min(1).describe('关键特征列表'),
      backgroundArt: z.string().optional().describe('背景技术'),
      embodiments: z
        .array(
          z.object({
            title: z.string(),
            content: z.string(),
            relatedDrawings: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe('实施例列表'),
      drawings: z.array(z.string()).optional().describe('附图列表'),
      patentType: z
        .enum(['invention', 'utilityModel', 'design'])
        .default('invention')
        .describe('专利类型'),
      draftMode: z
        .enum(['standard', 'detailed', 'concise'])
        .default('standard')
        .describe('撰写模式'),
    }),
  } satisfies import('./BaseMcpTool.js').McpToolMetadata

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { SpecificationDrafterAgent } = await import('@yunpat/agent-specification-drafter')

        const drafterAgent = new SpecificationDrafterAgent({
          name: 'specification-drafter',
          description: '说明书撰写智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })

        const inventionUnderstanding = {
          inventionConcepts: [
            {
              technicalProblem: input.technicalProblem || '',
              keyFeatures: input.keyFeatures || [],
              technicalEffects: input.beneficialEffects ? [input.beneficialEffects] : [],
              confidence: 0.8,
            },
          ],
          technicalField: input.technicalField || '',
          backgroundArt: input.backgroundArt || '',
          embodimentSummary: input.technicalSolution || '',
          drawingDescriptions: (input.drawings || []).map((d: string) => ({
            figureNumber: d,
            title: d,
            description: '',
            keyElements: [],
          })),
          confidence: 0.8,
          keyFeatures: input.keyFeatures || [],
          technicalProblem: input.technicalProblem || '',
          technicalSolution: input.technicalSolution || '',
          beneficialEffects: input.beneficialEffects || '',
        }

        const result = await drafterAgent.execute({
          inventionUnderstanding,
          drawings: input.drawings,
          patentType: input.patentType,
          draftMode: input.draftMode,
        })

        return {
          version: '1.0.0',
          integrationMode: 'real_agent',
          ...result,
        }
      } catch (error) {
        console.warn('[PatentWriterTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    const sections = []

    sections.push({
      chapter: '技术领域',
      title: '技术领域',
      content: `本发明涉及${input.technicalField}领域，特别涉及一种${input.inventionTitle}。`,
      wordCount: input.technicalField.length + 20,
    })

    sections.push({
      chapter: '背景技术',
      title: '背景技术',
      content:
        input.backgroundArt ||
        `现有${input.technicalField}技术中，存在${input.technicalProblem}等问题，需要一种改进的技术方案。`,
      wordCount: input.backgroundArt ? input.backgroundArt.length : 50,
    })

    const inventionContent = `本发明要解决的技术问题是：${input.technicalProblem}。

为解决上述技术问题，本发明采用的技术方案是：${input.technicalSolution}。

本发明的有益效果是：${input.beneficialEffects}。`

    sections.push({
      chapter: '发明内容',
      title: '发明内容',
      content: inventionContent,
      wordCount: inventionContent.length,
    })

    const embodimentContent =
      input.embodiments && input.embodiments.length > 0
        ? input.embodiments
            .map((e: any, i: number) => `实施例${i + 1}：${e.title}\n\n${e.content}`)
            .join('\n\n')
        : `下面结合具体实施方式对本发明作进一步详细描述。\n\n实施例1：${input.technicalSolution}。`

    sections.push({
      chapter: '具体实施方式',
      title: '具体实施方式',
      content: embodimentContent,
      wordCount: embodimentContent.length,
    })

    if (input.drawings && input.drawings.length > 0) {
      sections.push({
        chapter: '附图说明',
        title: '附图说明',
        content: input.drawings
          .map((d: string, i: number) => `图${i + 1}为${d}的示意图。`)
          .join('\n'),
        wordCount: input.drawings.length * 20,
      })
    }

    const totalWordCount = sections.reduce((sum, s) => sum + s.wordCount, 0)

    return {
      version: '1.0.0',
      integrationMode: 'rule_based',
      inventionTitle: input.inventionTitle,
      specification: {
        sections,
        totalWordCount,
        chapterCount: sections.length,
      },
      qualityScore: {
        overall: 75,
        clarity: 80,
        completeness: 70,
        consistency: 80,
      },
      confidence: 0.75,
      recommendations: [
        '建议补充更多具体实施例以提高充分公开程度',
        '建议在背景技术部分增加对现有技术的具体分析',
        '建议核对术语使用的一致性',
      ],
    }
  }
}
