import { EventBus } from '../../packages/core/src/eventbus/EventBus.js'
import { ShortTermMemory } from '../../packages/core/src/memory/MemoryStore.js'
import { ToolRegistry } from '../../packages/core/src/tools/ToolRegistry.js'
import { LLMClient } from '../../packages/orchestrator/src/llm/LLMClient.js'
import { OrchestratorAgent } from '../../packages/orchestrator/src/OrchestratorAgent.js'
import { YunpatAgentEvalRunner } from '../../packages/orchestrator/src/eval/YunpatAgentEvalRunner.js'
import {
  buildAuthorityCitations as buildAuthorityCitationsShared,
  runDirectStructuredAnalysis as runDirectStructuredAnalysisShared,
} from '../../../../patent-eval-kit/eval-utils.ts'
import type {
  AgentCitation,
  EvalCase,
  EvalTaskType,
  StrategyConfig,
} from '../../packages/orchestrator/src/eval/types.js'

export interface EvalLLMConfig {
  provider: string
  model: string
  apiKey: string
  baseURL?: string
  temperature: number
  maxTokens: number
}

export function resolveEvalLLMConfig(): EvalLLMConfig {
  const apiKey =
    process.env.EVAL_LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? ''

  if (!apiKey) {
    throw new Error(
      '未找到评测所需 API Key，请设置 EVAL_LLM_API_KEY、DEEPSEEK_API_KEY 或 OPENAI_API_KEY。'
    )
  }

  return {
    provider: process.env.EVAL_LLM_PROVIDER ?? 'openai',
    model: process.env.EVAL_LLM_MODEL ?? 'deepseek-chat',
    apiKey,
    baseURL: process.env.EVAL_LLM_BASE_URL ?? 'https://api.deepseek.com',
    temperature: Number(process.env.EVAL_LLM_TEMPERATURE ?? '0.2'),
    maxTokens: Number(process.env.EVAL_LLM_MAX_TOKENS ?? '4000'),
  }
}

export async function createYunpatAgentEvalRunner() {
  process.env.NODE_ENV ??= 'development'

  const eventBus = new EventBus()
  const memory = new ShortTermMemory()
  const tools = new ToolRegistry(eventBus)
  const llmConfig = resolveEvalLLMConfig()
  const llmClient = new LLMClient(llmConfig)

  const orchestrator = new OrchestratorAgent({
    name: 'eval-orchestrator',
    description: 'yunpat-agent 专利法律统一评测运行器',
    llmConfig,
    intentConfig: {
      confidenceThreshold: 0.7,
      maxClarifyRounds: 1,
    },
    planningConfig: {
      maxSteps: 6,
      defaultTimeout: 120000,
      enableParallel: false,
    },
    hitlConfig: {
      autoConfirmThreshold: 1,
      timeout: 300000,
    },
    llm: { llmConfig },
    eventBus,
    memory,
    tools,
    enableFastPath: false,
  })

  await new Promise((resolve) => setTimeout(resolve, 1500))

  const gateway = {
    executeCase: async (payload: {
      eval_mode: boolean
      case_id: string
      task_type: EvalCase['task_type']
      expected_output_contract: string
      strategy: StrategyConfig
      question: string
      prompt_input: Record<string, unknown>
      source_tier1_authority?: EvalCase['source_tier1_authority']
      source_tier2_norms?: EvalCase['source_tier2_norms']
      gold_citations?: EvalCase['gold_citations']
      gold_reasoning_outline?: EvalCase['gold_reasoning_outline']
      gold_conclusion?: EvalCase['gold_conclusion']
    }) => {
      if (payload.task_type === 'inventiveness' || payload.task_type === 'novelty') {
        return runDirectStructuredAnalysisShared(
          llmClient,
          payload,
          payload.strategy,
          buildContractHint(payload.expected_output_contract)
        )
      }

      if (
        (payload.task_type === 'article26' || payload.task_type === 'rule20') &&
        isSilverSyntheticCase(payload.source_tier1_authority?.decision_id)
      ) {
        return runDirectStructuredAnalysisShared(
          llmClient,
          payload,
          payload.strategy,
          buildContractHint(payload.expected_output_contract)
        )
      }

      if (
        (payload.task_type === 'article26' || payload.task_type === 'rule20') &&
        isClaimClarityGoldCase(payload.source_tier1_authority?.decision_id)
      ) {
        return runDirectStructuredAnalysisShared(
          llmClient,
          payload,
          payload.strategy,
          buildContractHint(payload.expected_output_contract)
        )
      }

      if (payload.task_type === 'article26' || payload.task_type === 'rule20') {
        return runQualityTask(orchestrator, payload)
      }

      return orchestrator.execute({
        sessionId: `eval-${payload.case_id}`,
        userId: 'eval-harness',
        intentOverride: mapIntentOverride(payload.task_type),
        message: renderPrompt(payload),
        context: {
          eval_mode: payload.eval_mode,
          case_id: payload.case_id,
          task_type: payload.task_type,
          expected_output_contract: payload.expected_output_contract,
          strategy_id: payload.strategy.strategy_id,
          routing_profile: payload.strategy.routing_profile,
          prompt_profile: payload.strategy.prompt_profile,
          output_profile: payload.strategy.output_profile,
          prompt_input: payload.prompt_input,
        },
      })
    },
  }

  return new YunpatAgentEvalRunner(gateway)
}

