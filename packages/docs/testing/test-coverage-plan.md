# 测试覆盖补充计划

> 目标：在3天内补充测试覆盖，达到80%测试覆盖率
> 时间：2026-05-03 至 2026-05-06

---

## 📊 测试覆盖目标

| 模块类型 | 当前覆盖率 | 目标覆盖率 | 说明                                 |
| -------- | ---------- | ---------- | ------------------------------------ |
| 基础设施 | 0%         | 85%        | 类型、错误、常量、验证器、日志、性能 |
| 集成模块 | 0%         | 80%        | v2/v3版本的5个模块                   |
| **总计** | **0%**     | **80%**    | **生产级别**                         |

---

## 🎯 测试策略

### 1. 单元测试（60%）

#### 基础设施模块测试

| 模块                   | 测试文件                    | 测试数量 | 优先级 |
| ---------------------- | --------------------------- | -------- | ------ |
| llm-types.ts           | llm-types.test.ts           | 15       | P0     |
| errors.ts              | errors.test.ts              | 20       | P0     |
| constants.ts           | constants.test.ts           | 10       | P1     |
| validators.ts          | validators.test.ts          | 25       | P0     |
| llm-helper.ts          | llm-helper.test.ts          | 30       | P0     |
| logger.ts              | logger.test.ts              | 25       | P0     |
| performance-monitor.ts | performance-monitor.test.ts | 20       | P1     |

#### 集成模块测试

| 模块                               | 测试文件                     | 测试数量 | 优先级 |
| ---------------------------------- | ---------------------------- | -------- | ------ |
| ExaminerSimulator.v2.ts            | examiner-simulator.test.ts   | 35       | P0     |
| SuccessPredictor.v2.ts             | success-predictor.test.ts    | 30       | P0     |
| HebbianOptimizer.v3.ts             | hebbian-optimizer.test.ts    | 40       | P0     |
| EnhancedPatentResponderAgent.v2.ts | enhanced-responder.test.ts   | 25       | P1     |
| InteractiveWorkflow.v2.ts          | interactive-workflow.test.ts | 30       | P1     |

---

### 2. 集成测试（20%）

| 场景       | 测试文件                   | 测试数量 | 说明         |
| ---------- | -------------------------- | -------- | ------------ |
| 端到端流程 | e2e-workflow.test.ts       | 15       | 完整答复流程 |
| 模块协作   | module-integration.test.ts | 20       | 模块间交互   |

---

### 3. 边界情况测试（10%）

| 类别     | 测试场景                          | 数量 |
| -------- | --------------------------------- | ---- |
| 空输入   | null, undefined, 空数组, 空字符串 | 10   |
| 极端值   | 最大值, 最小值, 边界值            | 8    |
| 大数据量 | 10000+条记录, 1MB+字符串          | 7    |
| 并发     | 同时1000个请求                    | 5    |

---

### 4. 错误路径测试（10%）

| 类别        | 测试场景                | 数量 |
| ----------- | ----------------------- | ---- |
| LLM调用失败 | 网络错误, API限流, 超时 | 8    |
| 文件IO错误  | 读写失败, 权限错误      | 6    |
| 内存错误    | 内存不足, 泄漏          | 4    |
| 类型错误    | 错误的类型, 格式        | 10   |

---

## 📝 测试文件结构

```
patents/
├── core/
│   ├── __tests__/
│   │   ├── llm-types.test.ts
│   │   ├── errors.test.ts
│   │   ├── constants.test.ts
│   │   ├── validators.test.ts
│   │   ├── llm-helper.test.ts
│   │   ├── logger.test.ts
│   │   ├── performance-monitor.test.ts
│   │   └── test-utils.ts
│   └── ...
├── agents/
│   └── responder/
│       └── __tests__/
│           ├── examiner-simulator.test.ts
│           ├── success-predictor.test.ts
│           ├── hebbian-optimizer.test.ts
│           ├── enhanced-responder.test.ts
│           └── interactive-workflow.test.ts
└── __tests__/
    ├── e2e/
    │   └── workflow.test.ts
    └── integration/
        └── modules.test.ts
```

---

## 🔧 测试框架配置

