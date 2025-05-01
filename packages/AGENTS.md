# AGENTS.md

> 面向 AI 编程助手的项目指南。本文件只记录非显而易见的知识——需要试错才能发现的陷阱、隐式约定、令人惊讶的配置细节。

---

## 项目概述

**YunPat** 是一个 TypeScript monorepo 智能体框架，定位为知识产权全生命周期智能体平台。核心理念："框架笨、智能体专"。

- **语言**：TypeScript（主要）、Rust（性能关键算法，通过 CLI bridge 调用）、Python（Docker 隔离的 ML 服务）
- **包管理**：pnpm workspace（>= 8.0.0）
- **Node.js**：>= 18.0.0
- **模块系统**：ESM（`"type": "module"`），TypeScript 目标 ES2022
- **规模**：20 个顶层包 + 29 个智能体子包，约 611 个 TS/TSX 源文件，184,000+ 行代码

---

## 常用命令

```bash
# 安装
pnpm install

# 构建（esbuild，~30x faster than tsc）
pnpm build                          # 核心→CLI 顺序构建 + 类型检查

# 类型检查（不生成代码）
node esbuild.config.mjs check

# 测试
pnpm test                           # 所有包（多数包是占位 echo）
pnpm test:real                      # 核心@yunpat/core，真实 LLM 调用（需要 API Key）
pnpm test:mock                      # 核心@yunpat/core，mock 模式（无需 API Key）
pnpm test:unit                      # 核心@yunpat/core，标准 vitest --run
pnpm --filter @yunpat/core exec vitest run test/eventbus/EventBus.test.ts  # 单文件
pnpm test:watch                     # 核心@yunpat/core watch 模式
pnpm test:coverage                  # 核心@yunpat/core 覆盖率

# TUI 构建
pnpm tui:build                      # 构建 @yunpat/tui + @yunpat/orchestrator-adapter

# 代码质量
pnpm lint                           # ESLint（所有包）
pnpm lint:fix                       # 自动修复
pnpm format                         # Prettier

# CI 本地模拟
pnpm ci:full                        # lint + type-check + test + build
pnpm ci                             # 快速版

# 数据库（Drizzle ORM）
pnpm db:generate                    # 生成 migration
pnpm db:migrate                     # 推送到数据库
pnpm db:studio                      # Drizzle Studio GUI

# 开发服务器
pnpm dev:start                      # 启动开发环境
pnpm dev:gateway                    # 启动 Gateway
pnpm dev:adapter                    # 启动 Orchestrator Adapter
pnpm dev:tui                        # 启动 TUI 开发模式

# 清理
pnpm clean                          # rm -rf packages/*/dist packages/*/node_modules node_modules
```

### 单包操作

```bash
pnpm --filter @yunpat/core build    # 构建单个包
pnpm --filter @yunpat/core dev      # 单包 watch 模式
```

### 构建系统要点

- `pnpm build` 使用 `esbuild.config.mjs`，只构建 `@yunpat/core` 和 `@yunpat/cli` 两个包
- `pnpm build:tsc` 使用 tsc 构建所有包（用于类型检查）
- esbuild 构建后还会运行 `pnpm type-check`，类型检查失败会导致构建失败
- esbuild 的 `external` 列表包含所有 `@yunpat/*` 包——内部依赖不打包
- `pnpm tui:build` 使用 pnpm 过滤器构建 TUI 及其依赖的 adapter 包

---

## Monorepo 结构

### workspace 定义

**`pnpm-workspace.yaml`**（旧定义，含已不存在的路径）：

```yaml
packages:
  - 'packages/*'
  - 'packages/agents/*'
  - 'cli/patent-cli'
  - 'patents/mcp'
```

**`package.json` workspaces**（实际生效，pnpm 以 YAML 文件为准）：

```json
["packages/*", "packages/agents/*"]
```

**注意**：

- `packages/agents/*` 是独立工作区，不是 `packages/*` 的子集
- `cli/patent-cli` 仍存在但已被 `packages/cli` 替代
- `patents/mcp` 已不存在，MCP Server 迁移到 `packages/mcp-server`
- pnpm 实际以 YAML 文件为准，所以 YAML 中列出的旧路径仍被 pnpm 扫描

### 核心包（20 个）

