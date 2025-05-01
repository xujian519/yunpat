/**
 * 批处理器 - 优化 LLM API 调用成本
 *
 * 核心功能：
 * 1. 批量生成章节 - 将多个章节合并为单个请求
 * 2. 批量接口适配 - 使用结构化输出格式
 * 3. 智能分批 - 根据章节数量和 Token 长度自动分批
 *
 * 成本节省：
 * - 当前：5个章节 = 5次API调用
 * - 优化后：5个章节 = 1次API调用
 * - 节省：60-80% API成本
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
/**
 * 章节生成结果
 */
export interface BatchSectionResult {
  /** 章节标题 */
  heading: string
  /** 章节内容 */
  content: string
  /** 词数 */
  wordCount: number
}
/**
 * 批处理配置
 */
export interface BatchConfig {
  /** 单批最大章节数 */
  maxSectionsPerBatch: number
  /** 批处理超时时间（毫秒） */
  timeout: number
  /** 是否启用批处理 */
  enabled: boolean
  /** 最大 Token 限制（默认 4000） */
  maxTokens?: number
  /** 模型名称（用于精确 Token 计数） */
  modelName?: string
  /** 是否启用智能分批（基于 Token） */
  enableSmartBatching?: boolean
}
/**
 * 批处理器
 *
 * 通过合并多个章节生成请求为单个API调用来降低成本
 */
export declare class BatchProcessor {
  private config
  private llm
  private tokenCounter
  private batchOptimizer?
  constructor(llm: LLMAdapter, config?: Partial<BatchConfig>)
  /**
   * 批量生成章节
   *
   * @param sections - 章节标题列表
   * @param plan - 写作计划
   * @param context - 执行上下文
   * @returns 章节标题到内容的映射
   */
  batchGenerate(
    sections: string[],
    plan: unknown,
    context: unknown
  ): Promise<Map<string, BatchSectionResult>>
  /**
   * 创建批次 - 智能分批策略
   */
  private createBatches
  /**
   * 简单分批策略（基于章节数量）
   */
  private createSimpleBatches
  /**
   * 智能分批策略（基于 Token 长度）
   */
  private createSmartBatches
  /**
   * 估算章节的 Token 数量
   */
  private estimateSectionTokens
  /**
   * 处理单个批次
   */
  private processBatch
  /**
   * 构建批量提示
   */
  private buildBatchPrompt
  /**
   * 估算提示 Token 数
   */
  private estimatePromptTokens
  /**
   * 解析批量响应
   */
  private parseBatchResponse
  /**
   * 回退到顺序处理（兼容模式）
   *
   * @param context - 保留参数，用于未来扩展（如使用 context 中的其他信息）
   */
  private fallbackToSequential
  /**
   * 构建单个章节提示（用于回退模式）
   */
  private buildSectionPrompt
  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchConfig>): void
  /**
   * 获取当前配置
   */
  getConfig(): BatchConfig
  /**
   * 启用批处理
   */
  enable(): void
  /**
   * 禁用批处理
   */
  disable(): void
  /**
   * 估算成本节省
   *
   * @param sectionCount - 章节总数
   * @returns 成本节省信息
   */
  estimateCostSavings(sectionCount: number): {
    originalCalls: number
    batchCalls: number
    savedCalls: number
    savingsPercentage: number
  }
}
//# sourceMappingURL=BatchProcessor.d.ts.map
