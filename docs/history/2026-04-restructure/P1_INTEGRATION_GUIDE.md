# P1 成本优化 - 集成指南

## 概述

P1 优化包含三个高级降本方案，预期累计节省 **65-75%** 成本。

---

## 1. SemanticCache（语义缓存）

### 功能
- 基于语义相似度的智能缓存
- 自动识别重复和相似任务
- 缓存命中时直接返回或轻量改写

### 使用方式

```typescript
import { SemanticCache, WriterAgent } from '@yunpat/core';

// 创建缓存实例
const cache = new SemanticCache({
  maxEntries: 1000,
  similarityThreshold: 0.85,
  ttl: 3600000, // 1小时
});

// 集成到 Agent
const agent = new WriterAgent({
  eventBus,
  memory,
  tools,
  llm,
  cache, // 注入缓存
});

// 自动缓存逻辑
const result = await agent.execute(task);
// 1. 查找缓存 → 命中则返回
// 2. 未命中 → 执行 → 存储到缓存
```

### 配置选项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxEntries | 1000 | 最大缓存条目数 |
| similarityThreshold | 0.85 | 相似度阈值（0-1） |
| ttl | 3600000 | 缓存过期时间（毫秒） |

### 预期效果

- 完全相同任务：节省 **90%+**
- 语义相似任务：节省 **50%+**
- 平均节省：**15-50%**

---

## 2. IncrementalGenerator（增量生成）

### 功能
- 智能差异分析
- 增量更新内容
- 支持扩展/压缩

### 使用方式

```typescript
import { IncrementalGenerator } from '@yunpat/core';

const generator = new IncrementalGenerator({ llm });

// 场景1: 扩展内容
const expanded = await generator.expand(
  originalContent,  // 100字
  200               // 扩展到200字
);
// 节省: 70% (只生成+100字)

// 场景2: 压缩内容
const compressed = await generator.compress(
  originalContent,  // 500字
  200               // 压缩到200字
);
// 节省: 50%

// 场景3: 修改特定部分
const diff = await generator.diff(
  originalContent,
  '将第三节的"历史"改为"原理"'
);
const updated = await generator.update(originalContent, diff);
// 节省: 60% (只修改第3节)
```

### 适用场景

| 场景 | 节省 | 频率 |
|------|------|------|
| 扩展内容 | 70% | 高 |
| 压缩内容 | 50% | 中 |
| 修改部分 | 60% | 高 |
| 格式转换 | 40% | 低 |

### 预期效果

- 平均节省：**30-70%**
- 高频场景效果显著

---

## 3. BatchProcessor（批处理优化）

### 功能
- 合并多个请求为单次调用
- 智能分批处理
- 批量响应解析

### 使用方式

```typescript
import { BatchProcessor } from '@yunpat/core';

const batch = new BatchProcessor({
  maxBatchSize: 5,     // 每批最多5个章节
  enableBatching: true, // 启用批处理
});

// 批量生成
const sections = ['引言', '概念', '实现', '应用', '总结'];
const results = await batch.batchGenerate(
  sections,
  plan,
  context
);
// 1次 API 调用 vs 5次（串行）
// 节省: 60%
```

### 配置选项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| maxBatchSize | 5 | 每批最多项目数 |
| enableBatching | true | 是否启用批处理 |
| batchSize | 5 | 批处理大小 |

### 对比

```
串行: 5次 × ¥0.002 = ¥0.010
批处理: 1次 × ¥0.004 = ¥0.004
节省: 60%
```

### 预期效果

- API 调用减少：**60-80%**
- 成本降低：**40-60%**

---

## 集成到 WriterAgent

### 完整集成示例

