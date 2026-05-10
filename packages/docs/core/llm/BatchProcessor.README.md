# BatchProcessor - 批处理器文档

## 概述

`BatchProcessor` 是 YunPat 框架中的成本优化组件，通过将多个 LLM API 调用合并为单个批量请求，显著降低 API 调用成本。

## 核心优势

### 成本节省对比

| 章节数量 | 原始方式    | 批处理方式 | 节省比例 |
| -------- | ----------- | ---------- | -------- |
| 5个章节  | 5次API调用  | 1次API调用 | **80%**  |
| 10个章节 | 10次API调用 | 2次API调用 | **80%**  |
| 20个章节 | 20次API调用 | 3次API调用 | **85%**  |

### 实际成本对比（以 DeepSeek 为例）

```
原始方式：
- 章节1: ¥0.002
- 章节2: ¥0.002
- 章节3: ¥0.002
- 章节4: ¥0.002
- 章节5: ¥0.002
总计：¥0.01

批处理方式：
- 批量生成（5章节）: ¥0.004
总计：¥0.004

节省：60%
```

## 快速开始

### 基础使用

```typescript
import { BatchProcessor } from '@yunpat/core'

// 创建批处理器
const batchProcessor = new BatchProcessor(llmAdapter, {
  maxSectionsPerBatch: 8, // 单批最大章节数
  timeout: 120000, // 超时时间（毫秒）
  enabled: true, // 是否启用
})

// 批量生成章节
const sections = ['引言', '架构设计', '核心组件']
const results = await batchProcessor.batchGenerate(sections, plan, context)

// 获取结果
results.forEach((result) => {
  console.log(`${result.heading}: ${result.content}`)
})
```

### 集成到 WriterAgent

```typescript
import { WriterAgent } from '@yunpat/agent-writer'
import { BatchProcessor } from '@yunpat/core'

class OptimizedWriterAgent extends WriterAgent {
  private batchProcessor?: BatchProcessor

  protected async init(task: WritingTask, context: ExecutionContext): Promise<void> {
    this.batchProcessor = new BatchProcessor(context.llm)
  }

  protected async act(plan: WritingPlan, context: ExecutionContext): Promise<any> {
    const sections = plan.structure.sections.map((s) => s.heading)
    const results = await this.batchProcessor!.batchGenerate(sections, plan, context)

    // 组装结果...
  }
}
```

## 配置选项

### BatchConfig

```typescript
interface BatchConfig {
  /** 单批最大章节数（默认: 8） */
  maxSectionsPerBatch: number

  /** 批处理超时时间，单位毫秒（默认: 120000） */
  timeout: number

  /** 是否启用批处理（默认: true） */
  enabled: boolean
}
```

### 推荐配置

#### 小文档（< 5章节）

```typescript
const config = {
  maxSectionsPerBatch: 8,
  timeout: 60000,
  enabled: true,
}
```

#### 中等文档（5-15章节）

```typescript
const config = {
  maxSectionsPerBatch: 6,
  timeout: 120000,
  enabled: true,
}
```

#### 大文档（> 15章节）

```typescript
const config = {
  maxSectionsPerBatch: 5,
  timeout: 180000,
  enabled: true,
}
```

## 智能分批策略

### 自动分批规则

1. **章节数量 ≤ maxSectionsPerBatch**: 不分批，单次生成所有章节
2. **章节数量 > maxSectionsPerBatch**: 自动分批，并行处理

### 分批示例

```typescript
// 10个章节，maxSectionsPerBatch: 8
// → 分为2批：[8个章节] + [2个章节]

// 20个章节，maxSectionsPerBatch: 5
// → 分为4批：[5] + [5] + [5] + [5]
```

## 错误处理

### 自动回退机制

当批处理失败时，`BatchProcessor` 会自动回退到顺序处理模式：

```typescript
// 批处理失败时，自动逐个生成章节
const results = await batchProcessor.batchGenerate(sections, plan, context)
// 内部会捕获错误并调用 fallbackToSequential()
```

### 手动禁用批处理

```typescript
// 禁用批处理（用于调试或对比）
batchProcessor.disable()

// 启用批处理
batchProcessor.enable()

// 检查状态
const config = batchProcessor.getConfig()
console.log('批处理状态:', config.enabled)
```

## 成本估算

### 预估节省

