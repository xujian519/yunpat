# YunPat Agent 部署配置清单

按优先级分为三层：**必须配置**、**推荐配置**、**可选配置**。

---

## 一、必须配置

### 1. API 密钥（至少一个）

```bash
# 方式 A：环境变量（优先级最高）
cp .env.example .env
# 编辑 .env，填入：
DEEPSEEK_API_KEY=sk-xxx        # 推荐，性价比高

# 方式 B：配置文件
# ~/.yunpat/config.toml
[providers.deepseek]
api_key = "sk-xxx"

# 方式 C：OS keyring（首次运行时通过 TUI onboarding 输入）
```

支持的提供商（每个支持 `<NAME>_BASE_URL` 环境变量覆盖）：

| 提供商 | 环境变量 | 说明 |
|--------|----------|------|
| DeepSeek | `DEEPSEEK_API_KEY` | 默认推荐 |
| 智谱 GLM | `ZHIPU_API_KEY` | 国产备选 |
| Moonshot | `MOONSHOT_API_KEY` | kimi |
| 豆包 | `DOUBAO_API_KEY` | 字节跳动 |
| OpenAI | `OPENAI_API_KEY` | 可选 |
| Ollama | 无需 key | 本地模型 |

### 2. 项目级配置文件

```bash
# 项目根目录下
.yunpat/config.toml    # 主配置
```

关键字段：

```toml
model = "deepseek-v4-pro"       # 模型选择
reasoning_effort = "high"       # 推理强度：off/low/high/max
approval_policy = "suggest"     # 审批策略：suggest/on-request/yolo

[tui]
locale = "zh-Hans"              # 界面语言

[memory]
enabled = true                  # 用户记忆系统

[hooks]
enabled = true                  # 生命周期钩子
```

### 3. MCP Server

```toml
# .yunpat/config.toml 中已预置
[[mcp_servers]]
name = "yunpat"
transport = "stdio"
command = "npx"
args = ["-y", "@yunpat/mcp-server"]
lazy = true                     # 首次调用时才连接
```

首次运行前需构建 MCP 包：

```bash
cd packages && pnpm install && pnpm --filter @yunpat/mcp-server build
```

### 4. 知识库

```
knowledge-base/          # 不提交 git，需手动准备
├── 法律法规/            # 法律法规文件
├── 审查指南/            # 审查指南
├── 复审无效/            # 复审无效案例
├── 专利判决/            # 判决文书
├── 专利侵权/            # 侵权案例
├── 专利实务/            # 实务知识
└── legal-system/        # 法律体系结构化数据
```

---

## 二、推荐配置

### 5. 数据库

| 类型 | 用途 | 配置 |
|------|------|------|
| PostgreSQL | 生产环境：专利数据、用户信息 | `DATABASE_URL=postgresql://user:pass@localhost:5432/patent_db` |
| SQLite | Rust state 层：会话/线程持久化 | 自动创建于 `~/.yunpat/state.db` |
| Redis | 缓存、队列（可选） | `REDIS_URL=redis://localhost:6379` |

### 6. Gateway 路由器（如果使用意图路由）

```bash
# crates/.env.example
ROUTER_LLM_BASE_URL=https://api.deepseek.com/v1
ROUTER_LLM_API_KEY=sk-xxx
ROUTER_LLM_MODEL=deepseek-v4-flash    # 路由用轻量模型
```

### 7. 构建依赖

```bash
# Rust 1.88+（使用 let_chains）
rustup update stable

# Node.js + pnpm
npm install -g pnpm

# 一键安装
make install
```

---

## 三、可选配置

### 8. Docker 部署

```bash
# docker-compose.yml 包含：
# orchestrator(3000) / postgres(5432) / redis(6379)
# prometheus(9090) / grafana(3001)
docker-compose up -d
```

需设置：`POSTGRES_PASSWORD`、`GRAFANA_ADMIN_PASSWORD`

### 9. 监控

| 服务 | 端口 | 用途 |
|------|------|------|
| Prometheus | 9090 | 指标收集 |
| Grafana | 3001 | 监控面板 |
| App Server | 8080 | HTTP/SSE 无头 Agent API |

### 10. 本地模型

```bash
# Ollama（无需 API key）
OLLAMA_BASE_URL=http://localhost:11434
```

---

## 快速部署步骤

```bash
# 1. 克隆 & 安装
git clone ... && cd yunpat-agent
make install

# 2. 配置
cp .env.example .env        # 填入 API key
mkdir -p ~/.yunpat           # 首次自动创建也可

# 3. 构建
make build

# 4. 运行
make run                     # 启动 TUI
# 或
make dev                     # 开发模式（热重载）
```

---

## 配置验证清单

### 必需项

- [ ] API 密钥设置（至少一个提供商）
- [ ] 项目配置文件 `.yunpat/config.toml`
- [ ] MCP Server 构建完成
- [ ] 知识库文件就位

### 推荐项

- [ ] PostgreSQL 数据库连接
- [ ] Gateway 路由器配置（如需意图路由）
- [ ] 构建依赖版本正确（Rust 1.88+、Node.js、pnpm）

### 验证命令

```bash
make build                   # 构建成功
make test                    # 测试通过
make run                     # TUI 正常启动
```
