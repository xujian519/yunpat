# Phase 2：深度融合 — 统一实施方案

> 统合来源：代码库深度扫描 + `阶段2规划草案` + `constitutional_layer_architecture.svg` + `深度分析报告.md`
> 日期：2026-05-09

---

## Context

Phase 1（接口对齐）已完成：MCP 7 工具、3 个 slash 命令、Rust TUI 统一、项目级配置、意图路由、宪法骨架（CON-01/02/03）全部就位。当前存在三个核心限制：

1. **Hook 单向通信** — `crates/crates/hooks/src/lib.rs:54` 的 `HookSink::emit()` 只发射事件返回 `Result<()>`，Engine 无法消费 hook 输出（意图识别结果、恢复策略）
2. **工具扁平调用** — MCP 工具走独立调度路径，未注册到类型化 `ToolRegistry`（`crates/crates/tools/src/lib.rs`），无法享受 schema 验证、并行调度、审批门控
3. **记忆系统割裂** — Rust `CheckpointRecord`（`crates/crates/state/src/lib.rs:77`）与 TS `CheckpointManager` 格式独立，无法跨语言恢复

Phase 2 目标：让 YunPat 的 OrchestratorAgent 真正跑在 DeepSeek-TUI 执行引擎里，实现 **意图识别 → 任务规划 → 子 Agent 委托 → 异常恢复 → 宪法约束** 的完整闭环。

---

## 核心矛盾与融合策略

**DeepSeek-TUI Engine**：扁平 ReAct 循环（LLM → tool → LLM → tool），擅长会话管理、工具审批、上下文压缩。

**YunPat OrchestratorAgent**：分层规划-执行架构（意图识别 → 任务分解 → 子 Agent 路由 → 执行 → 异常处理），擅长专利领域知识。

**融合策略：不是替换，而是分层叠加。** 把 OrchestratorAgent 的能力作为"规划前置层"叠加在 Engine 循环之上，通过三个接合点实现：

```
用户输入
    ↓
[接合点 A] pre-turn Hook → YunPat IntentRecognizer（意图识别）
    ↓
[接合点 B] message_submit Hook → YunPat TaskPlanner（任务规划注入）
    ↓
DeepSeek Engine 主循环（原样保留）
    ↓
[宪法层]   ConstitutionalEngine → 五条专利原则裁决（YOLO 无法绕过）
    ↓
[接合点 C] agent_spawn → YunPat 专利子 Agent（执行委托）
    ↓
结果回写 transcript
```

---

## 依赖关系图

```
2A (Hook 双向化 + 编排器融合) ─── 关键路径
 ├── 2A.1 Hook 双向协议 [阻塞后续所有步骤]
 ├── 2A.2 IntentRecognizer 接入
 ├── 2A.3 TaskPlanner 注入
 ├── 2A.4 agent_spawn 委托
 └── 2A.5 异常处理增强
         │
2E (宪法层) ← 依赖 2A.1，可与 2A.2-2A.5 并行
 ├── 2E.1 ConstitutionalEngine + 五条原则
 ├── 2E.2 execpolicy 三层纵深防御
 └── 2E.3 TUI 宪法违规视觉反馈
         │
2B (工具层统一) ← 依赖 2A.1
 ├── 2B.1 MCP→ToolRegistry 适配器
 ├── 2B.2 专利工具类型化 Schema
 └── 2B.3 统一工具路由
         │
2C (记忆层对齐) ← 依赖 2B.1
 ├── 2C.1 统一检查点 Schema v2
 ├── 2C.2 HITL 检查点跨语言持久化
 └── 2C.3 专利上下文会话恢复
         │
2D (RLM 并行加速) ← 独立，可与所有阶段并行
 ├── 2D.1 多数据库并行检索
 └── 2D.2 批量专利分析
```

---

## 子阶段 2A：编排器融合（第 1-8 周）

### 2A.1 Hook 双向通信协议（2 周）— 关键路径入口

**问题**：`HookSink::emit()` 是单向观察者，`intent-hook.ts` 输出的 JSONL 指令无人消费。

