/**
 * 幻觉检测器 (HallucinationDetector)
 *
 * 整合事实验证、逻辑一致性检查、源归属验证，综合评估内容中的幻觉程度
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import { ExecutionContext } from '../lifecycle/Lifecycle.js'
import { HallucinationReport, HallucinationDetectorConfig } from './hallucination-types.js'
/**
 * 幻觉检测器主类
 */
export declare class HallucinationDetector {
  private llm
  private knowledgeBase
  private config
  private factChecker
  private logicalConsistencyChecker
  private sourceAttributionValidator
  constructor(
    llm: LLMAdapter,
    knowledgeBase: KnowledgeBase,
    config?: Partial<HallucinationDetectorConfig>
  )
  /**
   * 检测内容中的幻觉
   *
   * @param content 要检测的内容
   * @param context 执行上下文（可选）
   * @returns 幻觉检测报告
   */
  detect(content: string, _context?: ExecutionContext): Promise<HallucinationReport>
  /**
   * 计算总体幻觉分数
   *
   * @param factCheckResults 事实验证结果
   * @param logicalInconsistencies 逻辑不一致问题
   * @param sourceAttributionIssues 源归属问题
   * @returns 幻觉分数（0-1，越低越好）
   */
  private calculateOverallScore
  /**
   * 计算事实验证分数
   *
   * @param results 事实验证结果
   * @returns 分数（0-1，越低越好）
   */
  private calculateFactCheckScore
  /**
   * 计算逻辑一致性分数
   *
   * @param inconsistencies 逻辑不一致问题
   * @returns 分数（0-1，越低越好）
   */
  private calculateLogicScore
  /**
   * 计算源归属分数
   *
   * @param issues 源归属问题
   * @returns 分数（0-1，越低越好）
   */
  private calculateAttributionScore
  /**
   * 生成改进建议
   *
   * @param factCheckResults 事实验证结果
   * @param logicalInconsistencies 逻辑不一致问题
   * @param sourceAttributionIssues 源归属问题
   * @returns 改进建议列表
   */
  private generateSuggestions
  /**
   * 生成人类可读的报告
   *
   * @param report 幻觉检测报告
   * @returns 格式化的报告文本
   */
  generateReport(report: HallucinationReport): string
  /**
   * 获取操作标签
   *
   * @param action 操作类型
   * @returns 中文标签
   */
  private getActionLabel
  /**
   * 快速检测（仅事实验证）
   *
   * @param content 内容文本
   * @returns 是否通过检测
   */
  quickCheck(content: string): Promise<boolean>
  /**
   * 批量检测
   *
   * @param contents 内容列表
   * @param onProgress 进度回调
   * @returns 幻觉检测报告列表
   */
  detectBatch(
    contents: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<HallucinationReport[]>
  /**
   * 获取检测器统计
   *
   * @param reports 检测报告列表
   * @returns 统计信息
   */
  getDetectorStats(reports: HallucinationReport[]): {
    totalReports: number
    avgScore: number
    highRiskCount: number
    mediumRiskCount: number
    lowRiskCount: number
    avgDuration: number
  }
}
//# sourceMappingURL=HallucinationDetector.d.ts.map
