# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 卡帕西编程哲学

所有代码工作必须遵循以下四大原则。根据任务复杂度自动调整严格程度：

### 智能触发

| 模式 | 触发条件 | 应用范围 |
|------|---------|---------|
| 简化模式 | 单行修改、拼写/格式修正 | 仅精准修改，跳过其余原则 |
| 标准模式（默认） | 小功能、简单 bug、单文件 | 适度应用全部原则 |
| 完整模式 | 重构、架构设计、>3 文件修改、API 设计 | 严格应用全部原则 |

### 原则 1：编码前思考

不要假设。不要隐藏困惑。呈现权衡。

- 明确说明假设 —— 不确定时询问而非猜测
- 呈现多种解释 —— 有歧义时不要默默选择
- 适时提出异议 —— 有更简单的方法就说出来
- 困惑时停下来 —— 指出不清楚的地方并要求澄清

### 原则 2：简洁优先

用最少的代码解决问题。不要过度推测。

- 不添加要求之外的功能
- 不为一次性代码创建抽象
- 不添加未要求的"灵活性"或"可配置性"
- 不为不可能发生的场景做错误处理
- 200 行能写成 50 行就重写

> 检验标准：资深工程师会觉得这过于复杂吗？如果是，简化。

### 原则 3：精准修改

只碰必须碰的。只清理自己造成的混乱。

- 不"改进"相邻的代码、注释或格式
- 不重构没坏的东西
- 匹配现有风格，即使你更倾向不同的写法
- 注意到无关死代码时提一下 —— 不要删除它
- 只删除因你的改动而变得无用的代码

> 检验标准：每一行修改都应该能直接追溯到用户的请求。

### 原则 4：目标驱动执行

定义成功标准。循环验证直到达成。

| 弱指令 | 强指令 |
|--------|--------|
| "添加验证" | "为无效输入编写测试，然后让它们通过" |
| "修复 bug" | "编写重现 bug 的测试，然后让它通过" |
| "重构 X" | "确保重构前后测试都能通过" |

多步骤任务必须为每一步指定验证方式：`步骤 → 验证: [检查]`

---

## 项目概述

YunPat Agent（云熙知识产权智能体）— 知识产权全生命周期智能体操作系统。

双语言 Monorepo：Rust 负责交互层（CLI/TUI/HTTP 运行时 API），TypeScript 负责业务层（Agent 编排、MCP Server、专利工具）。

## 构建与开发命令

```bash
# 安装依赖
make install

# 构建（Rust + TypeScript 并行）
make build
make build-rust          # 仅 Rust（release）
make build-rust-debug    # Rust debug 版本
make build-ts            # 仅 TypeScript

# 测试
make test
make test-rust           # cargo test --workspace --all-features
make test-ts             # pnpm test（TypeScript）
make test-ts-real        # 真实 LLM 测试（需要 API key）

# 代码质量
make lint                # cargo clippy + pnpm lint
make format              # cargo fmt + prettier

# 开发模式（热重载：Rust cargo-watch + TS esbuild watch + MCP Server）
make dev

# 运行
make run                 # cargo run --bin deepseek
```

### Rust 单 crate 操作

```bash
cd crates
cargo test -p deepseek-tui                        # 单 crate 测试
cargo test -p deepseek-core -- test_turn_loop     # 单个测试
cargo build -p yunpat-agents                      # 单 crate 构建
cargo clippy -p yunpat-mcp-bridge                 # 单 crate lint
```

### TypeScript 单包操作

```bash
cd packages
pnpm --filter @yunpat/core test                   # 单包测试
pnpm --filter @yunpat/mcp-server dev              # 单包开发
pnpm --filter @yunpat/patent-writer build         # 单包构建
```

### 专利模式开发命令

```bash
# 构建并验证 MCP server（从 packages/packages/mcp-server 目录）
npx tsc -p packages/packages/mcp-server/tsconfig.json

# 运行 MCP server E2E 测试
cd packages/packages/mcp-server && npx vitest run test/e2e.test.ts

# 运行数据主权检测测试
cd packages/packages/core && npx vitest run test/constitutional/DataSovereigntyChecker.test.ts

# 测试 intent-hook（手动验证双路径）
echo '{"event":"message_submit","message":"检索XXX专利","mode":"general"}' | npx tsx packages/packages/orchestrator-adapter/src/intent-hook.ts
```

## 专利工作流

### 入口与意图路由

`deepseek` 始终以通用模式启动。`yunpat-router` 每轮检测用户意图，识别为专利相关时自动激活专利工具集。

### 数据主权 (CON-01)

技术交底书内容**禁止**发送到外部 API。MCP server 在工具调用前自动检测输入内容，命中 CON-01 规则时返回提示而非执行。规则定义在 `constitutional/data-sovereignty.yaml`，检测实现在 `@yunpat/core/constitutional/DataSovereigntyChecker.ts`。

### 关键目录

- `.deepseek/` — 项目级 TUI 配置、system prompt、slash 命令、hook 脚本
- `constitutional/` — YAML 规则文件（专利法约束、数据主权、合规审计）
- `packages/packages/orchestrator-adapter/src/` — intent-hook、exception-hook 独立脚本

## 架构

### 双层通信架构

```
Rust TUI/CLI/HTTP
    ↓ MCP stdio
TypeScript MCP Server
    ↓ 内部调用
Agent 编排器 (Orchestrator)
    ↓ LangChain + 多 LLM
专利数据库 / LLM API
```

Rust 与 TypeScript 之间通过 **MCP（Model Context Protocol）** 通信。`yunpat-mcp-bridge` crate 提供 Rust 端桥接。