| 包名                              | 路径                               | 职责                                                                                     |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `@yunpat/core`                    | `packages/core`                    | 框架核心：Agent 基类、EventBus、LLM 适配器、记忆、推理、工具注册、知识库、可观测性、验证 |
| `@yunpat/agent-base`              | `packages/agents/base`             | `ProfessionalAgent` 基类，简化版 Agent 接口                                              |
| `@yunpat/patent-tools`            | `packages/patent-tools`            | 专利工具：权利要求生成、Google Patents 抓取、相似专利搜索、数据库搜索                    |
| `@yunpat/builtin-tools`           | `packages/builtin-tools`           | 通用工具：文件操作、搜索、网络请求、浏览器自动化、知识库搜索、Mermaid 图表               |
| `@yunpat/document-tools`          | `packages/document-tools`          | 文档解析：PDF/DOCX/Excel/OCR/音频转录/PPTX、专利文档生成                                 |
| `@yunpat/patent-core`             | `packages/patent-core`             | Rust CLI bridge + TS fallback：特征提取、权利要求生成、OA 解析、IPC 分类                 |
| `@yunpat/patent-database`         | `packages/patent-database`         | 75M CN 专利（PostgreSQL）+ Google Patents API 适配器                                     |
| `@yunpat/patent-knowledge`        | `packages/patent-knowledge`        | Obsidian 知识库桥接                                                                      |
| `@yunpat/patent-prompts`          | `packages/patent-prompts`          | 提示词模板管理器（懒加载 + 缓存）                                                        |
| `@yunpat/unified-knowledge-graph` | `packages/unified-knowledge-graph` | 统一知识图谱（OpenClaw + YunPat + Athena）                                               |
| `@yunpat/orchestrator`            | `packages/orchestrator`            | 中枢调度：意图识别、任务规划、HITL 交互、结果聚合                                        |
| `@yunpat/orchestrator-adapter`    | `packages/orchestrator-adapter`    | Rust Gateway 与 Node.js 之间的桥接适配层（4 个 src 文件）                                |
| `@yunpat/mcp-server`              | `packages/mcp-server`              | MCP Server（Model Context Protocol），bin: `yunpat-mcp`                                  |
| `@yunpat/cli`                     | `packages/cli`                     | CLI 工具，bin: `yunpat`                                                                  |
| `@yunpat/grpc-server`             | `packages/grpc-server`             | gRPC 服务器（ts-proto 生成代码）                                                         |
| `@yunpat/image-tools`             | `packages/image-tools`             | 化学结构 & 数学公式识别                                                                  |
| `@yunpat/tui`                     | `packages/tui`                     | Claude Code 风格终端 UI，React/Ink 框架（23 个 src 文件）                                |
| `@yunpat/skills`                  | `packages/skills`                  | 模块化 prompt/skill 管理系统（20 个 src 文件）                                           |
| `@yunpat/rust-tools`              | `packages/rust-tools`              | Rust 编写的工具服务（相似度计算、分词、向量服务等）                                      |
| `@yunpat/python-tools`            | `packages/python-tools`            | Python ML 服务（Docker 隔离），gRPC 通信                                                 |

### 智能体包（`packages/agents/*`，29 个）

| 包名                             | 智能体                                   | 成熟度       |
| -------------------------------- | ---------------------------------------- | ------------ |
| `@yunpat/agent-patent-writer`    | 专利撰写（3阶段: plan→act→reflect）      | **最成熟**   |
| `@yunpat/agent-patent-analyzer`  | 专利分析 V2（6阶段管线，集成真实数据库） | 成熟（100%） |
| `@yunpat/agent-patent-responder` | 审查意见答复 V5（集成真实数据库）        | 成熟（100%） |
| `@yunpat/agent-patent-manager`   | 专利生命周期管理                         | 较早         |
| `@yunpat/agent-invention`        | 发明理解                                 | 中等         |
| `@yunpat/agent-quality`          | 质量检查                                 | 中等         |
| `@yunpat/agent-search`           | 专利搜索 V3（集成真实数据库）            | 成熟（100%） |
| `@yunpat/agent-claims`           | 权利要求处理                             | 中等         |
| `@yunpat/agent-specification`    | 说明书撰写                               | 中等         |
| 其余 ~20 个                      | 撰写/分析/质检/格式转换/图表理解等       | 较早         |

### 其他关键目录

- `protos/`：gRPC/Protobuf 定义（agent.proto, common.proto, scheduler.proto, tools.proto, vector.proto）
- `examples/`：TypeScript 使用示例
- `scripts/`：维护脚本（CI、部署、验证、文档、TUI 启动）
- `services/`：独立服务（数学公式、专利下载、化学结构）
- `docs/`：项目文档，遵循严格文件分类规则（见 `docs/FILE_MANAGEMENT_RULES.md`）
- `config/`：环境变量模板、写作风格配置
- `knowledge-base/`：专利知识库（约 4,385 个文件）
- `cli/patent-cli/`：旧版 CLI（已被 `packages/cli` 替代，但仍在 workspace YAML 中）

