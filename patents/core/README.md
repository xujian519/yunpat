# 审查答复智能体 - 基础设施使用指南

> 为增强版专利审查答复智能体提供的企业级基础设施
>
> 版本：v1.0.0 | 更新时间：2026-05-03

---

## 📦 组件概览

本基础设施包含以下核心组件：

| 组件 | 文件 | 功能 | 状态 |
|------|------|------|------|
| **类型系统** | `llm-types.ts` | LLM 类型定义 | ✅ 完成 |
| **错误处理** | `errors.ts` | 结构化错误类 | ✅ 完成 |
| **常量管理** | `constants.ts` | 集中常量定义 | ✅ 完成 |
| **输入验证** | `validators.ts` | 输入验证器 | ✅ 完成 |
| **LLM 工具** | `llm-helper.ts` | LLM 辅助功能 | ✅ 完成 |
| **日志系统** | `logger.ts` | 日志记录 | ✅ 完成 |
| **性能监控** | `performance-monitor.ts` | 性能分析 | ✅ 完成 |

---

## 🚀 快速开始

### 1. 类型系统

```typescript
import type {
  LLMAdapter,
  LLMMessage,
  LLMResponse,
  StructuredOutputSchema,
} from './llm-types.js'
import {
  extractResponseContent,
  extractJSONFromResponse,
  estimateTokens,
  checkTokenLimit
} from './llm-types.js'

// 创建 LLM 消息
const message: LLMMessage = {
  role: 'user',
  content: '请分析以下审查意见...'
}

// 调用 LLM
const response: LLMResponse = await llm.chat({
  messages: [message],
  temperature: 0.3,
})

// 提取内容
const content = extractResponseContent(response)

// 解析 JSON
const data = extractJSONFromResponse<{ score: number }>(response)
```

---

### 2. 错误处理

```typescript
import {
  OAResponderError,
  ExaminerSimulatorError,
  LLMInvokeError,
  ValidationError
} from './errors.js'

// 抛出结构化错误
if (!isValid) {
  throw new ExaminerSimulatorError(
    '审查员模拟失败',
    { oaType: officeAction.oa_type }
  )
}

// 捕获和处理错误
try {
  await this.simulateReview(officeAction, responseDoc)
} catch (error) {
  if (error instanceof LLMInvokeError) {
    // 处理 LLM 调用错误
    console.error('LLM 调用失败:', error.code)
  }

  // 重新抛出或处理
  throw error
}
```

---

### 3. 常量使用

```typescript
import {
  LLM_CONSTANTS,
  EXAMINER_CONSTANTS,
  PREDICTOR_CONSTANTS,
  VALIDATION_CONSTANTS
} from './constants.js'
import { clamp, calculatePercentage } from './constants.js'

// 使用常量
const temperature = LLM_CONSTANTS.DEFAULT_TEMPERATURE
const maxRetries = LLM_CONSTANTS.MAX_RETRY_ATTEMPTS

// 计算概率
const probability = strategyAnalysis.effectiveness *
  EXAMINER_CONSTANTS.STRATEGY_EFFECTIVENESS_WEIGHT - 20

// 限制范围
const score = clamp(value,
  VALIDATION_CONSTANTS.SCORE_MIN,
  VALIDATION_CONSTANTS.SCORE_MAX
)

// 计算百分比
const percentage = calculatePercentage(part, total)
```

---

### 4. 输入验证

```typescript
import {
  validateOfficeAction,
  validateResponseDocument,
  validateScore,
  validateConfig
} from './validators.js'

// 验证 OfficeAction
validateOfficeAction(officeAction)

// 验证 ResponseDocument
validateResponseDocument(responseDocument)

// 验证分数
const score = validateScore(
  rawScore,
  0,  // min
  100, // max
  '成功率'
)

// 验证配置
validateConfig(config, {
  strictness: { required: false, type: 'number', range: [0, 1] },
  enableCache: { required: false, type: 'boolean' },
})
```

