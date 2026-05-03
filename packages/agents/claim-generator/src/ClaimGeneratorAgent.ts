import { Agent, type ExecutionContext } from '@yunpat/core'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchOutput } from '@yunpat/agent-prior-art-search'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

/**
 * 权利要求生成智能体输入
 */
export interface ClaimGeneratorInput {
  /** 发明理解结果（来自Phase 2） */
  inventionUnderstanding: InventionUnderstandingOutput
  /** 先导技术检索结果（来自Phase 3） */
  priorArtSearch?: PriorArtSearchOutput
  /** 说明书草稿（可选） */
  specificationDraft?: string
  /** 是否启用逐段确认 */
  enableStepwiseConfirmation?: boolean
}

/**
 * 独立权利要求
 */
export interface IndependentClaim {
  /** 权利要求编号 */
  claim_number: number
  /** 权利要求类型 */
  claim_type: 'device' | 'method' | 'system' | 'composition'
  /** 前序部分 */
  preamble: string
  /** 过渡语 */
  transition: string
  /** 特征部分 */
  body: string
  /** 完整文本 */
  full_text: string
  /** 必要技术特征 */
  essential_features: string[]
}

/**
 * 从属权利要求
 */
export interface DependentClaim {
  /** 权利要求编号 */
  claim_number: number
  /** 引用的权利要求 */
  parent_claim: number
  /** 权利要求内容 */
  content: string
  /** 附加特征 */
  additional_features: string[]
  /** 限定类型 */
  limitation_type: 'further_limitation' | 'alternative' | 'preferred_embodiment'
}

/**
 * 权利要求集合
 */
export interface ClaimsSet {
  /** 独立权利要求列表 */
  independent_claims: IndependentClaim[]
  /** 从属权利要求列表 */
  dependent_claims: DependentClaim[]
  /** 布局策略说明 */
  layout_strategy: string
  /** 保护范围分析 */
  protection_scope_analysis: string
  /** 质量检查 */
  quality_check: {
    /** 清楚性检查 */
    clarity: string
    /** 支持性检查（A26.4） */
    support: string
    /** 必要技术特征检查 */
    essential_features: string
    /** 潜在问题 */
    potential_issues: string[]
  }
}

/**
 * 权利要求生成输出
 */
export interface ClaimGeneratorOutput {
  /** 权利要求集合 */
  claimsSet: ClaimsSet
  /** 生成置信度 */
  confidence: number
}

interface ClaimGeneratorPlan {
  input: ClaimGeneratorInput
  templateContent: string
  structuredInput: any
}

/**
 * 权利要求生成智能体
 *
 * 功能：
 * 1. 基于发明理解和检索分析构建结构化输入
 * 2. 使用专业的权利要求模板生成权利要求
 * 3. 支持逐段确认机制
 * 4. 输出结构化的权利要求集合
 */
export class ClaimGeneratorAgent extends Agent<
  ClaimGeneratorInput,
  ClaimGeneratorOutput
