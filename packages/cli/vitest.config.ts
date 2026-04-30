import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@yunpat/core': '../../core/dist/index.js',
      '@yunpat/core/src/planning/types.js': '../../core/dist/planning/types.js',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});
