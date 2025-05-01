# YunPat TUI v2 设计方案

> 设计人：小诺🐟 | 日期：2026-05-05
> 核心思路：TUI 深耕「专利撰写 + OA答复」两大核心流程，其他能力通过 Gateway → Orchestrator 中枢调度

---

## 一、设计哲学

```
用户输入自然语言 → Orchestrator 意图识别 → 路由决策 → 专业 Agent 执行 → 结果聚合 → TUI 展示
```

**TUI 不是万能遥控器**，而是：

1. **两大核心流程的沉浸式工作台**（撰写 / OA答复）
2. **通用对话入口**（通过 Orchestrator 中枢调度所有其他能力）
3. **执行状态的实时仪表盘**

---

## 二、整体布局

```
┌─────────────────────────────────────────────────────────────────┐
│ ◆ YunPat · session-8a3f · ●已连接 · 模型: glm-4.7-flash        │  ← 顶栏
├─────────────────────────────────────┬───────────────────────────┤
│                                     │ ◉ 意图: DRAFT_FULL       │
│                                     │ 信度: 0.92               │
│  ● You 23:01                       │                           │
│  帮我撰写一份燃气阀门专利           │ ═══ 步骤进度 ═══          │
│                                     │ ✓ 1. 发明理解     12s    │
│  ◆ Assistant 23:02                 │ ✓ 2. 现有技术检索  28s    │
│  已识别意图：完整专利撰写           │ ● 3. 说明书撰写   进行中  │
│  发明名称：一种燃气管道紧急切断阀   │ ○ 4. 权利要求撰写         │
│  请确认发明理解是否准确？           │ ○ 5. 摘要撰写            │
│                                     │ ○ 6. 质量检查            │
│  [HITL] ① 批准 ② 修改 ③ 跳过      │                           │
│                                     │ ⏱ 40s · 💰 ~$0.03       │
│                                     │                           │
│                                     │ ═══ 上下文 ═══           │
│                                     │ 发明: 燃气管道紧急切断阀  │
│                                     │ 领域: 机械/阀门           │
│                                     │ Agent: patent-writer      │
├─────────────────────────────────────┴───────────────────────────┤
│ > 帮我撰写一份燃气阀门专利_                                      │  ← 输入栏
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、核心改进：三大模式

### 模式1：通用对话模式（默认）

用户随便说话 → Orchestrator 意图识别 → 自动路由

这是默认状态，和现在的 TUI 类似但增强：

- 右侧状态栏实时展示 Orchestrator 的 5 个 Call 状态
- 意图识别结果即时显示
- 自动进入对应的模式

### 模式2：专利撰写工作台（DRAFT_FULL / DRAFT_CLAIMS / DRAFT_SPEC）

当用户说"帮我写个专利"或 Orchestrator 识别出 DRAFT 意图时自动进入。

**关键改进——步骤进度可视化：**

```
═══════ 专利撰写工作流 ═══════

✓ Step 1/6 · 发明理解          完成  12s
  → 技术领域: 机械工程/阀门
  → 核心特征: 电磁驱动、自动复位、双密封

✓ Step 2/6 · 现有技术检索       完成  28s
  → 检索到 12 篇相关专利
  → 最接近: CN202310XXXXX.X

● Step 3/6 · 说明书撰写         进行中...
  [████████████░░░░░░░░░] 65%
  → 当前章节: 具体实施方式

○ Step 4/6 · 权利要求撰写       等待中
○ Step 5/6 · 摘要撰写           等待中
○ Step 6/6 · 质量检查           等待中
```

**每个步骤完成后的 HITL 确认（关键节点）：**

```
┌─────────────────────────────────────────────┐
│ ╔═! 需要确认 ════════════════════════════╗  │
│ ║                                        ═════════════════════════╗
│ ║  发明理解已完成，请确认：                                        ║
│ ║                                                                ║
│ ║  技术问题：                                                    ║
│ ║    现有燃气阀门紧急切断响应慢、可靠性低                          ║
│ ║  核心创新：                                                    ║
│ ║    1. 电磁驱动的快速响应机构                                    ║
│ ║    2. 双密封结构的冗余设计                                      ║
│ ║    3. 自诊断故障预警系统                                        ║
│ ║                                                                ║
│ ║  ① ✓ 批准继续   ② ✎ 修改内容   ③ ⊘ 跳过                      ║
│ ║  按数字选择，ESC 取消                                          ║
│ ╚════════════════════════════════════════════════════════════════╝ │
└─────────────────────────────────────────────────────────────────────┘
```

### 模式3：OA 答复工作台（RESPOND_OA）

当用户上传审查意见或说"帮我答复审查意见"时进入。

**OA 答复专用流程：**

```
═══════ 审查意见答复工作流 ═══════

