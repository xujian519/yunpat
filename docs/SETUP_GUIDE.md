# 云熙知识产权智能体 - 环境与运行配置指南

> 目标：把仓库从“克隆完成”推进到“本地可构建、可运行、可验证”。
>
> 最后更新：2026-05-12

---

## 1. 前置要求

- Rust：1.88+（仓库 workspace 已声明 `rust-version = 1.88`）
- Node.js：18+（推荐 20）
- pnpm：8+

---

## 2. 安装依赖

在仓库根目录执行：

```bash
make install
```

说明：

- Rust 依赖由 Cargo 在构建时自动拉取
- Node.js 依赖在 `packages/` 目录执行 `pnpm install`

---

## 3. 环境变量（必做）

本项目同时包含 Rust 交互层与 TypeScript 业务层，两边各自有环境变量模板：

```bash
cp .env.example .env
cp packages/.env.example packages/.env
```

至少配置一个 LLM Key（示例：DeepSeek）：

- `.env`：`DEEPSEEK_API_KEY=...`
- `packages/.env`：`DEEPSEEK_API_KEY=...`

---

## 4. 知识库（可选，但多数专利流程建议配置）

TypeScript 侧默认通过 `packages/.env` 的 `KNOWLEDGE_BASE_PATH` 读取知识库，默认值为：

```text
./knowledge-base
```

建议做法：

- 将知识库目录放在仓库根目录 `knowledge-base/`（本仓库不强制包含该目录）
- 通过 `KNOWLEDGE_BASE_PATH` 指向实际位置（可用绝对路径或相对路径）

---

## 5. 本地构建与运行

### 5.1 构建

```bash
make build
```

### 5.2 启动（TUI）

```bash
make run
```

### 5.3 开发模式（watch）

```bash
make dev
```

说明：该模式会并行启动 Rust `cargo watch`、TypeScript `pnpm build:watch` 与 MCP Server 的 `tsc --watch`。

---

## 6. 验证（建议）

```bash
make test
make lint
```

---

## 7. Docker（可选）

仓库已包含 `Dockerfile` 与 `docker-compose.yml`。常用命令：

```bash
docker-compose build
docker-compose up -d
docker-compose ps
docker-compose logs -f
docker-compose down
```

---

## 8. GitHub Secrets（仅 CI/CD 需要）

如果启用 GitHub Actions，请至少配置：

- `DEEPSEEK_API_KEY`（或你实际使用的 provider key）
- 其他发布类 token（如 npm、crates.io）仅在发布流程中需要
