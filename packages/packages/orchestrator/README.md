# @yunpat/orchestrator

YunPat 中枢层智能调度系统 -- 意图识别、任务规划、路由分发、异常降级

## 简介

`@yunpat/orchestrator` 是 YunPat 系统的中枢层，负责将用户输入调度到合适的专业 Agent。它实现了完整的 5 次 LLM 调用流程：意图识别 -> 任务规划 -> HITL 生成 -> 结果聚合 -> 异常降级。

### 核心特性

- **意图识别** -- 通过 LLM 分析用户输入，识别操作意图和关键参数
- **任务规划** -- 根据意图生成子任务列表，确定执行顺序
- **智能路由** -- Agent 注册表 + 工厂模式，自动路由到匹配的专业 Agent
- **人机协同 (HITL)** -- 在关键决策点生成确认请求，支持审批和反馈
- **结果聚合** -- 汇总多个 Agent 的执行结果，生成统一输出
- **异常降级** -- 捕获执行异常，提供降级策略和错误恢复
- **性能监控** -- 记录各阶段耗时和 LLM 调用次数

---

## 项目结构

```
packages/orchestrator/src/
  OrchestratorAgent.ts      # 中枢 Agent 主类（5 次 LLM 调用编排）
  index.ts                  # 模块导出
  intent/
    IntentRecognizer.ts     # 意图识别（Call 1）
  planning/
    TaskPlanner.ts          # 任务规划（Call 2）
  hitl/
    HITLGenerator.ts        # HITL 确认生成（Call 3）
    HITLManager.ts          # HITL 交互管理
  aggregation/
    ResultAggregator.ts     # 结果聚合（Call 4）
  exception/
    ExceptionHandler.ts     # 异常降级（Call 5）
  executor/
    TaskExecutor.ts         # 任务执行器
  router/
    Router.ts               # 智能路由决策
  registry/
    AgentRegistry.ts        # Agent 注册表
    AgentFactory.ts         # Agent 工厂
    agentManifest.ts        # Agent 清单配置
  context/
    ContextManager.ts       # 上下文管理
  llm/
    LLMClient.ts            # LLM 客户端封装
  types/
    index.ts                # 类型定义
```

---

## 快速开始

### 安装

```bash
pnpm add @yunpat/orchestrator
```

### 基础使用

```typescript
import { OrchestratorAgent } from '@yunpat/orchestrator'
import { NativeLLMAdapter, EventBus } from '@yunpat/core'

const llm = new NativeLLMAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
})

const orchestrator = new OrchestratorAgent({
  name: 'yunpat-orchestrator',
  llmClient: {
    generate: (prompt) => llm.generate({ messages: [{ role: 'user', content: prompt }] }),
  },
  eventBus: new EventBus(),
})

// 执行用户请求
const result = await orchestrator.execute({
  input: '请帮我撰写一个关于深度学习的图像识别方法的专利',
  context: { userId: 'user-1' },
})

console.log(result.intent) // 识别的意图
console.log(result.plan) // 生成的任务计划
console.log(result.output) // 最终输出
console.log(result.metrics) // 性能指标
```

---

## 执行流程

OrchestratorAgent 的核心是 5 次 LLM 调用流程：

```
用户输入
  |
  v
[Call 1] 意图识别 (IntentRecognizer)
  |  分析用户输入，提取意图和参数
  v
[Call 2] 任务规划 (TaskPlanner)
  |  生成子任务列表和执行顺序
  v
[Call 3] HITL 生成 (HITLGenerator)
  |  在关键节点生成确认请求
  v
[任务执行] TaskExecutor + Router
  |  路由到专业 Agent 并执行
  v
[Call 4] 结果聚合 (ResultAggregator)
  |  汇总各 Agent 结果
  v
[Call 5] 异常降级 (ExceptionHandler)
  |  处理异常、提供降级方案
  v
最终输出
```

### 性能指标

每次执行都会收集以下指标：

| 指标                        | 说明               |
| --------------------------- | ------------------ |
| `totalDuration`             | 总执行时间（毫秒） |
| `intentRecognitionDuration` | 意图识别耗时       |
| `taskPlanningDuration`      | 任务规划耗时       |
| `taskExecutionDuration`     | 任务执行耗时       |
| `hitlGenerationDuration`    | HITL 生成耗时      |
| `resultAggregationDuration` | 结果聚合耗时       |
| `llmCallsCount`             | LLM 调用次数       |

---

## 模块详解

### IntentRecognizer（意图识别）

将用户自然语言输入解析为结构化意图。

### TaskPlanner（任务规划）

根据意图生成可执行的任务计划，确定依赖关系和执行顺序。

### Router（路由）

通过 AgentRegistry 查找匹配的 Agent，由 AgentFactory 创建实例。

### HITLManager（人机协同）

在关键决策点暂停执行，向用户请求确认或反馈。

### ResultAggregator（结果聚合）

汇总多个子任务的执行结果，生成统一的输出格式。

### ExceptionHandler（异常降级）

捕获执行过程中的异常，提供降级策略和错误恢复机制。

---

## 导出

```typescript
export {
  OrchestratorAgent, // 中枢 Agent 主类
  ContextManager, // 上下文管理
  IntentRecognizer, // 意图识别
  TaskPlanner, // 任务规划
  HITLGenerator, // HITL 确认生成
  ResultAggregator, // 结果聚合
  ExceptionHandler, // 异常降级
}
// 以及所有类型定义
```

---

## 许可证

MIT

---

最后更新: 2026-05-06
