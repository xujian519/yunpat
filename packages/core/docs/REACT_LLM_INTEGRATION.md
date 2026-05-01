# ReAct 循环 - 真实 LLM 集成指南

## 概述

本指南展示如何将 ReAct 循环与真实的 LLM 和工具链集成，实现端到端的智能推理。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAct 循环                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Observe  │ -> │  Think   │ -> │   Act    │ -> ...      │
│  └──────────┘    └──────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐     ┌─────────┐     ┌─────────────┐
    │  LLM    │     │  LLM    │     │ Tool Registry│
    │ Adapter │     │ Adapter │     │  (工具调用)  │
    └─────────┘     └─────────┘     └─────────────┘
         │                │                │
         └────────────────┴────────────────┘
                        │
                   ┌────▼────┐
                   │真实 LLM  │
                   │DeepSeek │
                   │  Qwen   │
                   └─────────┘
```

## 支持的 LLM

- ✅ **DeepSeek** (推荐) - 支持 V4 思考模式
- ✅ **通义千问** (Qwen) - 阿里云
- ✅ **智谱 GLM** - GLM-4.7
- ✅ **本地 Ollama** - 离线运行

## 内置工具

### 1. 计算器 (calculator)
执行基本数学运算（加减乘除）

```typescript
{
  tool: "calculator",
  params: {
    operation: "add",  // add, subtract, multiply, divide
    a: 123,
    b: 456
  }
}
```

### 2. 文本处理器 (text_processor)
处理文本：大小写转换、反转、字数统计

```typescript
{
  tool: "text_processor",
  params: {
    text: "hello world",
    operation: "uppercase"  // uppercase, lowercase, reverse, wordcount
  }
}
```

### 3. 搜索 (search)
搜索信息并返回相关结果（模拟）

```typescript
{
  tool: "search",
  params: {
    query: "TypeScript",
    limit: 5
  }
}
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 设置环境变量

```bash
# 方式 1: 使用 DeepSeek（推荐）
export DEEPSEEK_API_KEY=sk-xxx

# 方式 2: 使用通义千问
export DASHSCOPE_API_KEY=sk-xxx
```

### 3. 运行演示

```bash
pnpm --filter @yunpat/core exec tsx examples/react-real-llm-demo.ts
```

### 4. 运行测试

```bash
# 基础 ReAct 测试（Mock LLM）
pnpm --filter @yunpat/core exec vitest run test/reasoning/ReActLoop.test.ts

# 集成测试（真实 LLM，需要 API Key）
pnpm --filter @yunpat/core exec vitest run test/reasoning/ReActIntegration.test.ts
```

## 代码示例

### 基础用法

```typescript
import { createDeepSeekModel } from '@yunpat/core';
import { EnhancedToolRegistry } from '@yunpat/core';
import { EnhancedReActLoop } from './react-real-llm-demo.js';

// 1. 创建 LLM 适配器
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);

// 2. 创建工具注册表
const toolRegistry = new EnhancedToolRegistry(eventBus);

// 3. 注册工具
toolRegistry.registerBatch([
  calculatorTool,
  textProcessorTool,
  searchTool,
]);

// 4. 创建 ReAct 循环
const reactLoop = new EnhancedReActLoop(llm, toolRegistry);

// 5. 执行任务
for await (const iteration of reactLoop.execute('计算 123 + 456')) {
  console.log(`[迭代 ${iteration.iteration}]`);
  console.log(`思考: ${iteration.thought.reasoning}`);
  console.log(`行动: ${iteration.action?.type}`);
  console.log(`结果: ${iteration.actionResult?.data}`);

  if (iteration.done) break;
}
```

### 自定义工具

```typescript
import { z } from 'zod';
import type { EnhancedTool } from '@yunpat/core';

const myTool: EnhancedTool<
  { input: string },
  { output: string }
> = {
  metadata: {
    name: 'my_tool',
    description: '我的自定义工具',
    inputSchema: z.object({
      input: z.string(),
    }),
    category: ToolCategory.UTILITY,
  },
  execute: async (input, context) => {
    // 实现你的逻辑
    return {
      output: `处理结果: ${input}`,
    };
  },
};

// 注册工具
toolRegistry.register(myTool);
```