---

### 5. LLM 辅助工具

```typescript
import { LLMHelper } from './llm-helper.js'

// 结构化输出
const result = await LLMHelper.structuredChat<{
  effectiveness: number
  reasoning: string
  suggestions: string[]
}>(
  this.llm,
  '请评估答复策略...',
  {
    effectiveness: { type: 'number', description: '评分 (0-100)' },
    reasoning: { type: 'string', description: '评估理由' },
    suggestions: { type: 'array', description: '改进建议' }
  }
)

// 带重试的调用
const response = await LLMHelper.chatWithRetry(
  this.llm,
  { messages: [...] },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`重试 ${attempt}: ${error.message}`)
    }
  }
)

// 批量调用
const responses = await LLMHelper.batchChat(
  this.llm,
  [params1, params2, params3],
  {
    maxConcurrent: 5,
    onProgress: (completed, total) => {
      console.log(`进度: ${completed}/${total}`)
    }
  }
)

// 配置缓存
LLMHelper.configureCache({
  enabled: true,
  maxSize: 1000,
  expiryTime: 3600000 // 1小时
})

// 计算成本
const cost = LLMHelper.calculateCost(response, {
  inputPricePer1kTokens: 0.001,
  outputPricePer1kTokens: 0.002,
})
```

---

### 6. 日志系统

```typescript
import {
  Logger,
  createModuleLogger,
  StructuredLogger,
  performanceLogger
} from './logger.js'
import { LogLevel } from './logger.js'

// 全局日志器
const logger = Logger.getInstance()
logger.info('系统启动')
logger.warn('配置缺失', { key: 'API_KEY' })
logger.error('操作失败', error)

// 模块日志器
const moduleLogger = createModuleLogger('ExaminerSimulator')
moduleLogger.info('开始模拟', { oaType: 'Novelty' })

// 结构化日志器
const structLogger = new StructuredLogger('MyResponder')
structLogger.logOperationStart('答复策略制定')
structLogger.logOperationEnd('答复策略制定', { strategy: 'Hybrid' }, 1500)
structLogger.logStateChange('drafting', 'review')

// 性能日志器
const duration = await performanceLogger.measure('审查员模拟', async () => {
  return await this.simulateReview(officeAction, responseDoc)
})
```

---

### 7. 性能监控

```typescript
import {
  PerformanceMonitor,
  monitorPerformance,
  getPerformanceStats,
  printPerformanceReport
} from './performance-monitor.js'

// 创建监控器
const monitor = new PerformanceMonitor()

// 监控操作
const result = await monitor.measure('审查员模拟', async () => {
  return await this.simulateReview(officeAction, responseDoc)
})

// 获取统计
const stats = getPerformanceStats('审查员模拟')
console.log(`平均耗时: ${stats.avg}ms`)
console.log(`成功率: ${stats.successRate}%`)

// 打印报告
printPerformanceReport()

// 装饰器使用
@monitorPerformance('审查员模拟')
async simulateReview(oa: OfficeAction, doc: ResponseDocument) {
  // 自动监控性能
}
```

---

## 🔧 完整示例

### 示例1：重构 ExaminerSimulator

