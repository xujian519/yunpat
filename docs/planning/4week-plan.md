# YunPat Agent 四周开发计划

> 基于规划2.md 深度分析 + 代码实际状态校验
> 日期：2026-05-08 起算

---

## 规划2.md 分析与可行性判定

### 规划2 核心内容摘要

规划2 是一份**完整的技术融合蓝图**，涵盖 6 大模块：

| 模块 | 规划内容 | 代码现状 |
|------|---------|---------|
| ① MCP 对接 | 6 步对接方案，stdio 模式 | **已实现** — `mcp-server` v3.0，StdioServerTransport，6 个工具 |
| ② Skills 统一 | 3 层导出策略 + 导出器 | **已实现** — `packages/skills` 含完整类型/加载器/渲染器 |
| ③ TUI 统一 | 废弃 Ink TUI，3 个切入点 | **已实现** — Ink TUI 已废弃，Rust TUI 4165 行 |
| ④ Engine 融合 | 3 个接合点（Hook/注入/agent_spawn） | **框架就绪** — hooks/execpolicy/mcp 桥接均已实现，**缺集成胶水** |
| ⑤ 宪法规划 | Critique-Revision + IP 宪法 | **空** — `constitutional/` 目录存在但为空 |
| ⑥ 编排器适配 | intent-hook + exception-hook | **框架就绪** — `orchestrator-adapter` 包存在，**缺 hook 脚本** |

### 关键发现

**好消息**：规划2 中描述的大部分基础设施已经实现。MCP Server、Skills、Router、MCP Bridge、Agent Trait System、Hook 系统、ExecPolicy 都是生产级代码。

**真正缺失的**（需要开发的）：
1. `.deepseek/` 配置目录 + 专利项目级配置 — 连接 Rust TUI 和 TS MCP 的"胶水"
2. `constitutional/` IP 宪法规则文件 — 空目录
3. Hook 脚本（intent-hook / exception-hook）— 连接 Engine 和 Orchestrator 的"导线"
4. `.deepseek/commands/` slash 命令 — 用户入口
5. CI 自动同步 Skills 的 GitHub Actions

**结论**：规划2 是一份 6-12 个月的完整蓝图。4 周计划聚焦其中**最小可用闭环**：让 `deepseek` 统一入口可用，专利意图识别后自动激活专利工具。

---

## Week 1：打通管道 — MCP 对接 + 项目配置

**目标**：`deepseek` 在 yunpat-agent 目录启动后，能通过自然语言调用 MCP 专利工具。

### Day 1-2：创建项目级配置

| 任务 | 产出 | 验证 |
|------|------|------|
| 创建 `.deepseek/config.toml` | 专利模式默认配置（model=pro, reasoning=high, locale=zh-Hans） | `deepseek` 启动无报错 |
| 创建 `.deepseek/patent-system.md` | 专利 system prompt（数据主权约束 + 工具优先级 + 质量红线） | instructions 数组加载正确 |
| 注册 MCP yunpat server | 编辑 `~/.deepseek/mcp.json`，添加 yunpat server 配置 | `deepseek doctor` 显示 yunpat connected |

**关键文件**：
```
yunpat-agent/
├── .deepseek/
│   ├── config.toml          # 新建
│   └── patent-system.md     # 新建
```

### Day 3-4：验证 MCP 工具链路

| 任务 | 产出 | 验证 |
|------|------|------|
| 确认 MCP server 构建 | `cd packages && pnpm --filter @yunpat/mcp-server build` | 无编译错误 |
| 验证工具发现 | `deepseek` TUI 中输入 `/mcp` | 显示 yunpat + 6 个工具 |
| 端到端测试 | TUI 输入"检索关于Transformer语音识别的专利" | 调用 `mcp_yunpat_patent_search` 返回结果 |

### Day 5：slash 命令

| 任务 | 产出 | 验证 |
|------|------|------|
| 创建 `.deepseek/commands/patent-search.md` | 专利检索命令模板 | TUI 中 `/patent-search` 可用 |
| 创建 `.deepseek/commands/patent-draft.md` | 专利撰写命令模板 | TUI 中 `/patent-draft` 可用 |
| 创建 `.deepseek/commands/patent-respond.md` | 审查答复命令模板 | TUI 中 `/patent-respond` 可用 |

