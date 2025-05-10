# YunPat 记忆系统与交互层架构调研报告

> 日期: 2026-05-09
> 范围: 记忆系统三层架构 + 交互层入口 + 发明专利撰写端到端流程

---

## 一、记忆系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                   Rust 交互层记忆                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ user_memory.md   │  │ capacity_memory  │  │ state.db      │  │
│  │ 跨会话持久笔记    │  │ 容量流控快照     │  │ SQLite 会话   │  │
│  │ (~/.deepseek/)   │  │ (JSONL)          │  │ 持久化        │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │ remember tool       │                     │          │
│           │ /memory cmd         │                     │          │
│           │ # 快速添加           │                     │          │
├───────────┼─────────────────────┼─────────────────────┼──────────┤
│           ↓                     ↓                     ↓          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              RustCheckpointBridge (跨语言桥接)                │ │
│  │         TypeScript ↔ SQLite (~/.deepseek/state.db)           │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
├─────────────────────────────┼─────────────────────────────────────┤
│                   TypeScript 业务层记忆                         │
│                             │                                   │
│  ┌─────────────┐  ┌────────┴────────┐  ┌──────────────────┐    │
│  │ 短期记忆     │  │ 检查点管理       │  │ 长期记忆         │    │
│  │              │  │                  │  │                  │    │
│  │ ShortTerm    │  │ CheckpointManager│  │ MemoryLayer      │    │
│  │ Memory       │  │ + TimeMachine    │  │ ├─ VectorStore   │    │
│  │ (Map<K,V>)   │  │ + ResumeManager  │  │ │  (pgvector)    │    │
│  │              │  │ + EnhancedStore  │  │ └─ GraphStore    │    │
│  ┌─────────────┐  │                  │  │    (PostgreSQL)  │    │
│  │ Token窗口    │  │ FileSystem       │  │                  │    │
│  │ Manager      │  │ CheckpointStore  │  │ RAGEngine       │    │
│  │ Context      │  └──────────────────┘  │ (BGE-M3)        │    │
│  │ Manager      │                        └──────────────────┘    │
│  └─────────────┘                                                  │
│           ↑                    ↑                    ↑              │
│           └────────────────────┼────────────────────┘              │
│                                │                                   │
│                  MemoryStore 接口 (Lifecycle.ts)                   │
│                                │                                   │
│                  ExecutionContext.memory                           │
│                                │                                   │
│  ┌─────────────────────────────┼──────────────────────────────┐   │
│  │         24 个专业 Agent      │                              │   │
│  │  ProfessionalAgent → KnowledgeEnhancedAgent → Agent        │   │
│  │  全部通过 context.memory 访问统一接口                       │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 三层记忆详解

#### 第 1 层：短期记忆（工作记忆）

**实现文件**: `packages/core/src/memory/MemoryStore.ts`

| 组件 | 职责 | 存储 |
|------|------|------|
| `ShortTermMemory` | 基于 Map 的 KV 存储，保存对话历史、上下文、临时数据 | 内存 (`Map<string, unknown>`) |
| `MemoryManager` | 高级封装，带 LRU 压缩和记忆历史追踪 | 内存 |
| `EnhancedMemoryStore` | 增强版，融合检查点 + 倒排索引 + token 搜索 | 内存 |
| `TokenWindowManager` | 滑动窗口算法，Token 估算（中英文混合），语义摘要 | 无状态算法 |
| `ContextManager` | 对话上下文拼接、系统提示注入、Token 窗口管理 | 无状态算法 |

**关键特性**：
- `ShortTermMemory.search()` — 可选接入 `PostgresVectorStore`，降级为空数组
- `TokenWindowManager` — 滑动窗口 + 语义摘要，目标降低 Token 使用 60%+
- `ContextManager` — 构建最终发给 LLM 的上下文

#### 第 2 层：长期记忆（持久化）

**实现目录**: `packages/core/src/memory/long-term/`

