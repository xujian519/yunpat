# YunPat Agent 代码质量 Review — 第二阶段报告

**生成时间**: 2026-05-16  
**范围**: 架构审查 + 关键模块走查 + 重复代码分析

---

## 1. 架构总览

### 1.1 双栈架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户交互层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ yunpat-tui   │  │ yunpat-cli   │  │ yunpat-app-server    │  │
│  │  (TUI 174K)  │  │  (CLI 4K)    │  │  (HTTP/SSE 812)      │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
│         │                                                        │
│         ▼  MCP over stdio                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              @yunpat/mcp-server  (MCP 协议层)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                       │
│         ┌───────────────┼───────────────┐                       │
│         ▼               ▼               ▼                       │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐     │
│  │ Rust Engine │ │ TS Framework│ │  Patent Domain Agents│     │
│  │  (core,     │ │  (@yunpat/  │ │  (30 specialized)    │     │
│  │   tools)    │ │   core 55K) │ │                      │     │
│  └─────────────┘ └─────────────┘ └──────────────────────┘     │
│                         │                                       │
│         ┌───────────────┼───────────────┐                       │
│         ▼               ▼               ▼                       │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐     │
│  │ yunpat-state│ │patent-db    │ │  knowledge-base      │     │
│  │ (SQLite)    │ │ (Drizzle/  │ │  (向量+图)           │     │
│  │             │ │  Postgres)  │ │                      │     │
│  └─────────────┘ └─────────────┘ └──────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心质量判断

| 维度 | 评估 | 说明 |
|------|------|------|
| **边界清晰度** | 🟡 中等 | Rust↔TS 通过 MCP 桥接，边界清晰；但 TS 内部模块间存在轻度耦合 |
| **职责分离** | 🔴 差 | TUI crate 82% 代码，严重违反单一职责 |
| **可测试性** | 🟡 中等 | Engine 可独立测试；TUI 渲染与业务逻辑交织导致测试困难 |
| **可扩展性** | 🟢 良好 | Agent trait 设计良好，新增 agent 成本低 |
| **依赖健康** | 🟡 中等 | Rust 无循环依赖；TS 有一个 tools↔reasoning 软循环 |

---

## 2. Rust 侧架构审查

### 2.1 Crate 依赖图

```
                    ┌─────────────┐
                    │  yunpat-cli │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ yunpat-tui   │  │yunpat-app-   │  │ yunpat-mcp-bridge│
│  (174K LOC)  │  │  server      │  │                  │
└──────┬───────┘  └──────────────┘  └──────────────────┘
       │
       │ 内部依赖:
       ├── core/ (engine, events, ops) ──→ 2,183 LOC
       ├── tools/ (shell, registry, mcp) ──→ 48 files, 5,516 LOC
       ├── tui/ (rendering, widgets) ──→ 57 files, ~30K LOC
       ├── runtime_threads.rs ──→ 4,838 LOC
       └── config/ ──→ 4,460 LOC (in src/config/mod.rs)
       
       外部 crate 依赖:
       ├── yunpat-agents ──→ 10,258 LOC
       ├── yunpat-models ──→ 1,416 LOC
       ├── yunpat-router ──→ 1,207 LOC
       ├── yunpat-tools ──→ 537 LOC
       └── ... (protocol, state, secrets, hooks, execpolicy)
```

### 2.2 TUI Crate: 单体怪物 🔴

**问题诊断**:

| 指标 | 数值 | 行业标准 |
|------|------|---------|
| 总行数 | 174,374 | < 20K per crate |
| 文件数 | 200+ | < 50 per crate |
| 最大文件 | ui.rs 8,356 行 | < 500 lines |
| 最长函数 | widgets/mod.rs render() 431 行 | < 50 lines |
| crate 占比 | 82.4% | < 30% |

**职责混杂**: `yunpat-tui` 同时承担：
1. **TUI 渲染** — `ui.rs`, `app.rs`, `widgets/`, `views/` (~30K LOC)
2. **引擎编排** — `core/engine.rs`, `runtime_api.rs`, `client.rs` (~8K LOC)
3. **运行时管理** — `runtime_threads.rs`, `session_manager.rs` (~10K LOC)
4. **工具调度** — `tools/` (~5.5K LOC)
5. **配置管理** — `config/mod.rs` (~4.5K LOC)
6. **MCP 协议** — `mcp.rs` (~2.1K LOC)
7. **命令解析** — `commands/` (~4K LOC)

