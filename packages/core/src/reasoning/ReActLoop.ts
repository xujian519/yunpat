/**
 * 推理层 (Brain / Reasoning)
 *
 * Agent 的"大脑"，执行推理循环
 * - ReAct 循环：观察 (Observe) → 思考 (Think) → 行动 (Act)
 * - 任务规划：目标分解、子任务生成、依赖排序
 * - 推理策略：Plan-and-Solve、Tree-of-Thoughts、Reflexion
 * - 安全对齐：Constitutional AI、Guardrails
 */

import { LLMAdapter, ChatParams } from '../lifecycle/Lifecycle.js';

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
  content: string;

  /** 相关数据 */
  data?: Record<string, any>;

  /** 时间戳 */
  timestamp: Date;

  /** 置信度 */
  confidence?: number;
}

/**
 * 思考结果
 */
export interface Thought {
  /** 思考内容 */
  reasoning: string;

  /** 下一步行动建议 */
  nextAction?: string;

  /** 是否需要更多信息 */
  needMoreInfo?: boolean;

  /** 当前状态 */
  state: 'thinking' | 'planning' | 'acting' | 'done';
}

/**
 * 行动结果
 */
export interface Action {
  /** 行动类型 */
  type: string;

  /** 行动参数 */
  params?: Record<string, any>;

  /** 目标 */
  target?: string;

  /** 预期结果 */
  expectedOutcome?: string;
}

/**
 * 行动执行结果
 */
export interface ActionResult {
  /** 是否成功 */
  success: boolean;

  /** 结果数据 */
  data?: any;

  /** 错误信息 */
  error?: string;

  /** 使用的工具 */
  toolUsed?: string;

  /** Token 消耗 */
  tokensUsed?: number;
}

/**
 * ReAct 循环迭代结果
 */
export interface ReActIteration {
  /** 迭代次数 */
  iteration: number;

  /** 观察 */
  observation: Observation;

  /** 思考 */
  thought: Thought;

  /** 行动 */
  action?: Action;

  /** 行动结果 */
  actionResult?: ActionResult;

  /** 是否完成 */
  done: boolean;
}

/**
 * ReAct 循环配置
 */
export interface ReActConfig {
  /** 最大迭代次数 */
  maxIterations: number;

  /** 是否启用详细日志 */
  verbose: boolean;

  /** 是否在每个步骤后反思 */
  reflectAfterStep: boolean;

  /** 停止条件 */
  stopConditions?: Array<(iteration: ReActIteration) => boolean>;
}

/**
 * ReAct 循环实现
 *
 * 观察 → 思考 → 行动 → 重复
 */
export class ReActLoop {
  private llm: LLMAdapter;
  private config: ReActConfig;

  constructor(llm: LLMAdapter, config?: Partial<ReActConfig>) {
    this.llm = llm;
    this.config = {
      maxIterations: 10,
      verbose: false,
      reflectAfterStep: true,
      ...config,
    };
  }

  /**
   * 执行 ReAct 循环
   *
   * @param goal 目标
   * @param context 上下文信息
   * @returns 迭代结果生成器
   */
  async *execute(goal: string, context?: Record<string, any>): AsyncIterable<ReActIteration> {
    let iteration = 0;
    let done = false;
    let observation: Observation = {
      content: `目标: ${goal}`,
      timestamp: new Date(),
    };

    if (context) {
      observation.data = context;
    }

    while (!done && iteration < this.config.maxIterations) {
      iteration++;

      if (this.config.verbose) {
        console.log(`\n[迭代 ${iteration}]`);
      }

      // 1. 思考
      const thought = await this.think(observation, goal);

      if (this.config.verbose) {
        console.log(`[思考] ${thought.reasoning}`);
      }

      // 检查是否完成
      if (thought.state === 'done') {
        yield {
          iteration,
          observation,
          thought,
          done: true,
        };
        break;
      }

      // 2. 决定行动
      const action = this.decideAction(thought);

      if (this.config.verbose) {
        console.log(`[行动] ${action.type}`, action.params || '');
      }

      // 3. 执行行动
      const actionResult = await this.executeAction(action);

      if (this.config.verbose) {
        console.log(
          `[结果] ${actionResult.success ? '成功' : '失败'}`,
          actionResult.data || actionResult.error || ''
        );
      }

      // 4. 更新观察
      observation = this.updateObservation(observation, actionResult);

      // 5. 反思（如果启用）
      if (this.config.reflectAfterStep) {
        const shouldContinue = await this.reflect(observation, thought, actionResult);
        if (!shouldContinue) {
          done = true;
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
        };

        for (const stopCondition of this.config.stopConditions) {
          if (stopCondition(currentIteration)) {
            done = true;
            break;
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
      };
    }
  }

  /**
   * 思考阶段
   */
  private async think(observation: Observation, goal: string): Promise<Thought> {
    const prompt = this.buildThinkPrompt(observation, goal);

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
    });

    return this.parseThought(response.message.content);
  }

