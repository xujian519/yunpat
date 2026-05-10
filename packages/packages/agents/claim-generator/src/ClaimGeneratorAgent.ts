import {
  Agent,
  type ExecutionContext,
  extractRequiredFeatures,
  isFeatureCoveredInClaim,
  identifyIncludedUnnecessaryFeatures,
  type EssentialFeatureAnalysis,
  SecureContentProvider,
} from '@yunpat/core'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import type { PriorArtSearchResult } from '@yunpat/agent-prior-art-search'
import type { BaseAgentInput, BaseAgentOutput } from '@yunpat/agent-base'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'

/**
 * 权利要求生成智能体输入
 */
export interface ClaimGeneratorInput extends BaseAgentInput {
  /** 发明理解结果（来自Phase 2） */
  inventionUnderstanding: InventionUnderstandingOutput
  /** 先导技术检索结果（来自Phase 3） */
  priorArtSearch?: PriorArtSearchResult
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
 * 形式检查问题
 */
export interface FormalityIssue {
  /** 权利要求编号 */
  claimNumber: number
  /** 问题描述 */
  issue: string
  /** 修改建议 */
  suggestion: string
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
    /** 形式检查结果（基于专利法条款） */
    formality_check?: {
      /** 是否通过 */
      passed: boolean
      /** 清楚简要问题（第26条第4款） */
      clarityIssues: FormalityIssue[]
      /** 非必要技术特征（实施细则第20条第1款） */
      unnecessaryFeatures: Array<{ claimNumber: number; feature: string; reason: string }>
      /** 总体建议 */
      recommendations: string[]
    }
  }
}

/**
 * 权利要求生成输出
 */
export interface ClaimGeneratorOutput extends BaseAgentOutput {
  /** 权利要求集合 */
  claimsSet: ClaimsSet
  /** 生成置信度 */
  confidence: number
}

interface StructuredInput {
  invention_title: string
  invention_type: string
  technical_field: string
  background_art?: string
  technical_problem: string
  technical_solution: string
  technical_effects?: string[]
  essential_features: Array<{
    name: string
    description: string
    is_essential: boolean
    is_distinguishing: boolean
  }>
  optional_features: Array<unknown>
  prior_art_analysis?: {
    closest_prior_art: string
    differences: string[]
    technical_problem_solved: string
  }
}

interface ClaimGeneratorPlan {
  input: ClaimGeneratorInput
  templateContent: string
  structuredInput: StructuredInput
}

interface ClaimRegenerationContext {
  attemptNumber: number
  maxAttempts: number
  missingFeatures: Array<{
    feature: string
    reason: string
    suggestedFix: string
    severity: string
  }>
  unnecessaryIncludedFeatures: Array<{ feature: string; reason: string }>
  featureResolutionHistory: Array<{
    attempt: number
    missingCount: number
    unnecessaryCount: number
    features: string[]
  }>
}

/** 必要技术特征分析结果（LLM 第一步输出） */
interface EssentialAnalysisResult {
  actual_technical_problem: string
  analysis_table: EssentialFeatureAnalysis[]
}

/** 领域到提示词文件的映射 */
const DOMAIN_PROMPT_MAP: Record<string, string> = {
  机械: 'claims-domain-mechanical.md',
  机械工程: 'claims-domain-mechanical.md',
  电气: 'claims-domain-electrical.md',
  电学: 'claims-domain-electrical.md',
  化学: 'claims-domain-chemical.md',
  医药: 'claims-domain-chemical.md',
  计算机: 'claims-domain-computer.md',
  软件: 'claims-domain-computer.md',
  通信: 'claims-domain-electrical.md',
}

/** 匹配领域关键词 */
const DOMAIN_KEYWORDS: Array<{ keywords: string[]; file: string }> = [
  {
    keywords: ['机械', '结构', '装置', '设备', '泵', '阀', '轴承', '齿轮', '轴'],
    file: 'claims-domain-mechanical.md',
  },
  {
    keywords: ['电', '电路', '信号', '通信', '半导体', '芯片'],
    file: 'claims-domain-electrical.md',
  },
  {
    keywords: ['化学', '组合物', '化合物', '制备', '催化剂', '聚合'],
    file: 'claims-domain-chemical.md',
  },
  {
    keywords: ['计算机', '软件', '算法', '数据处理', '人工智能', '机器学习'],
    file: 'claims-domain-computer.md',
  },
]