✓ Step 1/5 · 官文解析            完成  3s
  → 申请号: 202310964091.X
  → 审查类型: 第一次审查意见
  → 答复期限: 2026-06-30
  → 涉及权利要求: 1-5

✓ Step 2/5 · 审查意见分析         完成  15s
  → 问题1: 第26条第4款 - 权利要求1不清楚
  → 问题2: 第22条第3款 - 缺乏创造性
  → 问题3: 第33条 - 修改超范围

● Step 3/5 · 答复策略生成         进行中...
  [████████░░░░░░░░░░░░] 40%

○ Step 4/5 · 答复文件撰写         等待中
○ Step 5/5 · 答复质量检查         等待中
```

**审查意见对比视图：**

```
┌── 审查意见 vs 答复策略 ──────────────────────────┐
│                                                   │
│ 🔴 审查员认为:                                    │
│   权利要求1相对于 D1(CN20XXXXXX) 不具备创造性     │
│   D1 已公开电磁驱动机构（见说明书第[0023]段）      │
│                                                   │
│ 🟢 答复策略:                                      │
│   区别特征：D1未公开"双密封冗余结构"              │
│   所解决的技术问题：提高密封可靠性                  │
│   论证思路：                      HITL ✓          │
│     1. 确定区别特征                                │
│     2. 确定实际解决的技术问题                       │
│     3. 论证非显而易见性                            │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## 四、新增/增强的斜杠命令

### 4.1 核心业务命令

| 命令      | 说明               | 示例                                   |
| --------- | ------------------ | -------------------------------------- |
| `/draft`  | 启动专利撰写工作流 | `/draft --title 燃气阀门 --field 机械` |
| `/oa`     | 启动OA答复工作流   | `/oa --file ./审查意见.pdf`            |
| `/search` | 现有技术检索       | `/search 电磁阀门快速切断`             |

### 4.2 流程控制命令

| 命令       | 说明                 |
| ---------- | -------------------- |
| `/approve` | 批准当前 HITL 检查点 |
| `/reject`  | 拒绝当前 HITL 检查点 |
| `/modify`  | 修改当前 HITL 内容   |
| `/skip`    | 跳过当前步骤         |
| `/resume`  | 恢复中断的任务       |

### 4.3 上下文命令

| 命令        | 说明                   |
| ----------- | ---------------------- |
| `/context`  | 查看当前会话上下文     |
| `/agents`   | 列出可用 Agent 及状态  |
| `/model`    | 查看/切换 LLM 模型     |
| `/workflow` | 查看当前工作流进度详情 |

---

## 五、架构改造

### 5.1 事件类型扩展

当前 TUI 只处理 6 种事件（intent/plan/hitl/progress/result/error），需要扩展：

```typescript
// 新增事件类型
export type GatewayEventType =
  // 现有
  | 'intent'
  | 'plan'
  | 'hitl'
  | 'progress'
  | 'result'
  | 'error'
  | 'connected'
  | 'disconnected'
  // 新增：步骤级别
  | 'step_start' // 某步骤开始
  | 'step_progress' // 步骤内进度更新
  | 'step_complete' // 某步骤完成
  | 'step_error' // 某步骤失败
  // 新增：工作流级别
  | 'workflow_start' // 整个工作流开始
  | 'workflow_done' // 整个工作流完成
  // 新增：附件
  | 'attachment' // 附件（PDF/DOCX等）

// 步骤进度事件
export interface StepProgressPayload {
  stepId: string
  stepName: string
  stepIndex: number // 第几步
  totalSteps: number
  status: 'running' | 'completed' | 'failed' | 'waiting'
  progress: number // 0-1
  duration?: number // 已耗时(ms)
  details?: string // 人类可读的进度描述
  data?: Record<string, unknown> // 步骤产出数据摘要
}
```

### 5.2 Orchestrator 适配器改造

当前 Orchestrator 适配器只有 `/internal/orchestrate` 一个入口。需要让它：

- 在每个步骤开始/完成时通过 SSE 推送 `step_start`/`step_complete` 事件
- 把 `TaskPlan` 推送给 TUI（当前只有 `progress` 事件，没有暴露步骤列表）

```typescript
// orchestrator-adapter/src/index.ts 改造要点
// 在 OrchestratorAgent.executeTaskPlan 的 for 循环中：

for (const step of taskPlan.steps) {
  // 新增：推送步骤开始事件
  await this.emitEvent(sessionId, 'step_start', {
    stepId: step.stepId,
    stepName: step.agentId,
    stepIndex: index,
    totalSteps: taskPlan.steps.length,
    status: 'running',
    hitl: step.hitl,
  })

  const result = await this.executeStep(step, input)

  // 新增：推送步骤完成事件
  await this.emitEvent(sessionId, 'step_complete', {
    stepId: step.stepId,
    stepName: step.agentId,
    status: result.success ? 'completed' : 'failed',
    duration: result.executionTime,
    data: summarizeResult(result), // 提取关键信息
  })
}
```

