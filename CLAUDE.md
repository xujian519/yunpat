# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

YunPat 是一个以 TypeScript 为主的 AI 智能体框架（v0.1.0），采用**五层架构**设计，核心理念是"框架笨、智能体专"。项目正在向知识产权全生命周期智能体平台演进。

**核心设计原则**：
- 框架层只提供通用能力：接收输入 → 查记忆 → 推理 → 调工具 → 返回输出
- 业务逻辑完全由智能体实现
- 智能体通过框架通信，新增智能体不需要修改框架代码

## 当前完成度（2026-04-30）

**总体进度**: ~30%

- **核心框架 (packages/core)**: ~85% - Agent 基类、EventBus（53 测试）、五层架构完整
- **知识库集成**: 100% - 1139 个文件，Obsidian 知识库桥接
- **PatentWriterAgent**: ~80% - 最成熟的智能体
- **其余 3 个专利智能体**: 20%-50% 不等
- **Rust 工具链**: 40% - 25 个编译错误待修
- **CLI/MCP**: 20%-40% - 返回 TODO/硬编码数据
- **测试覆盖**: ~5% - 仅 EventBus 有可靠测试

## 开发命令

### 安装与构建
```bash
pnpm install          # 安装所有依赖
pnpm build            # 构建（esbuild，顺序构建 core → 其他）
pnpm build:tsc        # 纯 tsc 构建（所有包）
pnpm build:watch      # Watch 模式
pnpm clean            # 清理构建产物
```

### 单个包操作
```bash
pnpm --filter @yunpat/core build
pnpm --filter @yunpat/agent-writer build
pnpm --filter @yunpat/core dev
```

### 类型检查
```bash
node esbuild.config.mjs check
```

### 测试
```bash
pnpm test                              # 运行所有包测试
pnpm --filter @yunpat/core test        # 核心包测试
pnpm --filter @yunpat/core exec vitest run EventBus.test.ts  # 单个文件
```

### 代码质量
```bash
pnpm lint
```

## 五层架构

```
① 交互层 (Gateway) → 多模态输入、HITL、安全网关
         ↓
② 推理层 (Reasoning) → ReAct 循环、PlanAndSolve、思维树
         ↓
③ 核心引擎 (LLM) → DeepSeek/通义千问/Ollama（优先国产模型）
         ↓
④ 记忆层 (Memory) → 检查点、时间旅行、断点续传
         ↓
⑤ 工具层 (Tools) → 函数调用、MCP 协议、中间件管道
```

### 层级职责

**① 交互层** (`packages/core/src/gateway/`)
- `BaseGateway`: 多模态输入、人机协同审批、安全网关、审计日志

**② 推理层** (`packages/core/src/reasoning/`)
- `ReActLoop`: ReAct 循环（观察 → 思考 → 行动）
- `PlanAndSolveStrategy`: 先规划再解决
- `TreeOfThoughtsStrategy`: 思维树策略
- `EnhancedReflection`: 自我反思与质量评估
- `FewShotPromptManager`: Few-shot 学习优化

**③ 核心引擎** (`packages/core/src/llm/`)
- `NativeLLMAdapter`: DeepSeek（推荐）、通义千问、Ollama
- `OMXLAdapter`: OMML 模型集成
- `EmbeddingAdapter`: BGE 嵌入支持
- `TaskRouter`: 成本感知任务路由
- `SemanticCache`: 语义缓存
- `AdaptiveTemperatureController`: 温度自适应
- `LangChainAdapter`: LangChain 兼容层

**④ 记忆层** (`packages/core/src/memory/`)
- `EnhancedMemoryStore`: 增强记忆存储
- `CheckpointManager`: 检查点机制
- `ResumeManager`: 断点续传
- `ShortTermMemory`: 短期记忆

**⑤ 工具层** (`packages/core/src/tools/`)
- `EnhancedToolRegistry`: 工具注册和调用
- `ToolSelectionOptimizer`: 基于相似度的工具选择
- `ToolUsageTracker`: 使用追踪与分析
- 中间件管道：日志、权限、缓存、限流、追踪

## 包结构

### 核心包（pnpm workspace）

