# OMXL 本地模型 - 任务与模型快速参考

## 🎯 任务 → 模型映射表

| 任务类型 | 推荐模型 | API 调用示例 | 速度 | 质量 | 成本 |
|---------|---------|-------------|------|------|------|
| **专利撰写** | Qwen3.5-27B | `createForTask('patent_writing')` | 18 tok/s | ⭐⭐⭐⭐⭐ | 免费 |
| **复杂推理** | Qwen3.5-27B | `createForTask('reasoning_complex')` | 18 tok/s | ⭐⭐⭐⭐⭐ | 免费 |
| **代码生成** | Qwen3.5-27B | `createForTask('code_generation')` | 18 tok/s | ⭐⭐⭐⭐⭐ | 免费 |
| **简单对话** | Gemma-4-9B | `createForTask('chat_simple')` | 50 tok/s | ⭐⭐⭐ | 免费 |
| **文档摘要** | Gemma-4-9B | `createForTask('document_summary')` | 50 tok/s | ⭐⭐⭐ | 免费 |
| **向量嵌入** | BGE-M3 | `new BGEEmbeddingAdapter()` | 快 | ⭐⭐⭐⭐ | 免费 |
| **RAG 重排** | Jina Reranker | `new JinaRerankerAdapter()` | 快 | ⭐⭐⭐⭐⭐ | 免费 |

---

## 📦 模型详细信息

### 1. Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit

**模型 ID**: `Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit`

**特点**:
- 27B 参数，Claude Opus 蒸馏版
- 最强的本地模型
- 适合复杂任务

**使用场景**:
- ✅ 专利撰写（长文本生成）
- ✅ 复杂推理（多步骤逻辑）
- ✅ 代码生成（多种编程语言）
- ✅ 长文档分析

**性能指标**:
- 速度: ~18 tokens/s
- 内存: ~17GB
- 质量: ⭐⭐⭐⭐⭐

**API 调用**:
```typescript
import { OMXLModelFactory, TaskType } from '@yunpat/core';

const llm = OMXLModelFactory.createForTask(TaskType.PATENT_WRITING);
const response = await llm.chat({
  messages: [{ role: 'user', content: '请撰写一份专利申请书' }],
  maxTokens: 4096,
});
```

---

### 2. Gemma-4-e2b-it-4bit

**模型 ID**: `gemma-4-e2b-it-4bit`

**特点**:
- 9B 参数，Google Gemma 系列
- 轻量快速
- 适合简单任务

**使用场景**:
- ✅ 快速对话
- ✅ 简单问答
- ✅ 文档摘要（短文本）
- ✅ 轻量级任务

**性能指标**:
- 速度: ~50 tokens/s
- 内存: ~5GB
- 质量: ⭐⭐⭐

**API 调用**:
```typescript
import { OMXLModelFactory, TaskType } from '@yunpat/core';

const llm = OMXLModelFactory.createForTask(TaskType.CHAT_SIMPLE);
const response = await llm.chat({
  messages: [{ role: 'user', content: '你好' }],
  maxTokens: 200,
});
```

---

### 3. BGE-M3-MLX-8bit

**模型 ID**: `bge-m3-mlx-8bit`

**特点**:
- 专用嵌入模型
- 1024 维向量
- 多语言支持（中英文）

**使用场景**:
- ✅ 文档向量化
- ✅ 语义搜索
- ✅ 文档聚类
- ✅ 相似度计算

**性能指标**:
- 向量维度: 1024
- 速度: 快
- 质量: ⭐⭐⭐⭐

**API 调用**:
```typescript
import { BGEEmbeddingAdapter } from '@yunpat/core';

const bge = new BGEEmbeddingAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
});

// 生成嵌入
const embeddings = await bge.embed(['文本1', '文本2']);

// 计算相似度
const similarity = bge.cosineSimilarity(embeddings[0], embeddings[1]);

// 查找最相似文本
const results = await bge.findMostSimilar('查询文本', candidates, 5);
```

---

### 4. Jina Reranker V3-MLX

**模型 ID**: `jina-reranker-v3-mlx`

**特点**:
- 专用重排序模型
- 提升检索准确率
- 适合 RAG 系统

