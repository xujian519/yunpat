# 云熙知识产权智能体 (YunPat Agent)

> **技术栈**: Rust（交互层 + 规则引擎） + TypeScript（业务层 + Agent编排）
>
> **作者**: 徐健 <xujian519@gmail.com>

---

## 🏛️ 项目架构

```
yunpat-agent/                          ← 统一仓库
├── crates/                             ← 🦀 Rust 基础设施层
│   ├── cli/                            ← CLI 入口
│   ├── tui/                            ← TUI 终端界面
│   ├── core/                           ← 核心运行时
│   ├── constitutional/                 ← 规则引擎（新增）
│   ├── tools/                          ← 工具注册表
│   ├── mcp/                            ← MCP 客户端
│   └── ...
│
├── packages/                           ← 🔷 TypeScript 业务层
│   ├── core/                           ← 核心框架
│   ├── orchestrator/                   ← 智能体编排器
│   ├── agents/                         ← 29 个专业 Agent
│   │   ├── patent-writer/              ← 专利撰写
│   │   ├── patent-search/              ← 专利检索
│   │   ├── patent-responder/           ← 审查答复
│   │   └── ...
│   ├── mcp-server/                     ← MCP 服务端
│   └── ...
│
├── knowledge-base/                     ← 📚 专利知识库（4382 个文件）
├── constitutional/                     ← ⚖️ 宪法规则文件
├── docs/                               ← 📖 统一文档
└── scripts/                            ← 🔧 构建脚本
```

---

## 🚀 快速开始

### 前置要求

- **Rust** 1.88+ ([安装指南](https://rustup.rs/))
- **Node.js** 18+ 和 **pnpm** 8+ ([安装指南](https://pnpm.io/installation))
- **Git**

### 安装开发环境

```bash
# 克隆仓库
git clone https://github.com/xujian519/yunpat-agent.git
cd yunpat-agent

# 一键安装所有依赖
make install

# 验证安装
deepseek doctor
```

### 构建全部

```bash
# 构建 Rust + TypeScript
make build

# 仅构建 Rust
make build-rust

# 仅构建 TypeScript
make build-ts
```

### 启动开发模式

```bash
# 并行启动所有服务（TUI + MCP Server + TypeScript Watch）
make dev
```

### 运行

```bash
# 启动 TUI
make run

# 或使用 cargo
cargo run --bin deepseek
```

---

## 🛠️ 开发命令

| 命令              | 说明                          |
| ----------------- | ----------------------------- |
| `make install`    | 安装 Rust + Node.js 依赖      |
| `make build`      | 构建全部（Rust + TypeScript） |
| `make build-rust` | 仅构建 Rust                   |
| `make build-ts`   | 仅构建 TypeScript             |
| `make test`       | 运行全部测试                  |
| `make test-rust`  | 运行 Rust 测试                |
| `make test-ts`    | 运行 TypeScript 测试          |
| `make lint`       | 代码检查                      |
| `make format`     | 代码格式化                    |
| `make clean`      | 清理构建产物                  |
| `make dev`        | 开发模式（热重载）            |
| `make run`        | 运行 TUI                      |

---

## 📦 技术栈

### Rust 层（crates/）

| Crate                 | 说明                             |
| --------------------- | -------------------------------- |
| `deepseek-tui`        | 终端用户界面（ratatui）          |
| `deepseek-core`       | 核心运行时（会话管理、工具调度） |
| `deepseek-tools`      | 工具注册表                       |
| `deepseek-mcp`        | MCP 协议客户端                   |
| `deepseek-execpolicy` | 执行策略引擎                     |
| `deepseek-config`     | 配置管理                         |

### TypeScript 层（packages/）

| Package                    | 说明           |
| -------------------------- | -------------- |
| `@yunpat/core`             | 智能体核心框架 |
| `@yunpat/orchestrator`     | 任务编排器     |
| `@yunpat/patent-writer`    | 专利撰写 Agent |
| `@yunpat/patent-search`    | 专利检索 Agent |
| `@yunpat/patent-responder` | 审查答复 Agent |
| `@yunpat/mcp-server`       | MCP 协议服务端 |

---

## 🔌 通信机制

Rust 层与 TypeScript 层通过 **MCP（Model Context Protocol）** 通信：

```
Rust TUI/CLI
    ↓ MCP stdio
TypeScript MCP Server
    ↓ 内部调用
Agent 编排器
    ↓ 执行任务
专利数据库 / LLM API
```

---

## 📚 文档

- [架构设计](./docs/architecture.md)
- [开发指南](./docs/development.md)
- [API 文档](./docs/api.md)
- [部署指南](./docs/deployment.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

---

## 📄 许可证

[MIT](LICENSE)

---

**作者**: 徐健 <xujian519@gmail.com>
**项目**: 云熙知识产权智能体 (YunPat Agent)
