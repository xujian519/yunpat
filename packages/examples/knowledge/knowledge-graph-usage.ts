/**
 * 知识图谱集成使用示例
 *
 * 展示如何在 Agent 中集成专利知识图谱
 */

import { KnowledgeGraphTools, KnowledgeRAG } from '@yunpat/patent-knowledge'
import { Agent, type ExecutionContext } from '@yunpat/core'

// ============================================================================
// 示例1: 直接使用知识图谱工具
// ============================================================================

async function example1_DirectQuery() {
  const tools = new KnowledgeGraphTools('/path/to/knowledge-base')
  await tools.initialize('/path/to/knowledge-base')

  // 查询概念相关信息
  const relation = await tools.queryConcept('等同侵权')
  console.log('等同侵权的相关概念:', relation.relatedConcepts)
  console.log('相关页面:', relation.relatedPages)

  // 语义检索
  const results = await tools.semanticSearch('如何判断专利侵权？', 5)
  console.log('相关概念排序:', results)

  // 推理关系
  const relation1 = await tools.inferRelation('等同侵权', '三要素测试法')
  console.log('关系推理:', relation1)
}

// ============================================================================
// 示例2: 在 Agent 中使用知识图谱增强
// ============================================================================

class KnowledgeEnhancedPatentAgent extends Agent {
  private rag: KnowledgeRAG

  constructor(config: any) {
    super(config)
    this.rag = new KnowledgeRAG()
  }

  async execute(input: any, context: ExecutionContext) {
    // 1. 初始化知识图谱
    await this.rag.initialize(process.env.KNOWLEDGE_BASE_PATH)

    // 2. 构建 base prompt
    const basePrompt = `
你是一位专业的专利代理师。请分析以下专利问题：

${JSON.stringify(input, null, 2)}

请提供：
1. 法律分析
2. 相关案例
3. 风险评估
`

    // 3. 使用知识图谱增强 prompt
    const enhancedPrompt = await this.rag.enhancePrompt(input.question, basePrompt)

    // 4. 调用 LLM
    const result = await context.llm.chat(enhancedPrompt)

    return result
  }
}

// ============================================================================
// 示例3: 导出知识图谱到 Neo4j
// ============================================================================

async function example3_ExportToNeo4j() {
  const { KnowledgeGraphExporter } = await import('@yunpat/patent-knowledge')

  const exporter = new KnowledgeGraphExporter('/path/to/knowledge-base')

  // 导出为图结构
  const graph = await exporter.export()

  console.log('导出完成:')
  console.log('- 节点数:', graph.nodes.length)
  console.log('- 关系数:', graph.relationships.length)

  // 导出为 Cypher 脚本
  const cypher = exporter.toCypher()
  console.log('Cypher 脚本:', cypher.substring(0, 200) + '...')

  // 可以导入到 Neo4j:
  // cypher-shell -u neo4j -p password < graph.cypher
}

// ============================================================================
// 示例4: 知识图谱检索增强的专利撰写
// ============================================================================

class KnowledgeEnhancedClaimGenerator extends Agent {
  private tools: KnowledgeGraphTools

  constructor(config: any) {
    super(config)
    this.tools = new KnowledgeGraphTools()
  }

  protected async act(input: any, context: ExecutionContext) {
    // 1. 检索权利要求相关的法律概念
    const claimConcepts = await this.tools.semanticSearch(
      '独立权利要求 从属权利要求 必要技术特征',
      5
    )

    // 2. 获取每个概念的定义
    const conceptDefinitions = await Promise.all(
      claimConcepts.map(async ({ concept }) => ({
        concept,
        definition: await this.tools.getConceptDefinition(concept),
      }))
    )

    // 3. 构建增强的 prompt
    const systemPrompt = `
你是一位专业的专利撰写专家。在撰写权利要求时，请遵循以下法律原则：

${conceptDefinitions
  .filter(({ definition }) => definition.length > 0)
  .map(
    ({ concept, definition }) => `
### ${concept}
${definition.substring(0, 200)}...
`
  )
  .join('\n')}

请基于以上原则撰写权利要求。
`

    // 4. 调用 LLM
    const result = await context.llm.chat(systemPrompt, input.description)

    return result
  }
}

// ============================================================================
// 示例5: 概念关系推理
// ============================================================================

async function example5_ConceptReasoning() {
  const tools = new KnowledgeGraphTools()
  await tools.initialize('/path/to/knowledge-base')

  // 推理概念间的关系
  const queries = [
    ['等同侵权', '三要素测试法'],
    ['创造性', '三步法'],
    ['新颖性', '单独对比'],
    ['现有技术抗辩', '先用权'],
  ]

  for (const [concept1, concept2] of queries) {
    const relation = await tools.inferRelation(concept1, concept2)
    console.log(`${concept1} <-> ${concept2}: ${relation}`)
  }
}

// ============================================================================
// 使用说明
// ============================================================================

/**
 * ## 快速开始
 *
 * 1. 设置环境变量:
 *    export KNOWLEDGE_BASE_PATH=/Users/xujian/projects/YunPat/knowledge-base
 *
 * 2. 在 Agent 中使用:
 *    import { KnowledgeRAG } from '@yunpat/patent-knowledge'
 *    const rag = new KnowledgeRAG()
 *    await rag.initialize(process.env.KNOWLEDGE_BASE_PATH)
 *    const enhancedPrompt = await rag.enhancePrompt(query, basePrompt)
 *
 * 3. 导出到 Neo4j:
 *    import { KnowledgeGraphExporter } from '@yunpat/patent-knowledge'
 *    const exporter = new KnowledgeGraphExporter(process.env.KNOWLEDGE_BASE_PATH)
 *    const graph = await exporter.export()
 *    const cypher = exporter.toCypher()
 *
 * ## 技术优势
 *
 * 1. **符号推理**: 基于概念层次结构进行逻辑推理
 * 2. **知识增强**: 将专业知识注入 LLM 上下文
 * 3. **可解释性**: 记录推理过程，提供依据
 * 4. **增量学习**: 支持知识库的持续更新
 *
 * ## 下一步改进
 *
 * 1. 添加向量嵌入（使用 BGE-M3 或 text2vec）
 * 2. 集成 Neo4j 进行图查询和推理
 * 3. 实现约束求解器（法律规则的形式化验证）
 * 4. 构建专门的专利语言模型
 */