**方案**：新增 `BidirectionalHook` trait，保持 `HookSink` 向后兼容。

**新建** `crates/crates/hooks/src/hook_pipeline.rs`：

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum HookInstruction {
    SetMode { mode: String, reason: String },
    PrependContext { content: String },
    InjectMessage { role: String, content: String },
    LoadSkill { skill: String },
    SuggestTool { tool: String, reason: String },
    RequireApproval { message: String, options: Vec<String> },
    Warn { message: String },
    Allow,
}

#[async_trait]
pub trait BidirectionalHook: Send + Sync {
    fn events(&self) -> Vec<String>;
    async fn process(&self, event: &HookEvent) -> Result<Vec<HookInstruction>>;
}
```

**新建** `crates/crates/hooks/src/stdio_hook.rs`：

```rust
// 启动子进程，写事件 JSON 到 stdin，从 stdout 逐行读 JSONL HookInstruction
pub struct StdioBidirectionalHook {
    command: String,
    args: Vec<String>,
    timeout_ms: u64,
}
// process() 实现：spawn 子进程 → 写 event JSON → 读 stdout → 解析 JSONL → 返回 Vec<HookInstruction>
```

**修改**：
- `crates/crates/hooks/src/lib.rs` — 添加 `mod hook_pipeline; mod stdio_hook;` + re-exports
- `crates/crates/core/src/lib.rs` — Runtime 添加 `HookPipeline` 字段
- `crates/crates/tui/src/core/`（engine 或 turn_loop 模块）— turn 开始前调 `HookPipeline::process("message_submit", event)`，按序应用 `HookInstruction`

**验证**：
```bash
cargo test -p deepseek-hooks -- hook_instruction_serde_round_trip
echo '{"event":"message_submit","message":"检索电池专利","mode":"general"}' | \
  npx tsx packages/packages/orchestrator-adapter/src/intent-hook.ts
cargo build -p deepseek-tui
```

---

### 2A.2 IntentRecognizer 升级接入（1 周）

**现状**：`intent-hook.ts` 已有关键词匹配。`packages/packages/orchestrator/src/intent/IntentRecognizer.ts` 有 LLM 增强识别器但未被 hook 使用。

**方案**：关键词快速路径 + LLM 降级路径，输出 `HookInstruction` 格式 JSONL。

**修改** `packages/packages/orchestrator-adapter/src/intent-hook.ts`：

```typescript
import { IntentRecognizer } from '@yunpat/orchestrator/intent'

const raw = await readStdin()
const ctx = JSON.parse(raw) as HookContext

// 快速路径：关键词匹配（<100ms）
const keywordResult = keywordMatch(ctx.message)
if (keywordResult.confidence >= 0.7) {
  outputInstructions(keywordResult)
  process.exit(0)
}

// 慢速路径：LLM 识别器（2-5s，有 API Key 时）
if (process.env.DEEPSEEK_API_KEY) {
  const recognizer = new IntentRecognizer()
  const intent = await recognizer.recognize(ctx.message)
  outputInstructions(intent)
} else {
  // 无 API Key：使用关键词低置信度结果
  outputInstructions(keywordResult)
}
```

**验证**：
```bash
DEEPSEEK_API_KEY=xxx npx tsx packages/packages/orchestrator-adapter/src/intent-hook.ts \
  <<< '{"event":"message_submit","message":"帮我撰写电池专利","mode":"general"}'
