/**
 * 恢复策略选择器
 *
 * 根据偏离类型和严重程度，选择最合适的恢复策略
 */
import type {
  RecoveryStrategy,
  RecoveryStrategyType,
  DeviationReport,
  ReplanningContext,
} from './types.js'
/**
 * 恢复策略选择器
 */
export declare class RecoveryStrategySelector {
  private strategies
  constructor()
  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategies
  /**
   * 选择最佳恢复策略
   */
  selectBestStrategy(
    deviationReport: DeviationReport,
    context: ReplanningContext,
    preferredStrategies?: RecoveryStrategyType[]
  ): Promise<RecoveryStrategy>
  /**
   * 获取候选策略
   */
  private getCandidateStrategies
  /**
   * 判断策略是否适用
   */
  private isStrategyApplicable
  /**
   * 场景匹配
   */
  private scenarioMatches
  /**
   * 为策略评分
   */
  private scoreStrategies
  /**
   * 计算策略分数
   */
  private calculateStrategyScore
  /**
   * 获取最大严重程度
   */
  private getMaxSeverity
  /**
   * 计算严重程度匹配度
   */
  private calculateSeverityMatch
  /**
   * 获取历史成功率
   */
  private getHistoricalSuccess
  /**
   * 添加自定义策略
   */
  addStrategy(strategy: RecoveryStrategy): void
  /**
   * 移除策略
   */
  removeStrategy(strategyName: RecoveryStrategyType): void
  /**
   * 获取所有策略
   */
  getAllStrategies(): RecoveryStrategy[]
}
//# sourceMappingURL=RecoveryStrategySelector.d.ts.map
