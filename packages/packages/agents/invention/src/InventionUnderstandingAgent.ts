/**
 * 发明理解智能体
 *
 * 功能：
 * 1. 多阶段知识检索（方法论→术语→领域→验证）
 * 2. 提取多组问题-特征-效果三元组
 * 3. 术语标准化
 * 4. 一致性验证
 * 5. 知识库缓存
 */

import {
  ProfessionalAgent,
  type ProfessionalAgentConfig,
  type ExtendedExecutionContext,
} from '@yunpat/agent-base'
import { SkillLoader } from '@yunpat/core'
import { join } from 'path'
import {
  type InventionUnderstandingInput,
  type InventionUnderstandingOutput,
  type KnowledgeRetrievalResult,
  type KnowledgeItem,
  type InventionPlan,
  KnowledgeCache,
  RetrievalScenario,
  FIELD_GUIDE_MAP,
  TERMINOLOGY_MAP_ENTRIES,
} from './types.js'

export {
  InventionUnderstandingInput,
  InventionUnderstandingOutput,
  InventionUnderstandingError,
} from './types.js'

import { searchExternalKnowledge } from './ExternalSearcher.js'

import {
  normalizeTerminology,
  validateConsistency,
  normalizeOutput,
  calculateOverallConfidence,
  extractEmbodiment,
  summarizePriorArt,
  extractTerminologyMappings,
} from './OutputProcessor.js'

interface InventionUnderstandingConfig extends ProfessionalAgentConfig {
  skillLoader?: SkillLoader
}

export class InventionUnderstandingAgent extends ProfessionalAgent<
  InventionUnderstandingInput,
  InventionUnderstandingOutput
