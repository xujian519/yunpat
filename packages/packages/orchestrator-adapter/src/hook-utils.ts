/**
 * Shared utilities for orchestrator-adapter hooks.
 * Communication protocol: stdin JSON → stdout JSONL → stderr logs.
 */

/** Read all content from stdin. */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk: string) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

/** Write a single-line JSONL to stdout. */
export function emit(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

/** Write a log line to stderr with optional prefix. */
export function log(prefix: string, ...args: unknown[]): void {
  process.stderr.write(`[${prefix}] ${args.join(' ')}\n`)
}

/** Check if any LLM API key is available. */
export function hasLLMApiKey(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DEEPSEEK_API_KEY
  )
}
