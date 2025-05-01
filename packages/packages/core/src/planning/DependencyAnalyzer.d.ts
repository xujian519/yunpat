/**
 * 依赖分析器
 *
 * 分析任务和子目标之间的依赖关系，构建依赖图，检测循环依赖
 */
import type { Dependency, DependencyGraph, SubGoal, DependencyAnalyzerConfig } from './types.js'
/**
 * 依赖分析器
 */
export declare class DependencyAnalyzer {
  private config
  constructor(config?: DependencyAnalyzerConfig)
  /**
   * 分析子目标之间的依赖关系
   */
  analyzeDependencies(subGoals: SubGoal[], existingDependencies?: Dependency[]): DependencyGraph
  /**
   * 检测隐式依赖关系
   */
  private detectImplicitDependencies
  /**
   * 检查两个子目标之间是否存在依赖关系
   */
  private checkDependency
  /**
   * 提取关键词
   */
  private extractKeywords
  /**
   * 计算关键词重叠度
   */
  private calculateKeywordOverlap
  /**
   * 检查任务类型依赖
   */
  private checkTaskTypeDependency
  /**
   * 推断依赖类型
   */
  private inferDependencyType
  /**
   * 检测循环依赖（使用DFS）
   */
  private detectCycles
  /**
   * 修复循环依赖（移除强度最低的边）
   */
  private fixCycles
  /**
   * 查找循环路径
   */
  private findCycle
  /**
   * 拓扑排序（Kahn算法）
   */
  private topologicalSort
  /**
   * 计算关键路径
   */
  findCriticalPath(graph: DependencyGraph): string[]
  /**
   * 计算统计信息
   */
  getStats(graph: DependencyGraph): {
    totalNodes: number
    totalEdges: number
    avgDegree: number
    maxDegree: number
    hasCycles: boolean
    criticalPathLength: number
  }
}
//# sourceMappingURL=DependencyAnalyzer.d.ts.map
