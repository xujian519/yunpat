# YunPat TUI + Rust 网关整体实现规划

> **版本**: v1.0
> **日期**: 2026-05-05
> **目标**: 构建支持自然语言交互的 TUI 环境，用于测试中枢智能体的真实专利业务

---

## 目录

1. [项目背景](#项目背景)
2. [架构设计](#架构设计)
3. [技术选型](#技术选型)
4. [实现阶段](#实现阶段)
5. [风险与应对](#风险与应对)

---

## 项目背景

### 现状分析

| 组件              | 状态    | 说明                 |
| ----------------- | ------- | -------------------- |
| Core 框架         | ✅ 完成 | 五层架构，功能完整   |
| OrchestratorAgent | ✅ 完成 | 5次LLM调用流程       |
| 专业层 Agents     | ✅ 完成 | 28个智能体           |
| Gateway           | ⚠️ 部分 | 有接口但缺少统一网关 |
| CLI               | ⚠️ 基础 | 仅支持简单命令       |
| TUI               | ❌ 缺失 | 无终端用户界面       |
| Docker 构建       | ❌ 失败 | 构建配置不匹配       |

### 核心需求

1. **自然语言交互** - 用户用自然语言描述需求，系统理解并执行
2. **实时状态展示** - 显示意图识别、任务分解、执行进度
3. **HITL 人机协作** - 关键决策点暂停，等待人工审批/修正
4. **会话持久化** - 支持断点恢复、历史回溯
5. **专利业务适配** - 适配专利撰写、分析、答复等复杂业务

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户交互层                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   TUI (Ink)     │  │  CLI (现有)     │  │  HTTP API       │             │
│  │  - 对话面板     │  │  - yunpat 命令  │  │  - REST 接口    │             │
│  │  - 状态面板     │  │                 │  │  - WebSocket    │             │
│  │  - HITL 面板    │  │                 │  │                 │             │
│  │  - 文档面板     │  │                 │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕ WebSocket/SSE
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Rust 统一网关 (新增)                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Axum HTTP 服务器                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ /sessions  │  │/events     │  │/hitl       │  │/documents  │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          核心服务                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │SessionManager│  │HITLManager   │  │EventStreamer │               │   │
│  │  │- 会话创建    │  │- 审批流程    │  │- SSE 推送    │               │   │
│  │  │- 持久化      │  │- 超时处理    │  │- WebSocket   │               │   │
│  │  │- 恢复        │  │- 反馈收集    │  │              │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │PermissionMgr │  │AuditLogger   │  │VersionCtrl   │               │   │
│  │  │- 权限控制    │  │- 操作审计    │  │- 文档版本    │               │   │
│  │  │- 操作鉴权    │  │- 日志查询    │  │- 历史回溯    │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕ HTTP/IPC
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Node.js 业务适配层 (新增)                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      OrchestratorAdapter                             │   │
│  │  - 协议转换 (Rust ↔ Node)                                           │   │
│  │  - 事件转发                                                          │   │
│  │  - 状态同步                                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                         现有业务层 (无修改)                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  OrchestratorAgent                                                  │   │
│  │  - IntentRecognizer (意图识别)                                      │   │
│  │  - TaskPlanner (任务规划)                                           │   │
│  │  - TaskExecutor (任务执行)                                          │   │
│  │  - HITLManager (人机交互)                                           │   │
│  │  - ResultAggregator (结果聚合)                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  专业层 Agents                                                       │   │
│  │  - PatentWriterAgent (专利撰写)                                     │   │
│  │  - PatentAnalyzerAgent (专利分析)                                   │   │
│  │  - PatentResponderAgent (审查答复)                                  │   │
│  │  - PatentSearchAgent (专利检索)                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Core Framework                                                      │   │
│  │  - EventBus, Memory, LLM, Tools, Validation                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 数据流设计

```
用户输入 (自然语言)
    ↓
TUI 捕获输入
    ↓
WebSocket → Rust 网关
    ↓
SessionManager 创建/更新会话
    ↓
HTTP → Node.js Adapter
    ↓
OrchestratorAgent 处理
    │
    ├─ Call 1: 意图识别
    │   ↓
    │   意图事件 → Rust → TUI 显示
    │
    ├─ Call 2: 任务规划
    │   ↓
    │   任务分解事件 → Rust → TUI 显示
    │
    ├─ Call 3: HITL 检查
    │   ↓
    │   HITL 请求 → Rust → TUI 显示审批界面
    │   ↓
    │   用户操作 → Rust → Node.js 继续
    │
    ├─ Call 4: 执行任务
    │   ↓
    │   进度事件 → Rust → TUI 实时更新
    │
    └─ Call 5: 结果聚合
        ↓
        最终结果 → Rust → TUI 显示
```

---

## 技术选型

### Rust 网关技术栈

| 组件       | 技术选择            | 理由                                  |
| ---------- | ------------------- | ------------------------------------- |
| Web 框架   | **Axum 0.8**        | 异步高性能、类型安全、中间件丰富      |
| 实时通信   | **SSE + WebSocket** | SSE 用于事件流、WS 用于双向交互       |
| 序列化     | **Serde**           | Rust 事实标准、性能优异               |
| 异步运行时 | **Tokio**           | 成熟稳定、生态完善                    |
| 数据库     | **SQLite (初期)**   | 零配置、单文件；后期可迁移 PostgreSQL |
| 日志       | **tracing**         | 结构化日志、异步友好                  |

### TUI 技术栈

| 组件     | 技术选择                  | 理由                            |
| -------- | ------------------------- | ------------------------------- |
| 框架     | **Ink 4.x**               | React for CLI、组件化、生态成熟 |
| 状态管理 | **Zustand**               | 轻量简洁、适合 TUI              |
| 样式     | **ink-use-styles**        | 类似 tailwind 的样式方案        |
| 动画     | **ansi-escapes** + 自定义 | 终端动画控制                    |

### 通信协议

```typescript
// 统一事件格式
interface GatewayEvent {
  eventId: string
  sessionId: string
  eventType: 'intent' | 'plan' | 'hitl' | 'progress' | 'result' | 'error'
  timestamp: number
  payload: unknown
}

// 会话消息格式
interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: {
    agent?: string
    stage?: string
    confidence?: number
  }
}
```

---

## 实现阶段

### Phase 1: 基础环境准备 (1 周)

**目标**: 清理现有问题，建立稳定的开发环境

#### 1.1 修复 Docker 构建

```dockerfile
# 修改后的 Dockerfile 关键点
# - 使用 pnpm build:tsc 而不是 esbuild
# - 修正构建产物路径
# - 简化启动命令为 CLI 模式
```

#### 1.2 清理依赖问题

```bash
# 移除未使用的依赖
# 统一 TypeScript 配置
# 修复循环依赖
```

#### 1.3 本地开发环境

```bash
# 确保 pnpm build:tsc 可用
# 确保 pnpm test 可运行
# 添加开发热重载
```

**交付物**:

- ✅ 可构建的 Dockerfile
- ✅ 本地开发脚本
- ✅ 基础测试通过

---

### Phase 2: Rust 网关基础框架 (2 周)

**目标**: 实现网关核心功能，建立通信基础

#### 2.1 项目结构

```
packages/rust-gateway/
├── Cargo.toml
├── src/
│   ├── main.rs              # 服务器入口
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── sessions.rs      # 会话管理 API
│   │   ├── events.rs        # SSE 事件流
│   │   └── hitl.rs          # HITL 接口
│   ├── services/
│   │   ├── mod.rs
│   │   ├── session.rs       # 会话服务
│   │   ├── hitl.rs          # HITL 服务
│   │   ├── event_stream.rs  # 事件流服务
│   │   └── audit.rs         # 审计日志
│   ├── models/
│   │   ├── mod.rs
│   │   ├── session.rs       # 会话模型
│   │   ├── event.rs         # 事件模型
│   │   └── hitl.rs          # HITL 模型
│   └── lib.rs
└── tests/
    └── integration/
```

#### 2.2 核心接口定义

```rust
// 会话管理
POST   /api/v1/sessions              // 创建会话
GET    /api/v1/sessions/:id          // 获取会话
DELETE /api/v1/sessions/:id          // 删除会话

// 事件流
GET    /api/v1/sessions/:id/events   // SSE 事件流

// HITL
POST   /api/v1/sessions/:id/hitl     // 提交 HITL 响应

// Node.js 通信
POST   /api/v1/internal/orchestrate  // 调用 Orchestrator
GET    /api/v1/internal/health       // 健康检查
```

#### 2.3 数据模型

```rust
// 会话状态
#[derive(Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub status: SessionStatus,
    pub context: SessionContext,
    pub messages: Vec<SessionMessage>,
}

#[derive(Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Idle,
    Processing,
    WaitingHITL,
    Completed,
    Error,
}

// HITL 请求
#[derive(Clone, Serialize, Deserialize)]
pub struct HITLRequest {
    pub request_id: String,
    pub session_id: String,
    pub checkpoint_id: String,
    pub content: HITLContent,
    pub options: HITLOptions,
    pub timeout: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct HITLResponse {
    pub request_id: String,
    pub action: HITLAction,
    pub feedback: Option<String>,
    pub corrections: Option<HashMap<String, Value>>,
}
```

**交付物**:

- ✅ Rust 网关基础框架
- ✅ 会话管理 API
- ✅ SSE 事件流
- ✅ 单元测试覆盖

---

### Phase 3: TUI 核心框架 (2 周)

**目标**: 实现基础 TUI 界面，建立与网关的通信

#### 3.1 项目结构

```
packages/tui/
├── package.json
├── src/
│   ├── index.ts              # 入口
│   ├── App.tsx               # 主应用
│   ├── components/
│   │   ├── ChatPanel.tsx     # 对话面板
│   │   ├── StatusPanel.tsx   # 状态面板
│   │   ├── HITLPanel.tsx     # HITL 面板
│   │   ├── DocumentPanel.tsx # 文档面板
│   │   └── InputBar.tsx      # 输入框
│   ├── hooks/
│   │   ├── useSession.ts     # 会话管理
│   │   ├── useEvents.ts      # 事件订阅
│   │   └── useHITL.ts        # HITL 处理
│   ├── services/
│   │   ├── gateway.ts        # 网关客户端
│   │   └── sse.ts            # SSE 客户端
│   └── types/
│       └── index.ts
└── tsconfig.json
```

#### 3.2 核心组件

```typescript
// ChatPanel.tsx - 对话面板
import { Box, Text } from 'ink'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    stage?: string
    confidence?: number
  }
}

export const ChatPanel: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
  return (
    <Box flexDirection="column" padding={1}>
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1}>
          <Text color={msg.role === 'user' ? 'blue' : 'green'}>
            [{msg.role.toUpperCase()}] {msg.content}
          </Text>
          {msg.metadata?.stage && (
            <Text dimColor> ({msg.metadata.stage})</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

// StatusPanel.tsx - 状态面板
interface OrchestratorStatus {
  stage: 'intent' | 'planning' | 'execution' | 'hitl' | 'done'
  intent?: string
  plan?: TaskPlan
  progress: number
  currentAgent?: string
}

export const StatusPanel: React.FC<{ status: OrchestratorStatus }> = ({ status }) => {
  return (
    <Box borderStyle="single" padding={1}>
      <Text bold>执行状态</Text>
      <Box flexDirection="column">
        <Text>阶段: {status.stage}</Text>
        {status.intent && <Text>意图: {status.intent}</Text>}
        {status.currentAgent && <Text>当前: {status.currentAgent}</Text>}
        <Box width={30}>
          <Text>[{'█'.repeat(Math.floor(status.progress * 30))}{'░'.repeat(30 - Math.floor(status.progress * 30))}]</Text>
        </Box>
      </Box>
    </Box>
  )
}
```

#### 3.3 网关通信

```typescript
// gateway.ts - 网关客户端
class GatewayClient {
  private baseUrl: string
  private sessionId: string | null = null

  async createSession(userId: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    const session = await res.json()
    this.sessionId = session.id
    return session
  }

  async sendMessage(message: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/sessions/${this.sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    })
  }

  subscribeEvents(callback: (event: GatewayEvent) => void): EventSource {
    return new EventSource(`${this.baseUrl}/api/v1/sessions/${this.sessionId}/events`)
  }
}
```

**交付物**:

- ✅ TUI 基础框架
- ✅ 四大核心组件
- ✅ 网关通信层
- ✅ 基础交互流程

---

### Phase 4: Orchestrator 集成 (2 周)

**目标**: 连接 TUI、Rust 网关和 OrchestratorAgent

#### 4.1 Node.js 适配器

```typescript
// packages/orchestrator-adapter/src/index.ts
import { OrchestratorAgent } from '@yunpat/orchestrator'
import type { GatewayEvent, SessionMessage } from '@yunpat/gateway-types'

export class OrchestratorAdapter {
  private agent: OrchestratorAgent
  private eventCallback?: (event: GatewayEvent) => void

  constructor(config: OrchestratorAgentConfig) {
    this.agent = new OrchestratorAgent(config)
  }

  async execute(input: string): Promise<AsyncGenerator<GatewayEvent>> {
    const eventQueue: GatewayEvent[] = []

    // 订阅内部事件
    this.agent.on('progress', (data) => {
      eventQueue.push({
        eventId: crypto.randomUUID(),
        sessionId: this.sessionId,
        eventType: 'progress',
        timestamp: Date.now(),
        payload: data,
      })
    })

    // 执行
    await this.agent.execute({ userRequest: input })

    // 返回事件生成器
    return (async function* eventGenerator() {
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!
      }
    })()
  }

  async handleHITLResponse(response: HITLResponse): Promise<void> {
    await this.agent.continueAfterHITL(response)
  }
}
```

#### 4.2 Rust ↔ Node 通信

```rust
// Rust 端 - 调用 Node.js 服务
async fn call_orchestrator(
    session_id: &str,
    message: &str,
) -> Result<OrchestrationResponse, GatewayError> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("http://localhost:3001/internal/orchestrate"))
        .json(&OrchestrationRequest {
            session_id: session_id.to_string(),
            message: message.to_string(),
        })
        .send()
        .await?;

    Ok(response.json().await?)
}
```

```typescript
// Node.js 端 - HTTP 服务
import express from 'express'
import { OrchestratorAdapter } from '@yunpat/orchestrator-adapter'

const app = express()
const adapter = new OrchestratorAdapter(config)

app.post('/internal/orchestrate', async (req, res) => {
  const { session_id, message } = req.body

  // 流式返回事件
  res.setHeader('Content-Type', 'text/event-stream')
  const eventGenerator = await adapter.execute(message)

  for await (const event of eventGenerator) {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  res.end()
})
```

**交付物**:

- ✅ OrchestratorAdapter
- ✅ Node.js HTTP 服务
- ✅ 端到端事件流
- ✅ HITL 双向通信

---

### Phase 5: 测试与优化 (1 周)

**目标**: 完善测试、优化性能、编写文档

#### 5.1 测试计划

```
tests/
├── unit/
│   ├── packages/rust-gateway/
│   │   ├── session_test.rs
│   │   ├── hitl_test.rs
│   │   └── event_stream_test.rs
│   └── typescript/tui/
│       ├── components_test.tsx
│       └── hooks_test.ts
├── integration/
│   ├── e2e/
│   │   ├── basic_flow.test.ts
│   │   ├── hitl_flow.test.ts
│   │   └── patent_writing_flow.test.ts
│   └── performance/
│       └── load_test.rs
└── manual/
    └── test_scenarios.md
```

#### 5.2 性能指标

| 指标     | 目标            | 测量方式   |
| -------- | --------------- | ---------- |
| 消息延迟 | < 100ms         | 端到端计时 |
| 事件吞吐 | > 1000 events/s | 压力测试   |
| 内存占用 | < 200MB (Rust)  | 运行时监控 |
| TUI 帧率 | 30 FPS          | 渲染计时   |

#### 5.3 文档

```
docs/
├── ARCHITECTURE.md      # 架构设计
├── API.md              # API 文档
├── DEPLOYMENT.md        # 部署指南
├── DEVELOPMENT.md       # 开发指南
└── TUTORIAL.md          # 使用教程
```

**交付物**:

- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试通过
- ✅ 性能达标
- ✅ 完整文档

---

## 风险与应对

### 技术风险

| 风险                       | 概率 | 影响 | 应对措施                   |
| -------------------------- | ---- | ---- | -------------------------- |
| Rust 学习曲线              | 中   | 中   | 使用成熟库、参考 claw-code |
| TypeScript ↔ Rust 类型同步 | 高   | 高   | 使用 OpenAPI 生成类型      |
| SSE 连接稳定性             | 中   | 中   | 实现自动重连、心跳检测     |
| 性能瓶颈                   | 低   | 中   | 性能测试、热点优化         |

### 业务风险

| 风险             | 概率 | 影响 | 应对措施                 |
| ---------------- | ---- | ---- | ------------------------ |
| HITL 流程复杂    | 高   | 高   | 简化初始版本、迭代优化   |
| 专利业务理解不足 | 中   | 高   | 与专利专家合作、案例测试 |
| 用户体验不佳     | 中   | 中   | 早期用户测试、快速迭代   |

### 进度风险

| 风险         | 概率 | 影响 | 应对措施               |
| ------------ | ---- | ---- | ---------------------- |
| 工期估算不准 | 中   | 中   | 预留缓冲、分阶段交付   |
| 资源不足     | 低   | 高   | 优先级管理、功能裁剪   |
| 依赖问题     | 中   | 中   | 尽量使用成熟稳定的技术 |

---

## 附录

### A. 参考资料

- [Claude Code 源码](/Users/xujian/projects/归档/claude-code)
- [Claw Code 源码](/Users/xujian/projects/归档/claw-code)
- [Axum 文档](https://docs.rs/axum)
- [Ink 文档](https://github.com/vadimdemedes/ink)

### B. 术语表

| 术语 | 说明                                    |
| ---- | --------------------------------------- |
| TUI  | Terminal User Interface - 终端用户界面  |
| HITL | Human-in-the-Loop - 人机协同            |
| SSE  | Server-Sent Events - 服务器推送事件     |
| MCP  | Model Context Protocol - 模型上下文协议 |

### C. 更新日志

| 版本 | 日期       | 变更     |
| ---- | ---------- | -------- |
| v1.0 | 2026-05-05 | 初始版本 |
