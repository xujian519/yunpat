import type { AgentCitation, EvalCase, NormalizedOutput } from './types.js'

const CITATION_PATTERN = /\[([^\]]+)\]/g

export class OutputNormalizer {
  normalize(input: EvalCase, raw: unknown): NormalizedOutput {
    const record = isRecord(raw) ? raw : {}
    const finalAnswer = this.extractFinalAnswer(record)
    const structuredResult = this.extractStructuredResult(record, finalAnswer)
    const citations = this.extractCitations(record, finalAnswer)
    const tokenUsage = this.extractTokenUsage(record)

    return {
      final_answer: finalAnswer,
      structured_result: structuredResult,
      citations,
      token_usage: tokenUsage,
      raw_trace: {
        expected_output_contract: input.expected_output_contract,
        ...this.extractTrace(record),
        raw_type: typeof raw,
      },
    }
  }

  private extractFinalAnswer(raw: Record<string, unknown>): string {
    const candidates = [raw.output, raw.response, raw.content, raw.markdown, raw.final_answer]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    }
    return ''
  }

  private extractStructuredResult(
    raw: Record<string, unknown>,
    finalAnswer: string
  ): Record<string, unknown> {
    const directCandidates = [raw.structured_result, raw.result, raw.data]
    for (const candidate of directCandidates) {
      if (isRecord(candidate)) return candidate
    }

    const embedded = tryParseEmbeddedJson(finalAnswer)
    return isRecord(embedded) ? embedded : {}
  }

  private extractCitations(raw: Record<string, unknown>, text: string): AgentCitation[] {
    if (Array.isArray(raw.citations)) {
      return raw.citations.filter(isRecord).map((citation) => ({
        span_id: asOptionalString(citation.span_id),
        doc_id: asOptionalString(citation.doc_id),
        quote: asOptionalString(citation.quote),
        norm_ref: asOptionalString(citation.norm_ref),
        confidence: typeof citation.confidence === 'number' ? citation.confidence : undefined,
      }))
    }

    const matches: AgentCitation[] = []
    let match: RegExpExecArray | null
    while ((match = CITATION_PATTERN.exec(text)) !== null) {
      matches.push({ quote: match[1] })
    }
    CITATION_PATTERN.lastIndex = 0
    return matches
  }

  private extractTokenUsage(raw: Record<string, unknown>) {
    const usage = raw.token_usage ?? raw.usage
    if (!isRecord(usage)) return undefined

    return {
      input_tokens: asOptionalNumber(usage.input_tokens),
      output_tokens: asOptionalNumber(usage.output_tokens),
      total_tokens:
        asOptionalNumber(usage.total_tokens) ??
        sumDefined(asOptionalNumber(usage.input_tokens), asOptionalNumber(usage.output_tokens)),
    }
  }

  private extractTrace(raw: Record<string, unknown>): Record<string, unknown> | undefined {
    const explicitTrace = raw.raw_trace
    if (isRecord(explicitTrace)) {
      return explicitTrace
    }

    const trace: Record<string, unknown> = {}
    for (const key of ['intent', 'plan', 'metadata', 'metrics']) {
      if (raw[key] !== undefined) {
        trace[key] = raw[key]
      }
    }
    return Object.keys(trace).length > 0 ? trace : undefined
  }
}

function tryParseEmbeddedJson(text: string): unknown {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1] ?? text.trim()
  try {
    return JSON.parse(candidate)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function sumDefined(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined
  return (a ?? 0) + (b ?? 0)
}
