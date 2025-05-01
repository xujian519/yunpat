/**
 * Constitutional AI 主类
 *
 * 整合合规检查和自动纠正功能，提供完整的Constitutional AI能力
 */
import type {
  LLMAdapter,
  ConstitutionalPrinciple,
  ComplianceReport,
  CorrectionResult,
  Violation,
  ConstitutionalAIConfig,
  ConflictResolution,
} from './types.js'
/**
 * Constitutional AI 主类
 */
export declare class ConstitutionalAI {
  private principles
  private config
  private checker
  private corrector
  private llm
  constructor(
    principles: ConstitutionalPrinciple[],
    llm?: LLMAdapter | null,
    config?: Partial<ConstitutionalAIConfig>
  )
  /**
   * 检查内容合规性
   */
  checkCompliance(content: string): Promise<ComplianceReport>
  /**
   * 纠正违规内容
   */
  correct(content: string, violations?: Violation[]): Promise<CorrectionResult>
  /**
   * 检查并纠正（一步完成）
   */
  checkAndCorrect(content: string): Promise<{
    report: ComplianceReport
    correction: CorrectionResult
  }>
  /**
   * 解决原则冲突
   */
  resolveConflicts(violations: Violation[]): Promise<ConflictResolution>
  /**
   * 检测冲突的违规
   */
  private detectConflicts
  /**
   * 获取原则优先级
   */
  private getPrinciplePriority
  /**
   * 批量检查多个内容
   */
  batchCheck(contents: string[]): Promise<ComplianceReport[]>
  /**
   * 生成合规报告（文本格式）
   */
  generateReportText(report: ComplianceReport): string
  /**
   * 获取启用的原则列表
   */
  getEnabledPrinciples(): ConstitutionalPrinciple[]
  /**
   * 获取配置
   */
  getConfig(): ConstitutionalAIConfig
  /**
   * 更新配置
   */
  updateConfig(config: Partial<ConstitutionalAIConfig>): void
  /**
   * 添加原则
   */
  addPrinciple(principle: ConstitutionalPrinciple): void
  /**
   * 移除原则
   */
  removePrinciple(principleId: string): void
  /**
   * 获取原则详情
   */
  getPrinciple(principleId: string): ConstitutionalPrinciple | undefined
  /**
   * 获取所有原则
   */
  getAllPrinciples(): ConstitutionalPrinciple[]
}
//# sourceMappingURL=ConstitutionalAI.d.ts.map
