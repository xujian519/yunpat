# YunPat 开发指南

**版本**: v1.0.0 (专利专业版)
**更新时间**: 2026-04-28

---

## 📚 目录

- [环境搭建](#环境搭建)
- [架构说明](#架构说明)
- [开发流程](#开发流程)
- [测试指南](#测试指南)
- [部署指南](#部署指南)
- [常见问题](#常见问题)

---

## 🚀 环境搭建

### 系统要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Rust**: >= 1.70.0 (可选，用于 Rust 工具)
- **Docker**: >= 20.0.0 (可选，用于容器化部署)

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-org/yunpat.git
cd yunpat
```

#### 2. 安装依赖

```bash
# 安装 pnpm（如果未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

#### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入实际的配置
# 必需配置：
# - DEEPSEEK_API_KEY (DeepSeek API Key)
# - DASHSCOPE_API_KEY (通义千问 API Key，可选)
```

#### 4. 构建项目

```bash
# 构建所有包
pnpm build

# 或使用开发模式（watch 模式）
pnpm dev
```

#### 5. 验证安装

```bash
# 运行 CLI 工具
cd cli/patent-cli
npm install
npm link
patent-cli --version

# 运行示例
node examples/patent-agents-usage.ts
```

---

## 🏗️ 架构说明

### 五层架构

YunPat 采用清晰的五层架构设计：

```
① 交互层 (Gateway) → 多模态输入、HITL、安全网关
         ↓
② 推理层 (Reasoning) → ReAct 循环、推理策略
         ↓
③ 核心引擎 (LLM) → DeepSeek/通义千问/本地模型
         ↓
④ 记忆层 (Memory) → 检查点、时间旅行、断点续传
         ↓
⑤ 工具层 (Tools) → 函数调用、MCP 协议
```

### 目录结构

```
yunpat/
│
├── apps/                    # 应用层
│   ├── patent-writer/       # 专利撰写应用
│   ├── office-action/       # 审查答复应用
│   ├── patent-analyzer/     # 专利分析应用
│   ├── patent-manager/      # 专利管理应用
│   └── client-portal/       # 客户门户
│
├── services/                # 业务逻辑层
│   ├── patent-lifecycle/    # 专利全生命周期
│   ├── workflow-engine/     # 工作流引擎
│   ├── knowledge-base/      # 专利知识库
│   ├── document-service/    # 文档管理
│   └── user-service/        # 用户权限
│
├── ai/                      # AI 能力层
│   ├── agents/              # 智能体
│   │   ├── writer/          # 撰写智能体
│   │   ├── responder/       # 答复智能体
│   │   ├── analyzer/        # 分析智能体
│   │   └── manager/         # 管理智能体
│   ├── retrieval/           # 检索引擎
│   ├── generation/          # 生成引擎
│   ├── knowledge/           # 知识系统
│   ├── rust/                # Rust 工具集成
│   └── mcp/                 # MCP 服务器
│
├── rust/                    # Rust 工具
│   ├── crates/
│   │   ├── patent-tools/    # 专利工具库
│   │   ├── patent-agent/    # 智能体实现
│   │   └── patent-cli/      # CLI 工具
│   └── Cargo.toml
│
├── cli/                     # Node.js CLI
│   └── patent-cli/          # 专利 CLI 工具
│
├── packages/                # 核心框架
│   ├── core/                # 核心框架
│   ├── agents/              # 示例智能体
│   └── cli/                 # 命令行工具
│
├── infrastructure/          # 基础设施层
│   ├── api/                 # API 网关
│   ├── database/            # 数据库
│   ├── queue/               # 消息队列
│   ├── cache/               # 缓存
│   └── monitoring/          # 监控
│
└── docs/                    # 文档
    ├── architecture/        # 架构文档
    ├── api/                 # API 文档
    ├── user-guides/         # 用户指南
    └── business/            # 业务文档
```

### 核心概念

#### 智能体 (Agent)

智能体是 AI 能力层的核心单元，每个智能体负责特定的专利任务：

- **PatentWriterAgent**: 专利撰写（权利要求、说明书、摘要）
- **PatentResponderAgent**: 审查答复（分析审查意见、制定答复策略）
- **PatentAnalyzerAgent**: 专利分析（价值评估、技术趋势、竞品分析）
- **PatentManagerAgent**: 专利管理（期限管理、流程管理、费用管理）

#### 生命周期

所有智能体遵循标准的生命周期：

```typescript
class Agent {
  // 1. 前置钩子（可选）
  protected before?(input, context): Promise<void>

  // 2. 规划阶段（必需）
  protected abstract plan(input, context): Promise<Plan>

  // 3. 执行阶段（必需）
  protected abstract act(plan, context): Promise<Result>

  // 4. 反思阶段（可选）
  protected reflect?(result, context): Promise<Reflection>

  // 5. 后置钩子（可选）
  protected after?(input, output, context): Promise<void>
}
```

#### 通信机制

智能体之间通过事件总线通信，不直接调用：

```typescript
// 订阅事件
this.on('agent:completed', async (event) => {
  // 处理其他智能体的完成事件
})

// 发送消息
await this.send('target-agent', { data: 'message' })
```

---

## 💻 开发流程

### 开发新智能体

#### 1. 创建智能体文件

```bash
# 在 ai/agents/ 下创建新目录
mkdir -p ai/agents/my-agent
cd ai/agents/my-agent
```

#### 2. 实现智能体类

```typescript
// MyAgent.ts
import { Agent, ExecutionContext, Plan, ActionResult } from '@yunpat/core'

export class MyAgent extends Agent<Input, Output> {
  name = 'my-agent'
  description = '我的智能体描述'

  protected async plan(input: Input, context: ExecutionContext): Promise<Plan> {
    // 使用 context.llm 制定计划
    const llmInput = {
      task: input.task,
      context: input.context,
    }

    const plan = await context.llm.generate(llmInput)
    return plan
  }

  protected async act(plan: Plan, context: ExecutionContext): Promise<ActionResult> {
    // 使用 context.tools 调用工具
    const result = await context.tools.call('tool-name', plan.params)
    return result
  }
}
```

#### 3. 注册智能体

```typescript
// ai/agents/index.ts
export { MyAgent } from './my-agent/MyAgent'
```

#### 4. 测试智能体

```typescript
// tests/agents/my-agent.test.ts
import { MyAgent } from '../../ai/agents'

describe('MyAgent', () => {
  it('should execute successfully', async () => {
    const agent = new MyAgent()
    const result = await agent.execute({
      task: '测试任务',
    })
    expect(result).toBeDefined()
  })
})
```

### 开发新工具

#### 1. 创建工具类

```typescript
// tools/MyTool.ts
import { BaseTool } from '@yunpat/core'

export class MyTool extends BaseTool {
  name = 'my-tool'
  description = '我的工具描述'

  async execute(params: any): Promise<any> {
    // 工具逻辑
    return { result: 'success' }
  }
}
```

#### 2. 注册工具

```typescript
// 在智能体中注册
this.tools.register(new MyTool())
```

### 开发 Rust 工具

#### 1. 创建 Rust crate

```bash
cd rust/crates
cargo new --lib my-tool
```

#### 2. 实现工具

```rust
// src/lib.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Input {
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Output {
    pub result: String,
}

pub fn execute(input: Input) -> Result<Output, String> {
    Ok(Output {
        result: format!("Processed: {}", input.data)
    })
}
```

#### 3. 创建 TypeScript 包装器

```typescript
// ai/rust/MyToolRust.ts
import { spawn } from 'child_process'
import { promises as fs } from 'fs'

export class MyToolRust {
  async execute(input: any): Promise<any> {
    // 写入输入文件
    await fs.writeFile('/tmp/input.json', JSON.stringify(input))

    // 调用 Rust 二进制
    const result = spawn('rust-tool', ['--input', '/tmp/input.json'])

    // 读取输出
    const output = await fs.readFile('/tmp/output.json', 'utf-8')
    return JSON.parse(output)
  }
}
```

---

## 🧪 测试指南

### 单元测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm --filter @yunpat/core test

# 运行特定文件
pnpm test MyAgent.test.ts

# 监听模式
pnpm test --watch
```

### 集成测试

```bash
# 运行集成测试
pnpm test:integration

# 运行端到端测试
pnpm test:e2e
```

### 测试覆盖率

```bash
# 生成覆盖率报告
pnpm test:coverage

# 查看 HTML 报告
open coverage/index.html
```

### 手动测试

#### 使用 CLI 工具

```bash
# 链接 CLI 工具
cd cli/patent-cli
npm install
npm link

# 测试各子命令
patent-cli search -k 深度学习 图像识别
patent-cli generate -t method -f "特征1" "特征2"
patent-cli assess claims.json
patent-cli parse office_action.txt
patent-cli interactive
```

#### 使用 MCP 服务器

```typescript
import { createPatentMcpServer } from '@yunpat/mcp'

const server = createPatentMcpServer()
await server.start()

// 测试工具调用
const result = await server.callTool('search_patents', {
  keywords: ['深度学习'],
  limit: 5,
})

console.log(result)

await server.stop()
```

---

## 🚀 部署指南

### 本地部署

#### 1. 使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 2. 手动启动

```bash
# 启动 API 网关
cd infrastructure/api
pnpm start

# 启动各个服务
pnpm --filter @yunpat/patent-lifecycle start
pnpm --filter @yunpat/workflow-engine start
# ... 其他服务

# 启动应用
pnpm --filter @yunpat/patent-writer start
```

### 生产部署

#### 1. 构建生产版本

```bash
# 构建所有包
pnpm build

# 构建特定包
pnpm --filter @yunpat/patent-writer build
```

#### 2. 环境变量配置

确保生产环境配置以下变量：

```bash
# LLM API
DEEPSEEK_API_KEY=sk-...
DASHSCOPE_API_KEY=sk-...

# 数据库
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379

# 服务端口
API_PORT=3000
GATEWAY_PORT=8080

# 安全
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

#### 3. 使用 PM2 管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart all
```

#### 4. 使用 Kubernetes

```bash
# 应用配置
kubectl apply -f k8s/

# 查看状态
kubectl get pods

# 查看日志
kubectl logs -f deployment/patent-writer
```

---

## ❓ 常见问题

### Q1: 如何选择 LLM 模型？

**A**: 优先级如下：

1. **DeepSeek** (推荐) - 性价比高，¥0.001/1k tokens
2. **通义千问** - 分析任务表现优秀
3. **本地 Ollama** - 离线场景，数据隐私

```typescript
import { createDeepSeekModel, createQwenModel, createOllamaModel } from '@yunpat/core'

// 推荐：DeepSeek
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)

// 分析任务：通义千问
const llm = createQwenModel(process.env.DASHSCOPE_API_KEY)

// 离线场景：Ollama
const llm = createOllamaModel('llama2')
```

### Q2: 智能体之间如何通信？

**A**: 通过事件总线，不直接调用：

```typescript
// ✅ 正确：使用事件总线
this.send('target-agent', { data: 'message' })

// ❌ 错误：直接调用
await targetAgent.execute(input)
```

### Q3: 如何调试智能体？

**A**: 使用检查点机制：

```typescript
const memory = new EnhancedMemoryStore(checkpointManager)

// 创建检查点
await memory.createCheckpoint(agentName, executionId, iteration)

// 时间旅行
const timeMachine = memory.getTimeMachine()
await timeMachine.travelBack(checkpointId)
```

### Q4: Rust 工具编译失败怎么办？

**A**: 使用 Node.js 版本作为替代：

```bash
# Node.js CLI 工具（立即可用）
cd cli/patent-cli
npm install
npm link
patent-cli --help
```

### Q5: 如何扩展 MCP 工具？

**A**: 注册自定义工具：

```typescript
server.registerTool(
  {
    name: 'my-tool',
    description: '我的工具',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string' },
      },
    },
  },
  async (params) => {
    // 工具逻辑
    return { result: 'success' }
  }
)
```

---

## 📞 获取帮助

- **文档**: [docs/](./docs/)
- **示例**: [examples/](./examples/)
- **Issues**: [GitHub Issues](https://github.com/your-org/yunpat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/yunpat/discussions)

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
