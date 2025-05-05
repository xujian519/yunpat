# Phase 2 任务清单与子智能体分工

> 配合 `Phase2-深度融合实施方案.md` 使用
> 3 个子智能体：`rust-core`（Rust 基础设施）、`ts-orchestrator`（TypeScript 编排层）、`rust-tui`（Rust TUI/工具层）

---

## 子智能体分工总览

| 智能体 | 职责 | 技术栈 | 关键任务 |
|--------|------|--------|---------|
| **rust-core** | Rust 核心基础设施 | Rust | 2A.1 Hook 双向协议, 2E.1 宪法引擎, 2B.1 MCP 适配器, 2C.1 检查点 Schema |
| **ts-orchestrator** | TypeScript 编排层 | TypeScript | 2A.2 意图识别, 2A.3 任务规划, 2A.4 Agent 委托, 2A.5 异常处理, 2E.2 Hook 防御, 2C.2 跨语言持久化 |
| **rust-tui** | Rust TUI/工具层 | Rust | 2E.3 宪法 UI, 2B.2 类型化 Schema, 2B.3 工具路由, 2C.3 会话恢复, 2D.1-2D.2 RLM 并行 |

---

## 执行甘特图（串行 + 并行）

```
Week 1-2:  [rust-core: 2A.1] ← 串行，阻塞后续
Week 3-4:  [rust-core: 2E.1] ┃ [ts-orchestrator: 2A.2+2A.3] ┃ [rust-tui: 2D.1]
Week 5-6:  [rust-core: 2B.1] ┃ [ts-orchestrator: 2A.4]       ┃ [rust-tui: 2D.2+2E.3]
Week 7:    [rust-core: 2C.1] ┃ [ts-orchestrator: 2A.5+2E.2]  ┃ [rust-tui: 2B.2]
Week 8:                          [ts-orchestrator: 2C.2]       ┃ [rust-tui: 2B.3]
Week 9:                          [ts-orchestrator: 2C.2 续]    ┃ [rust-tui: 2C.3]
Week 10:   全局验证（三个智能体共同参与）
```

---

## Phase 0：前置准备（串行，主智能体执行）

- [ ] 读取并理解 `docs/planning/Phase2-深度融合实施方案.md` 全文
- [ ] 创建工作分支 `feat/phase2-deep-fusion`
- [ ] 确认 `make build && make test` 基线通过
- [ ] 为每个子智能体创建 worktree 或确认工作目录隔离

---

## rust-core 智能体任务清单

### Sprint 1（Week 1-2）：2A.1 Hook 双向通信协议 — 关键路径入口

> 阻塞所有后续任务。完成后 ts-orchestrator 和 rust-tui 才能开始。

#### 任务列表

- [ ] **T-2A.1-R1** 新建 `crates/crates/hooks/src/hook_pipeline.rs`
  - [ ] 定义 `HookInstruction` 枚举（SetMode, PrependContext, InjectMessage, LoadSkill, SuggestTool, RequireApproval, Warn, Allow）
  - [ ] 实现 `Serialize/Deserialize` for `HookInstruction`
  - [ ] 定义 `BidirectionalHook` trait（`events()` + `process()`）
  - [ ] 实现 `HookPipeline` 结构体（管理多个 BidirectionalHook）
  - [ ] 单元测试：`hook_instruction_serde_round_trip`
  - 验证：`cargo test -p deepseek-hooks -- hook_instruction`

- [ ] **T-2A.1-R2** 新建 `crates/crates/hooks/src/stdio_hook.rs`
  - [ ] 实现 `StdioBidirectionalHook`（spawn 子进程，写 stdin，读 stdout JSONL）
  - [ ] 超时控制（默认 5s，可配置）
  - [ ] 错误处理：子进程崩溃、超时、JSONL 格式错误
  - [ ] 单元测试：mock 子进程验证 JSONL 解析
  - 验证：`cargo test -p deepseek-hooks -- stdio_hook`

- [ ] **T-2A.1-R3** 修改 `crates/crates/hooks/src/lib.rs`
  - [ ] 添加 `mod hook_pipeline; mod stdio_hook;`
  - [ ] Re-export `HookInstruction`, `BidirectionalHook`, `StdioBidirectionalHook`, `HookPipeline`
  - [ ] 确保原有 `HookSink` trait 和所有现有代码不受影响
  - 验证：`cargo test -p deepseek-hooks`（现有测试全过）