| 组件 | 职责 | 存储后端 |
|------|------|---------|
| `PostgresVectorStore` | 向量存储和相似度检索（HNSW 索引） | PostgreSQL + pgvector |
| `PostgresGraphStore` | 知识图谱存储（实体、关系、路径查询） | PostgreSQL（邻接表模型） |
| `MemoryLayer` | 统一接口，整合向量 + 图存储，自动实体/关系抽取 | PostgreSQL |
| `EntityExtractor` | 从文本中自动抽取实体（基于规则） | 无状态 |
| `RelationExtractor` | 从文本中自动抽取关系（基于规则） | 无状态 |
| `RAGEngine` | 检索增强生成引擎，结合 BGE-M3 向量化 | PostgreSQL + BGE-M3 |
| `BGEIntegration` | BGE-M3 嵌入模型客户端，带缓存 | 外部 API |

**关键特性**：
- 向量维度：1024（BGE-M3）
- 性能目标：10 万向量 <100ms，100 万 <300ms
- 图查询：1-3 跳 <100ms，5 跳 <500ms
- 写入时自动抽取实体和关系，构建知识图谱

#### 第 3 层：检查点与状态管理

**实现文件**: `packages/core/src/memory/CheckpointManager.ts`, `FileSystemCheckpointStore.ts`, `RustCheckpointBridge.ts`

| 组件 | 职责 | 存储 |
|------|------|------|
| `CheckpointManager` | 检查点 CRUD、自动保存、超量清理 | 内存 + 可选外部存储 |
| `TimeMachine` | 时间旅行调试（回退、重放、分支、合并） | 内存 |
| `ResumeManager` | 断点续跑管理 | 依赖 CheckpointManager |
| `FileSystemCheckpointStore` | 文件系统持久化的检查点存储 | 磁盘 JSON |
| `RustCheckpointBridge` | 跨语言桥接，读写 Rust 的 SQLite state.db | SQLite (~/.deepseek/state.db) |

**关键特性**：
- 检查点包含：记忆快照 + 上下文快照 + 状态快照
- 双层存储：内存 Map + 可选外部存储（文件系统或 SQLite）
- `RustCheckpointBridge` 实现了 TypeScript ↔ Rust 的检查点互操作（`UnifiedCheckpoint` 格式，`schema_version=2`）

### 1.3 Rust 端记忆系统

| 组件 | 文件 | 职责 |
|------|------|------|
| `user_memory` | `crates/tui/src/memory.rs` | 用户级持久笔记文件（`~/.deepseek/memory.md`） |
| `remember` tool | `crates/tui/src/tools/remember.rs` | 模型可调用的记忆写入工具 |
| `capacity_memory` | `crates/tui/src/core/capacity_memory.rs` | 容量流控干预的持久化快照（JSONL） |
| `state` store | `crates/state/` | SQLite 会话持久化（线程/会话级别） |
| `compaction` | `crates/tui/src/compaction.rs` | 上下文压缩（80% 窗口触发，500K 下限） |
| `composer_history` | `crates/tui/src/composer_history.rs` | 跨会话输入历史（最多 1000 条） |

**User Memory 运行机制**（默认关闭，需 `enabled = true`）：
1. 启动时读取 `~/.deepseek/memory.md`
2. 包装为 `<user_memory>` XML 块注入系统提示
3. 用户可通过 `# 内容` 快速添加、`/memory` 查看/编辑
4. 模型可通过 `remember` 工具自动追加

**Capacity Memory 运行机制**：
- 容量控制器干预时写入 JSONL 记录到 `~/.deepseek/memory/` 或 `.deepseek/memory/`
- 包含：目标、约束、确认事实、未闭环事项、待执行动作、关键引用
- 支持回放验证

### 1.4 统一接口 — MemoryStore

TypeScript 侧的统一接口定义在 `packages/core/src/lifecycle/Lifecycle.ts`：

```typescript
interface MemoryStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
  getAll(): Promise<Record<string, unknown>>
  setAll(entries: Record<string, unknown>): Promise<void>
  clear(): Promise<void>
  search(query: string, topK?: number): Promise<MemoryEntry[]>  // 向量搜索
}
```

