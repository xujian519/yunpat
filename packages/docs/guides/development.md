# YunPat 开发指南

**版本**: v0.1.0 (开发中)
**更新时间**: 2026-05-04

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
# 运行测试
pnpm test

# 检查构建
pnpm build:tsc
```

---

## 🏗️ 架构说明

### 五层架构

YunPat 采用清晰的五层架构设计：

```
① 交互层 (Gateway) → 多模态输入、HITL、安全网关
         ↓
② 推理层 (Reasoning) → ReAct 循环、PlanAndSolve、思维树、幻觉检测
         ↓
③ 核心引擎 (LLM) → DeepSeek/通义千问/本地模型
         ↓
④ 记忆层 (Memory) → 检查点、时间旅行、断点续传
         ↓
⑤ 工具层 (Tools) → 函数调用、MCP 协议、中间件管道
```

### 项目结构

```
yunpat/
│
├── packages/                    # 核心框架与通用包（pnpm workspace）
│   ├── core/                    # 核心框架（95%完成）
│   │   └── src/
│   │       ├── agent/           # Agent抽象基类（Plan-Execute架构）
│   │       ├── gateway/         # 交互层
│   │       ├── reasoning/       # 推理层（ReAct/PlanAndSolve/ToT）
│   │       ├── llm/             # LLM适配器
│   │       ├── memory/          # 记忆层
│   │       ├── tools/           # 工具层
│   │       └── eventbus/        # 事件总线
│   │
│   ├── orchestrator/            # 智能体编排器（80%完成）
│   │   └── src/
│   │       ├── OrchestratorAgent.ts
│   │       ├── intent/          # 意图识别
│   │       ├── planning/        # 任务规划
│   │       └── routing/         # 智能路由
│   │
│   ├── agents/                  # 通用智能体（30-50%完成）
│   │   ├── writer/
│   │   ├── researcher/
│   │   └── ...
│   │
│   └── patent-tools/            # 专利专用工具
│
├── patents/                     # 专利专用业务逻辑
│   ├── agents/                  # 专业层智能体（Phase 5重构完成）
│   │   ├── writer/              # 专利撰写智能体（85%）
│   │   ├── responder/           # 审查答复智能体（60%）
│   │   ├── analyzer/            # 专利分析智能体（60%）
│   │   └── search/              # 专利检索智能体（50%）
│   │
│   ├── prompts/                 # Prompt模板系统（85%）
│   ├── knowledge/               # Obsidian知识库桥接
│   └── core/                    # Rust桥接层
│
├── test/                        # 测试框架（Phase 6新增）
│   ├── integration/             # 端到端集成测试
│   ├── performance/             # 性能基准测试
│   └── mocks/                   # Mock测试工具
│
├── docker/                      # Docker配置（Phase 6新增）
│   ├── Dockerfile               # 多阶段构建配置
│   └── docker-compose.yml       # 服务编排配置
│
├── docs/                        # 项目文档
│   ├── architecture/            # 架构文档
│   ├── deployment/              # 部署文档（Phase 6新增）
│   └── guides/                  # 开发指南
│
└── examples/                    # 使用示例
```

### 核心概念

#### Agent生命周期（Plan-Execute架构）

所有智能体继承 `Agent` 基类，实现标准生命周期：

```typescript
class Agent<Input, Output> {
  // 必需：规划阶段
  protected abstract async plan(input: Input, context: ExecutionContext): Promise<Plan>

  // 必需：执行阶段
  protected abstract async act(plan: Plan, context: ExecutionContext): Promise<Result>

  // 可选钩子
  protected before?(input, context): Promise<void>
  protected init?(context): Promise<void> // 仅首次
  protected reflect?(result, context): Promise<Reflection>
  protected after?(input, output, context): Promise<void>
}
```

#### 专业层智能体

专业层智能体（patents/agents/）继承ProfessionalAgent基类：

```typescript
class PatentWriterAgent extends ProfessionalAgent {
  protected async plan(input: PatentInput): Promise<PatentPlan> {
    // 使用LLM制定专利撰写计划
  }

  protected async act(plan: PatentPlan): Promise<PatentResult> {
    // 执行专利撰写任务
  }
}
```

#### 智能体编排

OrchestratorAgent负责智能体的编排和协调：

```
用户输入 → 意图识别 → 任务规划 → 智能体路由 → 结果聚合 → 输出
           (Call 1)    (Call 2)    (Call 3-4)     (Call 5)
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
# 在 patents/agents/ 下创建新目录（专业层智能体）
mkdir -p patents/agents/my-agent
cd patents/agents/my-agent
```

#### 2. 实现智能体类

```typescript
// MyAgent.ts
import { ProfessionalAgent } from '@yunpat/core'

export class MyPatentAgent extends ProfessionalAgent<Input, Output> {
  name = 'my-patent-agent'
  description = '我的专利智能体描述'

  protected async plan(input: Input): Promise<Plan> {
    // 使用LLM制定计划
    const prompt = this.buildPrompt(input)
    const response = await this.llm.chat(prompt)
    return this.parsePlan(response)
  }

