import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // 默认包含集成测试（使用真实 LLM）
    // 通过环境变量 MOCK_TESTS=true 切换回 Mock 模式
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.bench.test.ts',
      '**/*.perf.test.ts',
      '**/performance/**',
    ],
    // 真实 LLM API 需要更长超时 - 优化后增加到 3 分钟
    testTimeout: 180000,
    hookTimeout: 60000,
    // 并发控制 - 降低为 1 以避免 API 速率限制
    maxConcurrency: 1,
    fileParallelism: true,
    // 禁用 source map 以避免 esbuild 构建产物的 sourcemap 引用问题
    deps: {
      interopDefault: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.bench.test.ts',
        '**/*.perf.test.ts',
        '**/performance/**',
        '**/types.ts',
        '**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    // 设置测试环境变量（注释掉，路径问题待修复）
    // setupFiles: ['./test/integration/helpers/test-env-setup.ts'],
  },
})
