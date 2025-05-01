import { describe, it, expect } from 'vitest'

describe('@yunpat/patent-prompts', () => {
  it('should export PromptTemplateManager and prompt constants', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.PromptTemplateManager).toBeTypeOf('function')
    expect(mod.DRAFTING_CLAIMS_PROMPT).toBeDefined()
    expect(mod.renderDraftingClaimsPrompt).toBeTypeOf('function')
    expect(mod.renderDraftingSpecificationPrompt).toBeTypeOf('function')
  })
})
