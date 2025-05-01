import { describe, it, expect } from 'vitest'

describe('Phase 3: 先导技术检索验收测试', () => {
  it('should export PriorArtSearchAgent', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.PriorArtSearchAgent).toBeTypeOf('function')
  })

  it('should export PriorArtSearchInput type', async () => {
    const mod = await import('../src/index.js')
    // Type exports are not runtime-checkable, but the module should load without error
    expect(mod).toBeDefined()
  })
})
