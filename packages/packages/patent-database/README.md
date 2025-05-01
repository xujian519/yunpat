# Patent Database Adapter

**版本**: 0.1.0  
**状态**: ✅ 核心功能完成  
**数据源**: patent_db (7500万CN专利) + Google Patents

---

## 概述

`@yunpat/patent-database` 提供统一的专利数据库访问接口，支持双数据源：

1. **PatentDB** (PostgreSQL) - 本地7500万中国专利，快速检索
2. **Google Patents** (在线API) - 全球专利，补充数据

---

## 特性

### ✅ 双数据源架构

**智能查询策略**:

- 中文查询 → 优先使用 PatentDB（本地，快速）
- 英文查询 → 使用 Google Patents（在线，全球）
- 精确查询 → PatentDB 优先，Google Patents 回退
- 自动去重和结果合并

### ✅ 高性能检索

**PatentDB (PostgreSQL)**:

- **GIN 全文索引** - 标题、摘要、说明书、权利要求
- **查询响应时间**: 10-100ms（本地网络）
- **连接池管理**: 支持10个并发连接
- **数据规模**: 7500万中国专利

**Google Patents (在线)**:

- **全球专利覆盖**: US/CN/EP/JP/KR等
- **自动限流**: 1请求/秒
- **HTML 解析**: 支持回退解析
- **超时控制**: 5-30秒

### ✅ 统一接口

```typescript
// 一个接口，多个数据源
const adapter = new PatentDatabaseAdapter(config)

// 自动选择最优数据源
const patents = await adapter.queryPatents({
  keywords: ['深度学习', '图像识别'],
  limit: 20,
})
```

---

## 安装

```bash
pnpm install @yunpat/patent-database
```

**重要**: 使用前请先配置 PatentDB 数据库。详见 [数据库设置指南](./docs/database-setup.md)。

---

## 快速开始

### 1. 基本配置

```typescript
import { PatentDatabaseAdapter } from '@yunpat/patent-database'

const adapter = new PatentDatabaseAdapter({
  patent_db: {
    host: 'localhost',
    port: 5432,
    database: 'patent_db',
    user: 'postgres',
    password: '',
    poolSize: 10,
  },
  google_patents: {
    enabled: true,
    rateLimit: 1.0, // 请求/秒
    timeout: 10000, // 10秒
  },
})
```

### 2. 环境变量配置

```bash
# .env
PATENT_DB_HOST=localhost
PATENT_DB_PORT=5432
PATENT_DB_NAME=patent_db
PATENT_DB_USER=postgres
PATENT_DB_PASSWORD=

GOOGLE_PATENTS_ENABLED=true
GOOGLE_PATENTS_RATE_LIMIT=1.0
```

### 3. 查询专利

```typescript
// 关键词查询
const patents = await adapter.queryPatents({
  keywords: ['深度学习', '图像识别'],
  limit: 20,
})

console.log(`找到 ${patents.length} 条相关专利`)
```

---

## API 参考

### PatentDatabaseAdapter

**构造函数**:

```typescript
constructor(config: DataSourceConfig)
```

**方法**:

- `queryPatents(query: PatentQuery)` - 查询专利
- `queryByPublicationNumber(number: string)` - 根据公开号查询
- `queryByApplicant(applicant: string, options?)` - 根据申请人查询
- `queryByKeywords(keywords: string[], options?)` - 关键词查询
- `queryByClassification(classification: string, options?)` - 分类号查询
- `getStatistics()` - 获取统计数据
- `healthCheck()` - 健康检查
- `close()` - 关闭所有连接

### PatentQuery

```typescript
interface PatentQuery {
  keywords?: string[] // 关键词
  publicationNumber?: string // 公开号
  applicant?: string // 申请人
  classification?: string // 分类号
  country?: string // 国家代码
  language?: 'zh' | 'en' // 语言
  startDate?: string // 开始日期
  endDate?: string // 结束日期
  limit?: number // 限制数量
  offset?: number // 偏移量
}
```

### PatentRecord

```typescript
interface PatentRecord {
  publicationNumber: string // 公开号
  applicationNumber?: string // 申请号
  title: string // 标题
  abstract?: string // 摘要
  applicant?: string // 申请人
  inventors?: string[] // 发明人
  publicationDate?: string // 公开日期
  ipcCodes?: string[] // IPC分类号
  status?: string // 法律状态
  claims?: string // 权利要求
  description?: string // 说明书
  source: 'patent_db' | 'google_patents' // 数据来源
  url?: string // 原始URL
  relevanceScore?: number // 相关性评分
}
```

---

## 使用示例

### 示例 1: 关键词检索

```typescript
import { PatentDatabaseAdapter } from '@yunpat/patent-database'

const adapter = new PatentDatabaseAdapter({
  patent_db: {
    host: 'localhost',
    port: 5432,
    database: 'patent_db',
    user: 'postgres',
    password: '',
  },
  google_patents: { enabled: true },
})

// 中文关键词查询（使用 PatentDB）
const patents = await adapter.queryPatents({
  keywords: ['深度学习', '图像识别'],
  limit: 20,
})

patents.forEach((patent) => {
  console.log(`专利号: ${patent.publicationNumber}`)
  console.log(`标题: ${patent.title}`)
  console.log(`申请人: ${patent.applicant}`)
  console.log(`相关性: ${patent.relevanceScore}`)
  console.log('---')
})
```

