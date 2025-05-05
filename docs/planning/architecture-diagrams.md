# YunPat Agent 架构全景图

> 本文档包含 8 张核心架构图，基于项目代码实际状态绘制。
> **维护规则**：当相关代码变更时，必须同步更新对应架构图。

---

## 图 1：系统分层架构图

**核心设计**：统一入口 `deepseek`，始终以通用编码 Agent 启动。当 `yunpat-router` 意图识别判定为专利相关时，按需激活专利能力（MCP 工具加载、宪法规则注入、编排器接入），形成「通用底座 + 专利模式热切换」架构。

```mermaid
graph TB
    subgraph 统一入口["🚪 统一入口 (deepseek 命令)"]
        ENTRY["用户输入<br/>任何任务 — 编码/检索/撰写/答复"]
        I1["TUI (ratatui)<br/>crates/tui"]
        I2["CLI 分发器<br/>crates/cli"]
        I3["HTTP/SSE API<br/>crates/app-server"]
    end

    subgraph 路由层["🔀 意图路由 (Rust, 内置)"]
        ROUTER["yunpat-router<br/>意图分类器<br/><i>每条消息首轮轻量判断</i>"]
        ROUTER -->|"通用编码/对话"| GEN_PATH["通用路径<br/>标准 Engine 循环"]
        ROUTER -->|"专利相关意图"| PAT_PATH["专利路径<br/>激活专利能力"]
    end

    subgraph 通用引擎["⚡ 通用引擎 (始终活跃)"]
        E1["Engine 主循环<br/>ReAct loop"]
        E2["Rust 工具注册表<br/>shell/file/git/github/subagent"]
        E3["Session 管理<br/>检查点/恢复/回滚"]
        E4["MCP 客户端<br/>crates/mcp"]
    end

    subgraph 专利激活层["🔬 专利能力 (按需激活, 懒加载)"]
        ACTIVE["激活信号<br/>set_mode / load_skill"]
        subgraph 宪法约束["⚖️ 宪法约束 (激活后生效)"]
            C1["Constitution Engine<br/>crates/execpolicy"]
            C2["Rule DSL<br/>constitutional/*.yaml"]
            C3["Data Sovereignty<br/>数据主权路由"]
        end
        subgraph 编排器["🎯 编排器 (MCP stdio)"]
            O1["OrchestratorAgent"]
            O2["IntentRecognizer (精确)"]
            O3["TaskPlanner"]
            O4["ExceptionHandler"]
        end
        subgraph 专利Agent["🔧 25个专业 Agent (MCP 工具)"]
            B1["PatentWriter"]
            B2["PatentSearch"]
            B3["PatentResponder"]
            B4["PatentAnalyzer"]
            B5["QualityChecker"]
            B6["ClaimsGenerator"]
            B7["其他 19 个"]
        end
    end

    subgraph 模型层["🧠 模型层 (共享)"]
        M1["yunpat-models<br/>多提供商适配"]
        M2["DeepSeek (默认)"]
        M3["Qwen / OpenAI / Anthropic"]
        M4["本地 Ollama (敏感数据)"]
        M5["RLM 并行引擎"]
    end

    subgraph 数据层["💾 数据层 (共享)"]
        D1["PostgreSQL<br/>7500万CN专利"]
        D2["SQLite<br/>会话/状态持久化"]
        D3["知识库<br/>4382个法律文件"]
        D4["向量库 pgvector"]
        D5["知识图谱"]
    end

    ENTRY --> I1 & I2 & I3
    I1 & I2 & I3 --> ROUTER
    GEN_PATH --> E1
    PAT_PATH --> ACTIVE
    ACTIVE --> C1 & O1
    O1 --> B1 & B2 & B3 & B4 & B5 & B6 & B7
    E1 --> E2 & E3 & E4
    E4 <-->|"MCP stdio<br/>按需连接"| O1
    E2 & B1 & B2 & B3 & B4 & B5 & B6 & B7 --> M1
    M1 --> M2 & M3 & M4 & M5
    E2 --> D2
    B2 --> D1
    B1 & B5 --> D3 & D4

    style 统一入口 fill:#e8eaf6,stroke:#283593
    style 路由层 fill:#fff9c4,stroke:#f57f17
    style 通用引擎 fill:#e3f2fd,stroke:#1565c0
    style 专利激活层 fill:#fce4ec,stroke:#c62828
    style 宪法约束 fill:#ff8a80,stroke:#d32f2f
    style 编排器 fill:#b2dfdb,stroke:#00695c
    style 专利Agent fill:#d1c4e9,stroke:#4527a0
```

