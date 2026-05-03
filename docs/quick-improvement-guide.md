# 代码质量快速改进指南

> 基于 2026-05-03 的代码审查报告
> 目标：在 4 周内将代码质量提升到生产级别

---

## 🚀 快速修复清单

### 第1天：修复最严重的问题

#### 1. 类型安全修复 ⏱️ 2小时

```typescript
// ❌ 删除所有 `as any` 断言
// ✅ 添加严格的类型定义

// 1. 在 patents/core/llm-types.ts 中添加：
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  message: LLMMessage
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

// 2. 在所有文件中使用：
const response = await this.llm.chat({...})
const content = response.message.content // 不再需要 `as string`
```

#### 2. 错误处理修复 ⏱️ 1小时

```typescript
// ❌ 删除所有空 catch 块
// ✅ 添加适当的错误处理

// 创建 patents/core/errors.ts
export class OAResponderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'OAResponderError'
  }
}

// 在每个 catch 块中使用：
try {
  // ...
} catch (error) {
  console.error('[模块名] 操作失败:', error)
  throw new OAResponderError('详细描述', 'ERROR_CODE', { context })
}
```

---

### 第2天：提取魔法值 ⏱️ 3小时

```typescript
// 创建 patents/core/constants.ts

// LLM 相关
export const LLM_CONSTANTS = {
  DEFAULT_EFFECTIVENESS_SCORE: 70,
  DEFAULT_QUALITY_SCORE: 75,
  MAX_PROMPT_LENGTH: 8000,
  TEMPERATURE: 0.3,
} as const

// 审查员模拟器
export const EXAMINER_CONSTANTS = {
  BASE_ACCEPT_PROBABILITY: 50,
  STRATEGY_EFFECTIVENESS_WEIGHT: 0.4,
  AMENDMENT_QUALITY_WEIGHT: 0.3,
  REJECTION_PENALTY_WEIGHT: 0.3,
} as const

// 成功率预测器
export const PREDICTOR_CONSTANTS = {
  BASELINE_SUCCESS_RATES: {
    'Novelty': 45,
    'InventiveStep': 35,
    'Clarity': 65,
    'Support': 55,
    'Formality': 85,
  },
  RULE_WEIGHT: 0.3,
  CASE_WEIGHT: 0.4,
  LLM_WEIGHT: 0.3,
} as const

// 在代码中使用：
import { EXAMINER_CONSTANTS } from '../../core/constants.js'

probability += strategyAnalysis.effectiveness * EXAMINER_CONSTANTS.STRATEGY_EFFECTIVENESS_WEIGHT - 20
```

---

### 第3天：实现结构化 LLM 输出 ⏱️ 4小时

```typescript
// 创建 patents/core/llm-helper.ts

export class LLMHelper {
  /**
   * 使用结构化输出调用 LLM
   */
  static async structuredChat<T>(
    llm: LLMAdapter,
    prompt: string,
    schema: Record<string, { type: string; description: string }>,
    options?: { temperature?: number }
  ): Promise<T> {
    const systemPrompt = `请以 JSON 格式返回结果。

必须包含以下字段：
${Object.entries(schema).map(([key, val]) => `- ${key}: ${val.description} (${val.type})`).join('\n')}

只返回 JSON，不要包含其他内容。`

    const response = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature ?? 0.3,
    })

    // 解析 JSON
    const content = response.message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM 未返回有效的 JSON')
    }

    return JSON.parse(jsonMatch[0]) as T
  }

  /**
   * 带重试的 LLM 调用
   */
  static async chatWithRetry<T>(
    llm: LLMAdapter,
    messages: Array<{ role: string; content: string }>,
    maxAttempts: number = 3
  ): Promise<T> {
    let lastError: Error
    let delay = 1000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await llm.chat({ messages }) as T
      } catch (error) {
        lastError = error as Error
        if (attempt < maxAttempts) {
          console.warn(`LLM 调用失败，${delay}ms 后重试 (${attempt}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= 2
        }
      }
    }

    throw lastError!
  }
}

// 使用示例：
import { LLMHelper } from '../../core/llm-helper.js'

