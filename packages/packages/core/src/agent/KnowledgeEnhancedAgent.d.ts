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
import { Agent, AgentConfig } from './Agent.js'
import type { ExecutionContext } from '../lifecycle/Lifecycle.js'
export interface KnowledgeResult {
  source: string
  id: string
  type: string
  name: string
  content: string
  score: number
  metadata?: Record<string, any>
}
export interface RelationInference {
  relation: string
  confidence: number
  reasoning: string[]
  sources: string[]
}
export interface KnowledgeEnhancedAgentConfig extends AgentConfig {
  enableKnowledgeGraph?: boolean
}
/**
 * 知识图谱接口（动态加载）
 */
interface KnowledgeGraphInterface {
  query(
    queryText: string,
    options?: {
      topK?: number
    }
  ): Promise<KnowledgeResult[]>
  inferRelation(concept1: string, concept2: string): Promise<RelationInference>
}
/**
 * 知识增强 Agent 基类
 *
 * 自动为 Agent 提供知识图谱能力
 */
export declare abstract class KnowledgeEnhancedAgent<TInput = any, TOutput = any> extends Agent<
  TInput,
  TOutput
> {
  protected knowledgeGraph?: KnowledgeGraphInterface
  protected readonly enableKnowledgeGraph: boolean
  constructor(config: KnowledgeEnhancedAgentConfig)
  /**
   * 初始化（自动调用）
   */
  protected init?(_context: ExecutionContext): Promise<void>
  /**
   * 查询知识图谱
   *
   * @param queryText - 查询文本
   * @param topK - 返回结果数量（默认 5）
   * @returns 知识结果数组
   */
  protected queryKnowledge(queryText: string, topK?: number): Promise<KnowledgeResult[]>
  /**
   * 推理概念间的关系
   *
   * @param concept1 - 概念 1
   * @param concept2 - 概念 2
   * @returns 关系推理结果
   */
  protected inferRelation(concept1: string, concept2: string): Promise<RelationInference>
  /**
   * 构建知识增强的 Prompt
   *
   * @param userQuery - 用户查询
   * @param knowledgeResults - 知识检索结果
   * @returns 增强后的 Prompt
   */
  protected buildKnowledgeEnhancedPrompt(
    userQuery: string,
    knowledgeResults: KnowledgeResult[]
  ): string
  /**
   * 知识增强的 execute 实现
   *
   * 自动从输入中提取关键词，查询知识图谱，构建增强 Prompt
   */
  execute(input: TInput): Promise<TOutput>
  /**
   * 从输入中提取查询文本
   *
   * 子类可以覆盖此方法以自定义提取逻辑
   */
  protected extractQueryText(input: TInput): string
  /**
   * 创建增强后的输入
   *
   * 子类可以覆盖此方法以自定义增强逻辑
   */
  protected createEnhancedInput(
    originalInput: TInput,
    enhancedPrompt: string,
    knowledgeResults: KnowledgeResult[]
  ): TInput
}
export {}
//# sourceMappingURL=KnowledgeEnhancedAgent.d.ts.map