**双路径运行模式**：

| 路径 | 触发条件 | 可用工具 | 宪法约束 | 模型 |
|------|---------|---------|---------|------|
| 通用路径 | 非专利意图（编码、问答、文件操作等） | shell, file, git, github, subagent, web 等 | 标准 execpolicy | DeepSeek (默认) |
| 专利路径 | `yunpat-router` 识别为专利意图 | 通用工具 **+** 6 个 MCP 专利工具 **+** 25 个 Agent | 标准 **+** IP 宪法 (CON-01~05) | 可路由至本地 Ollama |

**专利模式激活流程**（零用户感知）：
1. 用户输入 → `yunpat-router` 轻量分类（<100ms，不调用 LLM）
2. 若专利意图 → `hooks` 触发：注入专利 system prompt + 连接 MCP yunpat server + 加载专利 Skill
3. 后续 turn 自动在专利模式下运行，直到会话结束或用户切换话题
4. 同一会话内可自由在通用/专利模式间切换（由 router 每轮判定）

**层间通信协议**：
- 入口 → 路由层：Rust 函数调用（进程内）
- 路由层 → 通用引擎：标准 Engine 循环
- 路由层 → 专利激活：Hooks (JSONL) + `load_skill`
- 通用引擎 ↔ 专利编排：MCP stdio（按需连接）
- 专利编排 → 专利 Agent：TypeScript 函数调用（进程内）
- 工具 → 模型层：HTTP/SSE (OpenAI-compatible)

---

## 图 2：数据主权与合规边界图

```mermaid
graph LR
    subgraph 安全区域["🔒 安全区域（本地）"]
        direction TB
        S1["技术交底书原文<br/><b>禁止外传</b>"]
        S2["权利要求草稿<br/><b>禁止外传</b>"]
        S3["审查答复策略<br/><b>禁止外传</b>"]
        S4["本地 Ollama<br/>敏感数据处理"]
        S5["SQLite 本地状态<br/>会话/检查点"]
    end

    subgraph 受控区域["🟡 受控区域（API调用）"]
        direction TB
        C1["专利检索查询<br/>需脱敏"]
        C2["权利要求结构分析<br/>抽象化后发送"]
        C3["法律知识检索<br/>不含技术细节"]
        C4["DeepSeek / Qwen API<br/>审计日志记录"]
    end

    subgraph 公共区域["🟢 公共区域"]
        direction TB
        P1["专利法条文"]
        P2["审查指南"]
        P3["公开专利数据<br/>7500万CN专利"]
        P4["无效决定判例"]
        P5["Google Patents"]
    end

    S1 -- "宪法门控: 本地优先" --> S4
    S1 -.->|"仅发送脱敏摘要"| C4
    C2 --> C4
    C4 --> P3
    C4 --> P5

    P1 --> S3
    P2 --> S3
    P3 --> C3
    P4 --> C3

    style 安全区域 fill:#d32f2f,color:#fff
    style 受控区域 fill:#f9a825,color:#000
    style 公共区域 fill:#388e3c,color:#fff
```

**数据流合规规则**：

| 规则 ID | 数据类型 | 约束 | 实现位置 |
|---------|---------|------|---------|
| SOV-001 | 技术交底书原文 | 禁止出现在外部 API 请求中 | `execpolicy` 宪法门控 |
| SOV-002 | 权利要求草稿 | 仅允许抽象化后发送 | `hooks` post_response |
| SOV-003 | 审查答复策略 | 本地模型优先处理 | `config` 路由策略 |
| SOV-004 | 检索结果引用 | 必须附带原始来源 | `patent-tools` 输出格式 |
| SOV-005 | 竞争对手专利分析 | 禁止复制权利要求文字 | `hooks` pre_turn |
| SOV-006 | 所有操作 | 完整审计日志 | `hooks` jsonl/webhook |