**拆分方案** (按难度排序):

| 目标 Crate | 内容 | 难度 | 预估工作量 |
|-----------|------|------|-----------|
| `yunpat-engine` | `core/`, `runtime_threads.rs`, `runtime_api.rs` | 🟢 低 | 2-3 天 |
| `yunpat-tools` | `tools/` | 🟡 中 | 3-5 天 |
| `yunpat-config` | `config/mod.rs` | 🟢 低 | 1 天 |
| `yunpat-tui` (瘦身) | `tui/`, `commands/` | 🔴 高 | 1-2 周 |

> 实际上 `yunpat-config` 已经存在为独立 crate（2,183 LOC），但 `tui/src/config/mod.rs`（4,460 LOC）似乎是另一个配置系统。需要合并或统一。

### 2.3 Engine: 架构良好 🟢

**优点**:
- `EngineHandle` 使用 channel 架构（`tx_op` / `rx_event`）实现 UI↔Engine 解耦
- `core/engine.rs` 零渲染代码导入，纯异步业务逻辑
- `runtime_threads.rs` 证明 engine 可独立于 TUI 运行（HTTP API）

** minor 问题**:
- `engine.rs` 导入 `crate::tui::app::AppMode` 和 `crate::tui::approval::ApprovalMode`
  - 这两个是配置枚举，应移至 `core/` 或共享 `models/` crate

### 2.4 MCP 协议层: 干净 🟢

- 原生 JSON-RPC 2.0 实现，不依赖 TypeScript
- `StdioTransport` + `SseTransport` 双模式
- `tools/mcp_tool_adapter.rs` 将 MCP 工具无缝接入内部 ToolRegistry
- 任何符合 MCP 规范的服务器（Node.js/Python/Go）均可接入

### 2.5 Agent Crate: 可改进 🟡

**7 个 Agent 的 execute() 分析**:

| Agent | execute() 行数 | 阶段数 | 问题 |
|-------|---------------|--------|------|
| creativity | 371 | 7 | 过长，重复 StageOutput 构造 |
| drafting | 270 | 5 | 过长 |
| oa_response | 246 | 5 | 过长 |
| invalidation | 239 | 5 | 过长 |
| reexamination | 216 | 5 | 过长 |
| research | 207 | 4-5 | 过长 |
| trademark | 173 | 5 | 相对合理 |

**共同模式** (每 agent 重复):
```rust
// 1. LLM 调用分支 (if let Some(provider) = llm_provider { ... } else { template })
// 2. StageOutput 构造 (10-15 行)
// 3. Approval gate 构造 (5-8 行)
// 4. 质量报告 Markdown 表格 (copy-pasted)
```

**重构建议**: 引入 `StageBuilder` 或 `yield_stage!` 宏
- 预估效果: 每个 agent 从 800-1300 行 → 300-500 行
- 工作量: 2-3 天

---

## 3. TypeScript 侧架构审查

### 3.1 @yunpat/core: 单体的另一面 🔴

**模块规模** (55K LOC):

| 模块 | LOC | 占比 | 依赖 |
|------|-----|------|------|
| llm | 6,563 | 12% | lifecycle |
| memory | 6,140 | 11% | lifecycle |
| gateway | 5,884 | 11% | lifecycle, agent, planning |
| tools | 4,780 | 9% | lifecycle |
| validation | 4,715 | 9% | lifecycle, knowledge |
| reasoning | 4,308 | 8% | lifecycle |
| planning | 3,071 | 6% | lifecycle |
| knowledge | 2,463 | 4% | lifecycle, llm |
| replanning | 2,394 | 4% | lifecycle, planning |
| constitutional | 2,170 | 4% | lifecycle |
| coordinator | 1,973 | 4% | lifecycle |
| compact | 1,161 | 2% | lifecycle |
| agent | 1,152 | 2% | lifecycle |
| prompt | 1,127 | 2% | lifecycle |
| learning | 1,113 | 2% | lifecycle |
| 其他 | ~5,000 | 9% | — |

