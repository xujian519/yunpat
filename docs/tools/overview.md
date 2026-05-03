# YunPat 工具系统

## 概述

YunPat 工具系统是一个现代化、可扩展、类型安全的工具执行框架，采用**中间件管道**和**智能并发**设计。

## 核心特性

### 1. 类型安全

- 使用 **Zod Schema** 进行运行时类型验证
- 自动参数校验和类型推导
- 清晰的错误提示

### 2. 中间件系统

- **日志中间件** - 记录工具调用
- **权限中间件** - 控制工具访问
- **缓存中间件** - 缓存只读工具结果
- **限流中间件** - 防止工具滥用
- **追踪中间件** - 收集执行统计

### 3. 智能并发

- 自动识别只读工具
- 只读工具并发执行，写工具串行执行
- 显著提升批量操作性能

### 4. 工具分类

- `FILE` - 文件操作
- `SEARCH` - 搜索
- `CODE` - 代码执行
- `NETWORK` - 网络请求
- `DATABASE` - 数据库
- `PATENT` - 专利相关
- `ANALYSIS` - 数据分析
- `UTILITY` - 通用工具

## 快速开始

### 基础用法

```typescript
import { EnhancedToolRegistry, ToolCategory } from '@yunpat/core'
import { FileReadTool, FileWriteTool } from '@yunpat/builtin-tools'

// 创建工具注册表
const eventBus = new EventBus()
const registry = new EnhancedToolRegistry(eventBus)

// 注册工具
registry.register(new FileReadTool())
registry.register(new FileWriteTool())

// 创建工具上下文
const context: ToolContext = {
  registry,
  llm: yourLLMAdapter,
  memory: yourMemoryStore,
  eventBus,
  userId: 'user-123',
  sessionId: 'session-456',
}

// 调用工具
const result = await registry.call(
  'file_write',
  { filePath: './test.txt', content: 'Hello, YunPat!' },
  context
)

console.log(result) // { success: true, bytesWritten: 16 }
```

### 批量调用（智能并发）

```typescript
// 批量调用工具（只读工具会并发执行）
const results = await registry.callBatch(
  [
    { name: 'file_read', input: { filePath: './file1.txt' } },
    { name: 'file_read', input: { filePath: './file2.txt' } },
    { name: 'file_read', input: { filePath: './file3.txt' } },
  ],
  context
)

// 所有文件读取操作会并发执行，显著提升性能
```

### 按分类获取工具

```typescript
// 获取所有文件工具
const fileTools = registry.getByCategory(ToolCategory.FILE)

// 获取所有专利工具
const patentTools = registry.getByCategory(ToolCategory.PATENT)
```

## 内置工具

### 文件工具

| 工具名称         | 功能描述     | 并发安全 |
| ---------------- | ------------ | -------- |
| `file_read`      | 读取文件内容 | ✅       |
| `file_write`     | 写入文件内容 | ❌       |
| `file_append`    | 追加文件内容 | ❌       |
| `file_delete`    | 删除文件     | ❌       |
| `directory_list` | 列出目录内容 | ✅       |

### 搜索工具

| 工具名称 | 功能描述               | 并发安全 |
| -------- | ---------------------- | -------- |
| `grep`   | 在文件中搜索文本       | ✅       |
| `glob`   | 使用 glob 模式查找文件 | ✅       |

### 网络工具

| 工具名称     | 功能描述       | 并发安全 |
| ------------ | -------------- | -------- |
| `web_fetch`  | 发送 HTTP 请求 | ✅       |
| `web_search` | 搜索引擎搜索   | ✅       |

### 专利工具

| 工具名称           | 功能描述         | 并发安全 |
| ------------------ | ---------------- | -------- |
| `generate_claims`  | 生成专利权利要求 | ✅       |
| `extract_features` | 提取技术特征     | ✅       |

## 自定义工具

### 使用 BaseTool