## ReAct 循环工作原理

### 1. Observe（观察）
- 捕获当前状态和上下文
- 记录上一步行动的结果

### 2. Think（思考）
- 分析当前情况
- 查看可用工具列表
- 规划下一步行动
- 选择合适的工具和参数

### 3. Act（行动）
- 调用选定的工具
- 传递参数并执行
- 获取执行结果

### 4. 反思（Reflection）
- 评估行动结果
- 判断任务是否完成
- 决定继续或结束

## 输出示例

```
============================================================
🎯 任务目标: 计算 123 + 456
============================================================

[迭代 1]
──────────────────────────────────────────────────────────
🤔 思考:
  用户需要计算 123 + 456。这是一个简单的加法运算，我应
  该使用计算器工具来完成这个任务...

📊 状态: acting

⚡ 行动: calculator
   参数: {"operation":"add","a":123,"b":456}

✅ 结果:
  工具: calculator
  数据: {"result":579,"steps":["123 + 456 = 579"]}

[迭代 2]
──────────────────────────────────────────────────────────
🤔 思考:
  计算已完成，结果是 579。任务目标已达成...

📊 状态: done

✅ 任务完成！

============================================================
📊 总迭代次数: 2
============================================================
```

## 高级特性

### 1. 多步骤任务

ReAct 循环可以自动分解复杂任务：

```typescript
for await (const iteration of reactLoop.execute(
  '计算 10 × 5，然后将结果字符串反转'
)) {
  // 会自动执行：
  // 1. 计算器：10 × 5 = 50
  // 2. 文本处理器：反转 "50" -> "05"
  // ...
}
```

### 2. 工具链

支持多个工具的组合使用：

```typescript
const tools = [
  calculatorTool,
  textProcessorTool,
  searchTool,
  // 添加更多工具...
];

toolRegistry.registerBatch(tools);
```

### 3. 错误处理

工具调用失败时，ReAct 循环会自动重试或调整策略：

```typescript
// 如果工具调用失败
{
  success: false,
  error: "除数不能为零",
  toolUsed: "calculator"
}

// ReAct 循环会：
// 1. 记录错误
// 2. 重新思考
// 3. 调整参数或选择其他工具
```

## 性能优化

### 1. 并发安全工具

只读工具可以并发执行：

```typescript
const searchTool: EnhancedTool<...> = {
  metadata: {
    // ...
    isConcurrencySafe: true,  // 标记为并发安全
  },
  // ...
};
```

### 2. 中间件管道

工具调用支持中间件：

```typescript
import {
  LoggingMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
} from '@yunpat/core';

// 自动添加的中间件：
// - 日志记录
// - 权限检查
// - 结果缓存
// - 限流保护
```

## 故障排查

### 问题 1: API Key 错误

```
❌ 请设置环境变量：
   export DEEPSEEK_API_KEY=sk-xxx
```

**解决**: 设置正确的 API Key

### 问题 2: 工具调用失败

```
❌ 错误: Tool not found: calculator
```

**解决**: 确保工具已注册到 ToolRegistry

### 问题 3: LLM 响应格式错误

```
❌ 解析思考结果失败
```

**解决**: 检查 LLM 响应是否符合格式要求

## 下一步

- 🔌 集成更多工具（MCP 协议）
- 🛡️ 添加 Guardrails 和安全对齐
- 📊 实现执行追踪和监控
- 🚀 优化提示词和工具选择
- 🧪 添加更多测试用例

## 相关文档

- [推理层架构](../docs/REASONING_LAYER.md)
- [工具开发指南](../docs/TOOL_DEVELOPMENT.md)
- [LLM 适配器](../docs/LLM_ADAPTERS.md)
- [最佳实践](../docs/BEST_PRACTICES.md)
