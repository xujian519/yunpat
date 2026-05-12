export type EvalTaskType = 'inventiveness' | 'novelty' | 'article26' | 'rule20'
export type ProjectId = 'yunpat' | 'yunpat-agent'

export interface EvalCase {
  case_id: string
  task_type: EvalTaskType
  question: string
  prompt_input: Record<string, unknown>
  expected_output_contract: string
  grading_rubric: Record<string, unknown>
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

export interface StrategyConfig {
  strategy_id: string
  prompt_profile?: string
  retrieval_profile?: string
  routing_profile?: string
  output_profile?: string
  overrides?: Record<string, unknown>
}

export interface AgentCitation {
  span_id?: string
  doc_id?: string
  quote?: string
  norm_ref?: string
  confidence?: number
}

export interface AgentOutput {
  project_id: ProjectId
  run_id: string
  case_id: string
  task_type: EvalTaskType
  final_answer: string
  structured_result: Record<string, unknown>
  citations: AgentCitation[]
  raw_trace?: Record<string, unknown>
  timing_ms: number
  token_usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
  status: 'success' | 'error'
  error_message?: string
}

export interface EvalRunner {
  project_id: ProjectId
  runCase(input: EvalCase, strategy: StrategyConfig): Promise<AgentOutput>
}

export interface NormalizedOutput {
  final_answer: string
  structured_result: Record<string, unknown>
  citations: AgentCitation[]
  token_usage?: AgentOutput['token_usage']
  raw_trace?: Record<string, unknown>
}
