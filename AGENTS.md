# AGENTS.md

> 本文件面向 AI 编程助手。阅读前请假定你对本项目一无所知。

---

## 项目概述

**YunPat**（仓库名 `yunpat-agent-framework`）是一个以 TypeScript 为主的 AI 智能体框架，核心理念是**"框架笨、智能体专"**。项目已转型为**知识产权全生命周期智能体平台**（专利专业版），面向专利代理所、律所 IP 团队和企业知识产权部门。

- **版本**：v0.1.0（private）
- **许可证**：MIT
- **作者**：Xu Jian <xujian519@gmail.com>
- **主要语言**：TypeScript（应用层/业务逻辑层），Rust（性能关键型检索/推理），Python（完全隔离的 ML/数据分析）

### 核心设计原则

1. **五层架构**：交互层（Gateway）→ 推理层（Reasoning）→ 核心引擎（LLM）→ 记忆层（Memory）→ 工具层（Tools）。
2. **框架与业务解耦**：`packages/core` 只提供通用能力；所有专利业务逻辑放在 `patents/` 目录，新增智能体不需要修改框架代码。
3. **智能体间不直接调用**：通过 `EventBus` 进行发布订阅和 RPC 式请求响应。
4. **优先国产大模型**：DeepSeek（默认推荐）、通义千问（分析任务）、本地 Ollama（离线/隐私场景）。

### 当前完成度（基于 2026-04-30 代码审计）

- **约 30%** 完成度。
- **可用**：核心框架（packages/core，~85%，356+ 导出），`PatentWriterAgent`（~80%，集成知识库+模板+Rust桥接），`EventBus` 通过 53 个测试用例，知识库（1139 文件），提示词模板（1821 行）。
- **部分可用**：`PatentAnalyzerAgent`（~50%，分析返回 LLM 生成数据）、`PatentResponderAgent`（~50%，有 patent-core 集成但缺真实检索）。
- **不可用/空壳**：Rust 工具链（25 个编译错误）、CLI 工具（返回 TODO）、MCP 服务器（硬编码数据）、`PatentManagerAgent`（无数据库后端）。
- **测试覆盖率极低**：仅 `EventBus` 有可靠测试，整体约 5%。

---

## 技术栈与运行时架构

### 基础环境

- **Node.js**：>= 18.0.0
- **包管理器**：pnpm >= 8.0.0（monorepo 工作区）
- **TypeScript**：5.3.3+，目标 ES2022，模块 ESM，模块解析 `bundler`
- **构建工具**：esbuild（速度优先，约 30 倍于 tsc）+ tsc（仅生成类型声明 `.d.ts`）

### Monorepo 结构（pnpm workspace）

工作区定义在 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'packages/*'
  - 'packages/agents/*'