- [ ] **T-2A.1-R4** 修改 `crates/crates/core/src/lib.rs`
  - [ ] Runtime 结构体添加 `hook_pipeline: HookPipeline` 字段
  - [ ] 初始化逻辑：从 `config.toml` `[hooks]` 段创建 `StdioBidirectionalHook` 实例
  - 验证：`cargo build -p deepseek-core`

- [ ] **T-2A.1-R5** 修改 Engine turn loop（`crates/crates/tui/src/core/` 引擎模块）
  - [ ] 用户消息处理前调用 `hook_pipeline.process("message_submit", event)`
  - [ ] 按序应用返回的 `HookInstruction`：
    - `SetMode` → 切换 Agent 模式
    - `PrependContext` → 注入上下文到下一条消息
    - `InjectMessage` → 注入额外消息
    - `LoadSkill` → 加载指定 Skill
    - `SuggestTool` → 提示使用备选工具
    - `RequireApproval` → 触发审批弹窗
    - `Warn` → 显示警告
    - `Allow` → 继续正常流程
  - [ ] `on_error` 事件同样经过 `hook_pipeline.process()`
  - 验证：`cargo test -p deepseek-tui -- hook_pipeline_integration`

#### 检查清单

- [ ] `cargo test -p deepseek-hooks` 全部通过
- [ ] `cargo test -p deepseek-core` 全部通过
- [ ] `cargo build -p deepseek-tui` 成功
- [ ] 原有 `HookSink` 功能不受影响（向后兼容）
- [ ] `echo '{"event":"message_submit","message":"检索电池专利","mode":"general"}' | npx tsx packages/packages/orchestrator-adapter/src/intent-hook.ts` 输出合法 JSONL

---

### Sprint 2（Week 3-5）：2E.1 ConstitutionalEngine + 五条原则

> 依赖 2A.1 完成。可与 ts-orchestrator 的 2A.2-2A.3 并行。

#### 任务列表

- [ ] **T-2E.1-R1** 新建 `crates/crates/execpolicy/src/constitutional.rs`
  - [ ] 定义 `ConstitutionalVerdict` 枚举（Pass, RouteToLocal, RequireHuman, HardDeny）
  - [ ] 定义 `AuditLevel` 枚举（Info, Warning, Critical）
  - [ ] 定义 `ConstitutionalPrinciple` trait
  - [ ] 实现 `ConstitutionalEngine`（持有 `Vec<Box<dyn ConstitutionalPrinciple>>`）
  - [ ] `adjudicate()` 方法：逐条检查，返回最严格裁决
  - [ ] 单元测试：`constitutional_verdict_round_trip`
  - 验证：`cargo test -p deepseek-execpolicy -- constitutional_verdict`

- [ ] **T-2E.1-R2** 新建 `crates/crates/execpolicy/src/principles/` 目录
  - [ ] `data_sovereignty.rs` — 敏感度测量 + RouteToLocal 裁决
  - [ ] `irreversible_action.rs` — patent_submit/delete → RequireHuman
  - [ ] `claim_integrity.rs` — 权利要求范围扩大检测 → RequireHuman
  - [ ] `bulk_export_deny.rs` — 批量导出命令模式 → HardDeny
  - [ ] `submission_audit.rs` — patent_submit 审计标记
  - [ ] 每条原则独立单元测试
  - 验证：`cargo test -p deepseek-execpolicy -- principles`

- [ ] **T-2E.1-R3** 修改 `crates/crates/execpolicy/src/lib.rs`
  - [ ] 添加 `mod constitutional; mod principles;`
  - [ ] Re-export `ConstitutionalEngine`, `ConstitutionalVerdict`, `ConstitutionalPrinciple`
  - [ ] `PatentConstitutionConfig` 结构体（从 constitutional.toml 加载）
  - 验证：`cargo test -p deepseek-execpolicy`

- [ ] **T-2E.1-R4** 修改 `crates/crates/tui/src/core/engine.rs`
  - [ ] 在 `handle_tool_call()` 最前面插入宪法检查
  - [ ] `ConstitutionalVerdict::HardDeny` → 写审计日志 + 返回 denied
  - [ ] `ConstitutionalVerdict::RequireHuman` → 强制弹窗（无论是否 YOLO）
  - [ ] `ConstitutionalVerdict::RouteToLocal` → 临时替换 LLM 客户端
  - [ ] `ConstitutionalVerdict::Pass` → 继续常规 execpolicy 流程
  - 验证：`cargo test -p deepseek-tui -- constitutional_engine_integration`