  protected async act(plan: Plan): Promise<Result> {
    // 执行计划任务
    const results = []
    for (const task of plan.tasks) {
      const result = await this.executeTask(task)
      results.push(result)
    }
    return { results }
  }
}
```

#### 3. 注册智能体

```typescript
// patents/agents/index.ts
export { MyPatentAgent } from './my-agent/MyAgent'
```

#### 4. 测试智能体

```typescript
// test/integration/my-agent.test.ts
import { createTestHelper } from '../helpers/test-setup.js'
import { MyPatentAgent } from '../../patents/agents'

describe('MyPatentAgent', () => {
  it('should execute successfully', async () => {
    const helper = createTestHelper()
    const agent = new MyPatentAgent({...})
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

### 开发通用智能体包

```bash
# 在 packages/agents/ 下创建新包
mkdir -p packages/agents/my-agent
cd packages/agents/my-agent

# 初始化包
pnpm init

# 创建源代码
mkdir src
touch src/MyAgent.ts
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
pnpm --filter @yunpat/core exec vitest run EventBus.test.ts

# 监听模式
pnpm test --watch
```

### 集成测试（Phase 6新增）

```bash
# 运行集成测试
pnpm test:integration

# 运行端到端测试
pnpm test:e2e

# 运行特定集成测试
vitest run test/integration/mock-mechanism-test.test.ts
```

### 性能测试（Phase 6新增）

```bash
# 运行性能基准测试
pnpm test:performance

# 查看性能报告
cat test/performance/results.json
```

### 测试覆盖率

```bash
# 生成覆盖率报告
pnpm test:coverage

# 查看 HTML 报告
open coverage/index.html
```

### 测试框架工具（Phase 6新增）

#### IntegrationTestHelper

```typescript
import { createTestHelper } from './helpers/test-setup.js'

const helper = createTestHelper()

// 设置Orchestrator
const orchestrator = await helper.setupOrchestrator()

// 设置Mock响应
helper.setupMockResponseSequence('DRAFT_FULL')

// 生成测试输入
const input = helper.generatePatentInput()

// 执行测试
const result = await orchestrator.execute(input)

// 断言结果
helper.assertPatentResult(result)
```

#### MockLLMClient

```typescript
import { MockLLMClient } from './mocks/MockLLMClient.js'

const mockLLM = new MockLLMClient()

// 设置响应队列
mockLLM.setResponseQueue([
  { content: '...', usage: {...} },
  { content: '...', usage: {...} },
])

// 检查调用次数
const callCount = mockLLM.getCallCount()
```

---

## 🚀 部署指南

### Docker部署（Phase 6新增）

#### 1. 使用Docker Compose

```bash
# 启动所有服务
make deploy
# 或
docker-compose up -d

# 查看日志
make logs
# 或
docker-compose logs -f

# 查看服务状态
make status

# 停止服务
make stop
```

#### 2. 使用部署脚本

```bash
# 运行部署脚本
./scripts/deploy.sh

# 脚本会自动：
# 1. 构建Docker镜像
# 2. 启动服务
# 3. 健康检查
# 4. 显示服务状态
```

#### 3. 服务编排

Docker Compose包含以下服务：

- **OrchestratorAgent**: 智能体编排器
- **PatentWriterAgent**: 专利撰写智能体
- **PatentResponderAgent**: 审查答复智能体
- **PatentAnalyzerAgent**: 专利分析智能体
- **PatentSearchAgent**: 专利检索智能体
- **Redis**: 缓存服务
- **PostgreSQL**: 数据库
- **Prometheus**: 监控指标收集
- **Grafana**: 监控可视化

### 生产部署

#### 1. 构建生产版本

```bash
# 构建所有包
pnpm build

# 构建Docker镜像
docker build -t yunpat:latest .
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
ORCHESTRATOR_PORT=8080

# 安全
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

#### 3. 健康检查

```bash
# 检查所有服务健康状态
make health

# 检查特定服务
docker-compose ps orchestrator
```

#### 4. 监控

访问Grafana仪表板：

```
http://localhost:3000
默认用户名: admin
默认密码: admin
```

### 开发部署

#### 1. 本地开发模式

```bash
# 启动开发环境
pnpm dev

# 启动特定包
pnpm --filter @yunpat/core dev
```

#### 2. 热重载

```bash
# 使用watch模式
pnpm build:watch

# 测试watch模式
pnpm test --watch
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

### Q4: 如何使用Mock测试？

**A**: 使用MockLLMClient（Phase 6新增）：

```typescript
import { MockLLMClient } from './mocks/MockLLMClient.js'

const mockLLM = new MockLLMClient()
mockLLM.setResponseQueue([
  { content: '...', usage: {...} },
])

// 在测试中使用
const orchestrator = new OrchestratorAgent({
  llmClient: mockLLM,
  // ...其他配置
})
```

### Q5: Docker部署失败怎么办？

**A**: 检查以下几点：

```bash
# 1. 检查Docker是否运行
docker ps

# 2. 检查端口占用
netstat -tuln | grep 3000

# 3. 查看日志
docker-compose logs orchestrator

# 4. 重启服务
make restart
```

---

## 📞 获取帮助

- **文档**: [docs/](./docs/)
- **架构文档**: [docs/architecture/](./docs/architecture/)
- **部署文档**: [docs/deployment/](./docs/deployment/)
- **示例**: [examples/](./examples/)
- **Issues**: [GitHub Issues](https://github.com/xujian519/yunpat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/xujian519/yunpat/discussions)

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
