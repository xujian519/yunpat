# 真实专利数据库集成方案

**更新时间**: 2026-05-05
**数据源**: patent_db（7500万中国专利）+ Google Patents
**状态**: 设计阶段

---

## 数据源概览

### 1. patent_db（本地数据库）

**数据规模**: 7500万中国专利著录项目数据
**存储位置**: 移动硬盘
**数据类型**: 中国专利著录项目

**需要确认的信息**:

```bash
# 请确认以下信息
数据库类型? (MySQL/PostgreSQL/SQLite/其他)
表结构? (patents 表的字段)
访问方式? (直接挂载/网络共享/导入到本地)
字符编码? (UTF-8/GBK/其他)
```

**假设的表结构**（待确认）:

```sql
CREATE TABLE patents (
  id BIGINT PRIMARY KEY,
  application_number VARCHAR(50),
  publication_number VARCHAR(50),
  title VARCHAR(500),
  abstract TEXT,
  applicant VARCHAR(200),
  inventors TEXT,
  application_date DATE,
  publication_date DATE,
  ipc_codes VARCHAR(200),
  cpc_codes VARCHAR(200),
  status VARCHAR(50),
  -- 其他字段...
  INDEX idx_publication_number (publication_number),
  INDEX idx_application_number (application_number),
  INDEX idx_title (title),
  FULLTEXT INDEX idx_abstract (abstract)
);
```

### 2. Google Patents（在线API）

**数据源**: https://patents.google.com
**覆盖范围**: 全球专利（US/CN/EP/JP/KR等）
**API方式**:

- 官方API: Google Patents Public Data（付费）
- 爬虫: 反爬虫限制，不稳定
- 第三方API: 需要评估

**推荐方案**: 使用专利数据库聚合服务

- PatentAPI
- Patsnap
- Soopat
- 专利汇

---

## 集成架构设计

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                  YunPat 智能体平台                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │PatentAnalyzer│  │PatentSearch  │  │PatentResponder│ │
│  │   Agent      │  │   Agent      │  │    Agent      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │          │
│         └─────────────────┴─────────────────┘          │
│                           │                             │
│                   ┌───────▼────────┐                   │
│                   │ PatentDatabase │                   │
│                   │   Adapter      │                   │
│                   └───────┬────────┘                   │
└───────────────────────────┼─────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼───────┐ ┌────▼────┐  ┌──────▼──────┐
    │  patent_db    │ │ SQLite  │  │Google Patents│
    │ (7500万CN专利)│ │ (本地)  │  │  (在线API)   │
    └───────────────┘ └─────────┘  └─────────────┘
```

---

## PatentDatabase Adapter 设计

### 核心接口

```typescript
/**
 * 专利数据库适配器
 * 统一接口访问多个数据源
 */
export class PatentDatabaseAdapter {
  // 数据源列表
  private sources: Map<string, PatentDataSource>

  /**
   * 查询专利（自动选择最优数据源）
   */
  async queryPatents(query: PatentQuery): Promise<PatentRecord[]> {
    // 1. 优先查询本地 patent_db
    // 2. 如果本地数据不足，查询 Google Patents
    // 3. 合并去重结果
  }

  /**
   * 根据公开号查询专利
   */
  async getByPublicationNumber(number: string): Promise<PatentRecord | null> {
    // 优先本地，fallback 到在线
  }

  /**
   * 相似专利检索
   */
  async findSimilar(patent: PatentInfo): Promise<PatentRecord[]> {
    // 使用全文检索 + 向量相似度
  }

  /**
   * 统计分析
   */
  async getStatistics(query: StatisticsQuery): Promise<StatisticsResult> {
    // 专利组合分析、趋势分析
  }
}
```

### 数据源接口

```typescript
/**
 * 专利数据源接口
 */
export interface PatentDataSource {
  /**
   * 数据源名称
   */
  name: string

  /**
   * 数据源类型（local/remote）
   */
  type: 'local' | 'remote'

  /**
   * 查询专利
   */
  query(query: PatentQuery): Promise<PatentRecord[]>

  /**
   * 根据公开号查询
   */
  getByPublicationNumber(number: string): Promise<PatentRecord | null>

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>
}
```

---

## 数据源实现

### 1. PatentDBDataSource（本地7500万专利）

```typescript
/**
 * patent_db 数据源
 */
export class PatentDBDataSource implements PatentDataSource {
  name = 'patent_db'
  type = 'local' as const
  private pool: any // 连接池

  constructor(config: {
    host: string
    port: number
    database: string
    user: string
    password: string
    // 或使用 SQLite
    path?: string
  }) {
    // 根据数据库类型创建连接
    // this.pool = createPool(config)
  }

  async query(query: PatentQuery): Promise<PatentRecord[]> {
    // 构造 SQL 查询
    const sql = this.buildSQL(query)

    // 执行查询
    const results = await this.pool.execute(sql)

    // 转换为标准格式
    return results.map(this.transform)
  }

  async getByPublicationNumber(number: string): Promise<PatentRecord | null> {
    const sql = `
      SELECT * FROM patents
      WHERE publication_number = ?
      LIMIT 1
    `
    const results = await this.pool.execute(sql, [number])
    return results.length > 0 ? this.transform(results[0]) : null
  }

