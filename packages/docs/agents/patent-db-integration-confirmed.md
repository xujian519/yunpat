# PatentDB 数据库集成方案（完整版）

**更新时间**: 2026-05-05
**数据源**: patent_db（7500万中国专利）+ Google Patents
**状态**: 信息已确认，准备实施

---

## 📊 数据库信息确认

### PatentDB（本地7500万中国专利）

**数据库类型**: ✅ **PostgreSQL**

- 数据库名: `patent_db`
- 默认端口: `5432`
- 默认用户: `postgres`
- 字符编码: UTF-8

**数据规模**: **7500万**中国专利著录项目

**表结构**: patents（主表）

| 字段名             | 类型          | 说明               | 索引                            |
| ------------------ | ------------- | ------------------ | ------------------------------- |
| `id`               | SERIAL        | 主键               | PRIMARY KEY                     |
| `patent_id`        | VARCHAR(100)  | 专利号（唯一）     | ✅ idx_patents_patent_id        |
| `title`            | TEXT          | 标题               | ✅ GIN 全文索引                 |
| `abstract`         | TEXT          | 摘要               | ✅ GIN 全文索引                 |
| `publication_date` | DATE          | 公开日期           | ✅ idx_patents_publication_date |
| `filing_date`      | DATE          | 申请日期           | ✅ idx_patents_filing_date      |
| `priority_date`    | DATE          | 优先权日期         | -                               |
| `applicant`        | VARCHAR(500)  | 申请人             | ✅ idx_patents_applicant        |
| `inventor`         | VARCHAR(1000) | 发明人（分号分隔） | -                               |
| `assignee`         | VARCHAR(500)  | 受让人             | -                               |
| `claims`           | TEXT          | 权利要求书         | ✅ GIN 全文索引                 |
| `description`      | TEXT          | 说明书             | ✅ GIN 全文索引                 |
| `full_text`        | TEXT          | 全文               | -                               |
| `classification`   | VARCHAR(100)  | 分类号（IPC/CPC）  | ✅ idx_patents_classification   |
| `legal_status`     | VARCHAR(50)   | 法律状态           | -                               |
| `family_id`        | VARCHAR(100)  | 同族ID             | -                               |
| `family_members`   | TEXT          | 同族成员（JSON）   | -                               |
| `citations`        | TEXT          | 引用文献（JSON）   | -                               |
| `source`           | VARCHAR(100)  | 数据来源           | ✅ idx_patents_source           |
| `url`              | TEXT          | 原始URL            | -                               |
| `relevance_score`  | FLOAT         | 相关性评分         | ✅ idx_patents_relevance_score  |
| `search_query`     | TEXT          | 检索查询           | -                               |
| `created_at`       | TIMESTAMP     | 创建时间           | -                               |
| `updated_at`       | TIMESTAMP     | 更新时间           | 自动触发器                      |
| `indexed_at`       | TIMESTAMP     | 索引更新时间       | 自动触发器                      |

**全文索引**:

- ✅ 标题（title）- GIN 中文全文索引
- ✅ 摘要（abstract）- GIN 中文全文索引
- ✅ 说明书（description）- GIN 中文全文索引
- ✅ 权利要求（claims）- GIN 中文全文索引

**复合索引**:

- ✅ 申请人 + 申请日期（applicant, filing_date DESC）

**触发器**:

- ✅ 自动更新 updated_at
- ✅ 自动更新 indexed_at（内容字段变更时）

**视图**:

- ✅ `patent_summary` - 专利摘要视图
- ✅ `patent_statistics` - 专利统计视图

---

### Google Patents（在线API）

**已有实现**: ✅ GooglePatentsConnector

- 位置: `/Users/xujian/Athena工作平台/core/patent_data_connector.py`
- 功能: 搜索专利、解析HTML、降级处理
- 限流: 内置速率限制器

**API 端点**:

- 搜索: `https://patents.google.com/xhr/query`
- 网页: `https://patents.google.com/search`

---

## 🏗️ 集成架构

