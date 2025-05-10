/**
 * 工具执行引擎（Tool Execution Engine）
 *
 * Phase 2.2 核心组件：
 * - 单工具执行（含中断、超时、权限检查）
 * - 批量并发执行（自动区分只读/写工具）
 * - Token Budget 感知的结果压缩/持久化
 * - 统一的错误处理（ToolExecutionError）
 *
 * 借鉴 Claude Code 的并发管道设计：
 * - partition → concurrent pool → serial fallback
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  EnhancedTool,
  ToolContext,
  ToolExecutionContext,
  InterruptBehavior,
  ToolValidationResult,
  PermissionResult,
} from './types.js'
import { MiddlewarePipeline } from './middleware.js'
import { ToolExecutionError, PermissionDeniedError } from '../errors/AgentErrors.js'
import { TokenBudgetManager } from '../token/token-budget.js'
import { estimateTextTokens } from '../token/token-estimator.js'

/**
 * 执行引擎配置
 */
export interface ToolExecutionEngineConfig {
  /** 中间件管道（可选，默认空管道） */
  middleware?: MiddlewarePipeline

  /** Token 预算管理器（可选） */
  tokenBudgetManager?: TokenBudgetManager

  /** 默认超时（毫秒，默认 30000） */
  defaultTimeout?: number

  /** 结果压缩阈值（token 数，默认 4000） */
  compactThreshold?: number

  /** 是否启用自动压缩 */
  enableAutoCompact?: boolean
}

/**
 * 执行选项
 */
export interface ExecuteOptions {
  /** 中断信号 */
  signal?: AbortSignal

  /** 超时（毫秒，覆盖默认配置） */
  timeout?: number

  /** 是否跳过权限检查 */
  skipPermissionCheck?: boolean

  /** 是否跳过结果压缩 */
  skipCompact?: boolean
}

/**
 * 批量执行选项
 */
export interface BatchExecuteOptions extends ExecuteOptions {
  /** 最大并发数（默认 Infinity） */
  maxConcurrency?: number
}

/**
 * 工具执行引擎
 */
export class ToolExecutionEngine {
  private readonly middleware: MiddlewarePipeline
  private readonly tokenBudgetManager?: TokenBudgetManager
  private readonly defaultTimeout: number
  private readonly compactThreshold: number
  private readonly enableAutoCompact: boolean

  constructor(config: ToolExecutionEngineConfig = {}) {
    this.middleware = config.middleware ?? new MiddlewarePipeline()
    this.tokenBudgetManager = config.tokenBudgetManager
    this.defaultTimeout = config.defaultTimeout ?? 30000
    this.compactThreshold = config.compactThreshold ?? 4000
    this.enableAutoCompact = config.enableAutoCompact ?? true
  }