> {
  private templatePath: string

  constructor(config: any) {
    super({
      ...config,
      name: config.name || 'claim-generator',
      description: config.description || '权利要求生成智能体 - 专业的权利要求书撰写',
    })
    this.templatePath = config.templatePath ||
      resolve(process.cwd(), 'patents/prompts/templates/patent-drafting/01-claims-generation.md')
  }

  protected async plan(
    input: ClaimGeneratorInput,
    context: ExecutionContext
  ): Promise<ClaimGeneratorPlan> {
    if (!input.inventionUnderstanding) {
      throw new Error('发明理解结果不能为空')
    }

    const { inventionUnderstanding } = input

    console.log('\n📝 [权利要求生成] 步骤1: 规划阶段')
    console.log(`   发明名称: ${inventionUnderstanding.technicalField}`)
    console.log(`   关键特征: ${inventionUnderstanding.keyFeatures.length} 个`)

    // 读取模板内容
    const templateContent = await this.loadTemplate()

    // 构建结构化输入
    const structuredInput = this.buildStructuredInput(input)

    return {
      input,
      templateContent,
      structuredInput,
    }
  }

  protected async act(
    plan: ClaimGeneratorPlan,
    context: ExecutionContext
  ): Promise<ClaimGeneratorOutput> {
    console.log('\n📝 [权利要求生成] 步骤2: 撰写阶段')

    const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写权利要求：
1. 清楚性原则：用词清楚，类型明确
2. 简要性原则：简明扼要，不描述原因理由
3. 支持性原则：以说明书为依据，不超出公开范围
4. 必要技术特征原则：只写入解决技术问题不可缺少的特征

使用两部分撰写法：
- 前序部分：发明名称 + 与现有技术共有的必要技术特征
- 特征部分："其特征在于" + 区别于现有技术的技术特征

输出必须是严格的 JSON 格式。`

    const userPrompt = `基于以下发明理解和检索分析，撰写权利要求：

## 发明理解

### 技术领域
${plan.structuredInput.technical_field}

### 背景技术
${plan.structuredInput.background_art || '无'}

### 技术问题
${plan.structuredInput.technical_problem}

### 技术方案
${plan.structuredInput.technical_solution}

### 技术效果
${plan.structuredInput.technical_effects?.join(', ') || '无'}

### 关键特征
${plan.structuredInput.essential_features?.map((f: any, i: number) =>
  `${i + 1}. ${f.name || f}`
).join('\n') || ''}

${plan.input.priorArtSearch ? `
## 先导技术分析

### 最接近的现有技术
${plan.input.priorArtSearch.comparisonAnalysis.closestPriorArt.title}

### 区别特征
${plan.input.priorArtSearch.comparisonAnalysis.differences.join('\n')}

### 实际解决的技术问题
${plan.input.priorArtSearch.comparisonAnalysis.technicalProblemSolved}
` : ''}

请输出以下 JSON 格式：
{
  "independent_claims": [
    {
      "claim_number": 1,
      "claim_type": "device",
      "preamble": "前序部分",
      "transition": "其特征在于",
      "body": "特征部分",
      "full_text": "完整权利要求文本",
      "essential_features": ["必要特征1", "必要特征2"]
    }
  ],
  "dependent_claims": [
    {
      "claim_number": 2,
      "parent_claim": 1,
      "content": "从属权利要求内容",
      "additional_features": ["附加特征"],
      "limitation_type": "further_limitation"
    }
  ],
  "layout_strategy": "权利要求布局说明",
  "protection_scope_analysis": "保护范围分析",
  "quality_check": {
    "clarity": "清楚性检查结果",
    "support": "支持性检查结果",
    "essential_features": "必要技术特征检查结果",
    "potential_issues": ["潜在问题1"]
  }
}`

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行权利要求生成')
    }

    const result = await this.callLLMWithFallback(
      context.llm,
      systemPrompt,
      userPrompt,
      plan.input
    )

    console.log(`\n✅ [权利要求生成] 撰写完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   独立权利要求: ${result.claimsSet.independent_claims.length} 项`)
    console.log(`   从属权利要求: ${result.claimsSet.dependent_claims.length} 项`)

    return result
  }

  /**
   * 加载权利要求模板
   */
  private async loadTemplate(): Promise<string> {
    try {
      return await readFile(this.templatePath, 'utf-8')
    } catch (error) {
      console.warn(`无法加载模板文件 ${this.templatePath}，使用默认配置`)
      return ''
    }
  }

  /**
   * 构建结构化输入
   */
  private buildStructuredInput(input: ClaimGeneratorInput): any {
    const { inventionUnderstanding } = input

    return {
      invention_title: inventionUnderstanding.technicalField.split(',')[0],
      invention_type: this.inferInventionType(inventionUnderstanding),
      technical_field: inventionUnderstanding.technicalField,
      background_art: inventionUnderstanding.backgroundArt,
      technical_problem: inventionUnderstanding.technicalProblem,
      technical_solution: inventionUnderstanding.technicalSolution,
      technical_effects: inventionUnderstanding.beneficialEffects
        ? [inventionUnderstanding.beneficialEffects]
        : [],
      essential_features: inventionUnderstanding.keyFeatures.map((feature, index) => ({
        name: `特征${index + 1}`,
        description: feature,
        is_essential: true,
        is_distinguishing: true,
      })),
      optional_features: [],
      prior_art_analysis: input.priorArtSearch ? {
        closest_prior_art: input.priorArtSearch.comparisonAnalysis.closestPriorArt.title,
        differences: input.priorArtSearch.comparisonAnalysis.differences,
        technical_problem_solved: input.priorArtSearch.comparisonAnalysis.technicalProblemSolved,
      } : undefined,
    }
  }

  /**
   * 推断发明类型
   */
  private inferInventionType(understanding: InventionUnderstandingOutput): string {
    const field = understanding.technicalField.toLowerCase()
    const solution = understanding.technicalSolution.toLowerCase()

    if (field.includes('方法') || solution.includes('步骤') || solution.includes('流程')) {
      return 'method'
    } else if (field.includes('系统') || solution.includes('平台')) {
      return 'system'
    } else if (field.includes('组合物') || field.includes('材料')) {
      return 'composition'
    } else {
      return 'device'
    }
  }

  private async callLLMWithFallback(
    llm: NonNullable<ExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string,
    input: ClaimGeneratorInput
  ): Promise<ClaimGeneratorOutput> {
    const maxRetries = 2
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await llm.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        })

        const content = response.message.content
        const parsed = this.safeParseJSON(content)

        if (parsed) {
          return this.normalizeOutput(parsed, input)
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(
          `[ClaimGeneratorAgent] LLM 调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
        )
      }
    }

    console.error('[ClaimGeneratorAgent] 权利要求生成失败，使用回退输出:', lastError)
    return this.createFallbackOutput(input)
  }


  private normalizeOutput(
    parsed: Record<string, unknown>,
    input: ClaimGeneratorInput
  ): ClaimGeneratorOutput {
    const getArray = (key: string): any[] => {
      const value = parsed[key]
      return Array.isArray(value) ? value : []
    }

    const getString = (key: string, fallback = ''): string => {
      const value = parsed[key]
      return typeof value === 'string' ? value : fallback
    }

    const getNumber = (key: string, fallback: number): number => {
      const value = parsed[key]
      return typeof value === 'number' && !isNaN(value) ? value : fallback
    }

    // 解析独立权利要求
    const independentClaimsRaw = getArray('independent_claims')
    const independent_claims: IndependentClaim[] = independentClaimsRaw.map((claim: any) => ({
      claim_number: getNumber('claim_number', 1),
      claim_type: claim.claim_type || 'device',
      preamble: getString('preamble'),
      transition: getString('transition', '其特征在于'),
      body: getString('body'),
      full_text: getString('full_text'),
      essential_features: getArray('essential_features'),
    }))

    // 解析从属权利要求
    const dependentClaimsRaw = getArray('dependent_claims')
    const dependent_claims: DependentClaim[] = dependentClaimsRaw.map((claim: any) => ({
      claim_number: getNumber('claim_number', 2),
      parent_claim: getNumber('parent_claim', 1),
      content: getString('content'),
      additional_features: getArray('additional_features'),
      limitation_type: claim.limitation_type || 'further_limitation',
    }))

    // 解析质量检查
    const qualityCheckRaw = parsed.quality_check as Record<string, unknown> | undefined
    const quality_check = {
      clarity: qualityCheckRaw ? getString('clarity', '清楚') : '清楚',
      support: qualityCheckRaw ? getString('support', '支持') : '支持',
      essential_features: qualityCheckRaw ? getString('essential_features', '完整') : '完整',
      potential_issues: qualityCheckRaw ? getArray('potential_issues') : [],
    }

    const claimsSet: ClaimsSet = {
      independent_claims,
      dependent_claims,
      layout_strategy: getString('layout_strategy', '标准布局'),
      protection_scope_analysis: getString('protection_scope_analysis', '保护范围合理'),
      quality_check,
    }

    return {
      claimsSet,
      confidence: getNumber('confidence', 0.8),
    }
  }

  private createFallbackOutput(input: ClaimGeneratorInput): ClaimGeneratorOutput {
    const { inventionUnderstanding } = input

    // 生成简单的独立权利要求
    const independentClaim: IndependentClaim = {
      claim_number: 1,
      claim_type: 'device',
      preamble: `一种${inventionUnderstanding.technicalField.split(',')[0]}`,
      transition: '其特征在于',
      body: inventionUnderstanding.keyFeatures.slice(0, 3).join('；') + '。',
      full_text: `一种${inventionUnderstanding.technicalField.split(',')[0]}，其特征在于：${inventionUnderstanding.keyFeatures.slice(0, 3).join('；')}。`,
      essential_features: inventionUnderstanding.keyFeatures.slice(0, 3),
    }

    return {
      claimsSet: {
        independent_claims: [independentClaim],
        dependent_claims: [],
        layout_strategy: '简化布局（由于生成失败）',
        protection_scope_analysis: '无法准确评估',
        quality_check: {
          clarity: '基础清楚',
          support: '基础支持',
          essential_features: '基础完整',
          potential_issues: ['AI生成失败，使用简化版本'],
        },
      },
      confidence: 0.5,
    }
  }
}
