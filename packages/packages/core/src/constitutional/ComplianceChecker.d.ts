/**
 * 合规检查器
 *
 * 对专利内容进行原则合规性检查，生成详细的合规报告
 */
import type { ConstitutionalPrinciple, ComplianceReport, ConstitutionalAIConfig } from './types.js'
/**
 * 合规检查器
 */
export declare class ComplianceChecker {
  private principles
  private config
  constructor(principles: ConstitutionalPrinciple[], config: ConstitutionalAIConfig)
  /**
   * 执行完整的合规检查
   */
  checkCompliance(content: string): Promise<ComplianceReport>
  /**
   * 并发检查多个原则
   */
  private checkPrinciplesConcurrently
  /**
   * 检查单个原则
   */
  private checkSinglePrinciple
  /**
   * 计算总体合规分数
   */
  private calculateOverallScore
  /**
   * 按严重程度排序违规
   */
  private sortViolationsBySeverity
  /**
   * 获取原则列表
   */
  getPrinciples(): ConstitutionalPrinciple[]
  /**
   * 获取配置
   */
  getConfig(): ConstitutionalAIConfig
  /**
   * 更新配置
   */
  updateConfig(config: Partial<ConstitutionalAIConfig>): void
}
//# sourceMappingURL=ComplianceChecker.d.ts.map
