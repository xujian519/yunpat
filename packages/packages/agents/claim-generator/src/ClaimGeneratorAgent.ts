import {
  Agent,
  type ExecutionContext,
  extractRequiredFeatures,
  isFeatureCoveredInClaim,
  identifyIncludedUnnecessaryFeatures,
  SecureContentProvider,
} from '@yunpat/core'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type {
  ClaimGeneratorInput,
  ClaimGeneratorOutput,
  ClaimGeneratorPlan,
  ClaimRegenerationContext,
  EssentialAnalysisResult,
  StructuredInput,
} from './types.js'
import {
  DOMAIN_PROMPT_MAP,
  DOMAIN_KEYWORDS,
  MAX_REGENERATION_ATTEMPTS,
  MIN_FEATURE_LENGTH,
  MAX_FEATURE_LENGTH,
  LLM_MAX_RETRIES,
} from './types.js'
import { performFormalityCheck } from './ClaimFormalityChecker.js'
import {
  normalizeOutput,
  parseMarkdownClaims,
  buildStructuredInput,
  buildClaimPrompt,
  createFallbackOutput,
} from './ClaimOutputProcessor.js'

// Re-export types for backward compatibility
export type {
  ClaimGeneratorInput,
  ClaimGeneratorOutput,
  IndependentClaim,
  DependentClaim,
  ClaimsSet,
  FormalityIssue,
} from './types.js'

/**
 * 权利要求生成智能体
 */
export class ClaimGeneratorAgent extends Agent<ClaimGeneratorInput, ClaimGeneratorOutput> {
  private templatePath: string
  private skillsDir: string
  private secureProvider: SecureContentProvider

  // Agent 基类 super() 需要可扩展 config，any 不可避免
  constructor(config: any) {
    super({
      ...config,
      name: config.name || 'claim-generator',
      description: config.description || '权利要求生成智能体 - 专业的权利要求书撰写',
    })
    this.templatePath =
      config.templatePath ||
      resolve(process.cwd(), '.yunpat/skills/patent-drafting/claims-generation.md')
    this.skillsDir = config.skillsDir || resolve(process.cwd(), '.yunpat/skills/patent-drafting')

    this.secureProvider =
      config.secureProvider ||
      new SecureContentProvider({
        fallbackDir: this.skillsDir,
      })
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

    const structuredInput = buildStructuredInput(input)

    const enhancedUnderstanding = {
      ...inventionUnderstanding,
      keyFeatures: structuredInput.essential_features.map((f) => f.description),
    }
    context.sharedState.set('inventionUnderstanding', enhancedUnderstanding)

    const templateContent = await this.loadTemplate()

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
    console.log('\n📝 [权利要求生成] 步骤2: 两步撰写阶段')

    const startTime = Date.now()
    const si = plan.structuredInput

    const systemPrompt = await this.loadLayeredPrompts(si.technical_field)
    const regenCtx = context.sharedState.get('regenerationContext') as
      | ClaimRegenerationContext
      | undefined

    let analysisResult = context.sharedState.get('essentialAnalysis') as
      | EssentialAnalysisResult
      | undefined

    // === 第一步：必要技术特征分析 ===
    if (!analysisResult || regenCtx) {
      console.log('   [步骤2a] 必要技术特征分析...')
      analysisResult = await this.runEssentialAnalysis(context, si, regenCtx)
      context.sharedState.set('essentialAnalysis', analysisResult)
    }

    console.log(`   实际解决的技术问题: ${analysisResult.actual_technical_problem}`)
    console.log(
      `   必要特征: ${analysisResult.analysis_table.filter((f) => f.isEssential).length} 个`
    )
    console.log(
      `   非必要特征: ${analysisResult.analysis_table.filter((f) => !f.isEssential).length} 个`
    )

    // === 第二步：撰写权利要求 ===
    console.log('   [步骤2b] 撰写权利要求...')
    const userPrompt = buildClaimPrompt(si, analysisResult, regenCtx)

    if (!context.llm) {
      throw new Error('LLM 未配置，无法执行权利要求生成')
    }

    const result = await this.callLLMWithFallback(
      context.llm,
      systemPrompt,
      userPrompt,
      plan.input,
      startTime
    )

    context.sharedState.set('essentialAnalysis', analysisResult)

    console.log(`\n✅ [权利要求生成] 撰写完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   独立权利要求: ${result.claimsSet.independent_claims.length} 项`)
    console.log(`   从属权利要求: ${result.claimsSet.dependent_claims.length} 项`)

    return result
  }

