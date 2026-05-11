import { Agent, type ExecutionContext } from '@yunpat/core'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type {
  SpecificationDrafterInput,
  SpecificationDrafterOutput,
  SpecificationPlan,
  SpecificationContent,
} from './SpecTypes.js'
import {
  normalizeOutput,
  getTargetWordCounts,
  createFallbackOutput,
} from './SpecOutputProcessor.js'
import {
  checkTerminologyConsistency,
  checkCoherence,
  checkEnablement,
  checkSupport,
  checkProhibitedTerms,
  checkCitationCompleteness,
  checkEmbodimentSufficiency,
  calculateQualityScore,
} from './SpecQualityChecker.js'

// Re-export types for backward compatibility
export type {
  SpecificationDrafterInput,
  SpecificationDrafterOutput,
  SpecificationContent,
  SpecificationSection,
  SpecificationChapter,
} from './SpecTypes.js'

/**
 * 说明书撰写智能体
 */
export class SpecificationDrafterAgent extends Agent<
  SpecificationDrafterInput,
  SpecificationDrafterOutput
> {
  private templatePath: string

  constructor(config: any) {
    super({
      ...config,
      name: config.name || 'specification-drafter',
      description: config.description || '说明书撰写智能体 - 专业的专利说明书撰写',
    })
    this.templatePath =
      config.templatePath ||
      resolve(
        process.cwd(),
        'patents/prompts/templates/patent-drafting/02-specification-drafting.md'
      )
  }

  protected async plan(
    input: SpecificationDrafterInput,
    _context: ExecutionContext
  ): Promise<SpecificationPlan> {
    this.validateInput(input)

    const { inventionUnderstanding } = input

    console.log('\n📝 [说明书撰写] 步骤1: 规划阶段')
    console.log(`   发明名称: ${inventionUnderstanding.technicalField}`)
    console.log(`   关键特征: ${inventionUnderstanding.keyFeatures.length} 个`)
    console.log(`   撰写模式: ${input.draftMode || 'standard'}`)

    const templateContent = await this.loadTemplate()

    const chapters = input.chapters || [
      'technical_field',
      'background_art',
      'invention_content',
      'embodiments',
      'drawings_description',
    ]

    const draftMode = input.draftMode || 'standard'
    const targetWordCounts = getTargetWordCounts(draftMode, input.targetWordCount)

    console.log(`   目标字数: ${Object.values(targetWordCounts).reduce((a, b) => a + b, 0)} 字`)

    return {
      input,
      templateContent,
      chapters,
      targetWordCounts,
    }
  }

  protected async act(
    plan: SpecificationPlan,
    context: ExecutionContext
  ): Promise<SpecificationDrafterOutput> {
    console.log('\n📝 [说明书撰写] 步骤2: 撰写阶段')

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行说明书撰写')
    }

    const { input, targetWordCounts } = plan

    const result = await this.performDrafting(context.llm, input, targetWordCounts)

    // 质量检查
    const metrics = this.performQualityChecks(result.specification)
    result.metrics = { ...result.metrics, ...metrics }

    // 计算质量评分
    result.qualityScore = calculateQualityScore(result.specification)

    // 生成风险警告
    result.riskWarnings = this.generateRiskWarnings(result.specification, result.metrics)

    // 生成撰写说明（如 LLM 未返回）
    if (!result.draftingNotes) {
      result.draftingNotes = this.generateDraftingNotes(result.specification)
    }

    // 生成权利要求建议（如 LLM 未返回）
    if (!result.claimSuggestions) {
      result.claimSuggestions = this.generateClaimSuggestions(result.specification)
    }

    // 计算质量评分
    result.qualityScore = calculateQualityScore(result.specification)

    console.log(`\n✅ [说明书撰写] 撰写完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   总字数: ${result.metrics.totalWordCount}`)
    console.log(`   章节数: ${result.metrics.chapterCount}`)
    console.log(`   质量评分: ${result.qualityScore.overall.toFixed(1)}`)
    console.log(`   术语一致性: ${result.metrics.terminologyConsistency ? '✓' : '✗'}`)
    console.log(`   连贯性: ${result.metrics.coherenceCheck ? '✓' : '✗'}`)
    console.log(`   充分公开: ${result.metrics.enablementCheck ? '✓' : '✗'}`)

    return result
  }

  /**
   * 执行说明书撰写
   */
  private async performDrafting(
    llm: NonNullable<ExecutionContext['llm']>,
    input: SpecificationDrafterInput,
    targetWordCounts: SpecificationPlan['targetWordCounts']
  ): Promise<SpecificationDrafterOutput> {
    const systemPrompt = this.buildSystemPrompt(input)
    const userPrompt = this.buildUserPrompt(input, targetWordCounts)

    const parseResult = await this.callLLMWithFallback(llm, systemPrompt, userPrompt)

    if (!parseResult.success) {
      console.warn('[SpecificationDrafterAgent] LLM解析失败，使用回退输出')
      return createFallbackOutput(input)
    }

    return normalizeOutput(parseResult.data!, input)
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(input: SpecificationDrafterInput): string {
    const patentType = input.patentType || 'invention'
    const draftMode = input.draftMode || 'standard'
    const domainSpecific = this.buildDomainSpecificNorms(input)

    return `你是一位资深中国专利代理师，具有20年以上专利撰写经验，精通《专利法》《专利法实施细则》和《专利审查指南》。

# 第一层：法定框架约束

## 充分公开（专利法第26条第3款）
说明书应当对发明作出**清楚、完整**的说明，以**所属技术领域的技术人员能够实现**为准。
- **清楚**：主题明确，使用规范技术术语，不得含糊不清
- **完整**：包含理解发明、确定三性、实现发明所需的一切内容；凡技术人员不能从现有技术直接唯一得出的内容，均须描述
- **能够实现**：技术人员按说明书记载即可实现；不能只有任务/设想而没有具体技术手段；给出的手段必须能解决所述技术问题

## 五大组成部分（实施细则第20条）
必须按以下顺序撰写：
1. 技术领域
2. 背景技术
3. 发明内容（技术问题 + 技术方案 + 有益效果）
4. 附图说明（如有附图）
5. 具体实施方式

## 禁止性规范（绝对禁止）
- "如权利要求……所述的……" 等引用语
- 商业性宣传用语（"最佳""最优""革命性""颠覆性"等）
- 不确定用语（"厚""薄""强""弱""高温""高压""很宽范围"等，除非有公认确切含义）
- "例如""最好是""尤其是""必要时"等导致范围不清的用语
- "约""接近""等""或类似物"等模糊用语

# 第二层：各部分撰写规范

## 技术领域
- 写明要求保护的技术方案所属或直接应用的**具体技术领域**
- 不是上位领域，也不是发明本身
- 通常与IPC最低位置有关

## 背景技术
- **必须**引证与独立权利要求前序部分最接近的现有技术
- 客观指出现有技术存在的问题和缺点（限于本发明解决的问题）
- 引证文件须注明国别、公开号/申请号、公开日
- 外国文件用原文引证

## 发明内容（三要素）
### 技术问题
- 针对现有技术的**缺陷或不足**，用正面、简洁、客观的语言表述
- 每个问题都应有对应的技术方案

### 技术方案
- 至少反映包含全部必要技术特征的独立权利要求的技术方案
- 用语应与权利要求相应或相同
- 首先写独立权利要求的方案，再通过附加技术特征反映从属权利要求

### 有益效果
- **必须与现有技术比较**，指出区别
- 由技术特征**直接带来**或**必然产生**的效果
- 化学领域通常必须借助实验数据
- 效果维度参考：产率/质量/效率提高、能耗节省、操作简便、污染治理

## 具体实施方式
- 详细描述**优选实施方式**，对照附图说明
- 实施例数量规则：
  - 保护范围较宽时，应给**至少两个不同实施例**
  - 数值范围应给**两端值附近**的实施例
  - 数值范围较宽时，还应给**至少一个中间值**的实施例
- **区别技术特征**必须足够详细
- 附图标记放在技术名称后面，**不加括号**

# 第三层：反面案例警示

## 公开不充分五大情形（必须逐一避免）
1. 只给任务不给手段 → 每个技术问题必须对应具体技术手段
2. 手段含糊不清 → "适当调整""合理设置"必须给出具体数值或判断标准
3. 手段不能解决问题 → 技术手段必须与技术问题直接相关
4. 组合方案部分手段无法实现 → 检查每个组成部分是否可实现
5. 缺少实验证据 → 化学/生物领域必须给出实验数据

## 得不到支持（常见缺陷）
- 权利要求概括过宽，实施例不足以支持
- 功能性限定未得到说明书支持
- 上位概念概括超出实施例公开范围

# 第四层：领域特殊规范
${domainSpecific}

# 撰写模式：${draftMode === 'detailed' ? '详细模式 — 更详细的技术描述和多个实施例' : draftMode === 'concise' ? '简洁模式 — 精简表述，突出核心要点' : '标准模式'}
# 专利类型：${patentType === 'invention' ? '发明专利' : patentType === 'utilityModel' ? '实用新型' : '外观设计'}

# 完成后自检
撰写完成后，逐项检查：
- [ ] 五个部分齐全且按序排列
- [ ] 每个技术问题有对应技术手段
- [ ] 无"适当""合理"等模糊表述（除非给出标准）
- [ ] 技术方案与权利要求一致
- [ ] 实施例数量匹配保护范围
- [ ] 无商业宣传用语、引用语、不确定用语
- [ ] 背景技术引证了最接近现有技术
- [ ] 有益效果与现有技术做了比较

输出必须是严格的 JSON 格式。`
  }

  /**
   * 根据技术领域构建领域特殊规范
   */
  private buildDomainSpecificNorms(input: SpecificationDrafterInput): string {
    const field = input.inventionUnderstanding?.technicalField || ''
    const norms: string[] = []

    const isChemical = /化学|药物|催化剂|组合物|化合物|反应|聚合|合成/.test(field)
    const isSoftware = /软件|程序|算法|计算|数据处理|信息处理|智能|AI|机器学习/.test(field)
    const isBiological = /生物|基因|蛋白质|酶|细胞|微生物|DNA|RNA/.test(field)
    const isMechanical = /机械|结构|装置|设备|机构|传动|液压|气动/.test(field)
    const isChineseMedicine = /中药|药材|方剂|中草药/.test(field)

    if (isChemical) {
      norms.push(`## 化学领域
- **必须使用实验数据说明有益效果**
- 必须给出必要的实验条件和方法
- 组合物：公开组分、配比、制备方法、性能数据
- 方法发明：公开原料、条件、步骤、收率、纯度数据`)
    }

    if (isSoftware) {
      norms.push(`## 计算机程序/软件发明
- 结合流程图、框图说明
- 算法类应说明输入、处理步骤、输出及数学原理
- 涉及用户界面的，应说明交互流程和数据流向`)
    }

    if (isBiological) {
      norms.push(`## 生物领域发明
- 公众无法得到的生物材料必须在申请日前保藏
- 写明保藏信息（分类命名、保藏单位、日期、编号）
- 基因/蛋白质：公开序列、载体、宿主、表达方法
- 必须提供实验证据证明活性/功能`)
    }

    if (isChineseMedicine) {
      norms.push(`## 中药领域发明
- 中药材使用规范名称
- 组合物说明君臣佐使关系
- 药效实验说明动物模型、给药方式、评价指标`)
    }

    if (isMechanical || norms.length === 0) {
      norms.push(`## 机械/电气领域
- 结构描述结合附图，说明各部件位置关系和连接关系
- 运动机构说明动作过程和传动关系
- 电路说明各元器件连接关系和工作原理
- 有益效果可结合结构特征和作用方式说明`)
    }

    return norms.join('\n')
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    input: SpecificationDrafterInput,
    targetWordCounts: SpecificationPlan['targetWordCounts']
  ): string {
    const contextInfo = this.buildContext(input)

    return `基于以下信息撰写专利说明书：

${contextInfo}

## 目标字数要求
- 技术领域: ${targetWordCounts.technical_field} 字
- 背景技术: ${targetWordCounts.background_art} 字
- 发明内容: ${targetWordCounts.invention_content} 字
- 具体实施方式: ${targetWordCounts.embodiments} 字
- 附图说明: ${targetWordCounts.drawings_description} 字

请按章节输出以下 JSON 格式：

{
  "technical_field": {
    "chapter": "技术领域",
    "title": "技术领域",
    "content": "技术领域内容...",
    "wordCount": 实际字数,
    "quality": { "clarity": 清晰度评分, "completeness": 完整性评分, "consistency": 一致性评分 }
  },
  "background_art": { "chapter": "背景技术", ... },
  "invention_content": {
    "chapter": "发明内容",
    "content": "发明内容详细描述",
    "technical_problem": "要解决的技术问题",
    "technical_solution": "技术方案详细描述",
    "beneficial_effects": "有益效果总体描述",
    "beneficial_effects_list": [{ "effect": "效果1", "metric": "指标", "improvement": "提升" }]
  },
  "embodiments": {
    "chapter": "具体实施方式",
    "content": "具体实施方式总体描述",
    "embodiment_list": [{ "number": 1, "title": "实施例1", "content": "...", "type": "preferred", "keyFeatures": ["特征1"] }]
  },
  "drawings_description": {
    "chapter": "附图说明",
    "drawings": [{ "figureNumber": "图1", "title": "标题", "description": "说明" }]
  },
  "draftingNotes": "关键撰写决策说明",
  "riskWarnings": [{ "category": "类别", "severity": "high/medium/low", "message": "风险描述", "suggestion": "建议" }],
  "claimSuggestions": "权利要求撰写建议",
  "confidence": 置信度
}`
  }

  /**
   * 构建上下文信息
   */
  private buildContext(input: SpecificationDrafterInput): string {
    const { inventionUnderstanding, priorArtSearch, claimsSet, drawings } = input

    const sections: string[] = []

    sections.push('## 发明理解')
    sections.push(`### 技术领域`)
    sections.push(inventionUnderstanding.technicalField)
    sections.push(`### 背景技术`)
    sections.push(inventionUnderstanding.backgroundArt || '无')
    sections.push(`### 技术问题`)
    sections.push(inventionUnderstanding.technicalProblem)
    sections.push(`### 技术方案`)
    sections.push(inventionUnderstanding.technicalSolution)
    sections.push(`### 有益效果`)
    sections.push(inventionUnderstanding.beneficialEffects || '无')
    sections.push(`### 关键特征`)
    inventionUnderstanding.keyFeatures.forEach((feature, index) => {
      sections.push(`${index + 1}. ${feature}`)
    })

    if (claimsSet) {
      sections.push('\n## 权利要求')
      sections.push('### 独立权利要求')
      claimsSet.independent_claims?.forEach((claim: any) => {
        sections.push(claim.full_text || claim.content)
      })
      sections.push('### 从属权利要求')
      claimsSet.dependent_claims?.forEach((claim: any) => {
        sections.push(claim.content)
      })
    }

    if (priorArtSearch?.comparisonAnalysis) {
      sections.push('\n## 先导技术分析')
      sections.push(`### 最接近的现有技术`)
      sections.push(priorArtSearch.comparisonAnalysis.closestPriorArt?.title || '无')
      sections.push(`### 区别特征`)
      priorArtSearch.comparisonAnalysis.differences?.forEach((diff: string) => {
        sections.push(`- ${diff}`)
      })
      sections.push(`### 实际解决的技术问题`)
      sections.push(priorArtSearch.comparisonAnalysis.technicalProblemSolved || '无')
    }

    if (drawings && drawings.length > 0) {
      sections.push('\n## 附图')
      drawings.forEach((drawing, index) => {
        sections.push(`图${index + 1}: ${drawing}`)
      })
    }

    return sections.join('\n')
  }

  /**
   * 执行质量检查
   */
  private performQualityChecks(
    specification: SpecificationContent
  ): Partial<SpecificationDrafterOutput['metrics']> {
    const prohibited = checkProhibitedTerms(specification)
    const citation = checkCitationCompleteness(specification)
    const embodiment = checkEmbodimentSufficiency(specification)

    return {
      terminologyConsistency: checkTerminologyConsistency(specification),
      coherenceCheck: checkCoherence(specification),
      enablementCheck: checkEnablement(specification),
      supportCheck: checkSupport(specification),
      prohibitedTermsPassed: prohibited.passed,
      citationComplete: citation.passed,
      embodimentSufficient: embodiment.passed,
    }
  }

  /**
   * 生成风险警告
   */
  private generateRiskWarnings(
    specification: SpecificationContent,
    metrics: SpecificationDrafterOutput['metrics']
  ): SpecificationDrafterOutput['riskWarnings'] {
    const warnings: SpecificationDrafterOutput['riskWarnings'] = []

    if (!metrics.enablementCheck) {
      warnings.push({
        category: 'enablement',
        severity: 'high',
        message: '说明书可能未满足充分公开要求',
        suggestion: '检查是否每个技术问题都有对应的具体技术手段，且手段不含糊不清',
      })
    }

    if (!metrics.supportCheck) {
      warnings.push({
        category: 'support',
        severity: 'high',
        message: '说明书可能无法充分支持权利要求的保护范围',
        suggestion: '增加实施例数量，确保覆盖权利要求的数值范围',
      })
    }

    if (!metrics.prohibitedTermsPassed) {
      const prohibited = checkProhibitedTerms(specification)
      warnings.push({
        category: 'prohibited_terms',
        severity: 'medium',
        message: `发现禁止用语: ${prohibited.violations.slice(0, 3).join('、')}`,
        suggestion: '删除所有商业宣传用语、不确定用语和范围模糊词',
      })
    }

    if (!metrics.citationComplete) {
      const citation = checkCitationCompleteness(specification)
      warnings.push({
        category: 'citation',
        severity: 'medium',
        message: `引证不完整: ${citation.issues.join('；')}`,
        suggestion: '引证最接近的现有技术专利文件，注明公开号和公开日',
      })
    }

    if (!metrics.embodimentSufficient) {
      const embodiment = checkEmbodimentSufficiency(specification)
      warnings.push({
        category: 'enablement',
        severity: 'medium',
        message: `实施例可能不足: ${embodiment.issues.join('；')}`,
        suggestion: '保护范围较宽时至少提供2个不同实施例，数值范围提供两端值+中间值',
      })
    }

    if (!metrics.terminologyConsistency) {
      warnings.push({
        category: 'formality',
        severity: 'low',
        message: '各章节间术语使用可能不一致',
        suggestion: '统一全文对同一技术特征的命名',
      })
    }

    return warnings
  }

  /**
   * 生成撰写说明
   */
  private generateDraftingNotes(specification: SpecificationContent): string {
    const notes: string[] = []

    if (specification.embodiments.embodiment_list.length >= 2) {
      notes.push(`提供了${specification.embodiments.embodiment_list.length}个实施例以支持保护范围`)
    }

    const hasComparison = specification.invention_content.beneficial_effects.includes('现有技术')
    if (hasComparison) {
      notes.push('有益效果部分已与现有技术进行了对比')
    } else {
      notes.push('注意：有益效果部分建议明确与现有技术进行对比')
    }

    return notes.join('；')
  }

  /**
   * 生成权利要求建议
   */
  private generateClaimSuggestions(specification: SpecificationContent): string {
    const suggestions: string[] = []

    const keyFeatures = specification.invention_content.technical_solution
    if (keyFeatures.length > 100) {
      suggestions.push('技术方案描述较详细，建议提取必要技术特征构建独立权利要求，附加特征作为从属权利要求')
    }

    if (specification.embodiments.embodiment_list.length >= 2) {
      suggestions.push('实施例充足，可支持较宽的独立权利要求保护范围')
    }

    const effects = specification.invention_content.beneficial_effects_list
    if (effects.length > 0) {
      suggestions.push(`有益效果涵盖${effects.length}个维度，可作为创造性的论证依据`)
    }

    return suggestions.join('；')
  }

  /**
   * 带重试的LLM调用
   */
  private async callLLMWithFallback(
    llm: NonNullable<ExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
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
          timeout: 300000,
        })

        const content = response.message.content
        const parsed = this.safeParseJSON(content)

        if (parsed) {
          return { success: true, data: parsed }
        }

        lastError = new Error('无法解析JSON响应')
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        console.warn(
          `[SpecificationDrafterAgent] LLM 调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
        )

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || '未知错误',
    }
  }

  private validateInput(input: SpecificationDrafterInput): void {
    if (!input.inventionUnderstanding) {
      throw new Error('发明理解结果不能为空')
    }
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await readFile(this.templatePath, 'utf-8')
    } catch (error) {
      console.warn(`无法加载模板文件 ${this.templatePath}，使用默认配置`)
      return ''
    }
  }

  protected safeParseJSON(content: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(content)
      return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1] || jsonMatch[0])
        } catch {
          return null
        }
      }
      return null
    }
  }
}
