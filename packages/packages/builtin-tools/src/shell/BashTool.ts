import { z } from 'zod'
import { spawn, type ChildProcess } from 'child_process'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_CHARS = 30_000

const SANDBOXED_COMMANDS: ReadonlySet<string> = new Set([
  'rm',
  'rmdir',
  'del',
  'format',
  'mkfs',
  'dd',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
])

const SANDBOXED_PREFIXES: ReadonlyArray<string> = ['sudo ', 'sh -c ', 'bash -c ']

export interface BashToolResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  command: string
  durationMs: number
  backgrounded?: boolean
  backgroundTaskId?: string
}

interface BackgroundTask {
  id: string
  process: ChildProcess
  command: string
  startTime: number
  stdout: string
  stderr: string
}

const backgroundTasks = new Map<string, BackgroundTask>()

export class BashTool extends EnhancedBaseTool<
  {
    command: string
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    maxOutput?: number
    autoBackground?: boolean
  },
  BashToolResult
> {
  readonly metadata = {
    name: 'bash',
    description:
      '执行 Shell 命令。支持超时控制、自动后台化、输出截断。长时间运行的命令会自动转为后台任务。',
    category: ToolCategory.CODE,
    isConcurrencySafe: false,
    maxResultSizeChars: 50_000,
    inputSchema: z.object({
      command: z.string().describe('要执行的 shell 命令'),
      cwd: z.string().optional().describe('工作目录（默认当前目录）'),
      env: z.record(z.string()).optional().describe('额外的环境变量'),
      timeout: z
        .number()
        .optional()
        .default(DEFAULT_TIMEOUT_MS)
        .describe(`超时时间（毫秒），默认 ${DEFAULT_TIMEOUT_MS}`),
      maxOutput: z
        .number()
        .optional()
        .default(MAX_OUTPUT_CHARS)
        .describe(`最大输出字符数，默认 ${MAX_OUTPUT_CHARS}`),
      autoBackground: z.boolean().optional().default(true).describe('超过阈值时自动转为后台任务'),
    }),
    outputSchema: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable(),
      timedOut: z.boolean(),
      command: z.string(),
      durationMs: z.number(),
      backgrounded: z.boolean().optional(),
      backgroundTaskId: z.string().optional(),
    }),
    permissions: ['shell:execute'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  isDestructive(input: { command: string }): boolean {
    const trimmed = input.command.trim()
    for (const prefix of SANDBOXED_PREFIXES) {
      if (trimmed.startsWith(prefix)) {
        const subCmd = trimmed.slice(prefix.length).trim().split(/\s+/)[0]
        if (SANDBOXED_COMMANDS.has(subCmd)) return true
      }
    }
    const cmd = trimmed.split(/\s+/)[0]
    return SANDBOXED_COMMANDS.has(cmd)
  }

  async execute(
    input: {
      command: string
      cwd?: string
      env?: Record<string, string>
      timeout?: number
      maxOutput?: number
      autoBackground?: boolean
    },
    _context: ToolContext
  ): Promise<BashToolResult> {
    const {
      command,
      cwd,
      env,
      timeout = DEFAULT_TIMEOUT_MS,
      maxOutput = MAX_OUTPUT_CHARS,
      autoBackground = true,
    } = input

    const startTime = Date.now()

    return new Promise<BashToolResult>((resolve) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command]

      const childEnv = { ...process.env, ...env }

      const child = spawn(shell, shellArgs, {
        cwd,
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false
      let settled = false

      const timeoutId = setTimeout(() => {
        if (settled) return

        if (autoBackground) {
          settled = true
          const taskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          backgroundTasks.set(taskId, {
            id: taskId,
            process: child,
            command,
            startTime,
            stdout,
            stderr,
          })

          child.stdout?.off('data', onStdout)
          child.stderr?.off('data', onStderr)
          child.off('close', onClose)
          child.off('error', onError)

          child.stdout?.on('data', (chunk: Buffer) => {
            const task = backgroundTasks.get(taskId)
            if (task) task.stdout += chunk.toString()
          })
          child.stderr?.on('data', (chunk: Buffer) => {
            const task = backgroundTasks.get(taskId)
            if (task) task.stderr += chunk.toString()
          })

          child.on('close', () => {
            backgroundTasks.delete(taskId)
          })

          resolve({
            stdout: truncateOutput(stdout, maxOutput),
            stderr: truncateOutput(stderr, maxOutput),
            exitCode: null,
            timedOut: true,
            command,
            durationMs: Date.now() - startTime,
            backgrounded: true,
            backgroundTaskId: taskId,
          })
        } else {
          settled = true
          timedOut = true
          child.kill('SIGTERM')

          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL')
            }
          }, 5000)
        }
      }, timeout)

      const onStdout = (data: Buffer) => {
        stdout += data.toString()
        if (stdout.length > maxOutput * 2) {
          stdout = truncateOutput(stdout, maxOutput)
        }
      }

      const onStderr = (data: Buffer) => {
        stderr += data.toString()
        if (stderr.length > maxOutput * 2) {
          stderr = truncateOutput(stderr, maxOutput)
        }
      }

      const onClose = (code: number | null) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)

        resolve({
          stdout: truncateOutput(stdout, maxOutput),
          stderr: truncateOutput(stderr, maxOutput),
          exitCode: code,
          timedOut,
          command,
          durationMs: Date.now() - startTime,
        })
      }

      const onError = (err: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)

        resolve({
          stdout: truncateOutput(stdout, maxOutput),
          stderr: err.message,
          exitCode: 1,
          timedOut: false,
          command,
          durationMs: Date.now() - startTime,
        })
      }

      child.stdout.on('data', onStdout)
      child.stderr.on('data', onStderr)
      child.on('close', onClose)
      child.on('error', onError)

      child.stdin?.end()
    })
  }
}

function truncateOutput(output: string, maxChars: number): string {
  if (output.length <= maxChars) return output

  const half = Math.floor(maxChars / 2) - 100
  return (
    output.substring(0, half) +
    `\n\n... [truncated ${output.length - maxChars} chars] ...\n\n` +
    output.substring(output.length - half)
  )
}

export function getBackgroundTask(taskId: string): BackgroundTask | undefined {
  return backgroundTasks.get(taskId)
}

export function listBackgroundTasks(): Array<{
  id: string
  command: string
  runningTimeMs: number
}> {
  return Array.from(backgroundTasks.values()).map((t) => ({
    id: t.id,
    command: t.command,
    runningTimeMs: Date.now() - t.startTime,
  }))
}

export function stopBackgroundTask(taskId: string): boolean {
  const task = backgroundTasks.get(taskId)
  if (!task) return false

  task.process.kill('SIGTERM')

  task.process.on('close', () => {
    backgroundTasks.delete(taskId)
  })

  setTimeout(() => {
    if (backgroundTasks.has(taskId) && !task.process.killed) {
      task.process.kill('SIGKILL')
      backgroundTasks.delete(taskId)
    }
  }, 5000)

  return true
}

export function getBackgroundTaskOutput(
  taskId: string,
  maxChars: number = MAX_OUTPUT_CHARS
): { stdout: string; stderr: string } | undefined {
  const task = backgroundTasks.get(taskId)
  if (!task) return undefined

  return {
    stdout: truncateOutput(task.stdout, maxChars),
    stderr: truncateOutput(task.stderr, maxChars),
  }
}
