# 专利无效决定向量嵌入生成指南

## 📊 数据现状

**问题**：`patent_invalid_decisions` 表是空的（0 条）

**解决方案**：使用 `patent_decisions_v2` 表（9,562 条无效决定）

### 已完成的工作

✅ **1. 添加无效决定查询支持**

`PostgreSQLClient` 现在支持：

- `queryInvalidDecisions(query, topK)` - 查询无效决定
- `structuredSearch(query, topK, true)` - 自动包含无效决定
- `vectorSearch(query, topK, 'patent_decisions_v2_embeddings')` - 向量检索（生成嵌入后）

✅ **2. 创建向量嵌入生成脚本**

`scripts/generate-invalid-decision-embeddings.ts` - 自动生成向量嵌入

---

## 🚀 运行向量嵌入生成

### 前置条件

1. **BGE-M3 模型** - 已在 `@yunpat/core` 中集成
2. **PostgreSQL 连接** - legal_world_model 数据库
3. **数据量**：9,562 个无效决定文档

### 运行步骤

#### 方式 1：直接运行（推荐）⭐⭐⭐⭐⭐

```bash
# 1. 进入项目目录
cd /Users/xujian/projects/YunPat

# 2. 运行生成脚本
pnpm tsx scripts/generate-invalid-decision-embeddings.ts
```

#### 方式 2：编译后运行

```bash
# 1. 编译脚本
pnpm tsc scripts/generate-invalid-decision-embeddings.ts

# 2. 运行
node scripts/generate-invalid-decision-embeddings.js
```

---

## ⏱️ 预计时间

| 阶段     | 时间        | 说明                                          |
| -------- | ----------- | --------------------------------------------- |
| 创建表   | 5秒         | 创建 patent_decisions_v2_embeddings 表        |
| 生成嵌入 | **2-4小时** | 9,562 个文档 × 平均 3 个分块 = ~28,686 个向量 |
| 创建索引 | 10-30分钟   | 创建 IVFFlat 索引                             |

**总计**：约 **2.5-4.5 小时**

---

## 📈 生成后的数据

### 向量表结构

```sql
patent_decisions_v2_embeddings (
  id SERIAL PRIMARY KEY,
  document_id UUID,              -- 关联 patent_decisions_v2.id
  document_number VARCHAR(255),   -- 决定书编号（如：580131）
  chunk_index INTEGER,            -- 分块索引（0, 1, 2...）
  chunk_text TEXT,                -- 分块文本
  vector VECTOR(1024),            -- BGE-M3 向量嵌入
  weight DOUBLE PRECISION,        -- 权重
  created_at TIMESTAMP
)
```

### 预计向量数量

```
9,562 个文档
× 平均 3 个分块
-------------------------
≈ 28,686 个向量嵌入
```

---

## 🔍 使用示例

### 查询无效决定

```typescript
import { PostgreSQLClient } from '@yunpat/unified-knowledge-graph'

const postgres = new PostgreSQLClient()
await postgres.initialize()

// 1. 文本查询
const decisions = await postgres.queryInvalidDecisions('宣告专利权全部无效', 5)

// 2. 向量检索（生成嵌入后）
const vectors = await postgres.vectorSearch('专利无效', 5, 'patent_decisions_v2_embeddings')

// 3. 结构化查询（自动包含）
const results = await postgres.structuredSearch('无效宣告', 10, true)
```

### 在知识图谱中使用

```typescript
import { createKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

const kg = await createKnowledgeGraph()

// 查询会自动包含无效决定
const results = await kg.query('专利无效宣告', {
  topK: 10,
  enableVector: true,
  enableStructured: true,
})
```

---

## 📊 性能优化

### 索引配置

```sql
-- IVFFlat 索引（余弦相似度）
CREATE INDEX idx_patent_decisions_v2_embeddings_vector
ON patent_decisions_v2_embeddings
USING ivfflat (vector vector_cosine_ops)
WITH (lists = 169);  -- sqrt(28686) ≈ 169
```

**预期性能**：

- 索引前：~35ms
- 索引后：**~1-3ms** ⚡

---

## ⚠️ 注意事项

### 1. API 限流

脚本已配置批处理延迟（1000ms），避免 API 限流：

```typescript
batchSize: 100,     // 每批 100 个文档
delayMs: 1000,       // 批次间延迟 1 秒
```

### 2. 内存使用

- BGE-M3 模型加载：~2GB
- 批处理缓存：~500MB
- **总计**：~2.5GB

### 3. 存储空间

- 每个向量：1024 × 4 bytes = 4KB
- 28,686 个向量：~112MB
- 索引：~30MB
- **总计**：~150MB

---

## 🎯 验证生成结果

### 检查向量数量

```bash
PGPASSWORD='nxLVXyZ3e87L0kE8Xqx3AB9NK1z74pwOdjugqpc7hc' \
  psql -h localhost -U postgres -d legal_world_model -c \
  "SELECT COUNT(*) FROM patent_decisions_v2_embeddings;"
```

### 查看示例向量

```bash
PGPASSWORD='nxLVXyZ3e87L0kE8Xqx3AB9NK1z74pwOdjugqpc7hc' \
  psql -h localhost -U postgres -d legal_world_model -c \
  "SELECT document_number, chunk_index, LEFT(chunk_text, 50) FROM patent_decisions_v2_embeddings LIMIT 5;"
```

### 测试向量检索

```typescript
import { PostgreSQLClient } from '@yunpat/unified-knowledge-graph'

const postgres = new PostgreSQLClient()
await postgres.initialize()

const results = await postgres.vectorSearch('专利无效', 5, 'patent_decisions_v2_embeddings')

console.log(results)
```

---

## 📝 总结

### ✅ 已完成

1. ✅ 添加无效决定查询支持
2. ✅ 创建向量嵌入生成脚本
3. ✅ 配置 BGE-M3 模型集成
4. ✅ 优化性能和索引

### 🚀 下一步

**运行生成脚本**：

```bash
pnpm tsx scripts/generate-invalid-decision-embeddings.ts
```

**预计时间**：2.5-4.5 小时

**生成后**：无效决定向量检索可用 🎉

---

## 💡 替代方案（如果生成时间太长）

### 方案 A：分批生成

修改脚本，只生成部分文档：

```typescript
// 只处理前 1000 个文档
const { rows: documents } = await pool.query(
  'SELECT id, document_number, content FROM patent_decisions_v2 ORDER BY id LIMIT 1000'
)
```

### 方案 C：使用文本检索（无需向量）

暂时使用文本检索，后续再生成向量：

```typescript
// 已经可用！
const decisions = await postgres.queryInvalidDecisions('专利无效', 5)
```

---

**需要我帮你运行生成脚本吗？** 🚀