```typescript
import {
  LLMAdapter,
  LLMResponse
} from './llm-types.js'
import { ExaminerSimulatorError } from './errors.js'
import { EXAMINER_CONSTANTS } from './constants.js'
import {
  validateOfficeAction,
  validateResponseDocument
} from './validators.js'
import { LLMHelper } from './llm-helper.js'
import { createModuleLogger } from './logger.js'
import { PerformanceMonitor } from './performance-monitor.js'

export class ExaminerSimulator {
  private llm: LLMAdapter
  private logger = createModuleLogger('ExaminerSimulator')
  private perfMonitor = new PerformanceMonitor()

  async simulateReview(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<ExaminerSimulationResult> {
    // 1. 输入验证
    validateOfficeAction(officeAction)
    validateResponseDocument(responseDocument)

    this.logger.info('开始模拟审查', {
      oaType: officeAction.oa_type,
      strategy: responseDocument.responseStrategy
    })

    // 2. 性能监控
    return this.perfMonitor.measure('审查员模拟', async () => {
      // 3. 分析策略有效性
      const strategyAnalysis = await this.analyzeStrategyEffectiveness(
        officeAction,
        responseDocument
      )

      // 4. 评估修改质量
      const amendmentQuality = await this.assessAmendmentQuality(
        officeAction,
        responseDocument
      )

      // 5. 计算接受概率
      const acceptProbability = this.calculateAcceptProbability(
        strategyAnalysis,
        amendmentQuality
      )

      return {
        acceptProbability,
        likelyRejections: [],
        suggestions: [],
        riskAssessment: {
          level: acceptProbability >= 70 ? 'low' : 'medium',
          factors: []
        },
        analysisReport: ''
      }
    })
  }

  private async analyzeStrategyEffectiveness(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<{ effectiveness: number; reasoning: string }> {
    // 使用结构化输出
    const result = await LLMHelper.structuredChat<{
      effectiveness: number
      reasoning: string
    }>(
      this.llm,
      `请评估以下答复策略的有效性...
审查意见类型：${officeAction.oa_type}
审查员论点：${officeAction.examiner_arguments.substring(0, 500)}
答复策略：${responseDocument.responseStrategy}
意见陈述书摘要：${responseDocument.writtenArgument.substring(0, 800)}`,
      {
        effectiveness: { type: 'number', description: '评分 (0-100)' },
        reasoning: { type: 'string', description: '评估理由' }
      },
      {
        retryConfig: {
          maxAttempts: 3,
          onRetry: (attempt, error) => {
            this.logger.warn(`LLM 重试 ${attempt}`, { error: error.message })
          }
        }
      }
    )

    return result
  }

  private calculateAcceptProbability(
    strategyAnalysis: { effectiveness: number },
    amendmentQuality: { quality: number }
  ): number {
    let probability = EXAMINER_CONSTANTS.BASE_ACCEPT_PROBABILITY

    // 策略有效性权重
    probability +=
      strategyAnalysis.effectiveness *
      EXAMINER_CONSTANTS.STRATEGY_EFFECTIVENESS_WEIGHT -
      20

    // 修改质量权重
    probability +=
      amendmentQuality.quality *
      EXAMINER_CONSTANTS.AMENDMENT_QUALITY_WEIGHT -
      15

    return Math.max(
      EXAMINER_CONSTANTS.MIN_ACCEPT_PROBABILITY,
      Math.min(EXAMINER_CONSTANTS.MAX_ACCEPT_PROBABILITY, probability)
    )
  }
}
```

---

### 示例2：创建自定义验证器

```typescript
import { BaseValidator, ValidationResult } from './validators.js'
import { OAResponderError, ErrorCode } from './errors.js'

export class CustomValidator extends BaseValidator {
  constructor() {
    super('CustomValidator')
  }

  validateApplicationNumber(appNumber: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 检查是否为字符串
    if (typeof appNumber !== 'string') {
      errors.push('申请号必须是字符串')
      return { isValid: false, errors, warnings: [] }
    }

    // 检查格式
    const pattern = /^[A-Z]{2}\d{12,13}[A-Z]?$/
    if (!pattern.test(appNumber)) {
      errors.push('申请号格式无效，应为 CN + 12-13位数字 + 可选字母')
      return { isValid: false, errors, warnings: [] }
    }

    // 检查国家代码
    const countryCode = appNumber.substring(0, 2)
    if (countryCode !== 'CN') {
      warnings.push('申请号不是中国申请')
    }

    return { isValid: true, errors: [], warnings }
  }
}

// 使用
const validator = new CustomValidator()
const result = validator.validateApplicationNumber('CN202310123456.7')
if (!result.isValid) {
  throw new OAResponderError(
    `验证失败: ${result.errors.join(', ')}`,
    ErrorCode.INVALID_INPUT
  )
}
```