# 期望: {"action":"set_mode","mode":"plan",...} + {"action":"load_skill","skill":"patent-writer"}
```

---

### 2A.3 TaskPlanner 动态注入（1 周）

**方案**：intent-hook 识别专利任务后，调用 TaskPlanner 生成 `.deepseek/current-plan.md`，注入 Engine system prompt。

**新建** `packages/packages/orchestrator-adapter/src/plan-injector.ts`：

```typescript
import { TaskPlanner } from '@yunpat/orchestrator/planning'
import { IntentRecognizer } from '@yunpat/orchestrator/intent'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function injectPlanForSession(
  userRequest: string, workspaceDir: string,
): Promise<void> {
  const intent = await new IntentRecognizer().recognize(userRequest)
  if (intent.type !== 'patent_task') return

  const plan = await new TaskPlanner().plan(intent)
  const planMd = renderPlanAsMarkdown(plan)

  const planPath = path.join(workspaceDir, '.deepseek', 'current-plan.md')
  await fs.writeFile(planPath, planMd, 'utf-8')
}
```

**修改**：
- `.deepseek/config.toml` — instructions 数组添加 `.deepseek/current-plan.md`
- `packages/packages/orchestrator-adapter/src/intent-hook.ts` — 复杂意图识别后调用 plan-injector

**验证**：
```bash
pnpm --filter @yunpat/orchestrator-adapter test -- plan-injector
cat .deepseek/current-plan.md  # 应有结构化任务步骤
```

---

### 2A.4 agent_spawn 专利子 Agent 委托（3 周）

**现状**：`crates/crates/tui/src/tools/subagent/` 支持 `agent_spawn`/`agent_wait`/`agent_result`/`agent_cancel` 完整生命周期。`crates/crates/tui/src/tools/patent_workflow.rs:16` 已有 `PatentWorkflowTool` 映射 11 个专利工具名。

**方案**：MCP server 新增 `patent_dispatch` 工具，**不直接执行**，而是返回 `agent_spawn` 指令让 Engine 处理实际执行。这样整个过程在 DeepSeek-TUI transcript 里完全可见，可被 `/restore` 回滚，受审批门控保护。

**新建** `packages/packages/mcp-server/src/tools/PatentDispatchTool.ts`：

```typescript
// 返回 agent_spawn 指令而不是直接执行
// Engine 收到后调用 agent_spawn 生成子 Agent
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'patent_dispatch') {
    const { task_type, title, field, disclosure } = request.params.arguments
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          action: 'agent_spawn',
          config: {
            name: `patent-${task_type}-${Date.now()}`,
            task: taskDescription,
            instructions: buildInstructions(task_type, title, field, disclosure),
            model: 'deepseek-v4-pro',
            mode: 'agent',
          }
        }),
      }],
    }
  }
})
```

**修改**：
- `packages/packages/mcp-server/src/index.ts` — 注册 `patent_dispatch` 工具
- `crates/crates/tui/src/tools/patent_workflow.rs` — 检测 MCP 响应中 `action: 'agent_spawn'`，转换为子 Agent 调用

**验证**：
```bash
cargo test -p deepseek-tui -- patent_dispatch_agent_spawn
# E2E: "撰写一件关于电池的专利" → 意图激活 → 计划注入 → patent_dispatch → agent_spawn → MCP 工具调用 → 结果回写
```

---

### 2A.5 异常处理增强（1 周）

**修改** `packages/packages/orchestrator-adapter/src/exception-hook.ts`：

引入 `ExceptionHandler`，输出三种恢复策略：

```typescript
switch (recovery.strategy) {
  case 'retry_with_context':
    console.log(JSON.stringify({
      action: 'inject_message',
      role: 'user',
      content: `执行失败（${ctx.error_msg}）。${recovery.additionalContext}请重试。`,
    }))
    break
  case 'fallback_tool':
    console.log(JSON.stringify({
      action: 'suggest_tool',
      tool: recovery.fallbackTool,
      reason: recovery.reason,
    }))
    break
  case 'escalate_human':
    console.log(JSON.stringify({
      action: 'require_approval',
      message: `需要人工判断：${recovery.escalationReason}`,
      options: recovery.humanChoices,
    }))
    break
}
```

2A.1 的双向 Hook 管道就绪后，exception-hook 的输出自动被 Engine 消费。

**验证**：
```bash
echo '{"event":"on_error","error_type":"timeout","tool_name":"patent_search"}' | \
  npx tsx packages/packages/orchestrator-adapter/src/exception-hook.ts