### package.json 脚本

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=patents/core/__tests__",
    "test:integration": "jest --testPathPattern=__tests__/integration",
    "test:e2e": "jest --testPathPattern=__tests__/e2e"
  }
}
```

### jest.config.json

```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>"],
  "testMatch": ["**/__tests__/**/*.test.ts"],
  "collectCoverageFrom": [
    "patents/**/*.ts",
    "!**/*.test.ts",
    "!**/types.ts",
    "!**/node_modules/**"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": ["text", "lcov", "html"],
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 75,
      "lines": 75,
      "statements": 75
    }
  }
}
```

---

## 📚 测试示例

### 示例1: 验证器测试

```typescript
import { describe, test, expect } from '@jest/globals'
import { validateOfficeAction, validateResponseDocument } from '../validators.js'

describe('Validator Tests', () => {
  describe('validateOfficeAction', () => {
    test('应该接受有效的 OfficeAction', () => {
      const validOA = {
        oa_type: 'Novelty',
        affected_claims: [1, 2, 3],
        citations: [],
        examiner_arguments: '测试论点',
      }

      expect(() => validateOfficeAction(validOA)).not.toThrow()
    })

    test('应该拒绝空输入', () => {
      expect(() => validateOfficeAction(null as any)).toThrow()
    })

    test('应该拒绝类型错误的输入', () => {
      const invalidOA = {
        oa_type: 'Novelty',
        affected_claims: 'not an array' as any,
        citations: [],
        examiner_arguments: '',
      }

      expect(() => validateOfficeAction(invalidOA as any)).toThrow()
    })
  })
})
```

---

### 示例2: 错误处理测试

```typescript
import { describe, test, expect } from '@jest/globals'
import { OAResponderError, LLMInvokeError } from '../errors.js'

describe('Error Handling Tests', () => {
  test('应该创建带有上下文的错误', () => {
    const error = new OAResponderError('测试错误', { testField: 'testValue' })

    expect(error.message).toBe('测试错误')
    expect(error.name).toBe('OAResponderError')
    expect(error.context).toEqual({ testField: 'testValue' })
  })

  test('应该支持错误链', () => {
    const cause = new Error('原始错误')
    const error = new LLMInvokeError('包装错误', 'ModuleName', 'methodName', { cause })

    expect(error.cause).toBe(cause)
  })
})
```

---

### 示例3: 性能监控测试

```typescript
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { PerformanceMonitor } from '../performance-monitor.js'

describe('PerformanceMonitor Tests', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  afterEach(() => {
    monitor.clear()
  })

  test('应该准确测量操作时间', async () => {
    const result = await monitor.measure('test-operation', async () => {
      await delay(100)
      return 'done'
    })

    expect(result).toBe('done')

    const stats = monitor.getStats('test-operation')
    expect(stats?.count).toBe(1)
    expect(stats?.avg).toBeGreaterThanOrEqual(100)
  })

  test('应该处理测量中的错误', async () => {
    await expect(
      monitor.measure('failing-operation', async () => {
        throw new Error('测试错误')
      })
    ).rejects.toThrow('测试错误')

    const stats = monitor.getStats('failing-operation')
    expect(stats?.failureCount).toBe(1)
  })
})
```

---

### 示例4: LLM Helper测试

```typescript
import { describe, test, expect, jest } from '@jest/globals'
import { LLMHelper } from '../llm-helper.js'

