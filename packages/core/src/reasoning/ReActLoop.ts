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
import { TreeOfThoughtsStrategy, ThoughtNode } from './TreeOfThoughtsStrategy.js'

/**
 * 推理策略类型
 */
export enum ReasoningStrategy {
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
export class ReActLoop {
  private llm: LLMAdapter
  private config: ReActConfig

  constructor(llm: LLMAdapter, config?: Partial<ReActConfig>) {
    this.llm = llm
    this.config = {
      maxIterations: 10,
      verbose: false,
      reflectAfterStep: true,
      ...config,
    }
  }

  /**
   * 执行 ReAct 循环
   *
   * @param goal 目标
   * @param context 上下文信息
   * @returns 迭代结果生成器
   */
  async *execute(goal: string, context?: Record<string, unknown>): AsyncIterable<ReActIteration> {
    let iteration = 0
    let done = false
    let observation: Observation = {
      content: `目标: ${goal}`,
      timestamp: new Date(),
    }

    if (context) {
      observation.data = context
    }

    while (!done && iteration < this.config.maxIterations) {
      iteration++

      if (this.config.verbose) {
        console.log(`\n[迭代 ${iteration}]`)
      }

      // 1. 思考
      const thought = await this.think(observation, goal)

      if (this.config.verbose) {
        console.log(`[思考] ${thought.reasoning}`)
      }

      // 检查是否完成
      if (thought.state === 'done') {
        yield {
          iteration,
          observation,
          thought,
          done: true,
        }
        break
      }

      // 2. 决定行动
      const action = this.decideAction(thought)

      if (this.config.verbose) {
        console.log(`[行动] ${action.type}`, action.params || '')
      }

      // 3. 执行行动
      const actionResult = await this.executeAction(action)

      if (this.config.verbose) {
        console.log(
          `[结果] ${actionResult.success ? '成功' : '失败'}`,
          actionResult.data || actionResult.error || ''
        )
      }

      // 4. 更新观察
      observation = this.updateObservation(observation, actionResult)

      // 5. 反思（如果启用）
      if (this.config.reflectAfterStep) {
        const shouldContinue = await this.reflect(observation, thought, actionResult)
        if (!shouldContinue) {
          done = true
        }
      }

      // 6. 检查停止条件
      if (this.config.stopConditions) {
        const currentIteration: ReActIteration = {
          iteration,
          observation,
          thought,
          action,
          actionResult,
          done,
        }

        for (const stopCondition of this.config.stopConditions) {
          if (stopCondition(currentIteration)) {
            done = true
            break
          }
        }
      }

      // 7. 产生迭代结果
      yield {
        iteration,
        observation,
        thought,
        action,
        actionResult,
        done,
      }
    }
  }