该接口通过 `ExecutionContext.memory` 注入到每个 Agent 的执行上下文中。

### 1.5 使用该记忆系统的智能体

**全部 24 个专业 Agent 都使用记忆系统**，通过继承链：

```
Agent (基类，接收 MemoryStore)
  └── KnowledgeEnhancedAgent (知识增强)
        └── ProfessionalAgent (专业层基类)
              ├── PatentWriterAgent        — 专利撰写
              ├── PatentAnalyzerAgentV2     — 专利分析
              ├── PatentResponderAgentV5    — 审查答复
              ├── PatentSearchAgentV3       — 专利检索
              ├── PatentManagerAgent        — 专利管理
              ├── InventionUnderstandingAgent — 发明理解
              ├── QualityCheckerAgent       — 质量检查
              ├── UnityChecker              — 一致性检查
              ├── SpecFormalityChecker      — 格式检查
              ├── SubjectMatterChecker      — 主题检查
              ├── PriorArtSearchAgent       — 现有技术检索
              ├── ComparisonReportGenerator — 对比报告
              ├── SpecificationDrafterAgent — 说明书撰写
              ├── WriterAgent               — 通用写作
              ├── AbstractDrafterAgent      — 摘要撰写
              ├── TechnicalDrawingAgent     — 技术图纸
              ├── ImageUnderstandingAgent   — 图像理解
              ├── FormatConverterAgent      — 格式转换
              ├── ClaimGeneratorAgent       — 权利要求生成
              ├── TechUnitAgent             — 最小技术单元
              └── ResearcherAgent           — 信息搜集
```

**Rust 端**：TUI 主运行时的所有会话都通过 `user_memory` 和 `state.db` 使用记忆。`remember` 工具对所有模式（Plan/Agent/YOLO）可用。

### 1.6 数据流总结

```
用户输入 → Rust TUI
  ├→ user_memory.md 注入 system prompt（跨会话）
  ├→ 会话历史写入 state.db（SQLite）
  └→ MCP → TypeScript Agent
       ├→ ExecutionContext.memory (MemoryStore 接口)
       │    ├→ ShortTermMemory (内存 KV)
       │    └→ search() → PostgresVectorStore (长期向量)
       ├→ CheckpointManager (检查点/时间旅行)
       └→ RustCheckpointBridge (TS ↔ Rust SQLite 同步)
```

---

## 二、交互层架构