---

## 五层架构

核心框架的分层设计：

```
1 交互层 Gateway    → HTTP server, auth (API Key/JWT/OAuth/Session), 审批流, 内容审核, 审计
2 推理层 Reasoning  → ReAct, TreeOfThoughts, ChainOfThought, 反思, 推理缓存, 批处理
3 核心引擎 LLM      → 多模型适配 (LangChain/Native/OMXL), TaskRouter, Embedding, 温度控制, 语义缓存
4 记忆层 Memory     → 短期 (ContextManager, TokenWindow), 长期 (Postgres graph/vector), 检查点, RAG
5 编排层            → Agent 生命周期, 规划引擎, 重规划, 工具注册, EventBus
```

交叉关注点：ConstitutionalAI（合规）、ActiveLearning（持续学习）、Observability（遥测）、Validation（结果验证+幻觉检测）。

---

## Agent 开发规范

### 继承体系

```
Agent (packages/core)                    # 基类，plan() + act() 抽象方法
  └── KnowledgeEnhancedAgent (core)      # 内置知识库集成
        └── ProfessionalAgent (agent-base) # 简化接口，run() → AgentResult
              ├── PatentWriterAgent
              ├── PatentAnalyzerAgentV2
              ├── PatentResponderAgentV5
              └── ...
```

### Agent 基类生命周期

```typescript
// packages/core/src/agent/Agent.ts
// 执行流：before → init → [plan → (approval?) → act → reflect → checkpoint]xN → after

abstract plan(input, context)   // 必须实现
abstract act(plan, context)     // 必须实现
before?(input, ctx)             // 可选前置钩子
init?(ctx)                      // 可选一次性初始化
reflect?(result, ctx)           // 可选反思，返回 { shouldContinue }
after?(input, output, ctx)      // 可选后置钩子
```

### ProfessionalAgent（推荐基类）

```typescript
// packages/agents/base/src/ProfessionalAgent.ts
// 简化版，只需要实现 act()
run(input, context) → AgentResult  // { success, data, error?, executionTime, requiresHITL? }
callLLM(prompt) → string           // 内置 LLM 调用辅助方法
```

### 智能体间通信

**禁止直接调用**，必须使用 EventBus：

```typescript
// 发送消息
this.send('target-agent', { data: 'message' })

// 监听消息
this.on('source-agent', (message) => { ... })

// RPC 风格请求响应
const response = await eventBus.request('target-agent', payload, timeoutMs)
```

### 禁止事项

- **禁止**在 `packages/core` 中添加业务逻辑（只放通用能力）
- **禁止**智能体之间直接调用
- **禁止**硬编码 API Key、本地路径等敏感信息

---

## 代码风格

### Prettier（`.prettierrc.json`）

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

### TypeScript

- **strict: true**，ESM 模块，bundler 模块解析
- 导入需带 `.js` 扩展名（ESM 规范）：`import { foo } from './bar.js'`
- `experimentalDecorators: true`
- 基础配置在 `tsconfig.base.json`，各包继承

### ESLint 要点

- `@typescript-eslint/no-explicit-any`: **warn**（但 orchestrator 和 test 包中是 **error**）
- `_` 前缀变量忽略 unused-vars 检查
- `no-console: off`（允许 console 输出）
- 忽略模式：`*.js`, `*.d.ts`, `cli/patent-cli/**`

### 命名

- 类名 PascalCase，文件名与类名一致
- 脚本 kebab-case
- 源码放 `src/`，构建输出到 `dist/`
- 注释以中文为主

---

## 测试

### 框架与配置

- **Vitest**（核心包 `@yunpat/core` 有 90 个测试文件，全项目共 193 个测试文件）
- 配置：`packages/core/vitest.config.ts`
- 排除：`*.bench.test.ts`, `*.perf.test.ts`, `*integration*.test.ts`, `performance/**`
- 超时：30 秒
- 覆盖率阈值：lines 80%, functions 80%, branches 75%
- 覆盖率排除：`test/`, `dist/`, `**/types.ts`, `**/index.ts`

### 测试模式