#### 检查清单

- [ ] `cargo test -p deepseek-execpolicy` 全部通过
- [ ] 五条原则各有独立测试用例
- [ ] 宪法层在 YOLO 模式下仍然生效（集成测试）
- [ ] `ConstitutionalEngine::adjudicate()` 不影响 Pass 场景的性能（<1ms）

---

### Sprint 3（Week 5-6）：2B.1 MCP→ToolRegistry 适配器

> 依赖 2A.1。可与 ts-orchestrator 的 2A.4 并行。

#### 任务列表

- [ ] **T-2B.1-R1** 新建 `crates/crates/tui/src/tools/mcp_tool_adapter.rs`
  - [ ] `McpToolAdapter` 结构体（server_name, tool_name, input_schema, mcp_manager）
  - [ ] 实现 `ToolHandler` trait，`handle()` 委托给 `mcp_manager.call_tool()`
  - [ ] 启发式超时配置（search:30s, generate:60s, analyze:45s）
  - [ ] 错误转换：MCP 错误 → ToolError
  - 验证：`cargo test -p deepseek-tui -- mcp_tool_adapter`

- [ ] **T-2B.1-R2** 修改 Engine 启动流程
  - [ ] MCP 连接完成后，调 `MCPBridge::list_tools()` 获取工具列表
  - [ ] 每个工具创建 `McpToolAdapter` 并注册到 `ToolRegistry`
  - [ ] 添加 `register_mcp_tools()` 辅助函数
  - 验证：`cargo test -p deepseek-tui -- mcp_tool_adapter_registration`

#### 检查清单

- [ ] `cargo test -p deepseek-tui` 全部通过
- [ ] MCP 工具在 `ToolRegistry` 中可见
- [ ] MCP 服务器不可用时工具调用优雅降级

---

### Sprint 4（Week 7）：2C.1 统一检查点 Schema v2

#### 任务列表

- [ ] **T-2C.1-R1** 新建 `crates/crates/state/src/checkpoint_schema.rs`
  - [ ] `UnifiedCheckpoint` 结构体（schema_version, checkpoint_id, thread_id, source, created_at, engine_state, orchestrator_state, shared_metadata）
  - [ ] `CheckpointSource` 枚举（RustEngine, TsOrchestrator, Hybrid）
  - [ ] `Serialize/Deserialize` 实现
  - [ ] v1→v2 迁移函数
  - 验证：`cargo test -p deepseek-state -- unified_checkpoint_round_trip`

- [ ] **T-2C.1-R2** 修改 `crates/crates/state/src/lib.rs`
  - [ ] `save_checkpoint()` 使用新 Schema
  - [ ] `load_checkpoint()` 检测 `schema_version` 并兼容 v1
  - 验证：`cargo test -p deepseek-state -- checkpoint_migration_v1_to_v2`

#### 检查清单

- [ ] 现有会话的 v1 检查点可正常加载
- [ ] 新检查点使用 v2 Schema 保存
- [ ] `cargo test -p deepseek-state` 全部通过

---

## ts-orchestrator 智能体任务清单

### Sprint 1（Week 3-4，等待 2A.1 完成后启动）：2A.2 + 2A.3

> 依赖 rust-core 完成 T-2A.1-R1~R5。

#### 任务列表

- [ ] **T-2A.2-T1** 修改 `packages/packages/orchestrator-adapter/src/intent-hook.ts`
  - [ ] 引入 `IntentRecognizer` from `@yunpat/orchestrator/intent`
  - [ ] 实现关键词快速路径（confidence ≥ 0.7 直接输出）
  - [ ] 实现 LLM 慢速路径（有 API Key 时调用 IntentRecognizer）
  - [ ] 输出 `HookInstruction` 格式 JSONL（`{"action":"set_mode",...}`）
  - [ ] 添加测试用例：10 专利意图 + 5 模棱两可 + 5 非专利
  - 验证：`pnpm --filter @yunpat/orchestrator-adapter test -- intent-hook`

- [ ] **T-2A.3-T1** 新建 `packages/packages/orchestrator-adapter/src/plan-injector.ts`
  - [ ] `injectPlanForSession()` 函数
  - [ ] 调用 IntentRecognizer + TaskPlanner
  - [ ] `renderPlanAsMarkdown()` 渲染结构化步骤
  - [ ] 写入 `.deepseek/current-plan.md`
  - 验证：`pnpm --filter @yunpat/orchestrator-adapter test -- plan-injector`

