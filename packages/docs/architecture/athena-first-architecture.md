# Athena-First 知识图谱架构设计

## 🎯 核心理念

**Athena = 法律世界模型（PostgreSQL + Neo4j）** - 主要知识源
**OpenClaw = 专利特定知识** - 领域增强
**YunPat = 双向链接导航** - 关系推理增强

## 📊 知识源重新定位

### 1. Athena 法律世界模型（主要）

```sql
-- PostgreSQL: 结构化知识
knowledge_items (
  id, title, category, subcategory,
  content, keywords, importance, confidence, source
)

-- Neo4j: 图关系
- 7种图谱类型：法律规则、审查指南、专利无效、复审、判决、商标、技术术语
- 12种关系类型：CONTAINS, BELONGS_TO, CITES, SIMILAR_TO, RELATED_TO...
- 数据量：超大（具体数量待确认）
```

**定位**：

- ✅ **主要知识源** - 法律世界的完整模型
- ✅ **权威性强** - 经过验证的法律知识
- ✅ **关系丰富** - Neo4j 图查询能力

### 2. OpenClaw 专利知识（增强）

```python
# NetworkX 图格式
- 40,034 节点
- BGE-M3 向量嵌入
- 专利特定领域知识
```

**定位**：

- ✅ **领域增强** - 专利特定概念的深度覆盖
- ✅ **语义检索** - 向量嵌入支持语义搜索
- ✅ **补充Athena** - 专利领域的细粒度知识

### 3. YunPat 双链（推理增强）

```markdown
# Obsidian 双向链接

- 5,229 双链
- 反向索引：Concept-Index.md
- 层次结构：Concept-Hierarchy.md
```

**定位**：

- ✅ **推理增强** - 双向链接路径查找
- ✅ **关系导航** - 前后跳转追踪思路
- ✅ **知识图谱** - 自然形成图结构

## 🏗️ 重新设计的架构

```
┌─────────────────────────────────────────────────────────┐
│              Agent 知识增强接口 (KG API)                  │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼───────────────────────────────────────▼────────┐
│         Athena-First 统一知识图谱引擎                    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  查询路由与融合策略                              │   │
│  │  - 主查询：Athena PostgreSQL + Neo4j            │   │
│  │  - 语义增强：OpenClaw 向量检索                   │   │
│  │  - 推理增强：YunPat 双链遍历                     │   │
│  └─────────────────────────────────────────────────┘   │
└───────▲──────────────────────────────────────────▲─────┘
        │                                       │
┌───────┴──────────┐                   ┌───────┴──────────┐
│  Athena          │                   │  增强层           │
│  法律世界模型     │                   │                  │
│  - PostgreSQL    │                   │  OpenClaw        │
│  - Neo4j         │                   │  (40k 节点)      │
│  (主要知识源)     │                   │                  │
└──────────────────┘                   │  YunPat         │
                                      │  (5k 双链)       │
                                      └──────────────────┘
```

## 💻 实现方案

### 方案架构