```bash
pnpm test:real        # 真实 LLM 测试（需要 API Key，会消耗 token）
pnpm test:mock        # Mock 模式（无需 API Key，适合 CI）
pnpm test:unit        # 标准 vitest --run
```

- 真实 LLM 测试需要设置环境变量 `RUN_REAL_LLM_TESTS=true`
- Mock 测试通过 `MOCK_TESTS=true` 启用
- 两个模式都通过 `pnpm --filter @yunpat/core` 运行，仅核心包有真实测试

### 现有测试目录

```
packages/core/test/
  ├── eventbus/          # EventBus 测试（最完善）
  ├── tools-selection/   # 工具选择优化
  ├── stability/         # 并发智能体测试
  ├── knowledge/         # 知识卡片测试
  ├── reasoning/         # 推理引擎测试
  ├── planning/          # 规划引擎测试
  ├── memory/            # 记忆系统测试
  ├── llm/               # LLM 适配器测试
  ├── agent/             # Agent 基类测试
  ├── gateway/           # 网关测试
  ├── observability/     # 可观测性测试
  ├── validation/        # 验证器测试
  └── ...
```

### 重要提示

- 其他包的 `test` 脚本大多是占位 `echo "Test not implemented yet"`
- 测试需要真实 API Key（`DEEPSEEK_API_KEY` 或 `GLM_API_KEY`）
- 运行 `pnpm test` 会执行所有包的 test 脚本，其中大量是空的

---

## Git 与 CI

### 提交规范（Conventional Commits，软强制）

```
<type>(<scope>): <subject>

类型: feat | fix | docs | style | refactor | test | chore | ci | perf | revert | bump
```

commit-msg hook 会检查格式但不阻止（询问 y/N）。

### Pre-commit（Husky + lint-staged）

- 运行 `lint-staged`：TS/JS 文件走 ESLint + Prettier，JSON/MD/YAML 走 Prettier

### Pre-push

- 运行 `scripts/ci-check.sh`（完整构建 + 测试）

### CI（`pnpm ci:full`）

lint -> type-check -> test -> build

### GitHub Actions

`.github/workflows/` 目录当前为空——CI 配置待重建。

---

## 环境变量

### 最小配置（开发必需）

```bash
DEEPSEEK_API_KEY=sk-xxx          # 推荐默认 LLM
KNOWLEDGE_BASE_PATH=./knowledge-base  # 专利知识库
PROMPT_TEMPLATES_DIR=./prompts/patent-drafting
```

### LLM 支持矩阵

| 服务     | 变量                                               | 推荐场景               |
| -------- | -------------------------------------------------- | ---------------------- |
| DeepSeek | `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`            | 默认推荐，性价比高     |
| 通义千问 | `DASHSCOPE_API_KEY`                                | 分析任务               |
| 智谱 GLM | `GLM_API_KEY`, `GLM_MODEL`                         | 编程任务               |
| Ollama   | `OLLAMA_BASE_URL`, `OLLAMA_MODEL`                  | 离线/隐私场景          |
| OMLX     | `OMLX_BASE_URL`, `OMLX_API_KEY`, `OMLX_MODEL_NAME` | Apple Silicon 本地模型 |

### 数据库

- PostgreSQL：`DATABASE_URL`（默认 `postgresql://yunpat:yunpat123@localhost:5432/yunpat`）
- Schema：`packages/core/src/db/schema.ts`
- Migrations：`packages/core/src/db/migrations/`
- Drizzle 配置：`drizzle.config.ts`

---

## 关键入口文件

| 目标                 | 位置                                                             |
| -------------------- | ---------------------------------------------------------------- |
| 核心框架入口         | `packages/core/src/index.ts`（528 行，~356 个导出）              |
| Agent 基类           | `packages/core/src/agent/Agent.ts`                               |
| EventBus             | `packages/core/src/eventbus/EventBus.ts`                         |
| LLM 适配器           | `packages/core/src/llm/NativeLLMAdapter.ts`                      |
| ProfessionalAgent    | `packages/agents/base/src/ProfessionalAgent.ts`                  |
| PatentWriterAgent    | `packages/agents/patent-writer/src/PatentWriterAgent.ts`         |
| PatentAnalyzerAgent  | `packages/agents/patent-analyzer/src/PatentAnalyzerAgentV2.ts`   |
| PatentResponderAgent | `packages/agents/patent-responder/src/PatentResponderAgentV5.ts` |
| PatentSearchAgent    | `packages/agents/search/src/PatentSearchAgent.v3.ts`             |
| MCP Server           | `packages/mcp-server/src/index.ts`                               |
| CLI                  | `packages/cli/src/index.ts`                                      |
| Orchestrator         | `packages/orchestrator/src/index.ts`                             |
| Orchestrator Adapter | `packages/orchestrator-adapter/src/index.ts`                     |
| TUI 入口             | `packages/tui/src/index.tsx`                                     |
| Skills 入口          | `packages/skills/src/index.ts`                                   |
| DB Schema            | `packages/core/src/db/schema.ts`                                 |
| 构建脚本             | `esbuild.config.mjs`                                             |
| Vitest 配置          | `packages/core/vitest.config.ts`                                 |