### 2.1 交互层架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                        用户交互入口                                   │
│                                                                      │
│   ┌──────────┐   ┌───────────┐   ┌──────────────┐                   │
│   │ CLI      │   │   TUI     │   │  HTTP/SSE    │                   │
│   │ deepseek │   │ (主运行时) │   │ App Server   │                   │
│   │ 命令分发器 │   │ ratatui   │   │ JSON-RPC     │                   │
│   └────┬─────┘   └─────┬─────┘   └──────┬───────┘                   │
│        │               │                │                            │
│        └───────────────┼────────────────┘                            │
│                        ↓                                             │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │              Engine (Rust 核心引擎)                          │    │
│   │  ┌──────────────────────────────────────────────────────┐   │    │
│   │  │ Turn Loop (handle_yunpat_turn)                       │   │    │
│   │  │  1. 构建 system prompt (注入 user_memory, skills...) │   │    │    │
│   │  │  2. 发送到 LLM API (流式)                            │   │    │    │
│   │  │  3. 解析响应 → 提取 tool_calls                       │   │    │    │
│   │  │  4. 执行工具 (shell/edit/MCP/子Agent...)              │   │    │    │
│   │  │  5. 结果注入下一轮 → 循环                             │   │    │    │
│   │  └──────────────────────────────────────────────────────┘   │    │
│   │                                                              │    │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │    │
│   │  │ ToolRegistry │  │  MCP Pool    │  │ Capacity控制     │   │    │
│   │  │ (30+工具)    │  │  (MCP客户端) │  │ (上下文窗口管理) │   │    │
│   │  └──────────────┘  └──────┬───────┘  └──────────────────┘   │    │
│   └────────────────────────────┼─────────────────────────────────┘    │
│                                │ MCP stdio (JSON-RPC 2.0)            │
├────────────────────────────────┼─────────────────────────────────────┤
│                                ↓                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │            TypeScript MCP Server (yunpat-mcp)               │    │
│   │                                                             │    │
│   │  ┌──────────────────────────────────────────────────────┐   │    │
│   │  │ 10 个 MCP 工具：                                      │   │    │
│   │  │ patent_search / claims_generator / quality_checker    │   │    │
│   │  │ patent_writer / patent_compare / patent_dispatch      │   │    │
│   │  │ legal_knowledge_search / invalid_decision_search      │   │    │
│   │  │ patent_rule_search / project_scan                     │   │    │
│   │  └──────────────────────────────────────────────────────┘   │    │
│   │                        │                                     │    │
│   │                        ↓                                     │    │
│   │  ┌──────────────────────────────────────────────────────┐   │    │
│   │  │       OrchestratorAgent (5次LLM调用编排)              │   │    │
│   │  │  Call 1: 意图识别 → DRAFT_FULL / SEARCH / RESPOND_OA │   │    │
│   │  │  Call 2: 任务规划 → 生成有序步骤列表                   │   │    │
│   │  │  Call 3: HITL生成 → 关键节点人机协同                   │   │    │
│   │  │  Call 4: 结果聚合 → 合并多Agent输出                    │   │    │
│   │  │  Call 5: 异常降级 → 错误恢复                           │   │    │
│   │  └──────────────────────────────────────────────────────┘   │    │
│   │                        │                                     │    │
│   │                        ↓                                     │    │
│   │  ┌──────────────────────────────────────────────────────┐   │    │
│   │  │       AgentRegistry + AgentFactory (24个专业Agent)    │   │    │
│   │  │  invention / search / claim-generator                 │   │    │
│   │  │  specification-drafter / quality-checker              │   │    │
│   │  │  patent-responder / patent-analyzer ...               │   │    │
│   │  └──────────────────────────────────────────────────────┘   │    │
│   └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 三个交互入口

#### 入口 1：CLI 分发器 (`deepseek` 命令)

**文件**: `crates/cli/src/lib.rs`

用户运行 `deepseek` 命令 → CLI 解析参数 → **几乎所有命令都委托给 TUI 二进制文件**执行：

```
deepseek                          → delegate_to_tui()（无参数，启动 TUI）
deepseek "帮我写专利"              → delegate_to_tui(["--prompt", "帮我写专利"])
deepseek /draft                   → delegate_to_tui(["draft", ...])
deepseek serve --http             → delegate_to_tui(["serve", "--http"])
deepseek doctor                   → delegate_to_tui(["doctor"])
```

只有少量命令在 CLI 层直接处理（`login`, `auth`, `config`, `model`, `mcp-server`）。

CLI 命令结构（`Commands` 枚举）：
- `Run` / `Doctor` / `Models` / `Sessions` / `Resume` / `Fork` — 委托 TUI
- `Init` / `Setup` / `Exec` / `Review` / `Apply` / `Eval` — 委托 TUI
- `Mcp` / `Features` / `Serve` / `Completions` — 委托 TUI
- `Login` / `Logout` / `Auth` — 直接处理（配置管理）
- `McpServer` — 直接启动 MCP stdio 服务
- `Config` / `Model` / `Thread` / `Sandbox` — 直接处理
- `AppServer` — 启动 HTTP/SSE 服务

#### 入口 2：TUI 主运行时 (ratatui 终端界面)

**文件**: `crates/tui/src/core/engine.rs` + `turn_loop.rs`

核心是一个 **Turn Loop**（轮次循环）：