  /**
   * 第一步：调用 LLM 执行三步法决策流程
   */
  private async runEssentialAnalysis(
    context: ExecutionContext,
    si: StructuredInput,
    regenCtx?: ClaimRegenerationContext
  ): Promise<EssentialAnalysisResult> {
    const analysisSystemPrompt = `你是一位资深专利代理师，擅长三步法和必要技术特征判断。

严格按照以下决策流程分析：

1. 确定与最接近现有技术的区别特征
2. 分析每个区别特征的技术效果
3. 通过三步法第2步确定"实际解决的技术问题"（不能直接使用原始技术问题，可能过宽）
4. 对每个区别特征执行"去除测试"：去掉后能否仍解决技术问题？
5. 反向验证：如果全部必要→问题可能过宽；全部非必要→问题可能过窄

输出严格的 JSON 格式。`

    const differences =
      si.prior_art_analysis?.differences || si.essential_features.map((f) => f.description)

    let analysisPrompt = `## 发明信息

**发明名称**：${si.invention_title}
**技术领域**：${si.technical_field}
**原始技术问题**：${si.technical_problem}
**技术方案**：${si.technical_solution}
**技术效果**：${si.technical_effects?.join('；') || '无'}

## 区别特征
${differences.map((d, i) => `${i + 1}. ${d}`).join('\n')}

${
  si.prior_art_analysis
    ? `
## 最接近现有技术
${si.prior_art_analysis.closest_prior_art}

## 现有技术已能解决的问题
注意：现有技术可能已能解决原始技术问题的部分内容。请基于区别特征重新定义技术问题。
`
    : ''
}

请输出 JSON：
{
  "actual_technical_problem": "通过三步法第2步重新确定的技术问题（应窄于原始问题）",
  "analysis_table": [
    {
      "feature": "特征描述",
      "technicalEffect": "该特征的技术效果",
      "canSolveWithout": false,
      "isEssential": true,
      "location": "preamble/characteristic/dependent",
      "reason": "判断理由"
    }
  ]
}`

    if (regenCtx) {
      analysisPrompt += `

## 修正要求（第 ${regenCtx.attemptNumber} 次）
${regenCtx.missingFeatures.length > 0 ? `缺少的必要特征: ${regenCtx.missingFeatures.map((f) => f.feature).join(', ')}` : ''}
${regenCtx.unnecessaryIncludedFeatures.length > 0 ? `不应在独立权利要求中的非必要特征: ${regenCtx.unnecessaryIncludedFeatures.map((f) => f.feature).join(', ')}` : ''}`
    }

    const response = await context.llm.chat({
      messages: [
        { role: 'system', content: analysisSystemPrompt },
        { role: 'user', content: analysisPrompt },
      ],
      temperature: 0.2,
      timeout: 120000,
    })

    const parsed = this.safeParseJSON(response.message.content) as EssentialAnalysisResult | null
    if (!parsed) {
      console.warn('[ClaimGeneratorAgent] 必要技术特征分析 JSON 解析失败，使用降级策略')
      return {
        actual_technical_problem: si.technical_problem,
        analysis_table: si.essential_features.map((f) => ({
          feature: f.description,
          technicalEffect: '',
          canSolveWithout: !f.is_essential,
          isEssential: f.is_essential,
          location: (f.is_essential ? 'characteristic' : 'dependent') as
            | 'characteristic'
            | 'dependent',
          reason: '降级策略：分析失败，使用原始分类',
        })),
      }
    }

    return {
      actual_technical_problem: parsed.actual_technical_problem || si.technical_problem,
      analysis_table: (parsed.analysis_table || []).map((item: any) => ({
        feature: item.feature || '',
        technicalEffect: item.technicalEffect || '',
        canSolveWithout: !!item.canSolveWithout,
        isEssential: !!item.isEssential,
        location: item.location || 'characteristic',
        reason: item.reason || '',
      })),
    }
  }

