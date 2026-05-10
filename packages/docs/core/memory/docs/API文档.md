# YunPat 记忆层 API 使用文档

**版本**: v0.1.0
**更新时间**: 2026-05-01

---

## 📚 目录

1. [快速开始](#快速开始)
2. [短期记忆 API](#短期记忆-api)
3. [长期记忆 API](#长期记忆-api)
4. [检查点与时间旅行](#检查点与时间旅行)
5. [完整示例](#完整示例)
6. [类型定义](#类型定义)

---

## 快速开始

### 基础使用

```typescript
import { MemoryManager } from '@yunpat/core'

// 创建记忆管理器
const memory = new MemoryManager()

// 存储记忆
await memory.add('user_name', '张三')
await memory.add('conversation', [{ role: 'user', content: '你好' }])

// 获取记忆
const name = await memory.get('user_name')
console.log(name) // '张三'

// 压缩记忆（保留最近 100 条）
const deleted = await memory.compress(100)
console.log(`删除了 ${deleted} 条记忆`)
```

### 环境变量配置

```bash
# .env 文件
BGE_API_KEY=your-api-key-here
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
VECTOR_DIMENSION=1024
```

```typescript
import { loadMemoryConfig } from '@yunpat/core'

// 加载配置
const config = loadMemoryConfig({
  bgeApiKey: 'your-key', // 可选，默认从环境变量读取
  databaseUrl: 'postgres://...', // 可选
})
```

---

## 短期记忆 API

### MemoryManager

基础记忆管理，适合存储对话历史、临时数据等。

#### 构造函数

```typescript
constructor()
```

**示例**:

```typescript
const memory = new MemoryManager()
```

#### 方法

##### `add(key, value)`

添加记忆。

```typescript
await memory.add('key', 'value')
await memory.add('user', { name: '张三', age: 25 })
```

##### `get(key)`

获取记忆。

```typescript
const value = await memory.get('key')
```

##### `compress(maxMemories?)`

压缩记忆（LRU 算法）。

```typescript
// 保留最近 100 条，返回删除数量
const deleted = await memory.compress(100)
```

##### `getHistory()`

获取历史记录。

```typescript
const history = memory.getHistory()
console.log(history)
// [
//   { key: 'key1', value: 'value1', timestamp: Date },
//   { key: 'key2', value: 'value2', timestamp: Date }
// ]
```

##### `clear()`

清空所有记忆。

```typescript
await memory.clear()
```

---

### TokenWindowManager

Token 窗口管理，自动压缩对话历史。

#### 构造函数

```typescript
constructor(config?: TokenWindowConfig)
```

**配置**:

```typescript
interface TokenWindowConfig {
  maxTokens?: number // 最大 Token 数（默认 4000）
  reservedTokens?: number // 预留空间（默认 500）
  compressionRatio?: number // 压缩目标比例（默认 0.6）
}
```

**示例**:

```typescript
import { createTokenWindowManager } from '@yunpat/core'

const tokenWindow = createTokenWindowManager({
  maxTokens: 4000,
  reservedTokens: 500,
})
```

#### 方法

##### `slideWindow(messages)`

滑动窗口压缩。

```typescript
const messages = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好！有什么可以帮助你的？' },
  // ... 更多消息
]

const { messages: compressed, stats } = await tokenWindow.slideWindow(messages)

console.log(`压缩率: ${stats.compressionRatio}`)
console.log(`原始: ${stats.originalMessages} → 压缩后: ${stats.compressedMessages}`)
```

---

## 长期记忆 API

### PostgresVectorStore

PostgreSQL 向量存储，基于 pgvector 扩展。

#### 构造函数

```typescript
constructor(config: PostgresVectorStoreConfig)
```

**配置**:

```typescript
interface PostgresVectorStoreConfig {
  databaseUrl: string // 数据库连接 URL
  vectorDimension?: number // 向量维度（默认 1024）
  hnswM?: number // HNSW 索引参数 M（默认 16）
  hnswEfConstruction?: number // HNSW 构建参数（默认 64）
}
```

**示例**:

```typescript
import { PostgresVectorStore } from '@yunpat/core'

const vectorStore = new PostgresVectorStore({
  databaseUrl: process.env.DATABASE_URL,
  vectorDimension: 1024,
})

await vectorStore.initialize()
```

#### 方法

##### `upsert(memory)`

插入或更新记忆。

```typescript
const id = await vectorStore.upsert({
  type: 'patent_draft',
  content: '基于深度学习的图像识别方法',
  embedding: [0.1, 0.2, ...], // 1024 维向量
  metadata: {
    agent: 'writer',
    tags: ['AI', '深度学习'],
  },
});
```

##### `search(queryEmbedding, topK?, filter?)`

向量相似度搜索。

```typescript
const results = await vectorStore.search(
  queryEmbedding, // 1024 维向量
  10, // top-K
  {
    types: ['patent_draft'],
    excludeArchived: true,
  }
)

results.forEach((result) => {
  console.log(`相似度: ${result.similarity}`)
  console.log(`内容: ${result.content}`)
})
```

##### `getStats()`

获取统计信息。

```typescript
const stats = await vectorStore.getStats()
console.log(`总记忆数: ${stats.totalMemories}`)
console.log(`类型分布:`, stats.typeDistribution)
```

---

### BGE-M3 嵌入

生成文本向量。

#### 构造函数

```typescript
constructor(config?: BGEM3Config)
```

**配置**:

```typescript
interface BGEM3Config {
  baseURL?: string // API 地址（默认 localhost:8009）
  apiKey?: string // API 密钥
  model?: string // 模型名称（默认 bge-m3-mlx-8bit）
  batchSize?: number // 批处理大小（默认 32）
  cacheMaxSize?: number // 缓存大小（默认 1000）
}
```

**示例**:

```typescript
import { createBGEM3Client } from '@yunpat/core'

const bge = createBGEM3Client({
  apiKey: process.env.BGE_API_KEY,
})

// 生成单个向量
const embedding = await bge.embed('你好世界')
console.log(embedding.length) // 1024

// 批量生成
const embeddings = await bge.embedBatch(['文本1', '文本2', '文本3'])
```

---

## 检查点与时间旅行

### CheckpointManager

管理智能体执行检查点。

#### 构造函数

```typescript
constructor(config?: {
  autoSave?: boolean;
  autoSaveInterval?: number;
  maxCheckpoints?: number;
})
```

**示例**:

```typescript
import { CheckpointManager } from '@yunpat/core'

const checkpointManager = new CheckpointManager({
  maxCheckpoints: 100,
})
```

#### 方法

##### `saveCheckpoint(...)`

保存检查点。

```typescript
const checkpoint = await checkpointManager.saveCheckpoint(
  'PatentWriterAgent', // agentName
  'exec-123', // executionId
  5, // iteration
  { memory: '...' }, // memory snapshot
  { context: '...' }, // context snapshot
  { state: '...' }, // state snapshot
  ['important'], // tags
  '关键步骤' // notes
)
```

##### `loadCheckpoint(checkpointId)`

加载检查点。

```typescript
const checkpoint = await checkpointManager.loadCheckpoint(checkpointId)
console.log(`恢复到迭代: ${checkpoint.iteration}`)
```

##### `listCheckpoints(filter?)`

列出检查点。

```typescript
const checkpoints = await checkpointManager.listCheckpoints({
  agentName: 'PatentWriterAgent',
  tags: ['important'],
})
```

##### `getTimeMachine()`

获取时间机器。

```typescript
const timeMachine = checkpointManager.getTimeMachine()

// 回到过去
const checkpoint = await timeMachine.travelBack(checkpointId)

// 重放历史
const history = await timeMachine.replayForward(fromId, toId)

// 创建分支
await timeMachine.createBranch(checkpointId, 'experiment-branch')
```

---

### EnhancedMemoryStore

增强的记忆存储，集成检查点功能。

#### 构造函数

```typescript
constructor(checkpointManager?: CheckpointManager)
```

**示例**:

```typescript
import { EnhancedMemoryStore } from '@yunpat/core'

const memory = new EnhancedMemoryStore()

// 使用
await memory.set('key', 'value')

// 创建检查点
const checkpoint = await memory.createCheckpoint('MyAgent', 'exec-123', 1, ['checkpoint'])

// 恢复检查点
await memory.restoreCheckpoint(checkpoint.id)
```

---

## 完整示例

### 示例 1: 基础记忆管理

```typescript
import { MemoryManager } from '@yunpat/core'

async function basicExample() {
  const memory = new MemoryManager()

  // 存储对话历史
  await memory.add('messages', [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！有什么可以帮助你的？' },
    { role: 'user', content: '我想写一个专利' },
  ])

  // 存储用户信息
  await memory.add('user', {
    name: '张三',
    company: 'ABC公司',
  })

  // 获取历史
  const history = memory.getHistory()
  console.log(`共有 ${history.length} 条记录`)

  // 压缩
  const deleted = await memory.compress(100)
  console.log(`压缩后删除了 ${deleted} 条`)
}
```

### 示例 2: 向量搜索

```typescript
import { PostgresVectorStore } from '@yunpat/core'
import { createBGEM3Client } from '@yunpat/core'

async function vectorSearchExample() {
  // 初始化
  const vectorStore = new PostgresVectorStore({
    databaseUrl: process.env.DATABASE_URL,
  })
  await vectorStore.initialize()

  const bge = createBGEM3Client({
    apiKey: process.env.BGE_API_KEY,
  })

  // 存储专利
  const patent = '基于深度学习的图像识别方法'
  const embedding = await bge.embed(patent)

  await vectorStore.upsert({
    type: 'patent',
    content: patent,
    embedding: embedding,
    metadata: {
      agent: 'writer',
      date: new Date().toISOString(),
    },
  })

  // 搜索
  const query = '图像识别 AI'
  const queryEmbedding = await bge.embed(query)

  const results = await vectorStore.search(queryEmbedding, 5)

  results.forEach((result) => {
    console.log(`相似度: ${(result.similarity * 100).toFixed(1)}%`)
    console.log(`内容: ${result.content}`)
  })
}
```

### 示例 3: 检查点与时间旅行

```typescript
import { EnhancedMemoryStore, CheckpointManager } from '@yunpat/core'

async function checkpointExample() {
  const checkpointManager = new CheckpointManager()
  const memory = new EnhancedMemoryStore(checkpointManager)

  // 执行步骤 1
  await memory.set('step1', '完成')
  const cp1 = await memory.createCheckpoint('Agent', 'exec-1', 1)

  // 执行步骤 2
  await memory.set('step2', '完成')
  const cp2 = await memory.createCheckpoint('Agent', 'exec-1', 2)

  // 执行步骤 3（出错）
  await memory.set('step3', '失败')

  // 时间旅行：回到步骤 2
  await memory.restoreCheckpoint(cp2.id)
  console.log(await memory.get('step2')) // '完成'

  // 重放历史
  const timeMachine = checkpointManager.getTimeMachine()
  const timeline = await timeMachine.listTimeline('exec-1')
  console.log(`时间线: ${timeline.length} 个检查点`)
}
```

### 示例 4: Token 窗口管理

```typescript
import { createTokenWindowManager } from '@yunpat/core'

async function tokenWindowExample() {
  const tokenWindow = createTokenWindowManager({
    maxTokens: 4000,
  })

  // 长对话历史
  const messages = [
    { role: 'system', content: '你是一个专利代理人' },
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！' },
    // ... 100+ 条消息
  ]

  // 自动压缩
  const { messages: compressed, stats } = await tokenWindow.slideWindow(messages)

  console.log(`压缩率: ${(stats.compressionRatio * 100).toFixed(1)}%`)
  console.log(`Token 使用: ${stats.compressedTokens}/${stats.originalTokens}`)

  // 使用压缩后的消息
  for (const msg of compressed) {
    console.log(`${msg.role}: ${msg.content.slice(0, 50)}...`)
  }
}
```

---

## 类型定义

### MemoryEntry

```typescript
interface MemoryEntry {
  key: string
  value: unknown
  timestamp: Date
}
```

### Checkpoint

```typescript
interface Checkpoint {
  id: string
  agentName: string
  executionId: string
  timestamp: Date
  iteration: number
  memorySnapshot: Record<string, unknown>
  contextSnapshot: Record<string, unknown>
  stateSnapshot: Record<string, unknown>
  tags?: string[]
  notes?: string
}
```

### SimilarityResult

```typescript
interface SimilarityResult {
  id: number
  content: string
  similarity: number // 0-1
  metadata: Record<string, any> | null
  type: string
}
```

---

## 更多资源

- [部署指南](./部署指南.md)
- [故障排查](./故障排查指南.md)
- [最佳实践](./最佳实践.md)
- [完整代码示例](../examples/)

---

**最后更新**: 2026-05-01
**维护者**: YunPat Team