```typescript
/**
 * Athena-First 知识图谱服务
 */
export class AthenaFirstKnowledgeGraph {
  private athena: AthenaClient // 主要
  private openclaw: OpenClawAdapter // 语义增强
  private yunpat: YunPatAdapter // 推理增强

  /**
   * 查询策略：
   * 1. 主查询：Athena（PostgreSQL + Neo4j）
   * 2. 语义增强：OpenClaw 向量检索
   * 3. 推理增强：YunPat 双链遍历
   */
  async query(query: string, options: QueryOptions): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = []

    // 1. 主查询：Athena PostgreSQL（结构化知识）
    const athenaResults = await this.athena.queryPostgreSQL(query, {
      topK: options.topK || 5,
    })
    results.push(
      ...athenaResults.map((r) => ({
        source: 'athena',
        id: `athena_${r.id}`,
        type: r.category,
        name: r.title,
        content: r.content,
        score: r.importance / 5,
        metadata: { confidence: r.confidence, isPrimary: true },
      }))
    )

    // 2. 语义增强：OpenClaw 向量检索
    if (options.enableSemantic) {
      const openclawResults = await this.openclaw.semanticSearch(query, 3)
      results.push(
        ...openclawResults.map((r) => ({
          source: 'openclaw',
          id: r.node.id,
          type: r.node.nodeType,
          name: r.node.name,
          content: r.node.content,
          score: r.score * 0.9, // 略降低增强源的分数
          metadata: { isEnhancement: true },
        }))
      )
    }

    // 3. 推理增强：YunPat 双链遍历
    if (options.enableReasoning) {
      const yunpatResults = await this.yunpat.conceptSearch(query, 3)

      // 对每个结果，扩展其双链网络
      for (const result of yunpatResults) {
        const connectedPages = await this.yunpat.getConnectedPages(result.concept.name, {
          depth: 1,
          direction: 'both',
        })

        // 将连接的页面也加入结果
        for (const [page, distance] of connectedPages) {
          if (distance === 1) {
            results.push({
              source: 'yunpat',
              id: page,
              type: 'wiki_page',
              name: page,
              content: await this.yunpat.getPageContent(page),
              score: result.score * 0.8,
              metadata: { connectionType: 'backlink', isEnhancement: true },
            })
          }
        }
      }
    }

    // 4. 融合排序（Athena 优先）
    return this.fusionRank(results, options.topK || 10)
  }

  /**
   * 关系推理：
   * 1. 主推理：Athena Neo4j 图查询
   * 2. 辅助推理：YunPat 双链路径查找
   */
  async inferRelation(concept1: string, concept2: string): Promise<RelationInference> {
    // 1. Athena Neo4j: 图查询（主要）
    const neo4jPath = await this.athena.queryNeo4j(
      `
      MATCH path = shortestPath(
        (a {name: $concept1})-[*..3]-(b {name: $concept2})
      )
      RETURN [node in path | node.name] as path
    `,
      { concept1, concept2 }
    )

    if (neo4jPath.length > 0) {
      return {
        relation: `Neo4j 路径: ${neo4jPath.join(' → ')}`,
        confidence: 0.9,
        reasoning: ['Athena 法律世界模型图查询', `路径长度: ${neo4jPath.length}`],
        sources: ['athena'],
        isPrimary: true,
      }
    }

    // 2. YunPat: 双链路径查找（辅助）
    const yunpatPath = await this.findShortestPathYunpat(concept1, concept2)

    if (yunpatPath.length > 0) {
      return {
        relation: `双链路径: ${yunpatPath.join(' → ')}`,
        confidence: 0.7,
        reasoning: ['YunPat 双向链接路径查找', `路径长度: ${yunpatPath.length}`],
        sources: ['yunpat'],
        isPrimary: false,
      }
    }

    return {
      relation: '无直接关系',
      confidence: 0.0,
      reasoning: ['Athena 图查询和 YunPat 双链均未找到'],
      sources: [],
      isPrimary: false,
    }
  }

  /**
   * 融合排序策略
   */
  private fusionRank(results: KnowledgeResult[], topK: number): KnowledgeResult[] {
    // Athena 源加权
    const boosted = results.map((r) => ({
      ...r,
      finalScore: r.metadata?.isPrimary ? r.score * 1.2 : r.score,
    }))

    // 按最终分数排序
    const sorted = boosted.sort((a, b) => b.finalScore - a.finalScore)

    // 去重
    const seen = new Set<string>()
    const deduplicated: KnowledgeResult[] = []

    for (const result of sorted) {
      if (!seen.has(result.id)) {
        seen.add(result.id)
        deduplicated.push(result)

        if (deduplicated.length >= topK) {
          break
        }
      }
    }

    return deduplicated
  }

  /**
   * YunPat 双链路径查找（BFS）
   */
  private async findShortestPathYunpat(from: string, to: string): Promise<string[]> {
    const visited = new Set<string>([from])
    const queue: Array<{ page: string; path: string[] }> = [{ page: from, path: [from] }]

    while (queue.length > 0) {
      const { page, path } = queue.shift()!

      if (page === to) {
        return path
      }

      // 获取双向链接
      const forwards = await this.yunpat.getForwardlinks(page)
      const backlinks = await this.yunpat.getBacklinks(page)
      const neighbors = [...new Set([...forwards, ...backlinks])]

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({
            page: neighbor,
            path: [...path, neighbor],
          })
        }
      }
    }

    return []
  }
}
```

### Athena 客户端实现

