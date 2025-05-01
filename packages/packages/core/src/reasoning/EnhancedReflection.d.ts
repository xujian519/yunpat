/**
 * 增强自我反思机制 (Enhanced Reflection)
 *
 * P1 准确率优化方案 #4
 *
 * 核心功能：
 * 1. 多维度反思（质量、完整性、一致性）
 * 2. 改进建议生成（具体、可执行）
 * 3. 自动迭代优化（最多3轮自我改进）
 * 4. 反思历史追踪（避免重复错误）
 *
 * @module reasoning/EnhancedReflection
 */
import { LLMAdapter, ExecutionContext } from '../lifecycle/Lifecycle.js'
import { TelemetryCollector } from '../observability/TelemetryCollector.js'
/**
 * 反思维度
 */
export declare enum ReflectionDimension {
  /** 质量评估 - 结果是否准确、相关 */
  QUALITY = 'quality',
  /** 完整性评估 - 是否遗漏重要信息 */
  COMPLETENESS = 'completeness',
  /** 一致性评估 - 是否存在矛盾或冲突 */
  CONSISTENCY = 'consistency',
  /** 安全性评估 - 是否存在安全风险 */
  SAFETY = 'safety',
  /** 效率评估 - 资源使用是否合理 */
  EFFICIENCY = 'efficiency',
}
/**
 * 质量评分等级
 */
export declare enum QualityLevel {
  /** 优秀 - 无需改进 */
  EXCELLENT = 'excellent',
  /** 良好 - 可选改进 */
  GOOD = 'good',
  /** 一般 - 建议改进 */
  FAIR = 'fair',
  /** 较差 - 必须改进 */
  POOR = 'poor',
  /** 失败 - 需要重做 */
  FAILED = 'failed',
}
/**
 * 改进优先级
 */
export declare enum ImprovementPriority {
  /** 高优先级 - 必须修复 */
  HIGH = 'high',
  /** 中优先级 - 建议修复 */
  MEDIUM = 'medium',
  /** 低优先级 - 可选优化 */
  LOW = 'low',
}
/**
 * 单维度评估结果
 */
export interface DimensionAssessment {
  /** 评估维度 */
  dimension: ReflectionDimension
  /** 质量等级 */
  level: QualityLevel
  /** 评分 (0-1) */
  score: number
  /** 评估理由 */
  reasoning: string
  /** 发现的问题 */
  issues: string[]
  /** 证据片段 */
  evidence?: string[]
}
/**
 * 改进建议
 */
export interface Improvement {
  /** 改进 ID */
  id: string
  /** 改进描述 */
  description: string
  /** 优先级 */
  priority: ImprovementPriority
  /** 相关维度 */
  relatedDimensions: ReflectionDimension[]
  /** 具体行动步骤 */
  actionSteps: string[]
  /** 预期效果 */
  expectedOutcome?: string
  /** 是否已应用 */
  applied: boolean
  /** 应用时间 */
  appliedAt?: Date
}
/**
 * 反思报告
 */
export interface ReflectionReport {
  /** 报告 ID */
  id: string
  /** 执行 ID */
  executionId: string
  /** 时间戳 */
  timestamp: Date
  /** 各维度评估 */
  assessments: DimensionAssessment[]
  /** 综合评分 (0-1) */
  overallScore: number
  /** 综合质量等级 */
  overallLevel: QualityLevel
  /** 改进建议列表 */
  improvements: Improvement[]
  /** 是否需要迭代 */
  needsIteration: boolean
  /** 迭代原因 */
  iterationReason?: string
  /** 置信度 */
  confidence: number
}
/**
 * 反思历史记录
 */
export interface ReflectionRecord {
  /** 执行 ID */
  executionId: string
  /** 时间戳 */
  timestamp: Date
  /** 反思报告 */
  report: ReflectionReport
  /** 是否进行了迭代 */
  iterated: boolean
  /** 迭代次数 */
  iterationCount: number
  /** 最终结果 */
  finalResult?: unknown
}
/**
 * 迭代结果
 */
export interface IterationResult {
  /** 迭代次数 */
  iterationCount: number
  /** 是否成功 */
  success: boolean
  /** 最终结果 */
  result: unknown
  /** 所有反思报告 */
  reports: ReflectionReport[]
  /** 应用的改进 */
  appliedImprovements: Improvement[]
  /** 总耗时 */
  duration: number
}
/**
 * 反思配置
 */
