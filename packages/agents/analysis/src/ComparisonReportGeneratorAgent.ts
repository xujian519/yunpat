import { Agent, type ExecutionContext } from '@yunpat/core'

export interface ComparisonReportInput {
  inventionUnderstanding: {
    technicalProblem: string
    technicalSolution: string
    technicalEffects: string
    keyFeatures: string[]
  }
  priorArtAnalysis: {
    patentInfo: {
      publicationNumber: string
      title: string
    }
    technicalAnalysis: {
      technicalProblems: { main: string; sub: string[] }
      technicalSolution: {
        core: string
        keyFeatures: { feature: string; necessity: string }[]
      }
      technicalEffects: { main: string; sub: string[] }
    }
    comparison: {
      similarity: number
      overlappingFeatures: string[]
      distinctFeatures: string[]
      novelty: boolean
    }
  }[]
}

export interface ComparisonReport {
  closestPriorArt: {
    publicationNumber: string
    title: string
    similarity: number
    reason: string
  }
  distinctFeatures: {
    feature: string
    novelty: 'high' | 'medium' | 'low'
    evidence: string[]
  }[]
  technicalProblem: {
    original: string
    refined: string
    refinementReason: string
  }
  technicalSolution: {
    original: string
    refined: {
      core: string
      innovative: string[]
      obvious: string[]
    }
  }
  technicalEffects: {
    original: string[]
    refined: {
      unexpected: string[]
      expected: string[]
    }
  }
  inventiveness: {
    score: number
    keyFactors: string[]
  }
  protectionScope: {
    independentClaims: string[]
    dependentClaims: string[][]
    breadth: string
  }
}

interface ReportPlan {
  input: ComparisonReportInput
}

export class ComparisonReportGeneratorAgent extends Agent {
  protected async plan(
    input: ComparisonReportInput,
    _context: ExecutionContext
  ): Promise<ReportPlan> {
    if (!input.inventionUnderstanding?.technicalProblem?.trim()) {
      throw new Error('发明理解结果不能为空')
    }
    if (!input.priorArtAnalysis?.length) {
      throw new Error('现有技术分析结果不能为空')
    }

    console.log('\n📋 [对比分析报告] 步骤1: 规划阶段')
    console.log(`   现有技术: ${input.priorArtAnalysis.length} 篇专利`)
    console.log(`   发明问题: ${input.inventionUnderstanding.technicalProblem.substring(0, 50)}...`)

    return { input }
  }

  protected async act(plan: ReportPlan, context: ExecutionContext): Promise<ComparisonReport> {
    console.log('\n📊 [对比分析报告] 步骤2: 生成阶段')

    const { input } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成对比分析报告')
    }

    const closestPriorArt = this.findClosestPriorArt(input.priorArtAnalysis)

    console.log(`   最接近现有技术: ${closestPriorArt.patentInfo.publicationNumber}`)

    const systemPrompt = `你是一位资深的专利对比分析专家，擅长分析发明与现有技术的区别，评估创造性。

你的任务：
1. 识别发明与最接近现有技术的区别特征
2. 评估区别特征的新颖性程度（高/中/低）
3. 分析技术问题的提炼和 refinement
4. 评估技术方案的创造性
5. 给出保护范围建议

输出必须是严格的JSON格式。`

    const priorArtSummary = input.priorArtAnalysis
      .map(
        (art, index) => `
## 现有技术 ${index + 1}: ${art.patentInfo.publicationNumber}
标题: ${art.patentInfo.title}
技术问题: ${art.technicalAnalysis.technicalProblems.main}
核心方案: ${art.technicalAnalysis.technicalSolution.core}
关键特征: ${art.technicalAnalysis.technicalSolution.keyFeatures.map((f) => f.feature).join(', ')}
相似度: ${(art.comparison.similarity * 100).toFixed(1)}%
区别特征: ${art.comparison.distinctFeatures.join(', ') || '无'}
`
      )
      .join('\n')

