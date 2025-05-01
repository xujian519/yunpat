/**
 * 推理层 (Brain / Reasoning)
 *
 * Agent 的"大脑"，执行推理循环
 * - ReAct 循环：观察 (Observe) → 思考 (Think) → 行动 (Act)
 * - 任务规划：目标分解、子任务生成、依赖排序
 * - 推理策略：Plan-and-Solve、Tree-of-Thoughts、Reflexion
 * - 安全对齐：Constitutional AI、Guardrails
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
/**
 * 推理策略类型
 */
export declare enum ReasoningStrategy {
  /** ReAct (默认) - 推理+行动 */
  REACT = 'react',
  /** Plan-and-Solve - 先规划再解决 */
  PLAN_AND_SOLVE = 'plan_and_solve',
  /** Tree-of-Thoughts - 思维树 */
  TREE_OF_THOUGHTS = 'tree_of_thoughts',
  /** Reflexion - 反思式推理 */
  REFLEXION = 'reflexion',
}
/**
 * 观察结果
 */
export interface Observation {
  /** 观察内容 */
  content: string
  /** 相关数据 */
  data?: Record<string, unknown>
  /** 时间戳 */
  timestamp: Date
  /** 置信度 */
  confidence?: number
}
/**
 * 思考结果
 */
export interface Thought {
  /** 思考内容 */
  reasoning: string
  /** 下一步行动建议 */
  nextAction?: string
  /** 是否需要更多信息 */
  needMoreInfo?: boolean
  /** 当前状态 */
  state: 'thinking' | 'planning' | 'acting' | 'done'
}
/**
 * 行动结果
 */
export interface Action {
  /** 行动类型 */
  type: string
  /** 行动参数 */
  params?: Record<string, unknown>
  /** 目标 */
  target?: string
  /** 预期结果 */
  expectedOutcome?: string
}
/**
 * 行动执行结果
 */
export interface ActionResult {
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: unknown
  /** 错误信息 */
  error?: string
  /** 使用的工具 */
  toolUsed?: string
  /** Token 消耗 */
  tokensUsed?: number
}
/**
 * ReAct 循环迭代结果
 */
export interface ReActIteration {
  /** 迭代次数 */
  iteration: number
  /** 观察 */
  observation: Observation
  /** 思考 */
  thought: Thought
  /** 行动 */
  action?: Action
  /** 行动结果 */
  actionResult?: ActionResult
  /** 是否完成 */
  done: boolean
}
/**
 * ReAct 循环配置
 */
export interface ReActConfig {
  /** 最大迭代次数 */
  maxIterations: number
  /** 是否启用详细日志 */
  verbose: boolean
  /** 是否在每个步骤后反思 */
  reflectAfterStep: boolean
  /** 停止条件 */
  stopConditions?: Array<(iteration: ReActIteration) => boolean>
}
/**
 * ReAct 循环实现
 *
 * 观察 → 思考 → 行动 → 重复
 */
export declare class ReActLoop {
  private llm
  private config
  constructor(llm: LLMAdapter, config?: Partial<ReActConfig>)
  /**
   * 执行 ReAct 循环
   *
   * @param goal 目标
   * @param context 上下文信息
   * @returns 迭代结果生成器
   */
  execute(goal: string, context?: Record<string, unknown>): AsyncIterable<ReActIteration>
  /**
   * 思考阶段
   */
  private think
  /**
   * 决定行动
   */
  private decideAction
  /**
   * 执行行动
   */
  private executeAction
  /**
   * 更新观察
   */
  private updateObservation
  /**
   * 反思
   */
  private reflect
  /**
   * 构建思考提示
   */
  private buildThinkPrompt
  /**
   * 解析思考结果
   */
  private parseThought
}
/**
 * 执行步骤结果
 */
interface StepResult {
  /** 步骤编号 */
  step: number
  /** 步骤内容 */
  content: string
  /** 执行结果 */
  result?: string
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 是否完成 */
  done: boolean
  /** Token 消耗 */
  tokensUsed?: number
}
/**
 * Plan-and-Solve 策略
 *
 * 先规划再解决，适合复杂任务
 */
export declare class PlanAndSolveStrategy {
  private llm
  constructor(llm: LLMAdapter)
  /**
   * 生成计划
   */
  makePlan(goal: string, context?: Record<string, unknown>): Promise<string[]>
  /**
   * 执行计划（增强版）
   */
  executePlan(plan: string[], context?: Record<string, unknown>): AsyncIterable<StepResult>
  /**
   * 执行单个步骤
   */
  private executeStep
  /**
   * 验证计划质量
   */
  validatePlan(
    goal: string,
    plan: string[]
  ): Promise<{
    isValid: boolean
    score: number
    feedback: string
  }>
  /**
   * 完整执行：规划 → 验证 → 执行
   */
  planAndSolve(
    goal: string,
    context?: Record<string, unknown>
  ): AsyncIterable<
    StepResult & {
      plan?: string[]
      validation?: unknown
    }
  >
  /**
   * 解析计划步骤
   */
  private parsePlanSteps
}
export type { ThoughtNode } from './TreeOfThoughtsStrategy.js'
//# sourceMappingURL=ReActLoop.d.ts.map