**设计模式**: Hub-and-Spoke
- `lifecycle/` 是共享内核 (322 LOC)，被 15 个模块导入
- `lifecycle/` 自身不导入任何业务模块 ✅

**一个问题循环依赖**:
```
tools/ToolSelectionOptimizer.ts → reasoning/FewShotPromptManager.ts
reasoning/FewShotPromptManager.ts → tools/EnhancedTool.ts + tools/similarityCalculator.ts
```

**修复**: 将 `SimilarityCalculator` 移至 `utils/` 或 `lifecycle/`

### 3.2 拆分建议

| 提取包 | 模块 | LOC | 拆分难度 |
|--------|------|-----|---------|
| `@yunpat/validation` | `validation/` | ~4,715 | 🟢 低 — 仅依赖 lifecycle |
| `@yunpat/constitutional` | `constitutional/` | ~2,170 | 🟢 低 — 仅依赖 lifecycle |
| `@yunpat/learning` | `learning/` | ~1,113 | 🟢 低 — 仅依赖 lifecycle |
| `@yunpat/gateway` | `gateway/` + `eventbus/` | ~6,363 | 🟡 中 — agent/planning 导入它 |
| `@yunpat/knowledge` | `knowledge/` | ~2,463 | 🟡 中 — 依赖 lifecycle + llm |

**保持核心**: lifecycle, llm, memory, tools, agent, coordinator, planning, reasoning

**阻碍**:
1. `src/index.ts` 是 719 行的 barrel 文件，所有消费者通过单一入口导入
2. 需要先改为 subpath exports 或显式包导入

### 3.3 Agent Packages (30 个)

| 类别 | 数量 | 代表 |
|------|------|------|
| 撰写类 | 6 | writer, claim-generator, specification-drafter, abstract-drafter |
| 检索类 | 3 | search, prior-art-search, researcher |
| 分析类 | 4 | analysis, patent-analyzer, tech-unit, image-understanding |
| 质量类 | 3 | quality-checker, unity-checker, format-converter |
| 法律类 | 3 | legal-qa, subject-matter-checker, spec-formality-checker |
| 管理类 | 5 | invention, patent-manager, comparison-report-generator, technical-drawing |
| 应答类 | 1 | patent-responder (~8.6K LOC, 最大 agent) |
| 其他 | 5 | — |

**观察**: agent 数量多但模式统一，说明框架设计良好。`patent-responder` 异常庞大，需要走查。

---

## 4. 关键模块深度走查

### 4.1 `crates/tui/src/tui/ui.rs` (8,356 行) — 🔴

**结构**:
- `run_tui()` — 主循环 (~200 行)
- `run_event_loop()` — 事件处理 (~500 行)
- `handle_engine_event()` — 引擎事件分发 (~400 行)
- `dispatch_user_message()` — 消息发送前的 orchestration (~300 行)
- 渲染函数: `render_sidebar()`, `render_main()`, `render_status_bar()` (~200 行 each)

**问题**:
1. `dispatch_user_message()` 组装系统提示、解析文件引用、决定自动压缩 — 这是 **orchestration 逻辑** 不应在 UI 层
2. 70+ 处 `engine_handle.send(Op::…)` 调用，使 `ui.rs` 成为事实上的命令路由器
3. 导入 40+ 个内部模块，耦合度极高

**拆分策略**:
```
ui.rs →
  ├── ui/render.rs      (渲染逻辑)
  ├── ui/event_loop.rs  (事件循环)
  ├── ui/dispatch.rs    (命令分发 → 移至 engine 层)
  └── ui/input.rs       (用户输入处理)
```

### 4.2 `packages/core/src/llm/` (6,563 行) — 🟡

**多提供商适配器架构**:
- DeepSeek, Qwen, Ollama, OpenAI, KimiCode, OMLX
- `TaskRouter` — 成本感知路由
- `BatchProcessor` — 批处理

**问题**: 每个提供商 500-1000 行适配代码，但核心逻辑（HTTP 请求、重试、流处理）高度重复。

**建议**: 提取 `HttpLlmProvider` trait + 通用 HTTP 客户端，每个提供商只需实现 `build_request()` 和 `parse_response()`。

