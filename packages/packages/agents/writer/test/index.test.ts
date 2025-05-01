import { describe, it, expect } from 'vitest'

describe('@yunpat/agent-writer', () => {
  it('should export WriterAgent and factory functions', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.WriterAgent).toBeTypeOf('function')
    expect(mod.createWriterAgent).toBeTypeOf('function')
    expect(mod.createEnhancedWriterAgent).toBeTypeOf('function')
  })
})