---

### 示例3：性能预算和告警

```typescript
import {
  PerformanceMonitor,
  PerformanceBudget,
  PerformanceAlertManager
} from './performance-monitor.js'

const monitor = new PerformanceMonitor()
const budget = new PerformanceBudget()
const alerts = new PerformanceAlertManager()

// 设置性能预算
budget.setBudget('审查员模拟', 5000) // 最多5秒
budget.setBudget('成功率预测', 3000) // 最多3秒

// 设置告警阈值
alerts.setThreshold('审查员模拟', 7000) // 超过7秒告警

// 使用监控
await monitor.measure('审查员模拟', async () => {
  // 执行操作
})

// 检查预算
const stats = monitor.getStats('审查员模拟')
if (stats) {
  const withinBudget = budget.checkBudget('审查员模拟', stats.avg)
  if (!withinBudget) {
    console.warn(`性能超预算: ${stats.avg}ms > 5000ms`)
  }

  // 检查告警
  const shouldAlert = alerts.checkAlert('审查员模拟', stats.avg)
  if (shouldAlert) {
    console.error(`性能告警: ${stats.avg}ms 超过阈值 7000ms`)
  }
}
```

---

## 📊 最佳实践

### 1. 类型安全

✅ **推荐**:
```typescript
// 使用严格的类型
const response: LLMResponse = await llm.chat(params)
const content: string = extractResponseContent(response)
```

❌ **避免**:
```typescript
// 使用 any 类型
const response: any = await llm.chat(params)
const content = response.message.content as string
```

---

### 2. 错误处理

✅ **推荐**:
```typescript
// 结构化错误处理
try {
  await this.operation()
} catch (error) {
  if (error instanceof SpecificError) {
    // 处理特定错误
  }
  throw new WrappedError('上下文信息', { cause: error })
}
```

❌ **避免**:
```typescript
// 空catch 块
try {
  await this.operation()
} catch {
  // 静默失败
}
```

---

### 3. 日志记录

✅ **推荐**:
```typescript
// 结构化日志
logger.info('操作完成', {
  operation: 'simulateReview',
  duration: 1234,
  result: 'success'
})
```

❌ **避免**:
```typescript
// 无结构的日志
console.log('操作完成')
```

---

### 4. 性能监控

✅ **推荐**:
```typescript
// 监控所有关键操作
await monitor.measure('操作名称', async () => {
  return await this.operation()
})
```

❌ **避免**:
```typescript
// 不监控性能
const result = await this.operation()
```

---

## 🔗 相关文档

- [代码质量审查报告](../docs/code-quality-review-report.md)
- [快速改进指南](../docs/quick-improvement-guide.md)
- [4周改进进度报告](../docs/4-week-improvement-progress-report.md)
- [增强版审查答复智能体实现总结](../docs/enhanced-oa-responder-implementation.md)

---

## 🆘 获取帮助

### 常见问题

**Q: 如何选择日志级别？**
A: 开发环境使用 `DEBUG`，生产环境使用 `INFO` 或 `WARN`。

**Q: 性能监控会影响性能吗？**
A: 影响很小（<1%），收益远大于开销。

**Q: 缓存会占用多少内存？**
A: 默认限制 1000 条，约 10-20MB。

**Q: 如何处理 LLM 调用失败？**
A: 使用 `LLMHelper.chatWithRetry()` 自动重试。

---

## 📞 联系方式

- **问题反馈**: xujian519@gmail.com
- **功能建议**: GitHub Issues
- **技术支持**: 查看 `/docs` 目录

---

*最后更新: 2026-05-03*
*维护者: Claude + 徐健*
