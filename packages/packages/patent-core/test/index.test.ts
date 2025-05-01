import { describe, it, expect } from 'vitest'

describe('@yunpat/patent-core', () => {
  it('should export bridge functions', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
    expect(mod.extractFeatures).toBeTypeOf('function')
    expect(mod.parseDisclosure).toBeTypeOf('function')
    expect(mod.generateClaims).toBeTypeOf('function')
    expect(mod.parseOa).toBeTypeOf('function')
    expect(mod.recommendStrategy).toBeTypeOf('function')
    expect(mod.reviseClaims).toBeTypeOf('function')
    expect(mod.assessQuality).toBeTypeOf('function')
    expect(mod.classifyIpc).toBeTypeOf('function')
  })

  it('should export fallback functions', async () => {
    const mod = await import('../src/index.js')
    expect(mod.extractFeaturesFallback).toBeTypeOf('function')
    expect(mod.parseDisclosureFallback).toBeTypeOf('function')
    expect(mod.generateClaimsFallback).toBeTypeOf('function')
    expect(mod.isFallbackResult).toBeTypeOf('function')
  })
})
