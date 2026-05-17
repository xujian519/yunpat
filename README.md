# 云熙知识产权智能体 (YunPat Agent)

> 面向知识产权全生命周期的智能体操作系统
>
> **技术栈**: Rust（交互层） + TypeScript（业务层 + Agent 编排）
>
> **作者**: 徐健 <xujian519@gmail.com>

---

## 项目架构

```
yunpat-agent/                          ← 统一 Monorepo
├── crates/                            ← Rust 工作区（workspace members: 19）
│   └── crates/                        ← Rust crate 实际目录
│       ├── tui/                       ← TUI 主运行时（crate: yunpat-tui）
│       ├── cli/                       ← CLI 入口（crate: yunpat-cli）
│       ├── core/                      ← 核心运行时（crate: yunpat-core）
│       ├── app-server/                ← HTTP/SSE 无头服务（crate: yunpat-app-server）
│       ├── config/                    ← 配置管理（crate: yunpat-config）
│       ├── yunpat-agents/             ← 专利领域 Agent trait 系统
│       ├── yunpat-router/             ← 意图路由和命令分发
│       ├── yunpat-mcp-bridge/         ← MCP Rust-TS 桥接
│       ├── yunpat-patent-tui/         ← 专利 TUI 模块（从 tui 提取）
│       └── ...                        ← execpolicy、hooks、mcp、state、tools 等
│
├── packages/packages/                 ← TypeScript 业务层
│   ├── core/                          ← Agent 框架核心（~55K 行）
│   ├── orchestrator/                  ← 专业 Agent 中央调度与编排
│   ├── agents/                        ← 专业 Agent 包集合
│   │   ├── patent-responder/          ← OA 审查意见答复
│   │   ├── patent-manager/            ← 专利全生命周期管理
│   │   ├── invention/                 ← 交底书分析与理解
│   │   ├── claim-generator/           ← 权利要求生成
│   │   ├── specification-drafter/     ← 说明书撰写
│   │   ├── search/                    ← 专利检索
│   │   └── ...                        ← 其余 18 个专业 Agent
│   ├── mcp-server/                    ← MCP 协议服务端
│   ├── patent-database/               ← 专利数据库（Drizzle ORM）
│   ├── document-tools/                ← 文档解析（PDF/DOCX/Excel）
│   └── ...
│
├── constitutional/                    ← 宪法规则引擎（YAML）
├── knowledge-base/                    ← 专利知识库（可选：默认路径由 KNOWLEDGE_BASE_PATH 指定）
├── docs/                              ← 项目文档
└── examples/                          ← 示例代码
```

**通信机制**：Rust 层与 TypeScript 层通过 **MCP (Model Context Protocol) stdio** 通信。

---

## 快速开始

### 前置要求

- **Rust** 1.88+ ([rustup.rs](https://rustup.rs/))
- **Node.js** 18+ 和 **pnpm** 8+ ([pnpm.io](https://pnpm.io/installation))

### 安装与构建

```bash
# 克隆仓库
git clone https://github.com/xujian519/yunpat-agent.git
cd yunpat-agent

# 安装依赖
make install

# 构建 Rust + TypeScript
make build
```

### 运行

```bash
# 启动 TUI
make run

# 开发模式（热重载）
make dev
```

---

## 开发命令

| 命令 | 说明 |
|------|------|
| `make install` | 安装 Rust + Node.js 依赖 |
| `make build` | 构建全部（Rust + TypeScript） |
| `make build-rust` | 仅构建 Rust（release） |
| `make build-ts` | 仅构建 TypeScript |
| `make test` | 运行全部测试 |
| `make test-rust` | cargo test --workspace |
| `make test-ts` | pnpm test |
| `make lint` | cargo clippy + pnpm lint |
| `make format` | cargo fmt + prettier |
| `make dev` | 开发模式（热重载） |
| `make run` | 启动 TUI |

### 单包操作

```bash
# Rust 单 crate
cargo test -p yunpat-agents
cargo clippy -p yunpat-mcp-bridge

# TypeScript 单包
pnpm --filter @yunpat/core test
pnpm --filter @yunpat/mcp-server dev
```

---

## 技术栈

### Rust 层

| Crate | 说明 |
|-------|------|
| `yunpat-tui` | TUI 主运行时（ratatui），含引擎、工具、LLM 客户端 |
| `yunpat-cli` | CLI 入口 |
| `yunpat-core` | 核心运行时（会话管理、Turn 编排） |
| `yunpat-app-server` | HTTP/SSE + JSON-RPC 无头 Agent 服务 |
| `yunpat-agents` | 专利领域 Agent trait 系统 |
| `yunpat-router` | 意图路由和命令分发 |
| `yunpat-mcp-bridge` | MCP Rust-TS 桥接 |
| `yunpat-config` | 配置管理（profiles、环境变量） |
| `yunpat-state` | SQLite 会话持久化 |
| `yunpat-execpolicy` | 审批/沙箱策略引擎 |
| `yunpat-hooks` | 生命周期钩子 |
| `yunpat-patent-tui` | 专利 TUI 模块（从 tui 提取） |

### TypeScript 层

| Package | 说明 |
|---------|------|
| `@yunpat/core` | Agent 框架核心（~55K 行） |
| `@yunpat/orchestrator` | Agent 中央调度系统 |
| `@yunpat/mcp-server` | MCP 协议服务端 |
| `@yunpat/patent-database` | 专利数据库（Drizzle ORM） |
| `@yunpat/document-tools` | 文档解析（PDF/DOCX/Excel/图片） |
| `@yunpat/patent-tools` | 专利工具（权利要求、质量评估） |
| `@yunpat/skills` | 模块化提示词管理 |
| `@yunpat/orchestrator-adapter` | Rust Gateway → Node.js 桥接 |

### 24 个专业 Agent

| Agent | 职责 |
|-------|------|
| `patent-responder` | OA 审查意见答复与策略生成 |
| `patent-manager` | 专利全生命周期管理与监控 |
| `invention` | 交底书分析与结构化理解 |
| `search` | 专利检索策略生成与执行 |
| `specification-drafter` | 分章节撰写专利说明书 |
| `quality-checker` | 专利申请质量评估 |
| `claim-generator` | 权利要求撰写 |
| `patent-analyzer` | 专利文献深度分析 |
| `analysis` | 现有技术对比分析 |
| `quality` | 一致性检查 |
| `writer` | 专利撰写（集成知识库） |
| `prior-art-search` | 现有技术检索 |
| 其余 12 个 | 涵盖格式检查、图像理解、法律问答、摘要撰写等 |

---

## 数据主权

技术交底书等敏感内容**禁止**发送到外部 API。宪法规则引擎（`constitutional/`）自动检测并阻止违规操作。

---

## 文档

- [架构设计](./docs/architecture.md)
- [开发指南](./docs/development.md)
- [API 文档](./docs/api.md)
- [部署指南](./docs/deployment.md)
- [环境配置](./docs/SETUP_GUIDE.md)

---

## 许可证

[MIT](LICENSE)

---

**作者**: 徐健 <xujian519@gmail.com>