```typescript
import { EnhancedBaseTool, ToolCategory } from '@yunpat/core'
import { z } from 'zod'

class MyTool extends EnhancedBaseTool<{ input: string }, { output: string }> {
  readonly metadata = {
    name: 'my_tool',
    description: '我的自定义工具',
    category: ToolCategory.UTILITY,
    isConcurrencySafe: true,
    inputSchema: z.object({
      input: z.string().describe('输入参数'),
    }),
    outputSchema: z.object({
      output: z.string().describe('输出结果'),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'Your Name',
  }

  async execute(input: { input: string }, context: ToolContext): Promise<{ output: string }> {
    // 工具执行逻辑
    return { output: `Processed: ${input.input}` }
  }
}

// 注册工具
registry.register(new MyTool())
```

### 使用 ToolWrapper

```typescript
import { ToolWrapper } from '@yunpat/core'

const quickTool = new ToolWrapper(
  {
    name: 'quick_tool',
    description: '快速创建的工具',
    category: ToolCategory.UTILITY,
    isConcurrencySafe: true,
    inputSchema: z.object({
      value: z.number(),
    }),
    outputSchema: z.object({
      doubled: z.number(),
    }),
  },
  async (input, context) => {
    return { doubled: input.value * 2 }
  }
)

registry.register(quickTool)
```

## 中间件

### 内置中间件

```typescript
import {
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from '@yunpat/core'

// 添加自定义中间件
registry.addMiddleware(new LoggingMiddleware())

// 移除中间件
registry.removeMiddleware('logging')

// 获取中间件管道
const pipeline = registry.getMiddleware()
```

### 自定义中间件

```typescript
import { Middleware } from '@yunpat/core'

class CustomMiddleware implements Middleware {
  name = 'custom'

  async before(ctx: ToolExecutionContext): Promise<void> {
    console.log(`Before calling ${ctx.tool.metadata.name}`)
  }

  async after(ctx: ToolExecutionContext, result: any): Promise<void> {
    console.log(`After calling ${ctx.tool.metadata.name}`)
  }

  async onError(ctx: ToolExecutionContext, error: Error): Promise<void> {
    console.error(`Error in ${ctx.tool.metadata.name}:`, error)
  }
}

registry.addMiddleware(new CustomMiddleware())
```

## 工具执行统计

```typescript
// 获取所有工具的统计信息
const stats = registry.getStats()

stats.forEach((stat) => {
  console.log(`工具: ${stat.toolName}`)
  console.log(`  总调用次数: ${stat.totalCalls}`)
  console.log(`  成功率: ${((stat.successCount / stat.totalCalls) * 100).toFixed(2)}%`)
  console.log(`  平均执行时间: ${stat.avgDuration.toFixed(2)}ms`)
})

// 获取特定工具的统计
const toolStats = registry.getToolStats('file_read')
```

## 专利工具使用示例

```typescript
import { ClaimsGeneratorTool } from '@yunpat/patent-tools'

// 注册专利工具
registry.register(new ClaimsGeneratorTool())

// 生成权利要求
const claims = await registry.call(
  'generate_claims',
  {
    inventionType: 'device',
    coreFeatures: [
      { text: '包括图像采集模块', isEssential: true },
      { text: '包括特征提取模块', isEssential: true },
      { text: '采用卷积神经网络', isEssential: false },
    ],
    preamble: '一种图像识别装置',
    transitionWord: '其特征在于，包括：',
  },
  context
)

console.log('生成的权利要求:')
claims.forEach((claim) => {
  console.log(`${claim.claimNumber}. ${claim.text}`)
})
```

## 最佳实践

### 1. 工具设计原则

- **单一职责** - 每个工具只做一件事
- **幂等性** - 只读工具应该是幂等的
- **错误处理** - 提供清晰的错误信息
- **类型安全** - 始终使用 Zod Schema 验证

### 2. 性能优化

- 使用 `isConcurrencySafe: true` 标记只读工具
- 利用批量调用提升性能
- 启用缓存中间件减少重复计算

### 3. 安全性

- 使用权限中间件控制工具访问
- 敏感操作需要显式权限
- 日志中间件记录所有操作

## 参考

- [Claude Code 工具系统](https://github.com/anthropics/claude-code)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [Zod 文档](https://zod.dev/)