  /**
   * 思考阶段
   */
  private async think(observation: Observation, goal: string): Promise<Thought> {
    const prompt = this.buildThinkPrompt(observation, goal)

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一个推理专家。请分析当前情况并给出思考过程。
返回格式：
思考：[你的推理过程]
状态：[thinking/planning/acting/done]
下一步：[下一步行动建议，如果状态为 done 则不返回]`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    return this.parseThought(response.message.content)
  }

  /**
   * 决定行动
   */
  private decideAction(thought: Thought): Action {
    if (!thought.nextAction) {
      return {
        type: 'complete',
        expectedOutcome: '任务完成',
      }
    }

    // 简化实现：直接使用 nextAction
    // 实际应用中应该解析并结构化
    return {
      type: thought.nextAction.includes('search') ? 'search' : 'tool',
      params: {
        query: thought.nextAction,
      },
    }
  }

  /**
   * 执行行动
   */
  private async executeAction(action: Action): Promise<ActionResult> {
    // 简化实现：模拟行动执行
    // 实际应用中应该调用真实的工具或 API

    if (action.type === 'complete') {
      return {
        success: true,
        data: { message: '任务已完成' },
      }
    }

    if (action.type === 'search') {
      // 模拟搜索
      return {
        success: true,
        data: {
          results: [
            { title: '模拟搜索结果 1', url: 'https://example.com/1' },
            { title: '模拟搜索结果 2', url: 'https://example.com/2' },
          ],
        },
        toolUsed: 'search',
      }
    }

    return {
      success: true,
      data: { message: '行动已执行' },
      toolUsed: action.type,
    }
  }

  /**
   * 更新观察
   */
  private updateObservation(previous: Observation, actionResult: ActionResult): Observation {
    return {
      content: actionResult.error
        ? `错误: ${actionResult.error}`
        : `成功: ${JSON.stringify(actionResult.data)}`,
      data: {
        ...previous.data,
        lastActionResult: actionResult,
      },
      timestamp: new Date(),
      confidence: actionResult.success ? 1.0 : 0.0,
    }
  }

  /**
   * 反思
   */
  private async reflect(
    observation: Observation,
    thought: Thought,
    actionResult: ActionResult
  ): Promise<boolean> {
    if (!actionResult.success) {
      // 行动失败，继续尝试
      return true
    }

    const prompt = `基于以下信息，判断任务是否完成：

观察：${observation.content}
思考：${thought.reasoning}
行动结果：${JSON.stringify(actionResult.data)}

返回 "继续" 或 "完成"。`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个任务评估专家。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    const shouldContinue = response.message.content.includes('继续')
    return shouldContinue
  }

  /**
   * 构建思考提示
   */
  private buildThinkPrompt(observation: Observation, goal: string): string {
    let prompt = `目标：${goal}\n\n`
    prompt += `当前情况：\n${observation.content}\n\n`

    if (observation.data) {
      prompt += `可用信息：\n${JSON.stringify(observation.data, null, 2)}\n\n`
    }

    prompt += `请分析当前情况，给出你的思考过程和下一步建议。`

    return prompt
  }

  /**
   * 解析思考结果
   */
  private parseThought(content: string): Thought {
    // 简化实现：解析 LLM 返回的结构化内容
    // 实际应用中应该使用更robust的解析方法

    const thought: Thought = {
      reasoning: content,
      state: 'thinking',
    }

    if (content.includes('状态：done') || content.includes('完成')) {
      thought.state = 'done'
    } else if (content.includes('下一步：')) {
      const match = content.match(/下一步：(.+)/)
      if (match) {
        thought.nextAction = match[1].trim()
      }
      thought.state = 'acting'
    }

    return thought
  }
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

    // 解析计划步骤
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
        // 执行当前步骤
        const result = await this.executeStep(step, stepNumber, plan.length, executionContext)

        // 更新执行上下文
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
        // 步骤执行失败
        yield {
          step: stepNumber,
          content: step,
          success: false,
          error: (error as Error).message,
          done: false,
        }

        // 失败后停止执行
        break
      }
    }
  }

  /**
   * 执行单个步骤
   */
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

    // 解析评分
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
    // 步骤1：生成计划
    const plan = await this.makePlan(goal, context)

    // 步骤2：验证计划
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

    // 步骤3：执行计划
    for await (const result of this.executePlan(plan, context)) {
      yield result
    }
  }

  /**
   * 解析计划步骤
   */
  private parsePlanSteps(content: string): string[] {
    const steps: string[] = []

    // 尝试多种格式
    const patterns = [
      /^\d+[\.\)]\s*(.+)$/gm, // "1. 步骤" 或 "1) 步骤"
      /^[-•]\s*(.+)$/gm, // "- 步骤" 或 "• 步骤"
    ]

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

    // 如果没有匹配到，按段落分割
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
}

// ========== Tree-of-Thoughts 策略重导出 ==========
// ToT 策略已提取到独立文件 TreeOfThoughtsStrategy.ts
// ThoughtNode 类型已迁移到 TreeOfThoughtsStrategy.ts
// 为了向后兼容，从 TreeOfThoughtsStrategy 重新导出

// /**
//  * Tree-of-Thoughts 策略
//  *
//  * 思维树，探索多个可能的思考路径
//  * @deprecated 请使用从 TreeOfThoughtsStrategy.ts 导入的 TreeOfThoughtsStrategy
//  */
// export class TreeOfThoughtsStrategy {
//   private llm: LLMAdapter;
//
//   constructor(llm: LLMAdapter) {
//     this.llm = llm;
//   }
//
//   /**
//    * 生成思维树
//    */
//   async generateThoughts(
//     problem: string,
//     branchFactor: number = 3
//   ): Promise<Array<{ thought: string; score: number }>> {
//     const prompt = `针对以下问题，请生成 ${branchFactor} 个不同的解决思路。
//
// **要求**：
// 1. 每个思路要有明确的策略
// 2. 思路之间要有差异化
// 3. 格式：1. [思路描述]
//
// 问题：${problem}
//
// 请生成 ${branchFactor} 个思路：`;
//
//     const response = await this.llm.chat({
//       messages: [
//         {
//           role: 'system',
//           content: '你是一个创意思考专家，擅长从不同角度思考问题。',
//         },
//         {
//           role: 'user',
//           content: prompt,
//         },
//       ],
//       temperature: 0.8,
//     });
//
//     // 解析多个思路
//     const thoughts = this.parseThoughts(response.message.content);
//
//     return thoughts.slice(0, branchFactor);
//   }
//
//   /**
//    * 评估思路（多维度评估）
//    */
//   async evaluateThoughts(
//     problem: string,
//     thoughts: Array<{ thought: string; score: number }>
//   ): Promise<Array<{ thought: string; score: number; evaluation?: unknown }>> {
//     const prompt = `请对以下解决思路进行多维度评估（每个维度 1-10 分）：
//
// **评估维度**：
// - 可行性：是否容易实施
// - 创新性：是否有新意
// - 完整性：是否考虑全面
// - 清晰度：表述是否清楚
//
// **问题**：${problem}
//
// **待评估思路**：
// ${thoughts.map((t, i) => `${i + 1}. ${t.thought}`).join('\n')}
//
// **请按以下格式返回**：
// 1. 可行性: X分, 创新性: X分, 完整性: X分, 清晰度: X分, 总分: XX分
// 2. 可行性: X分, 创新性: X分, 完整性: X分, 清晰度: X分, 总分: XX分
// ...`;
//
//     const response = await this.llm.chat({
//       messages: [
//         {
//           role: 'system',
//           content: '你是一个评估专家，擅长从多个维度分析方案质量。',
//         },
//         {
//           role: 'user',
//           content: prompt,
//         },
//       ],
//       temperature: 0.3,
//     });
//
//     // 解析评估结果
//     return this.parseEvaluations(response.message.content, thoughts);
//   }
//
//   /**
//    * 最佳优先搜索 - 寻找最佳解决方案
//    */
//   async bestFirstSearch(
//     problem: string,
//     maxDepth: number = 3,
//     branchFactor: number = 3
//   ): Promise<ThoughtNode> {
//     // 根节点
//     const root: ThoughtNode = {
//       thought: problem,
//       score: 0,
//       depth: 0,
//     };
//
//     // 优先队列（按分数排序）
//     const queue: ThoughtNode[] = [root];
//     let bestNode = root;
//
//     while (queue.length > 0) {
//       // 取出最佳节点
//       const current = queue.shift()!;
//       if (current.depth >= maxDepth) {
//         continue;
//       }
//
//       // 生成子节点
//       const thoughts = await this.generateThoughts(current.thought, branchFactor);
//       const evaluated = await this.evaluateThoughts(current.thought, thoughts);
//
//       // 创建子节点
//       const children: ThoughtNode[] = [];
//       for (const t of evaluated) {
//         const node: ThoughtNode = {
//           thought: t.thought,
//           score: t.score,
//           depth: current.depth + 1,
//           parent: current,
//           evaluation: t.evaluation as
//             | { feasibility: number; innovation: number; completeness: number; clarity: number }
//             | undefined,
//         };
//         children.push(node);
//
//         // 更新最佳节点
//         if (node.score > bestNode.score) {
//           bestNode = node;
//         }
//       }
//
//       current.children = children;
//
//       // 添加到队列（按分数排序）
//       queue.push(...children);
//       queue.sort((a, b) => b.score - a.score);
//     }
//
//     return bestNode;
//   }
//
//   /**
//    * 获取最佳思路的完整路径
//    */
//   getBestPath(node: ThoughtNode): string[] {
//     const path: string[] = [];
//     let current: ThoughtNode | undefined = node;
//
//     while (current) {
//       path.unshift(current.thought);
//       current = current.parent;
//     }
//
//     return path;
//   }
//
//   /**
//    * 解析思路列表
//    */
//   private parseThoughts(content: string): Array<{ thought: string; score: number }> {
//     const thoughts: Array<{ thought: string; score: number }> = [];
//
//     // 尝试多种格式
//     const patterns = [
//       /^\d+[\.\)]\s*(.+)$/gm, // "1. 思路" 或 "1) 思路"
//       /^[-•]\s*(.+)$/gm, // "- 思路" 或 "• 思路"
//     ];
//
//     for (const pattern of patterns) {
//       const matches = Array.from(content.matchAll(pattern));
//       if (matches && matches.length > 0) {
//         for (const match of matches) {
//           const cleaned = match[1]?.trim();
//           if (cleaned && !thoughts.find((t) => t.thought === cleaned)) {
//             thoughts.push({ thought: cleaned, score: 5.0 }); // 默认中等分数
//           }
//         }
//         if (thoughts.length > 0) break;
//       }
//     }
//
//     // 如果没有匹配到，按段落分割
//     if (thoughts.length === 0) {
//       const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
//       for (const para of paragraphs) {
//         const cleaned = para.trim();
//         if (cleaned && !thoughts.find((t) => t.thought === cleaned)) {
//           thoughts.push({ thought: cleaned, score: 5.0 });
//         }
//       }
//     }
//
//     return thoughts;
//   }
//
//   /**
//    * 解析评估结果
//    */
//   private parseEvaluations(
//     content: string,
//     originalThoughts: Array<{ thought: string; score: number }>
//   ): Array<{ thought: string; score: number; evaluation?: unknown }> {
//     const results: Array<{ thought: string; score: number; evaluation?: unknown }> = [];
//
//     // 按行解析
//     const lines = content.split('\n').filter((line) => line.trim());
//
//     for (let i = 0; i < Math.min(lines.length, originalThoughts.length); i++) {
//       const line = lines[i];
//       const thought = originalThoughts[i].thought;
//
//       // 解析分数
//       const scores = this.parseScores(line);
//
//       results.push({
//         thought,
//         score: scores.total || 5.0,
//         evaluation: {
//           feasibility: scores.feasibility || 5.0,
//           innovation: scores.innovation || 5.0,
//           completeness: scores.completeness || 5.0,
//           clarity: scores.clarity || 5.0,
//         },
//       });
//     }
//
//     return results;
//   }
//
//   /**
//    * 解析单个评估分数
//    */
//   private parseScores(line: string): {
//     feasibility: number;
//     innovation: number;
//     completeness: number;
//     clarity: number;
//     total: number;
//   } {
//     const scores = {
//       feasibility: 5.0,
//       innovation: 5.0,
//       completeness: 5.0,
//       clarity: 5.0,
//       total: 5.0,
//     };
//
//     // 尝试匹配 "可行性: X分, 创新性: X分, 完整性: X分, 清晰度: X分" 格式
//     const pattern = /可行性[:：]\s*(\d+(?:\.\d+)?)\s*分/;
//     const match = line.match(pattern);
//
//     if (match) {
//       // 使用更精确的匹配
//       const patterns = {
//         feasibility: /可行性[:：]\s*(\d+(?:\.\d+)?)/,
//         innovation: /创新性[:：]\s*(\d+(?:\.\d+)?)/,
//         completeness: /完整性[:：]\s*(\d+(?:\.\d+)?)/,
//         clarity: /清晰度[:：]\s*(\d+(?:\.\d+)?)/,
//         total: /总分[:：]\s*(\d+(?:\.\d+)?)/,
//       };
//
//       for (const [key, regex] of Object.entries(patterns)) {
//         const m = line.match(regex);
//         if (m) {
//           (scores as any)[key] = parseFloat(m[1]);
//         }
//       }
//
//       // 计算总分（如果没有明确给出）
//       if (scores.total === 5.0) {
//         const sum = scores.feasibility + scores.innovation + scores.completeness + scores.clarity;
//         if (sum > 20) {
//           // 如果不是默认值
//           scores.total = sum / 4;
//         }
//       }
//     } else {
//       // 降级方案：提取所有数字
//       const numberPattern = /(\d+(?:\.\d+)?)/g;
//       const numbers = line.match(numberPattern);
//
//       if (numbers && numbers.length >= 4) {
//         const nums = numbers.map((n) => parseFloat(n));
//         scores.feasibility = nums[0];
//         scores.innovation = nums[1];
//         scores.completeness = nums[2];
//         scores.clarity = nums[3];
//         scores.total = nums[4] || (nums[0] + nums[1] + nums[2] + nums[3]) / 4;
//       }
//     }
//
//     return scores;
//   }
// }

// 重新导出 ThoughtNode 以保持向后兼容
export type { ThoughtNode } from './TreeOfThoughtsStrategy.js'