# 期望: {"action":"inject_message",...} 恢复指令
```

---

## 子阶段 2E：宪法层（第 3-8 周，与 2A.2-2A.5 并行）

> 来源：`阶段2规划草案` 宪法层设计 + `constitutional_layer_architecture.svg` 五层架构

### 2E.1 ConstitutionalEngine + 五条专利原则（3 周）

**设计哲学**：把"不可违反"从规则语义降至 Rust 类型系统。YOLO 模式能绕过的是"审批流程"，但改变不了 Rust 枚举的 `match` 分支和在 `handle_tool_call` 里位于 YOLO 短路**之前**的代码执行顺序。

**五层决策架构**（来源：SVG）：

```
Layer 0: 宪法层 (YOLO 无效, Rust 类型系统强制, 需修改源码)
Layer 1: Builtin 规则 (auto_deny, 最高优先级)
Layer 2: Agent 规则 (tool_call_before Hook, 参数级内容检查)
Layer 3: User 规则 (config.toml auto_allow)
→ YOLO 模式仅在 Layer 1-3 之后生效
→ Layer 0 不受任何模式影响
```

**新建** `crates/crates/execpolicy/src/constitutional.rs`：

```rust
/// 宪法裁决——YOLO 无法绕过
pub enum ConstitutionalVerdict {
    /// 放行，进入常规审批流程
    Pass,
    /// 强制路由到本地模型（数据主权保护）
    RouteToLocal { local_base_url: String, local_model: String, reason: String },
    /// 强制要求真人确认（blocking=true，即使 YOLO 也弹窗）
    RequireHuman { message: String, options: Vec<String>, audit_level: AuditLevel },
    /// 硬性拒绝，附审计日志
    HardDeny { reason: String, audit_level: AuditLevel },
}

pub trait ConstitutionalPrinciple {
    fn name(&self) -> &'static str;
    fn evaluate(&self, tool: &ToolCall) -> ConstitutionalVerdict;
}

pub struct ConstitutionalEngine {
    principles: Vec<Box<dyn ConstitutionalPrinciple + Send + Sync>>,
}

impl ConstitutionalEngine {
    pub fn adjudicate(&self, tool: &ToolCall) -> ConstitutionalVerdict {
        for principle in &self.principles {
            let verdict = principle.evaluate(tool);
            match &verdict {
                ConstitutionalVerdict::HardDeny { .. }    => return verdict,
                ConstitutionalVerdict::RequireHuman { .. } => return verdict,
                ConstitutionalVerdict::RouteToLocal { .. } => return verdict,
                ConstitutionalVerdict::Pass => continue,
            }
        }
        ConstitutionalVerdict::Pass
    }
}
```

**五条专利宪法原则**：

| # | 原则 | 实现文件 | 触发条件 | 裁决 |
|---|------|---------|---------|------|
| 1 | 数据主权 | `data_sovereignty.rs` | 敏感度 ≥ 阈值 | `RouteToLocal` |
| 2 | 不可逆操作 | `irreversible_action.rs` | patent_submit/delete | `RequireHuman` |
| 3 | 权利要求完整性 | `claim_integrity.rs` | 权利要求范围扩大 | `RequireHuman` |
| 4 | 禁止批量导出 | `bulk_export_deny.rs` | 检测导出命令模式 | `HardDeny` |
| 5 | 提交审计 | `submission_audit.rs` | patent_submit 操作 | `Pass` + 审计日志 |

**工具敏感度分级**：

| 工具 | 敏感度 | 不可逆 | 数据出境 | 默认策略 |
|------|--------|--------|---------|---------|
| `patent_search` | 低 | 否 | 是 | auto_allow |
| `patent_analyze` | 中 | 否 | 是 | suggest |
| `patent_draft_full` | 高 | 否 | 是 | suggest + 确认 |
| `patent_respond` | 高 | 否 | 是 | suggest |
| `patent_submit` | 极高 | **是** | 是 | **require** |
| `patent_manage` | 中 | 否 | 否 | auto_allow |

**修改** `crates/crates/tui/src/core/engine.rs`（或 turn_loop）— 工具调用**最前面**插入宪法检查：

```rust
async fn handle_tool_call(&mut self, tool_call: &ToolCall, mode: &AgentMode) -> Result<ToolResult> {
    // ─── 宪法层（Layer 0）─── 在 YOLO 短路之前 ───
    let verdict = self.constitutional_engine.adjudicate(tool_call);
    match verdict {
        ConstitutionalVerdict::HardDeny { reason, .. } => {
            self.audit_log.write(/* ... */).await?;
            return Ok(ToolResult::denied(reason));
        }
        ConstitutionalVerdict::RequireHuman { message, options, .. } => {
            // 无论是否 YOLO，强制弹窗
            let approved = self.tui_handle.request_approval(message, options).await?;
            if !approved { return Ok(ToolResult::cancelled("人工审核取消")); }
        }
        ConstitutionalVerdict::RouteToLocal { local_base_url, local_model, .. } => {
            return self.run_tool_with_local_client(tool_call, &local_base_url, &local_model).await;
        }
        ConstitutionalVerdict::Pass => { /* 进入常规流程 */ }
    }
    // ─── 常规 ExecPolicyEngine（Layer 1-3）+ YOLO ───
    self.exec_policy_engine.evaluate_and_execute(tool_call, mode).await
}
```

**验证**：
```bash
cargo test -p deepseek-execpolicy -- constitutional_verdict_round_trip
cargo test -p deepseek-execpolicy -- data_sovereignty_principle
cargo test -p deepseek-execpolicy -- irreversible_action_principle
cargo test -p deepseek-execpolicy -- claim_integrity_principle
cargo test -p deepseek-execpolicy -- bulk_export_deny_principle
```

---

### 2E.2 execpolicy 三层纵深防御（1 周）

在宪法层（Layer 0）之下，配置 execpolicy 的 Layer 1-3 为专利场景建立纵深防御。

**修改** `.deepseek/config.toml`：

```toml
# Layer 1: Builtin 规则
[execpolicy]
auto_allow = [
  "mcp_call:yunpat/patent_search",         # 只读检索，无需审批
  "mcp_call:yunpat/patent_manage/list",
  "mcp_call:yunpat/patent_manage/status",
  "read_file:*.md", "read_file:*.pdf",
  "exec_shell:git log", "exec_shell:git status",
]
auto_deny = [
  "exec_shell:curl", "exec_shell:wget",     # 禁止网络传输
  "exec_shell:git push",                     # 禁止推送专利文件
  "exec_shell:psql", "exec_shell:sqlite3",   # 禁止直连数据库
  "exec_shell:tar", "exec_shell:zip",        # 禁止批量打包
]

