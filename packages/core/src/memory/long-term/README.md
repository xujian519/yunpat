# PostgreSQL + pgvector POC 使用指南

## 🚀 快速启动

### 1. 启动 PostgreSQL（Docker）

```bash
cd packages/core/src/memory/long-term
docker-compose up -d
```

### 2. 初始化数据库

```bash
# 连接到数据库
docker exec -it yunpat-postgres psql -U yunpat -d yunpat

# 执行初始化脚本
\i init.sql

# 或直接从命令行执行
psql -U yunpat -d yunpat -f init.sql
```

### 3. 安装依赖

```bash
# 在项目根目录执行
pnpm add drizzle-orm postgres.js
pnpm add -D @types/pg
```

### 4. 配置环境变量

```bash
# .env.local
DATABASE_URL="postgres://yunpat:yunpat123@localhost:5432/yunpat"
TEST_DATABASE_URL="postgres://yunpat:yunpat123@localhost:5432/yunpat_test"
```

## 📝 使用示例

### 基础用法

```typescript
import { MemoryLayer } from '@yunpat/core';

// 创建记忆层实例
const memory = await createMemoryLayer({
  databaseUrl: process.env.DATABASE_URL!,
  vectorDimension: 1024, // BGE-M3
});

// 添加记忆
const memoryId = await memory.addMemory({
  type: 'patent',
  content: '专利 CN123456 涉及人工智能技术',
  embedding: await generateEmbedding('专利 CN123456 涉及人工智能技术'),
  metadata: {
    agent: 'writer',
    tags: ['AI', '专利'],
  },
});

// 搜索记忆
const results = await memory.searchMemories(
  queryEmbedding,
  10,
  { types: ['patent'], tags: ['AI'] }
);

console.log('搜索结果:', results);

// 关闭连接
await memory.close();
```

### 图查询

```typescript
// 创建实体
const patentId = await memory.createEntity({
  type: 'Patent',
  name: 'CN123456',
  properties: { field: 'NLP' },
});

const companyId = await memory.createEntity({
  type: 'Company',
  name: '宝宸科技',
});

// 创建关系
await memory.createRelation({
  fromEntityId: patentId,
  toEntityId: companyId,
  relationType: 'OWNS',
  weight: 0.95,
});

// 查找邻居
const neighbors = await memory.getNeighbors(patentId, 'OWNS');
console.log('相关公司:', neighbors);

// 查找路径
const path = await memory.findShortestPath(personId, companyId, 5);
console.log('最短路径:', path);
```

## 🧪 运行测试

```bash
# 运行所有测试
pnpm test packages/core/src/memory/tests

# 运行特定测试
pnpm test packages/core/src/memory/tests/PostgresVectorStore.test.ts

# 查看覆盖率
pnpm test:coverage
```

## 📊 性能基准

### 预期性能

| 操作 | 数据规模 | 预期延迟 |
|------|---------|---------|
| 向量搜索 | 10 万 | <100ms |
| 向量搜索 | 100 万 | <300ms |
| 批量插入 | 1000 条 | <5s |
| 图路径查询 | 5 跳 | <200ms |

### 性能优化技巧

1. **HNSW 索引调优**
   ```sql
   -- 增加连接数（更精确但更慢）
   SET hnsw.m = 32;

   -- 增加构建参数（更好质量但更慢）
   SET hnsw.ef_construction = 128;
   ```

2. **批量操作**
   ```typescript
   // 批量插入（比单条快 10 倍）
   await memory.addMemories(items);
   ```

3. **元数据预过滤**
   ```typescript
   // 先过滤再计算相似度（快 5 倍）
   const results = await memory.searchMemories(
     queryEmbedding,
     10,
     { types: ['patent'] } // 先缩小范围
   );
   ```

## 🛠️ 故障排查

### 问题 1: pgvector 扩展不存在

```bash
# 错误: extension "vector" does not exist
# 解决: 安装 pgvector 扩展
docker exec -it yunpat-postgres psql -U yunpat -d yunpat -c "CREATE EXTENSION vector;"
```

### 问题 2: HNSW 索引创建失败

```bash
# 错误: method "hnsw" does not exist
# 解决: 确认 pgvector 版本
docker exec -it yunpat-postgres psql -U yunpat -d yunpat -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### 问题 3: 连接超时

```bash
# 错误: Connection terminated
# 解决: 检查数据库状态
docker-compose ps
docker-compose logs postgres
```

## 📚 相关资源

- [pgvector 官方文档](https://github.com/pgvector/pgvector)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [PostgreSQL 性能调优](https://wiki.postgresql.org/wiki/Performance_Optimization)

## 🎯 下一步

- [ ] 集成 BGE-M3 嵌入模型
- [ ] 实现实体自动抽取
- [ ] 添加缓存层（Redis）
- [ ] 实现记忆压缩
- [ ] 性能压测（100 万向量）

## 💬 常见问题

**Q: PostgreSQL 能支撑多少向量数据？**
A: 实测可支撑 100-500 万向量，超过建议迁移到专业向量库（Chroma/Qdrant）。

**Q: 图查询性能如何？**
A: 1-3 跳查询 <100ms，5 跳查询 <500ms。复杂图建议迁移到 Neo4j。

**Q: 如何备份数据？**
A: 使用 `pg_dump`：
```bash
pg_dump -U yunpat -d yunpat > backup.sql
```