```typescript
import {
  WriterAgent,
  SemanticCache,
  IncrementalGenerator,
  BatchProcessor,
  createCostAwareAdapter,
} from '@yunpat/core';

// 1. 创建组件
const cache = new SemanticCache({ similarityThreshold: 0.85 });
const incremental = new IncrementalGenerator({ llm });
const batch = new BatchProcessor({ maxBatchSize: 5 });
const llm = createCostAwareAdapter(apiKey, omlxUrl);

// 2. 创建 Agent
const agent = new WriterAgent({
  eventBus,
  memory,
  tools,
  llm,
  cache,          // 语义缓存
  incremental,    // 增量生成
  batch,          // 批处理
});

// 3. 执行任务
const result = await agent.execute({
  type: 'generate',
  topic: 'TypeScript 入门教程',
  format: 'markdown',
});

// 自动优化流程:
// 1. 查找缓存 → 命中则返回
// 2. 检测是否有历史版本 → 增量更新
// 3. 批量生成章节 → 减少 API 调用
// 4. 存储到缓存 → 供后续复用
```

---

## 优化策略组合

### 自动选择逻辑

```typescript
// WriterAgent 内部逻辑

async execute(task) {
  // 优先级 1: 语义缓存
  const cached = await this.cache.findSimilar(task);
  if (cached) {
    return this.rewrite(cached.response, task);
  }

  // 优先级 2: 增量生成
  const previous = await this.getPreviousVersion(task);
  if (previous) {
    const diff = await this.incremental.diff(previous, task);
    return await this.incremental.update(previous, diff);
  }

  // 优先级 3: 批处理生成
  if (this.canBatch(task)) {
    return await this.batchExecute(task);
  }

  // 默认: 正常生成
  return await this.normalExecute(task);
}
```

### 效果叠加

```
基础成本: ¥0.010/任务

- 语义缓存命中(30%): -¥0.003
- 增量生成(20%): -¥0.0014
- 批处理优化(50%): -¥0.003
────────────────────────────
优化后: ¥0.0026/任务

总节省: 74%
```

---

## 监控和调优

### 缓存命中率监控

```typescript
const stats = cache.getStats();
console.log(`命中率: ${stats.hitRate}`);
console.log(`总请求: ${stats.totalRequests}`);
console.log(`缓存命中: ${stats.cacheHits}`);

// 目标: 命中率 > 30%
```

### 批处理效果监控

```typescript
const stats = batch.getStats();
console.log(`批处理率: ${stats.batchRate}%`);
console.log(`API 调用节省: ${stats.apiCallSavings}%`);

// 目标: 批处理率 > 60%
```

### 增量生成监控

```typescript
const stats = incremental.getStats();
console.log(`增量生成率: ${stats.incrementalRate}%`);
console.log(`平均节省: ${stats.avgSavings}%`);

// 目标: 增量率 > 20%
```

---

## 最佳实践

### 1. 合理设置阈值

```typescript
// 保守配置（质量优先）
const cache = new SemanticCache({ similarityThreshold: 0.9 });

// 激进配置（成本优先）
const cache = new SemanticCache({ similarityThreshold: 0.75 });
```

### 2. 定期清理缓存

```typescript
// 每天清理过期缓存
setInterval(() => {
  cache.clearExpired();
}, 86400000);
```

### 3. 监控质量指标

```typescript
// 跟踪缓存返回的质量
const userFeedback = await collectFeedback(result);
if (userFeedback.rating < 3) {
  cache.invalidate(task); // 低分结果不缓存
}
```

---

## 故障排查

### 缓存命中率低

- 检查相似度阈值是否过高
- 检查任务描述是否差异太大
- 考虑降低阈值到 0.75

### 批处理质量下降

- 减小批处理大小（5 → 3）
- 对复杂任务禁用批处理
- 增加提示词明确性

### 增量生成失败

- 检查原始内容是否完整
- 简化差异描述
- 回退到完整生成

---

## 总结

P1 优化通过三个高级策略的协同工作，可将成本再降低 **65-75%**。

关键成功因素：
- ✅ 合理配置阈值
- ✅ 持续监控指标
- ✅ 用户反馈循环
- ✅ 质量成本平衡
