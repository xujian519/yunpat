/**
 * 知识增强 Agent 基类
 *
 * 为所有法律/专利相关的 Agent 提供知识图谱能力
 *
 * 使用方式：
 * 1. 继承 KnowledgeEnhancedAgent 而不是 Agent
 * 2. 在 execute 中自动使用知识图谱增强
 * 3. 通过 queryKnowledge 和 inferRelation 方法访问知识
 */
import { Agent } from './Agent.js'
/**
 * 知识增强 Agent 基类
 *
 * 自动为 Agent 提供知识图谱能力
 */
export class KnowledgeEnhancedAgent extends Agent {
  knowledgeGraph
  enableKnowledgeGraph
  constructor(config) {
    super(config)
    this.enableKnowledgeGraph = config.enableKnowledgeGraph ?? true
  }
  /**
   * 初始化（自动调用）
   */
  async init(_context) {
    if (this.enableKnowledgeGraph) {
      try {
        const { createKnowledgeGraph } = await import('@yunpat/unified-knowledge-graph')
        this.knowledgeGraph = await createKnowledgeGraph()
        console.log(`[${this.name}] ✅ 知识图谱已启用`)
      } catch (err) {
        console.warn(`[${this.name}] ⚠️ 知识图谱初始化失败:`, err?.message || err)
        this.knowledgeGraph = undefined
      }
    }
  }
  /**
   * 查询知识图谱
   *
   * @param queryText - 查询文本
   * @param topK - 返回结果数量（默认 5）
   * @returns 知识结果数组
   */
  async queryKnowledge(queryText, topK = 5) {
    if (!this.knowledgeGraph) {
      console.warn(`[${this.name}] 知识图谱未启用`)
      return []
    }
    try {
      return await this.knowledgeGraph.query(queryText, { topK })
    } catch (err) {
      console.error(`[${this.name}] 知识图谱查询失败:`, err)
      return []
    }
  }
  /**
   * 推理概念间的关系
   *
   * @param concept1 - 概念 1
   * @param concept2 - 概念 2
   * @returns 关系推理结果
   */
  async inferRelation(concept1, concept2) {
    if (!this.knowledgeGraph) {
      console.warn(`[${this.name}] 知识图谱未启用`)
      return {
        relation: '知识图谱未启用',
        confidence: 0.0,
        reasoning: [],
        sources: [],
      }
    }
    try {
      return await this.knowledgeGraph.inferRelation(concept1, concept2)
    } catch (err) {
      console.error(`[${this.name}] 关系推理失败:`, err)
      return {
        relation: '推理失败',
        confidence: 0.0,
        reasoning: [err?.message || String(err)],
        sources: [],
      }
    }
  }
  /**
   * 构建知识增强的 Prompt
   *
   * @param userQuery - 用户查询
   * @param knowledgeResults - 知识检索结果
   * @returns 增强后的 Prompt
   */
  buildKnowledgeEnhancedPrompt(userQuery, knowledgeResults) {
    if (knowledgeResults.length === 0) {
      return userQuery
    }
    // 按来源分组
    const postgresqlVector = knowledgeResults.filter((k) => k.source === 'postgresql_vector')
    const postgresqlStructured = knowledgeResults.filter(
      (k) => k.source === 'postgresql_structured'
    )
    const yunpatConcepts = knowledgeResults.filter((k) => k.source === 'yunpat_concept')
    let prompt = `基于以下法律知识回答问题：\n\n`
    // PostgreSQL 向量检索结果
    if (postgresqlVector.length > 0) {
      prompt += `【法律条文与判例】（向量检索）\n`
      postgresqlVector.forEach((k, i) => {
        prompt += `${i + 1}. ${k.name}\n`
        prompt += `   ${k.content.substring(0, 200)}...\n\n`
      })
    }
    // PostgreSQL 结构化查询结果
    if (postgresqlStructured.length > 0) {
      prompt += `【结构化知识】\n`
      postgresqlStructured.forEach((k, i) => {
        prompt += `${i + 1}. ${k.name}\n`
        prompt += `   ${k.content.substring(0, 200)}...\n\n`
      })
    }
    // YunPat 核心概念
    if (yunpatConcepts.length > 0) {
      prompt += `【核心概念】\n`
      yunpatConcepts.forEach((k, i) => {
        prompt += `${i + 1}. ${k.name}（${k.metadata?.level || 0}级概念）\n`
        if (k.content) {
          prompt += `   ${k.content.substring(0, 150)}...\n`
        }
        if (k.metadata?.relatedPages && k.metadata.relatedPages.length > 0) {
          prompt += `   相关页面: ${k.metadata.relatedPages.slice(0, 3).join(', ')}\n`
        }
        prompt += `\n`
      })
    }
    prompt += `---\n\n`
    prompt += `问题：${userQuery}\n\n`
    prompt += `请基于上述法律知识，结合你的专业知识，给出准确、详细的回答。`
    return prompt
  }
  /**
   * 知识增强的 execute 实现
   *
   * 自动从输入中提取关键词，查询知识图谱，构建增强 Prompt
   */
  async execute(input) {
    // 如果知识图谱未启用，直接调用父类方法
    if (!this.enableKnowledgeGraph || !this.knowledgeGraph) {
      return super.execute(input)
    }
    // 提取查询文本（子类可以覆盖 extractQueryText 方法）
    const queryText = this.extractQueryText(input)
    if (queryText) {
      // 查询知识图谱
      const knowledgeResults = await this.queryKnowledge(queryText, 5)
      // 构建增强 Prompt
      const enhancedPrompt = this.buildKnowledgeEnhancedPrompt(queryText, knowledgeResults)
      // 创建增强后的输入（子类可以覆盖）
      const enhancedInput = this.createEnhancedInput(input, enhancedPrompt, knowledgeResults)
      // 执行
      return super.execute(enhancedInput)
    }
    return super.execute(input)
  }
  /**
   * 从输入中提取查询文本
   *
   * 子类可以覆盖此方法以自定义提取逻辑
   */
  extractQueryText(input) {
    // 默认实现：尝试从 input 中提取 question、query、text 等字段
    if (typeof input === 'string') {
      return input
    }
    if (typeof input === 'object' && input !== null) {
      const obj = input
      return obj.question || obj.query || obj.text || obj.prompt || ''
    }
    return ''
  }
  /**
   * 创建增强后的输入
   *
   * 子类可以覆盖此方法以自定义增强逻辑
   */
  createEnhancedInput(originalInput, enhancedPrompt, knowledgeResults) {
    // 默认实现：如果 input 是对象，添加 knowledgeEnhancedPrompt 和 knowledgeResults
    if (typeof originalInput === 'object' && originalInput !== null) {
      return {
        ...originalInput,
        knowledgeEnhancedPrompt: enhancedPrompt,
        knowledgeResults,
      }
    }
    return originalInput
  }
}
//# sourceMappingURL=KnowledgeEnhancedAgent.js.map
