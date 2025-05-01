# API 参考手册

## 核心模块 API

### Logger

#### `createLogger(module: string): Logger`

创建一个带模块名称的日志记录器。

**参数**：

- `module`: string - 模块名称

**返回**：Logger 实例

**示例**：

```typescript
const logger = createLogger('my-module')
```

---

#### Logger 实例方法

##### `logger.info(message: string, metadata?: LogMetadata): void`

记录信息级别日志。

**参数**：

- `message`: string - 日志消息
- `metadata`: LogMetadata (可选) - 结构化元数据

##### `logger.warn(message: string, metadata?: LogMetadata): void`

记录警告级别日志。

##### `logger.error(message: string, metadata?: LogMetadata): void`

记录错误级别日志。

##### `logger.debug(message: string, metadata?: LogMetadata): void`

记录调试级别日志。

---

### ErrorHandler

#### `withErrorHandling<T>(operation: () => Promise<T>, context: string, logger: Logger, options?: ErrorHandlingOptions): Promise<T>`

包装异步操作并提供统一的错误处理。

**类型参数**：

- `T` - 操作返回值类型

**参数**：

- `operation`: () => Promise<T> - 要执行的异步操作
- `context`: string - 操作描述（用于日志）
- `logger`: Logger - 日志记录器
- `options`: ErrorHandlingOptions (可选)
  - `throwOnError`: boolean - 是否抛出错误（默认：false）

**返回**：Promise<T>

**示例**：

```typescript
const result = await withErrorHandling(async () => await fetchData(), '获取数据', logger, {
  throwOnError: true,
})
```

---

#### `withRetry<T>(operation: () => Promise<T>, context: string, logger: Logger, options?: RetryOptions): Promise<T>`

包装异步操作并提供自动重试功能。

**参数**：

- `operation`: () => Promise<T> - 要执行的异步操作
- `context`: string - 操作描述
- `logger`: Logger - 日志记录器
- `options`: RetryOptions (可选)
  - `maxRetries`: number - 最大重试次数（默认：3）
  - `delayMs`: number - 重试延迟（默认：1000）
  - `backoffMultiplier`: number - 退避倍数（默认：2）

**返回**：Promise<T>

---

#### `withTimeout<T>(operation: () => Promise<T>, context: string, logger: Logger, options?: TimeoutOptions): Promise<T>`

为异步操作添加超时限制。

**参数**：

- `operation`: () => Promise<T> - 要执行的异步操作
- `context`: string - 操作描述
- `logger`: Logger - 日志记录器
- `options`: TimeoutOptions (可选)
  - `timeoutMs`: number - 超时时间（默认：5000）

**返回**：Promise<T>

---

### LLMOptimizer

#### `constructor(llm: LLMClient, config?: LLMOptimizerConfig)`

创建 LLM 优化器实例。

**参数**：

- `llm`: LLMClient - LLM 客户端
- `config`: LLMOptimizerConfig (可选)
  - `cacheEnabled`: boolean - 是否启用缓存（默认：true）
  - `maxCacheSize`: number - 最大缓存大小（默认：1000）
  - `batchSize`: number - 批处理大小（默认：10）

---

#### `optimizedChat(request: ChatRequest): Promise<ChatResponse>`

发送优化的聊天请求。

**参数**：

- `request`: ChatRequest
  - `messages`: Message[] - 消息数组
  - `temperature`: number - 温度参数
  - `maxTokens`: number - 最大令牌数

**返回**：Promise<ChatResponse>

---

#### `batchChat(requests: ChatRequest[]): Promise<ChatResponse[]>`

批量发送聊天请求。

**参数**：

- `requests`: ChatRequest[] - 请求数组

**返回**：Promise<ChatResponse[]>

---

### Validators

#### `validateOfficeAction(officeAction: any): ValidationResult`

验证审查意见对象。

**参数**：

- `officeAction`: any - 要验证的对象

**返回**：ValidationResult

```typescript
{
  valid: boolean
  errors?: string[]
}
```

---

#### `validateResponse(response: any): ValidationResult`

验证答复对象。

**参数**：

- `response`: any - 要验证的对象

**返回**：ValidationResult

---

## 智能体 API

### PatentResponderAgent

#### `constructor(config: AgentConfig)`

创建专利答复智能体实例。

**参数**：

- `config`: AgentConfig
  - `llm`: LLMClient - LLM 客户端
  - `logger`: Logger - 日志记录器
  - `temperature`: number (可选) - 温度参数
  - `maxTokens`: number (可选) - 最大令牌数

---

#### `execute(input: AgentInput, context?: AgentContext): Promise<AgentResult>`

执行智能体任务。

**参数**：

- `input`: AgentInput
  - `officeAction`: OfficeAction - 审查意见
- `context`: AgentContext (可选)
  - `patentId`: string - 专利 ID
  - `previousResponses`: Response[] - 之前的答复

**返回**：Promise<AgentResult>

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

#### `predictResponse(response: string, officeAction: OfficeAction): Promise<ExaminerPrediction>`

预测审查员对答复的反应。

**参数**：

- `response`: string - 答复内容
- `officeAction`: OfficeAction - 原始审查意见

**返回**：Promise<ExaminerPrediction>

```typescript
{
  score: number // 0-100
  effectiveness: 'high' | 'medium' | 'low'
  suggestions: string[]
  likelyOutcome: 'allowance' | 'rejection' | 'rfc'
}
```

---

### HebbianOptimizer

#### `saveCaseForLearning(caseId: string, officeAction: OfficeAction, strategy: ResponseStrategy, features: string[]): void`

保存案例用于学习。

**参数**：

- `caseId`: string - 案例 ID
- `officeAction`: OfficeAction - 审查意见
- `strategy`: ResponseStrategy - 使用的策略
- `features`: string[] - 提取的特征

---

#### `getOptimizedStrategy(officeAction: OfficeAction, similarCases?: LearningCase[]): ResponseStrategy`

获取优化策略建议。

**参数**：

- `officeAction`: OfficeAction - 当前审查意见
- `similarCases`: LearningCase[] (可选) - 相似案例

**返回**：ResponseStrategy

---

#### `getMemoryStats(): MemoryStats`

获取内存使用统计。

**返回**：MemoryStats

```typescript
{
  totalCases: number
  memoryUsed: number
  memoryLimit: number
  oldestCase: Date
  newestCase: Date
}
```

---

## 类型定义

### OfficeAction

```typescript
interface OfficeAction {
  rejectionReasons: string[]
  claims: number[]
  examinerNotes?: string
  references?: Citation[]
}
```

### ResponseStrategy

```typescript
interface ResponseStrategy {
  type: 'argument' | 'amendment' | 'evidence'
  arguments: string[]
  proposedAmendments?: ClaimAmendment[]
  evidence?: Evidence[]
}
```

### LearningCase

```typescript
interface LearningCase {
  caseId: string
  officeAction: OfficeAction
  selectedStrategy: ResponseStrategy
  outcome: 'pending' | 'success' | 'failure'
  features: string[]
  timestamp: Date
}
```

---

**文档版本**：1.0.0
**最后更新**：2026-05-03