export interface ReflectionConfig {
  /** 最大迭代次数 */
  maxIterations: number
  /** 迭代阈值 - 低于此分数时触发迭代 */
  iterationThreshold: number
  /** 启用的评估维度 */
  enabledDimensions: ReflectionDimension[]
  /** 是否使用 LLM 进行深度分析 */
  useDeepAnalysis: boolean
  /** 是否记录历史 */
  recordHistory: boolean
  /** 历史记录最大数量 */
  maxHistorySize: number
  /** 是否与遥测系统集成 */
  enableTelemetry: boolean
}
/**
 * 增强自我反思机制
 *
 * 实现多维度、自动迭代的自我反思能力
 */
export declare class EnhancedReflection {
  private llm
  private config
  private telemetryCollector?
  private history
  private counter
  /**
   * 构造函数
   */
  constructor(
    llm: LLMAdapter,
    config?: Partial<ReflectionConfig>,
    telemetryCollector?: TelemetryCollector
  )
  /**
   * 核心方法：对结果进行反思
   *
   * @param result 执行结果
   * @param context 执行上下文
   * @param goal 原始目标（可选）
   * @returns 反思报告
   */
  reflect(result: unknown, context: ExecutionContext, goal?: string): Promise<ReflectionReport>
  /**
   * 生成改进建议（基于评估结果）
   *
   * @param reflection 反思报告
   * @returns 改进建议列表
   */
  generateImprovements(reflection: ReflectionReport): Improvement[]
  generateImprovements(assessments: DimensionAssessment[]): Improvement[]
  /**
   * 自动迭代优化
   *
   * @param result 当前结果
   * @param improvements 改进建议
   * @param context 执行上下文
   * @param reActFunction 重新执行函数
   * @returns 迭代结果
   */
  iterate(
    result: unknown,
    improvements: Improvement[],
    context: ExecutionContext,
    reActFunction: (improvements: Improvement[]) => Promise<unknown>
  ): Promise<IterationResult>
  /**
   * 获取反思历史
   *
   * @param limit 限制数量
   * @returns 历史记录
   */
  getReflectionHistory(limit?: number): ReflectionRecord[]
  /**
   * 获取特定执行的历史
   */
  getHistoryByExecution(executionId: string): ReflectionRecord | undefined
  /**
   * 获取重复错误模式
   *
   * 分析历史记录，找出重复出现的问题
   */
  getRepeatedErrorPatterns(): Array<{
    pattern: string
    count: number
  }>
  /**
   * 清除历史记录
   */
  clearHistory(): void
  /**
   * 更新配置
   */
  updateConfig(config: Partial<ReflectionConfig>): void
  /**
   * 获取配置
   */
  getConfig(): ReflectionConfig
  /**
   * 执行多维度评估
   */
  private performDimensionalAssessments
  /**
   * 使用 LLM 进行深度评估
   */
  private performLLMAssessment
  /**
   * 基于规则的快速评估
   */
  private performRuleBasedAssessment
  /**
   * 构建评估提示词
   */
  private buildAssessmentPrompt
  /**
   * 获取维度的系统提示词
   */
  private getSystemPromptForDimension
  /**
   * 解析评估响应
   */
  private parseAssessmentResponse
  /**
   * 计算综合评分
   */
  private calculateOverallScore
  /**
   * 判断是否需要迭代
   */
  private determineIterationNeed
  /**
   * 计算置信度
   */
  private calculateConfidence
  /**
   * 确定改进优先级
   */
  private determinePriority
  /**
   * 生成行动步骤
   */
  private generateActionSteps
  /**
   * 获取预期效果
   */
  private getExpectedOutcome
  /**
   * 分数转质量等级
   */
  private scoreToLevel
  /**
   * 限制分数在 0-1 范围
   */
  private clampScore
  /**
   * 获取维度标签
   */
  private getDimensionLabel
  /**
   * 添加到历史记录
   */
  private addToHistory
  /**
   * 记录遥测事件
   */
  private recordTelemetryEvent
}
/**
 * 创建增强反思实例
 */
export declare function createEnhancedReflection(
  llm: LLMAdapter,
  config?: Partial<ReflectionConfig>,
  telemetryCollector?: TelemetryCollector
): EnhancedReflection
//# sourceMappingURL=EnhancedReflection.d.ts.map
