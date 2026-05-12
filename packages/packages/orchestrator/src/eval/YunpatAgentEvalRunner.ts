import { OutputNormalizer } from './normalize-output.js'
import type { AgentOutput, EvalCase, EvalRunner, ProjectId, StrategyConfig } from './types.js'

export interface AgentRuntimeGateway {
  executeCase(payload: {
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
  }): Promise<unknown>
}

export class YunpatAgentEvalRunner implements EvalRunner {
  project_id: ProjectId = 'yunpat-agent'

  constructor(
    private gateway: AgentRuntimeGateway,
    private normalizer: OutputNormalizer = new OutputNormalizer()
  ) {}

  async runCase(input: EvalCase, strategy: StrategyConfig): Promise<AgentOutput> {
    const runId = `${this.project_id}-${strategy.strategy_id}-${Date.now()}`
    const startedAt = Date.now()

    try {
      const raw = await this.gateway.executeCase({
        eval_mode: true,
        case_id: input.case_id,
        task_type: input.task_type,
        expected_output_contract: input.expected_output_contract,
        strategy,
        question: input.question,
        prompt_input: input.prompt_input,
        source_tier1_authority: input.source_tier1_authority,
        source_tier2_norms: input.source_tier2_norms,
        gold_citations: input.gold_citations,
        gold_reasoning_outline: input.gold_reasoning_outline,
        gold_conclusion: input.gold_conclusion,
      })

      const normalized = this.normalizer.normalize(input, raw)
      return {
        project_id: this.project_id,
        run_id: runId,
        case_id: input.case_id,
        task_type: input.task_type,
        final_answer: normalized.final_answer,
        structured_result: normalized.structured_result,
        citations: normalized.citations,
        raw_trace: normalized.raw_trace,
        timing_ms: Date.now() - startedAt,
        token_usage: normalized.token_usage,
        status: 'success',
      }
    } catch (error) {
      return {
        project_id: this.project_id,
        run_id: runId,
        case_id: input.case_id,
        task_type: input.task_type,
        final_answer: '',
        structured_result: {},
        citations: [],
        timing_ms: Date.now() - startedAt,
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
