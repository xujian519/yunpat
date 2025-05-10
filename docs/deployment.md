# 部署指南

> 云熙知识产权智能体 (YunPat Agent) 部署与运维指南
>
> 最后更新: 2026-05-09

## 目录

- [部署架构概览](#部署架构概览)
- [Docker 部署](#docker-部署)
- [环境变量配置](#环境变量配置)
- [数据库配置](#数据库配置)
- [CI/CD 流程](#cicd-流程)
- [监控体系](#监控体系)
- [健康检查](#健康检查)
- [扩展策略](#扩展策略)
- [故障排查](#故障排查)

---

## 部署架构概览

YunPat Agent 采用多语言微服务架构, 通过 Docker Compose 编排运行。服务栈包含核心编排服务、专业 Agent 服务、数据存储层和监控组件。

```
┌─────────────────────────────────────────────────────────┐
│  Docker Compose 服务栈                                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ orchestrator │  │   patent-    │  │   patent-    │  │
│  │  (端口3000)   │  │  responder   │  │   analyzer   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         └────────┬────────┴──────────┬──────┘          │
│                  ↓                   ↓                  │
│         ┌────────────┐     ┌──────────────┐            │
│         │  PostgreSQL │     │    Redis     │            │
│         │  (端口5432)  │     │  (端口6379)  │            │
│         └────────────┘     └──────────────┘            │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │  Prometheus  │  │   Grafana    │                     │
│  │  (端口9090)   │  │  (端口3001)  │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### 服务角色说明

| 服务 | 技术栈 | 职责 |
|------|--------|------|
| orchestrator | TypeScript/Node.js | 核心编排服务, 负责意图识别、任务调度、Agent 生命周期管理 |
| patent-responder | TypeScript/Node.js | 审查意见答复服务, 处理专利审查意见自动答复 |
| patent-analyzer | TypeScript/Node.js | 专利分析服务, 专利文献深度分析和新创性评估 |
| patent-search | TypeScript/Node.js | 专利检索服务, 专利数据库检索和现有技术分析 |
| postgres | PostgreSQL 15 | 主数据库, 存储专利数据、会话状态、配置 |
| redis | Redis 7 | 缓存和消息队列, 共享状态层 |
| prometheus | Prometheus v2.45 | 监控指标收集, 时间序列数据存储 |
| grafana | Grafana 10.0 | 监控仪表盘, 可视化展示系统指标 |

---

## Docker 部署

### 2.1 Rust TUI Dockerfile (crates/Dockerfile)

Rust TUI 采用多阶段构建, 最小化运行时镜像体积。

**构建阶段** (`rust:1.88-slim-bookworm`):

- 安装构建依赖: `pkg-config`, `libdbus-1-dev`
- 支持多平台交叉编译: `linux/amd64` 和 `linux/arm64`
- 自动将 Docker 平台映射到 Rust 目标三元组
- 使用 `--locked` 确保从 `Cargo.lock` 可复现构建
- 利用缓存挂载加速重复构建

**运行时阶段** (`debian:bookworm-slim`):

- 安装运行时依赖: `ca-certificates`, `libdbus-1-3`
- 创建非 root 用户 `deepseek` (UID/GID 1000)
- 仅复制 `deepseek` 和 `deepseek-tui` 两个二进制文件
- 入口点为 `deepseek` dispatcher

**构建命令**:

```bash
# 单平台构建
docker build -t yunpat-tui:latest crates/

# 多平台构建 (需要 buildx)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yunpat-tui:latest crates/
```

**运行命令**:

```bash
# 交互模式
docker run --rm -it \
  -e DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY \
  -v ~/.deepseek:/home/deepseek/.deepseek \
  yunpat-tui:latest

# 使用环境文件
docker run --rm -it --env-file .env yunpat-tui:latest
```

### 2.2 TypeScript 多阶段 Dockerfile (packages/Dockerfile)

TypeScript 服务栈采用四阶段构建, 分离 Rust Gateway 和 Node.js 服务。

**阶段 0: Rust Gateway 构建** (`rust:1.80-alpine`)

- 安装 `musl-dev` 和 `openssl-dev`
- 复制 `packages/rust-gateway/` 源码
- 构建 release 二进制文件

**阶段 1: Node.js 依赖安装** (`node:18-alpine`)

- 安装 `python3`, `make`, `g++` 等构建工具
- 安装 `pnpm@10`
- 复制 `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`
- 安装所有依赖 (包括 devDependencies)
- 提取生产依赖到单独层

**阶段 2: TypeScript 构建** (`node:18-alpine`)

- 从阶段 1 复制依赖缓存
- 复制 `tsconfig.base.json`, `esbuild.config.mjs`
- 复制所有 `packages/` 源代码
- 按依赖顺序构建核心包: `@yunpat/core` → `@yunpat/orchestrator` → ...

**阶段 3: 生产镜像** (`node:18-alpine`)

- 安装 `dumb-init` (PID 1 管理) 和 `ca-certificates`
- 创建非 root 用户 `yunpat` (UID 1001)
- 复制生产依赖和构建产物 (仅 `dist/` 目录)
- 复制 Rust Gateway 二进制到 `/usr/local/bin/`
- 复制配置文件和提示词模板
- 设置环境变量: `NODE_ENV=production`, `NODE_OPTIONS="--max-old-space-size=512"`
- 暴露端口: 8080 (HTTP), 3001 (gRPC/内部)
- 健康检查: 每 30 秒检查 `http://localhost:8080/internal/health`

**构建命令**:

```bash
cd packages
docker build -t yunpat-agent:latest --target production .
```

### 2.3 Docker Compose 快速开始

#### 前置准备

```bash
# 1. 克隆仓库
git clone https://github.com/xujian519/yunpat-agent.git
cd yunpat-agent/packages

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API 密钥 (至少配置一个 LLM 提供商)

# 3. 确认 Docker 和 Docker Compose 已安装
docker --version
docker-compose --version
```

#### 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志 (实时)
docker-compose logs -f orchestrator
docker-compose logs -f patent-responder

# 停止所有服务
docker-compose down

# 完全重建 (清除数据卷)
docker-compose down -v && docker-compose up -d --build
```

#### 服务列表

| 服务 | 端口 | 说明 |
|------|------|------|
| orchestrator | 3000 | 核心编排服务, HTTP API 入口 |
| patent-responder | (内部) | 审查意见答复服务 |
| patent-analyzer | (内部) | 专利分析服务 |
| patent-search | (内部) | 专利检索服务 |
| postgres | 5432 | PostgreSQL 数据库 |
| redis | 6379 | 缓存和消息队列 |
| prometheus | 9090 | 监控指标收集 |
| grafana | 3001 | 监控仪表盘 |

#### 网络架构

所有服务通过 Docker Bridge 网络 `yunpat-network` 互联:

- 服务间通过容器名通信 (如 `postgres`, `redis`)
- 外部访问通过端口映射
- 健康检查在同一网络内执行

#### 数据持久化

| 服务 | 卷名 | 说明 |
|------|------|------|
| postgres | postgres-data | 数据库文件 |
| redis | redis-data | AOF 持久化数据 |
| prometheus | prometheus-data | 时间序列数据 |
| grafana | grafana-data | 仪表盘配置 |

---

## 环境变量配置

环境变量通过 `.env` 文件管理, Docker Compose 会自动加载同级目录下的 `.env` 文件。

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 (推荐) | `sk-...` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://yunpat:yunpat123@localhost:5432/yunpat` |
| `KNOWLEDGE_BASE_PATH` | 专利知识库路径 | `./knowledge-base` |
| `PROMPT_TEMPLATES_DIR` | 提示词模板目录 | `./prompts/patent-drafting` |

### LLM 提供商 (至少配置一个)

| 变量名 | 说明 | 获取地址 |
|--------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek (推荐, 性价比高) | https://platform.deepseek.com/api_keys |
| `DASHSCOPE_API_KEY` | 通义千问 | https://dashscope.aliyun.com/ |
| `ANTHROPIC_API_KEY` | Claude | https://console.anthropic.com/settings/keys |
| `OPENAI_API_KEY` | OpenAI | https://platform.openai.com/api-keys |
| `GLM_API_KEY` | 智谱 | https://open.bigmodel.cn/ |
| `OLLAMA_BASE_URL` | 本地 Ollama | `http://localhost:11434` |

### 数据库与缓存

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:password@localhost:5432/patent_db` |
| `REDIS_URL` | Redis 连接字符串 | `redis://localhost:6379` |
| `SQLITE_DATABASE_URL` | SQLite 开发环境 | `file:./data/patent.db` |

### 应用配置

| 变量名 | 说明 | 可选值 | 默认值 |
|--------|------|--------|--------|
| `NODE_ENV` | 运行模式 | `development`, `staging`, `production` | `development` |
| `PORT` | 服务端口 | - | `8080` |
| `LOG_LEVEL` | 日志级别 | `debug`, `info`, `warn`, `error` | `info` |
| `MCP_TIMEOUT` | MCP 工具调用超时 (秒) | - | `300` |
| `MCP_MAX_RETRIES` | MCP 最大重试次数 | - | `3` |

### 安全配置

| 变量名 | 说明 | 用途 |
|--------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | API 认证 |
| `ENCRYPTION_KEY` | 数据加密密钥 | 敏感数据加密 |
| `OAUTH_ENCRYPTION_KEY` | OAuth 加密密钥 | OAuth 流程 |

### Docker Compose 特定变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LLM_PROVIDER` | 默认 LLM 提供商 | `anthropic` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | `yunpat_password` |
| `GRAFANA_PASSWORD` | Grafana 管理员密码 | `admin` |

### 环境变量优先级

1. 容器内环境变量 (最高优先级)
2. `.env` 文件
3. 系统环境变量
4. 默认值 (最低优先级)

---

## 数据库配置

### 开发环境: SQLite

SQLite 适合小规模部署 (专利数量 < 1000 件), 零配置, 开箱即用。

```bash
# 配置
SQLITE_DATABASE_URL=file:./data/patent.db
```

**适用场景**:

- 个人用户或小团队 (< 10 人)
- 专利数量 < 1000 件
- 单机部署
- 开发和测试环境

### 生产环境: PostgreSQL

PostgreSQL 适合企业级部署, 支持并发访问和复杂查询。

**连接字符串**:

```
postgresql://yunpat:yunpat123@localhost:5432/yunpat
```

**连接池配置**:

- 并发连接数: 10
- 连接超时: 30 秒
- 空闲连接回收: 60 秒

**适用场景**:

- 企业用户或代理机构 (> 10 人)
- 专利数量 > 1000 件
- 多用户协作
- 生产环境

### Docker 初始化

PostgreSQL 容器启动时会自动创建数据库和用户 (通过 `docker-compose.yml` 中的环境变量):

```yaml
environment:
  - POSTGRES_DB=yunpat
  - POSTGRES_USER=yunpat
  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-yunpat_password}
```

### 数据备份与恢复

```bash
# 备份数据库
docker exec yunpat-postgres pg_dump -U yunpat yunpat > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i yunpat-postgres psql -U yunpat yunpat < backup_20260101.sql

# 压缩备份
docker exec yunpat-postgres pg_dump -U yunpat yunpat | gzip > backup_$(date +%Y%m%d).sql.gz

# 自动备份脚本 (添加到 crontab)
# 0 2 * * * docker exec yunpat-postgres pg_dump -U yunpat yunpat | gzip > /backup/yunpat_$(date +\%Y\%m\%d).sql.gz
```

### 数据库迁移

使用 Drizzle ORM 进行数据库迁移:

```bash
# 生成迁移文件
pnpm db:generate

# 应用迁移
pnpm db:migrate

# 启动 Drizzle Studio (可视化)
pnpm db:studio
```

---

## CI/CD 流程

### GitHub Actions (.github/workflows/ci.yml)

CI 流程分为 4 个阶段, 通过 `needs` 实现依赖控制。

#### 阶段 1: Rust Check

```
checkout → 安装系统依赖 → 安装 Rust 1.88 → 缓存 → 格式检查 → Clippy → 构建 → 测试
```

- 系统依赖: `libdbus-1-dev`, `libleptonica-dev`, `libtesseract-dev`, `tesseract-ocr`, `pkg-config`
- Rust 工具链: 1.88, 组件 `rustfmt`, `clippy`
- Clippy 参数: `-D warnings`, 允许 `uninlined-format-args` 和 `const-is-empty`
- 测试: `cargo test --workspace --all-features`

#### 阶段 2: TypeScript Check

```
checkout → Node.js 20 → pnpm 9 → 缓存 → 安装依赖 → Lint → 格式检查 → 构建 → Mock 测试
```

- Node.js 版本: 20
- pnpm 版本: 9
- 测试模式: Mock (无需 API Key, 适合 CI)

#### 阶段 3: Integration Tests

依赖: Rust Check 和 TypeScript Check 均通过后才执行。

```
checkout → 安装所有依赖 → 构建全部 (Rust release + TS) → MCP 集成测试 → E2E 测试
```

**当前状态**: MCP 集成测试和 E2E 测试标记为 TODO, 待实现。

#### 阶段 4: Release

触发条件: `main` 分支的 push 事件, 且存在 Git tag。

```
checkout → 构建发布产物 → 创建 GitHub Release
```

发布产物包含: `target/release/deepseek` 二进制文件。

### 触发条件

| 事件 | 分支 | 触发阶段 |
|------|------|----------|
| push | `main`, `develop` | Rust Check + TypeScript Check + Integration |
| push | `main` (含 tag) | Release |
| pull_request | `main` | Rust Check + TypeScript Check |

### 本地 CI 模拟

```bash
# Rust 侧
cd crates && cargo fmt --all -- --check
cd crates && cargo clippy --workspace --all-targets --all-features
cd crates && cargo test --workspace --all-features

# TypeScript 侧
cd packages && pnpm lint
cd packages && pnpm format:check
cd packages && pnpm build
cd packages && pnpm test:mock

# 完整 CI (Makefile)
make test
make lint
make build
```

### 发布流程

```bash
# 1. 确保工作区干净
git status

# 2. 运行全部测试
make test

# 3. 构建发布版本
make build

# 4. 创建版本 tag
VERSION=$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')
git tag v$VERSION

# 5. 推送 tag
git push origin v$VERSION

# 6. GitHub Actions 自动创建 Release
#    访问 https://github.com/xujian519/yunpat-agent/releases 查看
```

或使用发布脚本:

```bash
./scripts/release.sh
```

---

## 监控体系

### Prometheus (docker/prometheus.yml)

Prometheus 负责收集和存储时间序列监控数据。

**配置参数**:

```yaml
global:
  scrape_interval: 15s      # 默认抓取间隔
  evaluation_interval: 15s   # 规则评估间隔

scrape_configs:
  - job_name: 'yunpat-agent'
    static_configs:
      - targets: ['yunpat-agent:3000']
    metrics_path: /metrics
    scrape_interval: 5s       # Agent 服务高频抓取

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

**数据保留**: 200 小时 (通过 `--storage.tsdb.retention.time=200h` 配置)

**访问**: http://localhost:9090

### Grafana 仪表盘

Grafana 提供监控数据的可视化展示。

**访问地址**: http://localhost:3001

**默认凭据**:

- 用户名: `admin`
- 密码: 由 `GRAFANA_PASSWORD` 环境变量设置 (默认 `admin`)

**预配置仪表盘** (通过 `docker/grafana/provisioning/` 自动加载):

| 仪表盘 | 说明 |
|--------|------|
| API 性能监控 | HTTP 请求响应时间、吞吐量、错误率 |
| Agent 任务执行统计 | Agent 完成时间、成功率、队列深度 |
| 系统健康 | CPU/内存/磁盘使用率、容器状态 |

### 监控指标分类

#### HTTP 请求指标

| 指标名 | 说明 |
|--------|------|
| `http_request_duration_seconds` | 请求响应时间直方图 |
| `http_requests_total` | 总请求数 (按方法和状态码分标签) |
| `http_request_size_bytes` | 请求体大小 |
| `http_response_size_bytes` | 响应体大小 |

#### Agent 执行指标

| 指标名 | 说明 |
|--------|------|
| `agent_execution_duration_seconds` | Agent 任务执行时间 |
| `agent_executions_total` | 总执行次数 (按 Agent 类型和结果分标签) |
| `agent_queue_depth` | 任务队列深度 |
| `agent_active_workers` | 活跃工作线程数 |

#### LLM 调用指标

| 指标名 | 说明 |
|--------|------|
| `llm_tokens_total` | 总 Token 使用量 |
| `llm_prompt_tokens` | 输入 Token 数 |
| `llm_completion_tokens` | 输出 Token 数 |
| `llm_request_duration_seconds` | LLM API 调用耗时 |
| `llm_cost_usd` | 估算调用成本 |

#### 数据库指标

| 指标名 | 说明 |
|--------|------|
| `db_connections_active` | 活跃连接数 |
| `db_connections_idle` | 空闲连接数 |
| `db_query_duration_seconds` | 查询耗时 |
| `db_errors_total` | 数据库错误数 |

### 告警规则 (建议)

在 Prometheus 中配置以下告警规则:

```yaml
groups:
  - name: yunpat-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "HTTP 错误率过高"

      - alert: AgentQueueBacklog
        expr: agent_queue_depth > 100
        for: 10m
        annotations:
          summary: "Agent 任务队列积压"

      - alert: DatabaseConnectionsHigh
        expr: db_connections_active > 8
        for: 5m
        annotations:
          summary: "数据库连接数接近上限"
```

---

## 健康检查

### Docker 内置健康检查

TypeScript 服务镜像配置了 Dockerfile 健康检查:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q -O- http://localhost:8080/internal/health || exit 1
```

| 参数 | 值 | 说明 |
|------|-----|------|
| interval | 30s | 检查间隔 |
| timeout | 10s | 单次检查超时 |
| start-period | 5s | 启动宽限期 |
| retries | 3 | 失败重试次数 |

### Docker Compose 健康检查

orchestrator 服务配置了 Compose 级健康检查:

```yaml
healthcheck:
  test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3000/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**注意**: orchestrator 的启动宽限期为 40 秒, 因为其依赖数据库和缓存服务启动。

### 手动健康检查

```bash
# 检查 orchestrator
curl http://localhost:3000/health

# 检查整体服务状态
docker-compose ps

# 查看健康检查历史
docker inspect --format='{{.State.Health.Status}}' yunpat-orchestrator
```

---

## 扩展策略

### 水平扩展

YunPat Agent 的核心服务 (orchestrator, patent-responder, patent-analyzer, patent-search) 均为无状态设计, 可水平扩展。

```yaml
# docker-compose.override.yml (扩展配置)
services:
  orchestrator:
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379  # 共享状态层

  patent-responder:
    deploy:
      replicas: 2

  patent-analyzer:
    deploy:
      replicas: 2
```

**扩展要点**:

- 所有无状态服务通过 Redis 共享会话状态
- PostgreSQL 作为共享数据层
- 需要负载均衡器 (如 Nginx 或 Traefik) 分发流量到 orchestrator 副本
- Agent 任务队列基于 Redis, 天然支持多消费者

### 垂直扩展

#### 内存优化

```bash
# Node.js 堆内存限制 (已在 Dockerfile 中配置)
NODE_OPTIONS="--max-old-space-size=512"

# 生产环境可适当提高
NODE_OPTIONS="--max-old-space-size=1024"
```

#### PostgreSQL 优化

```sql
-- 共享缓冲区 (建议设置为 RAM 的 25%)
ALTER SYSTEM SET shared_buffers = '256MB';

-- 工作内存
ALTER SYSTEM SET work_mem = '16MB';

-- 维护工作内存
ALTER SYSTEM SET maintenance_work_mem = '128MB';

-- 重新加载配置
SELECT pg_reload_conf();
```

### 数据库扩展路径

| 阶段 | 方案 | 适用规模 | 操作 |
|------|------|----------|------|
| 1 | SQLite | < 1000 件专利 | 零配置, 单文件 |
| 2 | PostgreSQL 单节点 | 1000 - 10000 件 | Docker Compose |
| 3 | PostgreSQL 读写分离 | > 10000 件 | 主从复制 |
| 4 | 分片 | > 100000 件 | 按专利号/申请人分片 |

---

## 故障排查

### 服务无法启动

**症状**: `docker-compose up -d` 后容器立即退出。

**排查步骤**:

```bash
# 1. 查看详细日志
docker-compose logs <service-name>

# 2. 检查端口冲突
lsof -i :3000    # orchestrator
lsof -i :5432    # PostgreSQL
lsof -i :6379    # Redis
lsof -i :9090    # Prometheus
lsof -i :3001    # Grafana

# 3. 检查环境变量是否配置
# 确认 .env 文件存在且至少配置了一个 LLM API Key

# 4. 检查构建是否成功
docker-compose build --no-cache <service-name>
```

### 数据库连接失败

**症状**: 服务日志显示数据库连接超时或认证失败。

**排查步骤**:

```bash
# 1. 检查 PostgreSQL 容器状态
docker-compose ps postgres

# 2. 进入数据库容器验证
docker-compose exec postgres psql -U yunpat -d yunpat -c "SELECT 1;"

# 3. 检查连接字符串
# 确认 .env 中的 DATABASE_URL 与 docker-compose.yml 中的凭据一致

# 4. 查看 PostgreSQL 日志
docker-compose logs postgres | tail -n 50
```

### 构建失败

**症状**: `docker-compose build` 报错退出。

**排查步骤**:

```bash
# 1. 不使用缓存重新构建
docker-compose build --no-cache

# 2. 检查网络 (pnpm 需要从 npm registry 下载依赖)
curl -I https://registry.npmjs.org/

# 3. 检查 Rust 工具链版本
# Dockerfile 要求 Rust 1.80+ (TypeScript 镜像) 和 1.88 (Rust 镜像)

# 4. 查看详细构建日志
docker-compose build --progress=plain 2>&1 | tee build.log
```

### 完全重建

当遇到无法定位的问题时, 使用完全重建清除所有状态:

```bash
# 停止并删除容器、网络、卷
docker-compose down -v

# 清理 Docker 构建缓存
docker builder prune -f

# 重新构建并启动
docker-compose up -d --build
```

**注意**: `-v` 会删除所有数据卷, 包括数据库数据。重建前请先备份重要数据。

### 知识库问题

**症状**: Agent 无法访问知识库, 或响应中缺少知识库引用。

**排查步骤**:

```bash
# 1. 确认知识库路径存在且可读
ls -la $KNOWLEDGE_BASE_PATH

# 2. 检查文件权限
chmod -R 755 $KNOWLEDGE_BASE_PATH

# 3. 确认路径在容器内可访问 (如果使用 Docker)
# 将知识库路径挂载到容器中:
# volumes:
#   - ./knowledge-base:/app/knowledge-base

# 4. 检查知识库文件格式
# 知识库应为 Markdown 文件 (.md)
find $KNOWLEDGE_BASE_PATH -name "*.md" | wc -l
```

### 性能问题

**症状**: 响应缓慢, Agent 执行时间过长。

**排查步骤**:

```bash
# 1. 查看资源使用
docker stats

# 2. 查看慢查询 (PostgreSQL)
docker-compose exec postgres psql -U yunpat -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 3. 检查 Redis 内存使用
docker-compose exec redis redis-cli INFO memory

# 4. 查看 Grafana 性能仪表盘
# 访问 http://localhost:3001 查看 API 响应时间和 Agent 执行时间
```

### 日志收集

```bash
# 收集所有服务日志到文件
docker-compose logs --no-color > yunpat-logs-$(date +%Y%m%d).txt

# 收集特定服务最后 500 行日志
docker-compose logs --tail=500 orchestrator > orchestrator.log

# 实时日志 (多服务)
docker-compose logs -f orchestrator patent-responder
```

---

## 附录

### 版本要求

| 组件 | 最低版本 | 说明 |
|------|----------|------|
| Docker | 20.10+ | 支持 BuildKit 和 cache mounts |
| Docker Compose | 2.0+ | 支持 compose v3.8 格式 |
| Rust | 1.88 | TUI 构建需要 |
| Node.js | 18 | TypeScript 服务运行时需要 |
| pnpm | 8+ | TypeScript 依赖管理 |

### 端口清单

| 端口 | 服务 | 协议 | 外部访问 |
|------|------|------|----------|
| 3000 | orchestrator | HTTP | 是 |
| 5432 | PostgreSQL | TCP | 是 (开发) |
| 6379 | Redis | TCP | 是 (开发) |
| 8080 | TypeScript 服务 | HTTP | 是 |
| 9090 | Prometheus | HTTP | 是 |
| 3001 | Grafana | HTTP | 是 |
| 3001 (内部) | gRPC | gRPC | 否 |

### 文件路径速查

| 文件 | 路径 | 说明 |
|------|------|------|
| Rust Dockerfile | `crates/Dockerfile` | TUI 构建 |
| TypeScript Dockerfile | `packages/Dockerfile` | 服务栈构建 |
| Docker Compose | `packages/docker-compose.yml` | 服务编排 |
| 环境模板 | `.env.example` | 环境变量参考 |
| Prometheus 配置 | `docker/prometheus.yml` | 监控采集配置 |
| CI 配置 | `.github/workflows/ci.yml` | GitHub Actions |
| 发布脚本 | `scripts/release.sh` | 手动发布 |
| 初始化脚本 | `scripts/setup.sh` | 开发环境初始化 |

### 相关文档

- [架构设计](./architecture.md) - 系统架构详细说明
- [开发指南](./development.md) - 开发环境搭建和开发流程
- [API 文档](./api.md) - API 接口详细说明

---

*本文档由 YunPat Agent 团队维护。如有问题, 请提交 Issue 或联系维护者。*
