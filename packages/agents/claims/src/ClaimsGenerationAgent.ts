import { Agent, type ExecutionContext } from '@yunpat/core'
import { PromptTemplateManager } from '@yunpat/patent-prompts'

export interface ClaimGeneratorInput {
  inventionUnderstanding: {
    technicalField: string
    backgroundArt: string
    technicalProblem: string
    technicalSolution: string
    beneficialEffects: string
    keyFeatures: string[]
    drawingDescriptions: string[]
    confidence: number
  }
  priorArtAnalysis?: {
    distinctFeatures: string[]
    closestPriorArt: {
      publicationNumber: string
      title: string
      abstract: string
    }
  }
  specificationDraft?: string
}

export interface IndependentClaim {
  claimNumber: number
  claimType: 'device' | 'method' | 'system' | 'composition'
  preamble: string
  transition: string
  body: string
  fullText: string
  essentialFeatures: string[]
}

export interface DependentClaim {
  claimNumber: number
  parentClaim: number
  content: string
  additionalFeatures: string[]
  limitationType: 'further_limitation' | 'alternative' | 'preferred_embodiment'
}

export interface ClaimsSet {
  independentClaims: IndependentClaim[]
  dependentClaims: DependentClaim[]
  layoutStrategy: string
  protectionScopeAnalysis: string
}

interface ClaimsPlan {
  input: ClaimGeneratorInput
}

export class ClaimsGenerationAgent extends Agent {
  private promptManager?: PromptTemplateManager

  constructor(config: {
    name: string
    description: string
    eventBus: any
    memory: any
    tools: any
    llm: any
    promptManager?: PromptTemplateManager
  }) {
    super(config)
    this.promptManager = config.promptManager
  }

  protected async plan(
    input: ClaimGeneratorInput,
    _context: ExecutionContext
  ): Promise<ClaimsPlan> {
    if (!input.inventionUnderstanding) {
      throw new Error('发明理解结果不能为空')
    }
    if (!input.inventionUnderstanding.technicalProblem?.trim()) {
      throw new Error('技术问题不能为空')
    }
    if (!input.inventionUnderstanding.technicalSolution?.trim()) {
      throw new Error('技术方案不能为空')
    }
    if (!input.inventionUnderstanding.keyFeatures?.length) {
      throw new Error('关键特征不能为空')
    }

    console.log('\n⚖️ [权利要求生成] 步骤1: 规划阶段')
    console.log(`   技术领域: ${input.inventionUnderstanding.technicalField}`)
    console.log(`   关键特征: ${input.inventionUnderstanding.keyFeatures.length} 个`)
    if (input.priorArtAnalysis) {
      console.log(`   现有技术分析: 已提供`)
    }

    return { input }
  }

  protected async act(plan: ClaimsPlan, context: ExecutionContext): Promise<ClaimsSet> {
    console.log('\n✍️ [权利要求生成] 步骤2: 生成阶段')

    const { input } = plan

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成权利要求')
    }

    if (this.promptManager) {
      console.log('[ClaimsGenerationAgent] 加载权利要求生成模板...')
      await this.promptManager.loadTemplate('01-claims-generation')
    }

    const prompt = this.buildClaimsPrompt(input)

