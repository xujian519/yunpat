import { describe, it, expect } from 'vitest'

describe('@yunpat/agent-researcher', () => {
  it('should export ResearcherAgent', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.ResearcherAgent).toBeTypeOf('function')
  })
})
