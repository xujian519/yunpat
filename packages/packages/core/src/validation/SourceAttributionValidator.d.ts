/**
 * 源归属验证器 (SourceAttributionValidator)
 *
 * 检测内容中缺少引用、引用格式错误、来源不可信等问题
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import {
  Claim,
  SourceAttributionIssue,
  SourceAttributionValidatorConfig,
} from './hallucination-types.js'
/**
 * 源归属验证器
 */
export declare class SourceAttributionValidator {
  private llm
  private knowledgeBase
  private config
  constructor(
    llm: LLMAdapter,
    knowledgeBase: KnowledgeBase,
    config?: Partial<SourceAttributionValidatorConfig>
  )
  /**
   * 验证内容的源归属
   *
   * @param content 要验证的内容
   * @param claims 内容中的声明列表（可选）
   * @returns 源归属问题列表
   */
  validateAttribution(content: string, claims?: Claim[]): Promise<SourceAttributionIssue[]>
  /**
   * 简单的声明提取
   *
   * @param content 内容文本
   * @returns 声明列表
   */
  private extractSimpleClaims
  /**
   * 检查缺少引用的问题
   *
   * @param content 内容文本
   * @param claims 声明列表
   * @returns 缺少引用的问题列表
   */
  private checkMissingCitations
  /**
   * 检查文本中某位置附近是否有引用
   *
   * @param content 完整文本
   * @param claim 声明
   * @returns 是否有引用
   */
  private hasCitationNearby
  /**
   * 为声明建议来源
   *
   * @param claim 声明
   * @returns 建议的来源列表
   */
  private suggestSources
  /**
   * 检查引用格式问题
   *
   * @param content 内容文本
   * @returns 格式问题列表
   */
  private checkCitationFormats
  /**
   * 检查来源可信度
   *
   * @param content 内容文本
   * @returns 可信度问题列表
   */
  private checkSourceCredibility
  /**
   * 提取引用
   *
   * @param content 内容文本
   * @returns 引用列表
   */
  private extractCitations
  /**
   * 评估来源可信度
   *
   * @param citation 引用
   * @returns 可信度分数（0-1）
   */
  private assessSourceCredibility
  /**
   * 对声明进行分类
   *
   * @param content 声明内容
   * @returns 声明类别
   */
  private categorizeClaim
  /**
   * 获取类别标签
   *
   * @param category 声明类别
   * @returns 类别中文名称
   */
  private getCategoryLabel
  /**
   * 在文本中查找位置
   *
   * @param content 完整文本
   * @param substring 要查找的子字符串
   * @returns 文本位置
   */
  private findLocationInText
  /**
   * 生成源归属报告
   *
   * @param issues 源归属问题列表
   * @returns 报告文本
   */
  generateAttributionReport(issues: SourceAttributionIssue[]): string
  /**
   * 获取源归属统计
   *
   * @param issues 源归属问题列表
   * @returns 统计信息
   */
  getAttributionStats(issues: SourceAttributionIssue[]): {
    total: number
    critical: number
    major: number
    minor: number
    byType: Record<string, number>
  }
}
//# sourceMappingURL=SourceAttributionValidator.d.ts.map
