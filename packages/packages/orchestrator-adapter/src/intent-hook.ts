/**
 * @file DeepSeek TUI 意图检测 Hook
 * @description 在 message_submit 事件触发时，使用 IntentRecognizer 识别用户意图，
 *              输出 HookInstruction 格式 JSONL 指令。
 *
 * 通信协议：stdin 读取 JSON，stdout 输出 JSONL，stderr 写日志。
 *
 * 输出格式：与 Rust HookInstruction 枚举对齐
 * - {"action":"set_mode","mode":"plan","reason":"..."}
 * - {"action":"load_skill","skill":"patent-writer"}
 * - {"action":"prepend_context","content":"..."}
 */

import { IntentRecognizer, LLMClient } from '@yunpat/orchestrator'
import type { OrchestratorInput } from '@yunpat/orchestrator'
import { generatePlan } from './plan-injector.js'

/** 向 stderr 写日志 */
function log(...args: unknown[]): void {
  process.stderr.write(`[intent-hook] ${args.join(' ')}\n`)
}

/** 从 stdin 读取全部内容 */
function readStdin(): Promise<string> {
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

/** 向 stdout 写入单行 JSONL */
function emit(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

/** 检查是否有可用的 LLM API Key */
function hasLLMApiKey(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DEEPSEEK_API_KEY
  )
}

/** 意图类型到 HookInstruction 的映射 */
function emitInstructionsForIntent(intentResult: {
  intent: string
  confidence: number
  complexity: string
  extracted: { keywords: string[]; title?: string }
}): void {
  const { intent, confidence, complexity, extracted } = intentResult

  // 高置信度的专利意图：切换到 plan 模式并加载 skill
  if (
    confidence >= 0.7 &&
    ['DRAFT_FULL', 'DRAFT_CLAIMS', 'DRAFT_SPEC', 'RESPOND_OA'].includes(intent)
  ) {
    emit({
      action: 'set_mode',
      mode: 'plan',
      reason: `检测到专利任务意图 (${intent})，置信度 ${confidence.toFixed(2)}`,
    })

    emit({
      action: 'load_skill',
      skill: 'patent-writer',
    })

    emit({
      action: 'prepend_context',
      content: `[专利模式] 已激活专利工具集。意图: ${intent}，复杂度: ${complexity}，关键词: ${extracted.keywords.join('、')}`,
    })

    // 触发任务规划（2A.3）
    if (extracted.title) {
      generatePlan(extracted.title).catch((err) => {
        log(`任务规划失败: ${err instanceof Error ? err.message : String(err)}`)
      })
    }
  }
  // 检索类意图：保持当前模式，添加上下文
  else if (intent === 'SEARCH') {
    emit({
      action: 'prepend_context',
      content: `[检索模式] 已激活专利检索工具。关键词: ${extracted.keywords.join('、')}`,
    })

    if (extracted.title) {
      generatePlan(extracted.title).catch((err) => {
        log(`任务规划失败: ${err instanceof Error ? err.message : String(err)}`)
      })
    }
  }
  // 低置信度：提示需要澄清
  else if (confidence < 0.5) {
    emit({
      action: 'warn',
      message: `意图识别置信度较低 (${confidence.toFixed(2)})，可能需要更多信息`,
    })
  }
}

/** 关键词检测降级方案 */
function fallbackKeywordDetection(message: string): void {
  const PATENT_KEYWORDS = [
    '专利',
    '权利要求',
    '审查意见',
    '检索',
    '撰写',
    '技术交底书',
    '新颖性',
    '创造性',
    'OA',
    '审查员',
  ]

  const hasPatentKeyword = PATENT_KEYWORDS.some((kw) => message.includes(kw))

  if (hasPatentKeyword) {
    emit({
      action: 'set_mode',
      mode: 'plan',
      reason: '关键词检测到专利任务意图（LLM 不可用）',
    })

    emit({
      action: 'prepend_context',
      content: '[专利模式-降级] 已激活专利工具集（基于关键词检测）',
    })
  }
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin()
    if (!raw.trim()) {
      log('stdin 为空，跳过')
      return
    }

    let input: Record<string, unknown>
    try {
      input = JSON.parse(raw)
    } catch {
      log('无法解析 stdin JSON，跳过')
      return
    }

    const event = String(input.event ?? '')
    const message = String(input.message ?? '')
    const mode = String(input.mode ?? '')
    const sessionId = String(input.session_id ?? 'hook-session')

    log(`event=${event} mode=${mode} message长度=${message.length}`)

    // 仅处理 message_submit 事件
    if (event !== 'message_submit') {
      log(`忽略非 message_submit 事件: ${event}`)
      return
    }

    // 有 API Key 时使用 LLM 识别器
    if (hasLLMApiKey()) {
      log('使用 LLM IntentRecognizer')

      try {
        const llmClient = new LLMClient({
          provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
          model: process.env.ANTHROPIC_API_KEY ? 'claude-3-5-sonnet-20241022' : 'deepseek-chat',
          apiKey: process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY,
        })

        const recognizer = new IntentRecognizer(llmClient, 0.7)

        const orchestratorInput: OrchestratorInput = {
          sessionId,
          userId: 'hook-user',
          message,
        }

        const intentResult = await recognizer.recognize(orchestratorInput)

        log(
          `识别结果: intent=${intentResult.intent} confidence=${intentResult.confidence.toFixed(2)} complexity=${intentResult.complexity}`
        )

        emitInstructionsForIntent(intentResult)
      } catch (err) {
        log(`LLM 识别失败，降级为关键词检测: ${err instanceof Error ? err.message : String(err)}`)
        fallbackKeywordDetection(message)
      }
    } else {
      log('无 LLM API Key，使用关键词检测')
      fallbackKeywordDetection(message)
    }
  } catch (err) {
    log(`异常退出: ${err instanceof Error ? err.message : String(err)}`)
  }
}

main()
