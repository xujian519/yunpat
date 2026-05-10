# 架构设计

> 云熙知识产权智能体（YunPat Agent）系统架构文档
>
> 最后更新：2026-05-11

## 目录

- [1. 系统概览](#1-系统概览)
- [2. 分层架构](#2-分层架构)
- [3. Rust 层架构](#3-rust-层架构)
- [4. TypeScript 层架构](#4-typescript-层架构)
- [5. 关键设计决策](#5-关键设计决策)
- [6. 数据流详解](#6-数据流详解)
- [7. 配置与约定](#7-配置与约定)

---

## 1. 系统概览

### 1.1 项目定位

云熙知识产权智能体（YunPat Agent）是一个面向知识产权全生命周期的智能体操作系统。系统覆盖从专利检索、技术交底书分析、权利要求撰写、审查意见答复到专利监控的全流程，通过 24 个专业 Agent 的协同工作，为专利代理人和研发人员提供智能化辅助。

系统采用双语言 Monorepo 架构：Rust 负责交互层（CLI/TUI/HTTP 运行时 API），TypeScript 负责业务层（Agent 编排、MCP Server、专利工具）。Rust 与 TypeScript 之间通过 MCP（Model Context Protocol）stdio 进行通信。

### 1.2 项目规模

| 维度 | 数据 |
|------|------|
| Rust 代码 | ~208K 行，18 个 crate |
| TypeScript 代码 | ~196K 行，16 个基础设施包 |
| 专业 Agent | 24 个 |
| 构建系统 | Cargo（Rust）+ pnpm workspace（TypeScript） |

### 1.3 设计哲学

- **流式优先**：所有 LLM 响应均采用流式输出，确保用户体验的实时性
- **工具安全**：非 yolo 模式下，破坏性操作需经过审批门控
- **数据主权**：技术交底书等敏感内容禁止发送到外部 API
- **模块化 Agent**：每个专业 Agent 独立封装，通过统一接口协同

---

## 2. 分层架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            用户交互层（Rust）                                 │
│  ┌──────────┐    ┌──────────┐    ┌─────────────────┐                       │
│  │   CLI    │    │   TUI    │    │  App Server     │                       │
│  │          │    │（主运行时）│    │  (HTTP/SSE)     │                       │
│  └────┬─────┘    └────┬─────┘    └────────┬────────┘                       │
│       │               │                   │                                 │
│       └───────────────┼───────────────────┘                                 │
│                       ↓                                                     │
│  ┌──────────────────────────────────────────────────────────┐              │
│  │        Core Runtime Engine                               │              │
│  │  Agent Loop / Turn 编排 / 工具调度 / Hook 生命周期          │              │
│  └──────────────────────────┬───────────────────────────────┘              │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              ↓ MCP (stdio)
┌─────────────────────────────┼───────────────────────────────────────────────┐
│                             ↓                                                 │
│  ┌──────────────────────────────────────────────────────────┐              │
│  │           MCP Server（TypeScript）                        │              │
│  │         工具注册 + Constitutional 合规检查                 │              │
│  └──────────────────────────┬───────────────────────────────┘              │
│                             ↓                                                 │
│  ┌──────────────────────────────────────────────────────────┐              │
│  │           Orchestrator 调度器                             │              │
│  │  24 个专业 Agent 编排 / LangChain / 多 LLM 提供商           │              │
│  └──────┬───────────────┬───────────────┬───────────────────┘              │
│         ↓               ↓               ↓                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐                   │
│  │  专利工具集    │ │   知识层      │ │   其他基础设施     │                   │
│  │  权利要求生成  │ │  专利数据库    │ │   文档处理        │                   │
│  │  质量评估     │ │  知识图谱      │ │   图像识别        │                   │
│  │  审查意见答复  │ │  法律库       │ │   格式转换        │                   │
│  └──────────────┘ └──────────────┘ └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                             基础设施层                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  PostgreSQL  │  │    Redis     │  │  SQLite      │  │  LLM API     │    │
│  │  (生产数据)   │  │  (缓存)      │  │  (Rust state)│  │  (多提供商)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 层次说明

**用户交互层（Rust）**

提供三种接入方式：命令行（CLI）、终端用户界面（TUI）、HTTP API（App Server）。TUI 是主运行时，包含完整的 Agent 循环、工具调度和 Hook 生命周期管理。

**业务层（TypeScript）**

通过 MCP Server 接收 Rust 层的工具调用请求，经过 Constitutional 合规检查后，由 Orchestrator 调度 24 个专业 Agent 执行具体任务。Agent 框架基于 LangChain 构建，支持多 LLM 提供商。

**知识层**

专利数据库（7500 万中国专利本地存储）、统一知识图谱（融合 OpenClaw/YunPat/Athena 三个知识库）、法律库（法律法规、审查指南、复审无效决定）。

**基础设施层**

PostgreSQL 用于生产数据持久化，Redis 用于缓存，SQLite 用于 Rust 状态层（线程/会话管理），LLM API 支持 DeepSeek（默认）、Qwen、OpenAI、Anthropic、Ollama 等。

---

## 3. Rust 层架构

### 3.1 Crate 组织

18 个 crate 按职责分为三层：

#### 入口层（3 crate）

| Crate | 行数 | 职责 |
|-------|------|------|
| `tui` | ~170K | 主运行时。包含引擎、工具、LLM 客户端、TUI 渲染、运行时 API、任务管理器。4165 行 main.rs，50+ 内联模块 |
| `cli` | ~4K | 入口分发器，解析命令行参数后转发到 `deepseek-tui` |
| `app-server` | ~800 | HTTP/SSE + JSON-RPC 无头 Agent 服务，支持无 TUI 的服务器模式 |

#### 核心运行时（8 crate）

| Crate | 行数 | 职责 |
|-------|------|------|
| `core` | ~1.7K | 核心运行时边界：Agent 循环、会话管理、Turn 编排、容量流控 |
| `state` | ~1.8K | SQLite 线程/会话持久化，支持断点续传 |
| `tools` | ~500 | 工具调用生命周期、Schema 验证、并行调度器 |
| `hooks` | ~800 | 生命周期钩子：stdout、jsonl、webhook 三种输出格式 |
| `execpolicy` | ~1.5K | 审批/沙箱策略引擎，yolo 模式开关 |
| `mcp` | ~900 | MCP 客户端 + stdio 传输实现 |
| `protocol` | ~500 | 请求/响应帧和协议类型定义 |
| `agent` | ~500 | ModelRegistry — 模型/提供商注册表 |

#### 领域特定（7 crate）

| Crate | 行数 | 职责 |
|-------|------|------|
| `yunpat-agents` | ~10K | 专利领域 Agent trait 系统：专利检索、论文搜索、法律库、OCR、文档处理、Flow 编排 |
| `yunpat-mcp-bridge` | ~600 | MCP 桥接：从 Rust 调用 TypeScript/Python Agent |
| `yunpat-router` | ~400 | 意图路由和命令分发，4 级优先级路由机制 |
| `yunpat-models` | ~1.2K | 多提供商 ModelProvider 接口（SSE、OpenAI 兼容） |
| `config` | ~2K | 配置加载、profiles、环境变量优先级管理 |
| `secrets` | ~800 | OS keyring API key 安全存储 |

### 3.2 核心运行时结构

`Runtime` 结构体是 Rust 层的中央协调器，包含以下核心组件：

```rust
struct Runtime {
    thread_manager: ThreadManager,      // 线程生命周期管理
    job_manager: JobManager,            // 任务队列与调度
    tool_registry: ToolRegistry,        // 工具注册表与 Schema 验证
    mcp_manager: McpManager,            // MCP 客户端管理（stdio 连接）
    exec_policy: ExecPolicyEngine,      // 审批策略引擎
    hook_dispatcher: HookDispatcher,    // 生命周期钩子分发
    llm_client: LlmClient,              // 流式 LLM API 客户端
    state: StateManager,                // SQLite 持久化
}
```

### 3.3 数据流（Rust 层内部）

```
用户输入
  ↓
TUI/CLI/HTTP → core::engine
  ↓
llm_client → LLM API（流式 Chat Completions）
  ↓
响应流 → 工具调用提取 → tool_registry 路由
  ↓
Pre-hooks → 审批门控（非 yolo 模式）→ 工具执行 → Post-hooks
  ↓
文件编辑 → LSP 诊断注入下一轮模型上下文
  ↓
结果聚合 → LLM 下一步推理
```

### 3.4 Crate 依赖关系

```
                    ┌─────────┐
                    │   cli   │
                    └────┬────┘
                         ↓
┌─────────┐         ┌─────────┐
│app-server│         │   tui   │
└────┬────┘         └────┬────┘
     │                   │
     └───────────────────┘
                         ↓
              ┌─────────────────┐
              │      core       │
              └────────┬────────┘
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │  state  │   │  tools  │   │  agent  │
   └─────────┘   └────┬────┘   └────┬────┘
                      ↓             ↓
               ┌─────────┐    ┌───────────┐
               │   mcp   │    │yunpat-models│
               └────┬────┘    └───────────┘
                    ↓
             ┌─────────────┐
             │yunpat-mcp-bridge│
             └─────────────┘
                    ↓
             ┌─────────────┐
             │   protocol  │
             └─────────────┘
```

说明：
- `cli` 和 `app-server` 都依赖 `tui`
- `tui` 依赖 `core` 作为运行时边界
- `core` 向下依赖 `state`、`tools`、`agent`、`hooks`、`execpolicy`
- `tools` 依赖 `mcp` 进行工具调用
- `mcp` 通过 `yunpat-mcp-bridge` 与 TypeScript 层通信
- `yunpat-router` 被 `core` 用于意图识别
- `config` 和 `secrets` 被多个 crate 共享

---

## 4. TypeScript 层架构

### 4.1 五层核心框架（@yunpat/core）

`@yunpat/core` 是智能体框架核心（~56K 行），提供 Agent 抽象、事件总线、生命周期管理、LLM 集成、数据库和内存管理。其内部采用五层架构：

```
┌─────────────────────────────────────────────┐
│              Gateway 网关层                  │
│     请求接入 / 协议转换 / 路由分发             │
└─────────────────────┬───────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│            Reasoning 推理层                  │
│     意图识别 / 任务规划 / 上下文管理           │
└─────────────────────┬───────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│              LLM 适配层                      │
│     多提供商统一接口 / 流式处理 / Token 管理   │
└─────────────────────┬───────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│             Memory 记忆层                    │
│     短期上下文 / 长期记忆 / 向量检索           │
└─────────────────────┬───────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│              Tools 工具层                    │
│     工具注册 / Schema 定义 / 执行调度          │
└─────────────────────────────────────────────┘
```

### 4.2 Orchestrator 调度器

`@yunpat/orchestrator`（~6.5K 行）是专利 Agent 的中央调度系统，通过 5 次 LLM 调用编排完成复杂任务：

1. **意图识别**：分析用户输入，确定任务类型和所需 Agent
2. **任务规划**：将任务分解为可执行的子任务序列
3. **HITL 确认**：必要时向用户请求确认或补充信息
4. **结果聚合**：收集各 Agent 执行结果，整合为统一响应
5. **异常处理**：处理执行过程中的错误和边界情况

```
用户输入
  ↓
[Intent Recognition] → 确定任务类型
  ↓
[Task Planning] → 生成子任务序列
  ↓
[HITL Confirmation] → 用户确认（可选）
  ↓
[Agent Execution] → 调度 24 个专业 Agent
  ↓
[Result Aggregation] → 整合输出
  ↓
[Exception Handling] → 错误恢复
  ↓
最终响应
```

### 4.3 24 个专业 Agent

Agent 按功能分为 7 类：

| 类别 | 数量 | Agent 名称 | 行数 | 职责 |
|------|------|-----------|------|------|
| 撰写类 | 5 | `writer` | ~900 | 集成知识库和分步加载提示词模板的专利撰写 |
| | | `claim-generator` | ~900 | 基于发明理解和检索分析撰写权利要求 |
| | | `specification-drafter` | ~1.9K | 分章节撰写专利说明书 |
| | | `abstract-drafter` | ~340 | 专利摘要撰写 |
| | | `patent-responder` | ~8.6K | OA 审查意见答复与策略生成 |
| 分析类 | 4 | `analysis` | ~1.1K | 现有技术深度分析、对比分析、交底书再分析 |
| | | `patent-analyzer` | ~1.4K | 专利文献深度分析 |
| | | `tech-unit` | ~900 | 专利技术特征划分与最小技术单元识别 |
| | | `image-understanding` | ~530 | 使用多模态模型理解专利说明书附图 |
| 检索类 | 3 | `search` | ~1.8K | 专利检索策略生成与执行 |
| | | `prior-art-search` | ~760 | 构建检索策略并分析现有技术 |
| | | `researcher` | ~410 | 信息搜集、数据整理、报告生成 |
| 质量类 | 3 | `quality` | ~1K | 权利要求/说明书/术语一致性检查 |
| | | `quality-checker` | ~1.6K | 专利申请质量评估 |
| | | `unity-checker` | ~690 | 检查专利申请文件一致性 |
| 法律类 | 2 | `legal-qa` | ~500 | 基于法律世界模型的三库联动问答 |
| | | `subject-matter-checker` | ~700 | 检查专利申请技术主题合规性 |
| 格式类 | 3 | `format-converter` | ~470 | Markdown/结构化内容转 DOCX |
| | | `spec-formality-checker` | ~630 | 检查专利说明书格式合规性 |
| | | `technical-drawing` | ~470 | 技术图纸识别（化学结构、数学公式、OCR） |
| 其他 | 4 | `invention` | ~2.2K | 专利交底书分析与结构化理解 |
| | | `patent-manager` | ~3.3K | 专利全生命周期管理与监控 |
| | | `comparison-report-generator` | ~680 | 生成专利申请与现有技术的对比分析报告 |
| | | `base` | ~820 | 专业层 Agent 基类（统一架构） |

### 4.4 Agent 继承体系

```
Agent（基础接口）
  ↓
ProfessionalAgent（专业层基类）
  ↓
  ├─ WriterAgent
  ├─ SearchAgent
  ├─ AnalysisAgent
  ├─ QualityAgent
  ├─ LegalAgent
  ├─ FormatAgent
  └─ ...（其他专业 Agent）
```

`base` Agent 包定义了统一架构：
- `Agent` trait：所有 Agent 必须实现的基础接口（初始化、执行、清理）
- `ProfessionalAgent` trait：专利领域通用能力（LLM 调用、工具使用、记忆管理）
- 具体 Agent：继承 `ProfessionalAgent`，实现特定领域的业务逻辑

### 4.5 工具包体系

| 包名 | 行数 | 职责 |
|------|------|------|
| `@yunpat/patent-tools` | ~2.8K | 专利专用工具：权利要求生成、质量评估、审查意见答复 |
| `@yunpat/document-tools` | ~5.4K | 文档解析工具集：PDF、DOCX、Excel、图片、音频 |
| `@yunpat/builtin-tools` | ~4K | 内置工具集：文件操作、搜索、网络请求 |
| `@yunpat/image-tools` | ~330 | 图像识别工具：化学结构、数学公式 |

### 4.6 数据层

| 包名 | 行数 | 职责 |
|------|------|------|
| `@yunpat/patent-database` | ~1.2K | 专利数据库访问层（Drizzle ORM）。支持 `patent_db`（7500 万中国专利）和 Google Patents（全球） |
| `@yunpat/unified-knowledge-graph` | ~3K | 统一知识图谱，融合 OpenClaw + YunPat + Athena 三个知识库 |
| `@yunpat/patent-knowledge` | ~750 | 专利知识库访问（Obsidian 集成） |

---

## 5. 关键设计决策

### 5.1 MCP 通信：Rust 与 TypeScript 之间的通信协议

**决策**：Rust 与 TypeScript 之间通过 MCP（Model Context Protocol）stdio 进行通信。

**权衡**：
- **优点**：MCP 是标准化协议，支持工具发现、Schema 验证和流式传输；stdio 传输简单可靠，无需网络配置
- **缺点**：相比 gRPC 或 HTTP，stdio 的吞吐量和并发能力有限；调试难度较高（需要追踪进程间通信）
- **替代方案**：曾考虑使用 gRPC（已有一个 `@yunpat/grpc-server` 包，430 行，作为实验性实现）和 HTTP REST，但 MCP 的标准化程度更符合长期演进方向

**实现细节**：
- `yunpat-mcp-bridge` crate 负责 Rust 端的 MCP 客户端
- `@yunpat/mcp-server`（~2.8K 行）负责 TypeScript 端的 MCP 服务端，向 Claude Desktop 等客户端暴露专利工具
- 通信通过 stdio 管道进行，MCP Server 作为子进程由 Rust 层启动

### 5.2 数据主权（CON-01）

**决策**：技术交底书内容禁止发送到外部 API。

**背景**：技术交底书包含企业的核心技术创新，属于高度敏感信息。如果直接发送到外部 LLM API，存在数据泄露风险。

**实现**：
- 规则定义在 `constitutional/data-sovereignty.yaml`
- 检测实现在 `@yunpat/core/constitutional/DataSovereigntyChecker.ts`
- MCP Server 在工具调用前自动检测输入内容，命中 CON-01 规则时返回提示而非执行
- 对于必须在本地处理的敏感内容，使用本地部署的模型（Ollama）或严格的数据隔离策略

### 5.3 意图路由：yunpat-router 的 4 级优先级路由机制

**决策**：`deepseek` 始终以通用模式启动，`yunpat-router` 每轮检测用户意图，识别为专利相关时自动激活专利工具集。

**4 级优先级路由**：

1. **精确匹配**：用户输入匹配预定义的专利命令（如"检索专利"、"撰写权利要求"）
2. **关键词匹配**：用户输入包含专利相关关键词（如"IPC分类"、"审查意见"）
3. **语义匹配**：通过 LLM 判断用户意图是否与专利相关
4. **默认路由**：无法确定意图时，使用通用模式响应

**实现**：`yunpat-router` crate（~400 行）维护一个路由表，结合关键词匹配和轻量级语义分析，在本地完成意图识别，避免不必要的 LLM 调用。

### 5.4 Agent 特性：Agent trait 系统 vs 直接函数调用

**决策**：采用 Agent trait 系统而非直接函数调用。

**权衡**：
- **Agent trait 系统**：统一接口、可扩展性强、支持状态管理和记忆、便于测试和 mock
- **直接函数调用**：简单直接、性能更高、调试方便

**选择原因**：专利领域任务复杂度高，需要状态管理（如多轮对话中的上下文保持）、工具组合（如检索后分析再撰写）和记忆积累（如用户偏好学习）。Agent trait 系统提供了必要的抽象层。

### 5.5 双数据源：PatentDB + Google Patents

**决策**：专利查询同时支持 PatentDB（本地 7500 万中国专利）和 Google Patents（全球）。

**路由策略**：
- 默认优先查询 PatentDB（毫秒级响应，无需网络）
- 当 PatentDB 无结果或用户明确要求时，路由到 Google Patents
- 两个数据源的查询结果由 `patent-database` 包统一封装，对外提供一致接口

---

## 6. 数据流详解

### 6.1 完整请求处理流程

以下是一个典型用户请求（如"检索关于人工智能芯片的专利"）在系统中的完整处理流程：

```
阶段 1：用户输入接收
─────────────────────────
用户 → TUI/CLI/HTTP
  ↓
输入被封装为 Message 对象
  ↓
yunpat-router 进行意图识别（4 级优先级路由）
  ↓
识别为"专利检索"意图 → 激活专利工具集

阶段 2：Turn 编排
─────────────────────────
core::engine 创建新的 Turn
  ↓
加载会话上下文（state::SessionManager 从 SQLite 读取）
  ↓
构建 LLM 请求（包含系统提示词 + 历史消息 + 当前输入）
  ↓
llm_client 发送流式请求到 LLM API

阶段 3：LLM 响应与工具调用
─────────────────────────
LLM 返回流式响应
  ↓
响应内容实时显示给用户（流式优先）
  ↓
如果响应包含工具调用标记：
  ├─ 提取工具名称和参数
  ├─ tool_registry 查找工具实现
  └─ 确定工具执行目标（本地 Rust / MCP Server / 外部服务）

阶段 4：工具调度与执行
─────────────────────────
目标为 MCP Server（TypeScript 层）：
  ↓
mcp_manager 通过 stdio 发送工具调用请求
  ↓
TypeScript 层接收请求 → Constitutional 合规检查（CON-01 等）
  ↓
检查通过 → Orchestrator 调度 search Agent 执行检索
  ↓
Agent 调用 patent-database 查询 PatentDB / Google Patents
  ↓
Agent 返回检索结果

阶段 5：Hook 生命周期
─────────────────────────
Pre-hooks 执行（如日志记录、参数校验）
  ↓
工具执行
  ↓
Post-hooks 执行（如结果格式化、缓存更新）

阶段 6：审批门控
─────────────────────────
如果工具涉及破坏性操作（如文件删除、外部 API 调用）：
  ├─ exec_policy 检查当前模式（yolo / 审批 / 严格）
  ├─ 非 yolo 模式：暂停执行，向用户请求审批
  └─ 用户确认后继续 / 拒绝则终止

阶段 7：结果聚合与下一步推理
─────────────────────────
工具执行结果注入 LLM 上下文
  ↓
如果有文件编辑操作：
  └─ LSP 诊断结果注入下一轮上下文（如代码错误提示）
  ↓
LLM 基于工具结果生成下一步响应
  ↓
如果是最终响应：
  └─ 结果返回给用户，Turn 结束，会话状态持久化到 SQLite
  ↓
如果需要进一步工具调用：
  └─ 返回阶段 3，继续循环
```

### 6.2 工具调用路径

```
Rust 层工具调用
─────────────────
1. 本地 Rust 工具（如文件操作、网络请求）
   tools::builtin → 直接执行 → 结果返回

2. MCP 工具（TypeScript 层实现）
   tools::mcp → mcp_manager → stdio → @yunpat/mcp-server
   → Constitutional 检查 → Agent 执行 → 结果返回

3. 外部 API 工具（如 Google Patents）
   tools::external → HTTP 请求 → 结果返回
```

### 6.3 流式处理

系统所有 LLM 响应均采用流式处理：

```
LLM API → SSE 流
  ↓
yunpat-models（SSE 解析）
  ↓
core::engine（Token 聚合）
  ↓
TUI/CLI（实时渲染）
  ↓
用户看到逐字输出
```

流式处理的优势：
- 用户体验：用户无需等待完整响应，可即时看到输出
- 早期终止：如果响应方向错误，用户可提前中断
- 工具调用检测：在流式过程中实时检测工具调用标记，无需等待完整响应

---

## 7. 配置与约定

### 7.1 流式优先（Streaming-First）

所有 LLM 响应必须使用流式输出。这是系统的设计原则，不允许在核心路径中使用阻塞式请求。

### 7.2 模块系统

- **Rust**：标准 Cargo workspace，crate 间通过 `crates/Cargo.toml` 组织
- **TypeScript**：ESM 模块（`"type": "module"`），pnpm workspace，包间通过 `@yunpat/*` 命名空间引用
- 构建工具：esbuild（TypeScript，比 tsc 快约 30 倍）、cargo（Rust）

### 7.3 数据持久化

所有持久化记录必须包含 `schema_version` 字段，防止跨版本数据损坏。SQLite 用于 Rust 状态层（线程/会话管理），PostgreSQL 用于 TypeScript 业务数据（生产环境）。

### 7.4 沙箱安全

Rust 层使用 macOS Seatbelt sandboxing 对子进程进行沙箱隔离，限制文件系统和网络访问权限。TypeScript 层通过 `@yunpat/execpolicy-hook`（~310 行）实现参数级安全检查和审批门控。

### 7.5 配置文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 主配置 | `~/.deepseek/config.toml` | Rust 层配置 |
| MCP 配置 | `~/.deepseek/mcp.json` | MCP Server 配置 |
| 技能配置 | `~/.deepseek/skills/` | 模块化提示词和技能定义 |
| 快照目录 | `~/.deepseek/snapshots/` | Rust workspace snapshot 系统使用 side-git repos |

### 7.6 代码规范

- **Rust**：使用 `let_chains` 等现代特性（需要 Rust 1.88+）
- **TypeScript**：ES2022 target、ESNext modules、strict mode、bundler moduleResolution
- **测试**：TypeScript 使用 Vitest，Rust 使用标准 `#[cfg(test)]` + `tests/` 目录
- **API 风格**：OpenAI 兼容的 Chat Completions 接口，流式优先

### 7.7 开发模式

```bash
# 开发模式（热重载：Rust cargo-watch + TS esbuild watch + MCP Server）
make dev

# 构建
make build

# 测试
make test

# 代码质量
make lint
make format
```

---

## 附录

### 附录 A：Rust Crate 详细列表

| Crate | 路径 | 主要模块 |
|-------|------|---------|
| `tui` | `crates/tui/` | main.rs（4165 行）、engine、tools、llm_client、render |
| `yunpat-agents` | `crates/yunpat-agents/` | patent_search、paper_search、legal_lib、ocr、doc_processing、flow |
| `cli` | `crates/cli/` | 入口分发器 |
| `config` | `crates/config/` | 配置加载、profiles |
| `state` | `crates/state/` | SQLite 持久化 |
| `core` | `crates/core/` | Agent 循环、会话管理、Turn 编排 |
| `execpolicy` | `crates/execpolicy/` | 审批/沙箱策略 |
| `yunpat-models` | `crates/yunpat-models/` | ModelProvider、SSE、OpenAI 兼容 |
| `mcp` | `crates/mcp/` | MCP 客户端、stdio 传输 |
| `app-server` | `crates/app-server/` | HTTP/SSE、JSON-RPC |
| `secrets` | `crates/secrets/` | OS keyring |
| `hooks` | `crates/hooks/` | stdout、jsonl、webhook |
| `yunpat-mcp-bridge` | `crates/yunpat-mcp-bridge/` | MCP 桥接 |
| `agent` | `crates/agent/` | ModelRegistry |
| `tools` | `crates/tools/` | 工具生命周期、Schema 验证、并行调度 |
| `protocol` | `crates/protocol/` | 协议类型 |
| `yunpat-router` | `crates/yunpat-router/` | 意图路由、命令分发 |

### 附录 B：TypeScript 包详细列表

| 包名 | 路径 | 主要模块 |
|------|------|---------|
| `@yunpat/core` | `packages/packages/core/` | Agent 抽象、事件总线、LLM 集成、DB |
| `@yunpat/orchestrator` | `packages/packages/orchestrator/` | 中央调度、5 次 LLM 调用编排 |
| `@yunpat/document-tools` | `packages/packages/document-tools/` | PDF、DOCX、Excel、图片、音频解析 |
| `@yunpat/builtin-tools` | `packages/packages/builtin-tools/` | 文件操作、搜索、网络请求 |
| `@yunpat/mcp-server` | `packages/packages/mcp-server/` | MCP 协议服务端 |
| `@yunpat/skills` | `packages/packages/skills/` | 模块化提示词管理 |
| `@yunpat/patent-tools` | `packages/packages/patent-tools/` | 权利要求生成、质量评估 |
| `@yunpat/orchestrator-adapter` | `packages/packages/orchestrator-adapter/` | Rust Gateway 连接 |
| `@yunpat/patent-database` | `packages/packages/patent-database/` | Drizzle ORM、双数据源 |
| `@yunpat/unified-knowledge-graph` | `packages/packages/unified-knowledge-graph/` | 三库融合 |
| `@yunpat/patent-knowledge` | `packages/packages/patent-knowledge/` | Obsidian 集成 |
| `@yunpat/patent-core` | `packages/packages/patent-core/` | Rust CLI 桥接 |
| `@yunpat/grpc-server` | `packages/packages/grpc-server/` | gRPC 服务（实验性） |
| `@yunpat/image-tools` | `packages/packages/image-tools/` | 化学结构、数学公式识别 |
| `@yunpat/execpolicy-hook` | `packages/packages/execpolicy-hook/` | 参数级安全检查 |
| `@yunpat/patent-prompts` | `packages/packages/patent-prompts/` | 提示词模板管理 |
| `@yunpat/patent-writer` | `packages/agents/writer/` | 专利撰写 Agent |
| `@yunpat/patent-search` | `packages/agents/search/` | 专利检索 Agent |
| `@yunpat/patent-analysis` | `packages/agents/analysis/` | 专利分析 Agent |
| `@yunpat/patent-quality` | `packages/agents/quality/` | 质量检查 Agent |
| `@yunpat/patent-legal` | `packages/agents/legal-qa/` | 法律问答 Agent |
| `@yunpat/patent-format` | `packages/agents/format-converter/` | 格式转换 Agent |
| `@yunpat/patent-invention` | `packages/agents/invention/` | 交底书分析 Agent |
| `@yunpat/patent-manager` | `packages/agents/patent-manager/` | 专利管理 Agent |
| `@yunpat/patent-responder` | `packages/agents/patent-responder/` | 审查意见答复 Agent |
| `@yunpat/patent-claim-generator` | `packages/agents/claim-generator/` | 权利要求生成 Agent |
| `@yunpat/patent-spec-drafter` | `packages/agents/specification-drafter/` | 说明书撰写 Agent |
| `@yunpat/patent-abstract-drafter` | `packages/agents/abstract-drafter/` | 摘要撰写 Agent |
| `@yunpat/patent-tech-unit` | `packages/agents/tech-unit/` | 技术单元识别 Agent |
| `@yunpat/patent-image-understanding` | `packages/agents/image-understanding/` | 图像理解 Agent |
| `@yunpat/patent-prior-art-search` | `packages/agents/prior-art-search/` | 现有技术检索 Agent |
| `@yunpat/patent-researcher` | `packages/agents/researcher/` | 信息搜集 Agent |
| `@yunpat/patent-quality-checker` | `packages/agents/quality-checker/` | 质量评估 Agent |
| `@yunpat/patent-unity-checker` | `packages/agents/unity-checker/` | 一致性检查 Agent |
| `@yunpat/patent-subject-matter-checker` | `packages/agents/subject-matter-checker/` | 主题合规检查 Agent |
| `@yunpat/patent-spec-formality-checker` | `packages/agents/spec-formality-checker/` | 格式合规检查 Agent |
| `@yunpat/patent-comparison-report-generator` | `packages/agents/comparison-report-generator/` | 对比报告生成 Agent |
| `@yunpat/patent-technical-drawing` | `packages/agents/technical-drawing/` | 技术图纸识别 Agent |
| `@yunpat/patent-base` | `packages/agents/base/` | Agent 基类 |

### 附录 C：术语表

| 术语 | 解释 |
|------|------|
| Agent | 智能体，具有特定领域能力的自主执行单元 |
| CON-01 | 数据主权规则编号，技术交底书禁止发送到外部 API |
| HITL | Human-In-The-Loop，人在回路，需要用户确认的环节 |
| MCP | Model Context Protocol，模型上下文协议，Rust 与 TypeScript 之间的通信协议 |
| Orchestrator | 调度器，负责协调多个 Agent 的执行顺序和结果聚合 |
| Seatbelt | macOS 沙箱机制，限制进程的文件系统和网络访问 |
| SSE | Server-Sent Events，服务器推送事件，用于 LLM 流式响应 |
| TUI | Terminal User Interface，终端用户界面 |
| Turn | 一轮对话，包含用户输入、LLM 推理、工具调用和结果返回的完整周期 |
| yolo 模式 | 无需审批直接执行的模式开关 |
