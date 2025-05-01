/**
 * 自动纠正器
 *
 * 对检测到的违规进行自动纠正，支持基于规则和基于LLM的纠正
 */
import type { LLMAdapter, Violation, CorrectionResult, ConstitutionalAIConfig } from './types.js'
/**
 * 自动纠正器
 */
export declare class AutoCorrector {
  private llm
  private config
  constructor(llm: LLMAdapter | null, config: ConstitutionalAIConfig)
  /**
   * 执行自动纠正
   */
  correct(content: string, violations: Violation[]): Promise<CorrectionResult>
  /**
   * 过滤可纠正的违规
   */
  private filterCorrectableViolations
  /**
   * 基于规则的纠正
   */
  private correctWithRules
  /**
   * 应用单个规则纠正
   */
  private applyRuleCorrection
  /**
   * 应用通用纠正规则
   */
  private applyGenericCorrection
  /**
   * 基于LLM的纠正
   */
  private correctWithLLM
  /**
   * 应用单个LLM纠正
   */
  private applyLLMCorrection
  /**
   * 构建纠正提示词
   */
  private buildCorrectionPrompt
  /**
   * 混合纠正策略
   */
  private correctWithHybrid
  /**
   * 判断是否为简单违规（适合规则纠正）
   */
  private isSimpleViolation
  /**
   * 验证纠正结果
   */
  verifyCorrection(
    originalContent: string,
    correctedContent: string,
    violations: Violation[]
  ): Promise<boolean>
}
//# sourceMappingURL=AutoCorrector.d.ts.map
