/**
 * 事实验证器 (FactChecker)
 *
 * 用于验证LLM生成内容中的事实声明，确保技术事实、法律判例、统计数据的准确性
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
import { KnowledgeBase } from '../knowledge/KnowledgeBase.js'
import { Claim, FactCheckResult, FactCheckerConfig } from './hallucination-types.js'
import { ExternalFactCheckOptions, AggregatedFactCheck } from './ExternalFactChecker.js'
/**
 * 事实验证器
 */
export declare class FactChecker {
  private llm
  private knowledgeBase
  private config
  private externalChecker?
  constructor(llm: LLMAdapter, knowledgeBase: KnowledgeBase, config?: Partial<FactCheckerConfig>)
  /**
   * 验证内容中的所有声明
   *
   * @param content 要验证的内容
   * @returns 事实验证结果列表
   */
  verifyContent(content: string): Promise<FactCheckResult[]>
  /**
   * 提取内容中的声明
   *
   * @param content 内容文本
   * @returns 提取的声明列表
   */
  private extractClaims
  /**
   * 使用正则表达式提取声明
   *
   * @param content 内容文本
   * @returns 提取的声明列表
   */
  private extractClaimsByRegex
  /**
   * 使用LLM提取声明
   *
   * @param content 内容文本
   * @returns 提取的声明列表
   */
  private extractClaimsByLLM
  /**
   * 验证单个声明
   *
   * @param claim 要验证的声明
   * @returns 事实验证结果
   */
  private verifyClaim
  /**
   * 使用知识库验证声明
   *
   * @param claim 要验证的声明
   * @returns 事实验证结果
   */
  private verifyWithKnowledgeBase
  /**
   * 合并多个验证方法的结果
   *
   * @param claim 原始声明
   * @param results 多个验证方法的结果
   * @returns 合并后的验证结果
   */
  private mergeVerificationResults
  /**
   * 对声明进行分类
   *
   * @param content 声明内容
   * @returns 声明类别
   */
  private categorizeClaim
  /**
   * 解析声明类别
   *
   * @param category 类别字符串
   * @returns 声明类别枚举
   */
  private parseClaimCategory
  /**
   * 批量验证声明
   *
   * @param claims 声明列表
   * @returns 事实验证结果列表
   */
  verifyClaims(claims: Claim[]): Promise<FactCheckResult[]>
  /**
   * 获取事实验证统计
   *
   * @param results 验证结果列表
   * @returns 统计信息
   */
  getFactCheckStats(results: FactCheckResult[]): {
    total: number
    verifiable: number
    verified: number
    unverified: number
    verificationRate: number
    avgConfidence: number
  }
  /**
   * 使用外部 API 验证声明
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 事实验证结果
   */
  verifyWithExternalAPI(claim: Claim, options?: ExternalFactCheckOptions): Promise<FactCheckResult>
  /**
   * 多源交叉验证
   *
   * @param claim 要验证的声明
   * @param options 验证选项
   * @returns 聚合验证结果
   */
  verifyCrossSources(claim: Claim, options?: ExternalFactCheckOptions): Promise<AggregatedFactCheck>
  /**
   * 获取知识库验证结果（转换为外部结果格式）
   *
   * @param claim 声明
   * @returns 外部验证结果或 undefined
   */
  private getKnowledgeBaseResult
  /**
   * 计算来源可信度
   *
   * @param isValid 验证状态
   * @returns 可信度分数
   */
  private calculateSourceCredibility
  /**
   * 批量外部验证
   *
   * @param claims 声明列表
   * @param options 验证选项
   * @returns 验证结果列表
   */
  verifyClaimsWithExternalAPI(
    claims: Claim[],
    options?: ExternalFactCheckOptions
  ): Promise<FactCheckResult[]>
  /**
   * 获取外部验证器状态
   *
   * @returns 状态信息
   */
  getExternalCheckerStatus(): {
    enabled: boolean
    configured: boolean
    cacheStats?: {
      size: number
      keys: string[]
    }
  }
  /**
   * 清除外部验证缓存
   */
  clearExternalCache(): void
}
//# sourceMappingURL=FactChecker.d.ts.map
