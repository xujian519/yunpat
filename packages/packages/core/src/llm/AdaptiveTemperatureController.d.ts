/**
 * 自适应温度控制器 - P0 准确率优化方案 #3
 *
 * 核心理念:
 * - 根据任务复杂度动态调整温度参数
 * - 简单任务使用低温度(0.1)提高准确率
 * - 复杂任务使用高温度(0.7)增加多样性
 * - 基于反馈实时调整,持续优化
 *
 * 预期效果:
 * - 简单任务准确率提升 > 15%
 * - 复杂任务多样性提升 > 20%
 */
import { TaskComplexity } from './TaskRouter.js'
import type { ChatParams } from '../lifecycle/Lifecycle.js'
/**
 * 任务描述接口
 */
export interface Task {
  /** 任务消息 */
  messages: ChatParams['messages']
  /** 任务描述(可选,用于复杂度评估) */
  description?: string
  /** 预期输出长度(可选) */
  expectedOutputLength?: number
}
/**
 * 质量反馈接口
 */
export interface QualityFeedback {
  /** 结果质量分数 (0-1) */
  qualityScore: number
  /** 是否需要更多多样性 */
  needsMoreDiversity?: boolean
  /** 是否需要更高准确性 */
  needsMoreAccuracy?: boolean
  /** 任务是否成功完成 */
  success?: boolean
}
/**
 * 温度参数接口
 */
export interface ThermalParams {
  /** 温度值 (0-1) */
  temperature: number
  /** Top-P 采样 (0-1) */
  topP?: number
  /** Top-K 采样 */
  topK?: number
  /** 复杂度评估结果 */
  complexity?: TaskComplexity
  /** 调整原因 */
  reason?: string
}
/**
 * 温度策略配置
 */
export interface TemperatureStrategyConfig {
  /** 简单任务温度 */
  simpleTemperature: number
  /** 中等任务温度 */
  mediumTemperature: number
  /** 复杂任务温度 */
  complexTemperature: number
  /** 最大温度上限 */
  maxTemperature: number
  /** 最小温度下限 */
  minTemperature: number
  /** 反馈调整步长 */
  adjustmentStep: number
  /** 反馈调整强度 (0-1) */
  feedbackStrength: number
}
/**
 * 自适应温度控制器
 *
 * 根据任务复杂度和历史反馈动态调整 LLM 温度参数
 */
export declare class AdaptiveTemperatureController {
  private config
  private history
  private maxHistorySize
  private baseTemperatures
  constructor(config?: Partial<TemperatureStrategyConfig>)
  /**
   * 评估任务复杂度
   *
   * 评估维度:
   * 1. 输入文本长度
   * 2. 任务描述关键词
   * 3. 预期输出长度
   * 4. 消息轮数
   */
  evaluateComplexity(task: Task): TaskComplexity
  /**
   * 获取任务推荐温度
   *
   * 根据复杂度返回对应的基础温度
   */
  getTemperature(task: Task): number
  /**
   * 获取完整的温度参数
   *
   * 返回包含温度、topP、topK 等参数的对象
   */
  getThermalParams(task: Task, customBaseTemp?: number): ThermalParams
  /**
   * 根据反馈调整温度
   *
   * @param currentTemp - 当前温度
   * @param feedback - 质量反馈
   * @param complexity - 任务复杂度
   * @returns 调整后的温度
   */
  adjustTemperature(
    currentTemp: number,
    feedback: QualityFeedback,
    complexity?: TaskComplexity
  ): number
  /**
   * 应用历史反馈的累积调整
   */
  private applyHistoryAdjustment
  /**
   * 计算 Top-P 值
   *
   * 温度越高，Top-P 越高（允许更多样的输出）
   */
  private calculateTopP
  /**
   * 计算 Top-K 值
   *
   * 温度越高，Top-K 越高
   */
  private calculateTopK
  /**
   * 生成原因说明
   */
  private getReasonString
  /**
   * 记录温度历史
   */
  private recordHistory
  /**
   * 获取历史统计
   */
  getHistoryStats(): {
    totalRecords: number
    averageTemperature: number
    successRate: number
    byComplexity: Record<
      string,
      {
        count: number
        avgTemp: number
        avgQuality: number
      }
    >
  }
  /**
   * 清空历史记录
   */
  clearHistory(): void
  /**
   * 获取配置
   */
  getConfig(): TemperatureStrategyConfig
  /**
   * 更新配置
   */
  updateConfig(updates: Partial<TemperatureStrategyConfig>): void
  /**
   * 重置为默认配置
   */
  resetToDefaults(): void
}
/**
 * 创建自适应温度控制器
 *
 * @param config - 部分配置（可选）
 * @returns 控制器实例
 */
export declare function createAdaptiveTemperatureController(
  config?: Partial<TemperatureStrategyConfig>
): AdaptiveTemperatureController
/**
 * 预设配置
 */
export declare const TemperaturePresets: {
  /** 保守模式 - 优先准确性 */
  conservative: Partial<TemperatureStrategyConfig>
  /** 平衡模式 - 准确性与多样性平衡 */
  balanced: Partial<TemperatureStrategyConfig>
  /** 创意模式 - 优先多样性 */
  creative: Partial<TemperatureStrategyConfig>
}
//# sourceMappingURL=AdaptiveTemperatureController.d.ts.map