describe('LLMHelper Tests', () => {
  describe('structuredChat', () => {
    test('应该解析结构化输出', async () => {
      const mockLLM = {
        chat: jest.fn().mockResolvedValue({
          message: {
            role: 'assistant',
            content: JSON.stringify({ score: 85, reasoning: '测试理由' }),
          },
        }),
      }

      const result = await LLMHelper.structuredChat(mockLLM as any, '请评估...', {
        score: { type: 'number', description: '评分' },
        reasoning: { type: 'string', description: '理由' },
      })

      expect(result.score).toBe(85)
      expect(result.reasoning).toBe('测试理由')
    })

    test('应该在JSON解析失败时重试', async () => {
      const mockLLM = {
        chat: jest
          .fn()
          .mockResolvedValueOnce({
            message: {
              role: 'assistant',
              content: 'invalid json',
            },
          })
          .mockResolvedValueOnce({
            message: {
              role: 'assistant',
              content: JSON.stringify({ score: 75 }),
            },
          }),
      }

      const result = await LLMHelper.structuredChat(
        mockLLM as any,
        '请评估...',
        {
          score: { type: 'number', description: '评分' },
        },
        {
          retryConfig: { maxAttempts: 2 },
        }
      )

      expect(result.score).toBe(75)
      expect(mockLLM.chat).toHaveBeenCalledTimes(2)
    })
  })

  describe('chatWithRetry', () => {
    test('应该在失败时重试', async () => {
      const mockLLM = {
        chat: jest
          .fn()
          .mockRejectedValueOnce(new Error('网络错误'))
          .mockResolvedValueOnce({
            message: {
              role: 'assistant',
              content: '成功',
            },
          }),
      }

      const result = await LLMHelper.chatWithRetry(
        mockLLM as any,
        { messages: [] },
        { maxAttempts: 3 }
      )

      expect(result.message.content).toBe('成功')
      expect(mockLLM.chat).toHaveBeenCalledTimes(2)
    })

    test('应该在所有重试失败后抛出错误', async () => {
      const mockLLM = {
        chat: jest.fn().mockRejectedValue(new Error('永久错误')),
      }

      await expect(
        LLMHelper.chatWithRetry(mockLLM as any, { messages: [] }, { maxAttempts: 3 })
      ).rejects.toThrow('永久错误')

      expect(mockLLM.chat).toHaveBeenCalledTimes(3)
    })
  })
})
```

---

### 示例5: 边界情况测试

```typescript
import { describe, test, expect } from '@jest/globals'
import { validateOfficeAction } from '../validators.js'

describe('Boundary Condition Tests', () => {
  test('应该处理非常大的数组', () => {
    const largeOA = {
      oa_type: 'Novelty',
      affected_claims: Array.from({ length: 100000 }, (_, i) => i + 1),
      citations: [],
      examiner_arguments: 'A'.repeat(10000000),
    }

    expect(() => validateOfficeAction(largeOA)).not.toThrow()
  })

  test('应该处理极长的字符串', () => {
    const longString = 'A'.repeat(10 * 1024 * 1024) // 10MB

    const doc = {
      writtenArgument: longString,
      amendedClaims: ['权利要求1'],
      amendmentComparison: longString,
      responseStrategy: 'Hybrid',
    }

    expect(() => validateResponseDocument(doc)).not.toThrow()
  })

  test('应该处理极端数值', () => {
    expect(validateScore(Number.MAX_SAFE_INTEGER, 0, 100)).toBeLessThanOrEqual(100)
    expect(validateScore(Number.MIN_SAFE_INTEGER, 0, 100)).toBeGreaterThanOrEqual(0)
  })
})
```

---

### 示例6: 并发测试

```typescript
import { describe, test, expect } from '@jest/globals'
import { PerformanceMonitor } from '../performance-monitor.js'

describe('Concurrency Tests', () => {
  test('应该支持并发测量操作', async () => {
    const monitor = new PerformanceMonitor()
    const concurrentOperations = 100

    const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
      return monitor.measure(`operation-${i}`, async () => {
        await delay(Math.random() * 10)
        return i
      })
    })

    const results = await Promise.all(promises)

    expect(results).toHaveLength(concurrentOperations)
    expect(monitor.getAllStats()).toHaveProperty('operation-0')
  })

  test('应该在高并发下保持性能', async () => {
    const monitor = new PerformanceMonitor()
    const startTime = Date.now()

    const promises = Array.from({ length: 1000 }, async (_, i) => {
      return monitor.measure(`op-${i}`, async () => {
        await delay(1)
        return i
      })
    })

    await Promise.all(promises)

    const elapsed = Date.now() - startTime
    expect(elapsed).toBeLessThan(5000) // 应该在5秒内完成
  })
})
```

---

## 🎯 测试执行计划

### Day 1: 基础设施测试（8小时）

- [ ] 上午: llm-types, errors, constants (45个测试)
- [ ] 下午: validators, llm-helper (55个测试)
- [ ] 晚上: logger, performance-monitor (45个测试)

### Day 2: 集成模块测试（8小时）

- [ ] 上午: ExaminerSimulator, SuccessPredictor (65个测试)
- [ ] 下午: HebbianOptimizer, EnhancedResponder (65个测试)
- [ ] 晚上: InteractiveWorkflow (30个测试)

### Day 3: 集成和边界测试（8小时）

- [ ] 上午: 集成测试 (35个测试)
- [ ] 下午: 边界情况测试 (30个测试)
- [ ] 晚上: 错误路径测试 (28个测试)
- [ ] 生成覆盖率报告

---

## 📊 覆盖率报告模板

```bash
Test Suites: 15 passed, 15 total
Tests:       300 passed, 300 total
Snapshots:   0 total
Time:        45.231 s

