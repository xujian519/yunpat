# ResultValidator 使用指南

ResultValidator 是 P0 准确率优化方案 #2 的核心实现，提供自动结果验证和错误纠正能力。

## 核心功能

1. **结构验证** - 使用 Zod schema 检查数据结构
2. **内容质量检查** - 验证长度、格式、完整性
3. **逻辑一致性验证** - 检测矛盾、重复、断层
4. **自动纠正策略** - 重试、降级、人工介入

## 基本使用

### 1. 在 Agent 中集成

```typescript
import { Agent } from '@yunpat/core'
import { ResultValidator, z } from '@yunpat/core'

class WriterAgent extends Agent<Input, Output> {
  private validator = new ResultValidator({
    verbose: true,
    defaultCorrectionStrategy: CorrectionStrategy.RETRY,
    maxRetries: 3,
  })

  protected async act(plan: Plan, context: ExecutionContext): Promise<Result> {
    // 1. 调用 LLM 生成内容
    const result = await context.llm.chat({
      messages: [{ role: 'user', content: plan.prompt }],
    })

    // 2. 定义验证 schema
    const schema = z.object({
      content: z.string().min(100),
      title: z.string(),
      metadata: z
        .object({
          wordCount: z.number(),
          tags: z.array(z.string()),
        })
        .optional(),
    })

    // 3. 验证结果
    const validationResult = await this.validator.validate(result.message.content, schema)

    // 4. 如果验证失败，执行纠正
    if (!validationResult.valid) {
      console.error('验证失败:', validationResult.errors)

      // 尝试自动纠正
      result.message.content = await this.validator.correct(
        result.message.content,
        validationResult,
        // 重试函数
        async () => {
          const retryResult = await context.llm.chat({
            messages: [
              { role: 'user', content: plan.prompt },
              { role: 'assistant', content: result.message.content },
              { role: 'user', content: `请修复以下问题: ${validationResult.errors.join(', ')}` },
            ],
          })
          return retryResult.message.content
        }
      )
    }

    // 5. 处理警告（逻辑问题）
    if (validationResult.warnings.length > 0) {
      console.warn('检测到潜在问题:', validationResult.warnings)
    }

    return result
  }
}
```

### 2. 结构验证示例

```typescript
import { z } from '@yunpat/core'

// 定义 schema
const articleSchema = z.object({
  title: z.string().min(5).max(100),
  content: z.string().min(500),
  author: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  tags: z.array(z.string()).min(1).max(5),
  publishedAt: z.date().optional(),
})

// 验证
const validator = new ResultValidator()
const result = await validator.validate(data, articleSchema)

if (result.valid) {
  console.log('验证通过:', result.data)
} else {
  console.error('验证失败:', result.errors)
}
```

### 3. 内容质量检查

```typescript
const validator = new ResultValidator()

const qualityReport = validator.checkQuality(content, {
  minLength: 500,
  maxLength: 5000,
  requiredKeywords: ['引言', '结论', '数据分析'],
  forbiddenKeywords: ['待续', '未完'],
  mustBeComplete: true,
  truncationMarkers: ['...', '（未完）'],
})

if (!qualityReport.passed) {
  console.log('长度检查:', qualityReport.lengthCheck)
  console.log('关键词检查:', qualityReport.keywordCheck)
  console.log('完整性检查:', qualityReport.completenessCheck)
}
```

### 4. 逻辑一致性验证

```typescript
const validator = new ResultValidator()

const inconsistencies = await validator.detectInconsistencies(content)

if (inconsistencies.length > 0) {
  inconsistencies.forEach((inc) => {
    console.log(`[${inc.type}] ${inc.description}`)
    if (inc.location) {
      console.log(`  位置: ${inc.location.start}-${inc.location.end}`)
    }
  })
}
```

### 5. 与 ResilientLLMAdapter 配合

