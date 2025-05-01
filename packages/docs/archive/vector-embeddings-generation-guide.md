# 向量嵌入生成指南

## 🎯 目标

为 legal_world_model 数据库中的无效决定生成向量嵌入，以激活知识图谱的向量搜索功能。

---

## 📊 当前状态

### 已有数据

| 表名                  | 记录数 | 向量嵌入  | 状态   |
| --------------------- | ------ | --------- | ------ |
| `patent_decisions_v2` | 9,562  | ❌ 未生成 | 待处理 |
| `legal_articles_v2`   | 数千   | ✅ 已有   | 可用   |
| `patent_judgments`    | 数千   | ✅ 已有   | 可用   |

### 目标

为 `patent_decisions_v2` 表中的 9,562 条无效决定生成向量嵌入。

**预期输出**：

- 表名：`patent_decisions_v2_embeddings`
- 记录数：~95,620 条（9,562 × 10 分块）
- 向量维度：1024
- 模型：BGE-M3

---

## 🚀 快速开始

### 方案 1：使用 Python 脚本（推荐）

**步骤 1：安装依赖**

```bash
pip3 install psycopg2-binary sentence-transformers numpy
```

**步骤 2：运行脚本**

```bash
cd /Users/xujian/projects/YunPat
python3 scripts/generate_invalid_decision_embeddings.py
```

**预计时间**：

- 测试模式（10个文档）：~5 分钟
- 完整模式（9,562个文档）：~8 小时

**优点**：

- ✅ 稳定可靠
- ✅ 支持断点续传
- ✅ 批处理优化

### 方案 2：使用 TypeScript 脚本

**步骤 1：测试模式（10个文档）**

```bash
cd /Users/xujian/projects/YunPat
npx tsx scripts/generate-invalid-decision-embeddings-test.ts
```

**步骤 2：完整模式（9,562个文档）**

```bash
npx tsx scripts/generate-invalid-decision-embeddings.ts
```

**预计时间**：

- 测试模式：~10 分钟
- 完整模式：~12 小时

**优点**：

- ✅ TypeScript 原生支持
- ✅ 与项目集成好
- ❌ 速度较慢

---

## 📋 详细步骤（Python 脚本）

### 1. 检查数据库连接

```bash
# 测试连接
psql -h localhost -p 5432 -U postgres -d legal_world_model \
  -c "SELECT COUNT(*) FROM patent_decisions_v2"
```

**预期输出**：9562

### 2. 安装 Python 依赖

```bash
# 创建虚拟环境（可选）
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip3 install psycopg2-binary sentence-transformers numpy
```

### 3. 配置脚本

编辑 `scripts/generate_invalid_decision_embeddings.py`：

```python
CONFIG = {
    'pg_host': 'localhost',
    'pg_port': 5432,
    'pg_database': 'legal_world_model',
    'pg_user': 'postgres',
    'pg_password': 'nxLVXyZ3e87L0kE8Xqx3AB9NK1z74pwOdjugqpc7hc',

    # 测试模式
    'test_mode': True,  # 完整模式改为 False
    'max_documents': 10,  # 完整模式改为 9562

    # 分块配置
    'chunk_size': 500,
    'chunk_overlap': 50,
    'max_chunks': 10,
}
```

### 4. 运行脚本

```bash
# 测试模式
python3 scripts/generate_invalid_decision_embeddings.py
```

**预期输出**：

```
========================================
专利无效决定向量嵌入生成器（Python 版本）
========================================

测试模式: 只处理前 10 个文档

[Step 1] 连接数据库...
✅ 数据库连接成功

[Step 2] 创建向量表...
✅ 向量表创建成功

[Step 3] 加载 BGE-M3 模型...
✅ BGE-M3 模型加载成功

[Step 4] 查询文档...
✅ 找到 10 个文档

[Step 5] 生成向量嵌入...

处理文档 1/10: WX12345
  分块数: 10
  生成向量 1/10... ✅
  生成向量 2/10... ✅
  ...

✅ 向量嵌入生成完成: 100 个向量
   总耗时: 300.5 秒
   平均速度: 0.33 向量/秒

总向量数: 100

========================================
✅ 测试完成！
========================================
```

