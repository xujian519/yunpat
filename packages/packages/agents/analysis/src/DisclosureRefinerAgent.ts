import { ProfessionalAgent, type ExtendedExecutionContext } from '@yunpat/agent-base'

export interface TechnicalFeature {
  feature: string
  description: string
  source: 'invention' | 'prior_art' | 'combination'
}

export interface DisclosureRefinerInput {
  originalInvention: {
    technicalField: string
    backgroundArt: string
    technicalProblem: string
    technicalSolution: string
    beneficialEffects: string
    keyFeatures: string[]
    drawingDescriptions: string[]
    confidence: number
  }
  comparisonReport: {
    distinctFeatures: {
      feature: string
      novelty: string
      evidence: string[]
    }[]
    technicalProblem: {
      refined: string
      refinementReason: string
    }
    technicalSolution: {
      refined: {
        core: string
        innovative: string[]
        obvious: string[]
      }
    }
    technicalEffects: {
      refined: {
        unexpected: string[]
        expected: string[]
      }
    }
    inventiveness: {
      score: number
      keyFactors: string[]
    }
  }
}

export interface RefinedInventionUnderstanding {
  original: {
    technicalField: string
    backgroundArt: string
    technicalProblem: string
    technicalSolution: string
    beneficialEffects: string
    keyFeatures: string[]
    drawingDescriptions: string[]
    confidence: number
  }
  refined: {
    inventionTitle: string
    coreInnovation: string
    technicalProblem: string
    technicalSolution: string
    technicalEffects: string[]
    features: {
      innovative: TechnicalFeature[]
      known: TechnicalFeature[]
      combination: TechnicalFeature[]
    }
    protectionScope: {
      independent: string
      dependent: string[]
    }
  }
  improvements: {
    category: string
    description: string
    priority: 'high' | 'medium' | 'low'
  }[]
}

interface RefinerPlan {
  input: DisclosureRefinerInput
}

export class DisclosureRefinerAgent extends ProfessionalAgent {
  protected async plan(
    input: DisclosureRefinerInput,
    _context: ExtendedExecutionContext
  ): Promise<RefinerPlan> {
    if (!input.originalInvention?.technicalProblem?.trim()) {
      throw new Error('原始发明理解不能为空')
    }
    if (!input.comparisonReport?.distinctFeatures?.length) {
      throw new Error('对比分析报告不能为空')
    }

    console.log('\n🔄 [交底书再分析] 步骤1: 规划阶段')
    console.log(`   原始置信度: ${input.originalInvention.confidence.toFixed(2)}`)
    console.log(`   区别特征: ${input.comparisonReport.distinctFeatures.length} 个`)
    console.log(`   创造性评分: ${(input.comparisonReport.inventiveness.score * 100).toFixed(1)}%`)

    return { input }
  }

  protected async act(
    plan: RefinerPlan,
    context: ExtendedExecutionContext
  ): Promise<RefinedInventionUnderstanding> {
    console.log('\n✨ [交底书再分析] 步骤2: 提炼阶段')

    const { input } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行交底书再分析')
    }

    const systemPrompt = `你是一位资深的专利代理师，擅长基于现有技术分析提炼和优化发明理解。

你的任务：
1. 基于对比分析结果，提炼真正的问题-特征-效果
2. 区分创新特征、已知特征和组合特征
3. 优化技术问题的表述，使其更准确
4. 明确保护范围建议
5. 给出改进建议

输出必须是严格的JSON格式。`

