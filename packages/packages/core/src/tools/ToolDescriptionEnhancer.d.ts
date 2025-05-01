/**
 * 工具描述增强器
 *
 * 自动为工具生成优化的描述、示例和使用场景
 */
import { EnhancedTool, ToolCategory } from './types.js'
/**
 * 增强的工具元数据
 */
export interface EnhancedToolMetadata {
  name: string
  description: string
  category?: ToolCategory
  detailedDescription?: string
  examples?: ToolExample[]
  commonUseCases?: string[]
  capabilities?: string[]
  dataTypes?: string[]
  limitations?: string[]
  prerequisites?: string[]
  relatedTools?: string[]
}
/**
 * 工具示例
 */
export interface ToolExample {
  description: string
  scenario: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  notes?: string
}
/**
 * 工具描述增强器
 */
export declare class ToolDescriptionEnhancer {
  /**
   * 增强工具元数据
   */
  enhanceMetadata(tool: EnhancedTool): EnhancedToolMetadata
  /**
   * 生成详细描述
   */
  private generateDetailedDescription
  /**
   * 生成使用示例
   */
  private generateExamples
  /**
   * 生成常见用例
   */
  private generateUseCases
  /**
   * 生成能力列表
   */
  private generateCapabilities
  /**
   * 生成支持的数据类型
   */
  private generateDataTypes
  /**
   * 生成限制说明
   */
  private generateLimitations
  /**
   * 生成前置条件
   */
  private generatePrerequisites
  /**
   * 生成相关工具
   */
  private generateRelatedTools
  private extractFeatures
  private extractUseCasesFromDescription
  private generatePdfExamples
  private generateDocxExamples
  private generateExcelExamples
  private generateWebExamples
  private getDefaultExample
  /**
   * 批量增强工具
   */
  enhanceTools(tools: EnhancedTool[]): Map<string, EnhancedToolMetadata>
  /**
   * 生成工具描述文档
   */
  generateDocumentation(enhancedMetadata: Map<string, EnhancedToolMetadata>): string
}
//# sourceMappingURL=ToolDescriptionEnhancer.d.ts.map
