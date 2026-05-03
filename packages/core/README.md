# @yunpat/core

YunPat 核心框架 - 专利智能体系统的底层基础设施

## 📖 简介

`@yunpat/core` 是 YunPat 项目的核心框架，提供完整的专利智能体系统基础设施。它基于 **LangChain** 和 **Agent 架构**，实现了智能体的全生命周期管理、多模态交互、安全网关、记忆管理和高级推理能力。

### 核心特性

- **🤖 智能体生命周期管理** - Plan-Act-Reflect 三阶段循环
- **🧠 五层推理架构** - Gateway → Reasoning → LLM → Memory → Tools
- **🔌 多模态交互** - 支持文本、语音、图像、视频、文件
- **🛡️ 安全网关** - 身份认证、权限控制、内容审核、审计日志
- **💾 分层记忆系统** - 短期记忆、长期记忆（向量存储）、检查点管理
- **🎯 任务调度** - 依赖管理、优先级队列、并发控制
- **📊 可观测性** - 指标收集、性能监控、日志管理

---

## 🚀 快速开始

### 安装

```bash
npm install @yunpat/core
# 或
pnpm add @yunpat/core
```

### 基础使用

```typescript
import { Agent, LLMAdapter, ShortTermMemory } from '@yunpat/core'

// 1. 创建 LLM 适配器
const llm = new LLMAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
})

// 2. 创建记忆存储
const memory = new ShortTermMemory()

// 3. 创建智能体
const agent = new Agent({
  name: 'PatentAgent',
  llm,
  memory,
  systemPrompt: '你是一个专业的专利撰写专家',
})

// 4. 运行智能体
const response = await agent.run({
  input: '请帮我撰写一个关于 AI 算法的专利申请',
})

console.log(response.output)
```

---

## 🏗️ 架构概览

### 五层架构

```
┌─────────────────────────────────────────────────┐
│                  Gateway 层                      │
│  多模态输入/输出 | 安全网关 | 人机协同             │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│               Reasoning 层                       │
│   思维链 | 规划器 | 重规划 | 反思机制             │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                 LLM 层                          │
│    模型适配器 | 提示词管理 | 流式输出              │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│               Memory 层                          │
│  短期记忆 | 长期记忆(向量) | 检查点 | 记忆压缩      │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│               Tools 层                           │
│    内置工具 | 自定义工具 | 工具编排               │
└─────────────────────────────────────────────────┘
```

### 智能体生命周期

```typescript
// Plan 阶段：制定计划
const plan = await agent.plan({
  input: '用户输入',
  context: {
    /* 上下文 */
  },
})

// Act 阶段：执行动作
const result = await agent.act({
  plan,
  input: '用户输入',
})

// Reflect 阶段：反思和调整
const reflection = await agent.reflect({
  result,
  plan,
  originalInput: '用户输入',
})
```

---

## 📚 核心模块

### 1. Agent（智能体）

智能体的核心类，提供完整的生命周期管理。

```typescript
import { Agent } from '@yunpat/core'

const agent = new Agent({
  name: 'MyAgent',
  description: '我的智能体',
  llm: llmAdapter,
  memory: memoryStore,
  tools: [tool1, tool2],
  systemPrompt: '系统提示词',
  maxIterations: 10,
  enableReflection: true,
})
```

### 2. LLMAdapter（大模型适配器）

支持多种 LLM 提供商，提供统一的接口。

```typescript
import { LLMAdapter } from '@yunpat/core'

// OpenAI
const openaiLLM = new LLMAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
})

// DeepSeek
const deepseekLLM = new LLMAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
  provider: 'deepseek',
})

// 调用 LLM
const response = await llmAdapter.generate({
  messages: [{ role: 'user', content: '你好' }],
})
```

### 3. Memory（记忆系统）

提供分层记忆管理，包括短期记忆、长期记忆和检查点管理。

```typescript
import { ShortTermMemory, PostgresVectorStore, MemoryLayer } from '@yunpat/core'

// 短期记忆
const shortTermMemory = new ShortTermMemory()
await shortTermMemory.set('context', { topic: '专利撰写' })

// 长期记忆（向量存储）
const longTermMemory = new MemoryLayer({
  databaseUrl: process.env.DATABASE_URL,
  vectorDimension: 1024,
})

await longTermMemory.initialize()

// 搜索相关记忆
const results = await longTermMemory.searchMemories(queryEmbedding, 10, {
  types: ['patent'],
  excludeArchived: true,
})
```

### 4. Gateway（安全网关）

提供身份认证、权限控制、内容审核和审计日志。

```typescript
import { BaseGateway } from '@yunpat/core'
import { RuleBasedModerationService } from '@yunpat/core'

const gateway = new BaseGateway({
  enableAuth: true,
  enableAuthorization: true,
  enableContentFilter: true,
  enableAudit: true,
  mlModerationService: new RuleBasedModerationService(),
  contentFilterRules: [
    {
      name: '禁止暴力内容',
      type: 'keyword',
      content: '暴力',
      action: 'block',
      severity: 'high',
    },
  ],
})

// 过滤内容
const filtered = await gateway.filterContent(userInput)
if (filtered.filtered) {
  console.log('内容被阻止:', filtered.reason)
}
```