---

## 图 3：长期演进路线图

```mermaid
gantt
    title YunPat Agent 演进路线图
    dateFormat YYYY-MM
    axisFormat %Y年%m月

    section Phase 1: 接口对齐 (0-3月)
    MCP stdio 对接               :p1a, 2026-05, 14d
    Skills 格式统一              :p1b, after p1a, 21d
    废弃 Ink TUI                 :p1c, 2026-05, 7d
    项目级 .deepseek 配置        :p1d, 2026-05, 3d

    section Phase 2: 深度融合 (3-9月)
    编排器适配器融合              :p2a, 2026-08, 90d
    工具层统一注册                :p2b, 2026-09, 60d
    记忆层/检查点对齐             :p2c, 2026-11, 30d
    RLM 并行加速                  :p2d, 2026-10, 21d

    section Phase 3: 宪法规划层 (9-18月)
    IP 宪法定义                   :p3a, 2027-02, 30d
    Critique-Revision 循环       :p3b, 2027-03, 90d
    宪法门控 (YOLO也生效)        :p3c, 2027-05, 60d
    数据主权强制路由              :p3d, 2027-06, 30d
    完整审计层                    :p3e, 2027-07, 60d

    section Phase 4: 产品化平台 (18-36月)
    企业部署 (多租户)            :p4a, 2027-11, 180d
    知识飞轮 (Skills 自沉淀)     :p4b, 2028-01, 365d
    商业化 (SaaS/私有/SDK)       :p4c, 2028-03, 180d
    扩展领域 (商标/著作权/PCT)   :p4d, 2028-06, 365d
```

**里程碑验证标准**：

| Phase | 完成标志 | 验证方式 |
|-------|---------|---------|
| P1 | `deepseek` 统一入口可用，专利意图识别后自动激活专利工具 | 输入专利问题 → MCP 工具自动加载 |
| P2 | Orchestrator 任务经 Engine 执行，session 可恢复 | 关闭终端后 `--continue` 恢复 |
| P3 | YOLO 模式下专利敏感数据不外传 | 红队测试：注入泄露指令被阻断 |
| P4 | 多租户隔离 + 企业独立部署 | 集成测试 + 安全审计 |

---

## 图 4：规则决策树

**核心设计**：`deepseek` 统一入口，每条消息经 `yunpat-router` 轻量分类。专利意图触发能力激活，通用意图走标准路径。同一会话内可自由切换。

