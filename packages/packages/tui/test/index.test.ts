import { describe, it, expect } from 'vitest'

describe('@yunpat/tui', () => {
  it('should export TUI modules', async () => {
    const mod = await import('../src/index.js')
    expect(mod).toBeDefined()
  })
})