### 4.3 `packages/agents/patent-responder/` (~8.6K LOC) — 🟡

这是最大的 agent，处理 OA（审查意见）答复。需要单独审查：
- `PatentResponderAgent.v4.ts` (995 行)
- `CaseLearner.ts` (843 行)
- 多个版本文件 (v1, v2, v3, v4)

**问题**: 多版本文件共存 (`v1.ts`, `v2.ts`, `v3.ts`, `v4.ts`)，但只有一个被使用。需要清理历史版本。

---

## 5. 重复代码分析

### 5.1 Rust 侧

**重复函数签名** (69 处):

| 函数签名 | 重复次数 | 分布 |
|----------|---------|------|
| `fn pass_mark(score: f32) -> &'static str` | 6 | yunpat-agents/* |
| `fn wrap_text(text: &str, width: usize) -> Vec<String>` | 5 | tui/* |
| `fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<()>` | 4 | tui/*, config/* |
| `fn generate_strategy_content(topic: &str) -> String` | 4 | yunpat-agents/* |
| `fn generate_quality_report() -> QualityReport` | 4 | yunpat-agents/* |

**重复模式** (代码片段):

```rust
// 每个 agent 的 execute() 中重复 ~15 行:
StageOutput {
    stage_id: "...",
    stage_name: "...".to_string(),
    stage_type: StageType::Analysis,
    content: format!("...", ...),
    artifacts: vec![...],
    requires_approval: false,
    approval_request: None,
    metadata: json!({...}),
}
```

### 5.2 TypeScript 侧

**跨 agent 重复**:
- LLM 调用 + 错误处理模式 (每个 agent 都有)
- 专利号验证正则 (`CN\d{9,13}[A-Z]?`)
- 技术领域分类映射
- 文件解析 (PDF/DOCX 转文本)

**核心内部重复**:
- `gateway/auth/` 和 `builtin-tools/auth/` 可能有重叠
- `patent-database/` 和 `core/src/db/` 有重复 schema 定义

---

## 6. 风险热力图

| 模块 | 编译风险 |  panic 风险 | 安全风险 | 维护性 | 总体 |
|------|---------|------------|---------|--------|------|
| tui/ui.rs | 🔴 高 | 🔴 高 | 🟡 中 | 🔴 差 | 🔴 |
| tui/runtime_threads.rs | 🟢 低 | 🟡 中 | 🟢 低 | 🔴 差 | 🟡 |
| tui/session_manager.rs | 🟢 低 | 🔴 高 | 🟡 中 | 🔴 差 | 🔴 |
| core/engine.rs | 🟢 低 | 🟡 中 | 🟢 低 | 🟢 好 | 🟡 |
| yunpat-agents/* | 🟢 低 | 🟡 中 | 🟢 低 | 🟡 中 | 🟡 |
| packages/core/llm | 🟢 低 | 🟢 低 | 🟡 中 | 🟡 中 | 🟡 |
| packages/core/gateway | 🟢 低 | 🟢 低 | 🔴 高 | 🟡 中 | 🟡 |
| orchestrator/ | 🟢 低 | 🟢 低 | 🟢 低 | 🟡 中 | 🟢 |
| patent-responder/ | 🟢 低 | 🟢 低 | 🟢 低 | 🔴 差 | 🟡 |

---

## 7. 第二阶段总结与第三阶段预告

### 已发现的关键问题

1. **TUI crate 必须拆分** — 174K 行单体，82% 代码占比
2. **@yunpat/core 可拆分** — 55K 行，验证/宪法/学习模块可独立
3. **agent execute() 过长** — 7 个 agent 都 200-370 行，引入 StageBuilder 可减 60%
4. **patent-responder 多版本文件** — v1/v2/v3/v4 共存，需清理
5. **一个 TS 循环依赖** — tools↔reasoning

### 第三阶段将聚焦

1. **unwrap/expect 分级处理** — 量化每个 panic 路径的风险
2. **安全性深度审查** — SQL 注入、命令注入、CON-01 合规、Secrets 管理
3. **unsafe 代码审查** — session_manager.rs 和 secrets/src/lib.rs

---

*第二阶段完成。等待第三阶段指令。*
