# PostgreSQL 向量存储使用指南

## 概述

YunPat 的 PostgreSQL 向量存储提供了一个高性能的记忆层，支持：

- 向量相似度搜索（基于 pgvector + HNSW 索引）
- 图关系存储（实体和关系）
- 元数据过滤（JSONB）
- 性能监控

## 快速开始

### 1. 启动 PostgreSQL

使用 Docker 快速启动：

```bash
cd packages/core/src/memory/long-term
docker-compose up -d
```

或使用提供的快速启动脚本：

```bash
cd packages/core
./scripts/postgres-setup.sh
```

### 2. 基本使用

```typescript
import { PostgresVectorStore } from './memory/long-term/PostgresVectorStore.js'

// 创建向量存储
const store = new PostgresVectorStore({
  databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
  vectorDimension: 1024, // BGE-M3 默认维度
  enablePerformanceMonitoring: true,
})

await store.initialize()

// 插入记忆
const id = await store.upsert({
  type: 'patent',
  content: '专利撰写的关键在于权利要求书的撰写',
  embedding: embeddingVector, // number[]，长度 1024
  metadata: {
    agent: 'writer',
    tags: ['专利', '撰写'],
  },
})

// 向量搜索
const results = await store.search(queryEmbedding, 10, {
  types: ['patent'],
  agent: 'writer',
})

// 查看性能统计
console.log(store.getPerformanceStats())

await store.close()
```

### 3. 使用 MemoryLayer（推荐）

```typescript
import { MemoryLayer } from './memory/long-term/MemoryLayer.js'

const memoryLayer = new MemoryLayer({
  databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
  vectorDimension: 1024,
})

await memoryLayer.initialize()

// 添加记忆
const memoryId = await memoryLayer.addMemory({
  type: 'conversation',
  content: '用户消息内容',
  embedding: embeddingVector,
  metadata: { userId: 'user123' },
})

// 搜索记忆
const results = await memoryLayer.searchMemories(queryEmbedding, 5)

// 创建图关系
const entityId = await memoryLayer.createEntity({
  type: 'Person',
  name: '张三',
})

await memoryLayer.createRelation({
  fromEntityId: entityId,
  toEntityId: anotherEntityId,
  relationType: 'KNOWS',
  weight: 0.9,
})

// 查找最短路径
const path = await memoryLayer.findShortestPath(entityId, anotherEntityId)

await memoryLayer.close()
```

## 性能优化

### HNSW 索引配置

默认配置（已在 schema.sql 中设置）：

- `m = 16`: 每个节点的连接数
- `ef_construction = 64`: 构建时的候选列表大小

这些配置在召回率和性能之间取得了良好平衡。

### 批量操作

```typescript
// 批量插入（推荐）
const items = Array.from({ length: 10000 }, (_, i) => ({
  type: 'test',
  content: `内容 ${i}`,
  embedding: generateEmbedding(`内容 ${i}`),
}))

await store.upsertBatch(items) // 自动分批，每批 1000 条
```

### 连接池配置

```typescript
const store = new PostgresVectorStore({
  databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
  poolMax: 20, // 最大连接数
  poolIdleTimeout: 20, // 空闲超时（秒）
  poolConnectTimeout: 10, // 连接超时（秒）
})
```

## 性能基准

在我们的测试环境中（MacBook Pro M1，本地 Docker）：

| 操作          | 性能             |
| ------------- | ---------------- |
| 批量插入      | > 1000 vectors/s |
| 1K 向量搜索   | < 10ms           |
| 10K 向量搜索  | < 20ms           |
| 100K 向量搜索 | < 50ms           |

## 测试

### 运行测试

```bash
# 启动 PostgreSQL
cd packages/core/src/memory/long-term
docker-compose up -d

# 初始化测试数据库
docker exec yunpat-postgres psql -U yunpat -c "DROP DATABASE IF EXISTS yunpat_test;"
docker exec yunpat-postgres psql -U yunpat -c "CREATE DATABASE yunpat_test;"
docker exec -i yunpat-postgres psql -U yunpat -d yunpat_test < schema.sql

# 运行测试
cd packages/core
pnpm test postgres-store.integration
```

### 测试覆盖

- ✅ 基本 CRUD 操作
- ✅ 向量相似度搜索
- ✅ 元数据过滤
- ✅ 批量操作性能
- ✅ 图存储基本功能
- ✅ MemoryLayer 集成
- ✅ 边界情况和错误处理

## 故障排除

### 连接问题

```bash
# 检查容器状态
docker ps | grep yunpat-postgres

# 查看日志
docker-compose logs -f postgres

# 测试连接
docker exec yunpat-postgres pg_isready -U yunpat
```

### 性能问题

1. 确保 HNSW 索引已创建：

```sql
SELECT indexname FROM pg_indexes WHERE indexname = 'memories_embedding_hnsw_idx';
```

2. 检查连接池配置：

```typescript
console.log(store.getPerformanceStats())
```

3. 增加工作内存（在 PostgreSQL 中）：

```sql
ALTER SYSTEM SET work_mem = '256MB';
SELECT pg_reload_conf();
```

## 生产环境建议

1. **使用连接池**：配置适当的 `poolMax` 参数
2. **启用性能监控**：设置 `enablePerformanceMonitoring: true`
3. **定期归档**：使用 `archiveOldMemories()` 清理旧数据
4. **备份策略**：定期备份 PostgreSQL 数据
5. **监控指标**：关注查询延迟和连接池使用率

## 相关文档

- [pgvector 文档](https://github.com/pgvector/pgvector)
- [HNSW 算法说明](https://arxiv.org/abs/1603.09320)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
