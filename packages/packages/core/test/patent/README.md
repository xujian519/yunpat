# PatentCoreBridge 测试说明

**状态**: 已弃用

## 原因

原测试文件引用了 `patents/` 目录（已归档到 `_archive/patents/`）。

## 替代方案

PatentCoreBridge 的功能已迁移到 `@yunpat/patent-core` 包。

如需测试，请使用：

```typescript
import { PatentCoreBridge } from '@yunpat/patent-core'
```

## 归档信息

- 归档日期: 2026-05-05
- 归档位置: `_archive/patents/`
- 原始测试: PatentCoreFallback.test.ts (已重命名为 .disabled)
