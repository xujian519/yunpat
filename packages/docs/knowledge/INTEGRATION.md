# YunPat 知识库集成指南

**版本**: v1.0.0
**更新时间**: 2026-05-05
**知识库数量**: 3个（Obsidian、OpenClaw、YunPat）
**架构类型**: 多源混合知识图谱

---

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [知识库类型](#知识库类型)
- [集成方式](#集成方式)
- [API 文档](#api-文档)
- [配置指南](#配置指南)
- [使用示例](#使用示例)
- [性能优化](#性能优化)
- [故障排查](#故障排查)

---

## 概述

### 设计理念

YunPat 采用了**多源混合知识图谱**架构，整合了三个知识库：

1. **Obsidian 知识库** - 本地 Markdown 知识库
2. **OpenClaw 知识图谱** - 远程向量数据库（专利法律知识）
3. **YunPat 知识图谱** - 层次化概念知识库

**核心特性**:

- ✅ **多源查询**: 统一接口访问多个知识库
- ✅ **混合检索**: 语义检索 + 符号推理 + 图查询
- ✅ **智能缓存**: 多级缓存提升性能
- ✅ **关系推理**: 跨知识库的关系推断
- ✅ **可扩展**: 轻松添加新的知识源

### 技术栈

```typescript
// Obsidian 知识库桥接
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

// 统一知识图谱
import { UnifiedKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

// Core 包中的知识库组件
import { KnowledgeBase, CardRetriever, CardPipeline } from '@yunpat/core'
```

---

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Agents)                           │
│          (patent-writer, patent-responder, etc.)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ 调用
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              统一知识图谱 (UnifiedKnowledgeGraph)             │
│         统一查询接口、混合排序、关系推理、去重                 │
└──────┬──────────────────────────────────────────┬───────────┘
       │                                          │
       ▼                                          ▼
┌──────────────────┐                   ┌────────────────────┐
│  OpenClaw 适配器  │                   │  YunPat 适配器     │
│  (语义检索)       │                   │  (概念检索)         │
└────────┬─────────┘                   └────────┬───────────┘
         │                                     │
         ▼                                     ▼
┌──────────────────┐                   ┌────────────────────┐
│ PostgreSQL 向量库 │                   │ Obsidian 知识库    │
│  (远程)          │                   │  (本地 Markdown)   │
└──────────────────┘                   └────────────────────┘
```

### 数据流

```
用户查询
    │
    ▼
┌─────────────────┐
│ UnifiedKnowledgeGraph │
│ 1. 解析查询意图  │
│ 2. 选择知识源    │
│ 3. 并行查询      │
└────────┬────────┘
         │
         ├─────────────────┬──────────────────┐
         ▼                 ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │OpenClaw │      │ YunPat   │      │ Obsidian │
   │语义检索  │      │ 概念检索  │      │ Wiki卡片 │
   └────┬────┘      └─────┬────┘      └─────┬────┘
         │                 │                  │
         └─────────────────┼──────────────────┘
                          ▼
                  ┌───────────────┐
                  │ 混合排序 & 去重 │
                  └───────────────┘
                          │
                          ▼
                     返回结果
```

---

## 知识库类型

### 1. Obsidian 知识库 💎

**包名**: `@yunpat/patent-knowledge`
**完成度**: 75%
**位置**: `knowledge-base/` (本地)
**格式**: Markdown 文件

#### 结构

```
knowledge-base/
├── Wiki/
│   ├── cards/              # 知识卡片（问答对）
│   │   ├── 20240101-问题1-[hash].md
│   │   └── 20240102-问题2-[hash].md
│   ├── Concept-Index.md    # 概念索引
│   ├── Patent-Types.md     # 专利类型
│   └── ...                 # 其他 Wiki 页面
└── ...                     # 其他知识库内容
```

#### 核心类

```typescript
class ObsidianKnowledgeBridge {
  // 查询知识卡片
  async queryCard(question: string): Promise<WikiCard | null>

  // 按概念查询
  async queryByConcept(concept: string): Promise<string[]>

  // 读取 Wiki 页面
  async readWikiPage(pagePath: string): Promise<string>

  // 获取 Wiki 页面对象
  async getWikiPage(pagePath: string): Promise<WikiPage | null>

  // 清除缓存
  clearCache(): void

  // 获取缓存统计
  getCacheStats(): CacheStats
}
```

#### 数据模型

```typescript
interface WikiCard {
  question: string // 来源问题
  quality: number // 质量分 (0-1)
  content: string // 卡片内容
  relatedPages: string[] // 相关页面
  timestamp: string // 生成时间
}

interface WikiPage {
  path: string // 页面路径
  title: string // 页面标题
  content: string // 页面内容
  links: string[] // 链接的其他页面
}
```

#### 使用场景

- ✅ 专利撰写知识支持
- ✅ 审查答复策略参考
- ✅ 技术术语解释
- ✅ 法律条款查询

---

### 2. OpenClaw 知识图谱 🔍

**类型**: 远程向量数据库
**存储**: PostgreSQL + pgvector
**访问**: 通过 PostgreSQL 适配器
**特点**: 语义检索

#### 数据模型

```typescript
interface OpenClawNode {
  id: string // 节点 ID
  nodeType: string // 节点类型
  name: string // 节点名称
  content: string // 节点内容
  embedding?: number[] // 向量嵌入
  lawRefsCount?: number // 法律引用数
}

interface OpenClawEdge {
  id: string // 边 ID
  source: string // 源节点 ID
  target: string // 目标节点 ID
  relation: string // 关系类型
  weight?: number // 关系权重
}
```

#### 核心功能

```typescript
class OpenClawAdapter {
  // 初始化
  async initialize(): Promise<void>

  // 语义搜索
  async semanticSearch(
    query: string,
    topK: number
  ): Promise<
    {
      node: OpenClawNode
      score: number
    }[]
  >

  // 查找图路径
  async findPath(from: string, to: string): Promise<string[]>

  // 获取统计信息
  getStats(): OpenClawStats
}
```

#### 使用场景

- ✅ 专利法律知识检索
- ✅ 相似技术查找
- ✅ 图关系推理
- ✅ 法律依据查询

---

### 3. YunPat 知识图谱 📚

**类型**: 层次化概念知识库
**存储**: PostgreSQL (关系型)
**访问**: 通过概念索引
**特点**: 符号推理

#### 数据模型

```typescript
interface YunPatConcept {
  id: string // 概念 ID
  name: string // 概念名称
  level: number // 层次级别 (1-5)
  parent?: string // 父概念
  children?: string[] // 子概念
  description?: string // 概念描述
  examples?: string[] // 示例
}

interface YunPatRelation {
  from: string // 源概念
  to: string // 目标概念
  relation: string // 关系类型
  confidence: number // 置信度
}
```

#### 核心功能

```typescript
class YunPatAdapter {
  // 初始化
  async initialize(): Promise<void>

  // 概念搜索
  async conceptSearch(
    query: string,
    topK: number
  ): Promise<
    {
      concept: YunPatConcept
      score: number
    }[]
  >

  // 层次关系推理
  async inferHierarchy(concept1: string, concept2: string): Promise<string>

  // 获取统计信息
  getStats(): YunPatStats
}
```

#### 使用场景

- ✅ 专利概念层次查询
- ✅ 技术领域分类
- ✅ 层次关系推理
- ✅ 概念相似度计算

---

## 集成方式

### 方式 1: 使用 ObsidianKnowledgeBridge

**适用场景**: 本地知识库查询

```typescript
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

// 1. 初始化
const bridge = new ObsidianKnowledgeBridge({
  knowledgeBasePath: '/path/to/knowledge-base',
})

// 2. 查询知识卡片
const card = await bridge.queryCard('什么是发明专利？')
if (card) {
  console.log('答案:', card.content)
  console.log('质量分:', card.quality)
  console.log('相关页面:', card.relatedPages)
}

// 3. 按概念查询
const relatedPages = await bridge.queryByConcept('发明专利')
console.log('相关页面:', relatedPages)

// 4. 读取 Wiki 页面
const content = await bridge.readWikiPage('Patent-Types')
console.log('页面内容:', content)

// 5. 获取页面对象
const page = await bridge.getWikiPage('Patent-Types')
if (page) {
  console.log('标题:', page.title)
  console.log('链接:', page.links)
}

// 6. 缓存管理
console.log('缓存统计:', bridge.getCacheStats())
bridge.clearCache() // 清除缓存
```

### 方式 2: 使用 UnifiedKnowledgeGraph

**适用场景**: 多源知识查询

```typescript
import { UnifiedKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

// 1. 初始化
const kg = new UnifiedKnowledgeGraph()
await kg.initialize()

// 2. 统一查询
const results = await kg.query({
  text: '发明专利的保护期限',
  sources: ['openclaw', 'yunpat'], // 可选，默认查询所有
  method: 'hybrid', // semantic | symbolic | graph | hybrid
  topK: 10, // 返回前10个结果
})

results.forEach((result) => {
  console.log(`[${result.source}] ${result.name}`)
  console.log(`  内容: ${result.content}`)
  console.log(`  分数: ${result.score}`)
  console.log(`  元数据:`, result.metadata)
})

// 3. 关系推理
const relation = await kg.inferRelation('发明专利', '实用新型')
console.log('关系:', relation.relation)
console.log('置信度:', relation.confidence)
console.log('推理过程:', relation.reasoning)
console.log('知识源:', relation.sources)

// 4. 获取统计信息
console.log('知识图谱统计:', kg.getStats())
```

### 方式 3: 在 Agent 中集成

**适用场景**: Agent 使用知识库增强

```typescript
import { PatentWriterAgent } from '@yunpat/agents/patent-writer'
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

class MyPatentWriterAgent extends PatentWriterAgent {
  private knowledgeBridge: ObsidianKnowledgeBridge

  constructor(config) {
    super(config)
    this.knowledgeBridge = new ObsidianKnowledgeBridge({
      knowledgeBasePath: config.knowledgeBasePath,
    })
  }

  protected async act(plan, context) {
    // 1. 从知识库查询相关知识
    const knowledgeCard = await this.knowledgeBridge.queryCard(`如何撰写${plan.field}领域的专利？`)

    // 2. 将知识注入到 LLM 提示中
    const enhancedPrompt = this.buildPrompt(plan, {
      knowledge: knowledgeCard?.content || '',
    })

    // 3. 调用 LLM
    const result = await context.llm.generate(enhancedPrompt)

    return result
  }
}
```

### 方式 4: 使用 Core 包的 KnowledgeBase

**适用场景**: 高级知识库操作

```typescript
import { KnowledgeBase, CardRetriever, CardPipeline } from '@yunpat/core'

// 1. 创建知识库
const knowledgeBase = new KnowledgeBase({
  llm: myLLM,
  embedding: myEmbedding,
  vectorStore: myVectorStore,
})

// 2. 创建卡片检索器
const retriever = new CardRetriever({
  knowledgeBase,
  topK: 5,
  similarityThreshold: 0.8,
})

// 3. 创建卡片处理管道
const pipeline = new CardPipeline({
  generator: myCardGenerator,
  retriever,
  knowledgeBase,
})

// 4. 查询知识
const results = await retriever.retrieve({
  query: '发明专利的撰写要求',
  filters: {
    quality: { $gte: 0.8 },
    category: 'patent',
  },
})

// 5. 生成新卡片
const newCard = await pipeline.generateCard({
  question: '什么是外观设计专利？',
  context: '专利撰写',
})
```

---

## API 文档

### ObsidianKnowledgeBridge

#### 构造函数

```typescript
constructor(knowledgeBasePath?: string)
```

**参数**:

- `knowledgeBasePath`: 知识库路径（可选，默认从环境变量 `KNOWLEDGE_BASE_PATH` 读取）

**异常**:

- 如果知识库路径未配置，抛出 `Error`

#### queryCard

```typescript
async queryCard(question: string): Promise<WikiCard | null>
```

**功能**: 查询与问题匹配的知识卡片

**参数**:

- `question`: 查询问题

**返回**:

- `WikiCard | null`: 匹配的知识卡片，如果未找到返回 `null`

**缓存**: 会缓存查询结果，提升重复查询性能

#### queryByConcept

```typescript
async queryByConcept(concept: string): Promise<string[]>
```

**功能**: 根据概念查询相关的 Wiki 页面

**参数**:

- `concept`: 概念名称

**返回**:

- `string[]`: 相关页面的路径列表

#### readWikiPage

```typescript
async readWikiPage(pagePath: string): Promise<string>
```

**功能**: 读取指定 Wiki 页面的内容

**参数**:

- `pagePath`: 页面路径（不含 `.md` 扩展名）

**返回**:

- `string`: 页面内容（Markdown 格式）

#### getWikiPage

```typescript
async getWikiPage(pagePath: string): Promise<WikiPage | null>
```

**功能**: 获取 Wiki 页面对象（包含元数据）

**参数**:

- `pagePath`: 页面路径

**返回**:

- `WikiPage | null`: 页面对象，如果未找到返回 `null`

---

### UnifiedKnowledgeGraph

#### initialize

```typescript
async initialize(): Promise<void>
```

**功能**: 初始化所有知识源适配器

**行为**: 并行初始化所有适配器，单个适配器失败不影响其他适配器

#### query

```typescript
async query(query: KnowledgeQuery): Promise<KnowledgeResult[]>
```

**功能**: 统一查询接口

**参数**:

```typescript
interface KnowledgeQuery {
  text: string // 查询文本
  sources?: KnowledgeSource[] // 知识源（可选，默认全部）
  method?: 'semantic' | 'symbolic' | 'graph' | 'hybrid' // 查询方法
  topK?: number // 返回结果数量
}
```

**返回**:

```typescript
interface KnowledgeResult {
  source: 'openclaw' | 'yunpat' // 知识源
  id: string // 结果 ID
  type: string // 结果类型
  name: string // 结果名称
  content: string // 结果内容
  score: number // 相关性分数
  metadata?: Record<string, any> // 元数据
}
```

#### inferRelation

```typescript
async inferRelation(
  concept1: string,
  concept2: string,
  sources?: KnowledgeSource[]
): Promise<RelationInference>
```

**功能**: 推理两个概念之间的关系

**参数**:

- `concept1`: 第一个概念
- `concept2`: 第二个概念
- `sources`: 使用的知识源（可选）

**返回**:

```typescript
interface RelationInference {
  relation: string // 关系描述
  confidence: number // 置信度 (0-1)
  reasoning: string[] // 推理过程
  sources: KnowledgeSource[] // 使用的知识源
}
```

---

## 配置指南

### 环境变量配置

在 `.env` 文件中配置：

```bash
# Obsidian 知识库路径（必需）
KNOWLEDGE_BASE_PATH=/path/to/knowledge-base

# PostgreSQL 连接（OpenClaw 和 YunPat）
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=patent_kg
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# 向量检索配置
VECTOR_SEARCH_TOP_K=10
VECTOR_SEARCH_THRESHOLD=0.7
```

### TypeScript 配置

```typescript
// config/knowledge.ts
export const knowledgeConfig = {
  // Obsidian 知识库
  obsidian: {
    path: process.env.KNOWLEDGE_BASE_PATH!,
    cacheEnabled: true,
    cacheSize: 1000,
  },

  // OpenClaw 知识图谱
  openclaw: {
    postgres: {
      host: process.env.POSTGRES_HOST!,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB!,
      user: process.env.POSTGRES_USER!,
      password: process.env.POSTGRES_PASSWORD!,
    },
    vectorSearch: {
      topK: parseInt(process.env.VECTOR_SEARCH_TOP_K || '10'),
      threshold: parseFloat(process.env.VECTOR_SEARCH_THRESHOLD || '0.7'),
    },
  },

  // YunPat 知识图谱
  yunpat: {
    postgres: {
      // 同上
    },
    conceptSearch: {
      topK: 10,
      includeRelated: true,
    },
  },
}
```

---

## 使用示例

### 示例 1: 专利撰写知识支持

```typescript
import { PatentWriterAgent } from '@yunpat/agents/patent-writer'
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

async function writePatentWithKnowledge(disclosure) {
  // 1. 初始化知识库桥接
  const bridge = new ObsidianKnowledgeBridge()

  // 2. 查询撰写知识
  const writingKnowledge = await bridge.queryCard(`如何撰写${disclosure.field}领域的专利？`)

  // 3. 查询相关技术知识
  const techPages = await bridge.queryByConcept(disclosure.technicalField)

  // 4. 创建专利撰写 Agent
  const agent = new PatentWriterAgent({
    name: 'PatentWriter',
    description: '专利撰写智能体',
    llm: myLLM,
    knowledgeBridge: bridge,
  })

  // 5. 撰写专利（知识增强）
  const result = await agent.run(
    {
      ...disclosure,
      knowledge: writingKnowledge?.content,
      relatedPages: techPages,
    },
    context
  )

  return result
}
```

### 示例 2: 审查答复策略生成

```typescript
import { PatentResponderAgent } from '@yunpat/agents/patent-responder'
import { UnifiedKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

async function generateResponseStrategy(officeAction) {
  // 1. 初始化统一知识图谱
  const kg = new UnifiedKnowledgeGraph()
  await kg.initialize()

  // 2. 查询相关法律知识
  const legalKnowledge = await kg.query({
    text: officeAction.rejectionReason,
    sources: ['openclaw'], // 使用法律知识图谱
    method: 'semantic',
    topK: 5,
  })

  // 3. 推理概念关系
  const relations = await kg.inferRelation(officeAction.rejectedClaims[0], 'prior art')

  // 4. 生成答复策略
  const agent = new PatentResponderAgent({
    name: 'PatentResponder',
    description: '专利答复智能体',
    llm: myLLM,
    knowledgeGraph: kg,
  })

  const result = await agent.run(
    {
      officeAction,
      legalKnowledge,
      relations,
    },
    context
  )

  return result
}
```

### 示例 3: 技术方案分析

```typescript
import { PatentAnalyzerAgent } from '@yunpat/agents/patent-analyzer'
import { UnifiedKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

async function analyzeTechnicalSolution(patent) {
  // 1. 初始化知识图谱
  const kg = new UnifiedKnowledgeGraph()
  await kg.initialize()

  // 2. 多源知识查询
  const [technicalKnowledge, legalKnowledge, conceptInfo] = await Promise.all([
    // 技术知识（YunPat）
    kg.query({
      text: patent.technicalField,
      sources: ['yunpat'],
      method: 'symbolic',
      topK: 5,
    }),

    // 法律知识（OpenClaw）
    kg.query({
      text: patent.legalIssue,
      sources: ['openclaw'],
      method: 'semantic',
      topK: 5,
    }),

    // 概念关系推理
    kg.inferRelation(patent.mainConcept, patent.secondaryConcept),
  ])

  // 3. 分析专利
  const agent = new PatentAnalyzerAgent({
    name: 'PatentAnalyzer',
    description: '专利分析智能体',
    llm: myLLM,
    knowledgeGraph: kg,
  })

  const result = await agent.run(
    {
      patent,
      knowledge: {
        technical: technicalKnowledge,
        legal: legalKnowledge,
        concepts: conceptInfo,
      },
    },
    context
  )

  return result
}
```

---

## 性能优化

### 1. 缓存策略

#### 多级缓存

```typescript
class OptimizedKnowledgeBridge {
  private l1Cache: Map<string, any> = new Map() // 内存缓存
  private l2Cache: Map<string, any> = new Map() // Redis 缓存（可选）

  async queryWithCache(question: string) {
    // L1: 内存缓存
    if (this.l1Cache.has(question)) {
      return this.l1Cache.get(question)
    }

    // L2: Redis 缓存
    if (this.l2Cache.has(question)) {
      const result = this.l2Cache.get(question)
      this.l1Cache.set(question, result) // 回填 L1
      return result
    }

    // L3: 实际查询
    const result = await this.actualQuery(question)

    // 写入缓存
    this.l1Cache.set(question, result)
    this.l2Cache.set(question, result)

    return result
  }
}
```

#### 缓存配置

```typescript
const cacheConfig = {
  maxEntries: 1000, // 最大缓存条目
  ttl: 3600000, // 生存时间（1小时）
  evictionPolicy: 'LRU', // 淘汰策略
}
```

### 2. 批量查询

```typescript
// ❌ 不好的做法：逐个查询
for (const question of questions) {
  const result = await bridge.queryCard(question)
}

// ✅ 好的做法：批量查询
const results = await Promise.all(questions.map((q) => bridge.queryCard(q)))
```

### 3. 并行查询

```typescript
// ✅ 并行查询多个知识源
const [openclawResults, yunpatResults] = await Promise.all([
  openclawAdapter.semanticSearch(query, topK),
  yunpatAdapter.conceptSearch(query, topK),
])
```

### 4. 预加载和索引

```typescript
// 启动时预加载热点数据
async function preloadHotData() {
  const hotConcepts = ['发明专利', '实用新型', '外观设计']

  await Promise.all(hotConcepts.map((concept) => kg.query({ text: concept, topK: 10 })))
}
```

### 5. 连接池管理

```typescript
// PostgreSQL 连接池配置
const poolConfig = {
  max: 20, // 最大连接数
  min: 5, // 最小连接数
  idle: 10000, // 空闲超时
  acquire: 30000, // 获取超时
}
```

---

## 故障排查

### 问题 1: 知识库路径未配置

**错误信息**:

```
Error: 知识库路径未配置，请设置环境变量 KNOWLEDGE_BASE_PATH
```

**解决方案**:

```bash
# 设置环境变量
export KNOWLEDGE_BASE_PATH=/path/to/knowledge-base

# 或在 .env 文件中配置
echo "KNOWLEDGE_BASE_PATH=/path/to/knowledge-base" >> .env
```

### 问题 2: PostgreSQL 连接失败

**错误信息**:

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案**:

```bash
# 1. 检查 PostgreSQL 是否运行
pg_isready

# 2. 检查连接配置
echo $POSTGRES_HOST
echo $POSTGRES_PORT
echo $POSTGRES_DB

# 3. 测试连接
psql -h localhost -U postgres -d patent_kg
```

### 问题 3: 查询结果为空

**可能原因**:

1. 知识库中没有相关数据
2. 查询词不匹配
3. 相似度阈值过高

**解决方案**:

```typescript
// 1. 降低相似度阈值
const results = await kg.query({
  text: query,
  topK: 20, // 增加返回数量
})

// 2. 使用更通用的查询词
const broadQuery = query.split(' ')[0] // 使用第一个词

// 3. 检查知识库统计
const stats = kg.getStats()
console.log('知识库统计:', stats)
```

### 问题 4: 缓存占用内存过高

**解决方案**:

```typescript
// 1. 限制缓存大小
const bridge = new ObsidianKnowledgeBridge(path)
// 定期清理
setInterval(() => {
  const stats = bridge.getCacheStats()
  if (stats.cards > 1000) {
    bridge.clearCache()
  }
}, 60000) // 每分钟检查一次

// 2. 使用 LRU 缓存
import { LRUCache } from 'lru-cache'
const cache = new LRUCache({ max: 500 })
```

### 问题 5: 查询性能慢

**诊断步骤**:

```typescript
// 1. 测量查询时间
console.time('knowledge-query')
const results = await kg.query(query)
console.timeEnd('knowledge-query')

// 2. 检查缓存命中率
const stats = bridge.getCacheStats()
console.log('缓存命中率:', stats.hits / (stats.hits + stats.misses))

// 3. 优化查询
// - 使用批量查询
// - 启用并行查询
// - 增加缓存
```

---

## 最佳实践

### 1. 选择合适的知识源

| 任务     | 推荐知识源 | 原因               |
| -------- | ---------- | ------------------ |
| 专利撰写 | Obsidian   | 本地知识，快速访问 |
| 法律检索 | OpenClaw   | 法律知识丰富       |
| 概念查询 | YunPat     | 层次化结构         |
| 综合查询 | Unified    | 多源整合           |

### 2. 错误处理

```typescript
async function robustQuery(query: string) {
  try {
    // 尝试统一查询
    return await kg.query({ text: query })
  } catch (error) {
    console.error('统一查询失败:', error)

    // 降级到单一知识源
    try {
      return await obsidianBridge.queryCard(query)
    } catch (fallbackError) {
      console.error('降级查询也失败:', fallbackError)
      return null
    }
  }
}
```

### 3. 日志记录

```typescript
class KnowledgeBridgeWithLogging {
  async query(query: string) {
    const startTime = Date.now()

    console.log(`[知识库] 查询开始: ${query}`)

    try {
      const result = await this.actualQuery(query)

      console.log(`[知识库] 查询成功:`, {
        query,
        resultCount: result.length,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      console.error(`[知识库] 查询失败:`, {
        query,
        error: error.message,
        duration: Date.now() - startTime,
      })
      throw error
    }
  }
}
```

---

## 附录

### A. 性能基准

| 操作              | 平均耗时 | 吞吐量 |
| ----------------- | -------- | ------ |
| Obsidian 卡片查询 | 50ms     | 20 qps |
| OpenClaw 语义检索 | 200ms    | 5 qps  |
| YunPat 概念检索   | 100ms    | 10 qps |
| 统一查询（多源）  | 300ms    | 3 qps  |

### B. 相关文档

- [Agents 架构文档](../agents/ARCHITECTURE.md)
- [技术债务评估报告](../TECHNICAL_DEBT_ASSESSMENT.md)
- [项目结构文档](../PROJECT_STRUCTURE.md)

### C. 示例代码

- [Obsidian 知识库示例](../../examples/obsidian-knowledge.ts)
- [统一知识图谱示例](../../examples/unified-knowledge-graph.ts)
- [Agent 集成示例](../../examples/agent-with-knowledge.ts)

---

**文档维护**: 本文档应随代码变更及时更新
**下次审查**: 2026-05-19
**反馈渠道**: GitHub Issues
