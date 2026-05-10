# @yunpat/core

YunPat 核心框架 -- 专利智能体系统的底层基础设施

## 简介

`@yunpat/core` 是 YunPat 项目的核心框架，实现五层架构的智能体系统基础设施。包含 236 个源文件和 82 个测试文件，提供从智能体生命周期管理到多模态交互、安全网关、记忆系统、推理引擎、工具编排和可观测性的完整能力。

当前版本: v0.2.0

### 核心特性

- **智能体生命周期管理** -- Plan-Act-Reflect 三阶段循环，支持知识增强 Agent
- **五层推理架构** -- Gateway -> Reasoning -> LLM -> Memory -> Tools
- **多模态交互** -- 文本、语音、图像、视频、文件输入输出
- **安全网关** -- 身份认证、权限控制、内容审核、审计日志、人机协同审批流
- **分层记忆系统** -- 短期记忆、长期记忆（向量存储）、检查点管理、断点续跑
- **多策略推理** -- ReAct、Plan-and-Solve、Tree-of-Thoughts、Chain-of-Thought、Enhanced Reflection
- **多模型支持** -- DeepSeek、Qwen、Ollama、OMXL，含成本感知路由和批量处理
- **工具系统** -- 增强工具注册表、中间件管道、工具选择优化
- **知识库** -- 知识卡片、知识图谱、增量生成器
- **可观测性** -- 遥测收集、性能监控、告警
- **验证系统** -- 结果验证器、幻觉检测器

---

## 快速开始

### 安装

```bash
pnpm add @yunpat/core
```

### 基础使用

```typescript
import { Agent, NativeLLMAdapter, ShortTermMemory } from '@yunpat/core'

// 1. 创建 LLM 适配器
const llm = new NativeLLMAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
})

// 2. 创建记忆存储
const memory = new ShortTermMemory()

// 3. 创建智能体
const agent = new Agent({
  name: 'PatentAgent',
  llm,
  memory,
  systemPrompt: '你是一个专业的专利撰写专家',
})

// 4. 运行智能体
const response = await agent.run({
  input: '请帮我撰写一个关于 AI 算法的专利申请',
})
console.log(response.output)
```

---

## 架构概览

### 五层架构

```
+--------------------------------------------------+
|                  Gateway 层                       |
|  多模态输入/输出 | 安全网关 | 人机协同审批          |
+-------------------------+------------------------+
                          |
+-------------------------v------------------------+
|               Reasoning 层                        |
|   ReAct | CoT | ToT | Plan-and-Solve | 反思       |
+-------------------------+------------------------+
                          |
+-------------------------v------------------------+
|                 LLM 层                             |
|    DeepSeek/Qwen/Ollama/OMXL | 成本路由 | 批处理   |
+-------------------------+------------------------+
                          |
+-------------------------v------------------------+
|               Memory 层                           |
|  短期记忆 | 长期记忆 | 检查点 | 记忆压缩           |
+-------------------------+------------------------+
                          |
+-------------------------v------------------------+
|               Tools 层                            |
|    工具注册表 | 中间件 | 工具选择优化 | Skill 模板  |
+--------------------------------------------------+
```

---

## 核心模块

### 项目结构

```
packages/core/src/
  agent/           # Agent 核心类、知识增强 Agent、增量生成器
  cache/           # 语义缓存系统
  config/          # 配置管理（ConfigManager）
  constitutional/  # Constitutional AI 合规检查
  db/              # 数据库迁移
  errors/          # 错误类（AgentInputError 等）
  eventbus/        # 事件总线及指标
  gateway/         # 安全网关（认证/授权/审核/HTTP/审批流）
  knowledge/       # 知识库、知识卡片、卡片管道
  learning/        # 主动学习系统
  lifecycle/       # 生命周期核心接口
  llm/             # LLM 适配器（Native/LangChain/OMXL/Embedding/TaskRouter/BatchProcessor）
  memory/          # 记忆系统（短期/长期/检查点）
  observability/   # 遥测收集、告警
  planning/        # 规划系统（WorkflowEngine/TaskDecomposer/TaskScheduler）
  prompts/         # 提示词模板系统
  reasoning/       # 推理引擎（ReAct/CoT/ToT/反思/缓存/监控/批处理）
  replanning/      # 动态重规划
  skills/          # Skill 模板加载器
  tools/           # 工具系统（注册表/中间件/优化器/使用追踪）
  types/           # 类型定义
  utils/           # 工具函数（Logger）
  validation/      # 结果验证器、幻觉检测器
```

### 1. Agent（智能体）

提供 `Agent` 和 `KnowledgeEnhancedAgent` 两个核心类。`KnowledgeEnhancedAgent` 在基础 Agent 之上集成了知识库查询和知识注入能力。