  /**
   * 执行单个工具
   *
   * 完整执行流程：
   * 1. Zod Schema 验证
   * 2. 语义校验（validateInput）
   * 3. 权限检查（checkPermissions）
   * 4. 中间件前置处理
   * 5. 工具执行
   * 6. 中间件后置处理
   * 7. 结果压缩/持久化（如需要）
   */
  async execute<TInput, TOutput>(
    tool: EnhancedTool<TInput, TOutput>,
    input: unknown,
    context: ToolContext,
    options: ExecuteOptions = {}
  ): Promise<TOutput> {
    const startTime = Date.now()
    const toolName = tool.metadata.name

    // 检查中断信号（前置）
    if (options.signal?.aborted) {
      throw new ToolExecutionError(
        `Tool '${toolName}' execution was aborted`,
        toolName,
        input,
        'INTERRUPTED',
        false
      )
    }

    try {
      // 1. Zod Schema 验证
      const validatedInput = await this.validateSchema(tool, input)

      // 2. 语义校验
      if (tool.validateInput) {
        const validationResult = await tool.validateInput(validatedInput)
        if (!validationResult.result) {
          throw new ToolExecutionError(
            `Tool '${toolName}' input validation failed: ${validationResult.message}`,
            toolName,
            validatedInput,
            'VALIDATION_FAILED',
            false
          )
        }
      }

      // 3. 权限检查
      if (!options.skipPermissionCheck && tool.checkPermissions) {
        const permResult = await tool.checkPermissions(validatedInput, context)
        if (!permResult.allowed) {
          throw new PermissionDeniedError(
            `Permission denied for tool '${toolName}': ${permResult.reason}`,
            toolName,
            validatedInput,
            permResult.requiredPermissions ?? [],
            permResult.reason ?? 'No reason provided'
          )
        }
      }

      // 4-6. 中间件 + 工具执行
      const executionContext: ToolExecutionContext = {
        tool: tool as EnhancedTool,
        input: validatedInput,
        context,
        startTime,
      }

      const rawResult = (await this.middleware.execute(executionContext)) as TOutput

      // 工具执行后再次检查中断信号
      if (options.signal?.aborted) {
        throw new ToolExecutionError(
          `Tool '${toolName}' execution was aborted`,
          toolName,
          input,
          'INTERRUPTED',
          false
        )
      }

      // 7. 结果压缩/持久化
      if (!options.skipCompact && this.enableAutoCompact) {
        return await this.maybeCompactOrPersist(tool, rawResult)
      }

      return rawResult
    } catch (error) {
      // 统一包装为 ToolExecutionError
      if (error instanceof ToolExecutionError || error instanceof PermissionDeniedError) {
        throw error
      }

      const originalError = error instanceof Error ? error : new Error(String(error))
      throw new ToolExecutionError(
        `Tool '${toolName}' execution failed: ${originalError.message}`,
        toolName,
        input,
        'EXECUTION_FAILED',
        this.isRetryableError(originalError),
        originalError
      )
    }
  }