# Layer 2: Agent 规则（tool_call_before Hook）
# → 通过 2A.1 的双向 Hook 管道实现参数级检查

# Layer 3: User 规则
approval_policy = "suggest"
sandbox_mode = "read-only"
```

**新建** `packages/packages/execpolicy-hook/src/index.ts` — `tool_call_before` Hook 实现参数级内容检查（敏感词扫描、不当让步检测、patent_submit 强制二次确认）。

**验证**：
```bash
# auto_deny 生效
cargo test -p deepseek-tui -- execpolicy_patent_auto_deny
# Hook 参数级检查
npx tsx packages/packages/execpolicy-hook/src/index.ts \
  <<< '{"event":"tool_call_before","tool":"mcp_yunpat_patent_submit","arguments":{"application_number":"2024XXX"}}'
```

---

### 2E.3 TUI 宪法违规视觉反馈（1 周）

**新建** `crates/crates/tui/src/views/constitutional_denial.rs`：

深红色双线边框弹窗，标注"宪法约束"，不可被 Esc 关闭。与普通审批弹窗视觉明确区分。

**修改** `crates/crates/tui/src/tui/` 渲染模块 — 注册宪法违规专用渲染器。

**新建** `.deepseek/constitutional.toml`：

```toml
[data_sovereignty]
enabled = true
local_model = "qwen2.5:72b"
local_base_url = "http://localhost:11434/v1"
sensitivity_threshold = 0.7

[irreversible_actions]
enabled = true
always_require_human = ["mcp_yunpat_patent_submit", "mcp_yunpat_patent_manage_delete"]

[claim_integrity]
enabled = true
scope_expansion_threshold = 0.20