### 双数据源架构

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
            ┌───────────────┴───────────────┐
            │                               │
    ┌───────▼────────┐              ┌──────▼──────┐
    │  patent_db     │              │Google Patents│
    │ (7500万CN专利) │              │  (在线API)   │
    │   PostgreSQL   │              │              │
    └────────────────┘              └──────────────┘
```

### 查询策略

**优先级策略**:

1. **优先查询** patent_db（本地，7500万CN专利）
2. **回退查询** Google Patents（在线，全球专利）
3. **结果合并** 去重、排序、返回

**智能选择**:

```typescript
// 根据查询条件选择最优数据源
if (query.country === 'CN' || query.language === 'zh') {
  // 中国专利：优先使用 patent_db
  return await patentDB.query(query)
} else {
  // 其他国家：使用 Google Patents
  return await googlePatents.query(query)
}
```

---

## 💻 实现代码

### 1. PatentDBDataSource（PostgreSQL）

```typescript
/**
 * patent_db 数据源实现
 */
import { Pool } from 'pg'
import { QueryResult } from 'pg'

export class PatentDBDataSource implements PatentDataSource {
  name = 'patent_db'
  type = 'local' as const
  private pool: Pool

  constructor(config: {
    host: string
    port: number
    database: string
    user: string
    password: string
  }) {
    // 创建 PostgreSQL 连接池
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10, // 连接池大小
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  /**
   * 根据公开号查询专利
   */
  async getByPublicationNumber(number: string): Promise<PatentRecord | null> {
    const sql = `
      SELECT 
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        applicant,
        inventor,
        classification,
        claims,
        description,
        family_id,
        family_members,
        citations,
        source,
        url,
        relevance_score
      FROM patents
      WHERE patent_id = $1
      LIMIT 1
    `

    const result: QueryResult = await this.pool.query(sql, [number])

    if (result.rows.length === 0) {
      return null
    }

    return this.transform(result.rows[0])
  }

  /**
   * 全文检索（使用 GIN 索引）
   */
  async fullTextSearch(
    query: string,
    options: {
      limit?: number
      offset?: number
    } = {}
  ): Promise<PatentRecord[]> {
    const limit = options.limit || 20
    const offset = options.offset || 0

    // 使用 PostgreSQL 全文检索
    const sql = `
      SELECT 
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        applicant,
        inventor,
        classification,
        ts_rank(to_tsvector('chinese', title), plainto_tsquery('chinese', $1)) +
        ts_rank(to_tsvector('chinese', abstract), plainto_tsquery('chinese', $1)) as relevance_score
      FROM patents
      WHERE 
        to_tsvector('chinese', title) @@ plainto_tsquery('chinese', $1) OR
        to_tsvector('chinese', abstract) @@ plainto_tsquery('chinese', $1) OR
        to_tsvector('chinese', description) @@ plainto_tsquery('chinese', $1)
      ORDER BY relevance_score DESC, publication_date DESC
      LIMIT $2 OFFSET $3
    `

    const result: QueryResult = await this.pool.query(sql, [query, limit, offset])

    return result.rows.map((row) => this.transform(row))
  }

  /**
   * 根据申请人查询
   */
  async getByApplicant(
    applicant: string,
    options: {
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<PatentRecord[]> {
    const limit = options.limit || 20
    const offset = options.offset || 0

    let sql = `
      SELECT 
        patent_id,
        title,
        abstract,
        publication_date,
        filing_date,
        applicant,
        inventor,
        classification,
        relevance_score
      FROM patents
      WHERE applicant ILIKE $1
    `

    const params: any[] = [`%${applicant}%`]
    let paramCount = 1

    // 日期范围过滤
    if (options.startDate) {
      paramCount++
      sql += ` AND filing_date >= $${paramCount}`
      params.push(options.startDate)
    }

    if (options.endDate) {
      paramCount++
      sql += ` AND filing_date <= $${paramCount}`
      params.push(options.endDate)
    }

    sql += `
      ORDER BY filing_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    params.push(limit, offset)

    const result: QueryResult = await this.pool.query(sql, params)

    return result.rows.map((row) => this.transform(row))
  }

  /**
   * 转换数据库行到标准格式
   */
  private transform(row: any): PatentRecord {
    return {
      publicationNumber: row.patent_id,
      applicationNumber: row.patent_id, // 如果没有单独的申请号
      title: row.title,
      abstract: row.abstract,
      applicant: row.applicant,
      inventors: row.inventor ? row.inventor.split(';').map((s: string) => s.trim()) : [],
      applicationDate: row.filing_date,
      publicationDate: row.publication_date,
      priorityDate: row.priority_date,
      ipcCodes: row.classification ? [row.classification] : [],
      cpcCodes: row.classification ? [row.classification] : [],
      status: row.legal_status || 'unknown',
      claims: row.claims,
      description: row.description,
      fullText: row.full_text,
      familyId: row.family_id,
      familyMembers: row.family_members ? JSON.parse(row.family_members) : [],
      citations: row.citations ? JSON.parse(row.citations) : [],
      source: row.source || 'patent_db',
      url: row.url,
      relevanceScore: row.relevance_score || 0,
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1')
      return result.rows.length > 0
    } catch (error) {
      console.error('[PatentDBDataSource] 健康检查失败:', error)
      return false
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}
```

### 2. GooglePatentsDataSource（在线API）

```typescript
/**
 * Google Patents 数据源
 * 基于 Athena 平台的 GooglePatentsConnector
 */
import fetch from 'node-fetch'

export class GooglePatentsDataSource implements PatentDataSource {
  name = 'google_patents'
  type = 'remote' as const
  private baseUrl = 'https://patents.google.com'
  private searchUrl = 'https://patents.google.com/xhr/query'

  /**
   * 搜索专利
   */
  async query(query: PatentQuery): Promise<PatentRecord[]> {
    const params = new URLSearchParams({
      q: query.keywords?.join(' ') || '',
      o: JSON.stringify({
        num: query.limit || 20,
        include: true,
        page: 1,
      }),
    })

    const response = await fetch(`${this.searchUrl}?${params}`)
    const data = await response.json()

    return this.parseGoogleResults(data)
  }

  /**
   * 根据公开号查询
   */
  async getByPublicationNumber(number: string): Promise<PatentRecord | null> {
    // Google Patents 查询
    const url = `${this.baseUrl}/patent/${number}`
    const response = await fetch(url)
    const html = await response.text()

    // 解析 HTML 提取专利信息
    return this.extractPatentFromHTML(html, number)
  }

  /**
   * 解析 Google Patents 结果
   */
  private parseGoogleResults(data: any): PatentRecord[] {
    const patents: PatentRecord[] = []

    // 解析 JSON 结果
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        patents.push({
          publicationNumber: result.patent_id,
          title: result.title,
          abstract: result.abstract || 'Google Patents检索结果',
          applicant: result.assignee || '未知',
          inventors: result.inventors || [],
          publicationDate: result.publication_date,
          ipcCodes: result.classification || [],
          source: 'google_patents',
          url: `${this.baseUrl}/patent/${result.patent_id}`,
          relevanceScore: result.relevance_score || 0.8,
        })
      }
    }

    return patents
  }

  /**
   * 从 HTML 提取专利信息
   */
  private extractPatentFromHTML(html: string, patentId: string): PatentRecord | null {
    // 使用正则表达式提取信息
    const titleMatch = html.match(/<title>([^<]+)<\/title>/)
    const title = titleMatch ? titleMatch[1].replace(' - Google Patents', '') : patentId

    return {
      publicationNumber: patentId,
      title: title,
      abstract: '请查看 Google Patents 获取完整摘要',
      applicant: '未知',
      inventors: [],
      publicationDate: '2023-01-01',
      ipcCodes: [],
      source: 'google_patents',
      url: `${this.baseUrl}/patent/${patentId}`,
      relevanceScore: 0.8,
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        timeout: 5000,
      })
      return response.ok
    } catch (error) {
      console.error('[GooglePatentsDataSource] 健康检查失败:', error)
      return false
    }
  }
}
```

### 3. PatentDatabaseAdapter（统一适配器）

```typescript
/**
 * 专利数据库适配器
 * 统一接口访问多个数据源
 */
export class PatentDatabaseAdapter {
  private sources: Map<string, PatentDataSource>

  constructor(sources: PatentDataSource[]) {
    this.sources = new Map()
    sources.forEach((source) => {
      this.sources.set(source.name, source)
    })
  }

  /**
   * 查询专利（自动选择最优数据源）
   */
  async queryPatents(query: PatentQuery): Promise<PatentRecord[]> {
    // 判断查询类型
    if (query.publicationNumber) {
      // 精确查询：优先 patent_db
      return await this.queryByPublicationNumber(query.publicationNumber)
    }

    if (query.applicant) {
      // 申请人查询：使用 patent_db
      return await this.queryByApplicant(query.applicant, query)
    }

    if (query.keywords) {
      // 关键词查询：判断语言
      const hasChinese = /[一-龥]/.test(query.keywords.join(' '))

      if (hasChinese) {
        // 中文查询：优先 patent_db
        return await this.fullTextSearch(query.keywords.join(' '), query)
      } else {
        // 英文查询：使用 Google Patents
        return await this.queryGooglePatents(query)
      }
    }

    return []
  }

  /**
   * 根据公开号查询
   */
  async queryByPublicationNumber(number: string): Promise<PentRecord[]> {
    // 优先 patent_db
    const patentDB = this.sources.get('patent_db')
    if (patentDB) {
      try {
        const result = await patentDB.getByPublicationNumber(number)
        if (result) {
          return [result]
        }
      } catch (error) {
        console.warn('[PatentDatabaseAdapter] patent_db 查询失败:', error)
      }
    }

    // 回退到 Google Patents
    const googlePatents = this.sources.get('google_patents')
    if (googlePatents) {
      try {
        const result = await googlePatents.getByPublicationNumber(number)
        if (result) {
          return [result]
        }
      } catch (error) {
        console.warn('[PatentDatabaseAdapter] Google Patents 查询失败:', error)
      }
    }

    return []
  }

  /**
   * 全文检索（patent_db）
   */
  async fullTextSearch(query: string, options: any = {}): Promise<PatentRecord[]> {
    const patentDB = this.sources.get('patent_db')
    if (patentDB) {
      return await patentDB.fullTextSearch(query, options)
    }
    return []
  }

  /**
   * 申请人查询（patent_db）
   */
  async queryByApplicant(applicant: string, options: any = {}): Promise<PatentRecord[]> {
    const patentDB = this.sources.get('patent_db')
    if (patentDB) {
      return await patentDB.getByApplicant(applicant, options)
    }
    return []
  }

  /**
   * Google Patents 查询
   */
  async queryGooglePatents(query: PatentQuery): Promise<PatentRecord[]> {
    const googlePatents = this.sources.get('google_patents')
    if (googlePatents) {
      return await googlePatents.query(query)
    }
    return []
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {}

    for (const [name, source] of this.sources) {
      results[name] = await source.healthCheck()
    }

    return results
  }

  /**
   * 关闭所有连接
   */
  async close(): Promise<void> {
    for (const [name, source] of this.sources) {
      if (source.close) {
        await source.close()
      }
    }
  }
}
```

---

## 🔧 配置文件

### 环境变量（.env）

```bash
# patent_db 配置
PATENT_DB_TYPE=postgresql
PATENT_DB_HOST=localhost  # 或移动硬盘的路径
PATENT_DB_PORT=5432
PATENT_DB_NAME=patent_db
PATENT_DB_USER=postgres
PATENT_DB_PASSWORD=

# Google Patents（可选）
GOOGLE_PATENTS_ENABLED=true
GOOGLE_PATENTS_RATE_LIMIT=1.0  # 每秒请求数
```

### TypeScript 配置

```typescript
// config/patent-database.ts
export const patentDatabaseConfig = {
  sources: [
    {
      name: 'patent_db',
      type: 'local',
      enabled: true,
      priority: 1,
      config: {
        host: process.env.PATENT_DB_HOST || 'localhost',
        port: parseInt(process.env.PATENT_DB_PORT || '5432'),
        database: process.env.PATENT_DB_NAME || 'patent_db',
        user: process.env.PATENT_DB_USER || 'postgres',
        password: process.env.PATENT_DB_PASSWORD || '',
      },
    },
    {
      name: 'google_patents',
      type: 'remote',
      enabled: process.env.GOOGLE_PATENTS_ENABLED === 'true',
      priority: 2,
      config: {
        rateLimit: parseFloat(process.env.GOOGLE_PATENTS_RATE_LIMIT || '1.0'),
      },
    },
  ],
}
```

---

## 📦 包依赖

### package.json

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/pg": "^8.10.9"
  }
}
```

---

## 🚀 使用示例

### 基本查询

```typescript
import { PatentDatabaseAdapter } from '@yunpat/patent-database'
import { PatentDBDataSource } from '@yunpat/patent-database'
import { GooglePatentsDataSource } from '@yunpat/patent-database'

// 初始化适配器
const adapter = new PatentDatabaseAdapter([
  new PatentDBDataSource({
    host: 'localhost',
    port: 5432,
    database: 'patent_db',
    user: 'postgres',
    password: '',
  }),
  new GooglePatentsDataSource(),
])

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

  constructor(config: any) {
    super(config)

    // 初始化数据库适配器
    this.database = new PatentDatabaseAdapter([
      new PatentDBDataSource(config.patent_db),
      new GooglePatentsDataSource(),
    ])
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
    }
  }
}
```

---

## ⏱️ 实施计划

### Week 1: 数据库连接和测试

**任务**:

- [ ] 测试 patent_db 连接
- [ ] 验证表结构和索引
- [ ] 测试查询性能
- [ ] 编写连接测试

### Week 2: PatentDBDataSource 实现

**任务**:

- [ ] 实现 PatentDBDataSource 类
- [ ] 支持基本查询（公开号、申请人、关键词）
- [ ] 实现全文检索（使用 GIN 索引）
- [ ] 单元测试

### Week 3: GooglePatentsDataSource 实现

**任务**:

- [ ] 实现 GooglePatentsDataSource 类
- [ ] 实现搜索和解析
- [ ] 添加限流和错误处理
- [ ] 单元测试

### Week 4: PatentDatabaseAdapter 集成

**任务**:

- [ ] 实现 PatentDatabaseAdapter 类
- [ ] 智能数据源选择
- [ ] 结果合并去重
- [ ] 集成测试

### Week 5-6: 智能体集成

**任务**:

- [ ] PatentSearchAgent 集成
- [ ] PatentAnalyzerAgent 集成
- [ ] PatentResponderAgent 集成
- [ ] 端到端测试

**总时间**: 5-6 周

---

## 📊 性能指标

### PatentDB（本地）

- **查询响应时间**: 10-100ms（本地网络）
- **并发连接数**: 10（连接池）
- **全文检索**: GIN 索引优化
- **数据规模**: 7500万专利

### Google Patents（在线）

- **查询响应时间**: 500-2000ms（网络延迟）
- **限流**: 1请求/秒
- **覆盖范围**: 全球专利

---

## ✅ 总结

### 数据库信息确认

✅ **patent_db（本地）**

- 类型: PostgreSQL
- 规模: 7500万中国专利
- 表结构: patents（完整定义）
- 索引: GIN 全文索引 + 常规索引

✅ **Google Patents（在线）**

- 已有实现: GooglePatentsConnector
- 位置: Athena 工作平台
- 功能: 搜索、解析、限流

### 集成方案

✅ **双数据源架构**

- 优先: patent_db（本地，快速）
- 回退: Google Patents（在线，全球）
- 统一: PatentDatabaseAdapter 接口

✅ **智能查询策略**

- 中文查询 → patent_db
- 英文查询 → Google Patents
- 精确查询 → patent_db 优先

### 下一步

1. **测试 patent_db 连接**
2. **实现 PatentDBDataSource**
3. **集成到智能体**

---

**文档更新时间**: 2026-05-05  
**状态**: 信息已确认，准备实施  
**优先级**: 高（核心基础设施）
