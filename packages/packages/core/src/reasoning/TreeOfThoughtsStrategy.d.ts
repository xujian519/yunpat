/**
 * Tree-of-Thoughts (ToT) 推理策略
 *
 * 多路径探索+投票策略
 *
 * 核心功能：
 * 1. 生成多个思路 - 同时探索多条推理路径
 * 2. 评估思路 - 多维度评估（可行性、创新性、完整性、清晰度）
 * 3. 最佳优先搜索 - 寻找最佳解决方案
 * 4. 路径追踪 - 记录思考路径
 *
 * @module reasoning/TreeOfThoughtsStrategy
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
/**
 * 思维节点
 */
export interface ThoughtNode {
  /** 思路内容 */
  thought: string
  /** 评分 (0-10) */
  score: number
  /** 深度 */
  depth: number
  /** 父节点 */
  parent?: ThoughtNode
  /** 子节点 */
  children?: ThoughtNode[]
  /** 评估详情 */
  evaluation?: {
    /** 可行性 */
    feasibility: number
    /** 创新性 */
    innovation: number
    /** 完整性 */
    completeness: number
    /** 清晰度 */
    clarity: number
  }
}
/**
 * 思路选项
 */
export interface ThoughtOption {
  /** 思路内容 */
  thought: string
  /** 初始评分 */
  score: number
  /** 评估详情（可选） */
  evaluation?: {
    feasibility: number
    innovation: number
    completeness: number
    clarity: number
  }
}
/**
 * ToT 配置
 */
export interface ToTConfig {
  /** 最大深度 */
  maxDepth: number
  /** 分支因子（每个节点的子节点数） */
  branchFactor: number
  /** 温度参数（高温度鼓励多样性） */
  temperature: number
  /** 是否启用详细日志 */
  verbose: boolean
}
/**
 * Tree-of-Thoughts 策略
 *
 * 思维树，探索多个可能的思考路径
 */
export declare class TreeOfThoughtsStrategy {
  private llm
  private config
  constructor(llm: LLMAdapter, config?: Partial<ToTConfig>)
  /**
   * 生成思维树
   */
  generateThoughts(
    problem: string,
    branchFactor?: number
  ): Promise<
    Array<{
      thought: string
      score: number
    }>
  >
  /**
   * 评估思路（多维度评估）
   */
  evaluateThoughts(
    problem: string,
    thoughts: Array<{
      thought: string
      score: number
    }>
  ): Promise<
    Array<{
      thought: string
      score: number
      evaluation?: unknown
    }>
  >
  /**
   * 最佳优先搜索 - 寻找最佳解决方案
   */
  bestFirstSearch(problem: string, maxDepth?: number, branchFactor?: number): Promise<ThoughtNode>
  /**
   * 获取最佳思路的完整路径
   */
  getBestPath(node: ThoughtNode): string[]
  /**
   * 解析思路列表
   */
  private parseThoughts
  /**
   * 解析评估结果
   */
  private parseEvaluations
  /**
   * 解析单个评估分数
   */
  private parseScores
}
//# sourceMappingURL=TreeOfThoughtsStrategy.d.ts.map