> {
  private cache = new KnowledgeCache()
  private skillLoader?: SkillLoader
  private readonly terminologyMap = new Map(TERMINOLOGY_MAP_ENTRIES)

  constructor(config: InventionUnderstandingConfig = {} as InventionUnderstandingConfig) {
    super(config)
    this.skillLoader =
      config.skillLoader ||
      new SkillLoader({
        baseDir: join(process.cwd(), '.yunpat/skills/invention-understanding'),
      })
  }

  protected async plan(
    input: InventionUnderstandingInput,
    _context: ExtendedExecutionContext
  ): Promise<InventionPlan> {
    this.checkInventionInput(input)

    console.log('\n🔍 [发明理解] 步骤1: 规划与知识检索阶段')
    console.log(`   发明名称: ${input.title}`)
    console.log(`   技术领域: ${input.field}`)
    console.log(`   交底书长度: ${input.technicalDisclosure.length} 字符`)

    const knowledge = await this.performMultiStageRetrieval(input)

    console.log(`   ✅ 知识检索完成`)
    console.log(
      `   - 方法论: ${knowledge.methodology.problem.length + knowledge.methodology.feature.length + knowledge.methodology.effect.length + knowledge.methodology.triplet.length} 条`
    )
    console.log(`   - 术语映射: ${knowledge.terminology.size} 条`)
    console.log(`   - 验证规则: ${knowledge.validationRules.length} 条`)
    console.log(`   - 外部资料: ${knowledge.externalKnowledge.length} 条`)

    return { input, knowledge }
  }

  protected async act(
    plan: InventionPlan,
    _context: ExtendedExecutionContext
  ): Promise<InventionUnderstandingOutput> {
    console.log('\n🧠 [发明理解] 步骤2: 分析与提取阶段')

    if (!_context.llm) {
      throw new Error('LLM 未配置，无法执行发明理解')
    }

    const { input, knowledge } = plan

    const preliminaryResult = await this.extractTriplets(_context.llm, input, knowledge)

    const normalizedResult = normalizeTerminology(preliminaryResult, knowledge.terminology)

    const validationResult = validateConsistency(normalizedResult, knowledge.validationRules)

    const allKeyFeatures = normalizedResult.inventionConcepts.flatMap(
      (concept) => concept.keyFeatures
    )
    const allTechnicalEffects = normalizedResult.inventionConcepts.flatMap(
      (concept) => concept.technicalEffects
    )
    const primaryProblem =
      normalizedResult.inventionConcepts.length > 0
        ? normalizedResult.inventionConcepts[0].technicalProblem
        : ''
    const primarySolution =
      normalizedResult.inventionConcepts.length > 0
        ? normalizedResult.inventionConcepts[0].keyFeatures.join('；')
        : ''

    const output: InventionUnderstandingOutput = {
      inventionConcepts: normalizedResult.inventionConcepts,
      technicalField: normalizedResult.technicalField,
      backgroundArt: summarizePriorArt(input.priorArt),
      embodimentSummary: extractEmbodiment(input.technicalDisclosure),
      drawingDescriptions: input.drawings || [],
      confidence: calculateOverallConfidence(normalizedResult.inventionConcepts),
      validation: validationResult,
      keyFeatures: allKeyFeatures,
      technicalProblem: primaryProblem,
      technicalSolution: primarySolution,
      beneficialEffects: allTechnicalEffects.join('；'),
    }

    console.log(`\n✅ [发明理解] 分析完成`)
    console.log(`   发明构思: ${output.inventionConcepts.length} 组三元组`)
    console.log(`   总体置信度: ${(output.confidence * 100).toFixed(0)}%`)
    console.log(`   验证结果: ${validationResult.passed ? '✅ 通过' : '❌ 未通过'}`)

    if (validationResult.errors.length > 0) {
      console.log(`   错误: ${validationResult.errors.length} 个`)
      validationResult.errors.forEach((err) => console.log(`     - ${err}`))
    }

    if (validationResult.warnings.length > 0) {
      console.log(`   警告: ${validationResult.warnings.length} 个`)
      validationResult.warnings.forEach((warn) => console.log(`     - ${warn}`))
    }

    return output
  }

  // --- 知识检索 ---

  private async performMultiStageRetrieval(
    input: InventionUnderstandingInput
  ): Promise<KnowledgeRetrievalResult> {
    const knowledge: KnowledgeRetrievalResult = {
      methodology: { problem: [], feature: [], effect: [], triplet: [] },
      terminology: new Map(),
      domainKnowledge: {},
      validationRules: [],
      externalKnowledge: [],
    }

    console.log('\n   📚 阶段 1: 检索方法论指导...')
    knowledge.methodology = await this.retrieveMethodology()

    console.log('   📖 阶段 2: 检索术语标准...')
    knowledge.terminology = await this.retrieveTerminology(input.field)

    console.log('   🎯 阶段 3: 检索领域特定知识...')
    knowledge.domainKnowledge = await this.retrieveDomainKnowledge(input.field)

    console.log('   ✅ 阶段 4: 检索验证规则...')
    knowledge.validationRules = await this.retrieveValidationRules()

    console.log('   🌐 阶段 5: 搜索外部技术资料...')
    knowledge.externalKnowledge = await searchExternalKnowledge(input)

    return knowledge
  }

  private async retrieveMethodology(): Promise<KnowledgeRetrievalResult['methodology']> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.METHODOLOGY, {})
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as KnowledgeRetrievalResult['methodology']

    const [problemItems, featureItems, effectItems, tripletItems] = await Promise.all([
      this.queryKnowledgeWithFallback(
        ['如何从技术交底书中提取技术问题', '技术问题的确定原则', '说明书-发明内容-技术问题'],
        2
      ),
      this.queryKnowledgeWithFallback(
        [
          '如何识别发明的关键技术特征',
          '技术特征的划分原则',
          '必要技术特征的认定',
          '权利要求-保护范围的确定',
        ],
        3
      ),
      this.queryKnowledgeWithFallback(
        ['如何描述发明的技术效果', '技术效果的认定规则', '有益效果的描述方法'],
        2
      ),
      this.queryKnowledgeWithFallback(
        [
          '创造性-区别特征与实际解决的技术问题',
          '创造性-概述与三步法框架',
          '问题-特征-效果的逻辑关系',
        ],
        2
      ),
    ])

    const methodology = {
      problem: problemItems.map((item) => item.content),
      feature: featureItems.map((item) => item.content),
      effect: effectItems.map((item) => item.content),
      triplet: tripletItems.map((item) => item.content),
    }

    await this.cache.set(cacheKey, methodology)
    return methodology
  }

  private async retrieveTerminology(field: string): Promise<Map<string, string>> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.TERMINOLOGY, { field })
    const cached = await this.cache.get(cacheKey)
    if (cached) return new Map(cached as Iterable<readonly [string, string]>)

    const [generalResults, domainResults] = await Promise.all([
      this.queryKnowledgeWithFallback(['权利要求-清楚的要求', '技术特征的认定', '专利术语标准'], 2),
      this.queryKnowledgeWithFallback(mapFieldToTerminologyQueries(field), 2),
    ])

    const terminologyMap = new Map(this.terminologyMap)
    for (const result of [...generalResults, ...domainResults]) {
      for (const [informal, standard] of extractTerminologyMappings(result.content)) {
        terminologyMap.set(informal, standard)
      }
    }

    await this.cache.set(cacheKey, Array.from(terminologyMap.entries()))
    return terminologyMap
  }

  private async retrieveDomainKnowledge(
    field: string
  ): Promise<KnowledgeRetrievalResult['domainKnowledge']> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.DOMAIN, { field })
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as KnowledgeRetrievalResult['domainKnowledge']

    const domainInfo = FIELD_GUIDE_MAP[field]
    const domainKnowledge: KnowledgeRetrievalResult['domainKnowledge'] = {}

    if (domainInfo) {
      if (domainInfo.guide) {
        const guideResults = await this.queryKnowledgeWithFallback([domainInfo.guide], 1)
        domainKnowledge.writingGuide = guideResults[0]?.content
      }

      if (domainInfo.cases.length > 0) {
        const caseResults: string[] = []
        for (const caseKey of domainInfo.cases) {
          const results = await this.queryKnowledgeWithFallback([caseKey], 1)
          if (results[0]?.content) caseResults.push(results[0].content)
        }
        domainKnowledge.similarCases = caseResults
      }

      if (domainInfo.errors.length > 0) {
        const errorResults: string[] = []
        for (const errorKey of domainInfo.errors) {
          const results = await this.queryKnowledgeWithFallback([errorKey], 1)
          if (results[0]?.content) errorResults.push(results[0].content)
        }
        domainKnowledge.commonErrors = errorResults
      }
    }

    await this.cache.set(cacheKey, domainKnowledge)
    return domainKnowledge
  }

  private async retrieveValidationRules(): Promise<string[]> {
    const cacheKey = this.buildCacheKey(RetrievalScenario.VALIDATION, {})
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached as string[]

    const results = await this.queryKnowledgeWithFallback(
      ['说明书-充分公开概述', '权利要求-以说明书为依据', '创造性-技术启示的判断'],
      3
    )

    const rules = results.map((r) => r.content)
    await this.cache.set(cacheKey, rules)
    return rules
  }

  // --- LLM 交互 ---

  private async extractTriplets(
    llm: NonNullable<ExtendedExecutionContext['llm']>,
    input: InventionUnderstandingInput,
    knowledge: KnowledgeRetrievalResult
  ): Promise<InventionUnderstandingOutput> {
    const systemPrompt = await this.buildSystemPrompt(knowledge)
    const userPrompt = await this.buildUserPrompt(input, knowledge)

    const response = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    })

    const parsed = this.safeParseJSON(response.message.content)
    if (!parsed) {
      throw new Error('无法解析 LLM 响应')
    }

    return normalizeOutput(parsed, input)
  }

  private async buildSystemPrompt(knowledge: KnowledgeRetrievalResult): Promise<string> {
    if (this.skillLoader) {
      try {
        const template = await this.skillLoader.load('system-prompt')
        return this.skillLoader.render(template, {
          hasMethodologyTriplet: knowledge.methodology.triplet.length > 0,
          methodologyTriplet: knowledge.methodology.triplet.join('\n\n'),
          hasMethodologyProblem: knowledge.methodology.problem.length > 0,
          methodologyProblem: knowledge.methodology.problem.join('\n'),
          hasMethodologyFeature: knowledge.methodology.feature.length > 0,
          methodologyFeature: knowledge.methodology.feature.join('\n'),
          hasMethodologyEffect: knowledge.methodology.effect.length > 0,
          methodologyEffect: knowledge.methodology.effect.join('\n'),
        })
      } catch {
        /* knowledge enhancement failed, use default prompt */
      }
    }

    let prompt = `你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。

你的任务是深入理解技术交底书，提取**多组**问题-特征-效果三元组。

`

    if (knowledge.methodology.triplet.length > 0) {
      prompt += `\n## 参考方法论（来自专利知识库）\n\n### 三步法框架\n`
      prompt += knowledge.methodology.triplet.join('\n\n') + '\n'
    }
    if (knowledge.methodology.problem.length > 0) {
      prompt += `\n### 技术问题提取方法\n` + knowledge.methodology.problem.join('\n') + '\n'
    }
    if (knowledge.methodology.feature.length > 0) {
      prompt += `\n### 技术特征提取方法\n` + knowledge.methodology.feature.join('\n') + '\n'
    }
    if (knowledge.methodology.effect.length > 0) {
      prompt += `\n### 技术效果提取方法\n` + knowledge.methodology.effect.join('\n') + '\n'
    }

    if (knowledge.externalKnowledge.length > 0) {
      prompt += `\n## 外部技术资料（来自网络搜索和学术论文）\n\n`
      for (const item of knowledge.externalKnowledge.slice(0, 8)) {
        const sourceLabel = item.source === 'academic' ? '学术论文' : '网络资料'
        prompt += `### [${sourceLabel}] ${item.title}\n${item.content.substring(0, 500)}\n\n`
      }
      prompt += `请参考上述外部技术资料来更准确地理解交底书中的技术内容。\n`
    }

    prompt += `
## 核心原则

1. **多组三元组**: 提取多组问题-特征-效果，覆盖发明的多个创新点
2. **逻辑一致性**: 问题-特征-效果必须一一对应
3. **具体性**: 技术特征必须具体，技术效果必须可量化或可验证
4. **对比性**: 技术效果必须与现有技术有明确对比

输出要求：
- 用中文回答，保持专业术语的准确性
- 输出必须是严格的 JSON 格式
- 为每个三元组提供置信度评估（0-1之间）
`
    return prompt
  }

  private async buildUserPrompt(
    input: InventionUnderstandingInput,
    knowledge: KnowledgeRetrievalResult
  ): Promise<string> {
    if (this.skillLoader) {
      try {
        const template = await this.skillLoader.load('user-prompt')
        return this.skillLoader.render(template, {
          title: input.title,
          field: input.field,
          applicant: input.applicant || '',
          inventors: input.inventors ? input.inventors.join(', ') : '',
          hasPriorArt: !!(input.priorArt && input.priorArt.length > 0),
          priorArt: input.priorArt ? input.priorArt.join('\n\n') : '',
          technicalDisclosure: input.technicalDisclosure,
          hasDrawings: !!(input.drawings && input.drawings.length > 0),
          drawings: input.drawings ? input.drawings.join('\n') : '',
          hasSimilarCases: !!(
            knowledge.domainKnowledge.similarCases &&
            knowledge.domainKnowledge.similarCases.length > 0
          ),
          similarCases: knowledge.domainKnowledge.similarCases
            ? knowledge.domainKnowledge.similarCases.join('\n\n---\n\n')
            : '',
          hasCommonErrors: !!(
            knowledge.domainKnowledge.commonErrors &&
            knowledge.domainKnowledge.commonErrors.length > 0
          ),
          commonErrors: knowledge.domainKnowledge.commonErrors
            ? knowledge.domainKnowledge.commonErrors.join('\n\n')
            : '',
        })
      } catch {
        /* knowledge enhancement failed, use default prompt */
      }
    }

    let prompt = `## 发明基本信息\n\n发明名称：${input.title}\n技术领域：${input.field}\n`
    if (input.applicant) prompt += `申请人：${input.applicant}\n`
    if (input.inventors) prompt += `发明人：${input.inventors.join(', ')}\n`
    prompt += '\n'

    if (input.priorArt && input.priorArt.length > 0) {
      prompt += `## 现有技术（背景）\n\n${input.priorArt.join('\n\n')}\n\n`
    }

    prompt += `## 技术交底书\n\n${input.technicalDisclosure}\n\n---\n\n**重要提示**：以上文本可能是混合格式（例如同时包含权利要求书、说明书、对比文件、答题须知等）。
请专注于提取其中描述的发明创造的**实质技术内容**，忽略答题须知、评分标准、考试说明等非技术部分。
从说明书和/或权利要求书中提取发明的技术问题、关键技术特征和技术效果。
如果文本中包含对比文件，请将其视为现有技术参考，帮助理解发明的创新点。`

    if (input.drawings && input.drawings.length > 0) {
      prompt += `\n\n## 附图说明\n\n${input.drawings.join('\n')}`
    }

    if (knowledge.domainKnowledge.similarCases?.length) {
      prompt += `\n\n## 参考案例\n\n${knowledge.domainKnowledge.similarCases.join('\n\n---\n\n')}`
    }

    if (knowledge.domainKnowledge.commonErrors?.length) {
      prompt += `\n\n## 常见错误提醒\n\n${knowledge.domainKnowledge.commonErrors.join('\n\n')}`
    }

    if (knowledge.externalKnowledge.length > 0) {
      prompt += `\n\n## 外部技术参考\n\n`
      for (const item of knowledge.externalKnowledge.slice(0, 5)) {
        const sourceLabel = item.source === 'academic' ? '论文' : '网络'
        prompt += `[${sourceLabel}] ${item.title}\n${item.content.substring(0, 300)}\n\n`
      }
    }

    prompt += `

## 输出要求

请提取**多组**问题-特征-效果三元组，输出以下 JSON 格式：

\`\`\`json
{
  "inventionConcepts": [
    {
      "technicalProblem": "要解决的具体技术问题",
      "keyFeatures": ["特征1", "特征2", "特征3"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.9
    }
  ],
  "technicalField": "标准化的技术领域描述",
  "embodimentSummary": "实施方式提炼",
  "drawingDescriptions": ["图1描述", "图2描述"]
}
\`\`\`

**重要提示**：
- 每个技术特征必须对应至少一个技术效果
- 技术效果必须与现有技术有明确对比（如"提高50%"、"延长3倍"）
- 技术问题不应包含解决手段
- 技术特征必须具体（不是"改进设计"）
- 提取多组三元组，覆盖所有创新点
`
    return prompt
  }

  // --- 工具方法 ---

  private async queryKnowledgeWithFallback(
    queries: string[],
    topK: number
  ): Promise<KnowledgeItem[]> {
    try {
      const results = await Promise.all(queries.map((q) => this.queryKnowledge(q, 1)))
      const scored: KnowledgeItem[] = results.flat().map((r) => ({
        content: r.content,
        score: r.score,
      }))

      if (scored.length >= topK) return scored.slice(0, topK)

      console.warn(`检索结果不足 (${scored.length}/${topK})，使用降级策略`)
      return (await this.queryKnowledge('撰写-说明书撰写要求', topK)).map((r) => ({
        content: r.content,
        score: r.score,
      }))
    } catch (error) {
      console.error('检索失败，使用硬编码方法论:', error)
      return [{ content: getHardcodedMethodology(), score: 0.5 }]
    }
  }

  private buildCacheKey(scenario: RetrievalScenario, params: Record<string, string>): string {
    return [scenario, params.field || 'general', params.query?.substring(0, 20) || ''].join(':')
  }

  private checkInventionInput(input: InventionUnderstandingInput): void {
    if (!input.title?.trim()) throw new Error('发明名称不能为空')
    if (!input.field?.trim()) throw new Error('技术领域不能为空')
    if (!input.technicalDisclosure?.trim()) throw new Error('技术交底书不能为空')
    if (input.technicalDisclosure.length < 10)
      throw new Error('技术交底书内容过少，请提供更详细的描述')
  }
}