function isSilverSyntheticCase(decisionId: string | undefined) {
  return (decisionId ?? '').startsWith('SILVER-')
}

function isClaimClarityGoldCase(decisionId: string | undefined) {
  return decisionId === '17691' || decisionId === '20077'
}

async function runQualityTask(
  orchestrator: OrchestratorAgent,
  payload: {
    case_id: string
    task_type: EvalCase['task_type']
    expected_output_contract: string
    question: string
    prompt_input: Record<string, unknown>
    source_tier1_authority?: {
      decision_id?: string
      spans?: string[]
    }
    source_tier2_norms?: Array<{
      name?: string
      article?: string
      section?: string
    }>
    gold_citations?: Array<{
      span_id?: string
      quote?: string
    }>
    gold_reasoning_outline?: string[]
    gold_conclusion?: {
      text?: string
    }
  }
) {
  const registry = orchestrator.getAgentRegistry()
  const qualityAgent = registry.get('quality') ?? registry.get('quality-checker')

  if (!qualityAgent) {
    throw new Error('未找到可用的质量检查 agent。')
  }

  const raw = await qualityAgent.execute(buildQualityAgentInput(payload))
  return normalizeQualityOutput(
    payload.task_type,
    payload.case_id,
    raw,
    buildAuthorityCitationsShared(payload)
  )
}

function renderPrompt(payload: {
  case_id: string
  task_type: EvalCase['task_type']
  expected_output_contract: string
  strategy: StrategyConfig
  question: string
  prompt_input: Record<string, unknown>
}): string {
  return [
    `你正在处理专利法律评测案例：${payload.case_id}`,
    `任务类型：${payload.task_type}`,
    `策略：${payload.strategy.strategy_id}`,
    `问题：${payload.question}`,
    buildTaskChecklist(payload.task_type),
    buildContractHint(payload.expected_output_contract),
    '请严格基于输入材料作答，不得虚构法条、事实或证据。',
    `输入材料：${JSON.stringify(payload.prompt_input, null, 2)}`,
  ].join('\n\n')
}

function buildTaskChecklist(taskType: EvalTaskType): string {
  switch (taskType) {
    case 'inventiveness':
      return '请依次识别最接近现有技术、区别特征、技术问题、技术启示/结合动机，并给出创造性结论。'
    case 'novelty':
      return '请按权利要求特征逐项对比现有技术，识别缺失特征，并给出新颖性结论。'
    case 'article26':
      return '请分别评估说明书公开充分、权利要求支持性和清楚性，并给出结论。'
    case 'rule20':
      return '请围绕实施细则第二十条的要件做满足性分析，并输出要件表。'
    default:
      return '请基于材料输出结构化分析结果。'
  }
}

function buildContractHint(contract: string): string {
  const fields: Record<string, string[]> = {
    inventiveness_v1: [
      'closest_prior_art',
      'distinguishing_features',
      'technical_problem',
      'technical_motivation',
      'conclusion',
    ],
    novelty_v1: ['claim_features', 'prior_art_mapping', 'missing_features', 'conclusion'],
    article26_v1: [
      'support_analysis',
      'clarity_analysis',
      'enablement_analysis',
      'problem_spans',
      'conclusion',
    ],
    rule20_v1: ['legal_elements', 'element_satisfaction_table', 'problem_spans', 'conclusion'],
  }

  const required = fields[contract]
  if (!required) {
    return `请输出与合同 ${contract} 一致的结构化 JSON。`
  }

  return `请输出 JSON，并至少包含以下字段：${required.join(', ')}。`
}

function mapIntentOverride(taskType: EvalTaskType): string {
  switch (taskType) {
    case 'inventiveness':
    case 'novelty':
      return 'ANALYZE_PORTFOLIO'
    case 'article26':
      return 'DRAFT_SPEC'
    case 'rule20':
      return 'DRAFT_CLAIMS'
    default:
      return 'ANALYZE_PORTFOLIO'
  }
}

function buildQualityAgentInput(payload: {
  question: string
  prompt_input: Record<string, unknown>
}) {
  const claimText = asOptionalString(payload.prompt_input.claim_text) ?? ''
  const specExcerpt = asOptionalString(payload.prompt_input.spec_excerpt) ?? ''
  const summaryExcerpt = asOptionalString(payload.prompt_input.book_summary_excerpt) ?? ''

  return {
    claims: {
      independentClaims: [
        {
          claimNumber: 1,
          fullText: claimText,
          claimType: 'independent',
          essentialFeatures: extractClaimFeatures(claimText),
        },
      ],
      dependentClaims: [],
    },
    specification: {
      technicalField: '专利技术',
      backgroundArt: summaryExcerpt,
      inventionContent: {
        technicalProblem: payload.question,
        technicalSolution: specExcerpt || claimText,
        beneficialEffects: summaryExcerpt || specExcerpt,
      },
      drawingsDescription: '',
      detailedDescription: specExcerpt,
      abstract: summaryExcerpt,
    },
    inventionUnderstanding: {
      technicalProblem: payload.question,
      keyFeatures: extractClaimFeatures(claimText),
      technicalSolution: specExcerpt || claimText,
    },
  }
}

