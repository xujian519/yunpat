import { describe, it, expect } from 'vitest'
import { checkToolCall, SENSITIVE_OPERATIONS } from './index.js'
import type { ToolCallParams } from './index.js'

describe('execpolicy-hook checkToolCall', () => {
  const baseParams = (overrides: Partial<ToolCallParams> = {}): ToolCallParams => ({
    toolName: 'test_tool',
    parameters: {},
    sessionId: 'test-session',
    mode: 'interactive',
    ...overrides,
  })

  it('已知安全工具直接放行', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'patent_search',
        parameters: { query: '电池' },
      })
    )
    expect(result.action).toBe('approve')
  })

  it('敏感工具在非 yolo 模式下需要审批', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'file_delete',
        parameters: { path: '/tmp/test.txt' },
      })
    )
    expect(result.action).toBe('require_approval')
    expect(result.reason).toContain('敏感参数')
  })

  it('敏感工具在 yolo 模式下自动放行', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'file_delete',
        parameters: { path: '/tmp/test.txt' },
        mode: 'yolo',
      })
    )
    expect(result.action).toBe('approve')
  })

  it('未知工具在 interactive 模式下需要审批', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'unknown_tool',
      })
    )
    expect(result.action).toBe('require_approval')
    expect(result.reason).toContain('未知工具')
  })

  it('未知工具在 yolo 模式下放行', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'unknown_tool',
        mode: 'yolo',
      })
    )
    expect(result.action).toBe('approve')
  })

  it('file_write 不需要审批（requireApproval=false）', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'file_write',
        parameters: { path: '/tmp/out.txt', content: 'hello' },
      })
    )
    expect(result.action).toBe('approve')
  })

  it('strict 模式下敏感工具同样需要审批', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'file_delete',
        parameters: { path: '/important.dat' },
        mode: 'strict',
      })
    )
    expect(result.action).toBe('require_approval')
  })

  it('无危险参数时敏感工具放行', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'file_delete',
        parameters: {},
      })
    )
    expect(result.action).toBe('approve')
  })

  it('SENSITIVE_OPERATIONS 包含 file_delete', () => {
    expect(SENSITIVE_OPERATIONS.some((op) => op.toolName === 'file_delete')).toBe(true)
  })

  it('检查未定义参数时不崩溃', () => {
    const result = checkToolCall(
      baseParams({
        toolName: 'file_delete',
        parameters: { path: undefined as unknown as string },
      })
    )
    // undefined 参数不算危险参数存在
    expect(['approve', 'require_approval']).toContain(result.action)
  })
})
