/**
 * 统一知识图谱使用示例
 *
 * 展示如何在 Agent 中集成三方知识图谱
 */

import { UnifiedKnowledgeGraph, type KnowledgeQuery } from '@yunpat/unified-knowledge-graph'
import { Agent, type ExecutionContext } from '@yunpat/core'

// ============================================================================
// 示例1: 基础查询
// ============================================================================

async function example1_BasicQuery() {
  console.log('=== 示例1: 基础查询 ===\n')

  // 1. 创建统一知识图谱
  const kg = await createUnifiedKnowledgeGraph()

  // 2. 查询相关知识
  const query: KnowledgeQuery = {
    text: '等同侵权判断标准',
    sources: ['openclaw', 'yunpat'],
    method: 'hybrid',
    topK: 5,
  }

  const results = await kg.query(query)

  // 3. 输出结果
  console.log(`找到 ${results.length} 条相关知识:\n`)
  for (const result of results) {
    console.log(`[${result.source}] ${result.name}`)
    console.log(`  类型: ${result.type}`)
    console.log(`  相关性: ${result.score.toFixed(2)}`)
    console.log(`  内容: ${result.content.substring(0, 100)}...`)
    console.log()
  }

  // 4. 查看统计
  const stats = kg.getStats()
  console.log('知识图谱统计:', stats)
}

// ============================================================================
// 示例2: 关系推理
// ============================================================================

async function example2_RelationInference() {
  console.log('=== 示例2: 关系推理 ===\n')

  const kg = await createUnifiedKnowledgeGraph()

  // 推理概念间的关系
  const pairs = [
    ['等同侵权', '三要素测试法'],
    ['创造性', '三步法'],
    ['新颖性', '单独对比'],
  ]

  for (const [concept1, concept2] of pairs) {
    const inference = await kg.inferRelation(concept1, concept2)

    console.log(`${concept1} <-> ${concept2}:`)
    console.log(`  关系: ${inference.relation}`)
    console.log(`  置信度: ${inference.confidence.toFixed(2)}`)
    console.log(`  推理依据: ${inference.reasoning.join('; ')}`)
    console.log(`  数据来源: ${inference.sources.join(', ')}`)
    console.log()
  }
}

// ============================================================================
// 示例3: 在 Agent 中使用
// ============================================================================

class KnowledgeEnhancedPatentAgent extends Agent {
  private kg: UnifiedKnowledgeGraph

  constructor(config: any) {
    super(config)
    this.kg = new UnifiedKnowledgeGraph()
  }

  async execute(input: any, context: ExecutionContext) {
    // 1. 初始化知识图谱
    await this.kg.initialize()

    // 2. 提取关键概念
    const concepts = await this.extractConcepts(input)

    // 3. 查询相关知识
    const knowledgeResults = await this.kg.query({
      text: concepts.join(' '),
      sources: ['openclaw', 'yunpat'],
      method: 'hybrid',
      topK: 5,
    })

    // 4. 构建知识增强的 prompt
    const systemPrompt = this.buildSystemPrompt(knowledgeResults)

    // 5. LLM 生成
    const userPrompt = `
用户问题：${input.question}

请基于以上专业知识分析问题，并提供：
1. 法律分析
2. 相关案例
3. 风险评估
`

    const result = await context.llm.chat(systemPrompt, userPrompt)

    // 6. 记录知识来源
    return {
      result,
      knowledgeSources: knowledgeResults.map((r) => ({
        source: r.source,
        name: r.name,
        url: this.getKnowledgeURL(r),
      })),
    }
  }

  private async extractConcepts(input: any): Promise<string[]> {
    // 简单实现：从用户输入中提取关键词
    const text = input.question || input.description || ''
    const keywords = text.match(/[专利侵权|权利要求|创造性|新颖性|等同侵权|现有技术]+/g) || []
    return [...new Set(keywords)]
  }

  private buildSystemPrompt(knowledgeResults: any[]): string {
    let prompt = `你是专业的专利代理师。在回答问题时，请参考以下专业知识：\n\n`

    knowledgeResults.forEach((result, i) => {
      prompt += `## 知识点 ${i + 1} [来源: ${result.source}]\n`
      prompt += `**${result.name}**\n`
      prompt += `${result.content.substring(0, 200)}...\n\n`
    })

    return prompt
  }

  private getKnowledgeURL(result: any): string {
    if (result.source === 'yunpat') {
      return `/knowledge-base/${result.metadata?.level || ''}/${result.name}`
    } else if (result.source === 'openclaw') {
      return `/openclaw/graph?node=${result.id}`
    }
    return '#'
  }
}

// ============================================================================
// 示例4: 专利侵权分析 Agent
// ============================================================================

class InfringementAnalysisAgent extends KnowledgeEnhancedPatentAgent {
  constructor(config: any) {
    super(config)
  }

  async execute(input: any, context: ExecutionContext) {
    await this.kg.initialize()

    // 1. 查询侵权相关概念
    const infringementKnowledge = await this.kg.query({
      text: '相同侵权 等同侵权 全面覆盖原则',
      sources: ['yunpat', 'openclaw'],
      topK: 3,
    })

    // 2. 推理概念关系
    const relation = await this.kg.inferRelation('等同侵权', '三要素测试法')

    // 3. 构建专业 prompt
    const systemPrompt = `
你是专利侵权分析专家。请基于以下专业知识分析侵权问题：

## 侵权相关概念
${infringementKnowledge.map((k) => `- **${k.name}**: ${k.content.substring(0, 100)}...`).join('\n')}

## 概念关系
- 等同侵权 ↔ 三要素测试法: ${relation.relation}

## 分析要点
1. 识别被控侵权产品的技术特征
2. 与专利权利要求进行特征对比
3. 判断是否构成相同侵权或等同侵权
4. 应用全面覆盖原则
`

    const result = await context.llm.chat(systemPrompt, input.description)

    return {
      analysis: result,
      knowledgeUsed: infringementKnowledge.length,
      confidence: relation.confidence,
    }
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🚀 统一知识图谱使用示例\n')

  try {
    // 运行示例
    await example1_BasicQuery()
    console.log('\n' + '='.repeat(60) + '\n')
    await example2_RelationInference()

    // 示例3: 在实际场景中使用
    // const agent = new InfringementAnalysisAgent({ name: 'infringement-analyzer' })
    // const result = await agent.execute({
    //   question: '如何判断产品A是否侵犯专利B？',
    //   description: '产品A的技术特征...'
    // })

    console.log('\n✅ 所有示例运行完成')
  } catch (error) {
    console.error('❌ 错误:', error)
  }
}

// 导出供外部使用
export {
  example1_BasicQuery,
  example2_RelationInference,
  KnowledgeEnhancedPatentAgent,
  InfringementAnalysisAgent,
}
