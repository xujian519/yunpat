# OMXL 本地模型使用指南

## 可用模型清单

### 1. Gemma-4-9B (gemma-4-e2b-it-4bit)
- **参数量**: 9B
- **量化**: 4-bit
- **内存占用**: ~5GB
- **速度**: ⚡⚡⚡⚡⚡ 最快
- **能力**: ⭐⭐⭐ 中等

**适用场景**:
- ✅ 快速对话、闲聊
- ✅ 简单问答
- ✅ 文档摘要（短文本）
- ✅ 轻量级任务

**不推荐**:
- ❌ 复杂推理
- ❌ 长文本生成
- ❌ 专业领域任务

---

### 2. Qwen3.5-27B-Claude-4.6-Opus-Distilled (Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit)
- **参数量**: 27B
- **量化**: 4-bit
- **内存占用**: ~17GB
- **速度**: ⚡⚡⚡ 中等
- **能力**: ⭐⭐⭐⭐⭐ 最强

**适用场景**:
- ✅ 复杂推理任务
- ✅ 长文本生成（专利撰写、报告）
- ✅ 代码生成与分析
- ✅ 多轮对话
- ✅ 专业领域任务

**推荐指数**: ⭐⭐⭐⭐⭐

---

### 3. BGE-M3 (bge-m3-mlx-8bit)
- **类型**: 嵌入模型
- **量化**: 8-bit
- **向量维度**: 1024
- **特点**: 多语言支持

**适用场景**:
- ✅ 文档向量化
- ✅ 语义搜索
- ✅ 文档聚类
- ✅ 相似度计算
- ✅ RAG 检索

**输出**: 1024 维向量

---

### 4. Jina Reranker V3 (jina-reranker-v3-mlx)
- **类型**: 重排序模型
- **功能**: 文档相关性重排

**适用场景**:
- ✅ RAG 检索后重排序
- ✅ 搜索结果优化
- ✅ 推荐系统
- ✅ 文档精排

**输入**: 查询 + 文档列表
**输出**: 重排序后的文档 + 相关性分数

---

## 任务与模型匹配表

| 任务类型 | 推荐模型 | 备选方案 | 成本 | 速度 |
|---------|---------|---------|------|------|
| **专利撰写** | Qwen3.5-27B | DeepSeek Chat | 免费 | 中 |
| **简单对话** | Gemma-4-9B | - | 免费 | 快 |
| **复杂推理** | Qwen3.5-27B | DeepSeek Chat | 免费 | 中 |
| **代码生成** | Qwen3.5-27B | DeepSeek Coder | 免费 | 中 |
| **文档摘要** | Gemma-4-9B | Qwen3.5-27B | 免费 | 快 |
| **向量化** | BGE-M3 | - | 免费 | 快 |
| **语义搜索** | BGE-M3 | - | 免费 | 快 |
| **RAG 重排** | Jina Reranker | - | 免费 | 快 |

---

## 使用示例

### 1. 基础对话

```typescript
import { OMLXAdapter } from '@yunpat/core';

// 创建适配器
const llm = new OMLXAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
  modelName: 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit',
  temperature: 0.7,
  maxTokens: 4096,
});

// 单次调用
const response = await llm.chat({
  messages: [
    { role: 'user', content: '请帮我撰写一份专利申请书' }
  ],
});

console.log(response.message.content);
```

### 2. 向量嵌入

```typescript
// BGE-M3 嵌入
const embedding = await fetch('http://localhost:8009/v1/embeddings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OMXL_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'bge-m3-mlx-8bit',
    input: ['这是一份专利文档', '这是另一份文档'],
  }),
});

const data = await embedding.json();
// data.data[0].embedding - 1024 维向量
```

### 3. RAG 重排序

```typescript
// 检索后重排序
const rerank = await fetch('http://localhost:8009/v1/rerank', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OMXL_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'jina-reranker-v3-mlx',
    query: '人工智能领域的图像识别专利',
    documents: [
      '基于深度学习的图像识别方法',
      '智能家居控制系统',
      '自然语言处理中的注意力机制',
    ],
  }),
});

const results = await rerank.json();
// results.results - 按相关性排序的文档
```

### 4. 流式输出

```typescript
// 流式对话
for await (const chunk of llm.chatStream({
  messages: [{ role: 'user', content: '讲述一个故事' }],
})) {
  if (chunk.done) {
    console.log('\n[完成]');
    break;
  }
  process.stdout.write(chunk.delta);
}
```

---

## 性能优化建议

### 1. 模型选择策略

```typescript
// 根据任务复杂度选择模型
function selectModel(task: string): string {
  const simpleTasks = ['闲聊', '简单问答', '摘要'];
  const complexTasks = ['专利撰写', '复杂推理', '代码生成'];

  if (simpleTasks.some(t => task.includes(t))) {
    return 'gemma-4-e2b-it-4bit'; // 快速
  }
  if (complexTasks.some(t => task.includes(t))) {
    return 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'; // 强大
  }
  return 'gemma-4-e2b-it-4bit'; // 默认
}
```

### 2. 成本优化

```typescript
// 简单任务用小模型
const quickLLM = new OMLXAdapter({
  modelName: 'gemma-4-e2b-it-4bit',
  // ...
});

// 复杂任务用大模型
const powerfulLLM = new OMLXAdapter({
  modelName: 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit',
  // ...
});

// 两阶段处理：快速筛选 → 深度处理
const quickResult = await quickLLM.chat({ /* ... */ });
if (需要更高质量) {
  const finalResult = await powerfulLLM.chat({
    messages: [{ role: 'user', content: quickResult.message.content }]
  });
}
```

### 3. RAG 管道

```typescript
// 1. 向量化
const embedding = await BGE_M3.embed([query]);

// 2. 检索
const candidates = await vectorDB.search(embedding[0], { topK: 20 });

// 3. 重排序
const reranked = await jinaReranker.rerank(query, candidates);

// 4. 取 Top 5
const top5 = reranked.slice(0, 5);

// 5. 生成答案
const answer = await qwen27b.chat({
  messages: [
    { role: 'system', content: '基于以下上下文回答问题' },
    { role: 'user', content: `上下文：${top5.join('\n')}\n问题：${query}` }
  ],
});
```

---

## 配置建议

### 环境变量
```bash
# ~/.zshrc
export OMXL_API_KEY="xj781102@"
export OMXL_BASE_URL="http://localhost:8009/v1"
```

### TypeScript 类型
```typescript
interface OMXLConfig {
  baseURL: string;
  apiKey: string;
  modelName: 'gemma-4-e2b-it-4bit' | 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit';
  temperature?: number;
  maxTokens?: number;
}
```

---

## 故障排查

### 1. 模型加载慢
- 首次加载需要 30-60 秒
- 后续请求会快很多

### 2. 内存不足
- Qwen3.5-27B 需要 ~17GB 内存
- Gemma-4-9B 需要 ~5GB 内存
- 建议同时只加载一个大模型

### 3. 速度慢
- Gemma-4-9B: ~50 tokens/s
- Qwen3.5-27B: ~15-20 tokens/s
- 根据任务选择合适的模型

---

## 总结

| 场景 | 模型 | 理由 |
|------|------|------|
| **日常对话** | Gemma-4-9B | 速度快，成本低 |
| **专利撰写** | Qwen3.5-27B | 能力强，质量高 |
| **向量搜索** | BGE-M3 | 专用嵌入模型 |
| **RAG 优化** | Jina Reranker | 提升检索准确率 |

**最佳实践**: 简单任务用 Gemma，复杂任务用 Qwen，向量化用 BGE-M3，重排序用 Jina。
