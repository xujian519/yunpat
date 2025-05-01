import { LLMAdapter } from '../lifecycle/Lifecycle.js'
/**
 * 内容差异
 */
export interface ContentDiff {
  /** 差异列表 */
  changes: Array<{
    /** 变更类型 */
    type: 'modify' | 'add' | 'delete' | 'expand' | 'compress'
    /** 章节/段落标识 */
    section?: string
    /** 新要求（用于 modify） */
    newRequirement?: string
    /** 原始内容 */
    originalContent?: string
    /** 变更原因 */
    reason?: string
  }>
  /** 差异摘要 */
  summary: string
  /** 预估节省比例（0-1） */
  estimatedSavings: number
}
/**
 * 增量生成器
 *
 * 核心功能：
 * 1. 差异分析 - 分析新旧内容的差异
 * 2. 增量更新 - 只修改差异部分
 * 3. 智能扩展/压缩 - 保持结构的前提下调整长度
 *
 * 成本节省：
 * - 扩展任务：节省 ~70%
 * - 压缩任务：节省 ~50%
 * - 修改任务：节省 ~60%
 */
export declare class IncrementalGenerator {
  private readonly llm
  constructor(llm: LLMAdapter)
  /**
   * 分析差异
   *
   * @param originalContent 原始内容
   * @param newRequirements 新要求
   * @returns 内容差异
   */
  diff(originalContent: string, newRequirements: string): Promise<ContentDiff>
  /**
   * 增量更新
   *
   * @param originalContent 原始内容
   * @param diff 内容差异
   * @returns 更新后的内容
   */
  update(originalContent: string, diff: ContentDiff): Promise<string>
  /**
   * 智能扩展内容
   *
   * @param content 原始内容
   * @param referenceContent 参考内容（用于计算目标长度）
   * @returns 扩展后的内容
   */
  expand(content: string, referenceContent?: string): Promise<string>
  /**
   * 智能压缩内容
   *
   * @param content 原始内容
   * @param referenceContent 参考内容（用于计算目标长度）
   * @returns 压缩后的内容
   */
  compress(content: string, referenceContent?: string): Promise<string>
  /**
   * 修改指定章节
   */
  private modifySection
  /**
   * 添加新章节
   */
  private addSection
  /**
   * 删除章节
   */
  private deleteSection
  /**
   * 提取章节内容
   */
  private extractSection
  /**
   * 替换章节内容
   */
  private replaceSection
  /**
   * 构建差异分析提示
   */
  private buildDiffPrompt
  /**
   * 解析差异分析结果
   */
  private parseDiff
}
//# sourceMappingURL=IncrementalGenerator.d.ts.map