| 包名 | 路径 | 完成度 | 说明 |
|------|------|--------|------|
| `@yunpat/core` | `packages/core` | 85% | 核心框架，356+ 导出 |
| `@yunpat/agent-writer` | `packages/agents/writer` | 65% | 通用写作智能体 |
| `@yunpat/agent-researcher` | `packages/agents/researcher` | 40% | 通用研究智能体 |
| `@yunpat/patent-tools` | `packages/patent-tools` | 70% | 专利工具集 |
| `@yunpat/builtin-tools` | `packages/builtin-tools` | 60% | 内置基础工具 |
| `@yunpat/document-tools` | `packages/document-tools` | 75% | 文档解析工具 |
| `@yunpat/grpc-server` | `packages/grpc-server` | 50% | gRPC 服务器 |
| `@yunpat/cli` | `packages/cli` | 20% | CLI 骨架 |

### 专利业务代码

| 路径 | 完成度 | 说明 |
|------|--------|------|
| `patents/agents/writer/` | 80% | PatentWriterAgent（最成熟） |
| `patents/agents/responder/` | 50% | PatentResponderAgent |
| `patents/agents/analyzer/` | 50% | PatentAnalyzerAgent |
| `patents/agents/manager/` | 20% | PatentManagerAgent |
| `patents/prompts/` | 80% | 提示词模板管理器（1821 行） |
| `patents/knowledge/` | 70% | ObsidianKnowledgeBridge |
| `patents/core/` | 50% | Rust 桥接（PatentCoreBridge） |
| `patents/mcp/` | 40% | MCP 服务器（硬编码数据） |

### 其他关键目录

| 路径 | 说明 |
|------|------|
| `cli/patent-cli/` | 独立 Node.js CLI（空壳） |
| `knowledge-base/` | 专利知识库（1139+ 文件） |
| `protos/` | gRPC/Protobuf 定义 |
| `docker/python-tools/` | Python 服务 Docker 配置 |
| `examples/` | 19 个使用示例 |
| `scripts/` | 14 个维护脚本 |

## 智能体开发

### 生命周期钩子

所有智能体继承 `Agent` 基类（`packages/core/src/agent/Agent.ts`），实现标准生命周期：

```typescript
class MyAgent extends Agent<Input, Output> {
  // 必需：规划阶段
  protected async plan(input: Input, context: ExecutionContext): Promise<Plan> {}

  // 必需：执行阶段
  protected async act(plan: Plan, context: ExecutionContext): Promise<Result> {}

  // 可选钩子
  protected before?(input, context): Promise<void>;
  protected init?(context): Promise<void>;       // 仅首次
  protected reflect?(result, context): Promise<Reflection>;
  protected after?(input, output, context): Promise<void>;
}
```

### 智能体通信

智能体之间**不直接调用**，通过 EventBus 通信：

```typescript
this.on('agent:completed', async (event) => { ... });
await this.send('target-agent', { data: 'message' });
```

### 新增智能体步骤

**通用智能体**：在 `packages/agents/` 创建，继承 `Agent` 类，实现 `plan` 和 `act`，不需要修改 core。

**专利专用智能体**：在 `patents/agents/` 创建，可使用 `patents/prompts/` 模板。

## LLM 模型选择

**优先级**：DeepSeek（默认推荐）→ 通义千问（分析任务）→ Ollama（离线场景）

```typescript
import { createDeepSeekModel } from '@yunpat/core';
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);
```

环境变量：
```bash
export DEEPSEEK_API_KEY=sk-...
export DASHSCOPE_API_KEY=sk-...
```

## 技术栈

- **TypeScript 5.3+**: 目标 ES2022，ESM，严格模式
- **构建**: esbuild + tsc（类型声明）
- **包管理**: pnpm workspace
- **测试**: Vitest
- **代码质量**: ESLint + Prettier
- **Rust**: 性能关键型算法（patent-core）
- **Python**: 隔离 ML/数据分析（gRPC）

## 重要约束

- **不要在 core 包中添加业务逻辑**
- **智能体之间不直接调用**，使用 EventBus
- **优先使用国产大模型**（DeepSeek/Qwen），不用 OpenAI
- **新增智能体不需要修改框架代码**
- **TypeScript 导入需带 `.js` 扩展名**（ESM 规范）
