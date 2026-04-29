# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

YunPat 是一个通用的 AI 智能体框架，采用**五层架构**设计，核心理念是"框架笨、智能体专"。

**核心设计原则**：
- 框架层只提供通用能力：接收输入 → 查记忆 → 推理 → 调工具 → 返回输出
- 业务逻辑完全由智能体实现
- 智能体通过框架通信，新增智能体不需要修改框架代码

## 开发命令

### 构建
```bash
pnpm install          # 安装所有依赖
pnpm build           # 构建所有包
pnpm dev             # 开发模式（watch 模式）
pnpm clean           # 清理构建产物
```

### 单个包操作
```bash
# 构建特定包
pnpm --filter @yunpat/core build
pnpm --filter @yunpat/agent-writer build

# 开发模式（特定包）
pnpm --filter @yunpat/core dev
```

### 运行 CLI
```bash
# 构建后运行
node packages/cli/dist/index.js init
node packages/cli/dist/index.js run writer --task "任务描述"
```

## 五层架构

这是项目的核心架构，理解这个架构对开发至关重要：

```
① 交互层 (Gateway) → 多模态输入、HITL、安全网关
         ↓
② 推理层 (Reasoning) → ReAct 循环、推理策略
         ↓
③ 核心引擎 (LLM) → DeepSeek/通义千问/本地模型
         ↓
④ 记忆层 (Memory) → 检查点、时间旅行、断点续传
         ↓
⑤ 工具层 (Tools) → 函数调用、MCP 协议
```

### 层级职责

**① 交互层** (`packages/core/src/gateway/`)
- `BaseGateway`: 实现多模态输入、人机协同审批、安全网关
- 智能体通过 Gateway 与外部世界交互

**② 推理层** (`packages/core/src/reasoning/`)
- `ReActLoop`: 实现 ReAct 循环（观察 → 思考 → 行动）
- `PlanAndSolveStrategy`: 先规划再解决策略
- `TreeOfThoughtsStrategy`: 思维树策略

**③ 核心引擎** (`packages/core/src/llm/`)
- `NativeLLMAdapter`: **优先使用国产大模型**
  - DeepSeek (推荐，性价比高)
  - 通义千问 (分析任务强)
  - 本地 Ollama (离线场景)
- `LangChainAdapter`: 保留用于兼容性

**④ 记忆层** (`packages/core/src/memory/`)
- `EnhancedMemoryStore`: 增强的记忆存储
- `CheckpointManager`: 检查点机制
- `TimeMachine`: 时间旅行调试

**⑤ 工具层** (`packages/core/src/tools/`)
- `ToolRegistry`: 工具注册和调用
- `BaseTool`: 工具基类

## 智能体开发

### 生命周期钩子

所有智能体继承 `Agent` 基类，实现标准生命周期：

```typescript
class MyAgent extends Agent<Input, Output> {
  // 必需：规划阶段（核心思考）
  protected async plan(input: Input, context: ExecutionContext): Promise<Plan> {
    // 使用 context.llm 制定计划
  }

  // 必需：执行阶段（按计划行动）
  protected async act(plan: Plan, context: ExecutionContext): Promise<Result> {
    // 使用 context.tools 调用工具
  }

  // 可选：前置/后置/反思钩子
  protected before?(input, context): Promise<void>;
  protected reflect?(result, context): Promise<Reflection>;
  protected after?(input, output, context): Promise<void>;
}
```

### 智能体通信

智能体之间**不直接调用**，通过框架通信：

```typescript
// 订阅事件
this.on('agent:completed', async (event) => {
  // 处理其他智能体的完成事件
});

// 发送消息（通过 EventBus）
await this.send('target-agent', { data: 'message' });
```

### 新增智能体步骤

**通用智能体（可复用）：**
1. 在 `packages/agents/` 创建新目录
2. 继承 `Agent` 类
3. 实现 `plan` 和 `act` 方法
4. **不需要修改 `packages/core` 任何代码**

**专利专用智能体：**
1. 在 `patents/agents/` 创建新目录
2. 继承 `Agent` 类
3. 实现 `plan` 和 `act` 方法
4. 可以使用 `patents/prompts/` 中的模板

## LLM 模型选择

**优先级顺序**：
1. **DeepSeek** - 默认推荐，性价比高
2. **通义千问** - 分析任务使用
3. **本地 Ollama** - 离线或隐私场景

```typescript
// 推荐方式
import { createDeepSeekModel, createQwenModel, createOllamaModel } from '@yunpat/core';

const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);
```

