/**
 * 工具使用追踪器
 *
 * 追踪工具调用历史，分析性能，提供优化建议
 */
import { EventEmitter } from 'events'
/**
 * 工具使用记录
 */
export interface ToolUsageRecord {
  id: string
  timestamp: Date
  toolName: string
  sessionId: string
  userId?: string
  userInput: string
  toolParameters: Record<string, unknown>
  context?: {
    conversationHistory?: Array<{
      role: string
      content: string
    }>
    taskDescription?: string
  }
  result: {
    success: boolean
    executionTime: number
    output?: unknown
    error?: string
    errorMessage?: string
  }
  metadata?: {
    modelUsed?: string
    promptTokens?: number
    completionTokens?: number
    retries?: number
  }
}
/**
 * 工具性能统计
 */
export interface ToolPerformanceStats {
  toolName: string
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  successRate: number
  avgExecutionTime: number
  minExecutionTime: number
  maxExecutionTime: number
  lastUsed: Date
  mostCommonErrors: Array<{
    error: string
    count: number
  }>
  bestUseCases: Array<{
    useCase: string
    successRate: number
  }>
}
/**
 * 工具推荐
 */
export interface ToolRecommendation {
  toolName: string
  confidence: number
  reason: string
  expectedPerformance: {
    successRate?: number
    avgExecutionTime?: number
  }
}
/**
 * 工具使用追踪器
 */
export declare class ToolUsageTracker extends EventEmitter {
  private records
  private statsCache
  private storagePath
  private config
  constructor(
    storagePathOrConfig?:
      | string
      | {
          dataDirectory?: string
          maxRecords?: number
          retentionDays?: number
          autoSave?: boolean
        }
  )
  /**
   * 记录工具调用
   */
  recordUsage(record: ToolUsageRecord): string
  /**
   * 获取工具性能统计
   */
  getPerformanceStats(toolName: string): ToolPerformanceStats
  /**
   * 获取所有工具的性能统计
   */
  getAllPerformanceStats(): Map<string, ToolPerformanceStats>
  /**
   * 获取工具推荐
   */
  getRecommendations(userInput: string, availableTools: string[]): ToolRecommendation[]
  /**
   * 获取使用趋势
   */
  getUsageTrends(
    toolName: string,
    days?: number
  ): {
    toolName: string
    period: string
    totalCalls: number
    dailyAverage: number
    dailyUsage: {
      date: Date
      count: number
    }[]
  }
  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string
  /**
   * 分析工具选择准确性
   */
  analyzeSelectionAccuracy(): {
    accuracy: number
    improvements: string[]
  }
  private generateId
  private extractUseCase
  private isUseCaseMatch
  private generateRecommendationReason
  private groupToolsByCategory
  private inferCategory
  private updateStatsCache
  /**
   * 保存记录到文件
   */
  private saveRecords
  /**
   * 从文件加载记录
   */
  private loadRecords
  /**
   * 清理旧记录
   */
  cleanup(daysToKeep?: number): number
  /**
   * 清理旧数据（别名方法）
   */
  cleanupOldData(daysToKeep?: number): number
  /**
   * 设置自动保存开关
   */
  setAutoSave(enabled: boolean): void
  /**
   * 清空所有记录（用于测试）
   */
  clear(): void
  /**
   * 保存数据到文件
   */
  saveData(): Promise<void>
  /**
   * 从文件加载数据
   */
  loadData(): Promise<void>
}
export declare const toolUsageTracker: ToolUsageTracker
//# sourceMappingURL=ToolUsageTracker.d.ts.map
