import { describe, it, expect } from 'vitest'

describe('@yunpat/unified-knowledge-graph', () => {
  it('should export PostgreSQL client and knowledge graph service', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.PostgreSQLClient).toBeTypeOf('function')
    expect(mod.PostgreSQLFirstKnowledgeGraph).toBeTypeOf('function')
    expect(mod.createKnowledgeGraph).toBeTypeOf('function')
  })

  it('should export adapters', async () => {
    const mod = await import('../src/index.js')
    expect(mod.YunPatAdapter).toBeTypeOf('function')
    expect(mod.OpenClawAdapter).toBeTypeOf('function')
  })
})