  /**
   * 加载分层提示词
   */
  private async loadLayeredPrompts(technicalField: string): Promise<string> {
    const parts: string[] = []

    const core = await this.loadSkillFile('claims-core.md')
    if (core) parts.push(core)

    const essential = await this.loadSkillFile('claims-essential-features.md')
    if (essential) parts.push(essential)

    const domainFile = this.matchDomain(technicalField)
    if (domainFile) {
      const domain = await this.loadSkillFile(domainFile)
      if (domain) parts.push(domain)
    }

    if (parts.length === 0) {
      return `你是一位资深专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写权利要求：
1. 清楚性原则：用词清楚，类型明确
2. 简要性原则：简明扼要，不描述原因理由
3. 支持性原则：以说明书为依据，不超出公开范围
4. 必要技术特征原则：只写入解决技术问题不可缺少的特征

使用两部分撰写法：
- 前序部分：发明名称 + 与现有技术共有的必要技术特征
- 特征部分："其特征在于" + 区别于现有技术的技术特征`
    }

    return parts.join('\n\n---\n\n')
  }

  /**
   * 根据技术领域匹配领域模板文件
   */
  private matchDomain(technicalField: string): string | null {
    for (const [key, file] of Object.entries(DOMAIN_PROMPT_MAP)) {
      if (technicalField.includes(key)) return file
    }
    for (const entry of DOMAIN_KEYWORDS) {
      if (entry.keywords.some((kw) => technicalField.includes(kw))) return entry.file
    }
    return null
  }

  /**
   * 从 skills 目录加载单个模板文件
   */
  private async loadSkillFile(filename: string): Promise<string | null> {
    const sealedPath = `patent-drafting/${filename.replace('.md', '')}`
    const content = await this.secureProvider.loadContent(sealedPath)
    if (content !== null) {
      return content.replace(/^---[\s\S]*?---\n*/, '').trim()
    }
    try {
      const raw = await readFile(resolve(this.skillsDir, filename), 'utf-8')
      return raw.replace(/^---[\s\S]*?---\n*/, '').trim()
    } catch {
      return null
    }
  }

  /**
   * 反思阶段：检查必要技术特征完整性 + 非必要特征检出 + 形式检查
   */
  protected async reflect(
    result: unknown,
    context: ExecutionContext
  ): Promise<{ shouldContinue: boolean }> {
    const output = result as ClaimGeneratorOutput

    if (!output?.claimsSet?.independent_claims?.length) {
      return { shouldContinue: false }
    }

    const attemptCount = (context.sharedState.get('attemptCount') as number) || 1

    if (attemptCount >= MAX_REGENERATION_ATTEMPTS) {
      console.warn(`[ClaimGeneratorAgent] 达到最大重试次数 ${MAX_REGENERATION_ATTEMPTS}，停止迭代`)
      return { shouldContinue: false }
    }

    const inventionData = context.sharedState.get('inventionUnderstanding') as
      | ClaimGeneratorInput['inventionUnderstanding']
      | undefined

    // === 1. 必要技术特征完整性检查 ===
    const missingFeatures: ClaimRegenerationContext['missingFeatures'] = []

    let featuresToCheck = inventionData?.keyFeatures || []
    if (featuresToCheck.length === 0 && inventionData?.technicalSolution) {
      featuresToCheck = inventionData.technicalSolution
        .split(/[；;。]/)
        .map((s) => s.trim())
        .filter((s) => s.length > MIN_FEATURE_LENGTH && s.length < MAX_FEATURE_LENGTH)
      if (featuresToCheck.length > 0) {
        console.log(
          `[ClaimGeneratorAgent.reflect] 从 technicalSolution 解析 ${featuresToCheck.length} 个特征用于完整性检查`
        )
      }
    }

    if (featuresToCheck.length > 0 && inventionData) {
      const requiredFeatures = extractRequiredFeatures({
        technicalProblem: inventionData.technicalProblem || '',
        keyFeatures: featuresToCheck,
        inventionConcepts: inventionData.inventionConcepts,
      })
      for (const feature of requiredFeatures) {
        const covered = output.claimsSet.independent_claims.some((claim) =>
          isFeatureCoveredInClaim(feature, claim.full_text)
        )
        if (!covered) {
          missingFeatures.push({
            feature,
            reason: `技术问题"${inventionData.technicalProblem || '未知'}"的解决需要该技术特征`,
            suggestedFix: `在独立权利要求中增加必要技术特征"${feature}"`,
            severity: 'critical',
          })
        }
      }
    }

    // === 2. 非必要特征检出 ===
    const essentialAnalysis = context.sharedState.get('essentialAnalysis') as
      | EssentialAnalysisResult
      | undefined
    const unnecessaryIncludedFeatures: ClaimRegenerationContext['unnecessaryIncludedFeatures'] = []

    if (essentialAnalysis?.analysis_table?.length) {
      for (const claim of output.claimsSet.independent_claims) {
        const found = identifyIncludedUnnecessaryFeatures(
          claim.full_text,
          essentialAnalysis.analysis_table
        )
        unnecessaryIncludedFeatures.push(...found)
      }
    }

    // === 3. 形式检查 ===
    const formalityIssues = performFormalityCheck(output)
    output.claimsSet.quality_check.formality_check = formalityIssues

    const allIssuesFound =
      missingFeatures.length > 0 ||
      unnecessaryIncludedFeatures.length > 0 ||
      !formalityIssues.passed

    if (!allIssuesFound) {
      console.log('[ClaimGeneratorAgent] 必要技术特征完整性 + 非必要特征检出 + 形式检查均通过')
      return { shouldContinue: false }
    }

    console.log(
      `[ClaimGeneratorAgent] 发现 ${missingFeatures.length} 个缺少的必要技术特征，` +
        `${unnecessaryIncludedFeatures.length} 个不应在独立权利要求中的非必要特征，` +
        `${formalityIssues.clarityIssues.length} 个清楚性问题`
    )

    const history: ClaimRegenerationContext['featureResolutionHistory'] =
      (context.sharedState.get(
        'featureResolutionHistory'
      ) as ClaimRegenerationContext['featureResolutionHistory']) || []

    const regenCtx: ClaimRegenerationContext = {
      attemptNumber: attemptCount + 1,
      maxAttempts: MAX_REGENERATION_ATTEMPTS,
      missingFeatures,
      unnecessaryIncludedFeatures,
      featureResolutionHistory: [
        ...history,
        {
          attempt: attemptCount,
          missingCount: missingFeatures.length,
          unnecessaryCount: unnecessaryIncludedFeatures.length,
          features: missingFeatures.map((f) => f.feature),
        },
      ],
    }

    context.sharedState.set('attemptCount', attemptCount + 1)
    context.sharedState.set('regenerationContext', regenCtx)
    context.sharedState.set('featureResolutionHistory', regenCtx.featureResolutionHistory)

    return { shouldContinue: true }
  }

