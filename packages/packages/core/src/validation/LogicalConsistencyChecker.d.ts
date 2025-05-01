/**
 * 逻辑一致性检查器 (LogicalConsistencyChecker)
 *
 * 检测内容中的逻辑矛盾、重复、逻辑断层等问题
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { LogicalInconsistency, LogicalConsistencyCheckerConfig } from './hallucination-types.js'
/**
 * 逻辑一致性检查器
 */
export declare class LogicalConsistencyChecker {
  private llm
  private config
  constructor(llm: LLMAdapter, config?: Partial<LogicalConsistencyCheckerConfig>)
  /**
   * 检查内容的逻辑一致性
   *
   * @param content 要检查的内容
   * @returns 逻辑不一致问题列表
   */
  checkConsistency(content: string): Promise<LogicalInconsistency[]>
  /**
   * 检测矛盾陈述
   *
   * @param content 内容文本
   * @returns 矛盾列表
   */
  private detectContradictions
  /**
   * 使用规则检测矛盾
   *
   * @param content 内容文本
   * @returns 矛盾列表
   */
  private detectContradictionsByRules
  /**
   * 判断两个句子是否矛盾
   *
   * @param sentence1 句子1
   * @param sentence2 句子2
   * @returns 是否矛盾
   */
  private areSentencesContradictory
  /**
   * 提取关键术语
   *
   * @param sentence 句子
   * @returns 关键术语列表
   */
  private extractKeyTerms
  /**
   * 使用LLM检测矛盾
   *
   * @param content 内容文本
   * @returns 矛盾列表
   */
  private detectContradictionsByLLM
  /**
   * 检测重复内容
   *
   * @param content 内容文本
   * @returns 重复问题列表
   */
  private detectDuplication
  /**
   * 计算两个文本的相似度
   *
   * @param text1 文本1
   * @param text2 文本2
   * @returns 相似度（0-1）
   */
  private calculateSimilarity
  /**
   * 检测逻辑断层
   *
   * @param content 内容文本
   * @returns 逻辑断层列表
   */
  private detectLogicalGaps
  /**
   * 在文本中查找位置
   *
   * @param content 完整文本
   * @param substring 要查找的子字符串
   * @returns 文本位置
   */
  private findLocationInText
  /**
   * 生成逻辑一致性报告
   *
   * @param inconsistencies 不一致问题列表
   * @returns 报告文本
   */
  generateConsistencyReport(inconsistencies: LogicalInconsistency[]): string
  /**
   * 获取逻辑一致性统计
   *
   * @param inconsistencies 不一致问题列表
   * @returns 统计信息
   */
  getConsistencyStats(inconsistencies: LogicalInconsistency[]): {
    total: number
    critical: number
    major: number
    minor: number
    byType: Record<string, number>
  }
}
//# sourceMappingURL=LogicalConsistencyChecker.d.ts.map