  /**
   * 执行工具（支持中断和超时）
   *
   * 使用 AbortController 实现中断，支持工具自定义 cleanup。
   */
  async executeWithInterrupt<TInput, TOutput>(
    tool: EnhancedTool<TInput, TOutput>,
    input: unknown,
    context: ToolContext,
    interruptBehavior?: InterruptBehavior
  ): Promise<TOutput> {
    const behavior = interruptBehavior ?? tool.interruptBehavior
    const timeout = behavior?.timeout ?? this.defaultTimeout

    // 创建 AbortController（如果外部未提供 signal）
    const controller = new AbortController()
    const signal = behavior?.signal ?? controller.signal

    // 设置超时定时器
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let timedOut = false
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true
        controller.abort(new Error(`Tool '${tool.metadata.name}' timed out after ${timeout}ms`))
      }, timeout)
    }

    // 如果外部提供了 signal，当外部 abort 时也 abort 内部 controller
    let externalAbortHandler: (() => void) | undefined
    if (behavior?.signal && !behavior.signal.aborted) {
      externalAbortHandler = () => {
        controller.abort(behavior.signal!.reason)
      }
      behavior.signal.addEventListener('abort', externalAbortHandler, { once: true })
    }

    try {
      // 使用内部 controller.signal 执行工具
      const result = await this.execute(tool, input, context, { signal: controller.signal })
      return result
    } catch (error) {
      // 处理中断/超时错误
      if (controller.signal.aborted) {
        // 执行 cleanup
        if (behavior?.cleanup) {
          try {
            await behavior.cleanup()
          } catch (cleanupError) {
            console.warn(
              `[ToolExecutionEngine] Cleanup failed for '${tool.metadata.name}':`,
              cleanupError
            )
          }
        }

        const isTimeout = timedOut
        throw new ToolExecutionError(
          isTimeout
            ? `Tool '${tool.metadata.name}' timed out after ${timeout}ms`
            : `Tool '${tool.metadata.name}' was interrupted`,
          tool.metadata.name,
          input,
          isTimeout ? 'TIMEOUT' : 'INTERRUPTED',
          behavior?.retryable ?? false
        )
      }

      throw error
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      // 清理外部 signal 监听器（防止泄漏）
      if (externalAbortHandler && behavior?.signal) {
        behavior.signal.removeEventListener('abort', externalAbortHandler)
      }
    }
  }

  /**
   * 批量执行工具（智能并发）
   *
   * 自动分区：
   * - 并发安全工具 → 并行执行（上限 maxConcurrency）
   * - 非并发安全工具 → 串行执行
   *
   * 支持全局中断信号。
   */
  async executeBatch<TInput, TOutput>(
    calls: Array<{ tool: EnhancedTool<TInput, TOutput>; input: unknown }>,
    context: ToolContext,
    options: BatchExecuteOptions = {}
  ): Promise<TOutput[]> {
    if (calls.length === 0) {
      return []
    }

    const maxConcurrency = options.maxConcurrency ?? Infinity
    const { signal, skipPermissionCheck, skipCompact } = options

    // 分区：并发安全 vs 非并发安全
    const concurrentCalls: Array<{
      tool: EnhancedTool<TInput, TOutput>
      input: unknown
      index: number
    }> = []
    const serialCalls: Array<{
      tool: EnhancedTool<TInput, TOutput>
      input: unknown
      index: number
    }> = []

    for (let i = 0; i < calls.length; i++) {
      const { tool, input } = calls[i]
      const isSafe = tool.isConcurrencySafe
        ? tool.isConcurrencySafe(input as TInput)
        : (tool.metadata.isConcurrencySafe ?? false)

      if (isSafe) {
        concurrentCalls.push({ tool, input, index: i })
      } else {
        serialCalls.push({ tool, input, index: i })
      }
    }

    // 执行并发调用（带并发上限）
    const concurrentResults: Array<{ index: number; result: TOutput }> = []
    if (concurrentCalls.length > 0) {
      if (maxConcurrency >= concurrentCalls.length) {
        // 全部并行
        const promises = concurrentCalls.map(async (call) => {
          if (signal?.aborted) {
            throw new ToolExecutionError(
              `Batch execution interrupted`,
              call.tool.metadata.name,
              call.input,
              'INTERRUPTED',
              false
            )
          }
          const result = await this.execute(call.tool, call.input, context, {
            signal,
            skipPermissionCheck,
            skipCompact,
          })
          return { index: call.index, result }
        })
        const results = await Promise.all(promises)
        concurrentResults.push(...results)
      } else {
        // 分批并行（带并发上限）
        for (let i = 0; i < concurrentCalls.length; i += maxConcurrency) {
          if (signal?.aborted) {
            throw new ToolExecutionError(
              `Batch execution interrupted`,
              '',
              null,
              'INTERRUPTED',
              false
            )
          }
          const batch = concurrentCalls.slice(i, i + maxConcurrency)
          const promises = batch.map(async (call) => {
            const result = await this.execute(call.tool, call.input, context, {
              signal,
              skipPermissionCheck,
              skipCompact,
            })
            return { index: call.index, result }
          })
          const results = await Promise.all(promises)
          concurrentResults.push(...results)
        }
      }
    }

    // 执行串行调用
    const serialResults: Array<{ index: number; result: TOutput }> = []
    for (const call of serialCalls) {
      // 检查中断信号
      if (signal?.aborted) {
        throw new ToolExecutionError(
          `Batch execution interrupted`,
          call.tool.metadata.name,
          call.input,
          'INTERRUPTED',
          false
        )
      }

      const result = await this.execute(call.tool, call.input, context, {
        signal,
        skipPermissionCheck,
        skipCompact,
      })
      serialResults.push({ index: call.index, result })
    }

    // 合并结果（保持原始顺序）
    const allResults = [...concurrentResults, ...serialResults]
    allResults.sort((a, b) => a.index - b.index)

    return allResults.map((r) => r.result)
  }

  /**
   * Zod Schema 验证
   */
  private async validateSchema<TInput>(
    tool: EnhancedTool<TInput>,
    input: unknown
  ): Promise<TInput> {
    try {
      // 使用同步 parse，避免 vitest ESM 环境下 parseAsync 的 instanceof 问题
      return tool.metadata.inputSchema.parse(input)
    } catch (error) {
      // 使用 duck typing 检测 ZodError，避免 instanceof 跨模块问题
      if (
        error &&
        typeof error === 'object' &&
        'issues' in error &&
        Array.isArray((error as any).issues)
      ) {
        const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> }
        const issues = zodError.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
        throw new Error(
          `Invalid input for tool '${tool.metadata.name}':\n` +
            issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')
        )
      }
      throw error
    }
  }

  /**
   * 结果压缩或持久化
   *
   * 策略优先级：
   * 1. 如果配置了 maxResultSizeChars → 持久化到磁盘
   * 2. 如果结果 token 数超过 compactThreshold → 压缩摘要
   * 3. 否则返回原始结果
   */
  private async maybeCompactOrPersist<TOutput>(
    tool: EnhancedTool,
    result: TOutput
  ): Promise<TOutput> {
    const maxSize = tool.metadata.maxResultSizeChars
    let serialized: string

    try {
      serialized = typeof result === 'string' ? result : JSON.stringify(result)
    } catch {
      return result
    }

    // 策略 1：持久化到磁盘（如果配置了 maxResultSizeChars）
    if (maxSize !== undefined && maxSize !== Infinity && serialized.length > maxSize) {
      return (await this.persistToDisk(tool, result, serialized)) as TOutput
    }

    // 策略 2：Token Budget 感知压缩
    if (this.enableAutoCompact && this.tokenBudgetManager) {
      const estimatedTokens = estimateTextTokens(serialized)
      if (estimatedTokens > this.compactThreshold) {
        return this.compactResult(tool, result, serialized, estimatedTokens) as TOutput
      }
    }

    return result
  }

  /**
   * 将超大结果持久化到磁盘
   */
  private async persistToDisk<TOutput>(
    tool: EnhancedTool,
    _result: TOutput,
    serialized: string
  ): Promise<{ _persisted: boolean; filePath: string; size: number; summary: string }> {
    const tmpDir = path.join(os.tmpdir(), 'yunpat-tool-results')
    const filePath = path.join(tmpDir, `${tool.metadata.name}-${Date.now()}.json`)

    try {
      await fs.mkdir(tmpDir, { recursive: true })
      await fs.writeFile(filePath, serialized, 'utf-8')

      const summary = `[结果过大 (${serialized.length} 字符)，已持久化到磁盘]`
      console.log(`[ToolExecutionEngine] 工具 '${tool.metadata.name}' 结果已持久化: ${filePath}`)

      return {
        _persisted: true,
        filePath,
        size: serialized.length,
        summary,
      }
    } catch (error) {
      console.error(`[ToolExecutionEngine] 持久化失败 '${tool.metadata.name}':`, error)
      // 持久化失败时返回带摘要的包装结果
      return {
        _persisted: false,
        filePath: '',
        size: serialized.length,
        summary: `[结果过大 (${serialized.length} 字符)，持久化失败: ${error instanceof Error ? error.message : String(error)}]`,
      }
    }
  }

  /**
   * 压缩结果（Token Budget 感知）
   */
  private compactResult<TOutput>(
    tool: EnhancedTool,
    originalResult: TOutput,
    serialized: string,
    originalTokens: number
  ): { _compacted: true; originalTokens: number; summary: string; preview: string } {
    // 保留前 30% 和后 10%，中间用摘要替代
    const previewLength = Math.floor(serialized.length * 0.3)
    const tailLength = Math.floor(serialized.length * 0.1)
    const preview = serialized.substring(0, previewLength)
    const tail = serialized.substring(serialized.length - tailLength)

    const summary = `[结果因 Token 预算压缩：原始 ${originalTokens} tokens，保留 ${previewLength + tailLength} 字符]`

    console.log(
      `[ToolExecutionEngine] 工具 '${tool.metadata.name}' 结果已压缩: ${originalTokens} → ~${estimateTextTokens(preview + tail)} tokens`
    )

    return {
      _compacted: true,
      originalTokens,
      summary,
      preview: preview + '\n... [内容压缩] ...\n' + tail,
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'timeout',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'network',
      'rate limit',
      'too many requests',
      '503',
      '502',
      '504',
    ]
    const message = error.message.toLowerCase()
    return retryablePatterns.some((pattern) => message.includes(pattern))
  }
}

/**
 * 默认执行引擎实例
 */
export const defaultToolExecutionEngine = new ToolExecutionEngine()