/** 常量：形式检查和解析相关阈值 */
const MAX_REGENERATION_ATTEMPTS = 3
const MAX_CLAIM_NUMBER = 1000
const MAX_CLAIM_TEXT_LENGTH = 2000
const MAX_INDEPENDENT_CLAIM_LENGTH = 300
const MAX_DETAIL_PATTERN_COUNT = 3
const MIN_FEATURE_LENGTH = 3
const MAX_FEATURE_LENGTH = 80
const LLM_MAX_RETRIES = 2

/**
 * 权利要求生成智能体
 *
 * 功能：
 * 1. 基于发明理解和检索分析构建结构化输入
 * 2. 使用专业的权利要求模板生成权利要求
 * 3. 支持逐段确认机制
 * 4. 输出结构化的权利要求集合
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

    // 初始化安全内容提供者（加密源优先，本地明文降级）
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

    // 构建结构化输入（关键特征已做兜底处理）
    const structuredInput = this.buildStructuredInput(input)

    // 将增强后的关键特征写回 inventionUnderstanding，供 reflect() 使用
    const enhancedUnderstanding = {
      ...inventionUnderstanding,
      keyFeatures: structuredInput.essential_features.map((f) => f.description),
    }
    context.sharedState.set('inventionUnderstanding', enhancedUnderstanding)

    // 读取模板内容
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

    // 加载分层提示词
    const systemPrompt = await this.loadLayeredPrompts(si.technical_field)
    const regenCtx = context.sharedState.get('regenerationContext') as
      | ClaimRegenerationContext
      | undefined

    // 检查是否有上一次迭代的分析结果可复用
    let analysisResult = context.sharedState.get('essentialAnalysis') as
      | EssentialAnalysisResult
      | undefined

    // === 第一步：必要技术特征分析（三步法决策流程） ===
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

    // === 第二步：基于分析结果撰写权利要求 ===
    console.log('   [步骤2b] 撰写权利要求...')
    const userPrompt = this.buildClaimPrompt(si, analysisResult, regenCtx)

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

    // 将分析结果存入 sharedState 供 reflect() 使用
    context.sharedState.set('essentialAnalysis', analysisResult)

    console.log(`\n✅ [权利要求生成] 撰写完成 (置信度: ${result.confidence.toFixed(2)})`)
    console.log(`   独立权利要求: ${result.claimsSet.independent_claims.length} 项`)
    console.log(`   从属权利要求: ${result.claimsSet.dependent_claims.length} 项`)

    return result
  }

  /**
   * 第一步：调用 LLM 执行三步法决策流程，分析必要技术特征
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

    // 构建区别特征列表
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
      // 降级：使用原始技术问题，保留原始 is_essential 分类
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
   * 构建第二步的权利要求撰写 prompt
   */
  private buildClaimPrompt(
    si: StructuredInput,
    analysis: EssentialAnalysisResult,
    regenCtx?: ClaimRegenerationContext
  ): string {
    const essentialFeatures = analysis.analysis_table.filter((f) => f.isEssential)
    const nonEssentialFeatures = analysis.analysis_table.filter((f) => !f.isEssential)

    let prompt = `## 必要技术特征分析结论

**实际解决的技术问题**：${analysis.actual_technical_problem}

**必要技术特征（写入独立权利要求）**：
${essentialFeatures.map((f, i) => `${i + 1}. [${f.location}] ${f.feature}（${f.reason}）`).join('\n')}

**非必要技术特征（写入从属权利要求）**：
${nonEssentialFeatures.map((f, i) => `${i + 1}. ${f.feature}（${f.reason}）`).join('\n')}

## 发明信息

**发明名称**：${si.invention_title}
**技术领域**：${si.technical_field}
**技术方案**：${si.technical_solution}
**技术效果**：${si.technical_effects?.join('；') || '无'}

${
  si.prior_art_analysis
    ? `
## 最接近现有技术
${si.prior_art_analysis.closest_prior_art}

**区别特征**：
${si.prior_art_analysis.differences.map((d, i) => `${i + 1}. ${d}`).join('\n')}
`
    : ''
}

## 撰写要求

基于上述分析结论撰写权利要求：

1. **独立权利要求1**：只包含必要技术特征，使用两部分撰写法
   - 前序部分：主题名称 + 与现有技术共有的必要特征
   - 特征部分："其特征在于" + 区别于现有技术的必要特征
   - 不得包含非必要特征（${nonEssentialFeatures.map((f) => f.feature).join('、')}应放入从属权利要求）

2. **从属权利要求**：将非必要特征和实施细节写入从属权利要求
   - 注意引用关系正确，无多项从属嵌套

3. **格式要求**：无附图标记、每项结尾一个句号、用词清楚

请输出 markdown 格式的权利要求书：

## 权利要求书

1. 一种${si.invention_title}，[前序部分]，其特征在于，[特征部分]。

2. 根据权利要求1所述的${si.invention_title}，其特征在于，[附加技术特征]。
...`

    if (regenCtx) {
      prompt += `

## 修正要求（第 ${regenCtx.attemptNumber} 次修订）
${regenCtx.missingFeatures.length > 0 ? `### 必须补充的必要技术特征\n${regenCtx.missingFeatures.map((f) => `- **${f.feature}**: ${f.reason}`).join('\n')}` : ''}
${regenCtx.unnecessaryIncludedFeatures.length > 0 ? `### 必须从独立权利要求移除的非必要特征\n${regenCtx.unnecessaryIncludedFeatures.map((f) => `- **${f.feature}**: ${f.reason}`).join('\n')}` : ''}`
    }

    return prompt
  }

  /**
   * 加载分层提示词
   */
  private async loadLayeredPrompts(technicalField: string): Promise<string> {
    const parts: string[] = []

    // 核心层（始终加载）
    const core = await this.loadSkillFile('claims-core.md')
    if (core) parts.push(core)

    // 策略层（始终加载）
    const essential = await this.loadSkillFile('claims-essential-features.md')
    if (essential) parts.push(essential)

    // 领域层（根据技术领域动态加载）
    const domainFile = this.matchDomain(technicalField)
    if (domainFile) {
      const domain = await this.loadSkillFile(domainFile)
      if (domain) parts.push(domain)
    }

    // 如果分层模板全部加载失败，回退到基础提示词
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
    // 先精确匹配 DOMAIN_PROMPT_MAP
    for (const [key, file] of Object.entries(DOMAIN_PROMPT_MAP)) {
      if (technicalField.includes(key)) return file
    }
    // 关键词匹配
    for (const entry of DOMAIN_KEYWORDS) {
      if (entry.keywords.some((kw) => technicalField.includes(kw))) return entry.file
    }
    return null
  }

  /**
   * 从 skills 目录加载单个模板文件
   * 优先级：加密源 → 本地明文 → null
   */
  private async loadSkillFile(filename: string): Promise<string | null> {
    // 优先从加密源加载
    const sealedPath = `patent-drafting/${filename.replace('.md', '')}`
    const content = await this.secureProvider.loadContent(sealedPath)
    if (content !== null) {
      return content.replace(/^---[\s\S]*?---\n*/, '').trim()
    }
    // 降级到本地明文
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

    // 边界检查：确保输出有效
    if (!output?.claimsSet?.independent_claims?.length) {
      return { shouldContinue: false }
    }

    const attemptCount = (context.sharedState.get('attemptCount') as number) || 1

    if (attemptCount >= MAX_REGENERATION_ATTEMPTS) {
      console.warn(`[ClaimGeneratorAgent] 达到最大重试次数 ${MAX_REGENERATION_ATTEMPTS}，停止迭代`)
      return { shouldContinue: false }
    }

    // 从 sharedState 获取发明理解数据（由 plan() 存入）
    const inventionData = context.sharedState.get('inventionUnderstanding') as
      | InventionUnderstandingOutput
      | undefined

    // === 1. 必要技术特征完整性检查 ===
    const missingFeatures: ClaimRegenerationContext['missingFeatures'] = []

    // 关键修复：当 keyFeatures 为空时，从 technicalSolution 中解析特征进行检查
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

    // === 2. 非必要特征检出（基于第一步分析结果） ===
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

    // === 3. 形式检查（清楚性 + 非必要特征） ===
    const formalityIssues = this.performFormalityCheck(output)

    // 将形式检查结果写入 quality_check
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

    // 构建修正上下文，存入 sharedState 供下次 act() 使用
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

  /**
   * 执行形式检查（清楚性、简要性、非必要技术特征）
   */
  private performFormalityCheck(output: ClaimGeneratorOutput): {
    passed: boolean
    clarityIssues: FormalityIssue[]
    unnecessaryFeatures: Array<{ claimNumber: number; feature: string; reason: string }>
    recommendations: string[]
  } {
    const clarityIssues: FormalityIssue[] = []
    const unnecessaryFeatures: Array<{ claimNumber: number; feature: string; reason: string }> = []

    // 检查独立权利要求
    for (const claim of output.claimsSet.independent_claims) {
      // 清楚性检查（第26条第4款）
      if (this.isUnclear(claim.full_text)) {
        clarityIssues.push({
          claimNumber: claim.claim_number,
          issue: '权利要求包含模糊表述',
          suggestion: '建议使用明确的技术术语，避免"大约""左右""可能"等模糊词汇',
        })
      }

      // 简要性检查
      if (!this.isConcise(claim.full_text)) {
        clarityIssues.push({
          claimNumber: claim.claim_number,
          issue: '权利要求过于冗长',
          suggestion: '建议删除非必要的技术细节，保持权利要求简洁',
        })
      }

      // 非必要技术特征检查（实施细则第20条第1款）
      const identified = this.identifyUnnecessaryFeatures(claim.full_text)
      for (const item of identified) {
        unnecessaryFeatures.push({
          claimNumber: claim.claim_number,
          feature: item.feature,
          reason: item.reason,
        })
      }
    }

    // 检查从属权利要求的清楚性
    for (const claim of output.claimsSet.dependent_claims) {
      if (this.isUnclear(claim.content)) {
        clarityIssues.push({
          claimNumber: claim.claim_number,
          issue: '从属权利要求包含模糊表述',
          suggestion: '建议使用明确的技术术语',
        })
      }
    }

    const recommendations: string[] = []
    if (clarityIssues.length > 0) {
      recommendations.push('建议修改不清楚或过于冗长的权利要求')
    }
    if (unnecessaryFeatures.length > 0) {
      recommendations.push('建议删除非必要技术特征（公知常识、常规技术等）')
    }

    const passed = clarityIssues.length === 0 && unnecessaryFeatures.length === 0

    return { passed, clarityIssues, unnecessaryFeatures, recommendations }
  }

  /** 检查是否包含模糊表述 */
  private isUnclear(content: string): boolean {
    const unclearPatterns = [
      /大约/g,
      /左右/g,
      /上下/g,
      /等等/g,
      /可能/g,
      /大概/g,
      /约/g,
      /或者其组合/g,
    ]
    return unclearPatterns.some((pattern) => pattern.test(content))
  }

  /** 检查是否简要 */
  private isConcise(content: string): boolean {
    if (content.length > MAX_INDEPENDENT_CLAIM_LENGTH) return false
    const detailPatterns = [/其中所述/g, /具体来说/g, /优选地/g, /更优选地/g]
    const detailCount = detailPatterns.reduce(
      (count, pattern) => count + (content.match(pattern) || []).length,
      0
    )
    return detailCount < MAX_DETAIL_PATTERN_COUNT
  }

  /** 识别非必要技术特征 */
  private identifyUnnecessaryFeatures(content: string): Array<{ feature: string; reason: string }> {
    const commonKnowledge = [
      { pattern: /采用常规技术/g, reason: '常规技术不需要写入权利要求' },
      { pattern: /使用现有技术/g, reason: '现有技术不需要写入权利要求' },
      { pattern: /本领域技术人员熟知/g, reason: '本领域技术人员熟知的内容不需要写入权利要求' },
    ]

    const result: Array<{ feature: string; reason: string }> = []
    for (const item of commonKnowledge) {
      if (item.pattern.test(content)) {
        result.push({ feature: item.pattern.source, reason: item.reason })
      }
    }
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
   * 关键修复：当 keyFeatures 为空时，从 inventionConcepts 和 technicalSolution 兜底提取
   */
  private buildStructuredInput(input: ClaimGeneratorInput): StructuredInput {
    const { inventionUnderstanding } = input

    // 提取关键特征（多源兜底）
    let keyFeatures = [...inventionUnderstanding.keyFeatures]

    // 兜底1: 从 inventionConcepts 提取
    if (keyFeatures.length === 0 && inventionUnderstanding.inventionConcepts?.length) {
      keyFeatures = inventionUnderstanding.inventionConcepts.flatMap((c) => c.keyFeatures || [])
      if (keyFeatures.length > 0) {
        console.log(`[ClaimGeneratorAgent] 从 inventionConcepts 提取 ${keyFeatures.length} 个特征`)
      }
    }

    // 兜底2: 从 technicalSolution 解析（按分号/句号拆分）
    if (keyFeatures.length === 0 && inventionUnderstanding.technicalSolution) {
      keyFeatures = inventionUnderstanding.technicalSolution
        .split(/[；;。]/)
        .map((s) => s.trim())
        .filter((s) => s.length > MIN_FEATURE_LENGTH && s.length < MAX_FEATURE_LENGTH)
      if (keyFeatures.length > 0) {
        console.log(`[ClaimGeneratorAgent] 从 technicalSolution 解析 ${keyFeatures.length} 个特征`)
      }
    }

    // 兜底3: 从 technicalProblem 生成最小特征集
    if (keyFeatures.length === 0 && inventionUnderstanding.technicalProblem) {
      keyFeatures = [`解决${inventionUnderstanding.technicalProblem}的技术方案`]
      console.log(`[ClaimGeneratorAgent] 从 technicalProblem 生成兜底特征`)
    }

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
      essential_features: keyFeatures.map((feature, index) => ({
        name: `特征${index + 1}`,
        description: feature,
        is_essential: true,
        is_distinguishing: true,
      })),
      optional_features: [],
      prior_art_analysis: input.priorArtSearch?.comparisonAnalysis
        ? {
            closest_prior_art: input.priorArtSearch.comparisonAnalysis.closestPriorArt.title,
            differences: input.priorArtSearch.comparisonAnalysis.differences,
            technical_problem_solved:
              input.priorArtSearch.comparisonAnalysis.technicalProblemSolved,
          }
        : undefined,
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
          return this.normalizeOutput(parsed, input, startTime)
        }

        // JSON 解析失败时，尝试从 markdown 格式提取权利要求
        const mdParsed = this.parseMarkdownClaims(content)
        if (mdParsed) {
          console.log(
            `[ClaimGeneratorAgent] 从markdown提取权利要求成功，独立权利要求数: ${mdParsed.independent_claims.length}`
          )
          return this.normalizeOutput(
            mdParsed as unknown as Record<string, unknown>,
            input,
            startTime
          )
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))

        // 认证错误不重试
        if (
          lastError.message.includes('authentication') ||
          lastError.message.includes('401') ||
          lastError.message.includes('403')
        ) {
          break
        }

        // 按错误类型计算退避延迟
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
    return this.createFallbackOutput(input, startTime)
  }

  /** 根据错误类型计算重试延迟 */
  private getRetryDelay(error: Error, attempt: number): number {
    const msg = error.message.toLowerCase()
    if (msg.includes('rate limit') || msg.includes('429')) {
      return 5000 * (attempt + 1) // 限流：5s/10s/15s
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      return 2000 * (attempt + 1) // 超时：2s/4s/6s
    }
    return 1000 * (attempt + 1) // 其他：1s/2s/3s
  }

  private normalizeOutput(
    parsed: Record<string, unknown>,
    _input: ClaimGeneratorInput,
    startTime: number
  ): ClaimGeneratorOutput {
    const executionTime = Date.now() - startTime

    const getArray = (key: string): unknown[] => {
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

    // 从 unknown 对象安全提取字符串
    const strField = (obj: unknown, field: string, fallback = ''): string => {
      const val = (obj as Record<string, unknown>)?.[field]
      return typeof val === 'string' ? val : fallback
    }

    const numField = (obj: unknown, field: string, fallback: number): number => {
      const val = (obj as Record<string, unknown>)?.[field]
      return typeof val === 'number' && !isNaN(val) ? val : fallback
    }

    // 解析独立权利要求
    const independentClaimsRaw = getArray('independent_claims')
    const independent_claims: IndependentClaim[] = independentClaimsRaw.map((claim, index) => ({
      claim_number: numField(claim, 'claim_number', index + 1),
      claim_type: strField(claim, 'claim_type', 'device') as IndependentClaim['claim_type'],
      preamble: strField(claim, 'preamble'),
      transition: strField(claim, 'transition', '其特征在于'),
      body: strField(claim, 'body'),
      full_text: strField(claim, 'full_text'),
      essential_features: Array.isArray((claim as Record<string, unknown>)?.essential_features)
        ? ((claim as Record<string, unknown>).essential_features as string[])
        : [],
    }))

    // 解析从属权利要求
    const dependentClaimsRaw = getArray('dependent_claims')
    const dependent_claims: DependentClaim[] = dependentClaimsRaw.map((claim, index) => ({
      claim_number: numField(claim, 'claim_number', independent_claims.length + index + 1),
      parent_claim: numField(claim, 'parent_claim', 1),
      content: strField(claim, 'content'),
      additional_features: Array.isArray((claim as Record<string, unknown>)?.additional_features)
        ? ((claim as Record<string, unknown>).additional_features as string[])
        : [],
      limitation_type: strField(
        claim,
        'limitation_type',
        'further_limitation'
      ) as DependentClaim['limitation_type'],
    }))

    // 解析质量检查
    const qualityCheckRaw = parsed.quality_check as Record<string, unknown> | undefined
    const quality_check = {
      clarity: qualityCheckRaw ? getString('clarity', '清楚') : '清楚',
      support: qualityCheckRaw ? getString('support', '支持') : '支持',
      essential_features: qualityCheckRaw ? getString('essential_features', '完整') : '完整',
      potential_issues: qualityCheckRaw ? getArray('potential_issues').map(String) : [],
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
      executionTime,
    }
  }

  /**
   * 从 markdown 格式文本中解析权利要求
   *
   * 支持的模式：
   * - 独立权利要求：`1. 一种XXX，...其特征在于，...。`
   * - 从属权利要求：`N. 根据权利要求M所述的XXX，其特征在于，...。`
   */
  private parseMarkdownClaims(content: string): ClaimsSet | null {
    if (!content?.trim()) return null

    // 提取"权利要求书"章节后的内容
    const claimsSection = content.match(/##\s*权利要求书?\s*\n([\s\S]*?)(?=\n##\s|$)/)
    const text = claimsSection ? claimsSection[1] : content

    // 逐行扫描提取权利要求
    const rawClaims: Array<{ num: number; text: string }> = []
    const lines = text.split('\n')
    let currentClaim: { num: number; text: string } | null = null

    for (const line of lines) {
      const claimStart = line.match(/^\s*(\d+)\s*[.、．]\s*(.+)/)
      if (claimStart) {
        // 编号范围和去重检查
        const num = parseInt(claimStart[1], 10)
        if (num < 1 || num > MAX_CLAIM_NUMBER) continue
        if (rawClaims.some((c) => c.num === num)) continue

        // 保存上一条
        if (currentClaim) {
          rawClaims.push(currentClaim)
        }
        currentClaim = { num, text: claimStart[2].trim() }
      } else if (currentClaim && line.trim().length > 0) {
        // 只合并非空且以缩进开头的续行（避免误合并不相关内容）
        currentClaim.text += line.trim()
      }
    }
    if (currentClaim) {
      rawClaims.push(currentClaim)
    }

    if (rawClaims.length === 0) return null

    const independent_claims: IndependentClaim[] = []
    const dependent_claims: DependentClaim[] = []

    for (const raw of rawClaims) {
      // 限制单条权利要求长度，防止 ReDoS
      const cleanedText = raw.text.replace(/\s+/g, ' ').trim()
      if (cleanedText.length > MAX_CLAIM_TEXT_LENGTH) continue

      if (cleanedText.match(/根据权利要求\s*(\d+)\s*所述/)) {
        // 从属权利要求
        const parentMatch = cleanedText.match(/根据权利要求\s*(\d+)\s*所述/)
        const parentNum = parentMatch ? parseInt(parentMatch[1]) : 1
        const featureMatch = cleanedText.match(/其特征在于[，,：:]\s*(.+)/)
        const feature = featureMatch ? featureMatch[1].replace(/。$/, '') : cleanedText

        dependent_claims.push({
          claim_number: raw.num,
          parent_claim: parentNum,
          content: cleanedText,
          additional_features: [feature],
          limitation_type: 'further_limitation',
        })
      } else {
        // 独立权利要求 — 使用字符串分割代替正则回溯
        const transitionIdx = cleanedText.indexOf('，其特征在于')
        const altTransitionIdx = cleanedText.indexOf('，其特征是')

        let preamble: string
        let body: string

        if (transitionIdx !== -1) {
          preamble = cleanedText.substring(0, transitionIdx)
          body = cleanedText.substring(transitionIdx + '，其特征在于'.length).replace(/。$/, '')
        } else if (altTransitionIdx !== -1) {
          preamble = cleanedText.substring(0, altTransitionIdx)
          body = cleanedText.substring(altTransitionIdx + '，其特征是'.length).replace(/。$/, '')
        } else {
          preamble = cleanedText.replace(/。$/, '')
          body = ''
        }

        independent_claims.push({
          claim_number: raw.num,
          claim_type: 'device',
          preamble,
          transition: '其特征在于',
          body,
          full_text: cleanedText.endsWith('。') ? cleanedText : cleanedText + '。',
          essential_features: [],
        })
      }
    }

    if (independent_claims.length === 0) return null

    return {
      independent_claims,
      dependent_claims,
      layout_strategy: '基于markdown解析',
      protection_scope_analysis: '',
      quality_check: {
        clarity: '',
        support: '',
        essential_features: '',
        potential_issues: [],
      },
    }
  }

  private createFallbackOutput(
    input: ClaimGeneratorInput,
    startTime: number
  ): ClaimGeneratorOutput {
    const executionTime = Date.now() - startTime
    const { inventionUnderstanding } = input

    // 关键修复：多源兜底获取特征
    let fallbackFeatures = [...inventionUnderstanding.keyFeatures]

    if (fallbackFeatures.length === 0 && inventionUnderstanding.inventionConcepts?.length) {
      fallbackFeatures = inventionUnderstanding.inventionConcepts.flatMap(
        (c) => c.keyFeatures || []
      )
    }

    if (fallbackFeatures.length === 0 && inventionUnderstanding.technicalSolution) {
      fallbackFeatures = inventionUnderstanding.technicalSolution
        .split(/[；;。]/)
        .map((s) => s.trim())
        .filter((s) => s.length > MIN_FEATURE_LENGTH && s.length < MAX_FEATURE_LENGTH)
    }

    if (fallbackFeatures.length === 0 && inventionUnderstanding.technicalProblem) {
      fallbackFeatures = [`解决${inventionUnderstanding.technicalProblem}的技术方案`]
    }

    const title = inventionUnderstanding.technicalField.split(',')[0] || '发明'
    const featureText = fallbackFeatures.slice(0, 5).join('；')

    // 生成简单的独立权利要求
    const independentClaim: IndependentClaim = {
      claim_number: 1,
      claim_type: 'device',
      preamble: `一种${title}`,
      transition: '其特征在于',
      body: featureText ? featureText + '。' : '包含解决上述技术问题的必要技术特征。',
      full_text: featureText
        ? `一种${title}，其特征在于：${featureText}。`
        : `一种${title}，其特征在于：包含解决上述技术问题的必要技术特征。`,
      essential_features: fallbackFeatures.slice(0, 5),
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
          essential_features: fallbackFeatures.length > 0 ? '基础完整' : '特征缺失',
          potential_issues:
            fallbackFeatures.length > 0
              ? ['AI生成失败，使用简化版本']
              : ['AI生成失败且无法提取有效特征，请检查输入数据'],
        },
      },
      confidence: fallbackFeatures.length > 0 ? 0.5 : 0.3,
      executionTime,
    }
  }
}