  private buildSQL(query: PatentQuery): string {
    // 根据查询条件构造 SQL
    // 支持关键词、IPC分类、申请人、日期范围等
  }

  private transform(row: any): PatentRecord {
    // 转换数据库行到标准格式
    return {
      publicationNumber: row.publication_number,
      title: row.title,
      abstract: row.abstract,
      applicant: row.applicant,
      // ...
    }
  }
}
```

### 2. GooglePatentsDataSource（在线API）

```typescript
/**
 * Google Patents 数据源
 */
export class GooglePatentsDataSource implements PatentDataSource {
  name = 'google_patents'
  type = 'remote' as const
  private apiKey?: string

  constructor(config: { apiKey?: string }) {
    this.apiKey = config.apiKey
  }

  async query(query: PatentQuery): Promise<PatentRecord[]> {
    // 方案1: 使用官方 API
    if (this.apiKey) {
      return this.queryViaAPI(query)
    }

    // 方案2: 使用爬虫（不推荐）
    // return this.scrape(query)

    // 方案3: 使用第三方聚合服务
    return this.queryViaAggregator(query)
  }

  private async queryViaAPI(query: PatentQuery): Promise<PatentRecord[]> {
    // 调用 Google Patents Public Data API
    const response = await fetch(`https://patents.google.com/api/search?${this.buildParams(query)}`)

    const data = await response.json()
    return data.results.map(this.transform)
  }

  private async queryViaAggregator(query: PatentQuery): Promise<PatentRecord[]> {
    // 使用第三方专利数据聚合服务
    // PatentAPI / Patsnap / Soopat
  }
}
```

---

## 集成步骤

### Phase 1: 评估和准备（1 周）

**任务清单**:

- [ ] 确认 patent_db 数据库类型和表结构
- [ ] 测试数据库连接和查询性能
- [ ] 评估 Google Patents API 方案
- [ ] 设计统一的数据模型

**产出**:

- 数据库连接文档
- 表结构定义
- 数据模型设计

### Phase 2: PatentDBDataSource 实现（1-2 周）

**任务清单**:

- [ ] 实现 PatentDBDataSource 类
- [ ] 支持基本查询（公开号、申请号、关键词）
- [ ] 支持高级查询（IPC分类、申请人、日期范围）
- [ ] 性能优化（索引、连接池、缓存）
- [ ] 单元测试

**产出**:

- PatentDBDataSource 实现
- 测试用例
- 性能报告

### Phase 3: GooglePatentsDataSource 实现（1 周）

**任务清单**:

- [ ] 选择最优 API 方案（官方/第三方）
- [ ] 实现 GooglePatentsDataSource 类
- [ ] 处理 API 限流和错误
- [ ] 单元测试

**产出**:

- GooglePatentsDataSource 实现
- API 使用文档
- 测试用例

### Phase 4: PatentDatabaseAdapter 集成（1 周）

**任务清单**:

- [ ] 实现 PatentDatabaseAdapter 类
- [ ] 智能数据源选择策略
- [ ] 结果合并和去重
- [ ] 缓存机制
- [ ] 集成测试

**产出**:

- PatentDatabaseAdapter 实现
- 集成测试
- 使用文档

### Phase 5: 智能体集成（1-2 周）

**任务清单**:

- [ ] PatentSearchAgent 集成
- [ ] PatentAnalyzerAgent 集成
- [ ] PatentResponderAgent 集成
- [ ] 端到端测试

**产出**:

- 集成真实的智能体
- 端到端测试报告
- 使用示例

---

## 配置示例

### 环境变量

```bash
# .env

# patent_db 配置
PATENT_DB_TYPE=mysql  # 或 postgresql/sqlite
PATENT_DB_HOST=/Volumes/ExternalDrive/patent_db  # 路径或主机
PATENT_DB_PORT=3306
PATENT_DB_NAME=patent_db
PATENT_DB_USER=root
PATENT_DB_PASSWORD=

# Google Patents API（可选）
GOOGLE_PATENTS_API_KEY=your_api_key

# 缓存配置
PATENT_CACHE_ENABLED=true
PATENT_CACHE_TTL=3600
```

### 配置文件

```typescript
// config/patent-database.ts
export const patentDatabaseConfig = {
  sources: [
    {
      name: 'patent_db',
      type: 'local',
      enabled: true,
      priority: 1, // 优先级
      config: {
        type: process.env.PATENT_DB_TYPE,
        host: process.env.PATENT_DB_HOST,
        port: parseInt(process.env.PATENT_DB_PORT || '3306'),
        database: process.env.PATENT_DB_NAME,
        user: process.env.PATENT_DB_USER,
        password: process.env.PATENT_DB_PASSWORD,
      },
    },
    {
      name: 'google_patents',
      type: 'remote',
      enabled: !!process.env.GOOGLE_PATENTS_API_KEY,
      priority: 2, // 备用
      config: {
        apiKey: process.env.GOOGLE_PATENTS_API_KEY,
      },
    },
  ],

  // 缓存配置
  cache: {
    enabled: process.env.PATENT_CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.PATENT_CACHE_TTL || '3600'),
    maxSize: 10000,
  },
}
```

---

## 使用示例

### 基本查询

```typescript
import { PatentDatabaseAdapter } from '@yunpat/patent-database'

