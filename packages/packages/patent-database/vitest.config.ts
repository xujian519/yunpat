import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000, // 30秒超时
    hookTimeout: 30000, // hooks 也需要更长的超时时间
  },
})