```typescript
import { Agent, KnowledgeEnhancedAgent } from '@yunpat/core'

// 基础智能体
const agent = new Agent({
  name: 'MyAgent',
  llm: llmAdapter,
  memory: memoryStore,
  tools: [tool1, tool2],
  systemPrompt: '系统提示词',
  maxIterations: 10,
})

// 知识增强智能体
const knowledgeAgent = new KnowledgeEnhancedAgent({
  name: 'PatentWriter',
  llm: llmAdapter,
  knowledgeBase: myKnowledgeBase,
})
```

### 2. LLM 适配器

支持多种 LLM 提供商，提供统一接口。包含成本感知路由、自适应温度控制、语义缓存和批量处理。

```typescript
import {
  NativeLLMAdapter,
  createDeepSeekModel,
  createQwenModel,
  createOllamaModel,
  CostAwareLLMAdapter,
  BatchProcessor,
} from '@yunpat/core'

// 快捷创建
const llm = createDeepSeekModel({ apiKey: process.env.DEEPSEEK_API_KEY })

// 成本感知路由（自动选择最优模型）
const costAware = new CostAwareLLMAdapter({
  adapters: { cheap: cheapLLM, standard: standardLLM, premium: premiumLLM },
})

// 批量处理
const batchProcessor = new BatchProcessor({ llm, maxBatchSize: 10 })
```

### 3. Memory（记忆系统）

分层记忆管理：短期记忆（内存）、检查点管理（文件系统）、断点续跑。

```typescript
import { ShortTermMemory, CheckpointManager, ResumeManager } from '@yunpat/core'

const memory = new ShortTermMemory()
await memory.set('context', { topic: '专利撰写' })

// 检查点：保存和恢复 Agent 状态
const checkpointManager = new CheckpointManager({ store, maxCheckpoints: 10 })
await checkpointManager.save({ agentId: 'agent-1', state, timestamp: new Date() })

// 断点续跑
const resumeManager = new ResumeManager(checkpointManager)
```

### 4. Gateway（安全网关）

身份认证、权限控制、内容审核、审计日志和人机协同审批流。

```typescript
import { BaseGateway, ApprovalFlow, ApprovalMode } from '@yunpat/core'

const gateway = new BaseGateway({
  enableAuth: true,
  enableContentFilter: true,
  enableAudit: true,
})

// 人机协同审批
const approvalFlow = new ApprovalFlow({
  mode: ApprovalMode.AUTO_WITH_FALLBACK,
  timeout: 30000,
})
```

### 5. Tools（工具系统）

增强工具注册表，支持中间件管道、工具选择优化和使用追踪。

```typescript
import {
  EnhancedToolRegistry,
  buildTool,
  LoggingMiddleware,
  PermissionMiddleware,
  ToolSelectionOptimizer,
} from '@yunpat/core'

const registry = new EnhancedToolRegistry()
registry.use(new LoggingMiddleware())

// 工具选择优化：基于历史使用数据推荐工具
const optimizer = new ToolSelectionOptimizer()
```

### 6. Reasoning（推理引擎）

多种推理策略：ReAct、Chain-of-Thought、Tree-of-Thoughts、Plan-and-Solve、Enhanced Reflection。

```typescript
import {
  ReActLoop,
  ChainOfThoughtStrategy,
  TreeOfThoughtsStrategy,
  EnhancedReflection,
} from '@yunpat/core'
```

### 7. 知识库系统

知识库管理、知识卡片生成和检索、卡片管道。

```typescript
import {
  KnowledgeBase,
  KnowledgeCard,
  CardGenerator,
  CardRetriever,
  CardPipeline,
} from '@yunpat/core'
```

### 8. 规划与重规划

WorkflowEngine 管理工作流，TaskDecomposer 分解任务，DynamicReplanner 在执行偏差时动态调整计划。

```typescript
import { WorkflowEngine, TaskDecomposer, DynamicReplanner } from '@yunpat/core'
```

### 9. 验证系统

结果验证器和幻觉检测器，确保输出质量。

```typescript
import { ResultValidator, HallucinationDetector } from '@yunpat/core'

const validator = new ResultValidator()
const detector = new HallucinationDetector()
```

### 10. 其他模块

- **ConfigManager** -- 统一配置管理
- **EventBus** -- 事件总线及指标收集
- **TelemetryCollector** -- 遥测和性能监控
- **ConstitutionalAI** -- 合规检查和自动纠错
- **SkillLoader** -- Skill 模板系统
- **ActiveLearningSystem** -- 主动学习

---

## 测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试
pnpm test -- Agent.test.ts

# 运行测试并生成覆盖率报告
pnpm test -- --coverage
```

### 测试覆盖率

| 模块    | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| ------- | -------- | ---------- | ---------- |
| Agent   | 93.50%   | 97.72%     | 83.54%     |
| Gateway | 84.13%   | 82.88%     | 84.74%     |
| Memory  | 65.01%   | 50.35%     | 60.00%     |
| Tools   | 88.50%   | 77.94%     | 92.85%     |

---

## 开发

```bash
pnpm install
pnpm dev       # 监听模式
pnpm build     # 构建
pnpm test      # 测试
```

---

## 许可证

MIT

---

最后更新: 2026-05-10