// 初始化适配器
const adapter = new PatentDatabaseAdapter(patentDatabaseConfig)

// 查询专利
const patents = await adapter.queryPatents({
  keywords: ['深度学习', '图像识别'],
  limit: 20,
})

console.log(`找到 ${patents.length} 条相关专利`)
```

### 智能体集成

```typescript
// PatentSearchAgent 使用真实数据库
class PatentSearchAgent extends Agent {
  private database: PatentDatabaseAdapter

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
    }
  }
}
```

### PatentAnalyzerAgent 集成

```typescript
// PatentAnalyzerAgent 使用真实数据库进行对比分析
class PatentAnalyzerAgent extends Agent {
  private database: PatentDatabaseAdapter

  async analyzePriorArt(patent: PatentInfo) {
    // 查询相似专利
    const similarPatents = await this.database.findSimilar(patent)

    // 深度分析
    return {
      similarity: this.calculateSimilarity(patent, similarPatents),
      differences: this.identifyDifferences(patent, similarPatents),
      noveltyAssessment: this.assessNovelty(patent, similarPatents),
    }
  }
}
```

---

## 性能优化

### 1. 连接池管理

```typescript
// patent_db 连接池
const pool = mysql.createPool({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  connectionLimit: 10, // 连接池大小
  queueLimit: 50,
})
```

### 2. 查询缓存

```typescript
// Redis 缓存
const cache = new Redis()

async queryWithCache(query: PatentQuery) {
  const cacheKey = this.buildCacheKey(query)

  // 检查缓存
  const cached = await cache.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // 执行查询
  const results = await this.query(query)

  // 写入缓存
  await cache.setex(cacheKey, 3600, JSON.stringify(results))

  return results
}
```

### 3. 批量查询优化

```typescript
// 批量查询（减少网络往返）
async batchQuery(numbers: string[]) {
  const sql = `
    SELECT * FROM patents
    WHERE publication_number IN (${numbers.map(() => '?').join(',')})
  `
  return await this.pool.execute(sql, numbers)
}
```

---

## 数据模型

### PatentRecord 标准格式

```typescript
interface PatentRecord {
  // 基本信息
  publicationNumber: string
  applicationNumber: string
  title: string
  abstract: string

  // 人员信息
  applicant: string
  inventors: string[]
  assignee?: string

  // 日期信息
  applicationDate: string
  publicationDate: string
  priorityDate?: string

  // 分类信息
  ipcCodes: string[]
  cpcCodes?: string[]

  // 法律状态
  status: 'pending' | 'granted' | 'expired' | 'abandoned'

  // 引用信息
  citations?: string[]
  citedBy?: string[]

  // 全文（可选）
  fullText?: string
  claims?: string
  description?: string

  // 元数据
  source: 'patent_db' | 'google_patents'
  retrievedAt: string
}
```

---

## 需要确认的信息

### 关于 patent_db

请提供以下信息，以便精确实现集成：

1. **数据库类型**
   - [ ] MySQL
   - [ ] PostgreSQL
   - [ ] SQLite
   - [ ] 其他

2. **表结构**
   - 表名是什么？（patents / patent_data / 其他）
   - 主要字段有哪些？
   - 有哪些索引？

3. **访问方式**
   - [ ] 直接挂载到文件系统
   - [ ] 网络共享（SMB/NFS）
   - [ ] 导入到本地服务器
   - [ ] 其他

4. **字符编码**
   - [ ] UTF-8
   - [ ] GBK
   - [ ] 其他

5. **性能指标**
   - 查询响应时间（平均）
   - 并发连接数限制
   - 数据库大小

### 关于 Google Patents

1. **API 方案**
   - [ ] 有官方 API key
   - [ ] 使用第三方服务
   - [ ] 使用爬虫（不推荐）

---

## 总结

### 集成方案

✅ **双数据源架构**

- 本地 patent_db（7500万专利）优先
- Google Patents 作为补充

✅ **统一适配器**

- PatentDatabaseAdapter 统一接口
- 智能数据源选择
- 结果合并去重

✅ **性能优化**

- 连接池管理
- 查询缓存
- 批量查询优化

### 实施计划

**总时间**: 5-7 周

**Phase 1**: 评估和准备（1 周）
**Phase 2**: PatentDBDataSource 实现（1-2 周）
**Phase 3**: GooglePatentsDataSource 实现（1 周）
**Phase 4**: PatentDatabaseAdapter 集成（1 周）
**Phase 5**: 智能体集成（1-2 周）

### 下一步行动

1. **确认 patent_db 信息**（数据库类型、表结构、访问方式）
2. **选择 Google Patents API 方案**
3. **创建 PatentDatabaseAdapter 基础框架**
4. **开始实现 PatentDBDataSource**

---

**文档更新时间**: 2026-05-05
**状态**: 设计阶段，等待确认信息
**优先级**: 高（核心基础设施）
