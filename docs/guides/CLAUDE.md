# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

YunPat 是一个以 TypeScript 为主的 AI 智能体框架（v0.1.0），采用**五层架构**设计，核心理念是"框架笨、智能体专"。项目正在向知识产权全生命周期智能体平台演进。

**核心设计原则**：

- 框架层只提供通用能力：接收输入 → 查记忆 → 推理 → 调工具 → 返回输出
- 业务逻辑完全由智能体实现
- 智能体通过框架通信，新增智能体不需要修改框架代码

## 当前完成度（2026-05-03）

**总体进度**: ~45%

- **核心框架 (packages/core)**: ~95% - 131 个 TS 文件，~47,000 行代码，推理层增强完成
- **知识库集成**: 100% - 4384 个文件，Obsidian 知识库桥接
- **推理层增强**: 100% - 5 大核心功能完成并集成
- **通用智能体包**: 9 个专用智能体包（writer, researcher, invention, analysis, quality, specification, patent-writer, search, claims）
- **专利智能体**: PatentWriterAgent (~85%), PatentResponderAgent (~60%), PatentAnalyzerAgent (~60%), PatentManagerAgent (~40%)
- **Rust 工具链**: 40% - 编译错误待修复
- **CLI/MCP**: 30%-50% - 部分功能实现
- **测试覆盖**: ~85% - 71 个测试文件，1582/1596 测试通过（99.1%）

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

**推理层增强功能** (2026-04-30 完成):

- `HallucinationDetector`: 幻觉检测系统（事实验证、逻辑一致性、源归属）
- `GoalDecomposer`: 目标分解系统（递归分解、任务依赖图）
- `ConstitutionalAI`: Constitutional AI 模块（原则约束、合规检查）
- `DynamicReplanner`: 动态重规划（失败恢复、策略调整）
- `TaskDependencyGraph`: 任务依赖图可视化（DOT 导出、实时更新）

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

| 包名                          | 路径                            | 完成度 | 说明                                     |
| ----------------------------- | ------------------------------- | ------ | ---------------------------------------- |
| `@yunpat/core`                | `packages/core`                 | 95%    | 核心框架，131 个 TS 文件，~47,000 行代码 |
| `@yunpat/agent-writer`        | `packages/agents/writer`        | 70%    | 通用写作智能体                           |
| `@yunpat/agent-researcher`    | `packages/agents/researcher`    | 50%    | 通用研究智能体                           |
| `@yunpat/agent-invention`     | `packages/agents/invention`     | 40%    | 发明构思智能体                           |
| `@yunpat/agent-analysis`      | `packages/agents/analysis`      | 40%    | 技术分析智能体                           |
| `@yunpat/agent-quality`       | `packages/agents/quality`       | 30%    | 质量评估智能体                           |
| `@yunpat/agent-specification` | `packages/agents/specification` | 30%    | 规格生成智能体                           |
| `@yunpat/agent-patent-writer` | `packages/agents/patent-writer` | 50%    | 专利写作智能体                           |
| `@yunpat/agent-search`        | `packages/agents/search`        | 40%    | 搜索智能体                               |
| `@yunpat/agent-claims`        | `packages/agents/claims`        | 30%    | 权利要求生成智能体                       |
| `@yunpat/patent-tools`        | `packages/patent-tools`         | 75%    | 专利工具集                               |
| `@yunpat/builtin-tools`       | `packages/builtin-tools`        | 65%    | 内置基础工具                             |
| `@yunpat/document-tools`      | `packages/document-tools`       | 80%    | 文档解析工具                             |
| `@yunpat/grpc-server`         | `packages/grpc-server`          | 60%    | gRPC 服务器                              |
| `@yunpat/cli`                 | `packages/cli`                  | 30%    | CLI 骨架                                 |
| `@yunpat/patent-core`         | `packages/patent-core`          | 50%    | Rust 核心库桥接                          |
| `@yunpat/patent-knowledge`    | `packages/patent-knowledge`     | 75%    | 专利知识库                               |
| `@yunpat/patent-prompts`      | `packages/patent-prompts`       | 85%    | 提示词模板管理器                         |

### 专利业务代码

| 路径                                   | 完成度 | 说明                                       |
| -------------------------------------- | ------ | ------------------------------------------ |
| `patents/agents/writer/`               | 85%    | PatentWriterAgent（21 个 TS 文件，最成熟） |
| `patents/agents/responder/`            | 60%    | PatentResponderAgent                       |
| `patents/agents/analyzer/`             | 60%    | PatentAnalyzerAgent                        |
| `patents/agents/manager/`              | 40%    | PatentManagerAgent                         |
| `patents/agents/AgentMemoryManager.ts` | 100%   | 智能体记忆管理器                           |
| `patents/prompts/`                     | 85%    | 提示词模板管理器（1821+ 行）               |
| `patents/knowledge/`                   | 75%    | ObsidianKnowledgeBridge                    |
| `patents/core/`                        | 50%    | Rust 桥接（PatentCoreBridge）              |
| `patents/mcp/`                         | 50%    | MCP 服务器                                 |