**使用场景**:
- ✅ RAG 检索后重排序
- ✅ 搜索结果优化
- ✅ 推荐系统
- ✅ 文档精排

**性能指标**:
- 速度: 快
- 质量: ⭐⭐⭐⭐⭐
- 提升: 10-30% 准确率

**API 调用**:
```typescript
import { JinaRerankerAdapter } from '@yunpat/core';

const reranker = new JinaRerankerAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
  topK: 5,
});

// 重排序
const results = await reranker.rerank('查询', documents);

// RAG 管道
const top5 = await reranker.ragPipeline('查询', candidates, 5);
```

---

## 🚀 快速开始

### 1. 环境配置

```bash
# ~/.zshrc
export OMXL_API_KEY="xj781102@"
export OMXL_BASE_URL="http://localhost:8009/v1"
```

### 2. 智能模型选择

```typescript
import { OMXLModelFactory } from '@yunpat/core';

// 自动选择合适的模型
const llm = OMXLModelFactory.selectModel('帮我撰写一份专利申请书');
const response = await llm.chat({
  messages: [{ role: 'user', content: '请开始' }],
});
```

### 3. 完整 RAG 管道

```typescript
import { BGEEmbeddingAdapter } from '@yunpat/core';
import { JinaRerankerAdapter } from '@yunpat/core';
import { OMXLModelFactory } from '@yunpat/core';

// 1. 向量化
const bge = new BGEEmbeddingAdapter({ apiKey: process.env.OMXL_API_KEY });
const embeddings = await bge.embed(documents);

// 2. 检索（相似度计算）
const queryEmbedding = await bge.embedOne(query);
const candidates = findMostSimilar(queryEmbedding, embeddings);

// 3. 重排序
const reranker = new JinaRerankerAdapter({ apiKey: process.env.OMXL_API_KEY });
const top5 = await reranker.rerank(query, candidates, 5);

// 4. 生成答案
const llm = OMXLModelFactory.createForTask('patent_writing');
const answer = await llm.chat({
  messages: [{ role: 'user', content: `基于上下文回答：${top5}` }],
});
```

---

## 📊 性能对比

| 模型 | 参数量 | 速度 | 内存 | 质量 | 适用场景 |
|------|--------|------|------|------|---------|
| Qwen3.5-27B | 27B | 18 tok/s | 17GB | ⭐⭐⭐⭐⭐ | 复杂任务 |
| Gemma-4-9B | 9B | 50 tok/s | 5GB | ⭐⭐⭐ | 简单任务 |
| BGE-M3 | - | 快 | - | ⭐⭐⭐⭐ | 向量化 |
| Jina Reranker | - | 快 | - | ⭐⭐⭐⭐⭐ | 重排序 |

---

## 💡 最佳实践

### 1. 成本优化

```typescript
// 简单任务用小模型
const quickLLM = OMXLModelFactory.createForTask('chat_simple');

// 复杂任务用大模型
const powerfulLLM = OMXLModelFactory.createForTask('patent_writing');

// 两阶段处理
const draft = await quickLLM.chat({ /* ... */ });
const refined = await powerfulLLM.chat({
  messages: [{ role: 'user', content: `优化：${draft}` }],
});
```

### 2. RAG 优化

```typescript
// Broad → Precise 策略
const candidates = await vectorSearch(query, { topK: 20 }); // 宽泛检索
const reranked = await reranker.rerank(query, candidates, { topK: 5 }); // 精确排序
```

### 3. 批量处理

```typescript
// 批量向量化
const embeddings = await bge.embedBatch(documents); // 自动分批

// 批量重排序
const results = await reranker.rerankBatch(queries, documentsList);
```

---

## 🎯 总结

✅ **4 个本地模型** - 覆盖对话、推理、嵌入、重排序
✅ **完全免费** - 无 API 费用
✅ **隐私安全** - 数据不离开本地
✅ **易于集成** - 统一接口，智能选择
✅ **性能优秀** - Qwen3.5-27B 接近云端模型质量

**推荐用法**:
- 专利撰写 → Qwen3.5-27B
- 日常对话 → Gemma-4-9B
- 向量搜索 → BGE-M3
- RAG 优化 → Jina Reranker