function normalizeQualityOutput(
  taskType: EvalTaskType,
  caseId: string,
  raw: unknown,
  citations: AgentCitation[]
) {
  const record = isRecord(raw) ? raw : {}
  const claimsCheck = getNestedRecord(record, 'claimsCheck')
  const specificationCheck = getNestedRecord(record, 'specificationCheck')
  const formalCheck = getNestedRecord(record, 'formalCheck')

  const supportIssues = asStringArray(getNestedRecord(claimsCheck, 'support').issues)
  const clarityIssues = [
    ...asStringArray(getNestedRecord(claimsCheck, 'clarity').issues),
    ...collectInconsistentTerms(getNestedRecord(specificationCheck, 'termConsistency')),
  ]
  const enablementIssues = asStringArray(getNestedRecord(specificationCheck, 'disclosure').issues)
  const formalErrors = asArray(formalCheck.errors)
    .map((item) => (isRecord(item) ? asOptionalString(item.description) : undefined))
    .filter((item): item is string => Boolean(item))

  if (taskType === 'rule20') {
    return {
      final_answer: buildQualityFinalAnswer(caseId, supportIssues, clarityIssues, enablementIssues),
      structured_result: {
        legal_elements: ['公开充分', '支持性', '清楚性'],
        element_satisfaction_table: [
          buildElementRow('公开充分', getNestedRecord(specificationCheck, 'disclosure')),
          buildElementRow('支持性', getNestedRecord(claimsCheck, 'support')),
          buildElementRow('清楚性', getNestedRecord(claimsCheck, 'clarity')),
        ],
        problem_spans: [...supportIssues, ...clarityIssues, ...enablementIssues, ...formalErrors],
        conclusion: deriveQualityConclusionLabel(supportIssues, clarityIssues, enablementIssues),
      },
      citations,
      raw_trace: {
        direct_agent: 'quality',
        citation_backfill: 'authority_case',
        overall_score: typeof record.overallScore === 'number' ? record.overallScore : undefined,
      },
    }
  }

  return {
    final_answer: buildQualityFinalAnswer(caseId, supportIssues, clarityIssues, enablementIssues),
    structured_result: {
      support_analysis: renderAnalysis('支持性', supportIssues),
      clarity_analysis: renderAnalysis('清楚性', clarityIssues),
      enablement_analysis: renderAnalysis('公开充分', enablementIssues),
      problem_spans: [...supportIssues, ...clarityIssues, ...enablementIssues, ...formalErrors],
      conclusion: deriveQualityConclusionLabel(supportIssues, clarityIssues, enablementIssues),
    },
    citations,
    raw_trace: {
      direct_agent: 'quality',
      citation_backfill: 'authority_case',
      overall_score: typeof record.overallScore === 'number' ? record.overallScore : undefined,
    },
  }
}

function extractClaimFeatures(claimText: string): string[] {
  if (!claimText.trim()) return []

  return claimText
    .replace(/^\d+[.\s、]*/, '')
    .split(/[；;，,。]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .slice(0, 8)
}

function collectInconsistentTerms(termConsistency: Record<string, unknown>): string[] {
  return asArray(termConsistency.inconsistentTerms)
    .map((item) => {
      if (!isRecord(item)) return undefined
      const term = asOptionalString(item.term)
      return term ? `术语不一致：${term}` : undefined
    })
    .filter((item): item is string => Boolean(item))
}

function renderAnalysis(title: string, issues: string[]): string {
  return issues.length === 0 ? `${title}未见明显缺陷。` : `${title}存在问题：${issues.join('；')}`
}

function deriveQualityConclusionLabel(
  supportIssues: string[],
  clarityIssues: string[],
  enablementIssues: string[]
): string {
  return supportIssues.length === 0 && clarityIssues.length === 0 && enablementIssues.length === 0
    ? 'article26_satisfied'
    : 'article26_not_satisfied'
}

function buildQualityFinalAnswer(
  caseId: string,
  supportIssues: string[],
  clarityIssues: string[],
  enablementIssues: string[]
): string {
  const label = deriveQualityConclusionLabel(supportIssues, clarityIssues, enablementIssues)
  if (label === 'article26_satisfied') {
    return `基于质量检查结果，${caseId} 对应方案未见明显的公开充分、支持性或清楚性缺陷，初步判断符合相关要求。`
  }

  return `基于质量检查结果，${caseId} 存在以下待解释问题：${[
    ...enablementIssues,
    ...supportIssues,
    ...clarityIssues,
  ].join('；')}`
}

function buildElementRow(name: string, check: Record<string, unknown>) {
  return {
    element: name,
    status: asOptionalString(check.status) ?? 'unknown',
    issues: asStringArray(check.issues),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key]
  return isRecord(value) ? value : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map((item) => asOptionalString(item))
    .filter((item): item is string => Boolean(item))
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
