/**
 * Chain-of-Thought (CoT) 推理策略
 *
 * 基础版单路径逐步推理引擎
 *
 * 核心功能：
 * 1. 逐步推理 - 将复杂问题分解为多个推理步骤
 * 2. 步骤解析 - 解析 LLM 返回的推理过程
 * 3. 结论提取 - 从推理过程中提取最终答案
 * 4. 置信度评估 - 评估推理过程的质量
 * 5. 错误恢复 - 推理失败时自动重试
 *
 * @module reasoning/ChainOfThoughtStrategy
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
/**
 * 推理步骤
 */
export interface ReasoningStep {
  /** 步骤编号 */
  step: number
  /** 步骤描述 */
  description: string
  /** 推理内容 */
  reasoning: string
  /** 中间结果（可选） */
  intermediateResult?: string
  /** 置信度 (0-1) */
  confidence: number
}
/**
 * CoT 推理结果
 */
export interface CoTResult {
  /** 推理步骤 */
  steps: ReasoningStep[]
  /** 最终结论 */
  conclusion: string
  /** 总体置信度 (0-1) */
  confidence: number
  /** 推理过程摘要 */
  summary: string
  /** Token 消耗 */
  tokensUsed: number
  /** 推理耗时（毫秒） */
  duration: number
}
/**
 * CoT 配置
 */
export interface CoTConfig {
  /** 最大推理步骤数 */
  maxSteps: number
  /** 是否启用中间验证 */
  enableIntermediateValidation: boolean
  /** 是否要求步骤格式化 */
  requireStepFormatting: boolean
  /** 失败时重试次数 */
  maxRetries: number
  /** 温度参数（较低温度使推理更确定） */
  temperature: number
  /** 是否启用详细日志 */
  verbose: boolean
}
/**
 * 步骤格式类型
 */
export declare enum StepFormat {
  /** 编号格式：步骤1、步骤2 */
  NUMBERED = 'numbered',
  /** 列表格式：1. 2. 3. */
  LIST = 'list',
  /** 项目符号：• - * */
  BULLET = 'bullet',
  /** 自动检测 */
  AUTO = 'auto',
}
/**
 * Chain-of-Thought 推理策略
 *
 * 让 LLM 逐步思考，展示完整的推理过程
 */
export declare class ChainOfThoughtStrategy {
  private llm
  private config
  constructor(llm: LLMAdapter, config?: Partial<CoTConfig>)
  /**
   * 执行逐步推理
   *
   * @param problem 需要推理的问题
   * @param context 上下文信息（可选）
   * @param format 步骤格式（可选）
   * @returns 推理结果
   */
  reason(
    problem: string,
    context?: Record<string, unknown>,
    format?: StepFormat
  ): Promise<CoTResult>
  /**
   * 生成 CoT 推理过程
   */
  private generateCoT
  /**
   * 构建 CoT 提示词
   */
  private buildCoTPrompt
  /**
   * 获取系统提示词
   */
  private getSystemPrompt
  /**
   * 获取步骤格式描述
   */
  private getStepFormatDescription
  /**
   * 获取步骤格式示例
   */
  private getStepFormatExample
  /**
   * 解析推理步骤
   */
  private parseReasoningSteps
  /**
   * 提取结论
   */
  private extractConclusion
  /**
   * 计算置信度
   */
  private calculateConfidence
  /**
   * 生成摘要
   */
  private generateSummary
  /**
   * 流式推理（返回 AsyncIterable）
   *
   * @param problem 需要推理的问题
   * @param context 上下文信息（可选）
   * @returns 推理步骤生成器
   */
  reasonStream(
    problem: string,
    context?: Record<string, unknown>
  ): AsyncIterable<
    | ReasoningStep
    | {
        conclusion: string
        confidence: number
      }
  >
  /**
   * 批量推理
   *
   * @param problems 问题数组
   * @param context 共享上下文（可选）
   * @returns 推理结果数组
   */
  reasonBatch(problems: string[], context?: Record<string, unknown>): Promise<CoTResult[]>
}
/**
 * 创建 Chain-of-Thought 策略实例（便捷函数）
 *
 * @param llm LLM 适配器
 * @param config 配置（可选）
 * @returns CoT 策略实例
 */
export declare function createChainOfThought(
  llm: LLMAdapter,
  config?: Partial<CoTConfig>
): ChainOfThoughtStrategy
//# sourceMappingURL=ChainOfThoughtStrategy.d.ts.map
