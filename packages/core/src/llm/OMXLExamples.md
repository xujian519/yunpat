# OMXL 本地模型使用示例

## 快速开始

### 1. 环境配置

```bash
# ~/.zshrc
export OMXL_API_KEY="xj781102@"
export OMXL_BASE_URL="http://localhost:8009/v1"
```

### 2. 安装依赖

```bash
pnpm install
```

---

## 示例 1: 智能对话系统

根据任务自动选择合适的模型：

```typescript
import { OMXLModelFactory } from '@yunpat/core';

// 方式 1: 根据任务类型选择
const patentLLM = OMXLModelFactory.createForTask('patent_writing');
const chatLLM = OMXLModelFactory.createForTask('chat_simple');

// 方式 2: 智能选择（基于任务描述）
const llm = OMXLModelFactory.selectModel('帮我撰写一份关于图像识别的专利申请书');

const response = await llm.chat({
  messages: [
    { role: 'user', content: '请帮我撰写一份专利申请书' }
  ],
  maxTokens: 4096,
});

console.log(response.message.content);
```

---

## 示例 2: RAG 检索系统

完整的 RAG 管道：向量化 → 检索 → 重排序 → 生成

```typescript
import { BGEEmbeddingAdapter } from '@yunpat/core';
import { JinaRerankerAdapter } from '@yunpat/core';
import { OMXLModelFactory } from '@yunpat/core';

// 1. 初始化模型
const bge = new BGEEmbeddingAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
});

const reranker = new JinaRerankerAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
});

const llm = OMXLModelFactory.createForTask('patent_writing');

// 2. 文档向量化（一次性）
const documents = [
  '基于深度学习的图像识别方法',
  '自然语言处理中的注意力机制',
  '强化学习在游戏 AI 中的应用',
];

const embeddings = await bge.embed(documents);

// 3. 查询向量化
const query = '深度学习在图像识别中的应用';
const queryEmbedding = await bge.embedOne(query);

// 4. 计算相似度，检索 Top 20
const similarities = embeddings.map((emb, index) => ({
  document: documents[index],
  similarity: bge.cosineSimilarity(queryEmbedding, emb),
}));

similarities.sort((a, b) => b.similarity - a.similarity);
const top20 = similarities.slice(0, 20).map((s) => s.document);

// 5. 重排序，选出 Top 5
const reranked = await reranker.rerank(query, top20, 5);
const top5 = reranked.map((r) => r.document);

// 6. 生成答案
const answer = await llm.chat({
  messages: [
    {
      role: 'system',
      content: '基于以下上下文回答问题，上下文是最相关的专利文档。',
    },
    {
      role: 'user',
      content: `上下文：\n${top5.join('\n\n')}\n\n问题：${query}`,
    },
  ],
});

console.log(answer.message.content);
```

---

## 示例 3: 专利撰写工作流

```typescript
import { OMXLModelFactory, TaskType } from '@yunpat/core';

// 使用 Qwen3.5-27B 进行专利撰写
const patentLLM = OMXLModelFactory.createForTask(TaskType.PATENT_WRITING);

// 生成专利各个部分
const [title, abstract, claims, description] = await Promise.all([
  patentLLM.chat({
    messages: [{ role: 'user', content: '为以下发明创作一个专利标题：[发明描述]' }],
    maxTokens: 100,
  }),
  patentLLM.chat({
    messages: [{ role: 'user', content: '撰写专利摘要：[发明描述]' }],
    maxTokens: 500,
  }),
  patentLLM.chat({
    messages: [{ role: 'user', content: '撰写专利权利要求书：[发明描述]' }],
    maxTokens: 2000,
  }),
  patentLLM.chat({
    messages: [{ role: 'user', content: '撰写专利具体实施方式：[发明描述]' }],
    maxTokens: 4096,
  }),
]);

console.log('专利标题:', title.message.content);
console.log('摘要:', abstract.message.content);
console.log('权利要求:', claims.message.content);
console.log('实施方式:', description.message.content);
```

---

## 示例 4: 智能文档检索

```typescript
import { BGEEmbeddingAdapter } from '@yunpat/core';
import { JinaRerankerAdapter } from '@yunpat/core';

const bge = new BGEEmbeddingAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
});

const reranker = new JinaRerankerAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
});

// 查询相似文档
const query = '人工智能在医疗诊断中的应用';
const candidates = [
  '基于深度学习的医学影像分析',
  '自然语言处理在电子病历中的应用',
  '智能推荐算法在电商平台的应用',
  '自动驾驶中的目标检测技术',
  '机器人辅助手术系统',
];

// 方式 1: 直接使用相似度
const similar = await bge.findMostSimilar(query, candidates, 3);
console.log('相似度检索结果:');
similar.forEach((s) => {
  console.log(`  ${s.similarity.toFixed(4)} - ${s.text}`);
});

// 方式 2: 使用 Reranker（更准确）
const reranked = await reranker.rerank(query, candidates, 3);
console.log('\nReranker 结果:');
reranked.forEach((r) => {
  console.log(`  ${r.rank}. [${r.relevanceScore.toFixed(4)}] ${r.document}`);
});
```

