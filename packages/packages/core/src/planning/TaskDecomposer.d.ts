/**
 * 任务分解器
 *
 * 将高层目标递归分解为可执行的子目标和任务层次结构
 */
import type {
  HierarchicalPlan,
  DecompositionOptions,
  TaskDecomposerConfig,
  DecompositionRule,
  PlanningExecutionContext,
} from './types.js'
/**
 * 任务分解器
 */
export declare class TaskDecomposer {
  private config
  private dependencyAnalyzer
  private domainRules
  /**
   * 创建任务对象的辅助方法
   */
  private createTask
  constructor(config?: TaskDecomposerConfig)
  /**
   * 分解目标为层次化计划
   */
  decompose(
    goal: string,
    context?: Partial<PlanningExecutionContext>,
    options?: DecompositionOptions
  ): Promise<HierarchicalPlan>
  /**
   * 递归分解
   */
  private decomposeRecursive
  /**
   * 查找匹配的分解规则
   */
  private findMatchingRule
  /**
   * 检查目标是否匹配规则
   */
  private matchesRule
  /**
   * 应用分解规则
   */
  private applyRule
  /**
   * 基于规则的分解
   */
  private ruleBasedDecompose
  /**
   * 智能分解（使用LLM）
   */
  private intelligentDecompose
  /**
   * 构建分解提示词
   */
  private buildDecompositionPrompt
  /**
   * 解析分解结果
   */
  private parseDecompositionResult
  /**
   * 解析任务类型
   */
  private parseTaskType
  /**
   * 推断所需能力
   */
  private inferCapabilities
  /**
   * 解析优先级
   */
  private parsePriority
  /**
   * 创建叶子子目标（达到最大深度时）
   */
  private createLeafSubGoal
  /**
   * 计算统计信息
   */
  private calculateStats
  /**
   * 合并选项
   */
  private mergeOptions
  /**
   * 初始化领域规则
   */
  private initializeDomainRules
  /**
   * 添加自定义规则
   */
  addCustomRule(rule: DecompositionRule): void
  /**
   * 获取分解器统计信息
   */
  getStats(): {
    totalRules: number
    domainRulesCount: number
    customRulesCount: number
  }
}
//# sourceMappingURL=TaskDecomposer.d.ts.map