function mapFieldToTerminologyQueries(field: string): string[] {
  const map: Record<string, string[]> = {
    机械工程: ['撰写-机械-权利要求书撰写-常见问题', '撰写-机械-说明书撰写-名称与技术领域'],
    化学: ['撰写-化学-概述-化学领域发明的种类及范畴', '撰写-化学-化合物发明-撰写要点'],
    计算机程序: ['撰写-审查要点-计算机程序发明'],
    生物技术: [
      '撰写-化学-生物技术领域发明专利申请文件的撰写',
      '撰写-化学-审查-生物技术领域发明专利申请的审查',
    ],
    新材料: ['撰写-化学-高分子化合物-撰写实例', '撰写-化学-高分子化合物-权利要求书'],
    医药: ['撰写-化学-组合物与药品发明专利申请文件的撰写', '撰写-化学-审查-药品-充分公开'],
  }
  return map[field] || []
}

function getHardcodedMethodology(): string {
  return `
## 技术问题提取方法
1. 针对现有技术缺陷或不足
2. 用正面、简洁语言描述
3. 不包含解决手段本身

## 技术特征提取方法
1. 区分必要特征和非必要特征
2. 独立特征分开，协同特征整体
3. 实质对比而非文字对比

## 技术效果提取方法
1. 由技术特征直接带来
2. 与现有技术明确对比
3. 具体分析，量化描述
`
}