---

## 示例 5: 流式输出

```typescript
import { OMXLModelFactory } from '@yunpat/core';

const llm = OMXLModelFactory.createForTask('patent_writing');

console.log('开始生成...\n');

// 流式输出
for await (const chunk of llm.chatStream({
  messages: [{ role: 'user', content: '讲述一个关于 AI 的故事' }],
  maxTokens: 500,
})) {
  if (chunk.done) {
    console.log('\n\n[完成]');
    break;
  }
  process.stdout.write(chunk.delta);
}
```

---

## 示例 6: 成本优化策略

```typescript
import { OMXLModelFactory, TaskType } from '@yunpat/core';

// 两阶段处理：快速筛选 → 深度处理
async function optimizedTask(task: string) {
  // 阶段 1: 使用 Gemma 快速生成初稿
  const quickLLM = OMXLModelFactory.createForTask(TaskType.CHAT_SIMPLE);
  const draft = await quickLLM.chat({
    messages: [{ role: 'user', content: task }],
    maxTokens: 1024,
  });

  console.log('初稿:', draft.message.content);

  // 阶段 2: 使用 Qwen 深度优化
  const powerfulLLM = OMXLModelFactory.createForTask(TaskType.PATENT_WRITING);
  const refined = await powerfulLLM.chat({
    messages: [
      {
        role: 'system',
        content: '你是一个专业编辑，请优化以下文本的质量和专业性。',
      },
      {
        role: 'user',
        content: `请优化以下文本：\n\n${draft.message.content}`,
      },
    ],
    maxTokens: 2048,
  });

  console.log('优化后:', refined.message.content);
  return refined.message.content;
}

// 使用
const result = await optimizedTask('简要介绍深度学习');
```

---

## 示例 7: 批量处理

```typescript
import { BGEEmbeddingAdapter } from '@yunpat/core';

const bge = new BGEEmbeddingAdapter({
  baseURL: 'http://localhost:8009/v1',
  apiKey: process.env.OMXL_API_KEY,
});

// 批量向量化（自动分批）
const documents = [...]; // 1000 个文档
const embeddings = await bge.embedBatch(documents);

console.log(`✅ 已向量化 ${embeddings.length} 个文档`);
```

---

## 性能对比

| 模型 | 速度 | 质量 | 内存 | 适用场景 |
|------|------|------|------|---------|
| Gemma-4-9B | 50 tok/s | ⭐⭐⭐ | 5GB | 简单对话 |
| Qwen3.5-27B | 18 tok/s | ⭐⭐⭐⭐⭐ | 17GB | 复杂任务 |
| BGE-M3 | 快 | ⭐⭐⭐⭐ | - | 向量化 |
| Jina Reranker | 快 | ⭐⭐⭐⭐⭐ | - | 重排序 |

---

## 最佳实践

### 1. 模型选择原则

```typescript
// 简单任务 → 小模型
const task = '闲聊';
const model = task.includes('闲聊') ? 'gemma' : 'qwen';

// 复杂任务 → 大模型
const task = '专利撰写';
const model = task.includes('专利') ? 'qwen' : 'gemma';
```

### 2. RAG 管道优化

```typescript
// 向量检索（Broad）→ 重排序（Precise）
const candidates = await vectorSearch(query, { topK: 20 });
const reranked = await reranker.rerank(query, candidates, { topK: 5 });
```

### 3. 成本控制

```typescript
// 优先使用本地模型（免费）
const localLLM = OMXLModelFactory.createForTask('patent_writing');

// 本地模型不足时才使用云端 API
if (needMoreQuality) {
  const cloudLLM = createDeepSeekModel(apiKey);
  // ...
}
```

---

## 故障排查

### 问题 1: 模型加载慢
```
解决方案：首次加载需要 30-60 秒，后续请求会快很多
```

### 问题 2: 内存不足
```
解决方案：
- Qwen3.5-27B 需要 ~17GB 内存
- Gemma-4-9B 需要 ~5GB 内存
- 建议同时只加载一个大模型
```

### 问题 3: API 认证失败
```
解决方案：
export OMXL_API_KEY="xj781102@"
```

---

## 总结

✅ **免费使用** - 本地部署，无 API 费用
✅ **功能完整** - 对话、嵌入、重排序全覆盖
✅ **性能优秀** - Qwen3.5-27B 接近云端模型质量
✅ **隐私安全** - 数据不离开本地
✅ **易于集成** - 统一的接口，开箱即用

**推荐用法**:
- 日常对话 → Gemma-4-9B
- 专利撰写 → Qwen3.5-27B
- 向量搜索 → BGE-M3
- RAG 优化 → Jina Reranker