---

## Gotchas 与陷阱

1. **pnpm-workspace.yaml 与 package.json workspaces 不一致**：workspace YAML 列出了 `cli/patent-cli` 和 `patents/mcp`，但根 `package.json` 的 `workspaces` 字段只有 `packages/*` 和 `packages/agents/*`。`patents/mcp` 已不存在。pnpm 以 YAML 文件为准，但旧路径可能产生警告。

2. **`pnpm build` 只构建 core + cli**：`esbuild.config.mjs` 硬编码了只构建这两个包。构建其他包用 `pnpm --filter <pkg> build`。TUI 相关包用 `pnpm tui:build`。

3. **`pnpm build:tsc` 才是全量构建**：用 tsc 编译所有 `packages/*` 和 `packages/agents/*`。

4. **esbuild 类型声明生成是允许失败的**：esbuild 构建后尝试 `tsc --emitDeclarationOnly`，失败只输出警告不影响构建结果。

5. **大多数包的 test 脚本是占位**：`pnpm test` 会输出大量 "Test not implemented yet"。只看 `@yunpat/core` 的测试结果。用 `pnpm test:real` 或 `pnpm test:mock` 跑有意义的测试。

6. **ESM 导入必须带 `.js` 扩展名**：`import { foo } from './bar.js'`（即使源文件是 `.ts`）。

7. **orchestrator 包的 ESLint 规则更严格**：`no-explicit-any` 和 `no-unused-vars` 是 error 而非 warn。

8. **patent-responder 有多个版本共存**：V2-V5 均在 src 中。V5 是当前主版本（集成真实数据库），通过 index.ts 导出。新代码应使用 V5。

9. **patent-analyzer 当前版本是 V2**：`PatentAnalyzerAgentV2` 是主版本，集成真实数据库。旧版 `PatentAnalyzerAgent` 仍保留。

10. **patent-search 当前版本是 V3**：`PatentSearchAgent.v3.ts` 是主版本，集成真实数据库。V2 仍保留。

11. **Rust 工具链通过 CLI bridge 调用**：`packages/patent-core` 通过 `PatentCoreBridge.js` 调用 Rust 二进制，失败时回退到 `PatentCoreFallback.js`（纯 TS 实现）。`packages/rust-tools` 是独立的 Rust 工具服务。

12. **知识库路径硬编码在多处**：`.env.example` 中的 `KNOWLEDGE_BASE_PATH` 默认指向 `/Users/xujian/projects/YunPat/knowledge-base`，新环境需要修改。

13. **Docker compose 定义了 4 个服务**：agent-service（TS）、vector-service（Rust）、scheduler-service（Rust）、python-tools（Python 隔离），但构建上下文可能不完整。

14. **Drizzle ORM schema 在 core 包中**：`packages/core/src/db/schema.ts`，不是独立包。

15. **TUI 使用 React/Ink 框架**：`packages/tui` 使用 `.tsx` 文件，是项目中唯一使用 React 的包。构建需要 `pnpm tui:build`，会同时构建 `@yunpat/orchestrator-adapter`。

16. **orchestrator-adapter 是 Rust/Node 桥接层**：仅 4 个 src 文件，负责将 Rust Gateway 的请求转换为 Node.js 调用。被 TUI 依赖。

---

## 文档管理规则

项目有严格的文档放置规则（`docs/FILE_MANAGEMENT_RULES.md`）：

- 根目录只保留核心配置和入口文档
- 报告 -> `docs/reports/YYYY-MM/`
- 计划 -> `docs/plans/{refactor,optimization,migration,feature}/`
- 指南 -> `docs/guides/`
- 架构 -> `docs/architecture/`
- 历史/废弃 -> `docs/history/` 或 `docs/archive/`
- 新建文档用 `./scripts/new-doc-template.sh`
- 定期运行 `./scripts/check-file-placement.sh` 检查文件位置

---

_最后更新：2026-05-06_