```mermaid
graph TD
    START["用户输入 → deepseek"] --> ROUTER{"yunpat-router<br/>意图分类<br/>(规则匹配, <100ms)"}

    ROUTER -->|"非专利意图<br/>编码/问答/文件操作"| GEN["通用路径<br/>标准 Engine 循环<br/>shell/file/git/web 工具"]
    GEN --> GEN_EXEC["直接执行"]
    GEN_EXEC --> GEN_END["输出结果"]

    ROUTER -->|"专利意图<br/>撰写/检索/答复/分析"| ACTIVATE["专利模式激活<br/>① 注入专利 system prompt<br/>② 连接 MCP yunpat server<br/>③ 加载专利 Skill<br/>④ 启用 IP 宪法约束"]

    ACTIVATE --> INTENT{"精确意图识别<br/>IntentRecognizer<br/>(TS 侧, 含 LLM)"}

    INTENT -->|patent_writing| PW["专利撰写任务"]
    INTENT -->|office_action| OA["审查答复任务"]
    INTENT -->|prior_art_search| PS["专利检索任务"]
    INTENT -->|patent_analysis| PA["专利分析任务"]

    PW --> SEN{"数据敏感度<br/>检查"}
    OA --> SEN
    PS --> SEN
    PA --> SEN

    SEN -->|含技术交底书| LOCAL["强制本地模型<br/>Ollama 路由"]
    SEN -->|不含敏感数据| API["标准 API 调用<br/>DeepSeek/Qwen"]

    LOCAL --> PLAN["Plan 模式<br/>任务规划"]
    API --> PLAN

    PLAN --> CONSTITUTION{"IP 宪法合规<br/>检查"}
    CONSTITUTION -->|通过| EXEC["工具执行<br/>MCP 专利工具 + 通用工具"]
    CONSTITUTION -->|违规| BLOCK["阻断操作<br/>审计日志 + 用户告警"]

    EXEC --> CLAIMS{"涉及<br/>权利要求?"}
    CLAIMS -->|是| CLAIM_CHECK{"权利要求<br/>保护范围检查"}
    CLAIMS -->|否| RESULT["结果聚合"]

    CLAIM_CHECK -->|收窄范围| WARN["⚠️ 警告用户确认"]
    CLAIM_CHECK -->|拓宽范围| BLOCK2["阻断<br/>禁止主动拓宽"]
    CLAIM_CHECK -->|范围合理| RESULT

    WARN --> USER_CONFIRM{"用户确认?"}
    USER_CONFIRM -->|确认| RESULT
    USER_CONFIRM -->|拒绝| PLAN

    RESULT --> CITE{"引用<br/>对比文件?"}
    CITE -->|是| CITE_CHECK{"来源可溯?"}
    CITE -->|否| OUTPUT["输出结果"]

    CITE_CHECK -->|真实检索结果| OUTPUT
    CITE_CHECK -->|无来源| BLOCK3["阻断<br/>禁止虚构文献"]

    OUTPUT --> DEACTIVATE{"下一轮输入<br/>仍是专利意图?"}
    DEACTIVATE -->|是| ROUTER
    DEACTIVATE -->|否| DEACT["退出专利模式<br/>回到通用路径"]

    style BLOCK fill:#d32f2f,color:#fff
    style BLOCK2 fill:#d32f2f,color:#fff
    style BLOCK3 fill:#d32f2f,color:#fff
    style LOCAL fill:#ff9800,color:#fff
    style WARN fill:#ffc107,color:#000
    style ACTIVATE fill:#7c4dff,color:#fff
    style GEN fill:#90caf9,stroke:#1565c0
```

**意图分类规则（`yunpat-router` 规则匹配，不调用 LLM）**：

| 匹配方式 | 专利关键词示例 | 非专利特征 |
|---------|-------------|-----------|
| 关键词匹配 | 专利、权利要求、审查意见、OA、新颖性、创造性、技术交底、检索报告、IPC | 函数、bug、文件、git、build |
| 上下文暗示 | 在 YunPat 项目目录下 + 法律/技术文档操作 | 在通用项目目录下 |
| 显式触发 | `/patent-*` slash 命令 | 无 |

**宪法条款编号**（仅在专利模式激活后生效）：
- CON-01：技术交底内容不得出现在 API 请求 prompt 中
- CON-02：权利要求措辞只能收紧，不能主动拓宽
- CON-03：引用对比文件必须附带原始检索结果
- CON-04：竞争对手专利分析禁止复制权利要求文字
- CON-05：所有专利操作必须记录审计日志

---

## 图 5：状态机图（Agent 生命周期）

**核心设计**：`deepseek` 始终以通用模式启动。`yunpat-router` 在每轮 turn 前做意图分类，识别到专利意图时激活专利模式，话题切换时自然回到通用模式。两个模式共享 Session 管理。