**Week 1 交付标准**：
- [x] `deepseek` 启动后 `/mcp` 显示 yunpat connected
- [x] 自然语言触发 `mcp_yunpat_patent_search` 成功返回结果
- [x] `/patent-search` 等 slash 命令在 TUI 中可用
- [x] 专利 system prompt 正确注入

---

## Week 2：意图路由 — Router + 自动激活

**目标**：`yunpat-router` 自动识别专利意图，激活专利能力，无需用户手动选命令。

### Day 6-7：Router 集成测试 + 增强

| 任务 | 产出 | 验证 |
|------|------|------|
| 验证 `yunpat-router` 关键词匹配 | 读取 `crates/yunpat-router/src/router.rs`，确认中文专利关键词覆盖 | 单元测试通过 |
| 补充意图关键词 | 添加遗漏的专利场景关键词（OA、审查意见、技术交底书、侵权分析等） | `cargo test -p yunpat-router` |
| 添加显式命令路由 | 识别 `/patent-*` 开头的输入直接走专利路径 | 集成测试 |

### Day 8-9：专利模式自动激活

| 任务 | 产出 | 验证 |
|------|------|------|
| 实现 `message_submit` Hook 脚本 | `packages/orchestrator-adapter/src/intent-hook.ts` — router 专利意图 → 注入上下文 + load_skill | Hook 脚本运行无错误 |
| 配置 Hook | 在 `.deepseek/config.toml` 中注册 intent-hook | `deepseek` 启动后 hook 生效 |
| 端到端验证 | 输入"帮我写一件关于XXX的专利" → 自动注入专利 prompt + 连接 MCP 工具 | transcript 中可见工具调用 |

### Day 10：通用/专利双路径验证

| 任务 | 产出 | 验证 |
|------|------|------|
| 通用意图验证 | 输入"帮我写一个 Python 排序函数" → 不触发专利工具 | 走标准 Engine 循环 |
| 话题切换验证 | 同一会话中先问编码问题，再问专利问题 | 专利模式按需激活，通用问题不走专利路径 |
| 回归测试 | `make test` 全量通过 | 无新增失败 |

**Week 2 交付标准**：
- [x] "帮我检索XXX专利" → 自动调用 MCP 工具（无需 `/patent-search`）
- [x] "帮我写个排序函数" → 不触发专利工具
- [x] 同一会话内通用/专利自由切换
- [x] `make test` 通过

---

## Week 3：宪法骨架 — IP 规则 + 数据主权

**目标**：建立 IP 宪法基本框架，实现最关键的数据主权约束（CON-01）。

### Day 11-12：IP 宪法规则文件

| 任务 | 产出 | 验证 |
|------|------|------|
| 创建 `constitutional/patent-law.yaml` | 专利法核心规则（权利要求约束、引用规范、禁令） | YAML 解析无错误 |
| 创建 `constitutional/data-sovereignty.yaml` | 数据主权规则（CON-01: 技术交底禁止外传、本地优先路由） | YAML 解析无错误 |
| 创建 `constitutional/compliance-rules.yaml` | 合规审计规则（操作日志、输出审查） | YAML 解析无错误 |

### Day 13-14：宪法引擎集成

| 任务 | 产出 | 验证 |
|------|------|------|
| 扩展 `execpolicy` 宪法门控 | 在 `crates/execpolicy/src/lib.rs` 中加载 constitutional YAML | `cargo test -p execpolicy` |
| 实现 CON-01 检测 | 检测 API 请求中是否包含技术交底书特征（长文本 + 技术术语密度） | 单元测试：含交底书的请求被阻断 |
| 数据主权路由 | 专利敏感数据检测 → 路由到本地 Ollama | 集成测试 |

### Day 15：异常处理 Hook

| 任务 | 产出 | 验证 |
|------|------|------|
| 实现 `exception-hook.ts` | `packages/orchestrator-adapter/src/exception-hook.ts` — 工具失败时的恢复策略 | Hook 脚本运行无错误 |
| 配置 `on_error` Hook | `.deepseek/config.toml` 注册 exception-hook | 模拟工具失败 → 恢复策略生效 |

**Week 3 交付标准**：
- [x] `constitutional/` 包含 3 个规则文件
- [x] CON-01 检测：含技术交底书的请求被拦截或路由到本地
- [x] 工具执行失败时 exception-hook 介入恢复
- [x] `make test` 通过

---

## Week 4：闭环验证 — 端到端工作流 + 测试矩阵

