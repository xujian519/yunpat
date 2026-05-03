# YunPat 知识库检索工具

## 功能概述

知识库检索工具提供对 YunPat 专利知识库（131 张卡片 + 1200+ 文档）的智能检索能力。

## 核心组件

### 1. KnowledgeSearchTool - 知识库检索工具

```typescript
import { KnowledgeSearchTool } from '@yunpat/builtin-tools'

const searchTool = new KnowledgeSearchTool()

const result = await searchTool.execute(
  {
    query: '三步法',
    limit: 10,
    includeContent: true,
  },
  context
)

console.log(`找到 ${result.cards.length} 张相关卡片`)
result.cards.forEach((card) => {
  console.log(`- ${card.metadata.title}`)
  console.log(`  概念: ${card.metadata.concept}`)
  console.log(`  相关性: ${card.relevanceScore}`)
  if (card.content) {
    console.log(`  内容: ${card.content.substring(0, 100)}...`)
  }
})
```

### 2. KnowledgeIndexBuilderTool - 索引构建工具

```typescript
import { KnowledgeIndexBuilderTool } from '@yunpat/builtin-tools'

const builder = new KnowledgeIndexBuilderTool()

// 构建索引
await builder.execute({ forceRebuild: true }, context)
```

## 使用场景

### 场景 1：专利撰写时检索相关概念

```typescript
// 智能体在撰写专利时检索"三步法"相关卡片
const result = await searchTool.execute(
  { query: '三步法 创造性判断', concepts: ['三步法', '创造性'] },
  context
)

// 使用检索到的卡片内容指导撰写
const guidance = result.cards.map((c) => c.content).join('\n\n')
```

### 场景 2：审查答复时查找法律依据

```typescript
// 答复审查意见时检索相关法律条文
const result = await searchTool.execute(
  {
    query: '新颖性',
    domains: ['法律法规', '审查指南'],
    limit: 5,
  },
  context
)
```

### 场景 3：专利分析时收集案例

```typescript
// 分析专利时检索相关复审无效决定
const result = await searchTool.execute(
  {
    query: '功能性特征',
    domains: ['复审无效', '专利判决'],
    limit: 10,
  },
  context
)
```

## 索引结构

```json
{
  "totalCards": 131,
  "cards": [
    {
      "id": "20260429-限定部分-...",
      "title": "如何系统性地训练和规范化...",
      "concept": "限定部分",
      "quality": 0.92,
      "domain": "权利要求与说明书",
      "filePath": "/path/to/card.md",
      "relatedConcepts": [],
      "generatedAt": "2026-04-29T11:20:08.378Z",
      "version": 1
    }
  ],
  "conceptIndex": {
    "三步法": ["card-id-1", "card-id-2"],
    "新颖性": ["card-id-3", "card-id-4"]
  },
  "domainIndex": {
    "法律法规": ["card-id-5", "card-id-6"],
    "专利实务": ["card-id-7", "card-id-8"]
  },
  "lastUpdated": "2026-04-29T12:00:00.000Z"
}
```

## 卡片元数据

每张卡片包含以下元数据：

- `id`: 卡片唯一标识
- `title`: 卡片标题
- `concept`: 核心概念（如：三步法、新颖性）
- `quality`: 质量分数（0.0-1.0）
- `domain`: 领域分类（如：法律法规、专利实务）
- `filePath`: 文件路径
- `relatedConcepts`: 相关概念
- `generatedAt`: 生成时间
- `version`: 版本号

## 检索策略

### 1. 关键词匹配

```typescript
// 简单关键词检索
const result = await searchTool.execute({ query: '专利侵权' }, context)
```

### 2. 概念过滤

```typescript
// 限定概念范围
const result = await searchTool.execute(
  {
    query: '判断标准',
    concepts: ['三步法', '创造性'],
  },
  context
)
```

### 3. 领域过滤

```typescript
// 限定领域范围
const result = await searchTool.execute(
  {
    query: '权利要求',
    domains: ['专利实务', '法律法规'],
  },
  context
)
```

### 4. 组合检索

```typescript
// 组合多个条件
const result = await searchTool.execute(
  {
    query: '外观设计',
    concepts: ['外观设计'],
    domains: ['专利判决', '复审无效'],
    limit: 5,
    includeContent: true,
  },
  context
)
```

## 性能优化

### 缓存索引

```typescript
// 索引会自动缓存，避免重复构建
const searchTool = new KnowledgeSearchTool()

// 第一次调用会加载索引
await searchTool.execute({ query: 'test' }, context)

// 后续调用直接使用缓存的索引
await searchTool.execute({ query: '三步法' }, context)
```

### 批量检索

```typescript
// 批量检索多个概念
const queries = ['三步法', '新颖性', '创造性']
const results = await Promise.all(
  queries.map((query) => searchTool.execute({ query, limit: 5 }, context))
)
```

## 相关性计算

检索结果的相关性分数基于：

1. **标题匹配**（权重 3.0）：标题中包含查询词
2. **概念匹配**（权重 2.0）：概念字段匹配
3. **质量分加权**：高质量卡片优先

## 下一步

- 集成到专利智能体中
- 添加向量检索（RAG）
- 支持语义搜索

---

**YunPat Team** - 让专利工作更智能 🚀