环境变量：
```bash
export DEEPSEEK_API_KEY=sk-...        # DeepSeek
export DASHSCOPE_API_KEY=sk-...       # 通义千问
# Ollama 无需 API Key
```

## 项目结构

```
yunpat/
├── packages/              # 所有可复用的代码包
│   ├── core/              # 核心框架（不包含业务逻辑）
│   │   └── src/
│   │       ├── agent/     # Agent 抽象基类
│   │       ├── gateway/   # 交互层
│   │       ├── reasoning/ # 推理层
│   │       ├── llm/       # LLM 适配器
│   │       ├── memory/    # 记忆层
│   │       ├── tools/     # 工具层
│   │       ├── eventbus/  # 事件总线
│   │       └── lifecycle/ # 生命周期类型定义
│   │
│   ├── agents/            # 通用智能体（可复用）
│   │   ├── writer/        # 技术写作助手
│   │   └── researcher/    # 研究分析师
│   │
│   ├── rust-tools/        # Rust 工具（性能关键型）
│   │   ├── patent-tools/  # 专利工具集
│   │   ├── patent-cli/    # Rust CLI
│   │   └── patent-agent/  # Rust 智能体
│   │
│   ├── python-tools/      # Python 工具（科学计算）
│   │
│   └── cli/               # 命令行工具
│
├── patents/               # 专利专用业务逻辑
│   ├── agents/            # 四大专利智能体
│   │   ├── writer/        # 专利撰写智能体
│   │   ├── responder/     # 审查答复智能体
│   │   ├── analyzer/      # 专利分析智能体
│   │   └── manager/       # 专利管理智能体
│   │
│   ├── prompts/           # Prompt 模板和管理器
│   │   ├── templates/     # Markdown 模板
│   │   └── PromptTemplateManager.ts
│   │
│   ├── generation/        # 文档生成器
│   ├── retrieval/         # 检索系统
│   ├── knowledge/         # 知识库集成
│   └── mcp/               # MCP 工具服务器
│
├── knowledge-base/        # 专利知识库（法律文档）
├── docs/                  # 项目文档
├── examples/              # 使用示例
├── scripts/               # 维护脚本
└── test/                  # 测试文件
```

## 关键设计决策

### 为什么五层架构？

- **解耦**：每层有明确职责，易于替换和扩展
- **复用**：通用能力在框架层，业务逻辑在智能体层
- **协作**：通过标准接口层间通信

### 为什么优先国产大模型？

- **成本**：DeepSeek 性价比高（¥0.001/1k tokens）
- **性能**：中文场景表现优秀
- **自主**：支持本地部署（Ollama）

### 为什么使用事件总线？

- **解耦**：智能体之间无直接依赖
- **灵活**：支持广播、点对点、请求响应
- **可观测**：所有通信都可追踪

## ReAct 循环

这是框架的核心推理模式：

```typescript
const reactLoop = new ReActLoop(llm, {
  maxIterations: 10,
  verbose: true,
  reflectAfterStep: true,
});

for await (const iteration of reactLoop.execute(goal)) {
  // iteration.thought - 思考过程
  // iteration.action - 行动决策
  // iteration.actionResult - 行动结果
  // iteration.done - 是否完成
  
  if (iteration.done) break;
}
```

## 检查点机制

用于调试和断点续传：

```typescript
const memory = new EnhancedMemoryStore(checkpointManager);

// 创建检查点
await memory.createCheckpoint(agentName, executionId, iteration);

// 恢复检查点
await memory.restoreCheckpoint(checkpointId);

// 时间旅行
const timeMachine = memory.getTimeMachine();
await timeMachine.travelBack(checkpointId);
```

## 常见任务

### 添加新的推理策略

1. 在 `packages/core/src/reasoning/` 创建新文件
2. 实现策略接口
3. 更新 `packages/core/src/index.ts` 导出

### 添加新的工具

1. 继承 `BaseTool`
2. 实现 `execute` 方法
3. 在智能体中注册：`this.tools.register(new MyTool())`

### 修改智能体行为

**通用智能体：**
1. 直接修改 `packages/agents/` 下的智能体文件
2. **不要**修改 `packages/core` 除非要改变框架能力

**专利智能体：**
1. 直接修改 `patents/agents/` 下的智能体文件
2. 可以使用 `patents/prompts/templates/` 中的模板

## 重要约束

- **不要在 core 包中添加业务逻辑**
- **智能体之间不直接调用**，使用事件总线
- **优先使用国产大模型**，而不是 OpenAI
- **新增智能体不需要修改框架代码**
