/**
 * Few-shot提示管理器
 *
 * 管理工具选择的Few-shot示例，提升智能体工具选择准确性
 */
import { EnhancedTool } from '../tools/types.js'
/**
 * Few-shot示例
 */
export interface FewShotExample {
  id: string
  scenario: string
  userInput: string
  reasoning: string
  selectedTool: string
  toolParameters: Record<string, unknown>
  outcome: string
  alternatives?: string[]
  lessons?: string
}
/**
 * Few-shot示例库
 */
export declare class FewShotPromptManager {
  private examples
  private toolExamples
  /**
   * 添加示例
   */
  addExample(example: FewShotExample): void
  /**
   * 获取相关示例
   */
  getRelevantExamples(
    userInput: string,
    availableTools: EnhancedTool[],
    maxExamples?: number
  ): FewShotExample[]
  /**
   * 生成Few-shot提示
   */
  generateFewShotPrompt(
    userInput: string,
    availableTools: EnhancedTool[],
    context?: {
      conversationHistory?: Array<{
        role: string
        content: string
      }>
      currentTask?: string
    }
  ): string
  /**
   * 格式化工具列表
   */
  private formatToolsList
  /**
   * 格式化示例
   */
  private formatExample
  /**
   * 格式化对话历史
   */
  private formatConversationHistory
  /**
   * 分类示例
   */
  private categorizeExample
  /**
   * 判断类别是否相关
   */
  private isCategoryRelevant
  /**
   * 计算相似度（使用优化的计算器）
   */
  private calculateSimilarity
  /**
   * 初始化默认示例
   */
  initializeDefaultExamples(): void
  /**
   * 导出示例为JSON
   */
  exportExamples(): string
  /**
   * 从JSON导入示例
   */
  importExamples(jsonString: string): void
}
export declare const fewShotManager: FewShotPromptManager
//# sourceMappingURL=FewShotPromptManager.d.ts.map