const result = await LLMHelper.structuredChat(
  this.llm,
  '请评估答复策略的有效性...',
  {
    effectiveness: { type: 'number', description: '评分 (0-100)' },
    reasoning: { type: 'string', description: '评估理由' }
  }
)
```

---

### 第4天：添加输入验证 ⏱️ 2小时

```typescript
// 创建 patents/core/validators.ts

export class Validators {
  /**
   * 验证 OfficeAction
   */
  static validateOfficeAction(officeAction: any): void {
    if (!officeAction) {
      throw new OAResponderError('OfficeAction 不能为空', 'INVALID_INPUT')
    }

    if (!officeAction.oa_type || typeof officeAction.oa_type !== 'string') {
      throw new OAResponderError('oa_type 必须是非空字符串', 'INVALID_INPUT')
    }

    if (!Array.isArray(officeAction.affected_claims)) {
      throw new OAResponderError('affected_claims 必须是数组', 'INVALID_INPUT')
    }

    if (!Array.isArray(officeAction.citations)) {
      throw new OAResponderError('citations 必须是数组', 'INVALID_INPUT')
    }
  }

  /**
   * 验证 ResponseDocument
   */
  static validateResponseDocument(doc: any): void {
    if (!doc) {
      throw new OAResponderError('ResponseDocument 不能为空', 'INVALID_INPUT')
    }

    if (!doc.writtenArgument || typeof doc.writtenArgument !== 'string') {
      throw new OAResponderError('writtenArgument 必须是非空字符串', 'INVALID_INPUT')
    }

    if (!Array.isArray(doc.amendedClaims)) {
      throw new OAResponderError('amendedClaims 必须是数组', 'INVALID_INPUT')
    }
  }

  /**
   * 验证分数范围
   */
  static validateScore(score: number, min: number = 0, max: number = 100): void {
    if (typeof score !== 'number' || isNaN(score)) {
      throw new OAResponderError('分数必须是数字', 'INVALID_INPUT')
    }

    if (score < min || score > max) {
      throw new OAResponderError(`分数必须在 ${min} 到 ${max} 之间`, 'INVALID_INPUT')
    }
  }
}

// 在每个方法开头使用：
import { Validators } from '../../core/validators.js'