### 5. 验证结果

```bash
# 检查向量数量
psql -h localhost -U postgres -d legal_world_model \
  -c "SELECT COUNT(*) FROM patent_decisions_v2_embeddings"

# 检查向量维度
psql -h localhost -U postgres -d legal_world_model \
  -c "SELECT vector_dim FROM (
      SELECT array_length(vector, 1) as vector_dim
      FROM patent_decisions_v2_embeddings
      LIMIT 1
    ) t"
```

**预期输出**：

- 向量数量：95620（完整模式）
- 向量维度：1024

### 6. 创建向量索引（可选）

```sql
-- 计算索引参数
SELECT COUNT(*) FROM patent_decisions_v2_embeddings;

-- 创建索引（lists = sqrt(总行数)）
CREATE INDEX idx_patent_decisions_v2_embeddings_vector
ON patent_decisions_v2_embeddings
USING ivfflat (vector vector_cosine_ops)
WITH (lists = 309);  -- sqrt(95620) ≈ 309
```

---

## 🔧 故障排除

### 问题 1：模块未找到

**错误**：`ModuleNotFoundError: No module named 'psycopg2'`

**解决**：

```bash
pip3 install psycopg2-binary
```

### 问题 2：数据库连接失败

**错误**：`connection refused` 或 `password authentication failed`

**解决**：

```bash
# 检查 PostgreSQL 是否运行
brew services list | grep postgresql

# 启动 PostgreSQL
brew services start postgresql@17

# 检查密码
psql -h localhost -U postgres -d legal_world_model
```

### 问题 3：内存不足

**错误**：`MemoryError` 或 `Killed`

**解决**：

- 减小 `batch_size`（默认 100）
- 减小 `max_chunks`（默认 10）
- 使用测试模式

### 问题 4：模型下载慢

**错误**：下载 BGE-M3 模型超时

**解决**：

```bash
# 使用国内镜像
export HF_ENDPOINT=https://hf-mirror.com
python3 scripts/generate_invalid_decision_embeddings.py
```

---

## 📈 性能优化

### 批处理优化

```python
CONFIG = {
    'batch_size': 100,  # 每批处理文档数
    'delay_ms': 1000,   # 批次间延迟（毫秒）
}
```

### 分块优化

```python
CONFIG = {
    'chunk_size': 500,   # 每块字符数
    'chunk_overlap': 50, # 重叠字符数
    'max_chunks': 10,    # 每个文档最大分块数
}
```

### 并行处理（高级）

```python
# 使用多进程
from multiprocessing import Pool

def process_document(doc_id):
    # 处理单个文档
    pass

if __name__ == '__main__':
    with Pool(processes=4) as pool:
        pool.map(process_document, document_ids)
```

---

## ✅ 完成检查清单

- [ ] 数据库连接成功
- [ ] BGE-M3 模型加载成功
- [ ] 向量表创建成功
- [ ] 向量嵌入生成完成
- [ ] 向量数量验证通过（95,620 条）
- [ ] 向量维度验证通过（1024 维）
- [ ] 向量索引创建成功（可选）

---

## 🎯 下一步

向量嵌入生成完成后：

1. **重新测试知识图谱**

   ```bash
   npx tsx scripts/performance-test-knowledge-graph.ts
   ```

2. **验证查询效果**
   - 查询成功率应达到 80%+
   - 平均结果数量应达到 3+ 条
   - 平均相关性应达到 0.7+

3. **测试 Agent 集成**
   - prior-art-search
   - patent-responder
   - claim-generator
   - specification-drafter

---

## 📞 支持

遇到问题？查看：

- [PostgreSQL Client 代码](../packages/unified-knowledge-graph/src/PostgreSQLClient.ts)
- [向量嵌入生成脚本](../scripts/generate_invalid_decision_embeddings.py)
- [性能测试报告](./performance-test-report.md)

---

**文档更新时间**：2026年5月4日
**文档状态**：✅ 就绪
**预计完成时间**：8 小时（完整模式）
