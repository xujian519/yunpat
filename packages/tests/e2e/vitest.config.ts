/**
 * E2E 测试 Vitest 配置
 *
 * - 使用 MOCK_TESTS=true 模式
 * - 扩展超时时间（60秒）
 * - 仅包含 tests/e2e 目录
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // E2E 工作流测试需要更长超时
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // 串行执行 E2E 测试，避免状态污染
    fileParallelism: false,
    // 禁用 source map 相关问题
    deps: {
      interopDefault: true,
    },
  },
  resolve: {
    alias: {
      // 确保可以正确解析 monorepo 子包
      '@yunpat/core': new URL('../../packages/core/src', import.meta.url).pathname,
      '@yunpat/agent-invention': new URL('../../packages/agents/invention/src', import.meta.url)
        .pathname,
      '@yunpat/agent-prior-art-search': new URL(
        '../../packages/agents/prior-art-search/src',
        import.meta.url
      ).pathname,
      '@yunpat/agent-specification-drafter': new URL(
        '../../packages/agents/specification-drafter/src',
        import.meta.url
      ).pathname,
      '@yunpat/agent-claim-generator': new URL(
        '../../packages/agents/claim-generator/src',
        import.meta.url
      ).pathname,
      '@yunpat/agent-abstract-drafter': new URL(
        '../../packages/agents/abstract-drafter/src',
        import.meta.url
      ).pathname,
      '@yunpat/agent-quality': new URL('../../packages/agents/quality/src', import.meta.url)
        .pathname,
      '@yunpat/agent-analysis': new URL('../../packages/agents/analysis/src', import.meta.url)
        .pathname,
      '@yunpat/agent-patent-responder': new URL(
        '../../packages/agents/patent-responder/src',
        import.meta.url
      ).pathname,
    },
  },
})
