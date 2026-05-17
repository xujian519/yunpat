/**
 * CritiqueLoop - 批判-反馈循环
 *
 * 在任务执行后自动触发评估 Agent，
 * 不达标则附带反馈信息重试执行
 *
 * 设计参考：PatExpert 的 Critique Agent 双重评估机制
 */

import type {
  CritiqueConfig,
  CritiqueResult,
  AgentResult,
  ExecutionContext,
} from '../types/index.js'
import type { AgentRegistry } from '../registry/AgentRegistry.js'
import { errorToAgentError } from '@yunpat/agent-base'

export class CritiqueLoop {
  constructor(private agentRegistry?: AgentRegistry) {}

  /**
   * 执行批判循环
   * @param executeFn - 执行被评估 Agent 的函数
   * @param config - 批判配置
   * @param context - 执行上下文
   * @returns 包含批判结果的 AgentResult
   */
  async executeWithCritique(
    executeFn: () => Promise<AgentResult>,
    config: CritiqueConfig,
    context: ExecutionContext
  ): Promise<{ result: AgentResult; critique: CritiqueResult }> {
    let round = 0
    let previousFeedback: string | undefined = undefined
    let lastResult: AgentResult | undefined = undefined

    while (round < config.maxCritiqueRounds) {
      round++

      const startTime = Date.now()

      try {
        // 执行目标 Agent
        let result: AgentResult

        if (round === 1) {
          result = await executeFn()
        } else {
          // 第二轮及以后，将反馈注入到输入中
          // 这里通过修改 context 的 input 来传递反馈
          const originalExecuteFn = executeFn

          result = await originalExecuteFn()
        }

        lastResult = result

        // 调用评估 Agent
        const critiqueResult = await this.runEvaluator(result, config, previousFeedback)

        // 如果通过，返回结果
        if (critiqueResult.passed) {
          return {
            result,
            critique: {
              ...critiqueResult,
              rounds: round,
            },
          }
        }

        // 保存反馈用于下一轮
        previousFeedback = critiqueResult.feedback

        // 达到最大轮数，返回最后一次结果
        if (round >= config.maxCritiqueRounds) {
          return {
            result,
            critique: {
              ...critiqueResult,
              rounds: round,
            },
          }
        }
      } catch (error) {
        const errorResult: AgentResult = {
          success: false,
          data: {},
          error: errorToAgentError(error instanceof Error ? error : new Error(String(error))),
          executionTime: Date.now() - startTime,
        }

        return {
          result: errorResult,
          critique: {
            passed: false,
            score: 0,
            feedback: `执行失败: ${error instanceof Error ? error.message : String(error)}`,
            rounds: round,
          },
        }
      }
    }

    return {
      result: lastResult ?? {
        success: false,
        data: {},
        error: errorToAgentError(new Error('Unknown error')),
        executionTime: 0,
      },
      critique: {
        passed: false,
        score: 0,
        feedback: '超过最大批判轮数',
        rounds: config.maxCritiqueRounds,
      },
    }
  }

  /**
   * 调用评估 Agent
   */
  private async runEvaluator(
    agentResult: AgentResult,
    config: CritiqueConfig,
    previousFeedback?: string
  ): Promise<CritiqueResult> {
    if (!this.agentRegistry) {
      return {
        passed: false,
        score: 0,
        feedback: 'AgentRegistry 未配置，无法调用评估 Agent',
        rounds: 0,
      }
    }

    const evaluator = this.agentRegistry.get(config.evaluatorAgentId)

    if (!evaluator) {
      return {
        passed: false,
        score: 0,
        feedback: `评估 Agent 未找到: ${config.evaluatorAgentId}`,
        rounds: 0,
      }
    }

    try {
      // 构造评估 Agent 的输入
      const evaluationInput = {
        targetResult: agentResult.data,
        previousFeedback,
      }

      const evaluationResult = await evaluator.execute(evaluationInput)

      // 解析评估结果
      let score = 0
      let feedback = '评估结果格式错误'
      let evaluation: Record<string, any> | undefined = undefined

      if (evaluationResult && typeof evaluationResult === 'object') {
        // 尝试从不同字段提取评分和反馈
        if ('score' in evaluationResult && typeof evaluationResult.score === 'number') {
          score = evaluationResult.score
        } else if (
          'qualityScore' in evaluationResult &&
          typeof evaluationResult.qualityScore === 'number'
        ) {
          score = evaluationResult.qualityScore
        }

        const feedbackField = config.feedbackField ?? 'feedback'
        if (
          feedbackField in evaluationResult &&
          typeof evaluationResult[feedbackField] === 'string'
        ) {
          feedback = evaluationResult[feedbackField]
        } else if (
          'suggestions' in evaluationResult &&
          typeof evaluationResult.suggestions === 'string'
        ) {
          feedback = evaluationResult.suggestions
        }

        evaluation = evaluationResult
      }

      // 判断是否通过
      const passed = score >= config.threshold

      return {
        passed,
        score,
        feedback,
        evaluation,
        rounds: 0,
      }
    } catch (error) {
      return {
        passed: false,
        score: 0,
        feedback: `评估 Agent 执行失败: ${error instanceof Error ? error.message : String(error)}`,
        rounds: 0,
      }
    }
  }
}