- [ ] **T-2A.3-T2** 修改 `packages/packages/orchestrator-adapter/src/intent-hook.ts`
  - [ ] 复杂意图识别后调用 plan-injector
  - [ ] 输出 `PrependContext` 指令指向生成的计划文件
  - 验证：端到端测试，验证 `.deepseek/current-plan.md` 生成

- [ ] **T-2A.3-T3** 修改 `.deepseek/config.toml`
  - [ ] instructions 数组添加 `.deepseek/current-plan.md`
  - 验证：`deepseek` 启动无报错

#### 检查清单

- [ ] 意图识别准确率 ≥ 90%（20 个测试用例）
- [ ] 关键词路径延迟 < 100ms
- [ ] `cat .deepseek/current-plan.md` 显示结构化任务步骤
- [ ] `pnpm --filter @yunpat/orchestrator-adapter test` 全部通过

---

### Sprint 2（Week 5-6）：2A.4 agent_spawn 委托

> 依赖 2A.2+2A.3 完成。

#### 任务列表

- [ ] **T-2A.4-T1** 新建 `packages/packages/mcp-server/src/tools/PatentDispatchTool.ts`
  - [ ] `patent_dispatch` 工具定义（inputSchema）
  - [ ] 接受 `{ task_type, title, field, disclosure }` 参数
  - [ ] 返回 `agent_spawn` 指令 JSON（而非直接执行）
  - [ ] `buildInstructions()` 根据任务类型生成特定领域 system prompt
  - 验证：`pnpm --filter @yunpat/mcp-server test -- PatentDispatchTool`

- [ ] **T-2A.4-T2** 修改 `packages/packages/mcp-server/src/index.ts`
  - [ ] 注册 `patent_dispatch` 工具
  - [ ] 验证工具出现在 MCP tools list 中
  - 验证：`npx tsx packages/packages/mcp-server/src/index.ts --list-tools`

#### 检查清单

- [ ] `patent_dispatch` 工具在 MCP server 中可见
- [ ] 返回的 JSON 包含合法的 `agent_spawn` 配置
- [ ] 4 种任务类型（draft/respond/analyze/search）各有独立指令模板

---

### Sprint 3（Week 7）：2A.5 异常处理 + 2E.2 execpolicy Hook

> 2A.5 依赖 2A.4。2E.2 依赖 2E.1（rust-core）。

#### 任务列表

- [ ] **T-2A.5-T1** 修改 `packages/packages/orchestrator-adapter/src/exception-hook.ts`
  - [ ] 引入 `ExceptionHandler` from `@yunpat/orchestrator/exception`
  - [ ] 实现三种恢复策略输出（inject_message, suggest_tool, require_approval）
  - [ ] 添加测试用例：超时、API 错误、工具不存在
  - 验证：`echo '{"event":"on_error",...}' | npx tsx packages/packages/orchestrator-adapter/src/exception-hook.ts`

- [ ] **T-2E.2-T1** 新建 `packages/packages/execpolicy-hook/src/index.ts`
  - [ ] `tool_call_before` Hook 实现
  - [ ] 敏感词扫描（极敏感/高敏感词库）
  - [ ] 不当让步检测（正则模式匹配）
  - [ ] patent_submit 强制二次确认
  - [ ] patent_draft_full 参数级敏感度评估
  - 验证：`npx tsx packages/packages/execpolicy-hook/src/index.ts <<< '{"event":"tool_call_before",...}'`

- [ ] **T-2E.2-T2** 新建 `packages/packages/execpolicy-hook/` 包
  - [ ] package.json, tsconfig.json
  - [ ] 构建脚本
  - [ ] 注册到 workspace
  - 验证：`pnpm --filter @yunpat/execpolicy-hook build`

#### 检查清单

- [ ] 异常恢复策略输出正确格式的 `HookInstruction`
- [ ] execpolicy-hook 拦截 patent_submit 并输出 `require_approval`
- [ ] 高敏感技术交底词触发 `require_approval`
- [ ] 不当让步措辞触发 `warn`

---

### Sprint 4（Week 8-9）：2C.2 HITL 跨语言持久化

> 依赖 2C.1（rust-core 完成统一检查点 Schema）。

#### 任务列表

- [ ] **T-2C.2-T1** 新建 `packages/packages/core/src/memory/RustCheckpointBridge.ts`
  - [ ] `writeCheckpoint()` — TS 检查点序列化为 Rust SQLite 格式
  - [ ] `readCheckpoint()` — 从 Rust 格式反序列化为 TS Checkpoint
  - [ ] `exportToUnifiedFormat()` / `restoreFromUnifiedFormat()`
  - 验证：`pnpm --filter @yunpat/core test -- RustCheckpointBridge`

