import { describe, it, expect } from 'vitest'

describe('@yunpat/patent-knowledge', () => {
  it('should export knowledge bridge and graph tools', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.ObsidianKnowledgeBridge).toBeTypeOf('function')
    expect(mod.KnowledgeGraphExporter).toBeTypeOf('function')
    expect(mod.KnowledgeGraphTools).toBeTypeOf('function')
    expect(mod.KnowledgeRAG).toBeTypeOf('function')
  })
})