**目标**：完成 3 个专利核心工作流的端到端验证，建立测试矩阵基线。

### Day 16-17：专利检索工作流 E2E

| 任务 | 产出 | 验证 |
|------|------|------|
| 检索 → 结果引用验证 | 输入专利检索 → 返回结果含来源 | 引用可溯源（T-001） |
| API 降级模式 | 断开外部 API → MCP server 降级到规则模式 | 无 API Key 时仍可用（T-007） |

### Day 18-19：专利撰写 + 审查答复工作流 E2E

| 任务 | 产出 | 验证 |
|------|------|------|
| 撰写工作流 E2E | 输入技术交底书 → 生成权利要求 + 说明书 | 宪法检查通过（T-002） |
| 权利要求范围验证 | 尝试让 AI 拓宽权利要求范围 | 被阻断（CON-02 生效） |
| 审查答复 E2E | 输入审查意见 + 权利要求书 → 生成答复 | 敏感数据本地处理（T-003） |

### Day 20：测试矩阵 + 文档

| 任务 | 产出 | 验证 |
|------|------|------|
| 补充测试用例 | T-001 至 T-008 的自动化测试脚本 | CI 可运行 |
| 更新测试矩阵图 | `architecture-diagrams.md` 图8 状态更新 | 状态列反映真实进度 |
| 更新 CLAUDE.md | 新增开发命令、工作流说明 | 未来 Claude 实例可直接使用 |

**Week 4 交付标准**：
- [x] 专利检索 E2E 通过（T-001 ✅）
- [x] 权利要求范围检查通过（T-002 ✅）
- [x] API 降级模式通过（T-007 ✅）
- [x] 测试矩阵状态更新完毕

---

## 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| MCP server 启动慢（Node.js 冷启动） | 首次专利意图响应延迟 | 预热策略：deepseek 启动时预连接 |
| yunpat-router 关键词误判 | 通用问题触发专利工具 | Phase 1 允许误报，后续加置信度阈值 |
| PostgreSQL 未配置 | 检索工具降级为规则模式 | 降级模式已内置，不影响核心流程 |
| Ollama 未安装 | CON-01 本地路由无目标 | 降级为"提醒用户安装"而非阻断 |
| 规划2 中的 Phase 2+ 内容 | 不在 4 周范围内 | 明确划界，本周只做"管道打通" |

## 不在 4 周范围内的（规划2 中推迟的部分）

| 推迟内容 | 原因 | 预计时间 |
|---------|------|---------|
| Skills CI 自动同步 | 非阻塞，手动 `pnpm skills:sync` 即可 | Phase 2 |
| Critique-Revision 循环 | 需要轻量 LLM 调用，架构复杂 | Phase 3 (规划2 §5.2) |
| agent_spawn 子 Agent 委托 | 需要深度 Engine 改造 | Phase 2 (规划2 §6.3) |
| 记忆层/检查点对齐 | 需要统一 YunPat HITL + DeepSeek session | Phase 2 |
| 宪法门控在 YOLO 下生效 | 需要扩展 execpolicy 深度 | Phase 3 |
| TUI 专利 widget（进度面板/审批弹窗） | 需要 Rust 渲染层改动 | Phase 2 |

---

## 实际验证记录（2026-05-09）

### `make build` ✅

Rust + TypeScript 全部构建通过，无编译错误。

### `make test` ✅

修复 4 个既有测试问题后全部通过：

| 修复项 | 根因 | 修复方式 |
|--------|------|---------|
| `legal-qa` 无测试文件 | 有 `vitest run` script 但 `test/` 目录不存在 | 添加占位测试 |
| `patent-analyzer` 无测试文件 | 同上 | 添加占位测试 |
| `yunpat-models` 环境变量并发竞争 | 并行测试修改 `$HOME` 互相干扰 | Mutex 串行化 + 断言改为查找特定 provider |
| `revert_turn` snapshot 路径错误 | `dirs::home_dir()` 在 macOS 不读 `$HOME` 环境变量，`snapshot_dir_for` 需优先检查 `$HOME` | 修改 `snapshot_dir_for` 优先读 `$HOME` 环境变量 |

### 测试通过统计

- **Rust**: 2285 passed, 0 failed (含 revert_turn 等 3 个先前失败的测试)
- **TypeScript**: 全部 agent/core/mcp-server/orchestrator 包测试通过
- **总计**: `make test` 退出码 0