1. **用户输入** → 添加到 `session.messages`
2. **构建 system prompt** → 注入 user_memory + project_context + skills
3. **发送到 LLM API** → 流式接收响应（支持 DeepSeek V4 thinking blocks）
4. **解析响应** → 提取文本 + tool_calls
5. **执行工具** → 通过 ToolRegistry 路由到具体工具
6. **工具结果注入** → 作为下一条 user message，循环回到步骤 2
7. **终止条件** → 无 tool_calls / 达到 max_steps / 用户取消

三种运行模式：
- **Plan** 🔍 — 只读探索，模型调查和提案
- **Agent** 🤖 — 交互模式，多步工具使用+审批
- **YOLO** ⚡ — 自动审批所有工具

#### 入口 3：HTTP/SSE App Server

**文件**: `crates/app-server/`

无头模式运行，支持 JSON-RPC + SSE，适用于自动化流程集成。

### 2.3 Rust → TypeScript 跨语言桥接

Rust Engine 通过 **MCP (Model Context Protocol)** 调用 TypeScript 专利工具：

```
Rust Engine
  → MCP Pool (管理多个 MCP Server 子进程)
    → stdio (JSON-RPC 2.0)
      → TypeScript MCP Server (packages/mcp-server)
        → 初始化 EventBus + ShortTermMemory + ToolRegistry + LLM
        → 注册 10 个 MCP 工具
        → 按需调用 OrchestratorAgent 或具体 Agent
```

MCP Server 启动时自动初始化：
```typescript
const llm = createDeepSeekModel(apiKey)
const eventBus = new EventBus()
const memory = new ShortTermMemory()
const tools = new ToolRegistry(eventBus)
```

**数据主权检测**（CON-01）：MCP Server 在每次工具调用前，检查输入文本是否包含技术交底书敏感内容，命中则拒绝外部处理。

### 2.4 意图路由 (yunpat-router)

**文件**: `crates/yunpat-router/src/router.rs`

4 级路由优先级：

1. **显式命令**（`/draft`, `/search`, `/oa` 等）→ 直接路由到 Agent
2. **上下文关联** → 如果有活跃 Agent 会话，继续使用
3. **意图识别** → 关键词匹配（Phase 1，后续替换为 LLM）
4. **通用降级** → 默认行为

7 个预定义 Agent 标识：

| Agent ID | 触发关键词 |
|----------|-----------|
| `research` | 研究 + 法规/规则/案例/审查指南/法律 |
| `drafting` | 撰写/申请/专利申请/说明书/权利要求书/技术交底书/发明/摘要 |
| `oa-response` | 审查意见/Office Action/OA/答辩/驳回/审查员/通知书 |
| `reexamination` | 复审/驳回决定/复审请求 |
| `invalidation` | 无效/无效宣告/无效请求 |
| `search` | 检索/查专利/现有技术/对比文件/新颖性/查新/专利号 |
| `analysis` | 侵权/侵权分析/专利分析/技术特征/保护范围/无效分析 |

---

## 三、以「撰写发明专利」为例的完整流程

### 3.1 场景

用户输入：**"帮我撰写一个关于深度学习图像识别方法的发明专利"**

### 3.2 Step 1: 用户输入 → Rust TUI

```
用户在 TUI 输入框键入 → Engine.submit() → 添加到 session.messages
```

Engine 还会同时：
- 刷新 system prompt（注入 user_memory、skills、project context）
- 检测 workspace 中的附件文件（@disclosure.md 等）

### 3.3 Step 2: LLM 响应或调用 MCP 工具

**路径 A — LLM 直接处理（当前默认）**：

LLM 本身就是 DeepSeek V4（1M token 上下文），它可以直接利用 TUI 的内置工具（shell、edit、file_read 等）完成代码级工作。

**路径 B — 调用 MCP 专利工具（专业场景）**：

LLM 识别到专利撰写意图 → 调用 `yunpat-patent-tools` MCP Server 的工具，例如 `patent_dispatch` 或 `patent_writer`。

### 3.4 Step 3: MCP Server → Orchestrator 编排

MCP Server 收到工具调用后，路由到 `OrchestratorAgent.execute()`，执行 **5 次 LLM 调用流程**：

#### Call 1: 意图识别（IntentRecognizer）