### Rust 工作区（crates/）

**18 个 crate，Cargo workspace 位于 `crates/Cargo.toml`**。需要 Rust 1.88+（使用 `let_chains`）。

| Crate | 职责 |
|-------|------|
| `cli` | CLI 入口分发器，转发到 `deepseek-tui` |
| `tui` | **主运行时** — 引擎、工具、LLM 客户端、TUI 渲染、运行时 API、任务管理器（大量 inline modules） |
| `core` | 核心运行时边界：Agent 循环、会话管理、Turn 编排、容量流控 |
| `agent` | ModelRegistry — 模型/提供商注册表 |
| `tools` | 工具调用生命周期、Schema 验证、并行调度器 |
| `mcp` | MCP 客户端 + stdio 传输 |
| `protocol` | 请求/响应帧和协议类型 |
| `config` | 配置加载、profiles、环境变量优先级 |
| `state` | SQLite 线程/会话持久化 |
| `secrets` | OS keyring API key 存储 |
| `execpolicy` | 审批/沙箱策略引擎 |
| `hooks` | 生命周期钩子（stdout、jsonl、webhook） |
| `app-server` | HTTP/SSE + JSON-RPC 无头 Agent 服务 |
| `tui-core` | 事件驱动 TUI 状态机骨架 |
| `yunpat-agents` | **专利领域 Agent trait 系统**：专利检索、论文搜索、法律库、OCR、文档处理、Flow 编排 |
| `yunpat-models` | 多提供商 ModelProvider 接口（SSE、OpenAI 兼容） |
| `yunpat-mcp-bridge` | MCP 桥接：从 Rust 调用 TS/Python Agent |
| `yunpat-router` | 意图路由和命令分发 |

**关键**：`tui` 是实际主运行时（~4200 行 main.rs，50+ inline modules），其他 crate 正在逐步提取但尚未完全独立。

### TypeScript 工作区（packages/）

**pnpm workspace，~25 个 agent 包 + 10 个基础设施包**。

| 包名 | 职责 |
|------|------|
| `@yunpat/core` | 智能体框架核心：Agent 抽象、事件总线、生命周期、LLM 集成、DB、内存、规划 |
| `@yunpat/orchestrator` | 专利 Agent 中央调度系统，组合 25 个专业 Agent |
| `@yunpat/mcp-server` | MCP 协议服务端（bin: `yunpat-mcp`），向 Claude Desktop 暴露专利工具 |
| `@yunpat/orchestrator-adapter` | 连接 Rust Gateway 和 Node.js 业务层（Anthropic SDK + Express） |
| `@yunpat/patent-core` | Rust CLI 桥接和 TypeScript 降级层 |
| `@yunpat/patent-tools` | 专利专用工具：权利要求生成、质量评估、审查意见答复 |
| `@yunpat/patent-database` | 专利数据库访问层（Drizzle ORM） |
| `@yunpat/patent-knowledge` | 专利知识库访问 |
| `@yunpat/unified-knowledge-graph` | 统一知识图谱（OpenClaw + YunPat + Athena） |
| `@yunpat/tui` | **已废弃** — 使用 Rust TUI 代替 |
| `rust-tools` | Rust 工具集（向量服务、相似度、分词器） |
| `rust-gateway` | Rust HTTP 网关 |

**25 个专业 Agent**：abstract-drafter、analysis、claim-generator、comparison-report-generator、invention、patent-analyzer、patent-manager、patent-responder、prior-art-search、researcher、search、specification-drafter、subject-matter-checker、technical-drawing、tech-unit、unity-checker、writer、quality、quality-checker、format-converter、image-understanding、legal-qa 等。

### 数据流

1. 用户输入 → TUI/CLI → `core/engine`
2. Engine → `llm_client` → LLM API（流式 Chat Completions）
3. 响应流回来，工具调用提取后通过工具注册表路由
4. Pre-hooks → 审批门控（非 yolo 模式）→ 工具执行 → Post-hooks
5. 文件编辑后：LSP 诊断收集并注入下一轮模型上下文
6. 结果聚合，发回 LLM 进行下一步推理

## 关键技术细节

- **LLM 支持**：DeepSeek（默认）、Qwen、OpenAI、Anthropic、本地 Ollama
- **数据库**：PostgreSQL（生产）+ SQLite（Rust state 层）+ Redis（缓存，可选）
- **构建工具**：esbuild（TS，30x 比 tsc 快）、cargo（Rust）
- **ORM**：Drizzle ORM（TypeScript）
- **TUI 框架**：ratatui（Rust）
- **Agent 框架**：LangChain（TypeScript）
- **API 风格**：OpenAI 兼容 Chat Completions，流式优先
- **配置路径**：`~/.deepseek/config.toml`、`~/.deepseek/mcp.json`、`~/.deepseek/skills/`
- **持久化 schema**：所有持久化记录带 `schema_version` 字段防止跨版本数据损坏
- **沙箱**：macOS Seatbelt sandboxing
- **TypeScript 配置**：ES2022 target、ESNext modules、strict mode、bundler moduleResolution

## 项目约定

- 所有 LLM 响应使用流式（streaming-first）
- 工具安全：非 yolo 模式下破坏性操作需审批
- Rust workspace snapshot 系统使用 side-git repos（`~/.deepseek/snapshots/`）
- TypeScript 使用 ESM（`"type": "module"`），包间通过 `@yunpat/*` 命名空间引用
- Agent 接口统一通过 `base` agent 包的 trait/接口定义
- 测试：TypeScript 用 Vitest，Rust 用标准 `#[cfg(test)]` + `tests/` 目录
