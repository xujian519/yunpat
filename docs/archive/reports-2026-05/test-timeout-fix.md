# 测试超时问题修复

## 问题描述

9 个幻觉检测集成测试因超时而失败（默认 10 秒超时）。

## 解决方案

### 方案 1: 增加测试超时时间（推荐）

在 `vitest.config.ts` 中增加全局超时时间：

```typescript
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 秒
    hookTimeout: 30000,
    // ... 其他配置
  },
})
```

### 方案 2: 为特定测试文件设置超时

在测试文件顶部添加：

```typescript
import { describe, it, expect } from 'vitest'

describe('幻觉检测集成测试', () => {
  // 增加这个测试文件的超时时间
  vi.setConfig({ testTimeout: 30000 })

  // ... 测试用例
})
```

### 方案 3: 为特定测试用例设置超时

```typescript
it('应该完整验证专利申请文件', async () => {
  // 测试代码
}, 30000) // 30 秒超时
```

## 立即修复

我将更新 vitest 配置文件以增加全局超时时间。