### 其他关键目录

| 路径                   | 说明                         |
| ---------------------- | ---------------------------- |
| `cli/patent-cli/`      | 独立 Node.js CLI（骨架）     |
| `knowledge-base/`      | 专利知识库（4384 个文件）    |
| `protos/`              | gRPC/Protobuf 定义           |
| `docker/python-tools/` | Python 服务 Docker 配置      |
| `examples/`            | 使用示例                     |
| `scripts/`             | 维护脚本                     |
| `docs/`                | 项目文档（已整理，5 大分类） |

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
  protected before?(input, context): Promise<void>
  protected init?(context): Promise<void> // 仅首次
  protected reflect?(result, context): Promise<Reflection>
  protected after?(input, output, context): Promise<void>
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
import { createDeepSeekModel } from '@yunpat/core'
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
```

环境变量：

```bash
export DEEPSEEK_API_KEY=sk-...
export DASHSCOPE_API_KEY=sk-...
```

## 技术栈

- **TypeScript 5.3+**: 目标 ES2022，ESM，严格模式
- **构建**: esbuild + tsc（类型声明）
- **包管理**: pnpm workspace（21 个工作空间包）
- **测试**: Vitest（71 个测试文件，1582/1596 测试通过，99.1% 通过率）
- **代码质量**: ESLint + Prettier
- **Rust**: 性能关键型算法（patent-core）
- **Python**: 隔离 ML/数据分析（gRPC）

## 最近更新（2026-05-01 至 2026-05-03）

### 核心框架测试大幅提升 ✅

**完成度**: 99.1%（1582/1596 测试通过）

**测试覆盖提升**:

- 从 585/594（98.5%）提升到 1582/1596（99.1%）
- 新增 ~1000 个测试用例
- 代码覆盖率达到 ~85%
- 所有核心模块都有完整测试

### 推理层增强项目完成 ✅

**完成度**: 100%

**五大核心功能**:

1. **幻觉检测系统**: 事实验验、逻辑一致性检查、源归属验证
2. **目标分解系统**: 递归任务分解、任务依赖图生成
3. **Constitutional AI**: 原则约束、合规检查、迭代优化
4. **动态重规划**: 失败恢复、策略调整、路径优化
5. **任务依赖图可视化**: DOT 导出、实时更新、交互式查看

**技术成果**:

- ~47,000 行核心代码（packages/core）
- 131 个 TS 文件
- 100% TypeScript 严格模式
- 完整的文档和示例

详见: [docs/reports/project-summary.md](docs/reports/project-summary.md)

### 文档整理完成 ✅

**docs 目录结构优化**:

- 根目录从 40+ 文件精简到 5 个核心文档
- 新增 5 个分类目录：guides/、summaries/、tools/、progress/、reports/
- 文件命名规范化（小写 + 连字符）
- 更新 README.md 导航

详见: [docs/README.md](docs/README.md)

## 重要约束

- **不要在 core 包中添加业务逻辑**
- **智能体之间不直接调用**，使用 EventBus
- **优先使用国产大模型**（DeepSeek/Qwen），不用 OpenAI
- **新增智能体不需要修改框架代码**
- **TypeScript 导入需带 `.js` 扩展名**（ESM 规范）

## 测试说明

### 测试状态

- **总测试数**: 1582/1596 通过（99.1% 通过率）
- **测试文件**: 71 个（70 个通过，1 个跳过）
- **核心包测试**: 1582 个测试用例，覆盖所有核心模块
- **测试覆盖率**: ~85% 代码覆盖率

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行单个包的测试
pnpm --filter @yunpat/core test

# 运行特定测试文件
pnpm --filter @yunpat/core exec vitest run EventBus.test.ts

# 运行超时测试（需要更长的超时时间）
vitest run test/integration/hallucination-detection.integration.test.ts --testTimeout=30000
```

### 已知问题

- **幻觉检测集成测试超时**: 部分测试需要超过 10 秒，建议增加超时时间到 30 秒
- **LLM API 调用**: 部分测试需要真实的 LLM API 密钥（DEEPSEEK_API_KEY）

## 开发工作流

### 新增智能体

1. 在 `packages/agents/` 或 `patents/agents/` 创建新智能体类
2. 继承 `Agent` 基类，实现 `plan` 和 `act` 方法
3. 在 `packages/core/src/agent/` 注册智能体（如需要）
4. 添加测试到 `test/` 目录
5. 更新文档

### 调试技巧

- 使用 `vitest --watch` 进行开发时测试
- 使用 `console.log` 或 `debugger` 调试
- 查看 `docs/` 目录下的架构文档和指南
- 参考 `examples/` 目录下的使用示例

## 文档资源

- **项目概述**: [README.md](README.md)
- **开发指南**: [docs/guides/](docs/guides/)
- **架构文档**: [docs/architecture/](docs/architecture/)
- **API 文档**: [docs/guides/api.md](docs/guides/api.md)
- **工作报告**: [docs/reports/](docs/reports/)
- **更多文档**: [docs/README.md](docs/README.md)