Coverage Summary
----------------------
File                                        | Branches | Funcs | Lines | Statements |
-------------------------------------------|----------|-------|-------|------------|
patents/core/                            |   85.23  | 92.45|  88.34|    90.12   |
  llm-types.ts                           |   90.12  | 95.23|  93.45|    95.23   |
  errors.ts                              |   88.45  | 91.23|  89.67|    92.34   |
  constants.ts                           |  100.00 | 100.0|  100.0 |    100.0   |
  validators.ts                           |   92.34  | 94.56|  93.21|    94.56   |
  llm-helper.ts                          |   86.78  | 93.45|  91.23|    92.78   |
  logger.ts                              |   84.56  | 90.12|  87.89|    89.45   |
  performance-monitor.ts                  |   87.89  | 92.34|  90.12|    91.23   |
patents/agents/responder/              |         |       |       |            |
  ExaminerSimulator.v2.ts                |   78.34  | 85.67|  82.45|    84.56   |
  SuccessPredictor.v2.ts                 |   76.45  | 83.23|  80.12|    82.34   |
  HebbianOptimizer.v3.ts                 |   82.34  | 88.45|  85.67|    86.78   |
  EnhancedPatentResponderAgent.v2.ts    |   74.56  | 81.23|  77.89|    79.45   |
  InteractiveWorkflow.v2.ts              |   75.67  | 82.45|  78.90|    80.12   |
-------------------------------------------|----------|-------|-------|------------|
All files                                |   82.45  | 88.67|  85.23|    87.34   |
```

---

## 🔧 测试最佳实践

### 1. 测试命名

✅ 好的命名:

```typescript
test('应该返回正确的验证错误消息', () => {})
test('应该在LLM调用失败时重试', () => {})
test('应该处理并发的性能监控请求', () => {})
```

❌ 不好的命名:

```typescript
test('test1', () => {})
test('验证测试', () => {})
test('检查功能', () => {})
```

---

### 2. 测试隔离

```typescript
describe('模块测试', () => {
  let instance: MyClass

  beforeEach(() => {
    instance = new MyClass()
  })

  afterEach(() => {
    instance.destroy()
  })

  test('测试1', () => {
    // 使用instance
  })

  test('测试2', () => {
    // 使用新的instance实例
  })
})
```

---

### 3. Mock 使用

```typescript
// Mock LLM 适配器
const mockLLM = {
  chat: jest.fn().mockResolvedValue({
    message: { role: 'assistant', content: '响应' },
  }),
}

// Mock 文件系统
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('file content'),
  writeFileSync: jest.fn(),
}))
```

---

### 4. 异步测试

```typescript
test('异步操作应该正确处理', async () => {
  const result = await asyncOperation()
  expect(result).toBe('expected')
})

test('应该处理异步错误', async () => {
  await expect(asyncOperation()).rejects.toThrow('Error')
})
```

---

## 📋 检查清单

### 测试完整性

- [ ] 所有公共API都有测试
- [ ] 所有错误路径都有测试
- [ ] 所有边界条件都有测试
- [ ] 关键性能路径有测试
- [ ] 并发安全有测试

### 测试质量

- [ ] 测试名称清晰描述
- [ ] 测试独立可重复
- [ ] 使用适当的断言
- [ ] 有必要的setup/teardown
- [ ] Mock使用合理

### 性能测试

- [ ] 性能基准已建立
- [ ] 性能回归测试
- [ ] 压力测试通过
- [ ] 内存泄漏测试

---

## 🚀 执行测试

```bash
# 安装依赖
pnpm install -D jest ts-jest @types/jest

# 运行所有测试
pnpm test

# 运行特定测试
pnpm test -- validators.test.ts

# 监视模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage

# 查看覆盖率报告
open coverage/index.html
```

---

_文档生成时间: 2026-05-03_
_预计完成时间: 2026-05-06（3天）_