    console.log('   1️⃣ 生成独立权利要求...')
    const claimsResponse = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位资深的专利代理师，拥有15年的专利撰写经验，精通中国专利法和审查指南。

你的核心能力包括：
1. 法律知识: 熟练掌握《专利法》第26条第4款、第22条第3款等核心条款
2. 撰写技能: 精通权利要求书的两部分撰写法（前序部分+特征部分）
3. 审查视角: 理解审查员在创造性、新颖性、清楚性、支持性等方面的审查标准

核心撰写原则：
- 清楚性: 权利要求类型清楚，用词准确，避免"例如""最好是"等模糊用语
- 支持性(A26.4): 权利要求以说明书为依据，概括不得超出说明书范围
- 必要技术特征: 独立权利要求必须包含所有必要技术特征
- 两部分撰写法: 前序部分(共有特征) + 特征部分(区别特征)

输出必须是严格的JSON格式。`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    const claimsSet = this.parseClaimsResponse(claimsResponse.message.content)

    console.log(
      `   ✅ 生成完成: ${claimsSet.independentClaims.length} 项独立权利要求, ${claimsSet.dependentClaims.length} 项从属权利要求`
    )
    console.log(`   📐 布局策略: ${claimsSet.layoutStrategy.substring(0, 50)}...`)

    return claimsSet
  }

  private buildClaimsPrompt(input: ClaimGeneratorInput): string {
    const { inventionUnderstanding, priorArtAnalysis } = input

    const essentialFeatures = inventionUnderstanding.keyFeatures.map((feature, index) => ({
      name: `特征${index + 1}`,
      description: feature,
      is_essential: true,
      is_distinguishing: index < 3, // 前3个特征标记为区别特征
    }))

    const priorArtInfo = priorArtAnalysis
      ? `
## 现有技术分析
最接近的现有技术: ${priorArtAnalysis.closestPriorArt.publicationNumber} - ${priorArtAnalysis.closestPriorArt.title}
区别特征: ${priorArtAnalysis.distinctFeatures.join(', ')}
`
      : ''

    return `## 发明信息

发明名称: 基于技术方案的发明
技术领域: ${inventionUnderstanding.technicalField}

## 背景技术
${inventionUnderstanding.backgroundArt}

## 技术问题
${inventionUnderstanding.technicalProblem}

## 技术方案
${inventionUnderstanding.technicalSolution}

## 有益效果
${inventionUnderstanding.beneficialEffects}

## 关键技术特征
${essentialFeatures.map((f) => `- ${f.name}: ${f.description} (${f.is_essential ? '必要' : '可选'}${f.is_distinguishing ? ', 区别特征' : ''})`).join('\n')}

${priorArtInfo}

请根据以上信息生成权利要求书，输出以下JSON格式:

{\n  "independent_claims": [\n    {\n      "claim_number": 1,\n      "claim_type": "device | method | system | composition",\n      "preamble": "前序部分",\n      "transition": "其特征在于",\n      "body": "特征部分",\n      "full_text": "完整的权利要求文本",\n      "essential_features": ["必要特征1", "必要特征2"]\n    }\n  ],\n  "dependent_claims": [\n    {\n      "claim_number": 2,\n      "parent_claim": 1,\n      "content": "从属权利要求内容",\n      "additional_features": ["附加特征"],\n      "limitation_type": "further_limitation | alternative | preferred_embodiment"\n    }\n  ],\n  "layout_strategy": "权利要求布局策略说明",\n  "protection_scope_analysis": "保护范围分析",\n  "quality_check": {\n    "clarity": "清楚性检查",\n    "support": "支持性检查",\n    "essential_features": "必要技术特征检查",\n    "potential_issues": ["潜在问题1", "潜在问题2"]\n  }\n}`
  }

  private parseClaimsResponse(content: string): ClaimsSet {
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('未找到JSON格式的权利要求数据')
      }

      const data = JSON.parse(jsonMatch[0])

      const independentClaims: IndependentClaim[] = (data.independent_claims || []).map(
        (claim: any) => ({
          claimNumber: claim.claim_number || 1,
          claimType: claim.claim_type || 'device',
          preamble: claim.preamble || '',
          transition: claim.transition || '其特征在于',
          body: claim.body || '',
          fullText: claim.full_text || '',
          essentialFeatures: claim.essential_features || [],
        })
      )

      const dependentClaims: DependentClaim[] = (data.dependent_claims || []).map((claim: any) => ({
        claimNumber: claim.claim_number || 2,
        parentClaim: claim.parent_claim || 1,
        content: claim.content || '',
        additionalFeatures: claim.additional_features || [],
        limitationType: claim.limitation_type || 'further_limitation',
      }))

      return {
        independentClaims,
        dependentClaims,
        layoutStrategy: data.layout_strategy || '标准布局',
        protectionScopeAnalysis: data.protection_scope_analysis || '保护范围待分析',
      }
    } catch (error) {
      console.warn('[ClaimsGenerationAgent] JSON解析失败，回退到文本解析:', error)
      return this.parseClaimsFallback(content)
    }
  }

  private parseClaimsFallback(content: string): ClaimsSet {
    const lines = content.split('\n').filter((line) => line.trim().length > 0)
    const independentClaims: IndependentClaim[] = []
    const dependentClaims: DependentClaim[] = []

    let currentClaimNumber = 0
    for (const line of lines) {
      const match = line.match(/^(\d+)\.\s*(.*)$/)
      if (match) {
        currentClaimNumber = parseInt(match[1], 10)
        const claimText = match[2].trim()

        if (currentClaimNumber === 1) {
          independentClaims.push({
            claimNumber: 1,
            claimType: 'device',
            preamble: claimText.split('其特征在于')[0] || claimText,
            transition: '其特征在于',
            body: claimText.split('其特征在于')[1] || '',
            fullText: claimText,
            essentialFeatures: [],
          })
        } else if (claimText.includes('如权利要求')) {
          const parentMatch = claimText.match(/如权利要求(\d+)/)
          dependentClaims.push({
            claimNumber: currentClaimNumber,
            parentClaim: parentMatch ? parseInt(parentMatch[1], 10) : 1,
            content: claimText,
            additionalFeatures: [],
            limitationType: 'further_limitation',
          })
        }
      }
    }

    return {
      independentClaims,
      dependentClaims,
      layoutStrategy: '基于文本解析的布局',
      protectionScopeAnalysis: '保护范围基于权利要求文本分析',
    }
  }
}
