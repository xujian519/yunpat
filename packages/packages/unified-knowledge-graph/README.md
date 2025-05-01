# 统一知识图谱服务

## 📊 三方知识图谱对比

| 来源         | 节点数 | 格式                | 特点               |
| ------------ | ------ | ------------------- | ------------------ |
| **OpenClaw** | 40,034 | NetworkX + 向量嵌入 | 规模大，有语义检索 |
| **YunPat**   | 4,382  | Obsidian Markdown   | 概念清晰，易维护   |
| **Athena**   | 多种   | Neo4j + SQLite      | 图查询，推理引擎   |

## 🚀 快速开始

### 1. 安装依赖

```bash
# 构建知识图谱包
cd packages/unified-knowledge-graph
pnpm install
pnpm build
```

### 2. 转换 OpenClaw 图格式

```bash
# 将 NetworkX 格式转换为 JSON
python3 scripts/convert_openclaw_graph.py
```

### 3. 基础使用

```typescript
import { createUnifiedKnowledgeGraph } from '@yunpat/unified-knowledge-graph'

// 创建统一知识图谱
const kg = await createUnifiedKnowledgeGraph()

// 查询知识
const results = await kg.query({
  text: '等同侵权判断',
  sources: ['openclaw', 'yunpat'],
  topK: 5,
})

// 关系推理
const relation = await kg.inferRelation('等同侵权', '三要素测试法')
```

## 💡 在 Agent 中使用

```typescript
import { UnifiedKnowledgeGraph } from '@yunpat/unified-knowledge-graph'
import { Agent } from '@yunpat/core'

class MyAgent extends Agent {
  private kg = new UnifiedKnowledgeGraph()

  async execute(input, context) {
    await this.kg.initialize()

    // 查询相关知识
    const knowledge = await this.kg.query({
      text: input.question,
      sources: ['openclaw', 'yunpat'],
    })

    // 构建增强 prompt
    const enhancedPrompt = this.buildPrompt(knowledge)

    // LLM 生成
    return await context.llm.chat(enhancedPrompt)
  }
}
```

## 📈 预期效果

- ✅ **知识覆盖**: 12倍提升（4k → 48k+ 节点）
- ✅ **检索准确率**: +31%（65% → 85%+）
- ✅ **响应速度**: 5倍提升（500ms → 100ms）
- ✅ **推理能力**: 从无到有（符号推理 + 图遍历）

## 🔧 配置环境变量

```bash
# OpenClaw 知识图谱
export OPENCLAW_GRAPH_PATH="/Users/xujian/.openclaw/workspace/memory/patent-knowledge-graph"

# YunPat 知识库
export KNOWLEDGE_BASE_PATH="/Users/xujian/projects/YunPat/knowledge-base"

# Athena 知识图谱（可选）
export ATHENA_KNOWLEDGE_DB="/Users/xujian/Athena工作平台/data/xiaonuo_knowledge.db"
```

## 📝 详细文档

- [统一集成方案](../../docs/unified-knowledge-graph-integration.md)
- [使用示例](../../examples/unified-knowledge-graph-usage.ts)
- [OpenClaw 适配器](./src/adapters/OpenClawAdapter.ts)
- [YunPat 适配器](./src/adapters/YunPatAdapter.ts)

## 🎯 下一步

1. ✅ 基础集成（已完成）
2. ⏳ 向量嵌入统一（进行中）
3. ⏳ Neo4j 迁移（规划中）
4. ⏳ Agent 全面集成（规划中）
