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
 * 默认温度策略配置
 */
const DEFAULT_CONFIG: TemperatureStrategyConfig = {
  simpleTemperature: 0.1,
  mediumTemperature: 0.3,
  complexTemperature: 0.7,
  maxTemperature: 0.8,
  minTemperature: 0.0,
  adjustmentStep: 0.05,
  feedbackStrength: 0.5,
}

/**
 * 温度历史记录
 */
interface TemperatureHistory {
  /** 时间戳 */
  timestamp: Date

  /** 任务复杂度 */
  complexity: TaskComplexity

  /** 使用的温度 */
  temperature: number

  /** 质量反馈 */
  feedback?: QualityFeedback
}

/**
 * 自适应温度控制器
 *
 * 根据任务复杂度和历史反馈动态调整 LLM 温度参数
 */
export class AdaptiveTemperatureController {
  private config: TemperatureStrategyConfig
  private history: TemperatureHistory[] = []
  private maxHistorySize = 100

  // 基础温度缓存（按复杂度）
  private baseTemperatures = new Map<TaskComplexity, number>()

  constructor(config?: Partial<TemperatureStrategyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // 初始化基础温度
    this.baseTemperatures.set(TaskComplexity.SIMPLE, this.config.simpleTemperature)
    this.baseTemperatures.set(TaskComplexity.MEDIUM, this.config.mediumTemperature)
    this.baseTemperatures.set(TaskComplexity.COMPLEX, this.config.complexTemperature)
  }

  /**
   * 评估任务复杂度
   *
   * 评估维度:
   * 1. 输入文本长度
   * 2. 任务描述关键词
   * 3. 预期输出长度
   * 4. 消息轮数
   */
  evaluateComplexity(task: Task): TaskComplexity {
    // 计算输入文本总长度
    const inputLength = task.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0)

    // 提取任务描述和最后一条用户消息
    const taskDesc = (task.description || '').toLowerCase()
    const lastUserMessage =
      task.messages
        .filter((m) => m.role === 'user')
        .pop()
        ?.content.toLowerCase() || ''

    // 复杂任务关键词
    const complexKeywords = [
      '分析',
      '深度分析',
      '详细',
      '全面',
      '研究',
      '调研',
      '设计',
      '架构',
      '实现',
      '优化',
      '重构',
      '性能',
      '安全',
      '算法',
      '策略',
      '方案',
      '长文',
      '报告',
      '文档',
      'explain',
      'analyze',
      'design',
      'implement',
      'optimize',
      'refactor',
      'architecture',
      'strategy',
      'detailed',
      'comprehensive',
      'research',
      'creative',
      'brainstorm',
      'innovative',
      'novel',
    ]

    // 简单任务关键词
    const simpleKeywords = [
      '摘要',
      '总结',
      '简短',
      '简要',
      '概要',
      '列表',
      '提取',
      '格式',
      '转换',
      '检查',
      '验证',
      '判断',
      '是否',
      'what',
      'which',
      'how to',
      'list',
      'check',
      'verify',
      'summarize',
      'brief',
      'extract',
      'classify',
      'categorize',
    ]

    // 检查关键词匹配
    const hasComplexKeyword = complexKeywords.some(
      (kw) => taskDesc.includes(kw) || lastUserMessage.includes(kw)
    )
    const hasSimpleKeyword = simpleKeywords.some(
      (kw) => taskDesc.includes(kw) || lastUserMessage.includes(kw)
    )

    // 评估逻辑
    if (
      hasComplexKeyword ||
      inputLength > 2000 ||
      (task.expectedOutputLength && task.expectedOutputLength > 1000)
    ) {
      return TaskComplexity.COMPLEX
    }

    if (hasSimpleKeyword || inputLength < 500) {
      return TaskComplexity.SIMPLE
    }

