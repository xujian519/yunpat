import type {
  IndependentClaim,
  DependentClaim,
  ClaimsSet,
  ClaimGeneratorOutput,
  ClaimGeneratorInput,
  StructuredInput,
  EssentialAnalysisResult,
  ClaimRegenerationContext,
} from './types.js'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import {
  MAX_CLAIM_NUMBER,
  MAX_CLAIM_TEXT_LENGTH,
  MIN_FEATURE_LENGTH,
  MAX_FEATURE_LENGTH,
} from './types.js'

/**
 * 标准化 LLM 输出为 ClaimGeneratorOutput
 */
export function normalizeOutput(
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
 */
export function parseMarkdownClaims(content: string): ClaimsSet | null {
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
      const num = parseInt(claimStart[1], 10)
      if (num < 1 || num > MAX_CLAIM_NUMBER) continue
      if (rawClaims.some((c) => c.num === num)) continue

      if (currentClaim) {
        rawClaims.push(currentClaim)
      }
      currentClaim = { num, text: claimStart[2].trim() }
    } else if (currentClaim && line.trim().length > 0) {
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
      // 独立权利要求
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

/**
 * 构建结构化输入
 */
export function buildStructuredInput(input: ClaimGeneratorInput): StructuredInput {
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

  // 兜底2: 从 technicalSolution 解析
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
    invention_type: inferInventionType(inventionUnderstanding),
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
          technical_problem_solved: input.priorArtSearch.comparisonAnalysis.technicalProblemSolved,
        }
      : undefined,
  }
}

/**
 * 推断发明类型
 */
function inferInventionType(understanding: InventionUnderstandingOutput): string {
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

/**
 * 构建权利要求撰写 prompt
 */
export function buildClaimPrompt(
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
 * 创建回退输出
 */
export function createFallbackOutput(
  input: ClaimGeneratorInput,
  startTime: number
): ClaimGeneratorOutput {
  const executionTime = Date.now() - startTime
  const { inventionUnderstanding } = input

  let fallbackFeatures = [...inventionUnderstanding.keyFeatures]

  if (fallbackFeatures.length === 0 && inventionUnderstanding.inventionConcepts?.length) {
    fallbackFeatures = inventionUnderstanding.inventionConcepts.flatMap((c) => c.keyFeatures || [])
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

  const independentClaim = {
    claim_number: 1,
    claim_type: 'device' as const,
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