```
输入: "帮我撰写一个关于深度学习图像识别方法的发明专利"
     + 文件信号（如果用户上传了技术交底书）

输出: {
  intent: "DRAFT_FULL",
  confidence: 0.95,
  complexity: "complex",
  extracted: {
    title: "深度学习图像识别方法",
    field: "人工智能",
    hasAttachment: false,
    urgency: "normal",
    keywords: ["深度学习", "图像识别", "撰写", "发明专利"]
  }
}
```

意图识别来源优先级：
1. 显式命令（`/draft`）→ 直接路由
2. 文件信号（技术交底书文件）→ 自动推断 DRAFT_FULL
3. 关键词匹配（"撰写"、"专利申请"、"发明"）→ DRAFT_FULL
4. LLM 语义分析 → 最终兜底

#### Call 2: 任务规划（TaskPlanner）

根据 DRAFT_FULL 意图，生成 **8 步任务计划**：

| 步骤 | Agent | 依赖 | 并行 | HITL | 超时 |
|------|-------|------|------|------|------|
| 1. search-prior-art | search | 无 | ✅ | ❌ | 60s |
| 2. query-knowledge-base | researcher | 无 | ✅ | ❌ | 30s |
| 3. understand-invention | invention | 1+2 | ❌ | ❌ | 60s |
| 4. draft-claims | claim-generator | 3 | ❌ | ★ | 90s |
| 5. draft-specification | specification-drafter | 4 | ❌ | ❌ | 120s |
| 6. claims-formality-check | claim-generator | 4 | ✅ | ❌ | 30s |
| 7. spec-formality-check | spec-formality-checker | 5 | ✅ | ❌ | 30s |
| 8. generate-docx | writer | 5+6+7 | ❌ | ❌ | 30s |

依赖关系图：
```
Step 1 (检索) ─────┐
                    ├→ Step 3 (发明理解) → Step 4 (权利要求) ★→ Step 5 (说明书)
Step 2 (知识库) ────┘                          │                    │
                                               ↓                    ↓
                                          Step 6 (权要检查)     Step 7 (说明书检查)
                                               │                    │
                                               └──────┬─────────────┘
                                                      ↓
                                                Step 8 (生成DOCX)
```

#### Call 3: HITL 生成（关键节点人机协同）

在 Step 4（权利要求生成）后，系统**暂停执行**，向用户发送确认请求：

```
→ 系统: "请审阅生成的权利要求，确认保护范围和技术特征是否准确"
  选项: [批准继续 / 修改意见 / 拒绝重做]
← 用户: "批准，继续生成说明书"
```

HITL 检查点通过 `RustCheckpointBridge` 持久化到 SQLite（`~/.deepseek/state.db`），确保断电可恢复。

#### Call 4: 结果聚合（ResultAggregator）

所有步骤完成后，汇总各 Agent 输出，生成统一的 Markdown 文档：
- 权利要求书（独立 + 从属）
- 说明书（技术领域 → 背景技术 → 发明内容 → 具体实施方式）
- 摘要
- 质量检查报告
- 形式检查报告

#### Call 5: 异常降级（ExceptionHandler）

如果任何步骤失败：
- 重试机制（每个步骤有 maxRetries 配置）
- 降级策略（LLM 调用失败 → 使用规则模式）
- 错误恢复（从检查点恢复执行）

### 3.5 Step 4: Agent 执行细节

每个 Agent 遵循 **Plan-Act-Reflect** 三阶段生命周期：

```
Agent.execute(input)
  → before(input, context)     // 可选前置
  → init(context)              // 一次性初始化
  → [循环]
      → plan(input, context)   // 规划（必需）
      → [HITL 审批?]
      → act(plan, context)     // 执行（必需）
      → reflect(result, ctx)   // 反思（可选，决定是否继续）
      → checkpoint()           // 保存检查点
  → after(input, output, ctx)  // 可选后置
```

Agent 通过 `ExecutionContext.memory` 访问记忆系统，通过 `ExecutionContext.eventBus` 与其他 Agent 通信。

