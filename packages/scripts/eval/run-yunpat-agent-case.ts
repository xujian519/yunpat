import { promises as fs } from 'node:fs'
import * as path from 'node:path'

import type {
  AgentOutput,
  EvalCase,
  StrategyConfig,
} from '../../packages/orchestrator/src/eval/types.js'

interface GoldBackfilledCase extends EvalCase {
  gold_conclusion?: {
    label?: string
    text?: string
  }
  gold_reasoning_outline?: string[]
  gold_citations?: Array<{
    span_id?: string
    quote?: string
  }>
  source_tier1_authority?: {
    decision_id?: string
  }
}

async function main() {
  const args = process.argv.slice(2)
  const casePathArg = args[0]

  if (!casePathArg) {
    throw new Error(
      '用法: node --import tsx ./scripts/eval/run-yunpat-agent-case.ts <case-json> [--mock]'
    )
  }

  const useMock = args.includes('--mock')
  const outputOnly = args.includes('--output-only')
  const strategy: StrategyConfig = {
    strategy_id: getFlagValue(args, '--strategy') ?? 'baseline',
  }

  const casePath = path.resolve(process.cwd(), casePathArg)
  const raw = await fs.readFile(casePath, 'utf-8')
  const testCase = JSON.parse(raw) as GoldBackfilledCase

  const output = useMock
    ? buildMockOutput(testCase, strategy)
    : await (await loadRunner()).runCase(testCase, strategy)

  if (outputOnly) {
    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log(JSON.stringify({ case: testCase.case_id, output }, null, 2))
}

function buildMockOutput(testCase: GoldBackfilledCase, strategy: StrategyConfig): AgentOutput {
  return {
    project_id: 'yunpat-agent',
    run_id: `mock-${strategy.strategy_id}-${Date.now()}`,
    case_id: testCase.case_id,
    task_type: testCase.task_type,
    final_answer: testCase.gold_conclusion?.text || 'mock output',
    structured_result: buildStructuredResultFromGold(testCase),
    citations: (testCase.gold_citations ?? []).map((citation) => ({
      span_id: citation.span_id,
      quote: citation.quote,
      doc_id: testCase.source_tier1_authority?.decision_id,
    })),
    timing_ms: 10,
    status: 'success',
  }
}

function buildStructuredResultFromGold(testCase: GoldBackfilledCase): Record<string, unknown> {
  const outline = testCase.gold_reasoning_outline ?? []

  if (testCase.expected_output_contract === 'inventiveness_v1') {
    return {
      closest_prior_art: outline[0] ?? '',
      distinguishing_features: outline[1] ? [outline[1]] : [],
      technical_problem: outline[2] ?? '',
      technical_motivation: outline[3] ?? '',
      conclusion: testCase.gold_conclusion?.label ?? '',
    }
  }

  if (testCase.expected_output_contract === 'article26_v1') {
    return {
      support_analysis: outline[1] ?? '',
      clarity_analysis: outline[0] ?? '',
      enablement_analysis: outline[2] ?? '',
      problem_spans: (testCase.gold_citations ?? []).map(
        (citation) => citation.span_id ?? citation.quote ?? ''
      ),
      conclusion: testCase.gold_conclusion?.label ?? '',
    }
  }

  if (testCase.expected_output_contract === 'rule20_v1') {
    return {
      legal_elements: ['公开充分', '支持性', '清楚性'],
      element_satisfaction_table: outline.map((item, index) => ({
        element: `element_${index + 1}`,
        analysis: item,
      })),
      problem_spans: (testCase.gold_citations ?? []).map(
        (citation) => citation.span_id ?? citation.quote ?? ''
      ),
      conclusion: testCase.gold_conclusion?.label ?? '',
    }
  }

  return {
    conclusion: testCase.gold_conclusion?.label ?? '',
  }
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  return args[index + 1]
}

async function loadRunner() {
  const module = await import('./createYunpatAgentEvalRunner.js')
  return module.createYunpatAgentEvalRunner()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