  /**
   * 决定行动
   */
  private decideAction(thought: Thought): Action {
    if (!thought.nextAction) {
      return {
        type: 'complete',
        expectedOutcome: '任务完成',
      };
    }

    // 简化实现：直接使用 nextAction
    // 实际应用中应该解析并结构化
    return {
      type: thought.nextAction.includes('search') ? 'search' : 'tool',
      params: {
        query: thought.nextAction,
      },
    };
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
      };
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
      };
    }

    return {
      success: true,
      data: { message: '行动已执行' },
      toolUsed: action.type,
    };
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
    };
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
      return true;
    }

    const prompt = `基于以下信息，判断任务是否完成：

观察：${observation.content}
思考：${thought.reasoning}
行动结果：${JSON.stringify(actionResult.data)}

返回 "继续" 或 "完成"。`;

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
    });

    const shouldContinue = response.message.content.includes('继续');
    return shouldContinue;
  }

  /**
   * 构建思考提示
   */
  private buildThinkPrompt(observation: Observation, goal: string): string {
    let prompt = `目标：${goal}\n\n`;
    prompt += `当前情况：\n${observation.content}\n\n`;

    if (observation.data) {
      prompt += `可用信息：\n${JSON.stringify(observation.data, null, 2)}\n\n`;
    }

    prompt += `请分析当前情况，给出你的思考过程和下一步建议。`;

    return prompt;
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
    };

    if (content.includes('状态：done') || content.includes('完成')) {
      thought.state = 'done';
    } else if (content.includes('下一步：')) {
      const match = content.match(/下一步：(.+)/);
      if (match) {
        thought.nextAction = match[1].trim();
      }
      thought.state = 'acting';
    }

    return thought;
  }
}

/**
 * Plan-and-Solve 策略
 *
 * 先规划再解决，适合复杂任务
 */
export class PlanAndSolveStrategy {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  /**
   * 生成计划
   */
  async makePlan(goal: string, context?: Record<string, any>): Promise<string[]> {
    let prompt = `请为以下目标制定详细的执行计划：\n\n目标：${goal}\n\n`;

    if (context) {
      prompt += `上下文：\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += `请列出步骤，每行一个步骤。`;

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个规划专家。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    // 解析计划步骤
    const steps = response.message.content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim());

    return steps;
  }

  /**
   * 执行计划
   */
  async *executePlan(
    plan: string[],
    context?: Record<string, any>
  ): AsyncIterable<{ step: number; content: string; done: boolean }> {
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];

      // 执行步骤（简化实现）
      yield {
        step: i + 1,
        content: step,
        done: i === plan.length - 1,
      };
    }
  }
}

/**
 * Tree-of-Thoughts 策略
 *
 * 思维树，探索多个可能的思考路径
 */
export class TreeOfThoughtsStrategy {
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  /**
   * 生成思维树
   */
  async generateThoughts(
    problem: string,
    branchFactor: number = 3
  ): Promise<Array<{ thought: string; score: number }>> {
    const prompt = `针对以下问题，请生成 ${branchFactor} 个不同的解决思路：\n\n问题：${problem}\n\n`;

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个创意思考专家。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
    });

    // 简化实现：解析多个思路
    const thoughts = response.message.content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({
        thought: line.replace(/^\d+[\.\)]\s*/, '').trim(),
        score: Math.random(), // 简化：随机评分
      }));

    return thoughts.slice(0, branchFactor);
  }

  /**
   * 评估思路
   */
  async evaluateThoughts(
    problem: string,
    thoughts: Array<{ thought: string; score: number }>
  ): Promise<Array<{ thought: string; score: number }>> {
    // 简化实现：使用 LLM 评分
    // 实际应用中应该有更复杂的评估逻辑

    let prompt = `请评估以下解决思路的质量（1-10分）：\n\n问题：${problem}\n\n`;
    thoughts.forEach((t, i) => {
      prompt += `${i + 1}. ${t.thought}\n`;
    });

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个评估专家。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    // 简化实现：随机更新分数
    return thoughts.map((t) => ({
      ...t,
      score: Math.random() * 10,
    }));
  }
}