    // 默认为中等复杂度
    return TaskComplexity.MEDIUM
  }

  /**
   * 获取任务推荐温度
   *
   * 根据复杂度返回对应的基础温度
   */
  getTemperature(task: Task): number {
    const complexity = this.evaluateComplexity(task)
    return this.baseTemperatures.get(complexity) ?? this.config.mediumTemperature
  }

  /**
   * 获取完整的温度参数
   *
   * 返回包含温度、topP、topK 等参数的对象
   */
  getThermalParams(task: Task, customBaseTemp?: number): ThermalParams {
    const complexity = this.evaluateComplexity(task)
    let temperature =
      customBaseTemp ?? this.baseTemperatures.get(complexity) ?? this.config.mediumTemperature

    // 应用历史反馈的累积调整
    temperature = this.applyHistoryAdjustment(temperature, complexity)

    // 确保 temperature 在范围内
    temperature = Math.max(
      this.config.minTemperature,
      Math.min(this.config.maxTemperature, temperature)
    )

    // 根据 temperature 设置 topP 和 topK
    const topP = this.calculateTopP(temperature)
    const topK = this.calculateTopK(temperature)

    return {
      temperature,
      topP,
      topK,
      complexity,
      reason: this.getReasonString(complexity, temperature),
    }
  }

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
  ): number {
    let newTemp = currentTemp
    const step = this.config.adjustmentStep
    const strength = this.config.feedbackStrength

    // 基于质量分数调整
    if (feedback.qualityScore < 0.5) {
      // 质量低，如果是简单任务则降低温度，复杂任务则提高温度
      if (feedback.needsMoreAccuracy) {
        newTemp = currentTemp - step * strength * 2
      } else if (feedback.needsMoreDiversity) {
        newTemp = currentTemp + step * strength * 2
      }
    } else if (feedback.qualityScore > 0.8) {
      // 质量高，保持当前策略
      // 可以微调优化
      if (feedback.needsMoreAccuracy && currentTemp > this.config.minTemperature + step) {
        newTemp = currentTemp - step * strength * 0.5
      }
    }

    // 基于成功/失败调整
    if (feedback.success === false) {
      // 失败了，根据复杂度调整
      if (complexity === TaskComplexity.SIMPLE) {
        // 简单任务失败，降低温度提高准确性
        newTemp = currentTemp - step
      } else if (complexity === TaskComplexity.COMPLEX) {
        // 复杂任务失败，可能需要更高温度增加探索
        newTemp = currentTemp + step
      }
    }

    // 确保在范围内
    newTemp = Math.max(this.config.minTemperature, Math.min(this.config.maxTemperature, newTemp))

    // 记录历史
    this.recordHistory(complexity ?? TaskComplexity.MEDIUM, currentTemp, feedback)

    return newTemp
  }

  /**
   * 应用历史反馈的累积调整
   */
  private applyHistoryAdjustment(baseTemp: number, complexity: TaskComplexity): number {
    // 获取最近的相同复杂度的历史记录
    const recentHistory = this.history.filter((h) => h.complexity === complexity).slice(-10)

    if (recentHistory.length === 0) {
      return baseTemp
    }

    // 计算平均调整
    let totalAdjustment = 0
    let validCount = 0

    for (const record of recentHistory) {
      if (record.feedback) {
        const { feedback } = record
        if (feedback.success === false) {
          if (complexity === TaskComplexity.SIMPLE) {
            totalAdjustment -= this.config.adjustmentStep * 0.3
          } else {
            totalAdjustment += this.config.adjustmentStep * 0.3
          }
          validCount++
        } else if (feedback.qualityScore > 0.8) {
          // 成功且质量高，轻微保持当前方向
          totalAdjustment += (record.temperature - baseTemp) * 0.1
          validCount++
        }
      }
    }

    if (validCount > 0) {
      return baseTemp + totalAdjustment / validCount
    }

    return baseTemp
  }

  /**
   * 计算 Top-P 值
   *
   * 温度越高，Top-P 越高（允许更多样的输出）
   */
  private calculateTopP(temperature: number): number {
    // 线性映射：temperature 0 -> topP 0.5, temperature 1 -> topP 0.95
    return 0.5 + temperature * 0.45
  }

  /**
   * 计算 Top-K 值
   *
   * 温度越高，Top-K 越高
   */
  private calculateTopK(temperature: number): number {
    // 线性映射：temperature 0 -> topK 20, temperature 1 -> topK 50
    return Math.floor(20 + temperature * 30)
  }

  /**
   * 生成原因说明
   */
  private getReasonString(complexity: TaskComplexity, temperature: number): string {
    const complexityName = {
      [TaskComplexity.SIMPLE]: '简单',
      [TaskComplexity.MEDIUM]: '中等',
      [TaskComplexity.COMPLEX]: '复杂',
    }[complexity]

    return `任务复杂度: ${complexityName}, 推荐温度: ${temperature.toFixed(2)}`
  }

  /**
   * 记录温度历史
   */
  private recordHistory(
    complexity: TaskComplexity,
    temperature: number,
    feedback?: QualityFeedback
  ): void {
    this.history.push({
      timestamp: new Date(),
      complexity,
      temperature,
      feedback,
    })

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }

  /**
   * 获取历史统计
   */
  getHistoryStats(): {
    totalRecords: number
    averageTemperature: number
    successRate: number
    byComplexity: Record<string, { count: number; avgTemp: number; avgQuality: number }>
  } {
    if (this.history.length === 0) {
      return {
        totalRecords: 0,
        averageTemperature: 0,
        successRate: 0,
        byComplexity: {},
      }
    }

    const totalTemp = this.history.reduce((sum, h) => sum + h.temperature, 0)
    const successCount = this.history.filter((h) => h.feedback?.success).length

    // 按复杂度分组统计
    const byComplexity: Record<string, { count: number; avgTemp: number; avgQuality: number }> = {}

    for (const record of this.history) {
      const key = record.complexity
      if (!byComplexity[key]) {
        byComplexity[key] = { count: 0, avgTemp: 0, avgQuality: 0 }
      }
      byComplexity[key].count++
      byComplexity[key].avgTemp += record.temperature
      if (record.feedback?.qualityScore !== undefined) {
        byComplexity[key].avgQuality += record.feedback.qualityScore
      }
    }

    // 计算平均值
    for (const key in byComplexity) {
      const stats = byComplexity[key]
      stats.avgTemp /= stats.count
      stats.avgQuality /= stats.count
    }

    return {
      totalRecords: this.history.length,
      averageTemperature: totalTemp / this.history.length,
      successRate: (successCount / this.history.length) * 100,
      byComplexity,
    }
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = []
  }

  /**
   * 获取配置
   */
  getConfig(): TemperatureStrategyConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<TemperatureStrategyConfig>): void {
    this.config = { ...this.config, ...updates }

    // 更新基础温度映射
    this.baseTemperatures.set(TaskComplexity.SIMPLE, this.config.simpleTemperature)
    this.baseTemperatures.set(TaskComplexity.MEDIUM, this.config.mediumTemperature)
    this.baseTemperatures.set(TaskComplexity.COMPLEX, this.config.complexTemperature)
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.clearHistory()

    this.baseTemperatures.set(TaskComplexity.SIMPLE, this.config.simpleTemperature)
    this.baseTemperatures.set(TaskComplexity.MEDIUM, this.config.mediumTemperature)
    this.baseTemperatures.set(TaskComplexity.COMPLEX, this.config.complexTemperature)
  }
}

/**
 * 创建自适应温度控制器
 *
 * @param config - 部分配置（可选）
 * @returns 控制器实例
 */
export function createAdaptiveTemperatureController(
  config?: Partial<TemperatureStrategyConfig>
): AdaptiveTemperatureController {
  return new AdaptiveTemperatureController(config)
}

/**
 * 预设配置
 */
export const TemperaturePresets = {
  /** 保守模式 - 优先准确性 */
  conservative: {
    simpleTemperature: 0.0,
    mediumTemperature: 0.2,
    complexTemperature: 0.5,
    maxTemperature: 0.7,
  } as Partial<TemperatureStrategyConfig>,

  /** 平衡模式 - 准确性与多样性平衡 */
  balanced: {
    simpleTemperature: 0.1,
    mediumTemperature: 0.3,
    complexTemperature: 0.7,
    maxTemperature: 0.8,
  } as Partial<TemperatureStrategyConfig>,

  /** 创意模式 - 优先多样性 */
  creative: {
    simpleTemperature: 0.2,
    mediumTemperature: 0.5,
    complexTemperature: 0.8,
    maxTemperature: 1.0,
  } as Partial<TemperatureStrategyConfig>,
}