[audit]
enabled = true
log_path = "~/.deepseek/patent-audit.jsonl"
encrypted = true
```

**验证**：
```bash
cargo test -p deepseek-tui -- constitutional_denial_rendering
```

---

## 子阶段 2B：工具层统一（第 5-10 周）

### 2B.1 MCP→ToolRegistry 适配器（2 周）

**新建** `crates/crates/tui/src/tools/mcp_tool_adapter.rs`：

```rust
pub struct McpToolAdapter {
    server_name: String,
    tool_name: String,
    input_schema: Value,
    mcp_manager: Arc<McpManager>,
}
// 实现 ToolHandler trait，handle() 委托给 mcp_manager.call_tool()
// 启发式超时：search 30s, generate 60s, analyze 45s
```

**修改**：
- `crates/crates/tui/src/tools/mod.rs` — 添加模块
- Engine 启动流程 — MCP 连接后调 `register_mcp_tools()`

**验证**：
```bash
cargo test -p deepseek-tui -- mcp_tool_adapter_registration
```

---

### 2B.2 专利工具类型化 Schema（1 周）

**新建** `crates/crates/tui/src/tools/patent_specs.rs` — 为 7 个 MCP 工具定义强类型 Rust Spec（对应 MCP server 的 inputSchema）。

**验证**：
```bash
cargo test -p deepseek-tui -- patent_specs_json_schema_valid
```

---

### 2B.3 统一工具路由（1 周）

**修改**：
- `crates/crates/tui/src/tools/patent_workflow.rs` — `execute()` 优先走 MCP 适配器，降级到本地 Agent
- `crates/crates/tui/src/tools/spec.rs` — `ToolContext` 添加 `tool_registry` 引用

**验证**：
```bash
cargo test -p deepseek-tui -- patent_workflow_routing
```

---

## 子阶段 2C：记忆层对齐（第 9-13 周）

### 2C.1 统一检查点 Schema v2（1 周）

**新建** `crates/crates/state/src/checkpoint_schema.rs`：

```rust
pub const UNIFIED_CHECKPOINT_SCHEMA_VERSION: u32 = 2;