```mermaid
stateDiagram-v2
    [*] --> GeneralIdle : deepseek 启动<br/>通用编码 Agent

    state "通用模式" as GM {
        GeneralIdle --> GeneralExecuting : 通用任务<br/>编码/文件/git
        GeneralExecuting --> GeneralIdle : 任务完成
        GeneralExecuting --> GeneralIdle : 错误恢复
    }

    GeneralIdle --> PatentActivating : yunpat-router<br/>识别专利意图
    GeneralExecuting --> PatentActivating : 下一轮输入<br/>识别为专利意图

    state "专利模式激活" as ACT {
        PatentActivating : 注入专利 prompt
        PatentActivating : 连接 MCP yunpat server
        PatentActivating : 加载专利 Skill
        PatentActivating : 启用 IP 宪法约束
    }

    PatentActivating --> PatentPlanning : 激活完成

    state "专利模式" as PM {
        PatentPlanning --> AwaitingApproval : Plan 模式
        PatentPlanning --> PatentExecuting : YOLO 模式

        AwaitingApproval --> PatentExecuting : 用户确认 ✓
        AwaitingApproval --> PatentPlanning : 用户拒绝 ✗
        AwaitingApproval --> Suspended : 超时

        PatentExecuting --> ToolInvoking : 调用工具
        PatentExecuting --> CritiqueCheck : 输出产生
        PatentExecuting --> SpawningSubAgent : 子任务委托

        ToolInvoking --> PatentExecuting : 结果返回
        ToolInvoking --> ErrorHandling : 工具失败

        ErrorHandling --> PatentExecuting : 恢复成功
        ErrorHandling --> Suspended : 需人工介入
        ErrorHandling --> PatentFailed : 不可恢复

        CritiqueCheck --> PatentExecuting : 合规 ✓
        CritiqueCheck --> Revising : 违规 → 修订
        Revising --> CritiqueCheck : 修订完成

        SpawningSubAgent --> PatentExecuting : 子 Agent 返回

        PatentExecuting --> PatentCompleted : 任务完成
    }

    PatentCompleted --> PatentIdle : 专利结果已交付
    PatentCompleted --> PatentPlanning : 连续专利任务

    PatentIdle --> PatentPlanning : 下一轮仍为专利意图
    PatentIdle --> GeneralIdle : 话题切换<br/>回到通用模式
    PatentFailed --> PatentIdle : 错误已记录

    Suspended --> PatentPlanning : 恢复 (--continue)
    Suspended --> PatentFailed : 超过恢复期限

    GeneralIdle --> [*] : 用户退出
```

**双模式状态对比**：

| 属性 | 通用模式 | 专利模式 |
|------|---------|---------|
| 入口 | `deepseek` 启动即进入 | `yunpat-router` 意图识别后激活 |
| 可用工具 | shell, file, git, github, web, subagent... | 通用工具 **+** 6 MCP 专利工具 + 25 Agent |
| 宪法约束 | 标准 execpolicy | 标准 **+** IP 宪法 (CON-01~05) |
| 模型路由 | DeepSeek (默认) | 可路由至 Ollama (敏感数据) |
| Session 管理 | 共享 SQLite | 共享 SQLite (同一 session) |
| 模式切换 | 自动（每轮 router 判定） | 自动（每轮 router 判定） |
| 持久化 | schema_version, turn_index | plan_id, intent_type, tool_calls |

**Agent 状态表（SQLite 持久化，专利模式独有字段）**：

| 状态 | 触发条件 | 持久化 | 可恢复 |
|------|---------|--------|--------|
| GeneralIdle | deepseek 启动 / 通用任务结束 | session_id | — |
| PatentActivating | router 识别专利意图 | activated_skills, mcp_connected | — |
| PatentPlanning | 精确 Intent 匹配成功 | plan_id, intent_type | 是 |
| AwaitingApproval | Plan 模式 + 非自动审批 | approval_id | 是 |
| PatentExecuting | 审批通过 / YOLO | turn_index, tool_calls | 是 |
| CritiqueCheck | 专利输出产生后 | violation_list | 是 |
| Revising | IP 宪法审查未通过 | revision_count | 是 |
| Suspended | 超时 / 用户离开 / HITL | checkpoint_id | 是 (`--continue`) |
| SpawningSubAgent | 复杂专利任务分解 | sub_agent_id | 是 |
| PatentCompleted | 专利任务成功 | result_data | — |
| PatentFailed | 不可恢复错误 | error_detail | — |

---

## 图 6：模块依赖图（代码级）