- [ ] **T-2C.2-T2** 修改 `packages/packages/orchestrator/src/OrchestratorAgent.ts`
  - [ ] HITL 门控时调用 bridge 持久化 pendingHITLState
  - [ ] 恢复时从 bridge 读取 HITL 状态
  - 验证：`pnpm --filter @yunpat/orchestrator test -- hitl_checkpoint`

#### 检查清单

- [ ] TS 检查点可序列化为 UnifiedCheckpoint v2 格式
- [ ] Rust SQLite 检查点可被 TS 反序列化
- [ ] E2E：开始撰写 → HITL 审批门 → 关闭 → 重启 → 看到 HITL 待审

---

## rust-tui 智能体任务清单

### Sprint 1（Week 3-4，与 rust-core Sprint 2 并行）：2D.1 RLM 并行检索

> 独立任务，无前置依赖。

#### 任务列表

- [ ] **T-2D.1-U1** 新建 `crates/crates/tui/src/tools/patent_parallel_search.rs`
  - [ ] 使用 RLM 引擎并行扇出 CN/US/EP 三数据库检索
  - [ ] 结果聚合去重（按专利号）
  - [ ] 性能基准测试
  - 验证：`cargo test -p deepseek-tui -- patent_parallel_search`

- [ ] **T-2D.1-U2** 修改 `crates/crates/tui/src/tools/mod.rs`
  - [ ] 添加 `mod patent_parallel_search;`
  - [ ] 注册到工具列表
  - 验证：`cargo build -p deepseek-tui`

#### 检查清单

- [ ] 并行检索返回合并结果
- [ ] 性能基准：串行 ~30s → 并行 <12s
- [ ] API 429 响应自动退避

---

### Sprint 2（Week 5-6）：2D.2 批量分析 + 2E.3 宪法 UI

> 2E.3 依赖 2E.1（rust-core 完成宪法引擎）。

#### 任务列表

- [ ] **T-2D.2-U1** 新建 `crates/crates/tui/src/tools/patent_batch_analysis.rs`
  - [ ] 多篇专利并行对比分析
  - [ ] 可配置并发限制（默认 8）
  - 验证：`cargo test -p deepseek-tui -- patent_batch_analysis`

- [x] ~~**T-2E.3-U1** 新建 `crates/crates/tui/src/views/constitutional_denial.rs`~~ — **已跳过**：视觉差异化用例不足，现有审批弹窗已足够

- [x] ~~**T-2E.3-U2** 新建 `.deepseek/constitutional.toml`~~ — **已跳过**

- [x] ~~**T-2E.3-U3** 修改 TUI 渲染模块~~ — **已跳过**

#### 检查清单

- [x] ~~宪法弹窗视觉与普通弹窗明确区分~~ — 已跳过
- [x] ~~HardDeny 弹窗不可 Esc 关闭~~ — 已跳过
- [x] ~~constitutional.toml 加载正确~~ — 已跳过
- [ ] 批量分析可处理 10+ 篇专利

---

### Sprint 3（Week 7-8）：2B.2 + 2B.3 工具统一

> 依赖 2B.1（rust-core 完成 MCP 适配器）。

#### 任务列表

- [ ] **T-2B.2-U1** 新建 `crates/crates/tui/src/tools/patent_specs.rs`
  - [ ] 为 7 个 MCP 工具定义强类型 Rust Spec
  - [ ] JSON Schema 验证
  - 验证：`cargo test -p deepseek-tui -- patent_specs_json_schema_valid`

- [ ] **T-2B.3-U1** 修改 `crates/crates/tui/src/tools/patent_workflow.rs`
  - [ ] `execute()` 优先走 MCP 适配器（ToolRegistry 查找）
  - [ ] MCP 不可用时降级到本地 Agent
  - 验证：`cargo test -p deepseek-tui -- patent_workflow_routing`

- [ ] **T-2B.3-U2** 修改 `crates/crates/tui/src/tools/spec.rs`
  - [ ] `ToolContext` 添加 `tool_registry` 引用
  - 验证：`cargo test -p deepseek-tui`

#### 检查清单

- [ ] 7 个 MCP 工具均有对应强类型 Rust Spec
- [ ] 工具路由优先走 MCP，降级走本地
- [ ] `cargo test -p deepseek-tui` 全部通过

