import { LLMAdapter } from '../lifecycle/Lifecycle.js'

/**
 * 执行步骤结果
 */
export interface StepResult {
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
export class PlanAndSolveStrategy {
  private llm: LLMAdapter

  constructor(llm: LLMAdapter) {
    this.llm = llm
  }

  /**
   * 生成计划
   */
  async makePlan(goal: string, context?: Record<string, unknown>): Promise<string[]> {
    let prompt = `请为以下目标制定详细的执行计划。

**要求**：
1. 将目标分解为清晰的步骤
2. 每个步骤应该是可执行的
3. 步骤之间要有逻辑顺序
4. 格式：1. [步骤描述]

**目标**：${goal}`

    if (context && Object.keys(context).length > 0) {
      prompt += `\n\n**上下文**：\n${JSON.stringify(context, null, 2)}`
    }

    prompt += `\n\n请列出执行计划：`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个规划专家，擅长将复杂目标分解为可执行的步骤。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    })

    const steps = this.parsePlanSteps(response.message.content)

    if (steps.length === 0) {
      throw new Error('未能生成有效的执行计划')
    }

    return steps
  }

  /**
   * 执行计划（增强版）
   */
  async *executePlan(plan: string[], context?: Record<string, unknown>): AsyncIterable<StepResult> {
    let executionContext = context || {}

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i]
      const stepNumber = i + 1

      try {
        const result = await this.executeStep(step, stepNumber, plan.length, executionContext)

        if (result.result) {
          executionContext = {
            ...executionContext,
            [`step${stepNumber}Result`]: result.result,
          }
        }

        yield {
          step: stepNumber,
          content: step,
          result: result.result,
          success: true,
          done: i === plan.length - 1,
          tokensUsed: result.tokensUsed,
        }
      } catch (error) {
        yield {
          step: stepNumber,
          content: step,
          success: false,
          error: (error as Error).message,
          done: false,
        }

        break
      }
    }
  }

  /**
   * 验证计划质量
   */
  async validatePlan(
    goal: string,
    plan: string[]
  ): Promise<{
    isValid: boolean
    score: number
    feedback: string
  }> {
    const prompt = `请验证以下执行计划的质量：

**目标**：${goal}

**计划**：
${plan.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**评估维度**：
1. 完整性：是否覆盖目标的所有方面
2. 可行性：步骤是否可执行
3. 逻辑性：步骤顺序是否合理
4. 清晰性：步骤描述是否清楚

请给出评分（1-10）和改进建议。`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个质量评估专家。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    const scoreMatch = response.message.content.match(/(\d+)\/?10?/)
    const score = scoreMatch ? parseInt(scoreMatch[1]) / 10 : 0.5

    return {
      isValid: score >= 0.6,
      score,
      feedback: response.message.content,
    }
  }

  /**
   * 完整执行：规划 → 验证 → 执行
   */
  async *planAndSolve(
    goal: string,
    context?: Record<string, unknown>
  ): AsyncIterable<StepResult & { plan?: string[]; validation?: unknown }> {
    const plan = await this.makePlan(goal, context)

    const validation = await this.validatePlan(goal, plan)

    yield {
      step: 0,
      content: '计划生成和验证',
      result: `计划包含 ${plan.length} 个步骤，质量评分: ${(validation.score * 10).toFixed(1)}/10`,
      success: validation.isValid,
      done: false,
      plan,
      validation,
    }

    if (!validation.isValid) {
      yield {
        step: 0,
        content: '计划验证失败',
        success: false,
        error: '计划质量不足，请重新规划',
        done: true,
      }
      return
    }

    for await (const result of this.executePlan(plan, context)) {
      yield result
    }
  }

  private parsePlanSteps(content: string): string[] {
    const steps: string[] = []

    const patterns = [/^\d+[\.\)]\s*(.+)$/gm, /^[-•]\s*(.+)$/gm]

    for (const pattern of patterns) {
      const matches = Array.from(content.matchAll(pattern))
      if (matches.length > 0) {
        for (const match of matches) {
          const step = match[1]?.trim()
          if (step && !steps.includes(step)) {
            steps.push(step)
          }
        }
        if (steps.length > 0) break
      }
    }

    if (steps.length === 0) {
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim())
      for (const para of paragraphs) {
        const step = para.trim()
        if (step && !steps.includes(step)) {
          steps.push(step)
        }
      }
    }

    return steps
  }

  private async executeStep(
    step: string,
    stepNumber: number,
    totalSteps: number,
    context: Record<string, unknown>
  ): Promise<{ result: string; tokensUsed: number }> {
    let prompt = `请执行以下步骤：

**当前步骤** (${stepNumber}/${totalSteps}): ${step}`

    if (Object.keys(context).length > 0) {
      prompt += `\n\n**前序步骤结果**：\n${JSON.stringify(context, null, 2)}`
    }

    prompt += `\n\n请执行该步骤并返回结果。`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个执行专家，严格按照要求完成任务。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    return {
      result: response.message.content,
      tokensUsed: response.usage?.totalTokens || 0,
    }
  }
}
