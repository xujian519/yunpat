# YunPat API 文档

## 概述

YunPat 是一个专利智能体框架，提供了一套完整的 TypeScript API 用于构建、部署和管理专利处理智能体。

## 目录

- [核心模块](#核心模块)
- [智能体系统](#智能体系统)
- [工具函数](#工具函数)
- [类型定义](#类型定义)
- [最佳实践](#最佳实践)

---

## 核心模块

### Logger

日志系统提供结构化的日志记录功能。

```typescript
import { createLogger } from '@yunpat/core/logger'

const logger = createLogger('my-module')

// 基本日志
logger.info('Application started')
logger.warn('Configuration missing, using defaults')
logger.error('Failed to process request', { error: err })

// 带元数据的日志
logger.debug('Processing request', {
  requestId: 'req-123',
  userId: 'user-456',
})
```

**特性**：

- 自动日志脱敏（敏感信息）
- 结构化元数据
- 日志级别控制
- 性能监控集成

---

### ErrorHandler

统一的错误处理模块。

```typescript
import { withErrorHandling, withRetry, withTimeout } from '@yunpat/core/error-handler'

// 基础错误处理
const result = await withErrorHandling(
  async () => {
    return await fetchData()
  },
  '获取数据',
  logger,
  { throwOnError: true }
)

// 带重试
const data = await withRetry(async () => await fetchAPI(), '调用API', logger, {
  maxRetries: 3,
  delayMs: 1000,
})

// 带超时
const result = await withTimeout(async () => await longRunningTask(), '长时间任务', logger, {
  timeoutMs: 5000,
})
```

**特性**：

- 自动错误捕获和日志
- 可配置的重试策略
- 超时控制
- 批量错误处理

---

### LLMOptimizer

LLM 调用优化器，提供缓存、批处理等功能。

```typescript
import { LLMOptimizer } from '@yunpat/core/llm-optimizer'

const optimizer = new LLMOptimizer(llmClient)

// 基本调用
const response = await optimizer.optimizedChat({
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
})

// 批量调用
const responses = await optimizer.batchChat([
  { messages: [{ role: 'user', content: 'Hello' }] },
  { messages: [{ role: 'user', content: 'World' }] },
])
```

**特性**：

- 智能缓存（SHA-256 哈希）
- 批量处理优化
- 自动重试和降级
- 性能监控

---

## 智能体系统

### PatentResponderAgent

专利答复智能体，处理审查意见答复。

```typescript
import { PatentResponderAgent } from '@yunpat/agents/responder'

const agent = new PatentResponderAgent({
  llm: llmClient,
  logger: logger,
  config: {
    temperature: 0.7,
    maxTokens: 2000,
  },
})

const result = await agent.execute({
  officeAction: {
    rejectionReasons: ['缺乏新颖性', '显而易见性'],
    claims: [1, 2, 3],
  },
  context: {
    patentId: 'US12345678',
    description: '专利描述',
  },
})
```

**返回值**：

```typescript
{
  success: boolean
  response: string
  metrics: {
    allowanceProbability: number
    confidence: number
    processingTime: number
  }
}
```

---

### ExaminerSimulator

审查员模拟器，预测审查员反应。

```typescript
import { ExaminerSimulator } from '@yunpat/agents/responder/ExaminerSimulator'

const simulator = new ExaminerSimulator({
  llm: llmClient,
  logger: logger,
})

const prediction = await simulator.predictResponse({
  response: '我们的答复内容',
  officeAction: originalOfficeAction,
})

// 返回评分和反馈
console.log(`评分: ${prediction.score}/100`)
console.log(`有效性: ${prediction.effectiveness}`)
console.log(`建议: ${prediction.suggestions}`)
```

---

### HebbianOptimizer

赫布学习优化器，从历史案例中学习。

```typescript
import { HebbianOptimizer } from '@yunpat/agents/responder/HebbianOptimizer'

const optimizer = new HebbianOptimizer({
  logger: logger,
  maxCases: 10000,
})

// 保存学习案例
optimizer.saveCaseForLearning('case-123', officeAction, selectedStrategy, extractedFeatures)

// 获取优化建议
const recommendation = optimizer.getOptimizedStrategy(currentOfficeAction, similarCases)
```

**特性**：

- 自动案例管理（内存限制）
- 特征提取和匹配
- 策略优化建议
- 性能监控

---

## 工具函数

### Validators

输入验证工具。

```typescript
import { validateOfficeAction, validateResponse } from '@yunpat/core/validators'

// 验证审查意见
const validationResult = validateOfficeAction(officeAction)
if (!validationResult.valid) {
  console.error('验证失败:', validationResult.errors)
}

// 验证答复
const responseValidation = validateResponse(response)
if (!responseValidation.valid) {
  console.error('答复无效:', responseValidation.errors)
}
```

---

### PerformanceMonitor

性能监控工具。

```typescript
import { PerformanceMonitor } from '@yunpat/core/performance-monitor'

const monitor = new PerformanceMonitor('my-operation')

// 记录操作
const result = await monitor.track(async () => {
  return await performOperation()
})

// 获取统计信息
const stats = monitor.getStats()
console.log(`平均耗时: ${stats.averageTime}ms`)
console.log(`操作次数: ${stats.count}`)
```

---

## 类型定义

### 核心类型

```typescript
// 审查意见
interface OfficeAction {
  rejectionReasons: string[]
  claims: number[]
  examinerNotes?: string
  references?: Citation[]
}

// 答复策略
interface ResponseStrategy {
  type: 'argument' | 'amendment' | 'evidence'
  arguments: string[]
  proposedAmendments?: ClaimAmendment[]
  evidence?: Evidence[]
}

// 智能体配置
interface AgentConfig {
  llm: LLMClient
  logger: Logger
  temperature?: number
  maxTokens?: number
  cacheEnabled?: boolean
}
```

---

## 最佳实践

### 1. 错误处理

始终使用统一的错误处理：

```typescript
import { withErrorHandling } from '@yunpat/core/error-handler'

const result = await withErrorHandling(async () => await riskyOperation(), '操作描述', logger, {
  throwOnError: true,
})
```

### 2. 日志记录

使用结构化日志：

```typescript
logger.info('处理请求', {
  requestId: req.id,
  userId: req.userId,
  action: req.action,
})
```

### 3. 性能优化

使用缓存和批处理：

```typescript
// 启用缓存
const response = await optimizer.optimizedChat({
  messages,
  cache: true,
})

// 批量处理
const responses = await optimizer.batchChat(requests)
```

### 4. 内存管理

注意内存使用：

```typescript
// HebbianOptimizer 会自动管理内存
const optimizer = new HebbianOptimizer({
  maxCases: 10000, // 设置合理的限制
})
```

---

## 更多信息

- [完整 API 参考](./api-reference.md)（待添加）
- [示例代码](../examples/)（待添加）
- [贡献指南](../CONTRIBUTING.md)（待添加）

---

**文档版本**：1.0.0
**最后更新**：2026-05-03
**维护者**：YunPat Team
