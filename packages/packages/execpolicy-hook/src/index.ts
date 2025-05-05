/**
 * @file 执行策略 Hook - tool_call_before 生命周期
 * @description 在工具调用前执行参数级安全检查和审批门控
 *
 * 通信协议：stdin 读取 JSON，stdout 输出 JSONL，stderr 写日志。
 */

/**
 * 工具调用参数
 */
export interface ToolCallParams {
  toolName: string
  parameters: Record<string, unknown>
  sessionId: string
  userId?: string
  mode: 'yolo' | 'interactive' | 'strict'
}

/**
 * Hook 指令类型
 */
export interface HookInstruction {
  action: 'approve' | 'reject' | 'require_approval' | 'modify'
  reason?: string
  modifiedParams?: Record<string, unknown>
}

/**
 * 敏感操作配置（从 constitutional/rules 加载）
 */
interface SensitiveOperation {
  toolName: string
  dangerousParams: string[]
  requireApproval: boolean
  maxValues?: Record<string, number>
}

// 临时敏感操作配置（后续从 constitutional 加载）
export const SENSITIVE_OPERATIONS: SensitiveOperation[] = [
  {
    toolName: 'file_delete',
    dangerousParams: ['path'],
    requireApproval: true,
  },
  {
    toolName: 'file_write',
    dangerousParams: ['path'],
    requireApproval: false,
  },
  {
    toolName: 'patent_search',
    dangerousParams: [],
    requireApproval: false,
  },
]

/**
 * 检查工具调用是否安全
 */
export function checkToolCall(params: ToolCallParams): HookInstruction {
  const { toolName, parameters, mode } = params

  // 查找敏感操作配置
  const config = SENSITIVE_OPERATIONS.find((op) => op.toolName === toolName)

  if (!config) {
    // 未知工具，根据模式决定
    if (mode === 'yolo') {
      return { action: 'approve' }
    }
    return { action: 'require_approval', reason: `未知工具: ${toolName}` }
  }

  // 检查危险参数
  for (const param of config.dangerousParams) {
    const value = parameters[param]
    if (value !== undefined) {
      // 参数存在，检查是否需要审批
      if (config.requireApproval && mode !== 'yolo') {
        return {
          action: 'require_approval',
          reason: `工具 ${toolName} 包含敏感参数 ${param}，需要审批`,
        }
      }
    }
  }

  // 检查最大值限制
  if (config.maxValues) {
    for (const [param, maxValue] of Object.entries(config.maxValues)) {
      const value = parameters[param]
      if (typeof value === 'number' && value > maxValue) {
        return {
          action: 'modify',
          reason: `参数 ${param} 超过最大值 ${maxValue}，自动调整为 ${maxValue}`,
          modifiedParams: { ...parameters, [param]: maxValue },
        }
      }
    }
  }

  return { action: 'approve' }
}

/**
 * 向 stderr 写日志
 */
function log(...args: unknown[]): void {
  process.stderr.write(`[execpolicy-hook] ${args.join(' ')}\n`)
}

/**
 * 从 stdin 读取全部内容
 */
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

/**
 * 向 stdout 写入单行 JSONL
 */
function emit(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

/**
 * 主函数
 */
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
    const toolName = String(input.tool_name ?? '')
    const parameters = (input.parameters ?? {}) as Record<string, unknown>
    const sessionId = String(input.session_id ?? '')
    const userId = input.user_id ? String(input.user_id) : undefined
    const mode = (input.mode ?? 'interactive') as 'yolo' | 'interactive' | 'strict'

    log(`event=${event} tool=${toolName} mode=${mode}`)

    // 仅处理 tool_call_before 事件
    if (event !== 'tool_call_before') {
      log(`忽略非 tool_call_before 事件: ${event}`)
      return
    }

    const checkParams: ToolCallParams = {
      toolName,
      parameters,
      sessionId,
      userId,
      mode,
    }

    const instruction = checkToolCall(checkParams)

    log(
      `检查结果: action=${instruction.action}${instruction.reason ? ` reason="${instruction.reason}"` : ''}`
    )

    // 输出指令
    emit({
      action: instruction.action,
      reason: instruction.reason,
      modified_params: instruction.modifiedParams,
    })
  } catch (err) {
    log(`异常退出: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}

// 仅在直接运行时执行（被 import 时不自动运行 stdin 读取）
if (
  process.argv[1]?.endsWith('execpolicy-hook/src/index.ts') ||
  process.argv[1]?.endsWith('execpolicy-hook/dist/index.js')
) {
  main()
}
