/**
 * E2E 测试 Vitest 配置
 *
 * - 使用 MOCK_TESTS=true 模式
 * - 扩展超时时间（60秒）
 * - 包含所有 E2E 测试目录
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // E2E 工作流测试需要更长超时
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // 串行执行 E2E 测试，避免状态污染
    fileParallelism: false,
    deps: {
      interopDefault: true,
    },
  },
  resolve: {
    alias: [
      // 子路径导出必须放在父路径之前（vite 按顺序匹配）
      {
        find: '@yunpat/core/tokenization',
        replacement: new URL('../../packages/core/src/llm/tokenization', import.meta.url).pathname,
      },
      // 基础设施包
      {
        find: '@yunpat/core',
        replacement: new URL('../../packages/core/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/orchestrator',
        replacement: new URL('../../packages/orchestrator/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/orchestrator-adapter',
        replacement: new URL('../../packages/orchestrator-adapter/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/mcp-server',
        replacement: new URL('../../packages/mcp-server/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/document-tools',
        replacement: new URL('../../packages/document-tools/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/patent-tools',
        replacement: new URL('../../packages/patent-tools/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/unified-knowledge-graph',
        replacement: new URL('../../packages/unified-knowledge-graph/src', import.meta.url)
          .pathname,
      },
      {
        find: '@yunpat/patent-database',
        replacement: new URL('../../packages/patent-database/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/skills',
        replacement: new URL('../../packages/skills/src', import.meta.url).pathname,
      },
      // Agent 包
      {
        find: '@yunpat/agent-invention',
        replacement: new URL('../../packages/agents/invention/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/agent-prior-art-search',
        replacement: new URL('../../packages/agents/prior-art-search/src', import.meta.url)
          .pathname,
      },
      {
        find: '@yunpat/agent-specification-drafter',
        replacement: new URL('../../packages/agents/specification-drafter/src', import.meta.url)
          .pathname,
      },
      {
        find: '@yunpat/agent-claim-generator',
        replacement: new URL('../../packages/agents/claim-generator/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/agent-abstract-drafter',
        replacement: new URL('../../packages/agents/abstract-drafter/src', import.meta.url)
          .pathname,
      },
      {
        find: '@yunpat/agent-quality',
        replacement: new URL('../../packages/agents/quality/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/agent-analysis',
        replacement: new URL('../../packages/agents/analysis/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/agent-patent-responder',
        replacement: new URL('../../packages/agents/patent-responder/src', import.meta.url)
          .pathname,
      },
      {
        find: '@yunpat/agent-patent-analyzer',
        replacement: new URL('../../packages/agents/patent-analyzer/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/agent-search',
        replacement: new URL('../../packages/agents/search/src', import.meta.url).pathname,
      },
      {
        find: '@yunpat/agent-base',
        replacement: new URL('../../packages/agents/base/src', import.meta.url).pathname,
      },
    ],
  },
})