    const userPrompt = `## 原始发明理解

技术领域: ${input.originalInvention.technicalField}
背景技术: ${input.originalInvention.backgroundArt}
技术问题: ${input.originalInvention.technicalProblem}
技术方案: ${input.originalInvention.technicalSolution}
有益效果: ${input.originalInvention.beneficialEffects}
关键特征: ${input.originalInvention.keyFeatures.join(', ')}

## 对比分析结果

区别特征:
${input.comparisonReport.distinctFeatures.map((f) => `- ${f.feature} (新颖性: ${f.novelty})`).join('\n')}

提炼后的技术问题: ${input.comparisonReport.technicalProblem.refined}
提炼理由: ${input.comparisonReport.technicalProblem.refinementReason}

创新点: ${input.comparisonReport.technicalSolution.refined.innovative.join(', ')}
显而易见点: ${input.comparisonReport.technicalSolution.refined.obvious.join(', ')}

预料不到的效果: ${input.comparisonReport.technicalEffects.refined.unexpected.join(', ')}
可预期效果: ${input.comparisonReport.technicalEffects.refined.expected.join(', ')}

创造性评分: ${(input.comparisonReport.inventiveness.score * 100).toFixed(1)}%
关键因素: ${input.comparisonReport.inventiveness.keyFactors.join(', ')}

请基于以上信息提炼发明理解，输出以下JSON格式:

{\n  "refined": {\n    "invention_title": "提炼后的发明名称",\n    "core_innovation": "核心创新点",\n    "technical_problem": "提炼后的技术问题",\n    "technical_solution": "提炼后的技术方案",\n    "technical_effects": ["效果1", "效果2"],\n    "features": {\n      "innovative": [\n        { "feature": "创新特征1", "description": "描述", "source": "invention" }\n      ],\n      "known": [\n        { "feature": "已知特征1", "description": "描述", "source": "prior_art" }\n      ],\n      "combination": [\n        { "feature": "组合特征1", "description": "描述", "source": "combination" }\n      ]\n    },\n    "protection_scope": {\n      "independent": "独立权利要求建议",\n      "dependent": ["从属权利要求建议1"]\n    }\n  },\n  "improvements": [\n    {\n      "category": "改进类别",\n      "description": "改进描述",\n      "priority": "high | medium | low"\n    }\n  ]\n}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    const refined = this.parseRefinedResponse(response.message.content, input.originalInvention)

    console.log(`   ✅ 提炼完成`)
    console.log(`      发明名称: ${refined.refined.inventionTitle}`)
    console.log(`      核心创新: ${refined.refined.coreInnovation.substring(0, 50)}...`)
    console.log(`      创新特征: ${refined.refined.features.innovative.length} 个`)
    console.log(`      改进建议: ${refined.improvements.length} 个`)

    return refined
  }

  private parseRefinedResponse(
    content: string,
    original: DisclosureRefinerInput['originalInvention']
  ): RefinedInventionUnderstanding {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('未找到JSON格式的提炼数据')
      }

      const data = JSON.parse(jsonMatch[0])

      return {
        original,
        refined: {
          inventionTitle: data.refined?.invention_title || '',
          coreInnovation: data.refined?.core_innovation || '',
          technicalProblem: data.refined?.technical_problem || '',
          technicalSolution: data.refined?.technical_solution || '',
          technicalEffects: data.refined?.technical_effects || [],
          features: {
            innovative: (data.refined?.features?.innovative || []).map((f: any) => ({
              feature: f.feature || '',
              description: f.description || '',
              source: f.source || 'invention',
            })),
            known: (data.refined?.features?.known || []).map((f: any) => ({
              feature: f.feature || '',
              description: f.description || '',
              source: f.source || 'prior_art',
            })),
            combination: (data.refined?.features?.combination || []).map((f: any) => ({
              feature: f.feature || '',
              description: f.description || '',
              source: f.source || 'combination',
            })),
          },
          protectionScope: {
            independent: data.refined?.protection_scope?.independent || '',
            dependent: data.refined?.protection_scope?.dependent || [],
          },
        },
        improvements: (data.improvements || []).map((i: any) => ({
          category: i.category || '',
          description: i.description || '',
          priority: i.priority || 'medium',
        })),
      }
    } catch (error) {
      console.warn('[DisclosureRefinerAgent] JSON解析失败，回退到默认结构:', error)
      return this.getDefaultRefined(original)
    }
  }

  private getDefaultRefined(
    original: DisclosureRefinerInput['originalInvention']
  ): RefinedInventionUnderstanding {
    return {
      original,
      refined: {
        inventionTitle: '',
        coreInnovation: '',
        technicalProblem: original.technicalProblem,
        technicalSolution: original.technicalSolution,
        technicalEffects: [original.beneficialEffects],
        features: {
          innovative: [],
          known: [],
          combination: [],
        },
        protectionScope: {
          independent: '',
          dependent: [],
        },
      },
      improvements: [],
    }
  }
}