### 3.6 Step 5: 响应返回 Rust TUI

```
MCP Server → JSON-RPC response → Rust MCP Pool → Engine → TUI 渲染
```

TUI 将结果显示在对话历史中（HistoryCell），支持：
- Markdown 渲染（表格、加粗、代码块）
- Thinking blocks 展示（DeepSeek V4 推理过程）
- 工具调用状态卡片
- 子 Agent 活动追踪

---

## 四、两种运行模式

当前项目实际存在**两套并行可用的交互模式**：

### 模式 1：Rust TUI 直接对话（默认）

- 用户在 TUI 中直接与 DeepSeek V4 对话
- LLM 自主决定是否调用 MCP 专利工具
- 适合通用对话和代码级工作
- 支持三种模式：Plan / Agent / YOLO

### 模式 2：MCP Server → Orchestrator 编排（专业场景）

- 通过 Claude Desktop 或 TUI 的 MCP 工具调用
- 触发完整的 5 次 LLM 调用 + 24 Agent 编排流程
- 适合复杂的专利撰写/答复/检索工作流
- 支持 HITL 人机协同检查点

---

## 五、关键设计决策

| 决策 | 理由 |
|------|------|
| CLI 几乎全委托给 TUI | 避免逻辑重复，TUI 是完整运行时 |
| Rust ↔ TS 通过 MCP stdio | 进程隔离，语言无关协议，安全边界 |
| Orchestrator 5 次 LLM 调用 | 分层编排：意图→规划→审批→聚合→降级 |
| 检索和理解并行执行 | Step 1+2 无依赖，并行节省时间 |
| 权利要求生成后 HITL | 这是最关键的决策点，保护范围不可自动确定 |
| 数据主权 CON-01 | 技术交底书禁止外传，合规底线 |
| 检查点持久化到 SQLite | 跨语言共享，断电可恢复 |
| Agent 清单声明式注册 | `agentManifest.ts` 一行添加新 Agent |

---

## 六、关键文件索引

### Rust 交互层

| 文件 | 职责 |
|------|------|
| `crates/cli/src/lib.rs` | CLI 入口分发器 |
| `crates/tui/src/core/engine.rs` | 核心引擎（Turn Loop） |
| `crates/tui/src/core/engine/turn_loop.rs` | Turn Loop 实现 |
| `crates/tui/src/core/engine/tool_execution.rs` | 工具执行 |
| `crates/tui/src/memory.rs` | 用户记忆管理 |
| `crates/tui/src/tools/remember.rs` | remember 工具 |
| `crates/tui/src/core/capacity_memory.rs` | 容量记忆 |
| `crates/yunpat-router/src/router.rs` | 意图路由器 |
| `crates/yunpat-mcp-bridge/src/lib.rs` | MCP 桥接 |
| `crates/state/src/lib.rs` | SQLite 持久化 |
| `crates/app-server/` | HTTP/SSE 服务 |

### TypeScript 业务层

| 文件 | 职责 |
|------|------|
| `packages/mcp-server/src/index.ts` | MCP Server 入口（10 个工具） |
| `packages/orchestrator/src/OrchestratorAgent.ts` | 中枢调度（5 次 LLM 调用） |
| `packages/orchestrator/src/intent/PatentIntentConfig.ts` | 专利意图配置 + 默认任务计划 |
| `packages/orchestrator/src/registry/agentManifest.ts` | 24 个 Agent 声明式清单 |
| `packages/core/src/memory/MemoryStore.ts` | 短期记忆 |
| `packages/core/src/memory/long-term/MemoryLayer.ts` | 长期记忆统一接口 |
| `packages/core/src/memory/CheckpointManager.ts` | 检查点 + 时间旅行 |
| `packages/core/src/memory/RustCheckpointBridge.ts` | 跨语言检查点桥接 |
| `packages/core/src/lifecycle/Lifecycle.ts` | MemoryStore 接口定义 |
| `packages/agents/base/src/ProfessionalAgent.ts` | 专业 Agent 基类 |