### 5.3 TUI Store 扩展

```typescript
// store/index.ts 新增状态

interface WorkflowState {
  /** 当前活跃的工作流 */
  activeWorkflow: {
    type: 'DRAFT_FULL' | 'DRAFT_CLAIMS' | 'DRAFT_SPEC' | 'RESPOND_OA' | 'SEARCH' | null
    planId: string
    totalSteps: number
    steps: StepState[]
    startTime: number
    currentStepIndex: number
  } | null
}

interface StepState {
  stepId: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_hitl'
  progress: number
  duration?: number
  details?: string
  result?: Record<string, unknown>
}
```

### 5.4 新增组件

```
packages/tui/src/
├── components/
│   ├── App.tsx              ← 改造：三模式切换
│   ├── ChatPanel.tsx        ← 改造：富文本渲染
│   ├── InputBar.tsx         ← 改造：文件上传支持
│   ├── StatusPanel.tsx      ← 改造：步骤进度展示
│   ├── HITLPanel.tsx        ← 保持
│   ├── WorkflowPanel.tsx    ← 新增：工作流步骤进度面板
│   ├── OAComparePanel.tsx   ← 新增：OA审查意见对比视图
│   └── QuickActionBar.tsx   ← 新增：快捷操作栏
├── commands/
│   ├── builtin.ts           ← 改造：增加业务命令
│   ├── draft.ts             ← 新增：/draft 命令
│   ├── oa.ts                ← 新增：/oa 命令
│   ├── search.ts            ← 新增：/search 命令
│   └── workflow.ts          ← 新增：/workflow /approve /reject 命令
├── hooks/
│   ├── useEvents.ts         ← 改造：处理新事件类型
│   ├── useWorkflow.ts       ← 新增：工作流状态管理
│   └── useHITL.ts           ← 保持
├── services/
│   ├── gateway.ts           ← 改造：文件上传 API
│   ├── sse.ts               ← 保持
│   └── fileUpload.ts        ← 新增：文件上传服务
└── store/
    └── index.ts             ← 改造：新增 WorkflowState
```

---

## 六、优先级排序

### P0：核心骨架（1-2天）

1. **Orchestrator 适配器改造**：推送 `step_start` / `step_complete` 事件
2. **TUI Store 扩展**：新增 WorkflowState
3. **事件处理扩展**：处理新事件类型
4. **WorkflowPanel 组件**：步骤进度可视化

### P1：撰写工作台（2-3天）

5. **`/draft` 命令**：触发撰写工作流
6. **HITL 增强**：每个关键步骤的确认面板
7. **步骤结果展示**：发明理解报告、检索结果等格式化输出

### P2：OA 答复工作台（2-3天）

8. **文件上传支持**：审查意见 PDF 上传
9. **`/oa` 命令**：触发 OA 答复工作流
10. **OA 对比视图**：审查意见 vs 答复策略并排展示

### P3：体验打磨（1-2天）

11. **快捷操作栏**：常用操作一键触发
12. **结果导出**：撰写完成后保存到文件
13. **模型切换**：运行时切换 LLM 提供商

---

## 七、关键技术决策

### 7.1 文件上传方案

TUI 通过 Gateway REST API 上传文件：

```
POST /api/v1/sessions/{id}/attachments
Content-Type: multipart/form-data

file: <binary>
```

Gateway 存储到临时目录，Orchestrator 通过路径访问。

### 7.2 长文本渲染

专利说明书等长文本输出时，使用分页渲染：

- 每次显示 20 行
- ↑↓ 翻页
- `Enter` 确认/继续

### 7.3 上下文传递

TUI 不直接调用 Agent，所有请求统一通过 Gateway → Orchestrator：

- TUI → `POST /api/v1/sessions/{id}/message`（发送消息/命令）
- TUI ← `GET /api/v1/sessions/{id}/events`（SSE 接收事件）
- Orchestrator 内部决定调用哪个 Agent

这确保了 TUI 不需要知道 Agent 的存在，只关心意图和结果。

---

## 八、不改的部分

- **Gateway（Rust）**：不改，已有的 API 足够
- **Orchestrator 核心逻辑**：不改 5-Call 架构，只让适配器多发事件
- **Agent 层**：完全不动，TUI 不直接依赖 Agent
- **MCP Server**：不动，给 Claude Desktop 用的
- **CLI**：不动，和 TUI 并行存在

---

_方案确认后，我可以从 P0 开始编码。_
