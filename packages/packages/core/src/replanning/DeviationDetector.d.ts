/**
 * 偏离检测器
 *
 * 监控计划执行过程，检测与预期的偏离
 */
import type { ExecutionState, DeviationReport } from './types.js'
/**
 * 偏离检测器
 */
export declare class DeviationDetector {
  private baselineMetrics
  private detectionHistory
  constructor()
  /**
   * 检测偏离
   */
  detectDeviations(
    plannedState: ExecutionState,
    actualState: ExecutionState,
    thresholds?: {
      scheduleDeviation?: number
      qualityDeviation?: number
      resourceDeviation?: number
    }
  ): Promise<DeviationReport>
  /**
   * 检测进度偏离
   */
  private detectScheduleDeviation
  /**
   * 检测质量偏离
   */
  private detectQualityDeviations
  /**
   * 检测资源偏离
   */
  private detectResourceDeviations
  /**
   * 检测依赖偏离
   */
  private detectDependencyDeviation
  /**
   * 计算总体偏离分数
   */
  private calculateOverallDeviationScore
  /**
   * 计算进度
   */
  private calculateProgress
  /**
   * 计算资源偏离
   */
  private calculateResourceDeviation
  /**
   * 获取受影响的子目标
   */
  private getAffectedGoals
  /**
   * 生成质量改进建议
   */
  private generateQualityImprovementSuggestions
  /**
   * 获取历史记录
   */
  getHistory(): DeviationReport[]
  /**
   * 清除历史记录
   */
  clearHistory(): void
  /**
   * 设置基线指标
   */
  setBaselineMetrics(metrics: Map<string, number>): void
  /**
   * 获取基线指标
   */
  getBaselineMetrics(): Map<string, number>
}
//# sourceMappingURL=DeviationDetector.d.ts.map
