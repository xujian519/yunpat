# 开发指南

> 云熙知识产权智能体（YunPat Agent）开发指南
>
> 最后更新：2026-05-09

本指南面向新加入的开发者，帮助你从零开始搭建开发环境并高效参与项目开发。

---

## 目录

1. [环境要求](#1-环境要求)
2. [快速开始](#2-快速开始)
3. [项目目录结构](#3-项目目录结构)
4. [开发工作流](#4-开发工作流)
5. [代码规范](#5-代码规范)
6. [测试策略](#6-测试策略)
7. [添加新 Agent](#7-添加新-agent-指南)
8. [添加新 Rust Crate](#8-添加新-rust-crate-指南)
9. [配置文件](#9-配置文件)
10. [常见问题](#10-常见问题)

---

## 1. 环境要求

### 1.1 基础工具

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Rust | 1.88+ | 需要 `let_chains` 特性，已在 Rust 1.88 稳定化 |
| Node.js | 18+ | TypeScript 运行时 |
| pnpm | 8+ | 包管理器（本项目使用 pnpm workspace） |
| Git | 任意 | 版本控制 |

### 1.2 操作系统

推荐 macOS，也支持 Linux。Windows 支持有限。

### 1.3 系统依赖（Ubuntu/Debian）

在 Ubuntu 上编译 Rust 和 OCR 相关功能需要以下系统库：

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    pkg-config \
    libdbus-1-dev \
    libleptonica-dev \
    libtesseract-dev \
    tesseract-ocr
```

macOS 用户通常只需安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

---

## 2. 快速开始

### 2.1 克隆仓库

```bash
git clone https://github.com/xujian519/yunpat-agent.git
cd yunpat-agent
```

### 2.2 安装依赖

```bash
make install
```

该命令会：
- 检查并安装 Rust 工具链（如未安装）
- 在 `packages/` 目录执行 `pnpm install`

### 2.3 构建全部

```bash
make build
```

该命令会并行构建 Rust（release 模式）和 TypeScript 组件。

### 2.4 启动开发模式

```bash
make dev
```

使用 `concurrently` 并行启动三个进程：
- Rust `cargo watch` 自动重建
- TypeScript `esbuild watch` 模式
- MCP Server 开发服务器

按 `Ctrl+C` 停止全部进程。

### 2.5 验证安装

```bash
# 方式一：从源码运行 CLI（workspace bin: yunpat）
cargo run --bin yunpat -- --version

# 方式二：启动 TUI（workspace bin: yunpat-tui）
cargo run --bin yunpat-tui
```

---

## 3. 项目目录结构

```
yunpat-agent/
├── crates/                    ← Rust 工作区（workspace root 在仓库根目录）
│   └── crates/                ← Rust crate 实际目录
│       ├── cli/               ← CLI 入口（bin: yunpat）
│       ├── tui/               ← 主 TUI 运行时（bin: yunpat-tui）
│       ├── core/              ← 核心运行时（会话管理、工具调度）
│       ├── app-server/        ← HTTP/SSE 无头服务
│       ├── config/            ← 配置加载与 profiles
│       ├── state/             ← SQLite 持久化
│       ├── execpolicy/        ← 审批/沙箱策略引擎
│       ├── mcp/               ← MCP 协议客户端
│       ├── tools/             ← 工具注册表
│       ├── hooks/             ← 生命周期钩子
│       ├── protocol/          ← 请求/响应协议类型
│       ├── secrets/           ← OS keyring API key 存储
│       ├── yunpat-agents/     ← 专利领域 Agent trait 系统
│       ├── yunpat-models/     ← 多提供商 ModelProvider 接口
│       ├── yunpat-mcp-bridge/ ← Rust 调用 TS Agent 的桥接
│       └── yunpat-router/     ← 意图路由和命令分发
│
├── packages/                  ← TypeScript 工作区
│   ├── packages/              ← 基础设施包（20 个）
│   │   ├── core/              ← 核心框架（Agent 抽象、EventBus、LLM）
│   │   ├── orchestrator/      ← 智能体编排器
│   │   ├── mcp-server/        ← MCP 协议服务端
│   │   ├── cli/               ← CLI 工具
│   │   ├── builtin-tools/     ← 文件操作、搜索、网络请求
│   │   ├── patent-tools/      ← 权利要求生成、专利检索
│   │   ├── document-tools/    ← PDF/DOCX/Excel/OCR 解析
│   │   ├── patent-database/   ← 7500 万 CN 专利数据库
│   │   ├── patent-knowledge/  ← Obsidian 知识库桥接
│   │   ├── patent-prompts/    ← 提示词模板管理器
│   │   ├── skills/            ← 模块化 prompt/skill 系统
│   │   ├── tui/               ← React/Ink 风格终端 UI
│   │   └── ...
│   └── packages/agents/       ← 专业 Agent 包（29 个）
│       ├── base/              ← ProfessionalAgent 基类
│       ├── patent-writer/     ← 专利撰写（最成熟）
│       ├── patent-analyzer/   ← 专利分析 V2
│       ├── patent-responder/  ← 审查意见答复 V5
│       ├── patent-manager/    ← 专利生命周期管理
│       ├── search/            ← 专利检索 V3
│       ├── invention/         ← 发明理解
│       ├── quality/           ← 质量检查
│       ├── claim-generator/   ← 权利要求生成
│       ├── specification-drafter/ ← 说明书撰写
│       ├── image-understanding/   ← 附图理解
│       ├── legal-qa/          ← 法律知识问答
│       └── ...
│
├── knowledge-base/            ← 专利知识库（可选：默认由 packages/.env 的 KNOWLEDGE_BASE_PATH 指定）
├── constitutional/            ← 宪法规则文件（YAML）
├── docs/                      ← 文档
├── scripts/                   ← 构建脚本（CI、部署、验证）
├── examples/                  ← TypeScript 使用示例
├── protos/                    ← gRPC/Protobuf 定义
├── config/                    ← 环境变量模板、写作风格配置
├── docker/                    ← Docker 配置（Grafana、Prometheus）
└── services/                  ← 独立微服务
```

---

## 4. 开发工作流

### 4.1 构建命令

```bash
# 构建全部（Rust release + TypeScript）
make build

# 仅构建 Rust（release 模式）
make build-rust

# 仅构建 Rust（debug 模式，更快）
make build-rust-debug

# 仅构建 TypeScript
make build-ts
```

#### 单 crate / 单包构建

```bash
# Rust 单 crate
cargo build -p yunpat-agents

# TypeScript 单包
pnpm --filter @yunpat/core build
```

#### 构建系统要点

- `make build` 中 Rust 使用 `cargo build --workspace --release`
- TypeScript 使用 esbuild 构建，速度约为 tsc 的 30 倍
- `pnpm build:tsc` 使用 tsc 编译所有包，用于类型检查
- esbuild 构建后会运行类型检查，失败将导致构建失败
- TUI 相关包使用 `pnpm tui:build` 构建

### 4.2 开发模式

```bash
make dev
```

该命令使用 `concurrently` 并行运行三个服务：

| 进程 | 说明 | 颜色 |
|------|------|------|
| rust | `cargo watch -x 'build'` | 青色 |
| tsc | `pnpm build:watch` | 品红 |
| mcp | MCP Server 开发服务器 | 绿色 |

按 `Ctrl+C` 停止全部进程，`--kill-others` 参数会确保一个进程退出时其他进程也被终止。

### 4.3 运行

```bash
# 启动 TUI（等于 cargo run --bin deepseek）
make run

# 启动 HTTP 服务
deepseek serve --http

# 启动 ACP 适配器（供 Zed 等编辑器使用）
deepseek serve --acp

# 列出可用命令
make help
```

---

## 5. 代码规范

### 5.1 Rust

```bash
# 格式化
cargo fmt --all

# Lint
cargo clippy --workspace --all-targets --all-features

# 测试
cargo test --workspace --all-features

# 单测试
cargo test -p deepseek-core -- test_turn_loop
```

Rust 使用 2024 edition，workspace resolver v2。所有 crate 必须能在 stable Rust 上编译，禁止使用 nightly 特性。

### 5.2 TypeScript

```bash
# 格式化
pnpm format

# Lint
pnpm lint

# 全量测试
pnpm test

# Mock 模式（不调用真实 API，适合 CI）
pnpm test:mock

# 真实 LLM 模式（需要 API key）
pnpm test:real

# 单包测试
pnpm --filter @yunpat/core test
```

TypeScript 配置：
- 模块系统：ESM（`"type": "module"`）
- 目标：ES2022
- 严格模式：`strict: true`
- 模块解析：`bundler`
- 导入必须带 `.js` 扩展名（ESM 规范）：`import { foo } from './bar.js'`

#### Prettier 配置

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

### 5.3 通用规范

提交前建议运行：

```bash
make lint && make format && make test
```

#### 提交规范（Conventional Commits）

```
<type>(<scope>): <subject>

类型: feat | fix | docs | style | refactor | test | chore | ci | perf | revert | bump
```

commit-msg hook 会检查格式并询问确认。

#### Pre-commit（Husky + lint-staged）

- TS/JS 文件：ESLint + Prettier
- JSON/MD/YAML 文件：Prettier

#### Pre-push

- 运行 `scripts/ci-check.sh`（完整构建 + 测试）

---

## 6. 测试策略

### 6.1 Rust 测试

- 框架：标准 `#[cfg(test)]` + `tests/` 目录
- 运行：`cargo test --workspace --all-features`

### 6.2 TypeScript 测试

- 框架：Vitest
- 配置：`packages/core/vitest.config.ts`
- 超时：30 秒
- 覆盖率阈值：lines 80%, functions 80%, branches 75%

#### 测试模式

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行所有包的测试脚本（多数包为占位） |
| `pnpm test:mock` | Mock 模式，不调用真实 API，适合 CI |
| `pnpm test:real` | 真实 LLM 模式，需要 API key |
| `pnpm test:unit` | 标准 vitest --run |

#### 关键测试路径

```bash
# 数据主权检测
cd packages/packages/core && npx vitest run test/constitutional/DataSovereigntyChecker.test.ts

# MCP E2E 测试
cd packages/packages/mcp-server && npx vitest run test/e2e.test.ts

# Intent Hook 手动验证
echo '{"event":"message_submit","message":"检索XXX专利","mode":"general"}' | npx tsx packages/packages/orchestrator-adapter/src/intent-hook.ts
```

#### 重要提示

- 核心包 `@yunpat/core` 拥有 90 个测试文件，是测试最完善的包
- 其他包的 `test` 脚本大多是占位 `echo "Test not implemented yet"`
- 真实 LLM 测试需要设置环境变量 `RUN_REAL_LLM_TESTS=true`
- Mock 测试通过 `MOCK_TESTS=true` 启用

---

## 7. 添加新 Agent 指南

### 7.1 步骤

1. 在 `packages/packages/agents/` 下创建新目录
2. 创建 `package.json` 并声明依赖（至少依赖 `@yunpat/agent-base`）
3. 继承 `ProfessionalAgent` 基类
4. 实现 `act()` 方法
5. 在 `src/index.ts` 中导出
6. （可选）注册到 Orchestrator
7. 编写测试（Mock + Real）

### 7.2 示例代码框架

```typescript
// packages/packages/agents/my-agent/src/MyAgent.ts
import { ProfessionalAgent } from '@yunpat/agent-base'

export class MyCustomAgent extends ProfessionalAgent {
  constructor(config: AgentConfig) {
    super({
      name: 'my-custom-agent',
      description: '我的自定义智能体',
      ...config,
    })
  }

  protected async act(input: any, context: any): Promise<AgentResult> {
    // 1. 参数校验
    // 2. 调用 LLM 或其他工具
    // 3. 返回结果
    const result = await this.callLLM(prompt)
    return {
      success: true,
      data: result,
      executionTime: Date.now() - startTime,
    }
  }
}
```

### 7.3 Agent 基类继承体系

```
Agent (packages/core)                    ← 基类，plan() + act() 抽象方法
  └── KnowledgeEnhancedAgent (core)      ← 内置知识库集成
        └── ProfessionalAgent (agent-base) ← 简化接口，run() -> AgentResult
              ├── PatentWriterAgent
              ├── PatentAnalyzerAgent
              ├── PatentResponderAgent
              └── ...
```

### 7.4 注意事项

- 禁止在 `packages/core` 中添加业务逻辑（只放通用能力）
- 禁止智能体之间直接调用，必须使用 EventBus
- 禁止硬编码 API Key、本地路径等敏感信息
- ESM 导入必须带 `.js` 扩展名

---

## 8. 添加新 Rust Crate 指南

### 8.1 步骤

1. 在 `crates/` 下创建新目录（如 `crates/my-crate/`）
2. 创建 `Cargo.toml`，继承 workspace 配置：

```toml
[package]
name = "my-crate"
version.workspace = true
edition.workspace = true
rust-version.workspace = true
license.workspace = true
repository.workspace = true

[dependencies]
# 使用 workspace 共享依赖
anyhow.workspace = true
tokio.workspace = true
serde.workspace = true
```

3. 在根 `Cargo.toml` 的 `[workspace].members` 中注册：

```toml
members = [
    # ... 现有 crate
    "crates/my-crate",
]
```

4. 如需跨 crate 共享依赖，添加到 `[workspace.dependencies]`
5. 运行 `cargo build -p my-crate` 验证编译

### 8.2 注意事项

- 所有 crate 必须能在 stable Rust 上编译
- 禁止使用 `#![feature(...)]` 或 nightly 特性
- 遵循现有 crate 的命名和结构风格

---

## 9. 配置文件

### 9.1 Rust 配置

| 路径 | 作用 |
|------|------|
| `~/.deepseek/config.toml` | 全局用户配置（API key、模型选择、locale 等） |
| `.deepseek/config.toml` | 项目级配置（覆盖全局，但不能覆盖 api_key、base_url、provider、mcp_config_path） |

配置示例见 `config.example.toml`。

### 9.2 MCP 配置

| 路径 | 作用 |
|------|------|
| `~/.deepseek/mcp.json` | MCP Server 配置 |

### 9.3 Skills 配置

| 路径 | 作用 |
|------|------|
| `~/.deepseek/skills/` | 全局 skill 目录 |
| `.agents/skills/` / `.claude/skills/` / `.cursor/skills/` | 工作区 skill 目录 |

### 9.4 环境变量

创建 `.env` 文件（已包含在 `.gitignore` 中，不会提交）：

```bash
# 至少配置一个 LLM API Key
DEEPSEEK_API_KEY=sk-...
DASHSCOPE_API_KEY=sk-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# 本地模型（可选）
OLLAMA_BASE_URL=http://localhost:11434

# 数据库（可选，默认使用 SQLite）
DATABASE_URL=postgresql://user:password@localhost:5432/patent_db
REDIS_URL=redis://localhost:6379

# MCP 配置
MCP_TIMEOUT=300
MCP_MAX_RETRIES=3
```

### 9.5 TypeScript 配置

- 基础配置：`tsconfig.base.json`
- 各包继承基础配置
- 关键选项：`"target": "ES2022"`, `"module": "ESNext"`, `"strict": true`, `"moduleResolution": "bundler"`

---

## 10. 常见问题

### Q1: Rust 编译太慢

**解决方案：**
- 开发时使用 `cargo check` 代替 `cargo build`，跳过代码生成阶段
- 启用 sccache 缓存编译产物
- 仅构建需要的 crate：`cargo build -p <crate-name>`
- 使用 `make build-rust-debug` 代替 release 构建

### Q2: TypeScript 类型错误

**解决方案：**
- 确保先构建依赖包：`pnpm build`
- 运行类型检查：`node esbuild.config.mjs check`
- 检查 `tsconfig.json` 是否正确继承基础配置

### Q3: MCP 连接问题

**解决方案：**
- 检查 `~/.deepseek/mcp.json` 配置是否正确
- 验证 MCP Server 是否已启动
- 检查端口是否被占用

### Q4: 知识库缺失

**解决方案：**
- 知识库目录 `knowledge-base/` 不提交 git
- 参考 `docs/SETUP_GUIDE.md` 初始化知识库
- 确保 `KNOWLEDGE_BASE_PATH` 环境变量指向正确路径

### Q5: pnpm 安装失败

**解决方案：**
- 确保 pnpm 版本 >= 8：`pnpm --version`
- 清除缓存重试：`pnpm store prune && pnpm install`
- 检查 Node.js 版本 >= 18：`node --version`

### Q6: 测试需要 API Key

**解决方案：**
- 复制环境变量模板：`cp .env.example .env`
- 编辑 `.env` 填入至少一个 LLM API Key
- 或使用 Mock 模式：`pnpm test:mock`

### Q7: Docker 构建失败

**解决方案：**
- 检查 Docker 内存限制（Rust 编译需要大量内存）
- 清理 Docker 缓存：`docker system prune -a`
- 重新构建：`docker-compose build --no-cache`

---

## 相关文档

- [架构设计](./architecture.md) — 系统架构详情
- [API 文档](./api.md) — API 接口参考
- [部署指南](./deployment.md) — 生产环境部署
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — 完整安装配置指南

---

**作者**: 徐健 <xujian519@gmail.com>  
**项目**: 云熙知识产权智能体 (YunPat Agent)
