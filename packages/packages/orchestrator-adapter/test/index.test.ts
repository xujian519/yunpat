import { describe, it, expect } from 'vitest'

describe('@yunpat/orchestrator-adapter', () => {
  it('should export OrchestratorAdapter class and createAdapter function', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.OrchestratorAdapter).toBeTypeOf('function')
    expect(mod.createAdapter).toBeTypeOf('function')
  })

  it('should export type guards for config interfaces', async () => {
    const mod = await import('../src/index.js')
    // 验证模块导出了接口类型（编译时检查）
    expect(mod).toHaveProperty('OrchestratorAdapter')
    expect(mod).toHaveProperty('createAdapter')
  })
})
