/**
 * @file DeepSeek TUI 异常恢复 Hook（增强版）
 * @description 在工具执行失败时，根据错误类型输出 HookInstruction 格式的恢复策略。
 *
 * 通信协议：stdin 读取 JSON，stdout 输出 JSONL，stderr 写日志。
 *
 * v2.0 更新：
 * - 集成 @yunpat/orchestrator ExceptionHandler
 * - 输出 HookInstruction 格式（与 Rust HookInstruction 对齐）
 * - 支持 InjectMessage、Warn 等恢复策略
 */

import { ExceptionHandler } from '@yunpat/orchestrator'
import type { ExecutionContext } from '@yunpat/orchestrator'

/** 专利相关工具名称前缀/关键词 */
const PATENT_TOOL_NAMES = [
  'patent_search',
  'claims_generator',
  'quality_checker',
  'legal_knowledge_search',
  'invalid_decision_search',
  'patent_rule_search',
]

/** HookInstruction 格式（与 Rust HookInstruction 对齐） */
interface HookInstruction {
  action:
    | 'set_mode'
    | 'prepend_context'
    | 'inject_message'
    | 'load_skill'
    | 'suggest_tool'
    | 'require_approval'
    | 'warn'
    | 'allow'
  role?: string // inject_message 时使用
  content?: string // inject_message/warn 时使用
  mode?: string // set_mode 时使用
  reason?: string // set_mode/suggest_tool 时使用
  tool?: string // suggest_tool 时使用
  message?: string // require_approval/warn 时使用
  options?: string[] // require_approval 时使用
  skill?: string // load_skill 时使用
}

/** 从 stdin 读取全部内容 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

/** 向 stdout 写入单行 JSONL */
function emit(instruction: HookInstruction): void {
  process.stdout.write(JSON.stringify(instruction) + '\n')
}

/** 向 stderr 写日志 */
function log(...args: unknown[]): void {
  process.stderr.write(`[exception-hook] ${args.join(' ')}\n`)
}

/**
 * 构建执行上下文（用于 ExceptionHandler）
 */
function buildExecutionContext(
  errorType: string,
  errorMsg: string,
  toolName?: string,
  sessionId?: string
): ExecutionContext {
  return {
    sessionId: sessionId || 'default',
    message: errorMsg,
    metadata: {
      error_type: errorType,
      tool_name: toolName,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * 将 ExceptionHandler 的 RecoveryResult 转换为 HookInstruction
 */
function recoveryResultToInstruction(
  recoveryResult: Awaited<ReturnType<ExceptionHandler['handleException']>>,
  originalError: Error
): HookInstruction {
  // @yunpat/orchestrator ExceptionHandler 的 RecoveryResult 结构：
  // { success, strategy, recoveryMessage, errorMessage, fallbackActions }

  if (recoveryResult.strategy === 'retry' && recoveryResult.recoveryMessage) {
    // 重试策略：注入用户友好的重试提示
    return {
      action: 'inject_message',
      role: 'assistant',
      content: recoveryResult.recoveryMessage,
    }
  }

  if (recoveryResult.strategy === 'graceful_degradation' && recoveryResult.recoveryMessage) {
    // 优雅降级：注入降级回复
    return {
      action: 'inject_message',
      role: 'assistant',
      content: recoveryResult.recoveryMessage,
    }
  }

  if (recoveryResult.strategy === 'error_message' && recoveryResult.errorMessage) {
    // 错误消息：注入错误说明
    return {
      action: 'inject_message',
      role: 'assistant',
      content: recoveryResult.errorMessage,
    }
  }

  // 默认：注入通用错误提示
  return {
    action: 'warn',
    message: `工具执行失败: ${originalError.message}`,
  }
}

/**
 * 快速路径：简单错误的规则化处理（不调用 LLM）
 */
function quickRecoveryStrategy(
  errorType: string,
  errorMsg: string,
  toolName?: string
): HookInstruction | null {
  const lower = errorType.toLowerCase()
  const msgLower = errorMsg.toLowerCase()

  // 超时错误 → 建议重试
  if (lower.includes('timeout') || msgLower.includes('timeout') || msgLower.includes('timed out')) {
    return {
      action: 'inject_message',
      role: 'assistant',
      content: '工具执行超时，正在为您重试。如果问题持续，请尝试简化请求或稍后再试。',
    }
  }

  // MCP 连接错误 → 建议检查服务
  if (
    lower.includes('connection') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    msgLower.includes('mcp') ||
    msgLower.includes('connection refused')
  ) {
    return {
      action: 'warn',
      message: 'MCP 服务连接失败，请检查服务是否正常运行',
    }
  }

  // 工具未找到 → 建议检查工具名称
  if (
    lower.includes('not_found') ||
    lower.includes('not found') ||
    msgLower.includes('unknown tool')
  ) {
    return {
      action: 'inject_message',
      role: 'assistant',
      content: `工具 "${toolName || '未知'}" 不存在，请确认工具名称拼写正确。`,
    }
  }

  // 专利工具错误 → 降级到规则模式
  if (toolName && PATENT_TOOL_NAMES.some((t) => toolName.includes(t))) {
    return {
      action: 'warn',
      message: `专利工具 "${toolName}" 执行失败，已自动降级到规则模式继续处理`,
    }
  }

  return null // 无法快速恢复，走 ExceptionHandler
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
    const errorType = String(input.error_type ?? '')
    const errorMsg = String(input.error_msg ?? '')
    const toolName = input.tool_name ? String(input.tool_name) : undefined
    const sessionId = input.session_id ? String(input.session_id) : undefined

    log(
      `event=${event} error_type=${errorType} tool=${toolName ?? '-'} session=${sessionId ?? '-'}`
    )

    // 仅处理 on_error 事件
    if (event !== 'on_error') {
      log(`忽略非 on_error 事件: ${event}`)
      return
    }

    // 快速路径：尝试规则化恢复
    const quickInstruction = quickRecoveryStrategy(errorType, errorMsg, toolName)
    if (quickInstruction) {
      log('快速路径恢复策略:', quickInstruction.action)
      emit(quickInstruction)
      return
    }

    // 慢速路径：使用 ExceptionHandler（可能调用 LLM）
    try {
      const exceptionHandler = new ExceptionHandler()
      const executionContext = buildExecutionContext(errorType, errorMsg, toolName, sessionId)
      const error = new Error(errorMsg)

      const recoveryResult = await exceptionHandler.handleException(error, executionContext)
      const instruction = recoveryResultToInstruction(recoveryResult, error)

      log(`ExceptionHandler 恢复策略: action=${instruction.action}`)
      emit(instruction)
    } catch (handlerError) {
      // ExceptionHandler 也失败了，输出最简单的兜底指令
      log(
        `ExceptionHandler 失败: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`
      )
      emit({
        action: 'warn',
        message: '系统出现错误，请稍后重试',
      })
    }
  } catch (err) {
    log(`异常退出: ${err instanceof Error ? err.message : String(err)}`)
  }
}

main()