---

### Sprint 4（Week 9）：2C.3 会话恢复

> 依赖 2C.1（rust-core）+ 2C.2（ts-orchestrator）。

#### 任务列表

- [ ] **T-2C.3-U1** 修改 `crates/crates/protocol/src/lib.rs`
  - [ ] `ThreadResumeParams` 添加 `patent_context` 字段
  - [ ] 定义 `PatentResumeContext`（intent_type, task_plan, pending_hitl）
  - 验证：`cargo test -p deepseek-protocol`

- [ ] **T-2C.3-U2** 修改 `crates/crates/core/src/lib.rs`
  - [ ] `resume_thread_with_history()` 检测 `patent_context`
  - [ ] 自动重载对应 Skill 和上下文
  - [ ] 注入恢复提示消息到 Engine
  - 验证：`cargo test -p deepseek-core -- resume_with_patent_context`

#### 检查清单

- [ ] 专利任务中断后恢复，Skill 和上下文自动重载
- [ ] 非 patent_context 的恢复不受影响
- [ ] `cargo test -p deepseek-core` 全部通过

---

## 全局验证阶段（Week 10，三个智能体共同参与）

### 构建验证

- [ ] `make build` 成功（Rust + TypeScript）
- [ ] `make test` 成功（Rust 2285+ 测试 + TypeScript 全量）
- [ ] 无新增 clippy 警告：`make lint`

### E2E 场景验证

- [ ] **场景 1：意图识别** — 输入"撰写电池专利" → 自动切换 Plan 模式 + 加载 patent-writer Skill
- [ ] **场景 2：任务规划** — 验证 `.deepseek/current-plan.md` 生成
- [ ] **场景 3：宪法约束** — YOLO 模式下提交专利 → 宪法层强制弹窗确认
- [ ] **场景 4：数据主权** — 高敏感技术交底 → 自动路由到本地模型
- [ ] **场景 5：子 Agent 委托** — 复杂任务触发 agent_spawn
- [ ] **场景 6：异常恢复** — 模拟工具超时 → 自动恢复策略注入
- [ ] **场景 7：会话恢复** — 开始撰写 → 关闭 TUI → 重启 → 恢复未完成任务
- [ ] **场景 8：并行检索** — CN/US/EP 三数据库同时检索 → 结果合并

### 回归验证

- [ ] Phase 1 功能不受影响（MCP 工具调用、slash 命令、专利 system prompt）
- [ ] 通用编码任务不受影响（"帮我写个排序函数"不触发专利工具）
- [ ] 原有 Hook 功能不受影响

---

## 文件冲突矩阵

以下文件被多个智能体修改，需协调顺序：

| 文件 | 智能体 | 任务 | 协调策略 |
|------|--------|------|---------|
| `crates/crates/core/src/lib.rs` | rust-core | 2A.1-R4, 2E.1-R4 | rust-core 串行完成 |
| `crates/crates/core/src/lib.rs` | rust-tui | 2C.3-U2 | 等 rust-core 完成后再修改 |
| `crates/crates/tui/src/tools/mod.rs` | rust-tui | 2B.1-U2, 2D.1-U2, 2D.2-U1 | 同一智能体，无冲突 |
| `crates/crates/tui/src/core/engine.rs` | rust-core | 2A.1-R5, 2E.1-R4 | rust-core 串行完成 |
| `.deepseek/config.toml` | ts-orchestrator | 2A.3-T3 | 独占修改 |
| `packages/packages/mcp-server/src/index.ts` | ts-orchestrator | 2A.4-T2 | 独占修改 |

**无跨智能体文件冲突**。每个文件只被一个智能体修改。

---

## 风险缓解检查点

| 周次 | 检查点 | 通过标准 | 不通过时的行动 |
|------|--------|---------|--------------|
| Week 2 | 2A.1 完成 | `cargo test -p deepseek-hooks` 通过 | 阻塞后续所有任务，优先修复 |
| Week 4 | 2E.1 完成 | 五条原则测试通过 | 宪法层降级为配置层（auto_deny） |
| Week 6 | 2A.4 完成 | patent_dispatch 返回合法 JSON | 简化为直接 MCP 工具调用 |
| Week 8 | 2B.1 完成 | MCP 工具在 ToolRegistry 中可见 | 保留独立 MCP 调度路径 |
| Week 10 | 全局验证 | `make test` 通过 | 按模块回退到已知稳定版本 |
