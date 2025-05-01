# YunPat - 知识产权全生命周期智能体平台

## 🔒 本地优先承诺

**YunPat 承诺：您的专利数据永不离开您的控制**

- ✅ **100% 可本地部署** — 所有核心功能可在您的本地机器运行
- ✅ **数据主权** — 技术交底书、专利申请、审查意见等敏感数据由您完全掌控
- ✅ **可选云服务** — LLM API 可使用本地模型（Ollama）或您选择的服务商
- ✅ **开源透明** — MIT 许可证，所有代码公开可审计

> 本地优先设计意味着：即使在最敏感的专利工作中，您也不必担心数据泄露风险。

---

**版本**: v0.1.0 (开发中)
**定位**: 为专利代理所、律师事务所和企业 IP 部门提供智能化专利管理

[![CI](https://github.com/xujian519/yunpat/workflows/CI/badge.svg)](https://github.com/xujian519/yunpat/actions/workflows/ci.yml)
[![代码质量](https://github.com/xujian519/yunpat/workflows/代码质量/badge.svg)](https://github.com/xujian519/yunpat/actions/workflows/code-quality.yml)
[![发布](https://github.com/xujian519/yunpat/workflows/发布/badge.svg)](https://github.com/xujian519/yunpat/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@yunpat/core)](https://www.npmjs.com/package/@yunpat/core)

---

## 产品定位

**使命**：让专利工作更智能、更高效、更专业

**核心价值**：

- 撰写效率提升 3-5 倍：AI 辅助撰写专利申请文件
- 授权率提高 20-30%：智能审查答复，提高专利授权率
- 成本降低 40-60%：自动化流程，减少人力投入
- 全流程可视：专利全景视图，风险实时预警

---

## 项目结构

```
yunpat/
├── packages/                # 可复用代码包（pnpm workspace，20个顶层包+30个agent子包）
│   ├── core/                # 核心框架（238个src文件，82个测试，~63,000行）
│   ├── orchestrator/        # 智能体编排器（17个src文件：intent/planning/routing/exception）
│   ├── orchestrator-adapter/ # 编排器适配器（4个src文件，Rust网关桥接）
│   ├── agents/              # 专业智能体（30个子包）
│   │   ├── base/            # ProfessionalAgent 基类
│   │   ├── patent-writer/   # 专利撰写智能体（5个src文件）
│   │   ├── patent-analyzer/ # 专利分析智能体（14个src文件，V2，真实数据库）
│   │   ├── patent-responder/# 审查答复智能体（18个src文件，V5，真实数据库）
│   │   ├── patent-manager/  # 专利管理智能体（7个src文件）
│   │   ├── search/          # 专利检索智能体（5个src文件，V3，真实数据库）
│   │   ├── invention/       # 发明理解智能体（4个src文件）
│   │   ├── analysis/        # 分析智能体（5个src文件）
│   │   ├── quality/         # 质量评估智能体（3个src文件）
│   │   ├── specification/   # 说明书智能体（2个src文件）
│   │   ├── tech-unit/       # 最小技术单元提取智能体（五步识别法，6种场景）
│   │   ├── image-understanding/ # 图像理解智能体（3个src文件）
│   │   └── ...              # （另有18个专业智能体子包）
│   ├── builtin-tools/       # 内置基础工具（10个src文件）
│   ├── patent-tools/        # 专利专用工具（9个src文件）
│   ├── document-tools/      # 文档解析工具（14个src文件）
│   ├── image-tools/         # 图像处理工具（3个src文件）
│   ├── patent-database/     # 专利数据库（5个src文件，PatentDB + Google Patents）
│   ├── patent-knowledge/    # 知识库桥接（4个src文件，Obsidian 桥接）
│   ├── patent-prompts/      # 提示词模板（3个src文件，懒加载）
│   ├── patent-core/         # 专利核心（3个src文件，Rust桥接）
│   ├── unified-knowledge-graph/ # 统一知识图谱（7个src文件）
│   ├── grpc-server/         # gRPC 服务器（4个src文件）
│   ├── mcp-server/          # MCP 服务器（6个src文件）
│   ├── cli/                 # CLI 工具（21个src文件）
│   ├── skills/              # Skills 包（20个src文件）
│   ├── tui/                 # TUI 终端界面（17个src文件，React/Ink风格）
│   ├── rust-tools/          # Rust 工具网关
│   └── python-tools/        # Python ML 服务
│
├── docs/                    # 项目文档（371个markdown文件）
│   ├── architecture/        # 架构文档
│   ├── guides/              # 用户指南
│   ├── plans/               # 开发计划
│   ├── reports/             # 完成报告
│   ├── analysis/            # 分析文档
│   ├── testing/             # 测试文档
│   ├── agents/              # Agent 文档
│   └── meta/                # 元文档
├── examples/                # 使用示例（40个文件，16个分类）
│   ├── basic/               # 基础示例
│   ├── agents/              # Agent 示例
│   ├── architecture/        # 架构示例
│   ├── production/          # 生产示例
│   ├── patents/             # 专利示例
│   └── ...                  # （更多分类）
├── scripts/                 # 维护脚本（76个文件，按功能分类）
│   ├── ci/                  # CI/CD 脚本
│   ├── build/               # 构建脚本
│   ├── deploy/              # 部署脚本
│   ├── test/                # 测试脚本
│   ├── check/               # 检查脚本
│   └── ...                  # （更多分类）
├── test/                    # 测试套件（236个测试文件）
│   ├── integration/         # 端到端集成测试
│   ├── performance/         # 性能基准测试
│   ├── knowledge/           # 知识库测试
│   └── unit/                # 单元测试
├── knowledge-base/          # 专利知识库（4,382个markdown文件）
├── docker/                  # Docker 配置
│   ├── grafana/            # Grafana 仪表盘配置
│   └── prometheus/         # Prometheus 配置
├── config/                  # 配置文件
├── services/                # 微服务
└── protos/                  # Protobuf 定义
```

### 架构演进历程

**Phase 1**: 基础Agent框架

- 实现Agent抽象基类
- 建立五层架构（Gateway/Reasoning/LLM/Memory/Tools）

**Phase 2**: 推理层增强

- ReAct循环推理
- PlanAndSolve策略
- 思维树ToT

**Phase 3**: 意图识别与任务规划

- IntentRecognizer：智能意图识别
- TaskPlanner：动态任务规划
- 智能路由系统

**Phase 4**: HITL人机协作

- Human-in-the-Loop机制
- 检查点管理
- 交互式工作流

**Phase 5**: 专业层Agent重构 ✅ **刚完成**

- 统一Plan-Execute架构
- ProfessionalAgent基类
- 四大专利Agent重构（Writer/Responder/Analyzer/Search）
- 与OrchestratorAgent集成

**Phase 6**: 系统集成与部署（已完成）

- 性能测试框架（`test/performance/`）
- Docker 容器化（`docker/`）
- 一键部署能力（`docker-compose.yml`）
- 监控体系（Prometheus + Grafana）
  - 3 个预配置仪表盘（API 性能、Agent 统计、系统健康）
  - 20+ 监控指标（HTTP/Agent/LLM/数据库/缓存）
  - metrics 服务器（`examples/simple-metrics-server.ts`）
- P0 级问题修复（Rust FFI、prom-client、metrics）

**Phase 7**: TUI 界面与真实 LLM 测试（当前阶段）

- TUI 终端界面（`packages/tui/`，React/Ink 风格，17个src文件）
- Skills 系统（`packages/skills/`，20个src文件）
- 测试迁移到真实 LLM（236个测试文件）
- CLI 真实智能体集成（`packages/cli/`，21个src文件）
- MCP 服务器真实智能体集成（`packages/mcp-server/`，6个src文件）

---

## 数据库演进策略

### Phase 1: SQLite（当前 - 开发阶段）

**定位**: 快速原型开发和小规模部署

**优势**:

- ✅ 零配置，开箱即用
- ✅ 单文件数据库，易于备份和迁移
- ✅ 适合中小规模（< 1000 件专利）
- ✅ 低资源消耗

**适用场景**:

- 个人用户或小团队（< 10 人）
- 专利数量 < 1000 件
- 单机部署
- 开发和测试环境

**实现**: 使用 better-sqlite3 + Drizzle ORM

### Phase 2: PostgreSQL（未来 - 生产阶段）

**定位**: 企业级生产部署

**优势**:

- ✅ 支持大规模数据（> 10000 件专利）
- ✅ 并发性能优秀
- ✅ 支持复杂查询和分析
- ✅ 数据完整性和可靠性高

**适用场景**:

- 企业用户或代理机构（> 10 人）
- 专利数量 > 1000 件
- 多用户协作
- 生产环境

**实现**: 使用 postgres-js + Drizzle ORM，提供平滑迁移路径

**详细规划**: [PatentManagerAgent 开发路线图](./docs/patent-manager-roadmap.md)

---

## 当前状态（2026-05-08）

**总体完成度**: ~77%（基于实际代码审计）

**项目规模**: 489 个 TS 源文件，237 个测试文件，~63,000 行核心代码，20 个顶层包 + 30 个 agent 子包

### 已完成

| 模块                     | 完成度 | 说明                                                                               |
| ------------------------ | ------ | ---------------------------------------------------------------------------------- |
| 核心框架 (packages/core) | 95%    | 238 个 TS 文件，~63,000 行代码，82 个测试文件，Gateway 认证体系完成                |
| Gateway 认证体系         | 95%    | BasicAuth + JWT + Session 完整认证链，salt+SHA256 安全存储                         |
| WebSocket 审批服务器     | 90%    | 原生 WebSocket 实现，支持 CLI/HTTP/WS 三种审批模式                                 |
| 最小技术单元提取         | 90%    | MinimumTechUnitAgent，五步识别法，6种专利场景，9个测试通过                         |
| 知识库集成               | 100%   | 4,382 个 markdown 文件，ObsidianKnowledgeBridge                                    |
| 推理层增强               | 100%   | ReAct/PlanAndSolve/ToT 全部完成并集成                                              |
| 监控系统                 | 100%   | Prometheus + Grafana 完整配置，metrics 服务器，3 个仪表盘                          |
| Docker 部署              | 90%    | 完整容器化，docker-compose 一键部署，包含监控服务栈                                |
| Rust 工具链              | 85%    | FFI 边界安全加固，空指针验证，单元测试通过                                         |
| 专利数据库               | 100%   | patent-database 包：双数据源（PatentDB + Google Patents），7500万CN专利 + 全球专利 |
| 专利检索                 | 100%   | PatentSearchAgentV3：集成真实数据库，性能提升 20 倍                                |
| 专利分析                 | 100%   | PatentAnalyzerAgentV2：集成真实数据库，自动检索对比专利                            |
| 专利答复                 | 100%   | PatentResponderAgentV5：集成真实数据库，自动检索先例案例                           |
| PatentWriterAgent        | 85%    | 知识库+模板+Rust桥接，最成熟的智能体                                               |
| 提示词模板               | 85%    | 懒加载策略                                                                         |
| 文档体系                 | 95%    | 371 个 markdown 文档文件，完整的技术文档和监控指南                                 |
| 测试覆盖                 | 90%    | 236 个测试文件，已迁移到真实 LLM 测试                                              |

### 待完成

| 模块               | 完成度 | 问题                                              |
| ------------------ | ------ | ------------------------------------------------- |
| CLI 工具           | 85%    | 已集成真实智能体，完整工作流可用（将被 TUI 替代） |
| MCP 服务器         | 85%    | 已集成真实智能体，支持规则模式回退                |
| TUI 终端界面       | 80%    | React/Ink 风格 TUI，持续完善中                    |
| Skills 系统        | 85%    | 20 个 src 文件，持续完善中                        |
| PatentWriterAgent  | 85%    | 端到端验证，补充缺失功能                          |
| PatentManagerAgent | 40%    | 框架完成，待数据库实现（SQLite -> PostgreSQL）    |

### 下一步（按优先级）

1. **TUI 终端界面完善**（当前，Phase 7）
   - React/Ink 风格交互式终端界面
   - Claude Code 风格用户体验
2. **测试体系持续完善**（当前，Phase 7）
   - 已迁移到真实 LLM 测试（237 个测试文件）
   - 补充 Observability 模块单元测试
3. PatentWriterAgent 端到端验证
4. **智能体增强**（持续）
   - 最小技术单元提取智能体深度优化
   - ApprovalFlow PromptTemplate 反馈学习持续改进
   - 通用智能体包完善
5. CLI 工具和 MCP 服务器功能完善
6. **PatentManagerAgent**（中期目标）
   - 实现基于 SQLite 的数据库后端
   - 完善管理功能（期限、费用、状态跟踪）
   - 未来迁移到 PostgreSQL

---

## 快速开始

### 安装

```bash
git clone https://github.com/your-org/yunpat.git
cd yunpat
pnpm install
pnpm build
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少配置一个 LLM API Key
# DEEPSEEK_API_KEY=sk-...
# DASHSCOPE_API_KEY=sk-...
```

### 命令行使用

#### 1. 初始化框架

```bash
export DEEPSEEK_API_KEY=your_key
yunpat init
```

#### 2. 完整专利撰写工作流（推荐）

```bash
yunpat draft-full \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md \
  --output patent-application.json
```

**流程**: 发明理解 → 检索 → 说明书 → 权利要求 → 摘要

#### 3. 专利检索

```bash
yunpat search \
  --title "..." \
  --field "..." \
  --disclosure examples/disclosure-example.md \
  --output search-report.json
```

#### 4. 列出可用智能体

```bash
yunpat list
```

### 使用智能体 API

```typescript
import { PatentWriterAgent } from '@yunpat/patent-writer'

const writer = new PatentWriterAgent({
  name: 'patent-writer',
  description: '专利撰写智能体',
  eventBus,
  memory,
  tools,
  llm,
})

const result = await writer.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  technicalSolution: '...',
})
```

### 启动监控系统（推荐）

```bash
# 启动监控服务栈
docker-compose up -d prometheus grafana

# 启动 metrics 服务器
npx tsx examples/simple-metrics-server.ts

# 访问服务
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# Metrics: http://localhost:3000/metrics
```

**详见**: [监控系统快速入门](./GETTING_STARTED_WITH_MONITORING.md)

### 运行测试

本项目已迁移到**真实 LLM 测试**，236 个测试文件，提供更可靠的测试结果。

```bash
# 1. 配置测试环境变量
cp .env.test.example .env.test
# 编辑 .env.test，配置至少一个 LLM API Key

# 2. 运行全部测试（自动选择可用的 LLM 提供商）
pnpm test

# 3. 运行核心包测试
pnpm --filter @yunpat/core test

# 4. 使用 Mock 模式（无 API 调用，快速）
pnpm test:mock
```

**支持的 LLM 提供商**:

- DeepSeek（推荐，性价比高）
- Anthropic Claude（高质量）
- OpenAI GPT
- 本地 Ollama（免费）
- 本地 OMLX（免费，Apple Silicon）

**详见**: [测试迁移指南](./docs/TEST_MIGRATION_GUIDE.md)

---

## 技术架构

### 五层架构

```
① 交互层 (Gateway) → 多模态输入、HITL、安全网关
         ↓
② 推理层 (Reasoning) → ReAct 循环、PlanAndSolve、思维树
         ↓
③ 核心引擎 (LLM) → DeepSeek/通义千问/Ollama
         ↓
④ 记忆层 (Memory) → 检查点、时间旅行、断点续传
         ↓
⑤ 工具层 (Tools) → 函数调用、MCP 协议、中间件管道
         ↓
⓪ 可观测性 (Observability) → Prometheus + Grafana 监控
```

### 多语言架构

- **TypeScript (70%)**: 应用层、业务逻辑层
- **Rust (30%)**: 性能关键型算法（IPC 分类、质量评估、特征提取）
- **Python (隔离)**: ML 模型、数据分析（gRPC 通信）

### 接口设计

- **gRPC/Protobuf**: 服务间通信
- **REST API**: 外部接口
- **WebSocket**: 实时通信
- **EventBus**: 智能体间通信（发布订阅 + RPC）

---

## 文档

### 核心文档

- [CLAUDE.md](./docs/guides/CLAUDE.md) - Claude Code 协作指南（含架构详解、开发命令）
- [AGENTS.md](./AGENTS.md) - AI 编程助手指南（完整技术参考）
- [CHANGELOG.md](./CHANGELOG.md) - 版本历史
- [路线图](./docs/plans/roadmap.md) - 发展路线图

### 开发文档

- [开发指南](./docs/guides/development.md) - 环境搭建、开发流程
- [API 文档](./docs/guides/api.md) - API 接口文档
- [项目结构](./docs/PROJECT_STRUCTURE.md) - 目录结构说明
- [安全指南](./docs/meta/SECURITY_GUIDELINES.md) - 安全最佳实践
- [文件管理规则](./docs/meta/FILE_MANAGEMENT_RULES.md) - 文档组织规范

### 系统分析与改进

- [提示词系统快速参考](./docs/analysis/prompt-system-quick-reference.md) - 30 秒理解核心差异
- [提示词系统核心启示](./docs/analysis/prompt-system-key-insights.md) - 核心差异一览表
- [提示词系统架构对比](./docs/analysis/prompt-system-architecture-comparison.md) - 可视化架构图

### 优化计划与实施

- [Skills 系统快速开始](./docs/guides/skills-quickstart.md) - 30 分钟上手指南
- [完整优化计划](./docs/plans/optimization/prompt-system-optimization-plan.md) - 6 阶段 8 周详细实施计划

### 部署与监控

- [监控系统快速入门](./docs/guides/monitoring.md) - Prometheus + Grafana 监控配置
- [Docker 部署指南](./docs/guides/deployment.md) - 容器化部署说明

### 文档中心

- [docs/README.md](./docs/README.md) - 完整的文档索引

---

## 商业模式（规划中）

---

## 联系方式

- 作者：Xu Jian <xujian519@gmail.com>
- 许可证：MIT
