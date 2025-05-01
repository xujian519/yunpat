# PatentManagerAgent - 专利管理智能体

完整的专利全生命周期管理智能体，提供数据库后端、状态机和通知系统。

## 功能特性

### 1. 数据库后端 (`PatentDatabase`)

- 基于 Drizzle ORM + PostgreSQL
- 完整的 CRUD 操作
- 支持专利、截止日期、费用、历史记录、通知配置等表
- 提供统计查询功能

### 2. 专利状态机 (`PatentStateMachine`)

- 完整的专利生命周期状态管理
- 支持的状态：draft → filed → under_exam → oa_issued → amended → allowed → granted
- 状态转换验证和路径查找
- 终态识别和状态描述

### 3. 通知服务 (`NotificationService`)

- 支持多种通知类型：邮件、Webhook、短信、系统消息
- 事件驱动的通知发送
- 可配置的通知模板
- 通知日志和重试机制

## 使用示例

### 基本使用

```typescript
import { PatentManagerAgent } from '@yunpat/agent-patent-manager'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'

// 创建必要的组件
const eventBus = new EventBus()
const memory = new ShortTermMemory()
const tools = new ToolRegistry(eventBus)

// 创建智能体
const agent = new PatentManagerAgent({
  name: 'patent-manager',
  description: '专利管理智能体',
  eventBus,
  memory,
  tools,
  llm: yourLlmAdapter,
  enableNotifications: true,
})

// 添加专利
const result = await agent.execute({
  operation: 'add_patent',
  patent: {
    applicationNumber: 'CN202310000000.0',
    title: '测试专利',
    applicant: '测试公司',
    inventors: ['张三', '李四'],
    patentType: 'invention',
    filingDate: new Date('2023-01-01'),
    status: 'filed',
  },
})

// 查询专利
const patents = await agent.execute({
  operation: 'list_patents',
  query: { status: 'filed' },
})
```

### 状态转换

```typescript
// 变更专利状态
const result = await agent.execute({
  operation: 'change_status',
  applicationNumber: 'CN202310000000.0',
  newStatus: 'under_exam',
})

// 状态机会自动验证转换是否合法
```

### 截止日期管理

```typescript
// 添加截止日期
await agent.execute({
  operation: 'add_deadline',
  applicationNumber: 'CN202310000000.0',
  deadline: {
    type: 'oa_response',
    deadlineDate: new Date('2024-12-31'),
    description: 'OA答复期限',
    priority: 'high',
    completed: false,
  },
})

// 获取即将到期的截止日期
const upcoming = await agent.execute({
  operation: 'get_upcoming_deadlines',
  days: 30,
})
```

### 费用管理

```typescript
// 添加费用记录
await agent.execute({
  operation: 'add_fee',
  applicationNumber: 'CN202310000000.0',
  fee: {
    feeType: '年费',
    amount: 2000,
    currency: 'CNY',
    dueDate: new Date('2024-12-31'),
    status: 'pending',
  },
})

// 获取待支付费用
const pendingFees = await agent.execute({
  operation: 'get_pending_fees',
})
```

### 专利组合概览

```typescript
const portfolio = await agent.execute({
  operation: 'get_portfolio',
})

console.log('总专利数:', portfolio.data.statistics.total)
console.log('风险提示:', portfolio.data.riskAlerts)
```

## 数据库迁移

```bash
# 生成迁移文件
npx drizzle-kit generate

# 应用迁移
npx drizzle-kit migrate

# 打开数据库管理界面
npx drizzle-kit studio
```

## 架构说明

```
packages/agents/patent-manager/
├── src/
│   ├── database/
│   │   ├── schema.ts          # Drizzle ORM schema 定义
│   │   └── PatentDatabase.ts  # 数据库操作层
│   ├── state/
│   │   └── PatentStateMachine.ts  # 状态机实现
│   ├── notifications/
│   │   └── NotificationService.ts # 通知服务
│   ├── types/
│   │   └── PatentTypes.ts     # 类型定义
│   ├── PatentManagerAgent.ts  # 主智能体
│   └── index.ts               # 导出入口
└── test/
    └── patent-manager.test.ts # 单元测试
```

## 实现进度

- [x] 数据库模型定义（Drizzle ORM + PostgreSQL）
- [x] CRUD 操作实现
- [x] 专利生命周期状态机
- [x] 通知系统
- [x] 与现有 Agent 集成
- [x] 单元测试
- [x] TypeScript 类型定义
- [x] 完整的错误处理

## 后续改进方向

1. 添加更多通知渠道（微信、钉钉等）
2. 实现自动提醒任务调度
3. 添加专利文档关联功能
4. 支持批量导入/导出
5. 添加更详细的统计报表