```mermaid
graph TD
    subgraph 入口["应用入口"]
        CLI["cli<br/>(deepseek 命令)"]
        TUI["tui<br/>(ratatui 主运行时)"]
        APPSRV["app-server<br/>(HTTP/SSE)"]
    end

    subgraph 核心["核心运行时"]
        CORE["core<br/>(Agent循环/Session)"]
        AGENT["agent<br/>(ModelRegistry)"]
        CONFIG["config<br/>(配置加载)"]
        SECRET["secrets<br/>(API Key)"]
    end

    subgraph 协议["协议与策略"]
        PROTO["protocol<br/>(帧/类型)"]
        EXECPOL["execpolicy<br/>(审批策略)"]
        HOOKS["hooks<br/>(生命周期钩子)"]
    end

    subgraph 工具链["工具链"]
        TOOLS["tools<br/>(工具注册表)"]
        MCP["mcp<br/>(MCP客户端)"]
        STATE["state<br/>(SQLite持久化)"]
    end

    subgraph 专利领域["专利领域 (yunpat-*)"]
        YAGENTS["yunpat-agents<br/>(Agent trait/注册/Flow)"]
        YMODELS["yunpat-models<br/>(多提供商ModelProvider)"]
        YBRIDGE["yunpat-mcp-bridge<br/>(MCP桥接)"]
        YROUTER["yunpat-router<br/>(意图路由)"]
    end

    CLI --> TUI
    CLI --> APPSRV
    CLI --> AGENT
    CLI --> EXECPOL
    CLI --> MCP
    CLI --> SECRET
    CLI --> STATE

    TUI --> YAGENTS
    TUI --> YMODELS
    TUI --> YROUTER
    TUI --> TOOLS
    TUI --> SECRET
    TUI --> STATE

    APPSRV --> CORE
    APPSRV --> AGENT

    CORE --> AGENT
    CORE --> CONFIG
    CORE --> EXECPOL
    CORE --> HOOKS
    CORE --> MCP
    CORE --> PROTO
    CORE --> STATE
    CORE --> TOOLS

    AGENT --> CONFIG
    CONFIG --> SECRET
    EXECPOL --> PROTO
    HOOKS --> PROTO
    TOOLS --> PROTO

    YBRIDGE --> YAGENTS
    YAGENTS -.->|"独立,无内部dep"| YAGENTS

    style 入口 fill:#e3f2fd,stroke:#1565c0
    style 核心 fill:#fff3e0,stroke:#e65100
    style 协议 fill:#e8f5e9,stroke:#2e7d32
    style 工具链 fill:#fce4ec,stroke:#c62828
    style 专利领域 fill:#f3e5f5,stroke:#6a1b9a
```

**依赖分层规则**：

| 层级 | Crate | 允许依赖 |
|------|-------|---------|
| L0 叶节点 | protocol, config, secrets, state, tui-core | 无内部依赖 |
| L1 基础设施 | tools, mcp, hooks, execpolicy | 仅 L0 |
| L2 注册表 | agent | L0 |
| L3 核心运行时 | core | L0 + L1 + L2 |
| L4 应用入口 | cli, tui, app-server | L3 及以下 |
| 专利领域 | yunpat-agents, yunpat-models, yunpat-router | 独立（无内部 dep） |
| 桥接层 | yunpat-mcp-bridge | yunpat-agents |

---

## 图 7：MCP 工具注册表图

**核心设计**：MCP 服务端按需启动。通用模式下 yunpat MCP server 不运行（零开销），专利模式激活时才 spawn Node.js 子进程连接。

