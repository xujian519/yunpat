# Patent Search Agent

**版本**: 3.0.0
**状态**: ✅ 支持真实数据库
**数据源**: PatentDB（7500万CN专利）+ Google Patents（全球专利）

---

## 概述

`@yunpat/agent-search` 提供智能专利检索功能，支持多种版本：

### 版本对比

| 版本   | 特点       | 数据源                    | 推荐使用        |
| ------ | ---------- | ------------------------- | --------------- |
| **v1** | 基础版本   | Google Patents API        | 快速原型        |
| **v2** | 增强版本   | Google Patents + 学术论文 | 一般检索        |
| **v3** | 真实数据库 | PatentDB + Google Patents | **生产环境** ✅ |

---

## PatentSearchAgentV3 - 真实数据库版本

### 特性

✅ **双数据源架构**

- **PatentDB**（本地）: 7500万中国专利，10-100ms 查询响应
- **Google Patents**（在线）: 全球专利覆盖，自动回退

✅ **智能查询策略**

- 中文查询 → 优先 PatentDB（快速）
- 英文查询 → 使用 Google Patents（全球）
- 自动选择最优数据源

✅ **增强功能**

- LLM 驱动的检索策略生成
- 学术论文集成检索
- 申请人/分类号精确查询
- 健康检查和统计分析

---

## 安装

```bash
pnpm install @yunpat/agent-search
```

**依赖**: 需要安装 `@yunpat/patent-database`

```bash
pnpm install @yunpat/patent-database
```

---

## 快速开始

### 1. 配置数据库

**环境变量** (.env):

```bash
# PatentDB 配置
PATENT_DB_HOST=localhost
PATENT_DB_PORT=5432
PATENT_DB_NAME=patent_db
PATENT_DB_USER=postgres
PATENT_DB_PASSWORD=
PATENT_DB_POOL_SIZE=10

# Google Patents 配置
GOOGLE_PATENTS_ENABLED=true
GOOGLE_PATENTS_RATE_LIMIT=1.0
GOOGLE_PATENTS_TIMEOUT=10000

# LLM 配置
ANTHROPIC_API_KEY=your-api-key
```

### 2. 基本使用

```typescript
import { PatentSearchAgentV3 } from '@yunpat/agent-search'
import {
  SimpleEventBus,
  SimpleMemoryStore,
  SimpleToolRegistry,
  ClaudeLLMAdapter,
} from '@yunpat/core'

// 初始化框架组件
const eventBus = new SimpleEventBus()
const memory = new SimpleMemoryStore()
const tools = new SimpleToolRegistry()
const llm = new ClaudeLLMAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
})

// 创建专利检索智能体
const agent = new PatentSearchAgentV3({
  name: 'patent-search-agent',
  description: '专利检索智能体',
  eventBus,
  memory,
  tools,
  llm,
  databaseConfig: {
    patent_db: {
      host: 'localhost',
      port: 5432,
      database: 'patent_db',
      user: 'postgres',
      password: '',
    },
    google_patents: {
      enabled: true,
      rateLimit: 1.0,
      timeout: 10000,
    },
  },
})

// 执行检索
const result = await agent.run(
  {
    title: '基于深度学习的图像识别方法',
    field: '计算机视觉',
    technicalProblem: '传统图像识别方法准确率低',
    technicalSolution: '使用卷积神经网络提取图像特征',
    keyFeatures: ['卷积神经网络', '特征提取', '深度学习'],
  },
  { llm }
)

console.log(`找到 ${result.totalFound} 条专利`)
console.log(`数据来源: ${result.dataSource}`)

await agent.close()
```

---

## API 参考

### PatentSearchAgentV3

**构造函数**:

```typescript
constructor(config: {
  name: string
  description: string
  eventBus: EventBus
  memory: MemoryStore
  tools: ToolRegistry
  llm: LLMAdapter
  databaseConfig?: PatentDatabaseSearchConfig
})
```

**方法**:

- `run(input, context)` - 执行专利检索
- `healthCheck()` - 健康检查
- `getDataSources()` - 获取数据源列表
- `getStatistics()` - 获取统计数据（仅 PatentDB）
- `close()` - 关闭连接

### SearchInput

```typescript
interface SearchInput {
  title: string // 发明名称
  field: string // 技术领域
  technicalProblem: string // 技术问题
  technicalSolution: string // 技术方案
  keyFeatures: string[] // 关键特征
}
```

### SearchOutput

```typescript
interface SearchOutput {
  strategy: SearchStrategy
  results: StandardPatentRecord[]
  totalFound: number
  searchTimeMs: number
  dataSource: 'patent_db' | 'google_patents' | 'mixed'
  academicPapers?: Array<{...}>
}
```

---

## 使用示例

### 示例 1: 中文检索（使用 PatentDB）

```typescript
const result = await agent.run(
  {
    title: '基于区块链的分布式数据存储方法',
    field: '区块链技术',
    technicalProblem: '中心化存储存在单点故障风险',
    technicalSolution: '使用区块链技术实现分布式存储',
    keyFeatures: ['区块链', '分布式存储', '共识机制'],
  },
  { llm }
)

// 中文查询自动使用 PatentDB
console.log(result.dataSource) // 'patent_db'
console.log(`找到 ${result.totalFound} 条中国专利`)
```

### 示例 2: 英文检索（使用 Google Patents）

```typescript
const result = await agent.run(
  {
    title: 'Neural Network Image Recognition',
    field: 'Computer Vision',
    technicalProblem: 'Low accuracy in image recognition',
    technicalSolution: 'Using CNN for feature extraction',
    keyFeatures: ['CNN', 'Deep Learning'],
  },
  { llm }
)

// 英文查询自动使用 Google Patents
console.log(result.dataSource) // 'google_patents'
```

### 示例 3: 仅使用在线数据源

```typescript
const agent = new PatentSearchAgentV3({
  name: 'patent-search-agent',
  description: '专利检索智能体',
  eventBus,
  memory,
  tools,
  llm,
  databaseConfig: {
    // 不配置 patent_db，仅使用 Google Patents
    google_patents: {
      enabled: true,
    },
  },
})
```

---

## 数据库配置

### PatentDB 表结构

详见 [@yunpat/patent-database](../../patent-database/docs/database-setup.md)

关键表：

- `patents` - 主表（7500万条记录）
- 全文索引（GIN）- title, abstract, description, claims
- 普通索引 - applicant, classification, dates

### 创建索引

```sql
-- 全文索引
CREATE INDEX idx_patents_title_gin
ON patents USING GIN (to_tsvector('chinese', coalesce(title, '')));

-- 申请人索引
CREATE INDEX idx_patents_applicant
ON patents(applicant);
```

---

## 性能指标

| 指标             | PatentDB     | Google Patents |
| ---------------- | ------------ | -------------- |
| **查询响应时间** | 10-100ms     | 500-2000ms     |
| **并发连接数**   | 10           | 1（限流）      |
| **数据规模**     | 7500万CN专利 | 全球专利       |
| **离线可用**     | ✅ 是        | ❌ 否          |

---

## 测试

```bash
# 运行测试
pnpm test

# 查看示例
pnpm run example:basic
pnpm run example:env
pnpm run example:online
pnpm run example:full
```

---

## 相关链接

- **主项目**: [YunPat](https://github.com/your-org/yunpat)
- **数据库包**: [@yunpat/patent-database](../../patent-database/)
- **专利工具**: [@yunpat/patent-tools](../../patent-tools/)

---

## 版本历史

### v3.0.0 (2026-05-05)

- ✅ 集成 PatentDatabaseAdapter
- ✅ 支持双数据源（PatentDB + Google Patents）
- ✅ 智能查询策略
- ✅ 健康检查和统计功能

### v2.0.0

- ✅ 集成学术论文检索
- ✅ 增强检索策略生成

### v1.0.0

- ✅ 基础专利检索功能

---

**版本**: 3.0.0
**更新时间**: 2026-05-05
**维护者**: Claude Code
**许可**: MIT