```

#### 主要包清单

| 包名 | 路径 | 说明 |
|---|---|---|
| `@yunpat/core` | `packages/core` | 核心框架：Agent 基类、EventBus、LLM 适配器、记忆、推理、工具注册表、知识库、可观测性 |
| `@yunpat/agent-writer` | `packages/agents/writer` | 通用技术写作助手智能体 |
| `@yunpat/agent-researcher` | `packages/agents/researcher` | 通用研究分析师智能体 |
| `@yunpat/patent-tools` | `packages/patent-tools` | 专利专用工具：权利要求生成、质量评估、审查答复等 |
| `@yunpat/builtin-tools` | `packages/builtin-tools` | 内置基础工具：文件读写、搜索、网络请求、浏览器操作 |
| `@yunpat/document-tools` | `packages/document-tools` | 文档解析工具：PDF、DOCX、Excel、OCR、音频转录 |
| `@yunpat/cli` | `packages/cli` | 命令行工具，bin 名为 `yunpat` |
| `@yunpat/grpc-server` | `packages/grpc-server` | TypeScript gRPC 服务器，基于 `ts-proto` 生成代码 |

#### 专利业务代码（独立于 packages）

- `patents/agents/writer/`：`PatentWriterAgent.ts`（最成熟的智能体）
- `patents/agents/responder/`：`PatentResponderAgent.ts`（未实现核心逻辑）
- `patents/agents/analyzer/`：`PatentAnalyzerAgent.ts`（返回空数据）
- `patents/agents/manager/`：`PatentManagerAgent.ts`（无数据库后端）
- `patents/prompts/`：提示词模板管理器 + Markdown 模板（权利要求、说明书、创造性分析）
- `patents/knowledge/`：`ObsidianKnowledgeBridge` 等知识库集成代码
- `patents/mcp/`：MCP 工具服务器（当前返回硬编码数据）

#### 其他关键目录

- `cli/patent-cli/`：独立的 Node.js CLI（空壳，所有方法返回 TODO）
- `examples/`：TypeScript/JavaScript 使用示例
- `knowledge-base/`：专利知识库（法律法规、复审无效、审查指南、判决书、侵权案例等）
- `protos/`：gRPC/Protobuf 定义（`agent.proto`, `common.proto`, `scheduler.proto`, `tools.proto`, `vector.proto`）
- `docker/python-tools/`：Python 服务 Dockerfile 与 docker-compose.yml
- `scripts/`：维护脚本（文件放置检查、文档模板、工具验证、pre-commit）
- `docs/`：项目文档，遵循严格的文件分类规则（见下方"开发约定"）

### 运行时通信方式

- **智能体内部/之间**：`EventBus`（基于 `eventemitter3`，支持广播、点对点、请求响应）
- **服务间**：gRPC/Protobuf
- **外部接口**：REST API + WebSocket
- **Python 服务隔离**：通过 Docker 容器化，gRPC 端口 50052

---

## 构建与开发命令

所有命令均在项目根目录执行。

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
# 快速构建（esbuild，顺序构建 core → cli）
pnpm build

# 纯 tsc 构建（所有包）
pnpm build:tsc

# Watch 模式
pnpm build:watch

# 单独构建某个包
pnpm --filter @yunpat/core build
pnpm --filter @yunpat/cli build
```

### 类型检查（不生成代码）

```bash
node esbuild.config.mjs check
```

### 开发模式

```bash
# 所有包 watch
pnpm dev

# 单个包 watch
pnpm --filter @yunpat/core dev
```

### 清理构建产物

```bash
pnpm clean
# 等价于：rm -rf packages/*/dist packages/*/node_modules node_modules
```

### 运行 CLI（构建后）

```bash
node packages/cli/dist/index.js init
node packages/cli/dist/index.js run writer --task "任务描述"
```

---

## 代码风格规范

### 格式化与检查

- **ESLint**：配置在 `.eslintrc.json`
  - 继承：`eslint:recommended`, `@typescript-eslint/recommended`, `plugin:prettier/recommended`
  - 环境：Node.js, ES2022
  - 规则要点：
    - `@typescript-eslint/no-explicit-any`: `warn`
    - `@typescript-eslint/no-unused-vars`: `warn`（忽略 `_` 前缀）
    - `no-var`: `error`
    - `no-console`: `off`（允许控制台输出）
    - `prefer-const`: `warn`
- **Prettier**：配置在 `.prettierrc.json`
  - `semi: false`
  - `singleQuote: true`
  - `tabWidth: 2`
  - `trailingComma: "es5"`
  - `printWidth: 100`
  - `arrowParens: "always"`

### TypeScript 配置

- **基础配置**：`tsconfig.base.json`
  - `target`: ES2022
  - `module`: ESNext
  - `moduleResolution`: bundler
  - `strict: true`
  - `declaration: true`, `declarationMap: true`, `sourceMap: true`
  - `experimentalDecorators: true`, `emitDecoratorMetadata: true`
  - 输出目录：`./dist`，源码目录：`./src`
  - 排除：`node_modules`, `dist`, `**/*.test.ts`
- 各子包有自己的 `tsconfig.json`，继承基础配置。

### 命名与文件组织

