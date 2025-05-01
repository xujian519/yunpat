/**
 * 工具选择准确性提升系统
 *
 * 整合工具描述增强、Few-shot提示、使用追踪三大系统
 */
import { EnhancedTool } from './types.js'
/**
 * 工具选择优化器
 */
export declare class ToolSelectionOptimizer {
  private descriptionEnhancer
  private fewShotManager
  constructor()
  /**
   * 优化工具选择提示
   */
  optimizeToolSelectionPrompt(
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
   * 生成优化提示
   */
  private generateOptimizedPrompt
  /**
   * 格式化工具描述
   */
  private formatToolDescription
  /**
   * 格式化Few-shot示例
   */
  private formatFewShotExample
  /**
   * 格式化对话历史
   */
  private formatConversationHistory
  /**
   * 记录工具使用
   */
  recordToolUsage(
    toolName: string,
    userInput: string,
    toolParameters: Record<string, unknown>,
    result: {
      success: boolean
      executionTime: number
      output?: unknown
      error?: string
    },
    context?: {
      sessionId?: string
      userId?: string
      conversationHistory?: Array<{
        role: string
        content: string
      }>
    }
  ): string
  /**
   * 获取性能报告
   */
  getPerformanceReport(): string
  /**
   * 分析选择准确性
   */
  analyzeSelectionAccuracy(): {
    accuracy: number
    improvements: string[]
  }
  /**
   * 生成工具描述文档
   */
  generateToolDocumentation(availableTools: EnhancedTool[]): string
}
export declare const toolSelectionOptimizer: ToolSelectionOptimizer
//# sourceMappingURL=ToolSelectionOptimizer.d.ts.map