pub struct UnifiedCheckpoint {
    pub schema_version: u32,              // v2
    pub checkpoint_id: String,
    pub thread_id: String,
    pub source: CheckpointSource,         // RustEngine | TsOrchestrator | Hybrid
    pub created_at: i64,
    pub engine_state: Option<Value>,       // Rust Engine 对话历史、上下文
    pub orchestrator_state: Option<Value>, // TS 任务计划、HITL 待审状态、Agent 结果
    pub shared_metadata: Value,            // intent, confidence, metrics
}
```

**修改** `crates/crates/state/src/lib.rs` — 使用新 Schema，v1 向后兼容。
**修改** `packages/packages/core/src/memory/CheckpointManager.ts` — 添加 `exportToUnifiedFormat()` / `restoreFromUnifiedFormat()`。

**验证**：
```bash
cargo test -p deepseek-state -- unified_checkpoint_round_trip
cargo test -p deepseek-state -- checkpoint_migration_v1_to_v2
```

---

### 2C.2 HITL 检查点跨语言持久化（2 周）

**新建** `packages/packages/core/src/memory/RustCheckpointBridge.ts` — TS 侧写入 Rust SQLite 格式检查点。

**修改**：
- `packages/packages/orchestrator/src/OrchestratorAgent.ts` — HITL 门控时调 bridge 持久化
- `crates/crates/core/src/lib.rs` — `resume_thread_with_history()` 检测 HITL 检查点并注入上下文

**验证**：
```bash
pnpm --filter @yunpat/core test -- RustCheckpointBridge
cargo test -p deepseek-core -- resume_with_hitl_checkpoint
# E2E: 开始撰写 → HITL 审批门 → 关闭 TUI → 重启 → 看到 HITL 待审请求
```

---

### 2C.3 专利上下文会话恢复（1 周）

**修改**：
- `crates/crates/protocol/src/lib.rs` — `ThreadResumeParams` 添加 `patent_context` 字段
- `crates/crates/core/src/lib.rs` — 恢复时自动重载对应 Skill 和上下文

**验证**：
```bash
cargo test -p deepseek-core -- resume_with_patent_context
```

---

## 子阶段 2D：RLM 并行加速（第 3-5 周，独立并行）

### 2D.1 多数据库并行检索（1 周）

**新建** `crates/crates/tui/src/tools/patent_parallel_search.rs` — 使用 RLM 引擎并行检索 CN/US/EP，聚合去重。

**验证**：
```bash
cargo test -p deepseek-tui -- patent_parallel_search
# 性能基准: 串行 ~30s → 并行 ~10s
```

---

### 2D.2 批量专利分析（1 周）

**新建** `crates/crates/tui/src/tools/patent_batch_analysis.rs` — 多篇专利并行对比分析。

**验证**：
```bash
cargo test -p deepseek-tui -- patent_batch_analysis
```

---

## 时间线

```
Week 1-2:   2A.1(Hook双向协议) ─── 关键路径入口
Week 3-5:   2A.2(Intent) ┃ 2A.3(Plan) ┃ 2E.1(宪法引擎) ┃ 2D.1(并行检索) [并行]
Week 5-7:   2A.4(agent_spawn) ┃ 2E.2(三层防御) ┃ 2B.1(MCP适配器) ┃ 2D.2(批量分析)
Week 8:     2A.5(异常处理) ┃ 2E.3(TUI视觉) ┃ 2B.2(Schema)
Week 9-10:  2B.3(统一路由) ┃ 2C.1(检查点Schema)
Week 11-12: 2C.2(HITL持久化)
Week 13:    2C.3(会话恢复)
Week 14:    全局验证 + 文档更新
```

**关键路径**：2A.1 → 2A.2 → 2A.3 → 2A.4 → 2B.1 → 2C.1 → 2C.2 → 2C.3（~14 周）

**最大并行度**：Week 3-5 可同时推进 4 条独立工作线。

---

## 关键文件清单

| 文件 | 操作 | 所属步骤 |
|------|------|---------|
| **Rust 新建** | | |
| `crates/crates/hooks/src/hook_pipeline.rs` | **新建** | 2A.1 |
| `crates/crates/hooks/src/stdio_hook.rs` | **新建** | 2A.1 |
| `crates/crates/execpolicy/src/constitutional.rs` | **新建** | 2E.1 |
| `crates/crates/execpolicy/src/principles/data_sovereignty.rs` | **新建** | 2E.1 |
| `crates/crates/execpolicy/src/principles/irreversible_action.rs` | **新建** | 2E.1 |
| `crates/crates/execpolicy/src/principles/claim_integrity.rs` | **新建** | 2E.1 |
| `crates/crates/execpolicy/src/principles/bulk_export_deny.rs` | **新建** | 2E.1 |
| `crates/crates/execpolicy/src/principles/submission_audit.rs` | **新建** | 2E.1 |
| `crates/crates/tui/src/tools/mcp_tool_adapter.rs` | **新建** | 2B.1 |
| `crates/crates/tui/src/tools/patent_specs.rs` | **新建** | 2B.2 |
| `crates/crates/state/src/checkpoint_schema.rs` | **新建** | 2C.1 |
| `crates/crates/tui/src/tools/patent_parallel_search.rs` | **新建** | 2D.1 |
| `crates/crates/tui/src/tools/patent_batch_analysis.rs` | **新建** | 2D.2 |
| `crates/crates/tui/src/views/constitutional_denial.rs` | **新建** | 2E.3 |
| **TypeScript 新建** | | |
| `packages/packages/orchestrator-adapter/src/plan-injector.ts` | **新建** | 2A.3 |
| `packages/packages/mcp-server/src/tools/PatentDispatchTool.ts` | **新建** | 2A.4 |
| `packages/packages/execpolicy-hook/src/index.ts` | **新建** | 2E.2 |
| `packages/packages/core/src/memory/RustCheckpointBridge.ts` | **新建** | 2C.2 |
| **配置新建** | | |
| `.deepseek/constitutional.toml` | **新建** | 2E.3 |
| **Rust 修改** | | |
| `crates/crates/hooks/src/lib.rs` | 修改 | 2A.1 |
| `crates/crates/core/src/lib.rs` | 修改 | 2A.1 / 2E.1 / 2C.2 / 2C.3 |
| `crates/crates/tui/src/core/engine.rs` | 修改 | 2A.1 / 2E.1 |
| `crates/crates/execpolicy/src/lib.rs` | 修改 | 2E.1 |
| `crates/crates/tui/src/tools/patent_workflow.rs` | 修改 | 2A.4 / 2B.3 |
| `crates/crates/tui/src/tools/mod.rs` | 修改 | 2B.1 / 2D.1 / 2D.2 |
| `crates/crates/tui/src/tools/spec.rs` | 修改 | 2B.3 |
| `crates/crates/state/src/lib.rs` | 修改 | 2C.1 |
| `crates/crates/protocol/src/lib.rs` | 修改 | 2C.3 |
| **TypeScript 修改** | | |
| `packages/packages/orchestrator-adapter/src/intent-hook.ts` | 修改 | 2A.2 |
| `packages/packages/orchestrator-adapter/src/exception-hook.ts` | 修改 | 2A.5 |
| `packages/packages/mcp-server/src/index.ts` | 修改 | 2A.4 |
| `packages/packages/core/src/memory/CheckpointManager.ts` | 修改 | 2C.1 |
| `packages/packages/orchestrator/src/OrchestratorAgent.ts` | 修改 | 2C.2 |
| **配置修改** | | |
| `.deepseek/config.toml` | 修改 | 2A.3 / 2E.2 |

新建 19 个文件，修改 17 个文件。

---

## 风险评估

| 风险 | 严重度 | 概率 | 缓解 |
|------|--------|------|------|
| Hook 协议变更破坏现有 Hook | 高 | 中 | `BidirectionalHook` 是新增 trait，`HookSink` 保持不变，向后兼容 |
| 宪法层误杀合法操作 | 高 | 中 | `ConstitutionalVerdict::Pass` 走常规流程；`RequireHuman` 不阻断只弹确认 |
| TS Orchestrator LLM 调用与 Engine 并发 | 高 | 中 | Orchestrator 在 pre-turn Hook 完成，不与 Engine turn 并发 |
| MCP 启动延迟拖慢意图识别 | 中 | 高 | `lazy = true` + 5s 超时降级为关键词匹配 |
| 检查点 Schema 迁移破坏已有会话 | 高 | 低 | `schema_version` 字段 + v1→v2 迁移路径 |
| RLM 扇出超出 API 速率限制 | 中 | 中 | 可配置并发限制（默认 8），429 自动退避 |
| patent_workflow.rs 改动影响现有调用 | 中 | 中 | 先加 MCP 适配路径，保留本地 Agent 降级 |

---

## Phase 3 准备

本方案为 Phase 3（产品化平台）铺路：

- 2A.1 的 `BidirectionalHook` → Phase 3 的 `ConstitutionalVerdict` 可通过同一管道传输
- 2E 的 `ConstitutionalEngine` → Phase 3 可扩展企业级原则（多租户隔离、角色权限）
- 2C 的统一检查点 → Phase 3 可追加 `audit_events` 不可变日志
- 2B 的 MCP 适配器 → Phase 3 可接入更多外部工具服务

---

## 全局验证

```bash
make build && make test

# E2E 场景：
# 1. 意图识别：输入"撰写电池专利" → 自动切换 Plan 模式 + 加载 patent-writer Skill
# 2. 任务规划：验证 .deepseek/current-plan.md 生成
# 3. 宪法约束：YOLO 模式下提交专利 → 宪法层强制弹窗确认
# 4. 数据主权：高敏感技术交底 → 自动路由到本地模型
# 5. 子 Agent 委托：复杂任务触发 agent_spawn
# 6. 异常恢复：模拟工具超时 → 自动恢复策略注入
# 7. 会话恢复：开始撰写 → 关闭 TUI → 重启 → 恢复未完成任务
# 8. 并行检索：CN/US/EP 三数据库同时检索 → 结果合并
# 9. 全量测试：`make test` 通过（Rust 2285+ 测试 + TypeScript 全量）
```