```typescript
/**
 * Athena 客户端
 * 连接 Athena 法律世界模型的 PostgreSQL + Neo4j
 */
import { Pool } from 'pg'
import neo4j from 'neo4j-driver'

export class AthenaClient {
  private pgPool: Pool
  private neo4jDriver: any

  constructor() {
    // 连接 Athena PostgreSQL
    this.pgPool = new Pool({
      host: process.env.ATHENA_DB_HOST || 'localhost',
      port: parseInt(process.env.ATHENA_DB_PORT || '5432'),
      database: process.env.ATHENA_DB_NAME || 'athena',
      user: process.env.ATHENA_DB_USER || 'postgres',
      password: process.env.ATHENA_DB_PASSWORD,
    })

    // 连接 Athena Neo4j
    this.neo4jDriver = neo4j.driver(
      process.env.ATHENA_NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.ATHENA_NEO4J_USER || 'neo4j',
        process.env.ATHENA_NEO4J_PASSWORD || 'password'
      )
    )
  }

  /**
   * PostgreSQL 查询（结构化知识）
   */
  async queryPostgreSQL(query: string, options: { topK: number }) {
    const result = await this.pgPool.query(
      `SELECT id, title, category, subcategory, content, keywords, importance, confidence
       FROM knowledge_items
       WHERE title LIKE $1 OR content LIKE $1 OR keywords LIKE $1
       ORDER BY importance DESC, confidence DESC
       LIMIT $2`,
      [`%${query}%`, options.topK]
    )

    return result.rows
  }

  /**
   * Neo4j 查询（图关系）
   */
  async queryNeo4j(cypher: string, params: Record<string, any>): Promise<string[]> {
    const session = this.neo4jDriver.session()
    try {
      const result = await session.run(cypher, params)
      const records = result.records

      if (records.length > 0) {
        return records[0].get('path')
      }

      return []
    } finally {
      await session.close()
    }
  }

  /**
   * 获取知识统计
   */
  async getStats() {
    const pgResult = await this.pgPool.query('SELECT COUNT(*) FROM knowledge_items')

    return {
      postgresql: {
        totalRecords: parseInt(pgResult.rows[0].count),
      },
      neo4j: {
        // TODO: 获取 Neo4j 统计信息
      },
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    await this.pgPool.end()
    await this.neo4jDriver.close()
  }
}
```

### 查询选项

```typescript
export interface QueryOptions {
  topK?: number
  enableSemantic?: boolean // 启用 OpenClaw 语义检索
  enableReasoning?: boolean // 启用 YunPat 双链推理
  sources?: ('athena' | 'openclaw' | 'yunpat')[]
}

export interface KnowledgeResult {
  source: string
  id: string
  type: string
  name: string
  content: string
  score: number
  metadata?: {
    isPrimary?: boolean
    isEnhancement?: boolean
    confidence?: number
    connectionType?: string
  }
}

export interface RelationInference {
  relation: string
  confidence: number
  reasoning: string[]
  sources: string[]
  isPrimary?: boolean
}
```

## 🎯 实施步骤

### 阶段1: Athena 连接（1周）

```bash
# 1. 设置环境变量
export ATHENA_DB_HOST="localhost"
export ATHENA_DB_PORT="5432"
export ATHENA_DB_NAME="athena"
export ATHENA_DB_USER="postgres"
export ATHENA_DB_PASSWORD="your_password"
export ATHENA_NEO4J_URI="bolt://localhost:7687"
export ATHENA_NEO4J_USER="neo4j"
export ATHENA_NEO4J_PASSWORD="neo4j"

# 2. 测试连接
psql -h localhost -U postgres -d athena -c "SELECT COUNT(*) FROM knowledge_items"

# 3. 实现 Athena 客户端
cd packages/unified-knowledge-graph
touch src/AthenaClient.ts
```

### 阶段2: Athena-First 引擎（1-2周）

```typescript
// 重新设计 UnifiedKnowledgeGraph
export class UnifiedKnowledgeGraph {
  private athenaFirst: AthenaFirstKnowledgeGraph

  async query(query: string): Promise<KnowledgeResult[]> {
    return await this.athenaFirst.query(query, {
      topK: 10,
      enableSemantic: true,
      enableReasoning: true,
    })
  }
}
```

### 阶段3: Agent 集成（1周）