```mermaid
graph TB
    subgraph Rust侧["Rust 侧 (始终运行)"]
        MC1["MCP 客户端<br/>crates/mcp"]
        ROUTER["yunpat-router<br/>意图分类"]
        TOOLS_REG["通用工具注册表<br/>shell/file/git/github/web/subagent"]
    end

    subgraph 专利激活["专利模式激活 (按需)"]
        ACT_SIG["激活信号<br/>router → hooks"]
        ACT_SIG -->|"spawn 子进程"| NODE["Node.js 子进程<br/>yunpat MCP server"]
    end

    subgraph TS侧["TypeScript MCP 服务端 (懒启动)"]
        MS["MCP Server v3.0<br/>StdioServerTransport"]

        subgraph 核心工具["6 个核心专利工具"]
            T_search["<b>patent_search</b><br/>综合专利检索"]
            T_claims["<b>claims_generator</b><br/>权利要求自动生成"]
            T_quality["<b>quality_checker</b><br/>质量检查"]
            T_legal["<b>legal_knowledge_search</b><br/>法律知识问答"]
            T_invalid["<b>invalid_decision_search</b><br/>无效决定查询"]
            T_rules["<b>patent_rule_search</b><br/>审查规则搜索"]
        end

        subgraph Agent集成["Agent 集成层 (真实 Agent + 规则降级)"]
            A1["PatentSearchAgent"]
            A2["ClaimsGeneratorAgent"]
            A3["QualityCheckerAgent"]
            A4["LegalQAAgent"]
        end

        subgraph 数据源["数据源"]
            DB1["PostgreSQL<br/>7500万CN专利"]
            DB2["Google Patents API"]
            KB["知识库<br/>4382个法律文件"]
        end
    end

    subgraph 配置["MCP 配置 (~/.deepseek/mcp.json)"]
        CFG["yunpat server<br/>command: node<br/>execute_timeout: 300s<br/>lazy: true"]
    end

    ROUTER -->|"非专利意图"| TOOLS_REG
    ROUTER -->|"专利意图"| ACT_SIG
    CFG --> MC1
    MC1 <-->|"MCP stdio<br/>按需连接"| NODE
    NODE --> MS

    T_search --> A1
    T_claims --> A2
    T_quality --> A3
    T_legal --> A4
    T_invalid --> DB1
    T_rules --> DB1

    A1 --> DB1
    A1 --> DB2
    A4 --> KB

    style Rust侧 fill:#e3f2fd,stroke:#1565c0
    style 专利激活 fill:#e1bee7,stroke:#6a1b9a
    style TS侧 fill:#fff3e0,stroke:#e65100
    style 核心工具 fill:#e8f5e9,stroke:#2e7d32
```

**懒启动策略**：

| 阶段 | MCP 服务端状态 | 资源占用 |
|------|--------------|---------|
| deepseek 启动 | 未启动 | 0 内存 |
| 通用模式运行 | 未启动 | 0 内存 |
| 专利意图首次识别 | spawn Node.js 子进程 | ~50MB |
| 专利任务执行中 | 已连接，工具可用 | ~50MB |
| 回到通用模式 | 保持连接（复用） | ~50MB |
| deepseek 退出 | 子进程自动终止 | 0 |

**工具参数速查**：

| 工具名 | 必填参数 | 可选参数 | 超时建议 |
|--------|---------|---------|---------|
| `patent_search` | query | mode, page, limit | 30s |
| `claims_generator` | technicalField, technicalProblem, keyFeatures, technicalSolution, beneficialEffects | — | 120s |
| `quality_checker` | claims, specification | — | 60s |
| `legal_knowledge_search` | question | domain, sources, topK | 30s |
| `invalid_decision_search` | query | domain, topK | 30s |
| `patent_rule_search` | query | articleType, topK | 30s |

**内部命名规则**：MCP 工具在 Rust 侧的调用名为 `mcp_yunpat_{tool_name}`，如 `mcp_yunpat_patent_search`。

---

## 图 8：验证测试矩阵图