### 5. Tools（工具系统）

丰富的内置工具集，支持自定义工具。

```typescript
import { Tool } from '@yunpat/core'

// 创建自定义工具
const calculatorTool: Tool = {
  name: 'calculator',
  description: '执行数学计算',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式',
      },
    },
    required: ['expression'],
  },
  execute: async ({ expression }) => {
    return eval(expression) // 注意：实际应用中需要更安全的实现
  },
}

// 使用工具
const agent = new Agent({
  tools: [calculatorTool],
  // ...
})
```

---

## 🔧 高级功能

### 任务调度

```typescript
import { TaskScheduler } from '@yunpat/core'

const scheduler = new TaskScheduler()

// 添加任务
scheduler.schedule({
  id: 'task1',
  action: async () => {
    console.log('执行任务1')
  },
  dependencies: [], // 无依赖
})

scheduler.schedule({
  id: 'task2',
  action: async () => {
    console.log('执行任务2')
  },
  dependencies: ['task1'], // 依赖 task1
})

// 执行任务
await scheduler.run()
```

### 检查点管理

```typescript
import { CheckpointManager, FileSystemCheckpointStore } from '@yunpat/core'

const checkpointStore = new FileSystemCheckpointStore({
  basePath: './checkpoints',
})

const checkpointManager = new CheckpointManager({
  store: checkpointStore,
  maxCheckpoints: 10,
})

// 保存检查点
await checkpointManager.save({
  agentId: 'agent-1',
  state: {
    /* 智能体状态 */
  },
  timestamp: new Date(),
})

// 恢复检查点
const checkpoint = await checkpointManager.loadLatest('agent-1')
```

### 事件总线

```typescript
import { EventBus } from '@yunpat/core'

const eventBus = new EventBus()

// 订阅事件
eventBus.subscribe('agent.completed', (event) => {
  console.log('智能体完成:', event.data)
})

// 发布事件
eventBus.publish({
  type: 'agent.completed',
  data: { agentId: 'agent-1', result: '成功' },
})
```

---

## 📖 API 文档

详细的 API 文档请参考：

- [Agent API](./docs/api/Agent.md)
- [LLMAdapter API](./docs/api/LLMAdapter.md)
- [Memory API](./docs/api/Memory.md)
- [Gateway API](./docs/api/Gateway.md)
- [Tools API](./docs/api/Tools.md)

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- Agent.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 运行 Vitest UI
npm test -- --ui
```

### 测试覆盖率

| 模块    | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| ------- | -------- | ---------- | ---------- |
| Agent   | 93.50%   | 97.72%     | 83.54%     |
| Gateway | 84.13%   | 82.88%     | 84.74%     |
| Memory  | 65.01%   | 50.35%     | 60.00%     |
| Tools   | 88.50%   | 77.94%     | 92.85%     |

---

## 🔨 开发指南

### 项目结构

```
packages/core/
├── src/
│   ├── agent/           # 智能体核心
│   ├── gateway/         # 安全网关
│   ├── llm/             # LLM 适配器
│   ├── memory/          # 记忆系统
│   ├── reasoning/       # 推理机制
│   ├── tools/           # 工具系统
│   ├── planning/        # 任务调度
│   └── observability/   # 可观测性
├── test/                # 测试文件
└── docs/                # 文档
```

### 开发流程

1. **Fork 项目**

   ```bash
   git clone https://github.com/your-username/YunPat.git
   cd YunPat/packages/core
   ```

2. **安装依赖**

   ```bash
   pnpm install
   ```

3. **运行开发模式**

   ```bash
   pnpm dev
   ```

4. **运行测试**

   ```bash
   pnpm test
   ```

5. **构建**
   ```bash
   pnpm build
   ```

### 代码规范

- 使用 TypeScript 编写
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 编写单元测试
- 添加 JSDoc 注释

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 贡献指南

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)

---

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](../../LICENSE) 文件了解详情。

---

## 🙏 致谢

- [LangChain](https://github.com/langchain-ai/langchain) - 强大的 LLM 应用开发框架
- [Vitest](https://vitest.dev/) - 快速的单元测试框架
- [Drizzle ORM](https://orm.drizzle.team/) - 类型安全的 ORM

---

## 📞 联系方式

- 项目主页: [https://github.com/your-username/YunPat](https://github.com/your-username/YunPat)
- 问题反馈: [GitHub Issues](https://github.com/your-username/YunPat/issues)
- 邮箱: xujian519@gmail.com

---

## 🗺️ 路线图

### v0.2.0 (进行中)

- [ ] 完善长期记忆向量搜索
- [ ] 增强多模态支持
- [ ] 优化性能和内存使用

### v0.3.0 (计划中)

- [ ] 分布式智能体协作
- [ ] 高级推理能力
- [ ] 更多 LLM 提供商支持

---

**Made with ❤️ by YunPat Team**
