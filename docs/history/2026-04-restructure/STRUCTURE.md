# YunPat 智能体框架 - 项目结构

```
yunpat-agent-framework/
│
├── 📄 README.md                    # 项目介绍
├── 📄 PROJECT_SUMMARY.md           # 项目总结
├── 📄 VERIFY.md                    # 验证清单
├── 📄 package.json                 # 根配置
├── 📄 pnpm-workspace.yaml          # Monorepo 配置
├── 📄 tsconfig.base.json           # TypeScript 基础配置
├── 📄 .gitignore
├── 📄 .prettierrc
│
├── 📂 packages/                    # 包目录
│   ├── 📂 core/                    # 🔧 核心框架
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   └── Agent.ts        # 智能体抽象基类
│   │   │   ├── lifecycle/
│   │   │   │   └── Lifecycle.ts    # 生命周期类型定义
│   │   │   ├── eventbus/
│   │   │   │   └── EventBus.ts     # 事件总线实现
│   │   │   ├── memory/
│   │   │   │   └── MemoryStore.ts  # 记忆存储实现
│   │   │   ├── tools/
│   │   │   │   └── ToolRegistry.ts # 工具注册表
│   │   │   ├── llm/
│   │   │   │   └── LLMAdapter.ts   # LLM 适配器
│   │   │   └── index.ts            # 导出
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── 📂 agents/                  # 🤖 智能体
│   │   ├── 📂 writer/              # ✍️ 技术写作助手
│   │   │   ├── src/
│   │   │   │   ├── WriterAgent.ts  # 写作智能体实现
│   │   │   │   └── index.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── 📂 researcher/          # 🔍 研究分析师
│   │       ├── src/
│   │       │   ├── ResearcherAgent.ts # 研究智能体实现
│   │       │   └── index.ts
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   └── 📂 cli/                     # 💻 命令行工具
│       ├── src/
│       │   ├── index.ts            # CLI 入口
│       │   └── commands.ts         # 命令实现
│       ├── package.json
│       └── tsconfig.json
│
└── 📂 examples/                    # 📚 示例代码
    ├── basic-usage.ts              # 基础使用示例
    └── agent-collaboration.ts      # 智能体协作示例

```

## 核心文件说明

### 🎯 核心框架 (`packages/core`)

| 文件              | 职责             | 关键类/接口                                |
| ----------------- | ---------------- | ------------------------------------------ |
| `Agent.ts`        | 智能体抽象基类   | `Agent`, `AgentConfig`                     |
| `Lifecycle.ts`    | 生命周期类型定义 | `ExecutionContext`, `LifecycleStage`       |
| `EventBus.ts`     | 事件总线实现     | `EventBus`, `Subscription`                 |
| `MemoryStore.ts`  | 记忆存储实现     | `ShortTermMemory`, `MemoryManager`         |
| `ToolRegistry.ts` | 工具注册表       | `ToolRegistry`, `BaseTool`                 |
| `LLMAdapter.ts`   | LLM 适配器       | `LangChainAdapter`, `MultiModelLLMAdapter` |

### 🤖 智能体 (`packages/agents`)

| 智能体     | 文件                 | 能力                         |
| ---------- | -------------------- | ---------------------------- |
| Writer     | `WriterAgent.ts`     | 文档生成、格式转换、内容优化 |
| Researcher | `ResearcherAgent.ts` | 信息搜集、数据整理、报告生成 |

### 💻 CLI 工具 (`packages/cli`)

| 命令                 | 功能                 |
| -------------------- | -------------------- |
| `yunpat init`        | 初始化框架           |
| `yunpat run <agent>` | 运行智能体           |
| `yunpat list`        | 列出智能体           |
| `yunpat chat`        | 交互式对话（开发中） |
| `yunpat logs`        | 查看日志（开发中）   |

## 依赖关系

```
┌─────────────────┐
│     CLI         │
└────────┬────────┘
         │
         ├──────────┬──────────┐
         │          │          │
         ▼          ▼          ▼
    ┌────────┐ ┌──────┐ ┌──────────┐
    │ Writer │ │Research│ │   Core   │
    └────────┘ └──────┘ └────┬─────┘
                              │
                    ┌─────────┴─────────┐
                    │   Core Framework  │
                    │  - Agent          │
                    │  - EventBus       │
                    │  - Memory         │
                    │  - Tools          │
                    │  - LLM            │
                    └───────────────────┘
```

## 数据流

```
用户输入
   │
   ▼
┌─────────┐
│   CLI   │
└────┬────┘
     │
     ▼
┌─────────────┐
│   Agent     │
│  execute()  │
└──────┬──────┘
       │
       ├─► before()
       ├─► init()
       ├─► plan() ─────► LLM
       ├─► act() ──────► Tools
       ├─► reflect() ───► LLM
       └─► after()
       │
       ▼
   输出结果
```

## 事件流

```
Agent A                    EventBus                    Agent B
   │                           │                           │
   │  publish(event)           │                           │
   ├──────────────────────────►│                           │
   │                           │                           │
   │                           │  emit(event)              │
   │                           ├──────────────────────────►│
   │                           │                           │
   │                           │  handler(event)           │
   │                           │◄──────────────────────────┤
   │                           │                           │
```

## 扩展指南

### 添加新智能体

1. 在 `packages/agents/` 创建新目录
2. 实现 `Agent` 子类
3. 添加到 CLI 命令列表

```typescript
// packages/agents/myagent/src/MyAgent.ts
import { Agent } from '@yunpat/core'

export class MyAgent extends Agent {
  name = 'my-agent'
  description = '我的智能体'

  protected async plan(input, ctx) {
    /* ... */
  }
  protected async act(plan, ctx) {
    /* ... */
  }
}
```

### 添加新工具

```typescript
import { BaseTool } from '@yunpat/core'

class MyTool extends BaseTool {
  name = 'my-tool'
  description = '我的工具'

  async execute(input: any) {
    // 工具逻辑
    return result
  }
}

// 注册工具
agent.tools.register(new MyTool())
```

### 添加新事件

```typescript
// 订阅事件
agent.on('custom:event', async (event) => {
  console.log('收到自定义事件', event.data)
})

// 发布事件
eventBus.publish({
  type: 'custom:event',
  source: agent.name,
  data: { message: 'Hello' },
  timestamp: new Date(),
})
```