```mermaid
graph LR
    subgraph 测试维度
        direction TB
        D1["功能正确性"]
        D2["数据安全"]
        D3["性能"]
        D4["兼容性"]
        D5["可恢复性"]
    end

    subgraph 测试层级
        direction TB
        L1["L1: 单元测试<br/>cargo test / pnpm test"]
        L2["L2: 集成测试<br/>MCP 端到端"]
        L3["L3: 系统测试<br/>完整工作流"]
        L4["L4: 红队测试<br/>安全突破尝试"]
    end

    subgraph 测试场景["核心测试场景"]
        direction TB
        S1["专利检索 → 结果引用<br/>验证: 来源可溯源"]
        S2["权利要求生成 → 宪法检查<br/>验证: 保护范围不拓宽"]
        S3["审查答复 → 本地优先<br/>验证: 敏感数据不外传"]
        S4["会话中断 → 恢复<br/>验证: 检查点完整"]
        S5["多 Agent 协作 → 结果聚合<br/>验证: 子 Agent 生命周期"]
        S6["YOLO 模式 → 宪法约束<br/>验证: 违规操作被阻断"]
        S7["API 降级 → 规则模式<br/>验证: 无 API Key 时仍可用"]
        S8["并发专利分析 → RLM<br/>验证: 并行结果正确"]
    end

    D1 --> L1
    D2 --> L4
    D3 --> L3
    D4 --> L2
    D5 --> L3

    L1 --> S1
    L1 --> S2
    L2 --> S3
    L2 --> S5
    L2 --> S7
    L3 --> S4
    L3 --> S8
    L4 --> S6
```

**测试矩阵详细表**：

| 测试 ID | 场景 | 维度 | 层级 | Rust 测试 | TS 测试 | 红队 | 当前状态 |
|---------|------|------|------|-----------|---------|------|---------|
| T-001 | 专利检索返回真实引用 | 功能 | L1 | `cargo test -p yunpat-agents` | `pnpm test --filter mcp-server -- e2e` | — | ✅ 已有 |
| T-002 | 权利要求不主动拓宽 | 安全 | L1 | `cargo test -p execpolicy` | `pnpm test --filter mcp-server -- e2e` | — | ✅ 已实现 |
| T-003 | 技术交底不外传API | 安全 | L4 | — | `vitest run DataSovereigntyChecker` | 注入泄露指令 | ✅ 已实现 |
| T-004 | 会话恢复检查点完整 | 可恢复 | L3 | `cargo test -p state` | — | — | ✅ 已有 |
| T-005 | 子 Agent 生命周期 | 功能 | L2 | `cargo test -p core` | `pnpm test --filter orchestrator` | — | ⚠️ 部分（Phase 2 agent_spawn 后完善） |
| T-006 | YOLO 下宪法约束有效 | 安全 | L4 | — | — | 尝试绕过宪法 | ❌ Phase 3（Critique-Revision） |
| T-007 | MCP 工具降级模式 | 兼容 | L2 | `cargo test -p mcp` | `vitest run e2e` | — | ✅ 已验证 |
| T-008 | RLM 并行分析正确 | 性能 | L3 | `cargo test -p tui` | — | — | ⚠️ 部分（Phase 2 完善） |
| T-009 | Critique-Revision 循环 | 安全 | L2 | — | — | 构造违规输出 | ❌ Phase 3 |
| T-010 | 多租户数据隔离 | 安全 | L4 | — | — | 跨租户访问尝试 | ❌ Phase 4 |

---

## 维护指南

**当以下代码变更时，需同步更新对应架构图**：

| 变更范围 | 需更新图 | 检查方式 |
|---------|---------|---------|
| 新增/删除 Rust crate | 图1、图6 | `crates/Cargo.toml` workspace members |
| 新增/删除 TS package | 图1、图6 | `packages/pnpm-workspace.yaml` |
| 新增/删除 MCP 工具 | 图7 | `packages/mcp-server/src/tools/` |
| 修改数据流合规规则 | 图2、图4 | `constitutional/` 目录 |
| Agent 状态机变更 | 图5 | `crates/core/src/` turn_loop |
| 意图分类规则变更 | 图1路由层、图4、图5 | `crates/yunpat-router/src/` |
| 专利模式激活逻辑变更 | 图1专利激活层、图5 | `crates/hooks/` + `.deepseek/config.toml` |
| 新增测试类型 | 图8 | `tests/` 目录 + CI 配置 |
| 路线图里程碑调整 | 图3 | 项目规划会议决议 |
| 新增 Agent | 图1 业务层 | `packages/packages/agents/` |