async simulateReview(officeAction: OfficeAction, responseDocument: ResponseDocument) {
  Validators.validateOfficeAction(officeAction)
  Validators.validateResponseDocument(responseDocument)

  // 继续执行...
}
```

---

## 📋 每周改进任务

### 第1周：基础修复 (5天)

- [ ] **Day 1**: 修复类型安全问题
  - [ ] 创建 LLM 类型定义
  - [ ] 移除所有 `as any` 断言
  - [ ] 添加类型守卫

- [ ] **Day 2**: 改进错误处理
  - [ ] 创建错误类层次
  - [ ] 移除空 catch 块
  - [ ] 添加错误日志

- [ ] **Day 3**: 提取魔法值
  - [ ] 创建常量文件
  - [ ] 替换硬编码值
  - [ ] 更新文档

- [ ] **Day 4**: 实现结构化 LLM 输出
  - [ ] 创建 LLM 辅助类
  - [ ] 实现重试机制
  - [ ] 更新所有 LLM 调用

- [ ] **Day 5**: 添加输入验证
  - [ ] 创建验证器类
  - [ ] 在所有方法中添加验证
  - [ ] 编写验证测试

---

### 第2周：可靠性提升 (5天)

- [ ] **Day 6**: 实现日志系统
  ```typescript
  // patents/core/logger.ts
  export class Logger {
    static info(message: string, meta?: any) { ... }
    static warn(message: string, meta?: any) { ... }
    static error(message: string, error?: Error, meta?: any) { ... }
  }
  ```

- [ ] **Day 7**: 实现性能监控
  ```typescript
  // patents/core/performance.ts
  export class PerformanceMonitor {
    async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> { ... }
    getStats(operation: string) { ... }
  }
  ```

- [ ] **Day 8**: 添加配置验证
  ```typescript
  // patents/core/config-validator.ts
  export function validateConfig<T>(config: T, schema: Schema): void { ... }
  ```

- [ ] **Day 9**: 实现数据持久化
  ```typescript
  // patents/core/storage.ts
  export class CaseStorage {
    async save(case: LearningCase): Promise<void> { ... }
    async load(caseId: string): Promise<LearningCase | null> { ... }
  }
  ```

- [ ] **Day 10**: 编写集成测试
  ```typescript
  // test/integration/oar-responder.integration.test.ts
  describe('完整工作流集成测试', () => {
    it('应该执行完整的答复流程', async () => { ... })
  })
  ```

---

### 第3周：性能优化 (5天)

- [ ] **Day 11**: 优化赫布学习算法
  - [ ] 添加特征激活缓存
  - [ ] 优化突触权重计算
  - [ ] 批量处理策略激活

- [ ] **Day 12**: 防止内存泄漏
  - [ ] 实现案例容量限制
  - [ ] 添加数据清理逻辑
  - [ ] 实现持久化存储

- [ ] **Day 13**: 优化 LLM 调用
  - [ ] 实现请求批处理
  - [ ] 添加响应缓存
  - [ ] 优化提示词长度

- [ ] **Day 14**: 添加并发控制
  ```typescript
  // patents/utils/concurrency.ts
  export class ConcurrencyControl {
    private semaphore = new Semaphore(maxConcurrent)

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return this.semaphore.use(fn)
    }
  }
  ```

- [ ] **Day 15**: 性能基准测试
  ```typescript
  // test/performance/benchmark.test.ts
  describe('性能基准测试', () => {
    it('审查员模拟应在 5s 内完成', async () => { ... })
    it('批量处理 10 个方案应在 20s 内完成', async () => { ... })
  })
  ```

---

### 第4周：测试和文档 (5天)

- [ ] **Day 16**: 补充单元测试
  - [ ] 边界情况测试
  - [ ] 错误路径测试
  - [ ] 目标：80% 覆盖率

- [ ] **Day 17**: 补充集成测试
  - [ ] 端到端工作流测试
  - [ ] 多模块协作测试
  - [ ] 真实场景测试

- [ ] **Day 18**: 编写使用文档
  - [ ] 快速开始指南
  - [ ] API 文档
  - [ ] 配置说明

- [ ] **Day 19**: 编写示例代码
  - [ ] 基础用法示例
  - [ ] 高级用法示例
  - [ ] 最佳实践

- [ ] **Day 20**: 最终审查和发布
  - [ ] 代码审查
  - [ ] 性能测试
  - [ ] 文档完善
  - [ ] 发布准备

---

## 🎯 成功标准

### 代码质量指标

- [ ] 类型安全：95%+ （当前 75%）
- [ ] 测试覆盖率：80%+ （当前 60%）
- [ ] 圈复杂度：平均 < 4
- [ ] 代码重复率：< 5%

### 功能完整性

- [ ] 所有高优先级问题已修复
- [ ] 所有中优先级问题已评估
- [ ] 新增功能有完整测试

### 性能指标

- [ ] 审查员模拟：< 5s
- [ ] 成功率预测：< 3s
- [ ] 完整工作流：< 30s
- [ ] 内存使用：< 200MB (单次)

### 文档完整性

- [ ] 所有公共 API 有文档
- [ ] 所有配置项有说明
- [ ] 有使用示例
- [ ] 有故障排查指南

---

## 📊 进度跟踪

### 每日检查清单

- [ ] 代码编译无错误
- [ ] 所有测试通过
- [ ] 无新增 ESLint 警告
- [ ] 代码已提交到 Git
- [ ] 更新了相关文档

### 每周审查

- [ ] 回顾本周完成的任务
- [ ] 评估代码质量指标
- [ ] 调整下周计划
- [ ] 更新进度报告

---

## 🆘 遇到问题？

### 常见问题

**Q: 类型错误太多，不知道如何修复？**
A: 先使用 `@ts-ignore` 暂时跳过，记录下来，集中处理

**Q: 测试编写困难？**
A: 先编写简单的快乐路径测试，再逐步添加边界测试

**Q: 性能优化效果不明显？**
A: 使用性能分析工具（profiler）找到真正的瓶颈

**Q: 时间不够用？**
A: 优先修复高优先级问题，其他可以延后

---

## 📞 支持资源

- **代码审查**: 每周五下午 3:00
- **技术讨论**: Slack #dev-频道
- **文档**: /docs/code-quality-review-report.md
- **示例**: /examples/enhanced-oa-responder-example.ts

---

*最后更新: 2026-05-03*
*维护者: Claude + 徐健*