### 示例 2: 申请人查询

```typescript
// 查询特定申请人的专利
const patents = await adapter.queryByApplicant('腾讯', {
  limit: 50,
  startDate: '2020-01-01',
  endDate: '2024-12-31',
})

console.log(`腾讯在 2020-2024 年间有 ${patents.length} 条专利`)
```

### 示例 3: 精确查询

```typescript
// 根据专利号精确查询
const patents = await adapter.queryByPublicationNumber('CN123456789A')

if (patents.length > 0) {
  const patent = patents[0]
  console.log(`找到专利: ${patent.title}`)
  console.log(`摘要: ${patent.abstract}`)
} else {
  console.log('未找到该专利')
}
```

### 示例 4: 集成到智能体

```typescript
import { PatentSearchAgent } from '@yunpat/agent-search'
import { PatentDatabaseAdapter } from '@yunpat/patent-database'

class PatentSearchAgentWithDB extends PatentSearchAgent {
  private database: PatentDatabaseAdapter

  constructor(config: any) {
    super(config)

    // 初始化数据库适配器
    this.database = new PatentDatabaseAdapter({
      patent_db: config.patent_db,
      google_patents: config.google_patents,
    })
  }

  protected async act(input: SearchInput) {
    // 使用真实数据库检索
    const results = await this.database.queryPatents({
      keywords: input.keyFeatures,
      limit: 20,
    })

    return {
      strategy: this.buildStrategy(input),
      results: results,
      totalFound: results.length,
      searchTimeMs: Date.now() - this.startTime,
    }
  }
}
```

---

## 测试

```bash
# 运行测试
pnpm test

# 运行测试并查看覆盖率
pnpm test:coverage
```

**测试文件**: 1 个

---

## 性能指标

| 指标             | PatentDB (本地) | Google Patents (在线) |
| ---------------- | --------------- | --------------------- |
| **查询响应时间** | 10-100ms        | 500-2000ms            |
| **并发连接数**   | 10              | 1 (限流)              |
| **数据规模**     | 7500万CN专利    | 全球专利              |
| **全文检索**     | ✅ GIN 索引     | ❌ 依赖API            |
| **离线可用**     | ✅ 是           | ❌ 否                 |

---

## 数据库表结构

### patents 主表

| 字段名             | 类型         | 说明           | 索引        |
| ------------------ | ------------ | -------------- | ----------- |
| `patent_id`        | VARCHAR(100) | 专利号（唯一） | ✅ PRIMARY  |
| `title`            | TEXT         | 标题           | ✅ GIN 全文 |
| `abstract`         | TEXT         | 摘要           | ✅ GIN 全文 |
| `claims`           | TEXT         | 权利要求       | ✅ GIN 全文 |
| `description`      | TEXT         | 说明书         | ✅ GIN 全文 |
| `applicant`        | VARCHAR(500) | 申请人         | ✅ 索引     |
| `publication_date` | DATE         | 公开日期       | ✅ 索引     |
| `filing_date`      | DATE         | 申请日期       | ✅ 索引     |
| `classification`   | VARCHAR(100) | 分类号         | ✅ 索引     |

**全文索引**:

- ✅ 标题（title）
- ✅ 摘要（abstract）
- ✅ 说明书（description）
- ✅ 权利要求（claims）

---

## 依赖

- **@yunpat/core** - 核心框架
- **pg** - PostgreSQL 客户端
- **node-fetch** - HTTP 客户端

---

## 相关链接

- **主项目**: [YunPat](https://github.com/your-org/yunpat)
- **核心包**: [@yunpat/core](../../core/)
- **专利检索**: [@yunpat/agent-search](../search/)

---

## 故障排除

### 问题 1: 无法连接到 patent_db

**错误**: `connection refused`

**解决方案**:

1. 检查 PostgreSQL 是否运行: `psql -h localhost -U postgres -d patent_db`
2. 检查环境变量: `echo $PATENT_DB_HOST`
3. 检查防火墙设置

### 问题 2: 查询结果为空

**错误**: 查询返回 0 条结果

**解决方案**:

1. 检查数据库是否有数据: `SELECT COUNT(*) FROM patents;`
2. 检查全文索引是否创建: `SELECT indexname FROM pg_indexes WHERE tablename = 'patents';`
3. 尝试简单的关键词查询

### 问题 3: Google Patents 限流

**错误**: `rate limit exceeded`

**解决方案**:

1. 调整限流配置: `GOOGLE_PATENTS_RATE_LIMIT=0.5`
2. 增加重试机制
3. 使用本地 patent_db 作为主要数据源

---

**版本**: 0.1.0  
**更新时间**: 2026-05-05  
**维护者**: Claude Code  
**许可**: MIT