- 类名使用 PascalCase，文件名与导出类名保持一致。
- 脚本/工具使用 kebab-case（如 `check-file-placement.sh`）。
- 源码统一放在 `src/`，构建输出到 `dist/`。
- TypeScript 导入需带 `.js` 扩展名（ESM 规范）。
- 注释以中文为主。

### 智能体开发规范

1. 继承 `Agent` 基类（来自 `@yunpat/core`）。
2. 必须实现 `plan(input, context)` 和 `act(plan, context)`。
3. 可选实现 `before`、`reflect`、`after` 生命周期钩子。
4. **禁止**在 `packages/core` 中添加业务逻辑。
5. 智能体之间**禁止**直接调用，必须使用 `EventBus`：
   ```typescript
   this.send('target-agent', { data: 'message' })
   ```

---

## 测试指南

### 测试框架

- **核心包**：使用 [Vitest](https://vitest.dev/)（含 `@vitest/ui`）
- 其他包大多只有占位测试：`echo "Test not implemented yet"`

### 运行测试

```bash
# 运行所有包的测试
pnpm test

# 运行核心包测试
pnpm --filter @yunpat/core test

# 运行特定文件（vitest）
pnpm --filter @yunpat/core exec vitest run EventBus.test.ts

# UI 模式
pnpm --filter @yunpat/core test:ui
```

### 现有测试覆盖

- `packages/core/test/eventbus/EventBus.test.ts`
- `packages/core/test/tools-selection/`（ToolUsageTracker, FewShotPromptManager, ToolDescriptionEnhancer, ToolSelectionOptimizer）
- `packages/core/test/stability/concurrent-agents.test.ts`
- `packages/core/test/knowledge/KnowledgeCard.test.ts`
- `packages/core/test/performance/`（基准测试）
- `test/knowledge/ObsidianKnowledgeBridge.test.ts`

### 预提交检查

项目提供 `scripts/pre-commit.sh`，可复制到 `.git/hooks/pre-commit`：

```bash
cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

该钩子会执行：
1. `pnpm --filter @yunpat/core build`（类型检查）
2. `pnpm --filter @yunpat/core exec vitest run`（快速测试）

---

## CI/CD 与部署

### GitHub Actions（`.github/workflows/ci.yml`）

在 `main` 和 `develop` 分支的 push/PR 时触发，包含 4 个 job：

1. **test**：在 Node 18.x 和 20.x 矩阵上运行
   - `pnpm install --frozen-lockfile`
   - `pnpm build`
   - `pnpm test -- --run`
   - `pnpm test -- --coverage`
   - 上传覆盖率到 Codecov（`packages/core/coverage/lcov.info`）
2. **lint**：运行 `pnpm lint`
3. **type-check**：运行 `pnpm build:tsc`
4. **build**：依赖前 3 个 job 成功后执行，构建所有包并上传产物（保留 7 天）

### Docker 与容器化

- **Python 工具服务**：`docker/python-tools/Dockerfile`
  - 基于 `python:3.11-slim`
  - 暴露 gRPC 端口 50052
  - 包含健康检查
- **编排**：`docker/python-tools/docker-compose.yml`
  - 定义了 `agent-service`（TypeScript）、`vector-service`（Rust）、`scheduler-service`（Rust）、`python-tools`（隔离）
  - 各服务资源限制已配置（CPU/内存）

### 部署方式

- **本地**：`docker-compose up -d`（需补充构建上下文）或手动启动各包
- **生产**：构建后通过 PM2 或 Kubernetes 部署（文档提及，但仓库内无现成 `k8s/` 配置文件）

---

## 环境变量与配置

复制 `.env.example` 为 `.env` 并按需填写。关键变量：

### LLM API（至少配置一个）

- `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL`
- `DASHSCOPE_API_KEY`（通义千问）
- `OLLAMA_BASE_URL` / `OLLAMA_MODEL`

### 数据库与服务端口

- `DATABASE_URL`（PostgreSQL）
- `REDIS_URL`
- `API_PORT`（默认 3000）
- `GRPC_PORT`（默认 50051）
- `WS_PORT`（默认 3001）
- `PYTHON_SERVICE_PORT` / `PYTHON_SERVICE_URL`
- `RUST_SERVICE_PORT` / `RUST_SERVICE_URL`

### 安全

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `CORS_ORIGINS`

### 应用

- `NODE_ENV`（development | production | test）
- `LOG_LEVEL`（debug | info | warn | error）
- `MAX_CONCURRENT_REQUESTS`、`REQUEST_TIMEOUT`、`MAX_FILE_SIZE`
- 功能开关：`ENABLE_CACHE`、`ENABLE_MONITORING`、`ENABLE_ANALYTICS`

---

## 安全注意事项

1. **绝不提交 `.env`**：已在 `.gitignore` 中忽略，同时避免提交 `*.key`、`*.pem`、`credentials.json`、日志。
2. **禁止硬编码敏感信息**：API Key、本地绝对路径、用户名、内部 IP 等均应通过环境变量读取。
3. **占位符原则**：文档和示例中必须使用占位符（如 `/path/to/your/knowledge-base`、`your-api-key-here`）。
4. **密钥轮换**：生产环境定期更换 API Key。
5. **审计日志**：敏感操作应记录日志（框架内 `TelemetryCollector` 提供可观测性支持）。
6. **自动化检测**：建议使用 `git-secrets` 扫描历史提交，防止意外泄露。

详细安全规范见 `docs/SECURITY_GUIDELINES.md`。

---

## 开发约定

### 文档文件管理

项目有严格的文件处置规则（`docs/FILE_MANAGEMENT_RULES.md`）：

- **根目录**只允许保留核心配置文件和入口文档（README、CHANGELOG、CONTRIBUTING、CLAUDE.md 等）。
- **报告** → `docs/reports/YYYY-MM/`（命名：`YYYY-MM-DD-topic-type.md`），超过 6 个月归档到 `archive/`。
- **计划** → `docs/plans/{refactor,optimization,migration,feature}/`
- **指南** → `docs/guides/`
- **架构** → `docs/architecture/`
- **历史/废弃** → `docs/history/` 或 `docs/archive/`

新建文档推荐使用：

```bash
./scripts/new-doc-template.sh report work-summary "今日工作总结"
```

并定期运行：

```bash
./scripts/check-file-placement.sh
```

### Git 提交规范

- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `style:` - 代码格式（不影响功能）
- `refactor:` - 重构
- `test:` - 测试相关
- `chore:` - 构建/工具相关

分支命名：`feature/xxx`、`fix/xxx`。

### Pull Request 检查清单

- [ ] 代码通过所有测试
- [ ] 代码符合 ESLint/Prettier 规范
- [ ] 新功能包含测试（理想情况下）
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确
- [ ] 没有提交 `.env` 或敏感文件

---

## 快速导航

| 目标 | 位置 |
|---|---|
| 核心框架入口 | `packages/core/src/index.ts` |
| Agent 基类 | `packages/core/src/agent/Agent.ts` |
| EventBus | `packages/core/src/eventbus/EventBus.ts` |
| LLM 适配器 | `packages/core/src/llm/NativeLLMAdapter.ts` |
| 最成熟的智能体 | `patents/agents/writer/PatentWriterAgent.ts` |
| 提示词模板管理器 | `patents/prompts/PromptTemplateManager.ts` |
| 知识库桥接 | `patents/knowledge/ObsidianKnowledgeBridge.ts` |
| 内置工具集 | `packages/builtin-tools/src/index.ts` |
| 文档解析工具 | `packages/document-tools/src/index.ts` |
| gRPC 原型定义 | `protos/*.proto` |
| CI 配置 | `.github/workflows/ci.yml` |
| 构建脚本 | `esbuild.config.mjs` |
| 文件管理规则 | `docs/FILE_MANAGEMENT_RULES.md` |
| 安全指南 | `docs/SECURITY_GUIDELINES.md` |
| 开发指南 | `docs/guides/development.md` |

---

**最后更新**：2026-04-30