```typescript
class KnowledgeEnhancedAgent extends Agent {
  private kg: AthenaFirstKnowledgeGraph

  async execute(input, context) {
    // 查询 Athena-First 知识图谱
    const knowledge = await this.kg.query(input.question, {
      topK: 5,
      enableSemantic: true,
      enableReasoning: true,
    })

    // 构建增强 prompt（Athena 为主）
    const enhancedPrompt = this.buildPrompt(knowledge)

    // LLM 生成
    return await context.llm.chat(enhancedPrompt)
  }

  private buildPrompt(knowledge: KnowledgeResult[]): string {
    // Athena 结果（主要）
    const athenaKnowledge = knowledge
      .filter((k) => k.source === 'athena')
      .map((k) => `- ${k.name}: ${k.content}`)
      .join('\n')

    // 增强结果（辅助）
    const enhancement = knowledge
      .filter((k) => k.source !== 'athena')
      .map((k) => `[${k.source}] ${k.name}: ${k.content}`)
      .join('\n')

    return `
基于以下法律知识回答问题：

【Athena 法律世界模型】
${athenaKnowledge}

【增强知识】
${enhancement}

问题：{question}
`
  }
}
```

## 📊 方案对比

| 方案             | 主要知识源        | 增强源            | 优势                       | 推荐度         |
| ---------------- | ----------------- | ----------------- | -------------------------- | -------------- |
| **之前方案**     | OpenClaw (40k)    | YunPat (5k)       | 向量检索强                 | ⭐⭐⭐         |
| **Athena-First** | **Athena (超大)** | OpenClaw + YunPat | **权威性强 + 语义 + 推理** | **⭐⭐⭐⭐⭐** |

## 💡 核心优势

### 1. 权威性提升

**之前**: OpenClaw 专利知识（40k节点）

```typescript
const results = await openclaw.semanticSearch('等同侵权')
// 专利领域的向量检索
```

**之后**: Athena 法律世界模型（超大）

```typescript
const results = await athenaFirst.query('等同侵权', {
  // 主查询：Athena 法律世界的权威知识
  // 增强查询：OpenClaw 专利细节 + YunPat 关系推理
})
```

### 2. 查询策略

```
用户查询："等同侵权判断"

1. Athena PostgreSQL: 查询法律规则、审查指南
   → 返回：权威的法律条文和判断标准

2. OpenClaw 向量检索: 语义相似案例
   → 返回：具体的等同侵权案例

3. YunPat 双链遍历: 关联概念
   → 返回：三要素测试法、整体等同原则等

4. 融合排序: Athena 优先，增强源辅助
   → 最终结果：权威性 + 相关性 + 推理性
```

### 3. 关系推理增强

**之前**: 单一图查询

```typescript
const path = await openclaw.findPath('等同侵权', '三要素测试法')
```

**之后**: Athena 主推理 + YunPat 辅助推理

```typescript
// 1. Athena Neo4j: 法律世界的图关系（主要）
const athenaPath = await athena.queryNeo4j(...)

// 2. YunPat 双链: 概念路径（辅助）
const yunpatPath = await yunpat.findShortestPath(...)

// 3. 融合推理结果
return bestPath(athenaPath, yunpatPath)
```

## 🎉 总结

### Athena-First 架构

1. ✅ **主要知识源** - Athena 法律世界模型（PostgreSQL + Neo4j）
2. ✅ **语义增强** - OpenClaw 向量检索（40k节点）
3. ✅ **推理增强** - YunPat 双链遍历（5k双链）
4. ✅ **融合策略** - Athena 优先，增强源辅助

### 技术壁垒提升

| 维度           | 之前     | Athena-First               |
| -------------- | -------- | -------------------------- |
| **知识权威性** | 中等     | **极高**                   |
| **知识覆盖**   | 40k      | **Athena 超大 + 40k + 5k** |
| **检索能力**   | 向量检索 | **结构化 + 向量 + 图查询** |
| **推理能力**   | 图查询   | **Neo4j 图 + 双链遍历**    |
| **技术壁垒**   | ⭐⭐⭐   | **⭐⭐⭐⭐⭐**             |

### 立即可行

```typescript
// 1. 连接 Athena
import { AthenaFirstKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

const kg = new AthenaFirstKnowledgeGraph()
const results = await kg.query('等同侵权判断', {
  topK: 10,
  enableSemantic: true,
  enableReasoning: true,
})

// 2. 结果融合
// Athena (主要) + OpenClaw (语义) + YunPat (推理)
```

### 下一步

需要我：

1. **实现 Athena 客户端**（连接 PostgreSQL + Neo4j）？
2. **重构统一知识图谱引擎**（Athena-First 架构）？
3. **在 Agent 中集成测试**？

**这个方案将 Athena 的法律世界模型作为核心，充分利用其权威性和完整性！** 🚀
