import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@yunpat/agent-prior-art-search': '/Users/xujian/projects/YunPat/packages/agents/prior-art-search/src',
    },
  },
})