```typescript
import { ResilientLLMAdapter, ResultValidator } from '@yunpat/core'

// 创建弹性适配器
const resilientLLM = new ResilientLLMAdapter({
  primaryAdapter: primaryModel,
  fallbackAdapter: fallbackModel,
  maxRetries: 3,
})

// 创建验证器
const validator = new ResultValidator({
  defaultCorrectionStrategy: CorrectionStrategy.RETRY,
  maxRetries: 3,
})

// 使用
async function generateWithValidation(prompt: string, schema: z.ZodSchema) {
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++

    // 1. 调用 LLM（自动重试）
    const result = await resilientLLM.chat({
      messages: [{ role: 'user', content: prompt }],
    })

    // 2. 验证结果
    const validationResult = await validator.validate(result.message.content, schema)

    if (validationResult.valid) {
      return result.message.content
    }

    // 3. 验证失败，根据错误类型处理
    if (validationResult.errorType === ValidationErrorType.STRUCTURAL) {
      // 结构错误：使用 ResilientLLMAdapter 重试
      prompt = `${prompt}\n\n请确保输出符合以下格式：${schema.toString()}`
      continue
    } else if (validationResult.errorType === ValidationErrorType.QUALITY) {
      // 质量错误：修正 prompt 后重试
      prompt = `${prompt}\n\n要求：${validationResult.errors.join(', ')}`
      continue
    }
  }

  throw new Error(`生成失败，已重试 ${maxAttempts} 次`)
}
```

### 6. 与 TelemetryCollector 集成

```typescript
import { ResultValidator, TelemetryCollector, TelemetryEventType, EventStatus } from '@yunpat/core'

const validator = new ResultValidator()
const telemetry = new TelemetryCollector()

async function validateWithMetrics(data: any, schema: z.ZodSchema) {
  const startTime = Date.now()

  // 验证
  const result = await validator.validate(data, schema)

  const duration = Date.now() - startTime

  // 记录指标
  telemetry.record({
    type: TelemetryEventType.VALIDATION,
    agentName: 'WriterAgent',
    stage: 'validation',
    status: result.valid ? EventStatus.SUCCESS : EventStatus.FAILURE,
    timestamp: Date.now(),
    duration,
    metadata: {
      errorType: result.errorType,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    },
  })

  return result
}
```

## 纠正策略

ResultValidator 提供四种纠正策略：

### 1. RETRY（重试）

适用于结构错误，自动重试生成：

```typescript
const result = await validator.validate(data, schema)

if (!result.valid) {
  data = await validator.correct(data, result, async () => {
    // 重试函数
    return await regenerate()
  })
}
```

### 2. DEGRADE（降级）

适用于质量错误，返回部分结果：

```typescript
const validator = new ResultValidator({
  defaultCorrectionStrategy: CorrectionStrategy.DEGRADE,
})

// 降级后的结果会添加警告前缀或字段
const result = await validator.correct(data, validationResult)
```

### 3. MANUAL（人工介入）

适用于无法自动修复的错误：

```typescript
const validator = new ResultValidator({
  defaultCorrectionStrategy: CorrectionStrategy.MANUAL,
})

// 会抛出异常，需要人工处理
try {
  const result = await validator.correct(data, validationResult)
} catch (error) {
  console.error('需要人工介入:', error.message)
  // 发送告警或记录到问题追踪系统
}
```

### 4. FORCE_ACCEPT（强制接受）

适用于逻辑警告，强制接受结果：

```typescript
const validator = new ResultValidator({
  defaultCorrectionStrategy: CorrectionStrategy.FORCE_ACCEPT,
})

// 接受结果，但打印警告
const result = await validator.correct(data, validationResult)
// 警告: [ResultValidator] 警告: [...]
```

## 验证准确率

ResultValidator 的设计目标：

- **验证准确率** > 90%（正确识别有效/无效结果）
- **自动纠正成功率** > 70%（重试后通过验证）
- **误报率** < 5%（将有效结果误判为无效）

## 最佳实践

1. **定义严格的 Schema** - 使用 Zod 定义清晰的数据结构
2. **合理设置质量要求** - 平衡严格度和容错性
3. **记录验证指标** - 与 TelemetryCollector 集成
4. **分级处理错误** - 结构错误重试，质量错误降级
5. **关注逻辑警告** - 即使通过验证也要检查警告信息

## 常见问题

### Q: 如何避免过度验证？

A: 使用 `CorrectionStrategy.FORCE_ACCEPT` 对非关键错误只警告不阻断。

### Q: 如何提高重试成功率？

A: 在重试函数中根据错误信息调整 prompt，提供更具体的指导。

### Q: 如何处理流式输出？

A: 流式输出需要积累完整内容后再验证，或在每个 chunk 后进行增量验证。

### Q: 如何减少验证开销？

A: 对简单场景使用简化的 schema，或缓存验证结果。