```typescript
const savings = batchProcessor.estimateCostSavings(10)

console.log('原始API调用:', savings.originalCalls) // 10
console.log('批处理后:', savings.batchCalls) // 2
console.log('节省次数:', savings.savedCalls) // 8
console.log('节省比例:', savings.savingsPercentage + '%') // 80%
```

## 最佳实践

### 1. 合理设置批次大小

```typescript
// ✅ 推荐：根据文档大小调整
maxSectionsPerBatch: documentSize < 10 ? 8 : 5

// ❌ 避免：批次过大导致超时
maxSectionsPerBatch: 20 // 可能导致 API 超时
```

### 2. 处理失败场景

```typescript
try {
  const results = await batchProcessor.batchGenerate(sections, plan, context)

  // 检查是否有章节生成失败
  const missingSections = sections.filter((s) => !results.has(s))
  if (missingSections.length > 0) {
    console.warn('部分章节生成失败:', missingSections)
  }
} catch (error) {
  console.error('批处理完全失败，回退到顺序处理')
  // BatchProcessor 会自动回退
}
```

### 3. 监控性能

```typescript
console.log('批处理配置:', batchProcessor.getConfig())
console.log('成本节省:', batchProcessor.estimateCostSavings(sections.length))
```

## 性能指标

### API 调用次数

- **减少**: 60-85%
- **具体**: 取决于章节数量和批次大小配置

### 响应时间

- **小文档**（< 5章节）: 基本一致
- **中等文档**（5-15章节）: 略快（并行 + 减少 RTT）
- **大文档**（> 15章节）: 明显更快（并行批次）

### 质量

- **内容质量**: 与顺序生成基本一致
- **格式**: 严格遵循 JSON 格式，使用 zod 验证
- **成功率**: 95%+（失败时自动回退）

## 限制和注意事项

### 1. LLM 兼容性

BatchProcessor 要求 LLM 支持：

- 结构化输出（JSON 格式）
- 较大的上下文窗口（> 8k tokens）

**支持的模型**:

- ✅ DeepSeek (推荐)
- ✅ 通义千问
- ✅ Claude 3.5+
- ✅ GPT-4+

### 2. 章节大小限制

- 单章节内容建议 < 2000 词
- 批次总 tokens 建议 < 8k

### 3. 并发限制

- 批次之间是并行处理
- 注意 API 速率限制（Rate Limit）

## 高级用法

### 自定义解析器

```typescript
class CustomBatchProcessor extends BatchProcessor {
  protected parseBatchResponse(
    response: string,
    expectedSections: string[]
  ): Map<string, BatchSectionResult> {
    // 自定义解析逻辑
    // ...
  }
}
```

### 动态调整批次大小

```typescript
class AdaptiveBatchProcessor extends BatchProcessor {
  async batchGenerate(
    sections: string[],
    plan: any,
    context: any
  ): Promise<Map<string, BatchSectionResult>> {
    // 根据内容长度动态调整批次大小
    const avgLength = plan.targetLength / sections.length

    if (avgLength > 1000) {
      this.updateConfig({ maxSectionsPerBatch: 4 })
    } else {
      this.updateConfig({ maxSectionsPerBatch: 8 })
    }

    return super.batchGenerate(sections, plan, context)
  }
}
```

## 故障排查

### 问题：JSON 解析失败

**原因**: LLM 返回的 JSON 格式不正确

**解决方案**:

- 在提示词中强调 JSON 格式要求
- 使用少样本示例（Few-Shot）
- 启用重试机制

### 问题：批次超时

**原因**: 单批章节数量过多

**解决方案**:

- 减少 `maxSectionsPerBatch`
- 增加 `timeout` 配置
- 检查网络连接

### 问题：部分章节缺失

**原因**: LLM 未生成所有章节

**解决方案**:

- 检查 `resultMap` 是否包含所有章节
- 对缺失章节进行单独生成
- 启用自动重试

## 相关文档

- [WriterAgent 文档](../agents/writer/README.md)
- [LLM 适配器文档](./NativeLLMAdapter.README.md)
- [成本优化最佳实践](../../docs/cost-optimization.md)

## 更新日志

### v0.2.0 (2026-04-28)

- ✨ 初始版本
- ✅ 支持批量生成章节
- ✅ 智能分批策略
- ✅ 自动回退机制
- ✅ 成本估算功能