    const userPrompt = `## 发明信息

技术问题: ${input.inventionUnderstanding.technicalProblem}
技术方案: ${input.inventionUnderstanding.technicalSolution}
技术效果: ${input.inventionUnderstanding.technicalEffects}
关键特征: ${input.inventionUnderstanding.keyFeatures.join(', ')}

${priorArtSummary}

请生成对比分析报告，输出以下JSON格式:

{\n  "closest_prior_art": {\n    "publication_number": "公开号",\n    "title": "标题",\n    "similarity": 0.5,\n    "reason": "为什么是最接近的现有技术"\n  },\n  "distinct_features": [\n    {\n      "feature": "区别特征",\n      "novelty": "high | medium | low",\n      "evidence": ["证据1", "证据2"]\n    }\n  ],\n  "technical_problem": {\n    "original": "原始技术问题",\n    "refined": "提炼后的技术问题",\n    "refinement_reason": "提炼理由"\n  },\n  "technical_solution": {\n    "original": "原始技术方案",\n    "refined": {\n      "core": "提炼后的核心",\n      "innovative": ["创新点1"],\n      "obvious": ["显而易见点1"]\n    }\n  },\n  "technical_effects": {\n    "original": ["原始效果1"],\n    "refined": {\n      "unexpected": ["预料不到的效果"],\n      "expected": ["可预期的效果"]\n    }\n  },\n  "inventiveness": {\n    "score": 0.7,\n    "key_factors": ["创造性因素1"]\n  },\n  "protection_scope": {\n    "independent_claims": ["独立权利要求建议1"],\n    "dependent_claims": [["从属权利要求建议1"]],\n    "breadth": "保护范围建议"\n  }\n}`

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    const report = this.parseReportResponse(response.message.content)

    console.log(`   ✅ 报告生成完成`)
    console.log(`      最接近现有技术: ${report.closestPriorArt.publicationNumber}`)
    console.log(`      区别特征: ${report.distinctFeatures.length} 个`)
    console.log(`      创造性评分: ${(report.inventiveness.score * 100).toFixed(1)}%`)

    return report
  }

  private findClosestPriorArt(
    priorArtAnalysis: ComparisonReportInput['priorArtAnalysis']
  ): ComparisonReportInput['priorArtAnalysis'][0] {
    return priorArtAnalysis.reduce((closest, current) =>
      current.comparison.similarity > closest.comparison.similarity ? current : closest
    )
  }

  private parseReportResponse(content: string): ComparisonReport {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('未找到JSON格式的报告数据')
      }

      const data = JSON.parse(jsonMatch[0])

      return {
        closestPriorArt: {
          publicationNumber: data.closest_prior_art?.publication_number || '',
          title: data.closest_prior_art?.title || '',
          similarity: data.closest_prior_art?.similarity || 0,
          reason: data.closest_prior_art?.reason || '',
        },
        distinctFeatures: (data.distinct_features || []).map((f: any) => ({
          feature: f.feature || '',
          novelty: f.novelty || 'medium',
          evidence: f.evidence || [],
        })),
        technicalProblem: {
          original: data.technical_problem?.original || '',
          refined: data.technical_problem?.refined || '',
          refinementReason: data.technical_problem?.refinement_reason || '',
        },
        technicalSolution: {
          original: data.technical_solution?.original || '',
          refined: {
            core: data.technical_solution?.refined?.core || '',
            innovative: data.technical_solution?.refined?.innovative || [],
            obvious: data.technical_solution?.refined?.obvious || [],
          },
        },
        technicalEffects: {
          original: data.technical_effects?.original || [],
          refined: {
            unexpected: data.technical_effects?.refined?.unexpected || [],
            expected: data.technical_effects?.refined?.expected || [],
          },
        },
        inventiveness: {
          score: data.inventiveness?.score || 0,
          keyFactors: data.inventiveness?.key_factors || [],
        },
        protectionScope: {
          independentClaims: data.protection_scope?.independent_claims || [],
          dependentClaims: data.protection_scope?.dependent_claims || [],
          breadth: data.protection_scope?.breadth || '',
        },
      }
    } catch (error) {
      console.warn('[ComparisonReportGeneratorAgent] JSON解析失败，回退到默认结构:', error)
      return this.getDefaultReport()
    }
  }

  private getDefaultReport(): ComparisonReport {
    return {
      closestPriorArt: { publicationNumber: '', title: '', similarity: 0, reason: '' },
      distinctFeatures: [],
      technicalProblem: { original: '', refined: '', refinementReason: '' },
      technicalSolution: {
        original: '',
        refined: { core: '', innovative: [], obvious: [] },
      },
      technicalEffects: {
        original: [],
        refined: { unexpected: [], expected: [] },
      },
      inventiveness: { score: 0, keyFactors: [] },
      protectionScope: {
        independentClaims: [],
        dependentClaims: [],
        breadth: '',
      },
    }
  }
}
