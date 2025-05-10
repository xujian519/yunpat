/**
 * ToolExecutionEngine 测试
 *
 * 测试覆盖：
 * - 单工具执行（schema 验证、权限检查、中间件）
 * - 中断执行（超时、AbortSignal）
 * - 批量执行（并发分区、并发上限）
 * - 结果压缩/持久化
 * - 错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { ToolExecutionEngine } from '../../src/tools/ToolExecutionEngine.js'
import { EnhancedTool, ToolContext, ToolResultBlockParam } from '../../src/tools/types.js'
import { ToolExecutionError, PermissionDeniedError } from '../../src/errors/AgentErrors.js'
import { TokenBudgetManager } from '../../src/token/token-budget.js'

// ========== Mock 工具工厂 ==========

function createMockTool(overrides: Partial<EnhancedTool> = {}): EnhancedTool {
  return {
    metadata: {
      name: 'mock_tool',
      description: 'A mock tool for testing',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      category: undefined,
      isConcurrencySafe: true,
      ...overrides.metadata,
    },
    execute: vi.fn(async (input: { value: string }, _context: ToolContext) => ({
      result: `processed: ${input.value}`,
    })),
    ...overrides,
  } as EnhancedTool
}

function createMockContext(): ToolContext {
  return {
    registry: {} as any,
    llm: {} as any,
    memory: {} as any,
    eventBus: {} as any,
    userId: 'test-user',
    sessionId: 'test-session',
  }
}

// ========== 测试套件 ==========

describe('ToolExecutionEngine', () => {
  let engine: ToolExecutionEngine
  let context: ToolContext

  beforeEach(() => {
    engine = new ToolExecutionEngine()
    context = createMockContext()
  })

  describe('execute()', () => {
    it('应该成功执行工具并返回结果', async () => {
      const tool = createMockTool()
      const result = await engine.execute(tool, { value: 'hello' }, context)

      expect(result).toEqual({ result: 'processed: hello' })
      expect(tool.execute).toHaveBeenCalledWith({ value: 'hello' }, context)
    })

    it('应该拒绝无效的输入（Zod Schema 验证失败）', async () => {
      const tool = createMockTool()

      await expect(engine.execute(tool, { value: 123 }, context)).rejects.toThrow(/Invalid input/)
    })

    it('应该执行自定义 validateInput 并拒绝无效输入', async () => {
      const tool = createMockTool({
        validateInput: vi.fn(async () => ({
          result: false as const,
          message: 'Custom validation failed',
          errorCode: 400,
        })),
      })

      await expect(engine.execute(tool, { value: 'hello' }, context)).rejects.toThrow(
        ToolExecutionError
      )
    })

    it('应该执行权限检查并拒绝无权限的请求', async () => {
      const tool = createMockTool({
        checkPermissions: vi.fn(async () => ({
          allowed: false,
          reason: 'Insufficient permissions',
          requiredPermissions: ['admin'],
        })),
      })

      await expect(engine.execute(tool, { value: 'hello' }, context)).rejects.toThrow(
        PermissionDeniedError
      )
    })

    it('skipPermissionCheck 选项应该跳过权限检查', async () => {
      const tool = createMockTool({
        checkPermissions: vi.fn(async () => ({
          allowed: false,
          reason: 'Insufficient permissions',
          requiredPermissions: ['admin'],
        })),
      })

      const result = await engine.execute(tool, { value: 'hello' }, context, {
        skipPermissionCheck: true,
      })

      expect(result).toEqual({ result: 'processed: hello' })
    })

    it('应该包装执行错误为 ToolExecutionError', async () => {
      const tool = createMockTool({
        execute: vi.fn(async () => {
          throw new Error('Something went wrong')
        }),
      })

      await expect(engine.execute(tool, { value: 'hello' }, context)).rejects.toThrow(
        ToolExecutionError
      )
    })

    it('应该响应已 abort 的 signal', async () => {
      const tool = createMockTool()
      const controller = new AbortController()
      controller.abort()

      await expect(
        engine.execute(tool, { value: 'hello' }, context, { signal: controller.signal })
      ).rejects.toThrow(/aborted/)
    })
  })

  describe('executeWithInterrupt()', () => {
    it('应该正常完成并在超时前返回结果', async () => {
      const tool = createMockTool()
      const result = await engine.executeWithInterrupt(tool, { value: 'hello' }, context, {
        timeout: 5000,
        retryable: false,
      })

      expect(result).toEqual({ result: 'processed: hello' })
    })

    it('应该在超时时抛出 ToolExecutionError', async () => {
      const tool = createMockTool({
        execute: vi.fn(
          () => new Promise((resolve) => setTimeout(() => resolve({ result: 'done' }), 10000))
        ),
      })

      await expect(
        engine.executeWithInterrupt(tool, { value: 'hello' }, context, {
          timeout: 50,
          retryable: false,
        })
      ).rejects.toThrow(/timed out/)
    })

    it('应该在超时时执行 cleanup', async () => {
      const cleanup = vi.fn()
      const tool = createMockTool({
        execute: vi.fn(
          () => new Promise((resolve) => setTimeout(() => resolve({ result: 'done' }), 10000))
        ),
        interruptBehavior: {
          timeout: 50,
          retryable: false,
          cleanup,
        },
      })

      await expect(engine.executeWithInterrupt(tool, { value: 'hello' }, context)).rejects.toThrow()

      // cleanup 应该在超时后被调用
      await new Promise((r) => setTimeout(r, 100))
      expect(cleanup).toHaveBeenCalled()
    })
  })

  describe('executeBatch()', () => {
    it('应该并行执行并发安全工具', async () => {
      const tool1 = createMockTool({
        metadata: {
          name: 'tool1',
          description: 't1',
          inputSchema: z.object({}),
          isConcurrencySafe: true,
        },
        execute: vi.fn(async () => 'result1'),
      })
      const tool2 = createMockTool({
        metadata: {
          name: 'tool2',
          description: 't2',
          inputSchema: z.object({}),
          isConcurrencySafe: true,
        },
        execute: vi.fn(async () => 'result2'),
      })

      const results = await engine.executeBatch(
        [
          { tool: tool1, input: {} },
          { tool: tool2, input: {} },
        ],
        context
      )

      expect(results).toEqual(['result1', 'result2'])
    })

    it('应该串行执行非并发安全工具', async () => {
      const executionOrder: string[] = []

      const tool1 = createMockTool({
        metadata: {
          name: 'tool1',
          description: 't1',
          inputSchema: z.object({}),
          isConcurrencySafe: false,
        },
        execute: vi.fn(async () => {
          executionOrder.push('tool1')
          return 'result1'
        }),
      })
      const tool2 = createMockTool({
        metadata: {
          name: 'tool2',
          description: 't2',
          inputSchema: z.object({}),
          isConcurrencySafe: false,
        },
        execute: vi.fn(async () => {
          executionOrder.push('tool2')
          return 'result2'
        }),
      })

      const results = await engine.executeBatch(
        [
          { tool: tool1, input: {} },
          { tool: tool2, input: {} },
        ],
        context
      )

      expect(results).toEqual(['result1', 'result2'])
      expect(executionOrder).toEqual(['tool1', 'tool2'])
    })

    it('应该混合处理并发安全和非并发安全工具并保持顺序', async () => {
      const safeTool = createMockTool({
        metadata: {
          name: 'safe',
          description: 's',
          inputSchema: z.object({}),
          isConcurrencySafe: true,
        },
        execute: vi.fn(async () => 'safe-result'),
      })
      const unsafeTool = createMockTool({
        metadata: {
          name: 'unsafe',
          description: 'u',
          inputSchema: z.object({}),
          isConcurrencySafe: false,
        },
        execute: vi.fn(async () => 'unsafe-result'),
      })

      const results = await engine.executeBatch(
        [
          { tool: safeTool, input: {} },
          { tool: unsafeTool, input: {} },
          { tool: safeTool, input: {} },
        ],
        context
      )

      expect(results).toEqual(['safe-result', 'unsafe-result', 'safe-result'])
    })

    it('应该限制并发数', async () => {
      let concurrentCount = 0
      let maxConcurrent = 0

      const tool = createMockTool({
        metadata: {
          name: 'concurrent',
          description: 'c',
          inputSchema: z.object({}),
          isConcurrencySafe: true,
        },
        execute: vi.fn(async () => {
          concurrentCount++
          maxConcurrent = Math.max(maxConcurrent, concurrentCount)
          await new Promise((r) => setTimeout(r, 50))
          concurrentCount--
          return 'done'
        }),
      })

      await engine.executeBatch(
        Array.from({ length: 5 }, () => ({ tool, input: {} })),
        context,
        { maxConcurrency: 2 }
      )

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('空调用列表应返回空数组', async () => {
      const results = await engine.executeBatch([], context)
      expect(results).toEqual([])
    })

    it('应该响应批量执行中的 signal abort', async () => {
      const tool = createMockTool({
        metadata: {
          name: 'abortable',
          description: 'a',
          inputSchema: z.object({}),
          isConcurrencySafe: true,
        },
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 100))
          return 'done'
        }),
      })

      const controller = new AbortController()
      // 立即 abort
      controller.abort()

      await expect(
        engine.executeBatch([{ tool, input: {} }], context, { signal: controller.signal })
      ).rejects.toThrow(/interrupted/)
    })
  })

  describe('结果压缩与持久化', () => {
    it('应该压缩超大结果（token 预算感知）', async () => {
      const engineWithCompact = new ToolExecutionEngine({
        compactThreshold: 10,
        enableAutoCompact: true,
        tokenBudgetManager: new TokenBudgetManager(),
      })

      const tool = createMockTool({
        metadata: {
          name: 'big_result_tool_skip',
          description: 'br',
          inputSchema: z.object({}),
        },
        execute: vi.fn(async () => 'x'.repeat(5000)),
      })

      const result = await engineWithCompact.execute(tool, {}, context)

      expect(result).toHaveProperty('_compacted', true)
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('preview')
    })

    it('应该持久化超过 maxResultSizeChars 的结果', async () => {
      const engineWithPersist = new ToolExecutionEngine()

      const tool = createMockTool({
        metadata: {
          name: 'persist_tool',
          description: 'p',
          inputSchema: z.object({}),
          maxResultSizeChars: 10,
        },
        execute: vi.fn(async () => 'x'.repeat(100)),
      })

      const result = await engineWithPersist.execute(tool, {}, context)

      expect(result).toHaveProperty('_persisted')
      expect(result).toHaveProperty('filePath')
      expect(result).toHaveProperty('size')
    })

    it('skipCompact 选项应跳过自动压缩', async () => {
      const engineWithCompact = new ToolExecutionEngine({
        compactThreshold: 10,
        enableAutoCompact: true,
        tokenBudgetManager: new TokenBudgetManager(),
      })

      const tool = createMockTool({
        metadata: {
          name: 'big_result_tool',
          description: 'br',
          inputSchema: z.object({}),
        },
        execute: vi.fn(async () => 'x'.repeat(5000)),
      })

      const result = await engineWithCompact.execute(tool, {}, context, { skipCompact: true })

      expect(typeof result).toBe('string')
      expect(result).toBe('x'.repeat(5000))
    })
  })
})
