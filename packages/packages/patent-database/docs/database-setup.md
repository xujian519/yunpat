# PatentDB 数据库设置指南

## 概述

`patent_db` 是一个包含 7500 万中国专利数据的 PostgreSQL 数据库。本文档说明如何设置和使用该数据库。

---

## 数据库表结构

### patents 主表

```sql
CREATE TABLE IF NOT EXISTS patents (
  -- 主键和基本信息
  patent_id VARCHAR(100) PRIMARY KEY,        -- 专利号（唯一）
  application_number VARCHAR(100),            -- 申请号

  -- 文本信息（支持全文检索）
  title TEXT,                                 -- 标题
  abstract TEXT,                              -- 摘要
  claims TEXT,                                -- 权利要求
  description TEXT,                           -- 说明书

  -- 著录项目信息
  applicant VARCHAR(500),                     -- 申请人
  inventors TEXT[],                           -- 发明人列表
  assignee VARCHAR(500),                      -- 受让人

  -- 日期信息
  filing_date DATE,                           -- 申请日期
  publication_date DATE,                      -- 公开日期
  priority_date DATE,                         -- 优先权日期

  -- 分类信息
  classification VARCHAR(100),                -- 分类号
  ipc_codes TEXT[],                           -- IPC 分类号列表
  cpc_codes TEXT[],                           -- CPC 分类号列表

  -- 法律状态
  status VARCHAR(50),                         -- 法律状态

  -- 同族和引用
  family_id VARCHAR(100),                     -- 同族 ID
  family_members JSONB,                       -- 同族成员（JSON）
  citations JSONB,                            -- 引用文献（JSON）

  -- 元数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 创建全文索引（GIN 索引）

```sql
-- 创建中文全文搜索索引
CREATE INDEX IF NOT EXISTS idx_patents_title_gin
ON patents USING GIN (to_tsvector('chinese', coalesce(title, '')));

CREATE INDEX IF NOT EXISTS idx_patents_abstract_gin
ON patents USING GIN (to_tsvector('chinese', coalesce(abstract, '')));

CREATE INDEX IF NOT EXISTS idx_patents_description_gin
ON patents USING GIN (to_tsvector('chinese', coalesce(description, '')));

CREATE INDEX IF NOT EXISTS idx_patents_claims_gin
ON patents USING GIN (to_tsvector('chinese', coalesce(claims, '')));

-- 创建组合全文索引
CREATE INDEX IF NOT EXISTS idx_patents_fulltext_gin
ON patents USING GIN (
  to_tsvector('chinese',
    coalesce(title, '') || ' ' ||
    coalesce(abstract, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(claims, '')
  )
);
```

### 创建普通索引

```sql
-- 申请人索引
CREATE INDEX IF NOT EXISTS idx_patents_applicant
ON patents(applicant);

-- 分类号索引
CREATE INDEX IF NOT EXISTS idx_patents_classification
ON patents(classification);

-- 申请日期索引
CREATE INDEX IF NOT EXISTS idx_patents_filing_date
ON patents(filing_date);

-- 公开日期索引
CREATE INDEX IF NOT EXISTS idx_patents_publication_date
ON patents(publication_date);
```

---

## 数据库配置

### 环境变量

```bash
# .env
PATENT_DB_HOST=localhost
PATENT_DB_PORT=5432
PATENT_DB_NAME=patent_db
PATENT_DB_USER=postgres
PATENT_DB_PASSWORD=
PATENT_DB_POOL_SIZE=10
```

### 代码配置

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
    rateLimit: 1.0,
    timeout: 10000,
  },
})
```

---

## 数据导入（可选）

如果你有原始的专利数据（CSV、JSON 等），可以使用以下方法导入：

### 从 CSV 导入

```sql
COPY patents (
  patent_id,
  application_number,
  title,
  abstract,
  applicant,
  filing_date,
  publication_date
)
FROM '/path/to/patents.csv'
DELIMITER ','
CSV HEADER;
```

### 使用 Python 导入

```python
import psycopg2
import pandas as pd

# 连接数据库
conn = psycopg2.connect(
    host='localhost',
    port=5432,
    database='patent_db',
    user='postgres',
    password=''
)

# 读取 CSV
df = pd.read_csv('patents.csv')

# 导入数据
cursor = conn.cursor()
for _, row in df.iterrows():
    cursor.execute("""
        INSERT INTO patents (
          patent_id, title, abstract, applicant,
          filing_date, publication_date
        ) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (patent_id) DO NOTHING
    """, (
        row['patent_id'], row['title'], row['abstract'],
        row['applicant'], row['filing_date'], row['publication_date']
    ))

conn.commit()
```

---

## 测试数据库连接

### 方法 1: 使用 psql

```bash
psql -h localhost -U postgres -d patent_db -c "SELECT COUNT(*) FROM patents;"
```

### 方法 2: 使用 PatentDatabaseAdapter

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
})

// 健康检查
const health = await adapter.healthCheck()
console.log('patent_db:', health.patent_db ? '✓ 正常' : '✗ 异常')

// 测试查询
const results = await adapter.queryByKeywords(['深度学习'], { limit: 5 })
console.log(`找到 ${results.length} 条专利`)

await adapter.close()
```

---

## 常见问题

### Q1: 如何检查表是否存在？

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'patents';
```

### Q2: 如何检查索引是否存在？

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'patents';
```

### Q3: 如何检查全文索引是否生效？

```sql
-- 测试全文搜索
SELECT title, patent_id,
  ts_rank(to_tsvector('chinese', title), query) as rank
FROM patents,
  plainto_tsquery('chinese', '深度学习') query
WHERE to_tsvector('chinese', title) @@ query
ORDER BY rank DESC
LIMIT 10;
```

### Q4: 如何优化查询性能？

```sql
-- 分析表统计信息
ANALYZE patents;

-- 重建索引
REINDEX TABLE patents;

-- 清理表
VACUUM ANALYZE patents;
```

### Q5: 数据库太大怎么办？

```sql
-- 创建分区表（按年份）
CREATE TABLE patents_2024 PARTITION OF patents
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 删除旧数据（保留最近5年）
DELETE FROM patents
WHERE publication_date < CURRENT_DATE - INTERVAL '5 years';
```

---

## 备份和恢复

### 备份

```bash
# 备份整个数据库
pg_dump -h localhost -U postgres patent_db > patent_db_backup.sql

# 仅备份表结构
pg_dump -h localhost -U postgres --schema-only patent_db > patent_db_schema.sql

# 仅备份数据
pg_dump -h localhost -U postgres --data-only patent_db > patent_db_data.sql
```

### 恢复

```bash
# 恢复数据库
psql -h localhost -U postgres patent_db < patent_db_backup.sql
```

---

## 性能监控

### 查看数据库大小

```sql
SELECT
  pg_size_pretty(pg_database_size('patent_db')) as database_size,
  pg_size_pretty(pg_total_relation_size('patents')) as table_size;
```

### 查看慢查询

```sql
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE query LIKE '%patents%'
ORDER BY mean_time DESC
LIMIT 10;
```

### 查看连接数

```sql
SELECT count(*)
FROM pg_stat_activity
WHERE datname = 'patent_db';
```

---

## 相关链接

- **PostgreSQL 文档**: https://www.postgresql.org/docs/
- **全文搜索**: https://www.postgresql.org/docs/current/textsearch.html
- **GIN 索引**: https://www.postgresql.org/docs/current/indexes-types.html#INDEXES-TYPES-GIN
- **主项目**: [YunPat](https://github.com/your-org/yunpat)

---

**版本**: 0.1.0
**更新时间**: 2026-05-05
**维护者**: Claude Code