  private async loadTemplate(): Promise<string> {
    try {
      return await readFile(this.templatePath, 'utf-8')
    } catch (error) {
      console.warn(`无法加载模板文件 ${this.templatePath}，使用默认配置`)
      return ''
    }
  }

  private async callLLMWithFallback(
    llm: NonNullable<ExecutionContext['llm']>,
    systemPrompt: string,
    userPrompt: string,
    input: ClaimGeneratorInput,
    startTime: number
  ): Promise<ClaimGeneratorOutput> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
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
          const independentCount = Array.isArray(parsed.independent_claims)
            ? parsed.independent_claims.length
            : 0
          console.log(
            `[ClaimGeneratorAgent] LLM返回JSON解析成功，独立权利要求数: ${independentCount}`
          )
          return normalizeOutput(parsed, input, startTime)
        }

        const mdParsed = parseMarkdownClaims(content)
        if (mdParsed) {
          console.log(
            `[ClaimGeneratorAgent] 从markdown提取权利要求成功，独立权利要求数: ${mdParsed.independent_claims.length}`
          )
          return normalizeOutput(mdParsed as unknown as Record<string, unknown>, input, startTime)
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))

        if (
          lastError.message.includes('authentication') ||
          lastError.message.includes('401') ||
          lastError.message.includes('403')
        ) {
          break
        }

        const delay = this.getRetryDelay(lastError, attempt)
        if (delay > 0 && attempt < LLM_MAX_RETRIES) {
          console.warn(
            `[ClaimGeneratorAgent] LLM 调用失败 (尝试 ${attempt + 1}/${LLM_MAX_RETRIES + 1}): ${lastError.message}，${delay}ms 后重试`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          console.warn(
            `[ClaimGeneratorAgent] LLM 调用失败 (尝试 ${attempt + 1}/${LLM_MAX_RETRIES + 1}): ${lastError.message}`
          )
        }
      }
    }

    console.error('[ClaimGeneratorAgent] 权利要求生成失败，使用回退输出:', lastError)
    return createFallbackOutput(input, startTime)
  }

  private getRetryDelay(error: Error, attempt: number): number {
    const msg = error.message.toLowerCase()
    if (msg.includes('rate limit') || msg.includes('429')) {
      return 5000 * (attempt + 1)
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      return 2000 * (attempt + 1)
    }
    return 1000 * (attempt + 1)
  }
}
